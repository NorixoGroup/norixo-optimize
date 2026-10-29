import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  createAdminSessionValue,
  createMarketingStudioOAuthState,
  parseAdminSessionValue,
  parseMarketingStudioOAuthState,
  resolveMarketingStudioAdminAccess,
  verifyAdminSessionCookie,
} from "../lib/auth/adminAccess";
import {
  createLinkedInOAuthState,
  parseLinkedInOAuthState,
} from "../lib/marketing-ai/linkedin/linkedinOAuth";

process.env.ADMIN_EMAILS = "admin@example.test";

const secret = "test-admin-session-secret-with-at-least-32-characters";
const now = 1_700_000_000_000;
const admin = { id: "admin-user", email: "admin@example.test", email_confirmed_at: "2026-01-01T00:00:00Z" };
const token = "supabase-access-token";

const session = createAdminSessionValue(admin, token, secret, now);
assert.ok(session, "Expected an authorized admin session.");
assert.equal(parseAdminSessionValue(session, secret, now)?.userId, admin.id);
assert.equal(parseAdminSessionValue(`${session}tampered`, secret, now), null);
assert.equal(parseAdminSessionValue(session, secret, now + 10 * 60 * 1000 + 1), null);
assert.equal(createAdminSessionValue({ id: "member", email: "member@example.test", email_confirmed_at: "x" }, token, secret, now), null);
assert.equal(
  createAdminSessionValue({ id: "admin-user", email: admin.email }, token, secret, now),
  null,
  "Unconfirmed admin e-mail must not get a session.",
);
assert.equal(createAdminSessionValue(admin, "", secret, now), null);
assert.equal(parseAdminSessionValue(session, "another-secret-with-at-least-32-characters!!", now), null);

const metaState = createMarketingStudioOAuthState(
  { provider: "meta", userId: admin.id, email: admin.email },
  secret,
  now,
);
assert.ok(metaState, "Expected signed Meta OAuth state.");
assert.equal(parseMarketingStudioOAuthState(metaState, "meta", secret, now)?.userId, admin.id);
assert.equal(parseMarketingStudioOAuthState(metaState, "tiktok", secret, now), null);
assert.equal(parseMarketingStudioOAuthState(`${metaState}x`, "meta", secret, now), null);
assert.equal(parseMarketingStudioOAuthState(metaState, "meta", secret, now + 10 * 60 * 1000 + 1), null);

const linkedInState = createLinkedInOAuthState(
  { userId: admin.id, workspaceId: "workspace-a", email: admin.email },
  secret,
  now,
);
assert.equal(parseLinkedInOAuthState(linkedInState, secret, now)?.email, admin.email);
assert.equal(parseLinkedInOAuthState(`${linkedInState}x`, secret, now), null);
assert.equal(parseLinkedInOAuthState(linkedInState, secret, now + 10 * 60 * 1000 + 1), null);

const ordinaryAccess = resolveMarketingStudioAdminAccess({
  status: "ok",
  client: {} as never,
  user: { id: "member", email: "member@example.test", email_confirmed_at: "x" } as never,
  workspace: { id: "workspace-a" } as never,
});
assert.equal(ordinaryAccess.ok, false);
if (!ordinaryAccess.ok) assert.equal(ordinaryAccess.response.status, 403);

const unauthenticatedAccess = resolveMarketingStudioAdminAccess({
  status: "unauthenticated",
  client: null,
  user: null,
  workspace: null,
});
assert.equal(unauthenticatedAccess.ok, false);
if (!unauthenticatedAccess.ok) assert.equal(unauthenticatedAccess.response.status, 401);

const unconfirmedAdminAccess = resolveMarketingStudioAdminAccess({
  status: "ok",
  client: {} as never,
  user: { id: admin.id, email: admin.email } as never,
  workspace: { id: "workspace-a" } as never,
});
assert.equal(unconfirmedAdminAccess.ok, false, "Unconfirmed admin e-mail must be refused.");
if (!unconfirmedAdminAccess.ok) assert.equal(unconfirmedAdminAccess.response.status, 403);

const authorizedAccess = resolveMarketingStudioAdminAccess({
  status: "ok",
  client: {} as never,
  user: admin as never,
  workspace: { id: "workspace-a" } as never,
});
assert.equal(authorizedAccess.ok, true);

async function verifySessions() {
  const valid = async () => admin as never;
  const ok = await verifyAdminSessionCookie(session!, secret, valid, now);
  assert.equal(ok?.userId, admin.id, "Valid admin session must be accepted.");

  // Absent / forged / expired cookies never reach the Supabase verifier.
  let called = 0;
  const counting = async () => { called += 1; return admin as never; };
  assert.equal(await verifyAdminSessionCookie("", secret, counting, now), null);
  assert.equal(await verifyAdminSessionCookie(`${session}x`, secret, counting, now), null);
  assert.equal(await verifyAdminSessionCookie("a.b.c", secret, counting, now), null);
  assert.equal(await verifyAdminSessionCookie(session!, secret, counting, now + 10 * 60 * 1000 + 1), null);
  assert.equal(await verifyAdminSessionCookie(session!, null, counting, now), null, "Missing secret fails closed.");
  assert.equal(called, 0);

  // Signed-out / revoked / expired Supabase session: verifier returns no user or throws.
  assert.equal(await verifyAdminSessionCookie(session!, secret, async () => null, now), null);
  assert.equal(await verifyAdminSessionCookie(session!, secret, async () => { throw new Error("session_not_found"); }, now), null);

  // Cookie must match the Supabase identity and still be an allow-listed, confirmed admin.
  assert.equal(await verifyAdminSessionCookie(session!, secret, async () => ({ ...admin, id: "other" }) as never, now), null);
  assert.equal(await verifyAdminSessionCookie(session!, secret, async () => ({ ...admin, email_confirmed_at: null }) as never, now), null);
  assert.equal(await verifyAdminSessionCookie(session!, secret, async () => ({ ...admin, email: "member@example.test" }) as never, now), null);
  process.env.ADMIN_EMAILS = "someone-else@example.test";
  assert.equal(await verifyAdminSessionCookie(session!, secret, valid, now), null, "Removed admin loses access.");
  process.env.ADMIN_EMAILS = "admin@example.test";
}

async function main() {
  await verifySessions();

  const requiredSources = [
    "app/(default)/dashboard/admin/layout.tsx",
    "app/api/admin/marketing-studio/save/route.ts",
    "app/api/admin/marketing-studio/duplicate/route.ts",
    "app/api/admin/marketing-studio/delete/route.ts",
  ];
  for (const source of requiredSources) {
    const contents = await readFile(source, "utf8");
    assert.match(contents, /requireAdminPage|requireMarketingStudioAdmin/);
  }

  const protectedRoutes = [
    "approve/route.ts",
    "campaigns/[id]/route.ts",
    "debug/ffmpeg/route.ts",
    "debug/media-config/route.ts",
    "linkedin/disconnect/route.ts",
    "linkedin/login/route.ts",
    "linkedin/publish-post/route.ts",
    "linkedin/status/route.ts",
    "meta/login/route.ts",
    "meta/publish-facebook/route.ts",
    "meta/status/route.ts",
    "regenerate/route.ts",
    "run/route.ts",
    "runs/[id]/route.ts",
    "tiktok/login/route.ts",
    "tiktok/status/route.ts",
    "tiktok/upload-video/route.ts",
  ];
  for (const route of protectedRoutes) {
    const contents = await readFile(`app/api/admin/marketing-studio/${route}`, "utf8");
    assert.match(contents, /isAdminPrivateUser/, `${route} must retain its server admin gate`);
  }

  for (const route of ["meta/callback/route.ts", "tiktok/callback/route.ts"]) {
    const contents = await readFile(`app/api/admin/marketing-studio/${route}`, "utf8");
    assert.match(contents, /parseMarketingStudioOAuthState/, `${route} must validate signed OAuth state`);
  }
  for (const [provider, exchange] of [
    ["meta", "exchangeMetaCodeForUserAccessToken("],
    ["tiktok", "exchangeTikTokCodeForTokens("],
    ["linkedin", "exchangeLinkedInCodeForAccessToken("],
  ]) {
    const callback = await readFile(`app/api/admin/marketing-studio/${provider}/callback/route.ts`, "utf8");
    const guardAt = callback.indexOf("isOAuthCallbackAdminAuthorized(");
    assert.ok(guardAt > 0, `${provider} callback must re-verify the admin session.`);
    assert.ok(guardAt < callback.indexOf(exchange), `${provider} callback guard must run before the provider code exchange.`);
  }

  const sessionRoute = await readFile("app/api/admin/session/route.ts", "utf8");
  assert.match(sessionRoute, /isAdminPrivateUser/);
  assert.match(sessionRoute, /getUser\(accessToken\)/);
  const adminAccess = await readFile("lib/auth/adminAccess.ts", "utf8");
  assert.match(adminAccess, /verifyAdminSessionCookie\(/);
  assert.match(adminAccess, /fetchSupabaseUserByAccessToken/);

  const linkedInCallback = await readFile(
    "app/api/admin/marketing-studio/linkedin/callback/route.ts",
    "utf8",
  );
  assert.match(linkedInCallback, /parseLinkedInOAuthState/);
  assert.match(linkedInCallback, /isAdminPrivateEmail/);

  console.log("Marketing Studio admin security: passed");
}

void main();
