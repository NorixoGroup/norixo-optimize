import type { BacklinkDiscoveryProviderName } from "./backlink-discovery-types";

/** Identifies the task attempt that owns a provider request, for request budgeting. */
export type BacklinkDiscoveryRequestContext = {
  workspaceId: string;
  runId: string | null;
  taskId: string;
  taskAttempt: number;
};

export type BacklinkDiscoveryProviderSearchInput = {
  query: string;
  queryIndex: number;
  countryCode: string | null;
  languageCode: string | null;
  maxResults: number;
  requestContext?: BacklinkDiscoveryRequestContext;
};

export type BacklinkDiscoveryProviderItem = {
  url: string;
  title: string | null;
  snippet: string | null;
  rank: number;
};

export type BacklinkDiscoveryProviderSearchResult = {
  query: string;
  queryIndex: number;
  countryCode: string | null;
  languageCode: string | null;
  items: readonly BacklinkDiscoveryProviderItem[];
};

export type BacklinkDiscoveryProviderErrorCode =
  | "PROVIDER_CONFIGURATION_ERROR"
  | "PROVIDER_QUOTA_EXCEEDED"
  | "PROVIDER_BUDGET_EXHAUSTED"
  | "PROVIDER_TRANSIENT_ERROR"
  | "PROVIDER_INVALID_RESPONSE";

/** Closed set of root causes distinguishable for PROVIDER_INVALID_RESPONSE. Never free text. */
export type BacklinkDiscoveryInvalidResponseSubcause =
  | "http_status"
  | "json_parse"
  | "schema_invalid";

/**
 * Additive, bounded diagnostic context. Populated only by the provider that threw the
 * error, from already-validated values (never a raw response body or header blob).
 */
export type BacklinkDiscoveryProviderErrorDetails = {
  subcause: BacklinkDiscoveryInvalidResponseSubcause;
  httpStatus: number | null;
  contentType: string | null;
};

export class BacklinkDiscoveryProviderError extends Error {
  readonly code: BacklinkDiscoveryProviderErrorCode;
  readonly retryable: boolean;
  readonly details: BacklinkDiscoveryProviderErrorDetails | null;

  constructor(
    code: BacklinkDiscoveryProviderErrorCode,
    message: string,
    retryable: boolean,
    details?: BacklinkDiscoveryProviderErrorDetails,
  ) {
    super(message);
    this.name = "BacklinkDiscoveryProviderError";
    this.code = code;
    this.retryable = retryable;
    this.details = details ?? null;
  }
}

export type BacklinkDiscoveryProvider = {
  readonly name: BacklinkDiscoveryProviderName;
  search: (
    input: BacklinkDiscoveryProviderSearchInput,
  ) => Promise<BacklinkDiscoveryProviderSearchResult>;
};

export type BacklinkDiscoveryProviderRegistry = Readonly<
  Partial<Record<BacklinkDiscoveryProviderName, BacklinkDiscoveryProvider>>
>;

const INVALID_RESPONSE_SUBCAUSES: ReadonlySet<BacklinkDiscoveryInvalidResponseSubcause> = new Set([
  "http_status",
  "json_parse",
  "schema_invalid",
]);

/** Closed allow-list: only MIME base types we expect from a search provider or a generic error page. */
const ALLOWED_CONTENT_TYPES: ReadonlySet<string> = new Set([
  "application/json",
  "text/html",
  "text/plain",
  "application/xml",
  "text/xml",
]);

/** Strips parameters (e.g. "; charset=utf-8"), lowercases, and rejects anything outside the allow-list. */
export function normalizeBacklinkDiscoveryContentType(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const base = raw.split(";")[0]?.trim().toLowerCase() ?? "";
  return ALLOWED_CONTENT_TYPES.has(base) ? base : null;
}

export function isValidBacklinkDiscoveryHttpStatus(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599;
}

const DIAGNOSTIC_PATTERN =
  / diag:subcause=(http_status|json_parse|schema_invalid)(?:;status=(\d{3}))?(?:;ctype=([a-z0-9.+-]+\/[a-z0-9.+-]+))?$/;

/** Longest possible valid suffix ("schema_invalid" + 3-digit status + longest allowed content type), with slack. */
const MAX_DIAGNOSTIC_SUFFIX_LENGTH = 100;

/**
 * Deterministic, bounded encoding of PROVIDER_INVALID_RESPONSE diagnostics into the existing
 * errorMessage column. Re-validates every field itself against the same closed lists used by
 * the decoder, independently of whether the caller already validated them: the security
 * boundary lives here, at persistence, not in whichever provider happens to call this today.
 */
export function encodeBacklinkDiscoveryInvalidResponseDiagnostic(
  details: BacklinkDiscoveryProviderErrorDetails,
): string {
  if (!INVALID_RESPONSE_SUBCAUSES.has(details.subcause)) {
    return "";
  }

  const parts = [`subcause=${details.subcause}`];
  if (isValidBacklinkDiscoveryHttpStatus(details.httpStatus)) {
    parts.push(`status=${details.httpStatus}`);
  }
  const contentType = normalizeBacklinkDiscoveryContentType(details.contentType);
  if (contentType !== null) {
    parts.push(`ctype=${contentType}`);
  }

  return ` diag:${parts.join(";")}`.slice(0, MAX_DIAGNOSTIC_SUFFIX_LENGTH);
}

/**
 * Extracts a diagnostic from a persisted errorMessage and re-validates every field against the
 * same closed lists used at encode time. Returns null for historical messages (pre-diagnostic),
 * a malformed suffix, or a subcause outside the closed set — never a raw/truncated message.
 */
export function decodeBacklinkDiscoveryInvalidResponseDiagnostic(
  message: string | null | undefined,
): BacklinkDiscoveryProviderErrorDetails | null {
  if (typeof message !== "string") return null;
  const match = DIAGNOSTIC_PATTERN.exec(message);
  if (match === null) return null;

  const [, subcause, statusText, contentType] = match;
  if (!INVALID_RESPONSE_SUBCAUSES.has(subcause as BacklinkDiscoveryInvalidResponseSubcause)) {
    return null;
  }

  const parsedStatus = statusText === undefined ? null : Number.parseInt(statusText, 10);
  const httpStatus = isValidBacklinkDiscoveryHttpStatus(parsedStatus) ? parsedStatus : null;
  const normalizedContentType = normalizeBacklinkDiscoveryContentType(contentType ?? null);

  return {
    subcause: subcause as BacklinkDiscoveryInvalidResponseSubcause,
    httpStatus,
    contentType: normalizedContentType,
  };
}
