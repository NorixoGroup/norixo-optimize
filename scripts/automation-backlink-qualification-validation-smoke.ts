import {
  BACKLINK_QUALIFICATION_INPUT_VERSION,
  BACKLINK_QUALIFICATION_MAX_CANDIDATES,
  BACKLINK_QUALIFICATION_MAX_INPUT_BYTES,
  BACKLINK_QUALIFICATION_MAX_QUERIES,
  BACKLINK_QUALIFICATION_POLICY_VERSION,
  BacklinkQualificationValidationError,
  DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1,
  validateBacklinkQualificationPolicy,
  validateBacklinkQualificationPreviewInput,
  type BacklinkQualificationCandidateInput,
  type BacklinkQualificationPreviewInputV1,
} from "../lib/automation";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertValidationError(
  input: unknown,
  code: BacklinkQualificationValidationError["code"],
): void {
  try {
    validateBacklinkQualificationPreviewInput(input);
  } catch (error) {
    assert(
      error instanceof BacklinkQualificationValidationError && error.code === code,
      `Expected ${code}`,
    );
    assert(
      !error.message.includes("qualification-secret") &&
        !error.message.includes("https://private.example"),
      "Validation error must remain safe",
    );
    return;
  }

  throw new Error(`Expected ${code}`);
}

function assertPolicyError(policy: unknown): void {
  try {
    validateBacklinkQualificationPolicy(policy);
  } catch (error) {
    assert(
      error instanceof BacklinkQualificationValidationError &&
        error.code === "INVALID_QUALIFICATION_POLICY",
      "Expected invalid policy",
    );
    return;
  }

  throw new Error("Expected invalid policy");
}

const query = {
  query: "airbnb host resources",
  countryCode: "US",
  languageCode: "en",
};

const candidate: BacklinkQualificationCandidateInput = {
  candidateKey: "discovery:qualification-candidate",
  hostname: "example.com",
  sourceUrl: "https://example.com/resources",
  pageTitle: "Host resources",
  snippet: "Useful Airbnb host resources",
  queryIndex: 0,
  rank: 1,
  countryCode: "US",
  languageCode: "en",
  suggestedAssetKey: null,
  evidenceSummary: "SERP rank 1 for a relevant query",
  discoveryScore: 100,
};

const input: BacklinkQualificationPreviewInputV1 = {
  version: BACKLINK_QUALIFICATION_INPUT_VERSION,
  source: "automation_discovery",
  policyVersion: BACKLINK_QUALIFICATION_POLICY_VERSION,
  queries: [query],
  candidates: [candidate],
  maxCandidates: 1,
};

function validCandidate(overrides: Partial<BacklinkQualificationCandidateInput> = {}): BacklinkQualificationCandidateInput {
  return { ...candidate, ...overrides };
}

async function main(): Promise<void> {
  const inputBefore = JSON.stringify(input);
  const validated = validateBacklinkQualificationPreviewInput(input);
  assert(
    validated.kind === "valid_v1" && validated.input === input,
    "Valid V1 input must retain its reference",
  );
  assert(JSON.stringify(input) === inputBefore, "Valid input must remain immutable");

  const legacy = { source: "manual_dashboard", requestedScope: "preview" } as const;
  const validatedLegacy = validateBacklinkQualificationPreviewInput(legacy);
  assert(
    validatedLegacy.kind === "legacy_preview" && validatedLegacy.input === legacy,
    "Legacy input must retain its reference",
  );
  for (const invalidLegacy of [
    { source: "manual_dashboard" },
    { source: "manual_dashboard", requestedScope: "other" },
    { source: "manual_dashboard", requestedScope: "preview", extra: true },
  ]) {
    assertValidationError(invalidLegacy, "INVALID_QUALIFICATION_INPUT");
  }

  for (const invalidRoot of [
    null,
    [],
    { ...input, extra: true },
    { ...input, version: 2 },
    { ...input, source: "manual_dashboard" },
    { ...input, policyVersion: "other" },
  ]) {
    assertValidationError(invalidRoot, "INVALID_QUALIFICATION_INPUT");
  }

  for (const invalidQueries of [
    { ...input, queries: [] },
    { ...input, queries: Array.from({ length: BACKLINK_QUALIFICATION_MAX_QUERIES + 1 }, () => query) },
    { ...input, queries: [{ ...query, query: "" }] },
    { ...input, queries: [{ ...query, query: " " }] },
    { ...input, queries: [{ ...query, query: "x".repeat(301) }] },
    { ...input, queries: [{ ...query, countryCode: "usa" }] },
    { ...input, queries: [{ ...query, languageCode: "EN" }] },
    { ...input, queries: [{ ...query, extra: true }] },
  ]) {
    assertValidationError(invalidQueries, "INVALID_QUALIFICATION_INPUT");
  }

  const manyCandidates = Array.from(
    { length: BACKLINK_QUALIFICATION_MAX_CANDIDATES + 1 },
    (_, index) => validCandidate({ candidateKey: `candidate-${index}`, sourceUrl: `https://example.com/${index}` }),
  );
  for (const invalidCandidates of [
    { ...input, candidates: manyCandidates, maxCandidates: BACKLINK_QUALIFICATION_MAX_CANDIDATES },
    { ...input, candidates: [candidate], maxCandidates: 0 },
    { ...input, candidates: [candidate], maxCandidates: 51 },
    { ...input, candidates: [candidate, validCandidate({ candidateKey: "candidate-two", sourceUrl: "https://example.com/two" })], maxCandidates: 1 },
    { ...input, candidates: [validCandidate({ candidateKey: "" })] },
    { ...input, candidates: [validCandidate({ hostname: "EXAMPLE.com" })] },
    { ...input, candidates: [validCandidate({ hostname: "https://example.com" })] },
    { ...input, candidates: [validCandidate({ hostname: "example.com/path" })] },
    { ...input, candidates: [validCandidate({ hostname: "example.com:443" })] },
    { ...input, candidates: [validCandidate({ hostname: "localhost", sourceUrl: "https://localhost/a" })] },
    { ...input, candidates: [validCandidate({ hostname: "192.168.1.10", sourceUrl: "https://192.168.1.10/a" })] },
    { ...input, candidates: [validCandidate({ sourceUrl: "not a URL" })] },
    { ...input, candidates: [validCandidate({ sourceUrl: "ftp://example.com/a" })] },
    { ...input, candidates: [validCandidate({ sourceUrl: "https://other.example/a" })] },
    { ...input, candidates: [validCandidate({ sourceUrl: "https://example.com/a#fragment" })] },
    { ...input, candidates: [validCandidate({ queryIndex: 1 })] },
    { ...input, candidates: [validCandidate({ rank: 0 })] },
    { ...input, candidates: [validCandidate({ pageTitle: " " })] },
    { ...input, candidates: [validCandidate({ snippet: "x".repeat(501) })] },
    { ...input, candidates: [validCandidate({ suggestedAssetKey: " " })] },
    { ...input, candidates: [validCandidate({ evidenceSummary: " " })] },
    { ...input, candidates: [validCandidate({ discoveryScore: 101 })] },
    { ...input, candidates: [{ ...candidate, extra: true }] },
  ]) {
    assertValidationError(invalidCandidates, "INVALID_QUALIFICATION_INPUT");
  }

  assertValidationError(
    {
      ...input,
      candidates: [candidate, validCandidate({ sourceUrl: "https://example.com/other" })],
      maxCandidates: 2,
    },
    "DUPLICATE_QUALIFICATION_CANDIDATE",
  );
  assertValidationError(
    {
      ...input,
      candidates: [candidate, validCandidate({ candidateKey: "candidate-two" })],
      maxCandidates: 2,
    },
    "DUPLICATE_QUALIFICATION_CANDIDATE",
  );
  assertValidationError(
    {
      ...input,
      candidates: [
        candidate,
        validCandidate({ candidateKey: "candidate-two", sourceUrl: "https://EXAMPLE.com/resources" }),
      ],
      maxCandidates: 2,
    },
    "DUPLICATE_QUALIFICATION_CANDIDATE",
  );
  assertValidationError(
    {
      ...input,
      candidates: [validCandidate({ evidenceSummary: "x".repeat(BACKLINK_QUALIFICATION_MAX_INPUT_BYTES) })],
    },
    "QUALIFICATION_INPUT_TOO_LARGE",
  );

  const policyBefore = JSON.stringify(DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1);
  assert(
    validateBacklinkQualificationPolicy(DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1) ===
      DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1,
    "Valid policy must retain its reference",
  );
  assert(
    JSON.stringify(DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1) === policyBefore,
    "Policy must remain immutable",
  );
  for (const invalidPolicy of [
    { ...DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1, version: "other" },
    (() => {
      const { videoHostnames, ...policy } = DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1;
      assert(Array.isArray(videoHostnames), "Policy fixture");
      return policy;
    })(),
    { ...DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1, selfHostnames: "norixo.io" },
    { ...DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1, selfHostnames: [" "] },
    { ...DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1, selfHostnames: ["norixo.io", "norixo.io"] },
    { ...DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1, selfHostnames: ["NORIXO.IO"] },
    { ...DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1, selfHostnames: ["www.norixo.io"] },
    { ...DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1, selfHostnames: ["https://norixo.io"] },
    { ...DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1, selfHostnames: ["norixo.io/path"] },
    { ...DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1, selfHostnames: ["norixo.io:443"] },
    { ...DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1, selfHostnames: ["localhost"] },
    { ...DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1, selfHostnames: ["192.168.1.10"] },
    { ...DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1, unsafeTerms: ["Adult"] },
    { ...DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1, relevantTerms: [" "] },
  ]) {
    assertPolicyError(invalidPolicy);
  }

  console.log("PASS — Automation backlink qualification validation smoke");
}

void main();
