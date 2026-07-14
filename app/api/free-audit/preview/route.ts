import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

import {
  buildFreeAuditPricingPreview,
} from "@/lib/freeAudit/publicPricingPreview";
import type { FreeAuditMarketOverviewInput } from "@/lib/freeAudit/publicPricingPreviewContract";
import {
  checkInMemoryRateLimit,
  type InMemoryRateLimitResult,
} from "@/lib/http/inMemoryRateLimit";

export const runtime = "nodejs";

const ENABLE_FREE_AUDIT_PREVIEW = "ENABLE_FREE_AUDIT_PREVIEW";
const FREE_AUDIT_RATE_LIMIT = 5;
const FREE_AUDIT_RATE_WINDOW_MS = 15 * 60 * 1000;
const FREE_AUDIT_RATE_SCOPE = "free-audit-preview:";
const MAX_BODY_BYTES = 8 * 1024;
const INVALID_REQUEST_MESSAGE = "La demande d'apercu est invalide.";
const UNAVAILABLE_MESSAGE = "L'apercu gratuit est temporairement indisponible.";
const RATE_LIMITED_MESSAGE =
  "Trop de demandes ont ete effectuees. Veuillez reessayer plus tard.";
const ALLOWED_KEYS = [
  "country",
  "city",
  "platform",
  "propertyType",
] as const;
const PLATFORM_VALUES = new Set(["airbnb", "booking", "expedia", "agoda", "vrbo"]);
const PROPERTY_TYPE_VALUES = new Set([
  "studio",
  "apartment",
  "villa",
  "riad",
  "room",
  "hotel",
] as const satisfies readonly FreeAuditMarketOverviewInput["propertyType"][]);
const MAX_COUNTRY_LENGTH = 100;
const MAX_CITY_LENGTH = 120;

type FreeAuditPreviewRouteDependencies = Readonly<{
  buildPreview?: typeof buildFreeAuditPricingPreview;
  checkRateLimit?: typeof checkInMemoryRateLimit;
  env?: FreeAuditPreviewRouteEnv;
}>;

type FreeAuditPreviewRouteEnv = Readonly<Record<string, string | undefined>>;

type InvalidRequestBody = Readonly<{
  status: "invalid_request";
  message: string;
}>;

type UnavailableBody = Readonly<{
  status: "unavailable";
  message: string;
}>;

type RateLimitedBody = Readonly<{
  status: "rate_limited";
  message: string;
}>;

function buildBaseHeaders(): HeadersInit {
  return {
    "Cache-Control": "no-store, max-age=0",
    Pragma: "no-cache",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  };
}

function jsonResponse<T>(
  body: T,
  status: number,
  extraHeaders?: HeadersInit,
): NextResponse<T> {
  return NextResponse.json(body, {
    status,
    headers: {
      ...buildBaseHeaders(),
      ...(extraHeaders ?? {}),
    },
  });
}

function buildInvalidRequestResponse(status = 400): NextResponse<InvalidRequestBody> {
  return jsonResponse(
    Object.freeze({
      status: "invalid_request",
      message: INVALID_REQUEST_MESSAGE,
    }),
    status,
  );
}

function buildUnavailableResponse(): NextResponse<UnavailableBody> {
  return jsonResponse(
    Object.freeze({
      status: "unavailable",
      message: UNAVAILABLE_MESSAGE,
    }),
    503,
  );
}

function buildRateLimitedResponse(
  result: InMemoryRateLimitResult,
): NextResponse<RateLimitedBody> {
  return jsonResponse(
    Object.freeze({
      status: "rate_limited",
      message: RATE_LIMITED_MESSAGE,
    }),
    429,
    {
      "Retry-After": String(result.retryAfterSeconds),
    },
  );
}

function isEnabled(env: FreeAuditPreviewRouteEnv): boolean {
  return env[ENABLE_FREE_AUDIT_PREVIEW]?.trim() === "true";
}

function readClientIdentifier(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (typeof forwardedFor === "string") {
    const firstValue = forwardedFor
      .split(",")[0]
      ?.trim()
      .slice(0, 256);
    if (firstValue) {
      return firstValue;
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim().slice(0, 256);
  if (realIp) {
    return realIp;
  }

  const cfConnectingIp = request.headers
    .get("cf-connecting-ip")
    ?.trim()
    .slice(0, 256);
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  return "unknown-client";
}

function buildRateLimitKey(request: Request): string {
  const clientIdentifier = readClientIdentifier(request);
  if (clientIdentifier === "unknown-client") {
    return `${FREE_AUDIT_RATE_SCOPE}unknown-client`;
  }

  const fingerprint = createHash("sha256")
    .update(clientIdentifier)
    .digest("hex");
  return `${FREE_AUDIT_RATE_SCOPE}${fingerprint}`;
}

function hasSimpleObjectShape(value: unknown): value is Record<string, unknown> {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeInputBody(
  value: unknown,
): FreeAuditMarketOverviewInput | null {
  if (!hasSimpleObjectShape(value)) {
    return null;
  }

  const keys = Object.keys(value);
  if (keys.length !== ALLOWED_KEYS.length) {
    return null;
  }

  for (const key of keys) {
    if (!ALLOWED_KEYS.includes(key as (typeof ALLOWED_KEYS)[number])) {
      return null;
    }
  }

  const country = typeof value.country === "string" ? value.country.trim() : "";
  if (country.length === 0 || country.length > MAX_COUNTRY_LENGTH) {
    return null;
  }

  const city = typeof value.city === "string" ? value.city.trim() : "";
  if (city.length === 0 || city.length > MAX_CITY_LENGTH) {
    return null;
  }

  const platform =
    typeof value.platform === "string" ? value.platform.trim().toLowerCase() : "";
  if (!PLATFORM_VALUES.has(platform)) {
    return null;
  }

  const propertyType =
    typeof value.propertyType === "string"
      ? value.propertyType.trim().toLowerCase()
      : "";
  if (!PROPERTY_TYPE_VALUES.has(propertyType as FreeAuditMarketOverviewInput["propertyType"])) {
    return null;
  }

  return Object.freeze({
    country,
    city,
    platform: platform as FreeAuditMarketOverviewInput["platform"],
    propertyType: propertyType as FreeAuditMarketOverviewInput["propertyType"],
  });
}

async function readJsonBody(request: Request): Promise<
  | { ok: true; value: unknown }
  | { ok: false; reason: "invalid_json" | "payload_too_large" }
> {
  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader != null) {
    const parsedLength = Number.parseInt(contentLengthHeader, 10);
    if (Number.isFinite(parsedLength) && parsedLength > MAX_BODY_BYTES) {
      return { ok: false, reason: "payload_too_large" };
    }
  }

  let rawBody = "";
  try {
    rawBody = await request.text();
  } catch {
    return { ok: false, reason: "invalid_json" };
  }

  if (rawBody.trim().length === 0) {
    return { ok: false, reason: "invalid_json" };
  }

  if (new TextEncoder().encode(rawBody).length > MAX_BODY_BYTES) {
    return { ok: false, reason: "payload_too_large" };
  }

  try {
    return {
      ok: true,
      value: JSON.parse(rawBody) as unknown,
    };
  } catch {
    return { ok: false, reason: "invalid_json" };
  }
}

export async function handleFreeAuditPreviewRequest(
  request: Request,
  dependencies: FreeAuditPreviewRouteDependencies = {},
): Promise<Response> {
  if (request.method !== "POST") {
    return buildInvalidRequestResponse(405);
  }

  const env = dependencies.env ?? process.env;
  if (!isEnabled(env)) {
    return buildUnavailableResponse();
  }

  const checkRateLimit = dependencies.checkRateLimit ?? checkInMemoryRateLimit;
  const rateLimitResult = checkRateLimit({
    key: buildRateLimitKey(request),
    limit: FREE_AUDIT_RATE_LIMIT,
    windowMs: FREE_AUDIT_RATE_WINDOW_MS,
  });
  if (!rateLimitResult.allowed) {
    return buildRateLimitedResponse(rateLimitResult);
  }

  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) {
    if (parsedBody.reason === "payload_too_large") {
      return buildInvalidRequestResponse(413);
    }
    return buildInvalidRequestResponse();
  }

  const normalizedInput = normalizeInputBody(parsedBody.value);
  if (normalizedInput == null) {
    return buildInvalidRequestResponse();
  }

  const buildPreview = dependencies.buildPreview ?? buildFreeAuditPricingPreview;

  try {
    const result = await buildPreview(normalizedInput);

    if (result.status === "available" || result.status === "insufficient_coverage") {
      return jsonResponse(result, 200);
    }

    return jsonResponse(result, 503);
  } catch {
    console.error("[FREE_AUDIT_PREVIEW_UNEXPECTED_ERROR]");
    return buildUnavailableResponse();
  }
}

export async function POST(request: Request): Promise<Response> {
  return handleFreeAuditPreviewRequest(request);
}
