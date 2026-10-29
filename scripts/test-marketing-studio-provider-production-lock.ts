import assert from "node:assert/strict";

// Local-only test: fetch is fully stubbed, nothing ever leaves this process.
// It returns a deterministic failure response and records how many times it
// was invoked, so non-Production cases can assert exactly zero calls.
// Values below are throwaway test fixtures, not real credentials.
let fetchCallCount = 0;
globalThis.fetch = (async () => {
  fetchCallCount += 1;
  return new Response(JSON.stringify({ error: "stubbed" }), {
    status: 500,
    headers: { "content-type": "application/json" },
  });
}) as typeof fetch;

const E = process.env as Record<string, string | undefined>;
E.META_APP_ID = "test-meta-id";
E.META_APP_SECRET = "test-meta-secret";
E.META_GRAPH_API_VERSION = "v21.0";
E.META_REDIRECT_URI = "http://app.test/api/admin/marketing-studio/meta/callback";
E.LINKEDIN_CLIENT_ID = "test-linkedin-id";
E.LINKEDIN_CLIENT_SECRET = "test-linkedin-secret-0123456789abcdef";
E.LINKEDIN_API_VERSION = "202401";
E.LINKEDIN_ORGANIZATION_URN = "urn:li:organization:123";
E.LINKEDIN_REDIRECT_URI = "http://app.test/api/admin/marketing-studio/linkedin/callback";
E.TIKTOK_CLIENT_KEY = "test-tiktok-key";
E.TIKTOK_CLIENT_SECRET = "test-tiktok-secret";
E.TIKTOK_REDIRECT_URI = "http://app.test/api/admin/marketing-studio/tiktok/callback";

const metaConfig = {
  appId: E.META_APP_ID!,
  appSecret: E.META_APP_SECRET!,
  graphApiVersion: E.META_GRAPH_API_VERSION!,
  redirectUri: E.META_REDIRECT_URI!,
  loginConfigId: "test-config-id",
};
const linkedInConfig = {
  clientId: E.LINKEDIN_CLIENT_ID!,
  clientSecret: E.LINKEDIN_CLIENT_SECRET!,
  apiVersion: E.LINKEDIN_API_VERSION!,
  redirectUri: E.LINKEDIN_REDIRECT_URI!,
  organizationUrn: undefined,
};
const tikTokConfig = {
  clientKey: E.TIKTOK_CLIENT_KEY!,
  clientSecret: E.TIKTOK_CLIENT_SECRET!,
  redirectUri: E.TIKTOK_REDIRECT_URI!,
};

// Environments that must stay closed. "ambiguous" covers a value that looks
// production-like (case variant / trailing content) but is not an exact match
// — NODE_ENV alone would get this wrong on Vercel Preview, VERCEL_ENV must not.
const NON_PRODUCTION_CASES: Array<[string, string | undefined]> = [
  ["Preview", "preview"],
  ["Development", "development"],
  ["Test (CI)", "test"],
  ["absent (local dev / standalone worker host)", undefined],
  ["ambiguous value 'Production'", "Production"],
  ["ambiguous value 'production '", "production "],
  ["ambiguous value 'production-like'", "production-like"],
];

async function withVercelEnv<T>(value: string | undefined, fn: () => Promise<T>): Promise<T> {
  const previous = E.VERCEL_ENV;
  if (value === undefined) {
    delete E.VERCEL_ENV;
  } else {
    E.VERCEL_ENV = value;
  }
  try {
    return await fn();
  } finally {
    if (previous === undefined) {
      delete E.VERCEL_ENV;
    } else {
      E.VERCEL_ENV = previous;
    }
  }
}

async function main() {
  const gate = await import("../lib/marketing-ai/safety/providerProductionGate");
  const metaGraph = await import("../lib/marketing-ai/meta/metaGraph");
  const linkedinApi = await import("../lib/marketing-ai/linkedin/linkedinApi");
  const tiktokApi = await import("../lib/marketing-ai/tiktok/tiktokApi");

  // ---- isVercelProductionEnvironment: unit behavior ------------------------
  const fakeEnv = (value: Partial<Record<string, string>>) =>
    value as unknown as NodeJS.ProcessEnv;
  assert.equal(gate.isVercelProductionEnvironment(fakeEnv({ VERCEL_ENV: "production" })), true);
  assert.equal(gate.isVercelProductionEnvironment(fakeEnv({ VERCEL_ENV: "preview" })), false);
  assert.equal(gate.isVercelProductionEnvironment(fakeEnv({ VERCEL_ENV: "development" })), false);
  assert.equal(gate.isVercelProductionEnvironment(fakeEnv({})), false);
  assert.equal(gate.isVercelProductionEnvironment(fakeEnv({ NODE_ENV: "production" })), false, "NODE_ENV=production alone must never satisfy the gate (Vercel sets it on Preview too).");

  // ---- Negative cases: every gated provider call site must refuse, with ----
  // ---- zero network calls, across Preview/Development/Test/absent/ambiguous.
  for (const [label, vercelEnv] of NON_PRODUCTION_CASES) {
    await withVercelEnv(vercelEnv, async () => {
      fetchCallCount = 0;

      const metaToken = await metaGraph.exchangeMetaCodeForUserAccessToken(metaConfig, "code");
      assert.equal(metaToken.ok, false, `Meta token exchange must refuse outside Production (${label}).`);
      const metaPages = await metaGraph.fetchMetaFacebookPages(metaConfig, "token");
      assert.equal(metaPages.ok, false, `Meta pages fetch must refuse outside Production (${label}).`);
      const metaScopes = await metaGraph.fetchMetaGrantedScopes(metaConfig, "token");
      assert.deepEqual(metaScopes, [], `Meta scopes fetch must return empty outside Production (${label}).`);
      const metaInstagram = await metaGraph.enrichMetaFacebookPagesWithInstagramAccounts(metaConfig, "token", [
        { pageId: "1", pageName: "p", hasLinkedInstagramBusiness: false, pageAccessToken: null },
      ]);
      assert.equal(metaInstagram.ok, false, `Meta Instagram enrichment must refuse outside Production (${label}).`);
      const metaPublish = await metaGraph.publishMetaFacebookTextPost(metaConfig, {
        pageId: "1",
        pageAccessToken: "token",
        message: "hello",
      });
      assert.equal(metaPublish.ok, false, `Meta publish must refuse outside Production (${label}).`);

      const liToken = await linkedinApi.exchangeLinkedInCodeForAccessToken(linkedInConfig, "code");
      assert.equal(liToken.ok, false, `LinkedIn token exchange must refuse outside Production (${label}).`);
      const liOrg = await linkedinApi.resolveLinkedInOrganization(
        { ...linkedInConfig, organizationUrn: undefined },
        "token",
      );
      assert.equal(liOrg.ok, false, `LinkedIn organization lookup must refuse outside Production (${label}).`);
      const liPublish = await linkedinApi.publishLinkedInTextPost(linkedInConfig, {
        accessToken: "token",
        organizationUrn: "urn:li:organization:123",
        message: "hello",
      });
      assert.equal(liPublish.ok, false, `LinkedIn publish must refuse outside Production (${label}).`);

      const ttToken = await tiktokApi.exchangeTikTokCodeForTokens(tikTokConfig, "code");
      assert.equal(ttToken.ok, false, `TikTok token exchange must refuse outside Production (${label}).`);
      const ttRefresh = await tiktokApi.refreshTikTokAccessToken(tikTokConfig, "refresh-token");
      assert.equal(ttRefresh.ok, false, `TikTok token refresh must refuse outside Production (${label}).`);
      const ttInit = await tiktokApi.initializeTikTokInboxUpload({ accessToken: "token", videoSize: 1024 });
      assert.equal(ttInit.ok, false, `TikTok upload init must refuse outside Production (${label}).`);
      await assert.rejects(
        () => tiktokApi.uploadTikTokVideoFile({ uploadUrl: "https://example.test", binary: Buffer.from("x"), mimeType: "video/mp4" }),
        /disabled outside Production/,
        `TikTok file upload must refuse outside Production (${label}).`,
      );
      const ttStatus = await tiktokApi.fetchTikTokUploadStatus({ accessToken: "token", publishId: "p1" });
      assert.equal(ttStatus.ok, false, `TikTok status fetch must refuse outside Production (${label}).`);

      assert.equal(fetchCallCount, 0, `No gated function may reach the network outside Production (${label}).`);
    });
  }

  // ---- Production case: the gate must get out of the way; failures past ---
  // ---- this point must come from the (stubbed) network layer, not the gate.
  await withVercelEnv("production", async () => {
    fetchCallCount = 0;
    const metaToken = await metaGraph.exchangeMetaCodeForUserAccessToken(metaConfig, "code");
    assert.equal(metaToken.ok, false, "Production call must reach the network, not be gate-refused.");
    assert.notEqual((metaToken as { ok: false; error: string }).error, "non_production_environment", "Production must not be refused by the gate.");
    assert.ok(fetchCallCount > 0, "Production call must have attempted the network call.");

    fetchCallCount = 0;
    const liToken = await linkedinApi.exchangeLinkedInCodeForAccessToken(linkedInConfig, "code");
    assert.notEqual((liToken as { ok: false; error: string }).error, "non_production_environment");
    assert.ok(fetchCallCount > 0);

    fetchCallCount = 0;
    const ttToken = await tiktokApi.exchangeTikTokCodeForTokens(tikTokConfig, "code");
    assert.notEqual((ttToken as { ok: false; error: string }).error, "non_production_environment");
    assert.ok(fetchCallCount > 0);
  });

  console.log("Marketing Studio provider production lock: passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
