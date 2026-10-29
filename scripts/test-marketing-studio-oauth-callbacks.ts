import assert from "node:assert/strict";
import { NextRequest } from "next/server";

// Local-only test: every outbound fetch is stubbed, nothing leaves the process.
// Values below are throwaway test fixtures, not real credentials.
const E = process.env as Record<string, string | undefined>;
E.NODE_ENV = "production";
// This test exercises the "legitimate admin, real Production" path, so the
// Marketing Studio provider-production gate (VERCEL_ENV === "production")
// must also be satisfied here, independently of NODE_ENV.
E.VERCEL_ENV = "production";
E.NEXT_PUBLIC_SUPABASE_URL = "http://supabase.test";
E.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
E.ADMIN_EMAILS = "admin@example.test";
E.NORIXO_ADMIN_SESSION_SECRET = "test-admin-session-secret-with-at-least-32-characters";
E.META_APP_ID = "test-meta-id";
E.META_APP_SECRET = "test-meta-secret";
E.META_LOGIN_CONFIG_ID = "test-config-id";
E.META_GRAPH_API_VERSION = "v21.0";
E.META_REDIRECT_URI = "http://app.test/api/admin/marketing-studio/meta/callback";
E.TIKTOK_CLIENT_KEY = "test-tiktok-key";
E.TIKTOK_CLIENT_SECRET = "test-tiktok-secret";
E.TIKTOK_REDIRECT_URI = "http://app.test/api/admin/marketing-studio/tiktok/callback";
E.LINKEDIN_CLIENT_ID = "test-linkedin-id";
E.LINKEDIN_CLIENT_SECRET = "test-linkedin-secret-0123456789abcdef";
E.LINKEDIN_API_VERSION = "202401";
E.LINKEDIN_ORGANIZATION_URN = "urn:li:organization:123";
E.LINKEDIN_REDIRECT_URI = "http://app.test/api/admin/marketing-studio/linkedin/callback";

const adminSecret = E.NORIXO_ADMIN_SESSION_SECRET as string;
const ADMIN = {
  id: "admin-user",
  email: "admin@example.test",
  email_confirmed_at: "2026-01-01T00:00:00Z",
};

const supabaseUsers: Record<string, Record<string, unknown> | "revoked"> = {
  "live-admin-token": ADMIN,
  "revoked-admin-token": "revoked",
  "member-token": { id: "member", email: "member@example.test", email_confirmed_at: "2026-01-01T00:00:00Z" },
  "unconfirmed-admin-token": { id: "admin-user", email: "admin@example.test", email_confirmed_at: null },
};

type Call = { url: string; authorized: boolean };
let calls: Call[] = [];

globalThis.fetch = (async (input: unknown, init?: { headers?: unknown }) => {
  const url = typeof input === "string" ? input : (input as { url?: string }).url ?? String(input);
  const headers = new Headers(init?.headers as HeadersInit | undefined);
  const token = headers.get("authorization")?.replace(/^bearer\s+/i, "") ?? "";
  const isAuthCheck = url.startsWith("http://supabase.test/auth/v1/user");
  calls.push({ url, authorized: isAuthCheck });

  if (isAuthCheck) {
    const entry = supabaseUsers[token];
    if (entry === "revoked") {
      return new Response(JSON.stringify({ code: 403, error_code: "session_not_found", msg: "Session from session_id claim in JWT does not exist" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
    }
    if (!entry) {
      return new Response(JSON.stringify({ code: 401, msg: "invalid JWT" }), { status: 401, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ aud: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z", ...entry }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  // Provider, Supabase persistence or any other call: always a stubbed failure.
  return new Response(JSON.stringify({ error: "stubbed" }), { status: 500, headers: { "content-type": "application/json" } });
}) as typeof fetch;

const providerCalls = () => calls.filter((call) => !call.authorized);

async function main() {
  const access = await import("../lib/auth/adminAccess");
  const meta = await import("../lib/marketing-ai/meta/metaOAuth");
  const tiktok = await import("../lib/marketing-ai/tiktok/tiktokOAuth");
  const linkedin = await import("../lib/marketing-ai/linkedin/linkedinOAuth");
  const session = await import("../app/api/admin/session/route");
  const metaCallback = await import("../app/api/admin/marketing-studio/meta/callback/route");
  const tiktokCallback = await import("../app/api/admin/marketing-studio/tiktok/callback/route");
  const linkedinCallback = await import("../app/api/admin/marketing-studio/linkedin/callback/route");

  // ---- Cookie format: encrypted, tamper-evident, bound to secret -------------
  const token = "live-admin-token";
  const cookie = access.createAdminSessionValue(ADMIN, token, adminSecret)!;
  assert.ok(cookie.startsWith("v1."));
  assert.ok(!cookie.includes(token) && !Buffer.from(cookie.split(".")[2], "base64url").toString().includes(token), "JWT must not be readable in the cookie.");
  assert.equal(access.parseAdminSessionValue(cookie, adminSecret)?.accessToken, token);
  assert.equal(access.parseAdminSessionValue(cookie, "another-secret-with-at-least-32-characters!!"), null);
  const [v, iv, ct, tag] = cookie.split(".");
  const flipped = Buffer.from(ct, "base64url");
  flipped[0] ^= 1;
  assert.equal(access.parseAdminSessionValue([v, iv, flipped.toString("base64url"), tag].join("."), adminSecret), null, "Ciphertext tampering must be rejected.");
  assert.equal(access.parseAdminSessionValue([v, iv, ct, "AAAA"].join("."), adminSecret), null);
  assert.equal(access.parseAdminSessionValue("v1.a.b", adminSecret), null);
  const legacySigned = `${Buffer.from(JSON.stringify({ purpose: "norixo_admin_session", userId: "admin-user", email: ADMIN.email, accessToken: token, expiresAt: Date.now() + 1e6 })).toString("base64url")}.sig`;
  assert.equal(access.parseAdminSessionValue(legacySigned, adminSecret), null, "Old signed-only format is rejected (users simply re-login).");
  assert.equal(access.parseAdminSessionValue(cookie, adminSecret, Date.now() + 10 * 60 * 1000 + 1), null, "Expired cookie rejected.");

  // ---- POST /api/admin/session: real handlers, stubbed Supabase ---------------
  const postSession = (authorization?: string) =>
    session.POST(new NextRequest("http://app.test/api/admin/session", { method: "POST", headers: authorization ? { authorization } : {} }));

  calls = [];
  assert.equal((await postSession()).status, 401, "No bearer token => 401.");
  assert.equal(calls.length, 0, "No Supabase call without a token.");
  assert.equal((await postSession("Bearer revoked-admin-token")).status, 401, "Revoked session => 401.");
  assert.equal((await postSession("Bearer garbage")).status, 401);
  assert.equal((await postSession("Bearer member-token")).status, 403, "Non-admin => 403.");
  assert.equal((await postSession("Bearer unconfirmed-admin-token")).status, 403, "Unconfirmed admin e-mail => 403.");

  const ok = await postSession("Bearer live-admin-token");
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("cache-control"), "no-store");
  assert.ok(!(await ok.clone().text()).includes("live-admin-token"), "Token never echoed in the response body.");
  const setCookie = ok.headers.get("set-cookie") ?? "";
  assert.match(setCookie, /norixo_admin_session=v1\./);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=lax/i);
  assert.match(setCookie, /Path=\//);
  assert.match(setCookie, /Max-Age=600/);
  assert.match(setCookie, /Secure/i);
  assert.ok(!setCookie.includes("live-admin-token"));
  const del = await session.DELETE();
  assert.match(del.headers.get("set-cookie") ?? "", /norixo_admin_session=;/);

  // ---- OAuth callbacks -------------------------------------------------------
  const live = access.createAdminSessionValue(ADMIN, "live-admin-token", adminSecret)!;
  const revoked = access.createAdminSessionValue(ADMIN, "revoked-admin-token", adminSecret)!;
  const otherUser = access.createAdminSessionValue({ ...ADMIN, id: "someone-else" }, "live-admin-token", adminSecret)!;
  const expired = access.createAdminSessionValue(ADMIN, "live-admin-token", adminSecret, Date.now() - 11 * 60 * 1000)!;

  const metaState = access.createMarketingStudioOAuthState({ provider: "meta", userId: ADMIN.id, email: ADMIN.email }, adminSecret)!;
  const tiktokState = access.createMarketingStudioOAuthState({ provider: "tiktok", userId: ADMIN.id, email: ADMIN.email }, adminSecret)!;
  const linkedinState = linkedin.createLinkedInOAuthState({ userId: ADMIN.id, workspaceId: "ws-1", email: ADMIN.email }, E.LINKEDIN_CLIENT_SECRET as string);

  const providers = [
    { name: "meta", handler: metaCallback.GET, state: metaState, cookies: (s: string) => `${meta.META_OAUTH_STATE_COOKIE_NAME}=${s}; ${meta.META_OAUTH_FLOW_COOKIE_NAME}=${meta.META_OAUTH_FLOW_COOKIE_VALUE}` },
    { name: "tiktok", handler: tiktokCallback.GET, state: tiktokState, cookies: (s: string) => `${tiktok.TIKTOK_OAUTH_STATE_COOKIE_NAME}=${s}; ${tiktok.TIKTOK_OAUTH_FLOW_COOKIE_NAME}=${tiktok.TIKTOK_OAUTH_FLOW_COOKIE_VALUE}` },
    { name: "linkedin", handler: linkedinCallback.GET, state: linkedinState, cookies: (s: string) => `${linkedin.LINKEDIN_OAUTH_STATE_COOKIE_NAME}=${s}; ${linkedin.LINKEDIN_OAUTH_FLOW_COOKIE_NAME}=${linkedin.LINKEDIN_OAUTH_FLOW_COOKIE_VALUE}` },
  ];

  for (const p of providers) {
    const run = async (adminCookie: string | null) => {
      calls = [];
      const cookieHeader = [p.cookies(p.state), adminCookie ? `norixo_admin_session=${adminCookie}` : ""].filter(Boolean).join("; ");
      const request = new NextRequest(
        `http://app.test/api/admin/marketing-studio/${p.name}/callback?code=test-code&state=${encodeURIComponent(p.state)}`,
        { headers: { cookie: cookieHeader } },
      );
      let status: number | "threw" = "threw";
      try {
        const response = await p.handler(request);
        status = response.status;
        if (status !== 401 && process.env.DEBUG_CALLBACK_TEST) console.error(p.name, status, await response.clone().text());
      } catch {
        // A stubbed provider/persistence failure after the guard is acceptable here.
      }
      return status;
    };

    // Refused: no provider exchange, no persistence call (zero non-auth fetches).
    for (const [label, cookieValue] of [
      ["missing admin cookie", null],
      ["forged admin cookie", `${live}x`],
      ["expired admin cookie", expired],
      ["revoked Supabase session", revoked],
      ["cookie bound to another user", otherUser],
    ] as const) {
      const status = await run(cookieValue);
      assert.equal(status, 401, `${p.name}: ${label} must be refused with 401 (got ${status}).`);
      assert.equal(providerCalls().length, 0, `${p.name}: ${label} must not reach provider or persistence.`);
    }

    // Legitimate flow: guard passes, the (stubbed) provider exchange is attempted.
    const status = await run(live);
    assert.notEqual(status, 401, `${p.name}: legitimate admin callback must pass the guard.`);
    assert.ok(providerCalls().length > 0, `${p.name}: legitimate flow must reach the provider exchange.`);
    assert.ok(calls.some((call) => call.authorized), `${p.name}: Supabase session must be re-verified server-side.`);
  }

  console.log("Marketing Studio OAuth callback security: passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
