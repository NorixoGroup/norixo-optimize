import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildLinkedInConnectionCredentialPatch,
  buildLinkedInConnectionInvalidationPatch,
  isLinkedInConnectionExpired,
  resolveLinkedInConnectionLifecycle,
} from "../lib/marketing-ai/linkedin/linkedinConnectionStore";
import {
  executeLinkedInPublishWithRollback,
  publishLinkedInTextPost,
} from "../lib/marketing-ai/linkedin/linkedinApi";

const now = new Date("2026-09-02T12:00:00.000Z");
const usable = {
  status: "connected" as const,
  credentialComplete: true,
  credentialDecryptable: true,
};

assert.equal(isLinkedInConnectionExpired("2026-09-02T11:59:59.999Z", now), true);
assert.equal(isLinkedInConnectionExpired("2026-09-02T12:00:00.001Z", now), false);
assert.equal(isLinkedInConnectionExpired(null, now), false);
assert.equal(
  resolveLinkedInConnectionLifecycle({ ...usable, expiresAt: "2026-09-02T11:59:59.999Z", now }),
  "reconnect_required",
);
assert.equal(
  resolveLinkedInConnectionLifecycle({ ...usable, expiresAt: "2026-09-02T12:00:00.001Z", now }),
  "connected",
);
assert.equal(
  resolveLinkedInConnectionLifecycle({ ...usable, expiresAt: null, now }),
  "connected",
);
assert.equal(
  resolveLinkedInConnectionLifecycle({ ...usable, expiresAt: null, credentialComplete: false, now }),
  "reconnect_required",
);
assert.equal(
  resolveLinkedInConnectionLifecycle({ ...usable, expiresAt: null, credentialDecryptable: false, now }),
  "reconnect_required",
);
assert.equal(
  resolveLinkedInConnectionLifecycle({ ...usable, status: "disconnected", expiresAt: null, credentialComplete: false, credentialDecryptable: false, now }),
  "disconnected",
);

const disconnectPatch = buildLinkedInConnectionCredentialPatch(null);
assert.deepEqual(disconnectPatch, {
  access_token: null,
  access_token_ciphertext: null,
  access_token_iv: null,
  access_token_auth_tag: null,
  access_token_key_version: null,
});

const invalidationPatch = buildLinkedInConnectionInvalidationPatch();
assert.deepEqual(invalidationPatch, {
  status: "reconnect_required",
  ...disconnectPatch,
});

type PersistedCredential = {
  workspaceId: string;
  status: "connected" | "error" | "reconnect_required" | "disconnected";
  access_token_ciphertext: string | null;
  access_token_iv: string | null;
  access_token_auth_tag: string | null;
  access_token_key_version: string | null;
};

function connectedCredential(workspaceId: string): PersistedCredential {
  return {
    workspaceId,
    status: "connected",
    access_token_ciphertext: "ciphertext",
    access_token_iv: "iv",
    access_token_auth_tag: "auth-tag",
    access_token_key_version: "key-v1",
  };
}

function canCallProviderFromFreshCredentialLoad(row: PersistedCredential) {
  const status = resolveLinkedInConnectionLifecycle({
    status: row.status,
    expiresAt: null,
    credentialComplete: Boolean(
      row.access_token_ciphertext &&
        row.access_token_iv &&
        row.access_token_auth_tag &&
        row.access_token_key_version,
    ),
    credentialDecryptable: Boolean(row.access_token_ciphertext),
    now,
  });

  return status === "connected";
}

function invalidatePersistedCredential(row: PersistedCredential) {
  return { ...row, ...buildLinkedInConnectionInvalidationPatch() };
}

const originalFetch = globalThis.fetch;
const oauthConfig = {
  clientId: "test-client",
  clientSecret: "test-secret",
  redirectUri: "https://example.test/callback",
  apiVersion: "202601",
};
const publishParams = {
  accessToken: "synthetic-token",
  organizationUrn: "urn:li:organization:123",
  message: "Synthetic lifecycle test",
};

async function publishWithStatus(status: number) {
  globalThis.fetch = async () => new Response("{}", { status });
  const result = await publishLinkedInTextPost(oauthConfig, publishParams);
  if (result.ok) {
    throw new Error("Synthetic failed publish unexpectedly succeeded.");
  }
  return result.error;
}

async function executePublishScenario(input: {
  result?: Awaited<ReturnType<typeof publishLinkedInTextPost>>;
  throws?: boolean;
  rollbackSucceeds?: boolean;
}) {
  let campaignState = "publishing";
  let publishCalls = 0;
  let rollbackCalls = 0;
  let reconnectCalls = 0;
  const outcome = await executeLinkedInPublishWithRollback({
    publish: async () => {
      publishCalls += 1;
      if (input.throws) {
        throw new Error("synthetic provider exception");
      }
      return input.result ?? { ok: false, error: "publish_failed" };
    },
    rollback: async () => {
      rollbackCalls += 1;
      if (input.rollbackSucceeds === false) {
        return false;
      }
      campaignState = "approved";
      return true;
    },
    markReconnectRequired: async () => {
      reconnectCalls += 1;
    },
  });

  return { campaignState, outcome, publishCalls, rollbackCalls, reconnectCalls };
}

async function main() {
  try {
    assert.equal(await publishWithStatus(401), "unauthorized");
    assert.equal(await publishWithStatus(403), "access_denied");
    assert.equal(await publishWithStatus(429), "publish_failed");
    assert.equal(await publishWithStatus(500), "publish_failed");
    globalThis.fetch = async () => {
      throw new Error("synthetic network failure");
    };
    await assert.rejects(() => publishLinkedInTextPost(oauthConfig, publishParams));

    const network = await executePublishScenario({ throws: true });
    assert.equal(network.campaignState, "approved");
    assert.equal(network.publishCalls, 1);
    assert.equal(network.rollbackCalls, 1);
    assert.equal(network.reconnectCalls, 0);
    assert.equal(network.outcome.ok, false);

    const unauthorized = await executePublishScenario({ result: { ok: false, error: "unauthorized" } });
    assert.equal(unauthorized.campaignState, "approved");
    assert.equal(unauthorized.rollbackCalls, 1);
    assert.equal(unauthorized.reconnectCalls, 1);

    for (const error of ["access_denied", "publish_failed"] as const) {
      const transient = await executePublishScenario({ result: { ok: false, error } });
      assert.equal(transient.campaignState, "approved");
      assert.equal(transient.rollbackCalls, 1);
      assert.equal(transient.reconnectCalls, 0);
    }

    const success = await executePublishScenario({ result: { ok: true, postId: "synthetic-post" } });
    assert.equal(success.campaignState, "publishing");
    assert.equal(success.rollbackCalls, 0);
    assert.equal(success.publishCalls, 1);

    const rollbackFailure = await executePublishScenario({ throws: true, rollbackSucceeds: false });
    assert.equal(rollbackFailure.campaignState, "publishing");
    assert.equal(rollbackFailure.rollbackCalls, 1);
    assert.equal(rollbackFailure.publishCalls, 1);
    assert.equal(rollbackFailure.reconnectCalls, 0);
    assert.equal(rollbackFailure.outcome.ok, false);

    let invalidatedCredential = connectedCredential("workspace-a");
    const invalidatedAfter401 = await executeLinkedInPublishWithRollback({
      publish: async () => ({ ok: false, error: "unauthorized" }),
      rollback: async () => true,
      markReconnectRequired: async () => {
        invalidatedCredential = invalidatePersistedCredential(invalidatedCredential);
      },
    });
    assert.equal(invalidatedAfter401.ok, false);
    assert.equal(canCallProviderFromFreshCredentialLoad(invalidatedCredential), false);

    let invalidatedBeforePresentationFailure = connectedCredential("workspace-a");
    await assert.rejects(() => executeLinkedInPublishWithRollback({
      publish: async () => ({ ok: false, error: "unauthorized" }),
      rollback: async () => true,
      markReconnectRequired: async () => {
        invalidatedBeforePresentationFailure = invalidatePersistedCredential(
          invalidatedBeforePresentationFailure,
        );
        throw new Error("synthetic presentation failure after invalidation");
      },
    }));
    assert.equal(
      canCallProviderFromFreshCredentialLoad(invalidatedBeforePresentationFailure),
      false,
    );

    let invalidationWrites = 0;
    let providerCallsAfterInvalidationFailure = 0;
    await assert.rejects(() => executeLinkedInPublishWithRollback({
      publish: async () => {
        providerCallsAfterInvalidationFailure += 1;
        return { ok: false, error: "unauthorized" };
      },
      rollback: async () => true,
      markReconnectRequired: async () => {
        invalidationWrites += 1;
        throw new Error("synthetic invalidation write failure");
      },
    }));
    assert.equal(invalidationWrites, 1);
    assert.equal(providerCallsAfterInvalidationFailure, 1);

    const reconnectedCredential: PersistedCredential = {
      ...connectedCredential("workspace-a"),
      access_token_ciphertext: "replacement-ciphertext",
      access_token_iv: "replacement-iv",
      access_token_auth_tag: "replacement-auth-tag",
      access_token_key_version: "replacement-key-v1",
    };
    assert.equal(canCallProviderFromFreshCredentialLoad(reconnectedCredential), true);

    const ordinaryStatusChange = {
      ...invalidatedCredential,
      status: "connected" as const,
    };
    assert.equal(canCallProviderFromFreshCredentialLoad(ordinaryStatusChange), false);

    const workspaceRows = new Map<string, PersistedCredential>([
      ["workspace-a", connectedCredential("workspace-a")],
      ["workspace-b", connectedCredential("workspace-b")],
    ]);
    const disconnectWorkspace = (workspaceId: string) => {
      const row = workspaceRows.get(workspaceId);
      if (!row) return;
      workspaceRows.set(workspaceId, {
        ...row,
        status: "disconnected",
        ...disconnectPatch,
      });
    };
    disconnectWorkspace("workspace-a");
    disconnectWorkspace("workspace-a");
    assert.equal(canCallProviderFromFreshCredentialLoad(workspaceRows.get("workspace-a")!), false);
    assert.equal(canCallProviderFromFreshCredentialLoad(workspaceRows.get("workspace-b")!), true);
    assert.deepEqual(workspaceRows.get("workspace-a"), {
      workspaceId: "workspace-a",
      status: "disconnected",
      ...disconnectPatch,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  const [storeSource, publishSource, apiSource, disconnectRouteSource, uiSource] = await Promise.all([
    readFile("lib/marketing-ai/linkedin/linkedinConnectionStore.ts", "utf8"),
    readFile("app/api/admin/marketing-studio/linkedin/publish-post/route.ts", "utf8"),
    readFile("lib/marketing-ai/linkedin/linkedinApi.ts", "utf8"),
    readFile("app/api/admin/marketing-studio/linkedin/disconnect/route.ts", "utf8"),
    readFile("app/(default)/dashboard/admin/marketing-studio/page.tsx", "utf8"),
  ]);

  assert(storeSource.includes('status: "reconnect_required"'));
  assert(storeSource.includes('.eq("workspace_id", scopedWorkspaceId)'));
  assert(storeSource.includes('onConflict: "provider,workspace_id"'));
  assert(/connected:\s*status === "connected"/.test(storeSource));
  assert(publishSource.includes("executeLinkedInPublishWithRollback"));
  assert(apiSource.includes('publishResult.error === "unauthorized"'));
  assert(!apiSource.includes('publishResult.error === "access_denied"'));
  assert(disconnectRouteSource.indexOf("const auth = await getRequestUserAndWorkspace") < disconnectRouteSource.indexOf("await disconnectLinkedInConnection"));
  assert(disconnectRouteSource.includes('status: "disconnected"'));
  assert(!disconnectRouteSource.includes("access_token_ciphertext"));
  assert(uiSource.includes("Déconnecter LinkedIn"));
  assert(uiSource.includes("Reconnecter LinkedIn"));
  assert(uiSource.includes("window.confirm(\"Déconnecter LinkedIn localement ?"));

  console.log("PASS — LinkedIn connection lifecycle focused tests");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
