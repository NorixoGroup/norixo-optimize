import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { createClient, type User } from "@supabase/supabase-js";
import { isAdminPrivateEmail, isAdminPrivateUser } from "./isAdminEmail";
import {
  getRequestUserAndWorkspace,
  type RequestUserAndWorkspaceResult,
} from "../server/routeAuth";

export const ADMIN_SESSION_COOKIE_NAME = "norixo_admin_session";
const ADMIN_SESSION_COOKIE = ADMIN_SESSION_COOKIE_NAME;
const ADMIN_SESSION_COOKIE_VERSION = "v1";
const ADMIN_SESSION_TTL_MS = 10 * 60 * 1000;

type AdminSessionPayload = {
  purpose: "norixo_admin_session";
  userId: string;
  email: string;
  accessToken: string;
  expiresAt: number;
};

type MarketingStudioOAuthPayload = {
  purpose: "marketing_studio_oauth";
  provider: "meta" | "tiktok";
  userId: string;
  email: string;
  expiresAt: number;
  nonce: string;
};

export type MarketingStudioAdminAccess = Extract<
  RequestUserAndWorkspaceResult,
  { status: "ok" }
>;

function getAdminSecuritySecret() {
  const secret = process.env.NORIXO_ADMIN_SESSION_SECRET?.trim() ?? "";
  return secret.length >= 32 ? secret : null;
}

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function encode(payload: object, secret: string) {
  const value = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${value}.${sign(value, secret)}`;
}

function decode(value: string, secret: string): Record<string, unknown> | null {
  const [encoded, signature, ...extra] = value.split(".");
  if (!encoded || !signature || extra.length > 0) return null;

  const expected = sign(encoded, secret);
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (
    expectedBuffer.length !== signatureBuffer.length ||
    !timingSafeEqual(expectedBuffer, signatureBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    return payload && typeof payload === "object" ? payload as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

// The admin session cookie carries a Supabase access token, so it is encrypted
// (AES-256-GCM, key derived from the admin secret with HKDF) instead of only
// signed. This keeps the JWT unreadable and tamper-evident; it does NOT prevent
// replay of a stolen cookie, which stays bounded by the 10 minute TTL and the
// server-side Supabase session check.
function deriveSessionKey(secret: string) {
  return Buffer.from(
    hkdfSync("sha256", secret, "norixo-admin-session-salt", "norixo_admin_session:aes-256-gcm:v1", 32),
  );
}

function encryptSessionPayload(payload: object, secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveSessionKey(secret), iv);
  cipher.setAAD(Buffer.from(ADMIN_SESSION_COOKIE_VERSION));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return [
    ADMIN_SESSION_COOKIE_VERSION,
    iv.toString("base64url"),
    ciphertext.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
  ].join(".");
}

function decryptSessionPayload(value: string, secret: string): Record<string, unknown> | null {
  const [version, iv, ciphertext, tag, ...extra] = value.split(".");
  if (version !== ADMIN_SESSION_COOKIE_VERSION || !iv || !ciphertext || !tag || extra.length > 0) {
    return null;
  }

  try {
    const decipher = createDecipheriv("aes-256-gcm", deriveSessionKey(secret), Buffer.from(iv, "base64url"));
    decipher.setAAD(Buffer.from(ADMIN_SESSION_COOKIE_VERSION));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    const payload = JSON.parse(plaintext);
    return payload && typeof payload === "object" ? payload as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function isValidExpiry(value: unknown, now: number) {
  return typeof value === "number" && Number.isFinite(value) && value > now;
}

export function createAdminSessionValue(
  user: { id: string; email?: string | null; email_confirmed_at?: string | null; confirmed_at?: string | null },
  accessToken: string,
  secret: string,
  now = Date.now(),
) {
  const email = user.email?.trim().toLowerCase() ?? "";
  if (
    !user.id.trim() ||
    !email ||
    !accessToken.trim() ||
    !isAdminPrivateUser(user) ||
    secret.length < 32
  ) {
    return null;
  }

  const payload: AdminSessionPayload = {
    purpose: "norixo_admin_session",
    userId: user.id,
    email,
    accessToken: accessToken.trim(),
    expiresAt: now + ADMIN_SESSION_TTL_MS,
  };
  return encryptSessionPayload(payload, secret);
}

export function parseAdminSessionValue(value: string, secret: string, now = Date.now()) {
  const payload = decryptSessionPayload(value, secret);
  if (
    payload?.purpose !== "norixo_admin_session" ||
    typeof payload.userId !== "string" ||
    !payload.userId.trim() ||
    typeof payload.email !== "string" ||
    typeof payload.accessToken !== "string" ||
    !payload.accessToken.trim() ||
    !isAdminPrivateEmail(payload.email) ||
    !isValidExpiry(payload.expiresAt, now)
  ) {
    return null;
  }

  return {
    userId: payload.userId.trim(),
    email: payload.email.trim().toLowerCase(),
    accessToken: payload.accessToken.trim(),
    expiresAt: payload.expiresAt,
  };
}

export type AdminSessionUserVerifier = (accessToken: string) => Promise<User | null>;

// A signed cookie is never sufficient: the Supabase session it references must
// still be valid server-side (sign-out, expiry and revocation all fail here).
export async function verifyAdminSessionCookie(
  cookieValue: string,
  secret: string | null,
  fetchUser: AdminSessionUserVerifier,
  now = Date.now(),
) {
  if (!secret || !cookieValue) return null;
  const session = parseAdminSessionValue(cookieValue, secret, now);
  if (!session) return null;

  let user: User | null = null;
  try {
    user = await fetchUser(session.accessToken);
  } catch {
    return null;
  }

  if (!user || user.id !== session.userId || !isAdminPrivateUser(user)) {
    return null;
  }
  return { ...session, user };
}

export async function fetchSupabaseUserByAccessToken(accessToken: string): Promise<User | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(accessToken);
  return error ? null : data.user;
}

export function createMarketingStudioOAuthState(
  input: { provider: "meta" | "tiktok"; userId: string; email: string | null | undefined },
  secret: string,
  now = Date.now(),
) {
  const email = input.email?.trim().toLowerCase() ?? "";
  if (!input.userId.trim() || !email || !isAdminPrivateEmail(email) || secret.length < 32) {
    return null;
  }

  const payload: MarketingStudioOAuthPayload = {
    purpose: "marketing_studio_oauth",
    provider: input.provider,
    userId: input.userId,
    email,
    expiresAt: now + ADMIN_SESSION_TTL_MS,
    nonce: crypto.randomUUID(),
  };
  return encode(payload, secret);
}

export function parseMarketingStudioOAuthState(
  value: string,
  provider: "meta" | "tiktok",
  secret: string,
  now = Date.now(),
) {
  const payload = decode(value, secret);
  if (
    payload?.purpose !== "marketing_studio_oauth" ||
    payload.provider !== provider ||
    typeof payload.userId !== "string" ||
    !payload.userId.trim() ||
    typeof payload.email !== "string" ||
    !isAdminPrivateEmail(payload.email) ||
    typeof payload.nonce !== "string" ||
    !payload.nonce.trim() ||
    !isValidExpiry(payload.expiresAt, now)
  ) {
    return null;
  }

  return {
    userId: payload.userId.trim(),
    email: payload.email.trim().toLowerCase(),
    expiresAt: payload.expiresAt,
  };
}

export function resolveMarketingStudioAdminAccess(
  auth: RequestUserAndWorkspaceResult,
) {
  if (auth.status === "unauthenticated") {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 }) };
  }
  if (auth.status === "workspace_forbidden" || !isAdminPrivateUser(auth.user)) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: "Forbidden." }, { status: 403 }) };
  }
  return { ok: true as const, access: auth };
}

export async function requireMarketingStudioAdmin(request: Request) {
  return resolveMarketingStudioAdminAccess(await getRequestUserAndWorkspace(request));
}

export async function requireAdminPage() {
  const secret = getAdminSecuritySecret();
  const cookieStore = await cookies();
  const session = await verifyAdminSessionCookie(
    cookieStore.get(ADMIN_SESSION_COOKIE)?.value ?? "",
    secret,
    fetchSupabaseUserByAccessToken,
  );

  if (!session) {
    redirect("/dashboard");
  }

  return session;
}

type AdminSessionUser = {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
};

export function getBearerAccessToken(request: Request) {
  return request.headers.get("authorization")?.match(/^bearer\s+(.+)$/i)?.[1]?.trim() ?? "";
}

// Sets (or refreshes) the encrypted admin session cookie. Returns false when
// the admin secret is missing or the user is not an allowed, confirmed admin.
export function attachAdminSessionCookie(
  response: NextResponse,
  user: AdminSessionUser,
  accessToken: string,
) {
  const secret = getAdminSecuritySecret();
  const value = secret ? createAdminSessionValue(user, accessToken, secret) : null;
  if (!value) return false;

  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_TTL_MS / 1000,
  });
  return true;
}

export function createAdminSessionResponse(user: AdminSessionUser, accessToken: string) {
  const response = NextResponse.json({ ok: true, isAdminPrivate: true });
  if (!attachAdminSessionCookie(response, user, accessToken)) {
    return NextResponse.json({ ok: false, error: "Admin session configuration unavailable." }, { status: 503 });
  }
  response.headers.set("Cache-Control", "no-store");
  return response;
}

// OAuth callbacks must not trust a signed state alone: the admin who started the
// flow must still hold a live, server-verified Supabase session right now.
export async function isOAuthCallbackAdminAuthorized(
  cookieValue: string | null | undefined,
  actorUserId: string,
  fetchUser: AdminSessionUserVerifier = fetchSupabaseUserByAccessToken,
) {
  const session = await verifyAdminSessionCookie(
    cookieValue ?? "",
    getAdminSecuritySecret(),
    fetchUser,
  );
  return Boolean(session && actorUserId && session.userId === actorUserId);
}

export function clearAdminSessionResponse() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(ADMIN_SESSION_COOKIE);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export function getAdminOAuthStateSecret() {
  return getAdminSecuritySecret();
}
