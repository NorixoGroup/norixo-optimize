import {
  BACKLINK_QUALIFICATION_INPUT_VERSION,
  BACKLINK_QUALIFICATION_POLICY_VERSION,
  DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1,
  BacklinkQualificationPreviewError,
  executeBacklinkQualificationPreview,
  type BacklinkQualificationCandidateInput,
  type BacklinkQualificationPreviewInputV1,
  type BacklinkQualificationQueryInput,
} from "../lib/automation";
import type { Json } from "../types/database.types";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function candidate(
  candidateKey: string,
  hostname: string,
  path: string,
  queryIndex: number,
  overrides: Partial<BacklinkQualificationCandidateInput> = {},
): BacklinkQualificationCandidateInput {
  return {
    candidateKey,
    hostname,
    sourceUrl: `https://${hostname}${path}`,
    pageTitle: "Airbnb tools and resources",
    snippet: "Useful Airbnb host tools and resources",
    queryIndex,
    rank: 1,
    countryCode: "US",
    languageCode: "en",
    suggestedAssetKey: null,
    evidenceSummary: "Discovery evidence",
    discoveryScore: 100,
    ...overrides,
  };
}

function previewInput(
  queries: readonly BacklinkQualificationQueryInput[],
  candidates: readonly BacklinkQualificationCandidateInput[],
): BacklinkQualificationPreviewInputV1 {
  return {
    version: BACKLINK_QUALIFICATION_INPUT_VERSION,
    source: "automation_discovery",
    policyVersion: BACKLINK_QUALIFICATION_POLICY_VERSION,
    queries,
    candidates,
    maxCandidates: Math.max(1, candidates.length),
  };
}

const usQuery: BacklinkQualificationQueryInput = {
  query: "airbnb tools",
  countryCode: "US",
  languageCode: "en",
};
const frenchQuery: BacklinkQualificationQueryInput = {
  query: "airbnb outils",
  countryCode: "FR",
  languageCode: "fr",
};

const nominalInput = previewInput([usQuery], [
  candidate("qualified", "qualified.example", "/tools", 0),
  candidate("review", "review.example", "/support/tools", 0),
  candidate("rejected", "norixo.io", "/tools", 0),
]);
const nominal = executeBacklinkQualificationPreview({
  input: nominalInput,
  policy: DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1,
});
const persistedJson: Json = nominal;
assert(persistedJson === nominal, "qualification output must be directly JSON assignable");
assert(nominal.version === 1, "output version must be one");
assert(nominal.kind === "backlinks.qualification.preview", "output kind must be stable");
assert(nominal.dryRun === true, "preview must remain dry run");
assert(nominal.policyVersion === BACKLINK_QUALIFICATION_POLICY_VERSION, "policy version must propagate");
assert(
  JSON.stringify(nominal.results.map((result) => result.candidateKey)) ===
    JSON.stringify(["qualified", "review", "rejected"]),
  "candidate result order must remain unchanged",
);
assert(
  JSON.stringify(nominal.results.map((result) => result.decision)) ===
    JSON.stringify(["qualified", "review", "rejected"]),
  "batch must contain qualified, review, and rejected results",
);
assert(
  JSON.stringify(nominal.summary) ===
    JSON.stringify({ candidatesEvaluated: 3, qualified: 1, review: 1, rejected: 1 }),
  "summary must be exact and coherent",
);
assert(
  nominal.summary.qualified + nominal.summary.review + nominal.summary.rejected ===
    nominal.summary.candidatesEvaluated,
  "summary counts must sum to candidates evaluated",
);
assert(
  nominal.results[0]?.proposedOpportunityType === "Tools List" &&
    nominal.results[0]?.proposedPageType === "tools_list",
  "proposed types must propagate from signals",
);

const empty = executeBacklinkQualificationPreview({
  input: previewInput([usQuery], []),
  policy: DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1,
});
assert(
  JSON.stringify(empty.summary) ===
    JSON.stringify({ candidatesEvaluated: 0, qualified: 0, review: 0, rejected: 0 }),
  "empty batch summary must contain only zeros",
);
assert(empty.results.length === 0, "empty batch must return no results");

try {
  executeBacklinkQualificationPreview({
    input: { source: "manual_dashboard", requestedScope: "preview" },
    policy: DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1,
  });
  throw new Error("legacy input must be rejected");
} catch (error) {
  assert(
    error instanceof BacklinkQualificationPreviewError &&
      error.code === "BACKLINK_QUALIFICATION_LEGACY_INPUT_NOT_SUPPORTED",
    "legacy input must use the deterministic rejection code",
  );
}

const multiQueryInput = previewInput([usQuery, frenchQuery], [
  candidate("us-candidate", "us.example", "/tools", 0),
  candidate("fr-candidate", "fr.example", "/tools", 1, {
    countryCode: "FR",
    languageCode: "fr",
  }),
]);
const multiQuery = executeBacklinkQualificationPreview({
  input: multiQueryInput,
  policy: DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1,
});
assert(
  multiQuery.results[0]?.reasons.some((reason) => reason.code === "LANGUAGE_MATCH") &&
    multiQuery.results[0]?.reasons.some((reason) => reason.code === "COUNTRY_MATCH") &&
    multiQuery.results[1]?.reasons.some((reason) => reason.code === "LANGUAGE_MATCH") &&
    multiQuery.results[1]?.reasons.some((reason) => reason.code === "COUNTRY_MATCH"),
  "each candidate must use language and country from its own query index",
);

const inputSnapshot = JSON.stringify(nominalInput);
const policySnapshot = JSON.stringify(DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1);
const first = executeBacklinkQualificationPreview({
  input: nominalInput,
  policy: DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1,
});
const second = executeBacklinkQualificationPreview({
  input: nominalInput,
  policy: DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1,
});
assert(JSON.stringify(first) === JSON.stringify(second), "preview must be deterministic");
assert(first !== second && first.results !== second.results, "outputs must be independent");
assert(JSON.stringify(nominalInput) === inputSnapshot, "input must remain immutable");
assert(
  JSON.stringify(DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1) === policySnapshot,
  "policy must remain immutable",
);
assert(
  first.results[0]?.qualificationScore === second.results[0]?.qualificationScore,
  "discoveryScore must not affect batch evaluation directly",
);
const changedDiscoveryScore = executeBacklinkQualificationPreview({
  input: {
    ...nominalInput,
    candidates: nominalInput.candidates.map((item) => ({
      ...item,
      discoveryScore: 0,
    })),
  },
  policy: DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1,
});
assert(
  changedDiscoveryScore.results[0]?.qualificationScore === first.results[0]?.qualificationScore,
  "discoveryScore must not affect batch evaluation directly",
);

const largeCandidates = Array.from({ length: 50 }, (_, index) =>
  candidate(
    `bulk-${index}`,
    "bulk.example",
    `/tools-${index}`,
    0,
    {
      pageTitle: `Airbnb tools ${"x".repeat(285 - String(index).length)}`,
      snippet: `Airbnb host tools ${"y".repeat(475 - String(index).length)}`,
    },
  ),
);
try {
  const largeOutput = executeBacklinkQualificationPreview({
    input: previewInput([usQuery], largeCandidates),
    policy: DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1,
  });
  assert(largeOutput.results.length === 50, "bounded large output must retain all results");
} catch (error) {
  assert(
    error instanceof BacklinkQualificationPreviewError &&
      error.code === "BACKLINK_QUALIFICATION_OUTPUT_TOO_LARGE",
    "oversized output must fail with the deterministic preview error",
  );
}

console.log("PASS — Automation backlink qualification preview smoke");
