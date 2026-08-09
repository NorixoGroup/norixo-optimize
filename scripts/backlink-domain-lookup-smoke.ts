import { getBacklinkDomainByHostname } from "../lib/backlinks/repositories/domainsRepository";

const workspaceId = "00000000-0000-4000-8000-000000000001";
const otherWorkspaceId = "00000000-0000-4000-8000-000000000002";
const hostname = "example.com";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function repositoryClient(data: object | null) {
  const calls: { tables: string[]; filters: Array<{ column: string; value: string }> } = {
    tables: [],
    filters: [],
  };
  const query = {
    select() {
      return query;
    },
    eq(column: string, value: string) {
      calls.filters.push({ column, value });
      return query;
    },
    async maybeSingle() {
      return { data, error: null };
    },
  };
  return {
    client: {
      from(table: string) {
        calls.tables.push(table);
        return query;
      },
    },
    calls,
  };
}

async function lookup(client: object, lookupWorkspaceId: string, lookupHostname: string): Promise<unknown> {
  return Reflect.apply(getBacklinkDomainByHostname, undefined, [
    client,
    lookupWorkspaceId,
    lookupHostname,
  ]);
}

async function main(): Promise<void> {
  const domain = { id: "domain-id", workspace_id: workspaceId, hostname };
  const foundRepository = repositoryClient(domain);
  const found = await lookup(foundRepository.client, workspaceId, hostname);
  assert(found === domain, "Expected the matching domain.");
  assert(
    JSON.stringify(foundRepository.calls) ===
      JSON.stringify({
        tables: ["backlink_domains"],
        filters: [
          { column: "workspace_id", value: workspaceId },
          { column: "hostname", value: hostname },
        ],
      }),
    "Expected exact workspace and hostname filters.",
  );

  const absentRepository = repositoryClient(null);
  assert(
    (await lookup(absentRepository.client, workspaceId, "absent.example")) === null,
    "Expected null for an absent hostname.",
  );

  const crossWorkspaceRepository = repositoryClient(null);
  assert(
    (await lookup(crossWorkspaceRepository.client, otherWorkspaceId, hostname)) === null,
    "Expected null for a hostname outside the workspace.",
  );
  assert(
    JSON.stringify(crossWorkspaceRepository.calls.filters) ===
      JSON.stringify([
        { column: "workspace_id", value: otherWorkspaceId },
        { column: "hostname", value: hostname },
      ]),
    "Expected workspace filtering for cross-workspace lookup.",
  );

  console.log("backlink domain lookup smoke: PASS");
}

void main();
