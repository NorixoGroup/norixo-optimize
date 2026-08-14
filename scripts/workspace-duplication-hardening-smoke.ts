function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function assertRejects(action: () => Promise<unknown>, expectedMessage: RegExp, message: string): Promise<void> {
  try {
    await action();
  } catch (error) {
    assert(error instanceof Error && expectedMessage.test(error.message), message);
    return;
  }

  throw new Error(message);
}

type Row = Record<string, unknown>;

function createFakeClient(seed: { workspaces?: Row[]; memberships?: Row[]; subscriptions?: Row[]; auditCreditLots?: Row[]; usageEvents?: Row[]; workspaceError?: Error | null } = {}) {
  const state = {
    workspaces: [...(seed.workspaces ?? [])],
    memberships: [...(seed.memberships ?? [])],
    subscriptions: [...(seed.subscriptions ?? [])],
    auditCreditLots: [...(seed.auditCreditLots ?? [])],
    usageEvents: [...(seed.usageEvents ?? [])],
    workspaceError: seed.workspaceError ?? null,
    insertedWorkspaces: 0,
    insertedMemberships: 0,
    insertedSubscriptions: 0,
  };

  function rowsFor(table: string, filters: Array<[string, unknown]>) {
    const source =
      table === "workspaces"
        ? state.workspaces
        : table === "workspace_members"
          ? state.memberships
          : table === "subscriptions"
            ? state.subscriptions
            : table === "audit_credit_lots"
              ? state.auditCreditLots
              : table === "usage_events"
                ? state.usageEvents
            : [];

    return source.filter((row) =>
      filters.every(([column, value]) => String(row[column] ?? "") === String(value ?? ""))
    );
  }

  function chain(table: string, op: "select" | "insert", payload?: Row | Row[]) {
    const filters: Array<[string, unknown]> = [];
    const selectRows = () => {
      const source =
        table === "workspaces"
          ? state.workspaces
          : table === "workspace_members"
            ? state.memberships
            : table === "subscriptions"
              ? state.subscriptions
              : [];

      return source.filter((row) =>
        filters.every(([column, value]) => String(row[column] ?? "") === String(value ?? ""))
      );
    };
    return {
      select() {
        return this;
      },
      eq(column: string, value: unknown) {
        filters.push([column, value]);
        return this;
      },
      in(column: string, values: readonly unknown[]) {
        const nextFilters = rowsFor(table, filters).filter((row) =>
          values.some((value) => String(row[column] ?? "") === String(value ?? ""))
        );
        filters.length = 0;
        for (const row of nextFilters) {
          filters.push(["__row__", row]);
        }
        return this;
      },
      then(onFulfilled: (value: { data: Row[]; error: null }) => unknown, onRejected?: (reason: unknown) => unknown) {
        try {
          if (table === "workspaces" && state.workspaceError) {
            throw state.workspaceError;
          }
          return Promise.resolve(onFulfilled({ data: selectRows(), error: null }));
        } catch (error) {
          return onRejected ? Promise.resolve(onRejected(error)) : Promise.reject(error);
        }
      },
      async maybeSingle() {
        if (table === "workspaces" && state.workspaceError) {
          throw state.workspaceError;
        }
        if (op === "insert") {
          const inserted = payload as Row;
          return { data: inserted ?? null, error: null };
        }

        const rows = selectRows();
        return { data: (rows[0] ?? null) as Row | null, error: null };
      },
      async single() {
        return this.maybeSingle();
      },
    };
  }

  return {
    state,
    from(table: string) {
      return {
        select() {
          return chain(table, "select");
        },
        insert(row: Row) {
          if (table === "workspaces") state.insertedWorkspaces += 1;
          if (table === "workspace_members") state.insertedMemberships += 1;
          if (table === "subscriptions") state.insertedSubscriptions += 1;

          if (table === "workspaces") state.workspaces.push(row);
          if (table === "workspace_members") state.memberships.push(row);
          if (table === "subscriptions") state.subscriptions.push(row);
          if (table === "audit_credit_lots") state.auditCreditLots.push(row);
          if (table === "usage_events") state.usageEvents.push(row);

          return chain(table, "insert", row);
        },
      };
    },
  };
}

async function main() {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://127.0.0.1:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "anon-key";
  const { getOrCreateWorkspaceForUser } = await import("../lib/workspaces/ensureWorkspaceForUser");

  const userId = "4c9c62b0-4523-4784-a8b7-aff550fadffb";
  const workspaceId = "4e0c9c85-52f8-4432-887d-6cba524e561f";
  const ownedWorkspace = {
    id: workspaceId,
    name: "Canonical",
    slug: "afanour31770-workspace",
    owner_user_id: userId,
    created_at: "2026-03-18T12:00:00.000Z",
    updated_at: "2026-03-18T12:00:00.000Z",
  };

  {
    const client = createFakeClient({
      workspaces: [ownedWorkspace],
      memberships: [{ workspace_id: workspaceId, user_id: userId, role: "owner" }],
      subscriptions: [{ id: "sub-1", workspace_id: workspaceId, plan_code: "scale", status: "active", created_at: ownedWorkspace.created_at, updated_at: ownedWorkspace.updated_at }],
    });

    const result = await getOrCreateWorkspaceForUser({ userId, email: "owner@example.com", client: client as any });
    assert(result?.id === workspaceId, "Owned workspace should be reused when membership exists.");
    assert(client.state.insertedWorkspaces === 0, "No workspace should be created when owned workspace exists.");
    assert(client.state.insertedMemberships === 0, "Existing membership should not be duplicated.");
    assert(client.state.insertedSubscriptions === 0, "Existing subscription should not be duplicated.");
  }

  {
    const client = createFakeClient({
      workspaceError: new Error("owner lookup failed"),
    });
    await assertRejects(
      () => getOrCreateWorkspaceForUser({ userId, email: "owner@example.com", client: client as any }),
      /owner lookup failed/,
      "Owner lookup error must reject.",
    );
    assert(client.state.insertedWorkspaces === 0, "Owner lookup error must fail closed before workspace creation.");
  }

  {
    const client = createFakeClient({ workspaces: [ownedWorkspace] });
    const result = await getOrCreateWorkspaceForUser({ userId, email: "owner@example.com", client: client as any });
    assert(result?.id === workspaceId, "Owned workspace should be reused without membership.");
    assert(client.state.insertedWorkspaces === 0, "Owner_user_id must prevent a second workspace.");
    assert(client.state.insertedMemberships === 1, "Membership should be guaranteed for the reused owner workspace.");
    assert(client.state.insertedSubscriptions === 1, "Subscription should be guaranteed for the reused owner workspace.");

    const again = await getOrCreateWorkspaceForUser({ userId, email: "owner@example.com", client: client as any });
    assert(again?.id === workspaceId, "Repeated calls must keep reusing the owner workspace.");
    assert(client.state.insertedWorkspaces === 0, "Repeated calls must not create a second workspace.");
  }

  {
    const preferredWorkspaceId = "4c9c62b0-4523-4784-a8b7-aff550fadffb-credits";
    const preferredWorkspace = {
      id: preferredWorkspaceId,
      name: "Preferred",
      slug: "preferred-workspace",
      owner_user_id: "another-user",
      created_at: "2026-03-01T12:00:00.000Z",
      updated_at: "2026-03-01T12:00:00.000Z",
    };
    const client = createFakeClient({
      workspaces: [ownedWorkspace, preferredWorkspace],
      memberships: [
        { workspace_id: workspaceId, user_id: userId, role: "owner" },
        { workspace_id: preferredWorkspaceId, user_id: userId, role: "member" },
      ],
      subscriptions: [
        { id: "sub-1", workspace_id: workspaceId, plan_code: "free", status: "active", created_at: ownedWorkspace.created_at, updated_at: ownedWorkspace.updated_at },
        { id: "sub-2", workspace_id: preferredWorkspaceId, plan_code: "free", status: "active", created_at: preferredWorkspace.created_at, updated_at: preferredWorkspace.updated_at },
      ],
      auditCreditLots: [
        { workspace_id: preferredWorkspaceId, granted_quantity: 3, consumed_quantity: 0 },
      ],
    });

    const result = await getOrCreateWorkspaceForUser({ userId, email: "owner@example.com", client: client as any });
    assert(result?.id === preferredWorkspaceId, "Ranking must still prefer the credited workspace over the owned workspace.");
    assert(client.state.insertedWorkspaces === 0, "Ranking must not create a second workspace when a legitimate candidate exists.");
  }

  {
    const client = createFakeClient();
    const result = await getOrCreateWorkspaceForUser({ userId, email: "owner@example.com", client: client as any });
    assert(result?.owner_user_id === userId, "A missing workspace should be created for the owner.");
    assert(client.state.insertedWorkspaces === 1, "Exactly one workspace should be created when none exists.");
    assert(client.state.insertedMemberships === 1, "A new workspace must get one membership.");
    assert(client.state.insertedSubscriptions === 1, "A new workspace must get one subscription.");
  }

  console.log("PASS — Workspace duplication hardening smoke");
}

void main();
