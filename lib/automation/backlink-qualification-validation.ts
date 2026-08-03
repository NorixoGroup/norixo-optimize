import {
  BACKLINK_QUALIFICATION_INPUT_VERSION,
  BACKLINK_QUALIFICATION_MAX_CANDIDATES,
  BACKLINK_QUALIFICATION_MAX_INPUT_BYTES,
  BACKLINK_QUALIFICATION_MAX_QUERIES,
  BACKLINK_QUALIFICATION_POLICY_VERSION,
  BacklinkQualificationValidationError,
  type BacklinkQualificationPolicy,
  type BacklinkQualificationCandidateInput,
  type BacklinkQualificationPreviewInputV1,
  type LegacyBacklinkQualificationPreviewInput,
  type BacklinkQualificationValidationErrorCode,
  type ValidateBacklinkQualificationPreviewInputResult,
} from "./backlink-qualification-types";

const INPUT_ERROR_MESSAGE = "Backlink qualification input is invalid";
const POLICY_ERROR_MESSAGE = "Backlink qualification policy is invalid";
const MAX_QUERY_LENGTH = 300;
const MAX_CANDIDATE_KEY_LENGTH = 128;
const MAX_TITLE_LENGTH = 300;
const MAX_SNIPPET_LENGTH = 500;
const MAX_ASSET_KEY_LENGTH = 128;
const MAX_EVIDENCE_LENGTH = 500;

const inputKeys = [
  "version",
  "source",
  "policyVersion",
  "queries",
  "candidates",
  "maxCandidates",
] as const;
const queryKeys = ["query", "countryCode", "languageCode"] as const;
const candidateKeys = [
  "candidateKey",
  "hostname",
  "sourceUrl",
  "pageTitle",
  "snippet",
  "queryIndex",
  "rank",
  "countryCode",
  "languageCode",
  "suggestedAssetKey",
  "evidenceSummary",
  "discoveryScore",
] as const;
const policyKeys = [
  "version",
  "selfHostnames",
  "blockedHostnames",
  "platformOwnerHostnames",
  "directCompetitorHostnames",
  "socialHostnames",
  "searchEngineHostnames",
  "videoHostnames",
  "unsafeTerms",
  "relevantTerms",
  "editorialSignals",
] as const;
const hostnamePolicyKeys = [
  "selfHostnames",
  "blockedHostnames",
  "platformOwnerHostnames",
  "directCompetitorHostnames",
  "socialHostnames",
  "searchEngineHostnames",
  "videoHostnames",
] as const;
const termPolicyKeys = ["unsafeTerms", "relevantTerms", "editorialSignals"] as const;

function validationError(
  code: BacklinkQualificationValidationErrorCode = "INVALID_QUALIFICATION_INPUT",
): never {
  const message =
    code === "QUALIFICATION_INPUT_TOO_LARGE"
      ? "Backlink qualification input is too large"
      : code === "DUPLICATE_QUALIFICATION_CANDIDATE"
        ? "Backlink qualification candidates must be unique"
        : INPUT_ERROR_MESSAGE;
  throw new BacklinkQualificationValidationError(code, message);
}

function policyError(): never {
  throw new BacklinkQualificationValidationError(
    "INVALID_QUALIFICATION_POLICY",
    POLICY_ERROR_MESSAGE,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actualKeys = Object.keys(value);
  return actualKeys.length === keys.length && actualKeys.every((key) => keys.includes(key));
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }

  return (
    parts[0] === 0 ||
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  );
}

function isPrivateIpv6(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  );
}

function isPublicHostname(hostname: string): boolean {
  return (
    hostname.length > 0 &&
    hostname !== "localhost" &&
    !hostname.endsWith(".localhost") &&
    !isPrivateIpv4(hostname) &&
    !isPrivateIpv6(hostname)
  );
}

function isNormalizedHostname(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value === value.trim() &&
    value === value.toLowerCase() &&
    !/[/:@?#\s]/.test(value) &&
    isPublicHostname(value)
  );
}

function isCleanText(value: unknown, maxLength: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value === value.trim() &&
    value.length <= maxLength
  );
}

function isIntegerInRange(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= minimum && value <= maximum;
}

function isOptionalCleanText(value: unknown, maxLength: number): boolean {
  return value === null || isCleanText(value, maxLength);
}

function isCountryCode(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && /^[A-Z]{2}$/.test(value));
}

function isLanguageCode(value: unknown): value is string | null {
  return (
    value === null ||
    (typeof value === "string" && /^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/.test(value))
  );
}

function serializeInput(value: unknown): void {
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    validationError();
  }

  if (new TextEncoder().encode(serialized).length > BACKLINK_QUALIFICATION_MAX_INPUT_BYTES) {
    validationError("QUALIFICATION_INPUT_TOO_LARGE");
  }
}

function validateQuery(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasExactKeys(value, queryKeys) &&
    isCleanText(value.query, MAX_QUERY_LENGTH) &&
    isCountryCode(value.countryCode) &&
    isLanguageCode(value.languageCode)
  );
}

function isV1InputEnvelope(
  value: Record<string, unknown>,
): value is BacklinkQualificationPreviewInputV1 {
  return (
    hasExactKeys(value, inputKeys) &&
    value.version === BACKLINK_QUALIFICATION_INPUT_VERSION &&
    value.source === "automation_discovery" &&
    value.policyVersion === BACKLINK_QUALIFICATION_POLICY_VERSION &&
    Array.isArray(value.queries) &&
    Array.isArray(value.candidates) &&
    isIntegerInRange(value.maxCandidates, 1, BACKLINK_QUALIFICATION_MAX_CANDIDATES)
  );
}

function parseCandidateUrl(value: unknown): URL | null {
  if (typeof value !== "string" || value.length === 0 || value !== value.trim()) {
    return null;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    if (url.hash.length > 0 || !isPublicHostname(url.hostname.toLowerCase())) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

function validateCandidate(
  value: unknown,
  queryCount: number,
): value is BacklinkQualificationCandidateInput {
  if (!isRecord(value) || !hasExactKeys(value, candidateKeys)) {
    return false;
  }
  if (
    !isCleanText(value.candidateKey, MAX_CANDIDATE_KEY_LENGTH) ||
    !isNormalizedHostname(value.hostname) ||
    !isOptionalCleanText(value.pageTitle, MAX_TITLE_LENGTH) ||
    !isOptionalCleanText(value.snippet, MAX_SNIPPET_LENGTH) ||
    !isIntegerInRange(value.queryIndex, 0, queryCount - 1) ||
    !isIntegerInRange(value.rank, 1, Number.MAX_SAFE_INTEGER) ||
    !isCountryCode(value.countryCode) ||
    !isLanguageCode(value.languageCode) ||
    !isOptionalCleanText(value.suggestedAssetKey, MAX_ASSET_KEY_LENGTH) ||
    !isCleanText(value.evidenceSummary, MAX_EVIDENCE_LENGTH) ||
    !isIntegerInRange(value.discoveryScore, 0, 100)
  ) {
    return false;
  }

  const sourceUrl = parseCandidateUrl(value.sourceUrl);
  if (sourceUrl === null || sourceUrl.hostname.toLowerCase() !== value.hostname) {
    return false;
  }

  return true;
}

function isLegacyPreviewInput(
  value: Record<string, unknown>,
): value is LegacyBacklinkQualificationPreviewInput {
  return (
    hasExactKeys(value, ["source", "requestedScope"]) &&
    value.source === "manual_dashboard" &&
    value.requestedScope === "preview"
  );
}

function isPolicyEnvelope(value: Record<string, unknown>): value is BacklinkQualificationPolicy {
  return (
    hasExactKeys(value, policyKeys) &&
    value.version === BACKLINK_QUALIFICATION_POLICY_VERSION &&
    hostnamePolicyKeys.every((key) => Array.isArray(value[key])) &&
    termPolicyKeys.every((key) => Array.isArray(value[key]))
  );
}

export function validateBacklinkQualificationPreviewInput(
  input: unknown,
): ValidateBacklinkQualificationPreviewInputResult {
  if (!isRecord(input)) {
    return validationError();
  }
  if (isLegacyPreviewInput(input)) {
    return { kind: "legacy_preview", input };
  }
  if (!isV1InputEnvelope(input)) {
    return validationError();
  }

  serializeInput(input);

  if (
    input.queries.length < 1 ||
    input.queries.length > BACKLINK_QUALIFICATION_MAX_QUERIES ||
    input.candidates.length > BACKLINK_QUALIFICATION_MAX_CANDIDATES ||
    input.candidates.length > input.maxCandidates
  ) {
    return validationError();
  }

  if (!input.queries.every(validateQuery)) {
    return validationError();
  }

  const candidateKeysSeen = new Set<string>();
  const sourceUrlsSeen = new Set<string>();
  for (const candidate of input.candidates) {
    if (!validateCandidate(candidate, input.queries.length)) {
      return validationError();
    }
    const sourceUrl = parseCandidateUrl(candidate.sourceUrl);
    if (sourceUrl === null) {
      return validationError();
    }
    if (
      candidateKeysSeen.has(candidate.candidateKey) ||
      sourceUrlsSeen.has(sourceUrl.toString())
    ) {
      return validationError("DUPLICATE_QUALIFICATION_CANDIDATE");
    }
    candidateKeysSeen.add(candidate.candidateKey);
    sourceUrlsSeen.add(sourceUrl.toString());
  }

  return { kind: "valid_v1", input };
}

function validatePolicyList(value: unknown, hostnameList: boolean): boolean {
  if (!Array.isArray(value)) {
    return false;
  }

  const seen = new Set<string>();
  for (const entry of value) {
    const valid = hostnameList
      ? isNormalizedHostname(entry) && !entry.startsWith("www.")
      : typeof entry === "string" &&
        entry.length > 0 &&
        entry === entry.trim() &&
        entry === entry.toLowerCase();
    if (!valid || seen.has(entry)) {
      return false;
    }
    seen.add(entry);
  }

  return true;
}

export function validateBacklinkQualificationPolicy(
  policy: unknown,
): BacklinkQualificationPolicy {
  if (!isRecord(policy) || !isPolicyEnvelope(policy)) {
    return policyError();
  }

  for (const key of hostnamePolicyKeys) {
    if (!validatePolicyList(policy[key], true)) {
      return policyError();
    }
  }
  for (const key of termPolicyKeys) {
    if (!validatePolicyList(policy[key], false)) {
      return policyError();
    }
  }

  return policy;
}
