import {
  DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1,
  extractBacklinkQualificationSignals,
  inferBacklinkQualificationOpportunityType,
  inferBacklinkQualificationPageType,
  type BacklinkQualificationCandidateInput,
  type BacklinkQualificationPolicy,
  type BacklinkQualificationQueryInput,
  type BacklinkQualificationSignal,
} from "../lib/automation";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const baseQuery: BacklinkQualificationQueryInput = {
  query: "vacation rental host resources",
  countryCode: "US",
  languageCode: "en",
};

function candidate(
  overrides: Partial<BacklinkQualificationCandidateInput> = {},
): BacklinkQualificationCandidateInput {
  return {
    candidateKey: "candidate-1",
    hostname: "example.com",
    sourceUrl: "https://example.com/neutral-page",
    pageTitle: "Neutral page",
    snippet: "Neutral summary",
    queryIndex: 0,
    rank: 4,
    countryCode: null,
    languageCode: null,
    suggestedAssetKey: null,
    evidenceSummary: "Discovery evidence",
    discoveryScore: 0.5,
    ...overrides,
  };
}

function policy(
  overrides: Partial<BacklinkQualificationPolicy> = {},
): BacklinkQualificationPolicy {
  return {
    ...DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1,
    ...overrides,
  };
}

function codesFor(
  candidateInput: BacklinkQualificationCandidateInput,
  query: BacklinkQualificationQueryInput = baseQuery,
  policyInput: BacklinkQualificationPolicy =
    DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1,
): readonly string[] {
  return extractBacklinkQualificationSignals({
    candidate: candidateInput,
    query,
    policy: policyInput,
  }).signals.map((signal) => signal.code);
}

const exactSelfCodes = codesFor(
  candidate({
    hostname: "norixo.io",
    sourceUrl: "https://norixo.io/resources",
  }),
);
assert(exactSelfCodes.includes("SELF_DOMAIN"), "exact self hostname must match norixo.io");
const selfCodes = codesFor(
  candidate({
    hostname: "www.norixo.io",
    sourceUrl: "https://www.norixo.io/resources",
  }),
);
assert(selfCodes.includes("SELF_DOMAIN"), "www self hostname must match norixo.io");

const subdomainCodes = codesFor(
  candidate({
    hostname: "blog.norixo.io",
    sourceUrl: "https://blog.norixo.io/guide",
  }),
);
assert(subdomainCodes.includes("SELF_DOMAIN"), "self subdomain must match policy hostname");
assert(
  !codesFor(
    candidate({
      hostname: "fakeairbnb.com",
      sourceUrl: "https://fakeairbnb.com/guide",
    }),
  ).includes("PLATFORM_OWNER_DOMAIN"),
  "substring hostname must not match a platform owner",
);

const hostnamePolicy = policy({
  blockedHostnames: ["blocked.example"],
  directCompetitorHostnames: ["competitor.example"],
});
assert(
  codesFor(
    candidate({
      hostname: "news.blocked.example",
      sourceUrl: "https://news.blocked.example/page",
    }),
    baseQuery,
    hostnamePolicy,
  ).includes("BLOCKED_HOSTNAME"),
  "blocked hostname must be detected",
);
assert(
  codesFor(
    candidate({
      hostname: "competitor.example",
      sourceUrl: "https://competitor.example/page",
    }),
    baseQuery,
    hostnamePolicy,
  ).includes("DIRECT_COMPETITOR"),
  "direct competitor hostname must be detected",
);
assert(
  codesFor(
    candidate({
      hostname: "help.airbnb.com",
      sourceUrl: "https://help.airbnb.com/help",
    }),
  ).includes("PLATFORM_OWNER_DOMAIN"),
  "platform owner hostname must be detected",
);
assert(
  codesFor(
    candidate({ hostname: "booking.com", sourceUrl: "https://booking.com/stays" }),
  ).includes("PLATFORM_OWNER_DOMAIN"),
  "booking hostname must be detected as platform owner",
);
assert(
  codesFor(
    candidate({ hostname: "facebook.com", sourceUrl: "https://facebook.com/page" }),
  ).includes("SOCIAL_NETWORK"),
  "social hostname must be detected",
);
assert(
  codesFor(
    candidate({ hostname: "google.com", sourceUrl: "https://google.com/search" }),
  ).includes("SEARCH_ENGINE"),
  "search hostname must be detected",
);
assert(
  codesFor(
    candidate({ hostname: "youtube.com", sourceUrl: "https://youtube.com/watch" }),
  ).includes("VIDEO_PLATFORM"),
  "video hostname must be detected",
);

assert(
  codesFor(candidate({ pageTitle: "Casino marketing guide" })).includes("UNSAFE_TOPIC"),
  "unsafe single term must be detected",
);
assert(
  codesFor(candidate({ snippet: "A crypto giveaway is promoted here" })).includes(
    "UNSAFE_TOPIC",
  ),
  "unsafe phrase must be detected",
);
assert(
  !codesFor(candidate({ pageTitle: "Adulting guide" })).includes("UNSAFE_TOPIC"),
  "unsafe substring must not be detected",
);

const strongSpecific = extractBacklinkQualificationSignals({
  candidate: candidate({ pageTitle: "Airbnb hosting handbook" }),
  query: baseQuery,
  policy: DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1,
});
assert(strongSpecific.topicalSignal === "strong", "specific relevance must be strong");
const strongGeneric = extractBacklinkQualificationSignals({
  candidate: candidate({ pageTitle: "Hospitality host handbook" }),
  query: { ...baseQuery, query: "neutral search" },
  policy: DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1,
});
assert(strongGeneric.topicalSignal === "strong", "two generic terms must be strong");
const partialTopical = extractBacklinkQualificationSignals({
  candidate: candidate({ pageTitle: "Concierge handbook" }),
  query: { ...baseQuery, query: "neutral search" },
  policy: DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1,
});
assert(partialTopical.topicalSignal === "partial", "one generic term must be partial");
const noTopical = extractBacklinkQualificationSignals({
  candidate: candidate({ pageTitle: "Gardening handbook", snippet: "Plant care" }),
  query: { ...baseQuery, query: "neutral search" },
  policy: DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1,
});
assert(noTopical.topicalSignal === "none", "unrelated text must remain non-topical");

const editorial = extractBacklinkQualificationSignals({
  candidate: candidate({
    pageTitle:
      "Resource tools guide guest post compare directory partnership",
    sourceUrl: "https://example.com/resource-tools-guide",
  }),
  query: { ...baseQuery, query: "neutral search" },
  policy: DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1,
});
assert(
  JSON.stringify(editorial.editorialSignalCodes) ===
    JSON.stringify([
      "RESOURCE_PAGE_SIGNAL",
      "TOOLS_LIST_SIGNAL",
      "GUIDE_SIGNAL",
      "GUEST_POST_SIGNAL",
      "COMPARISON_SIGNAL",
      "DIRECTORY_SIGNAL",
      "PARTNERSHIP_SIGNAL",
    ]),
  "editorial signals must have the required stable order",
);
assert(
  editorial.proposedOpportunityType === "Guest Post",
  "guest post must win opportunity precedence",
);
assert(editorial.proposedPageType === "tools_list", "tools must win page precedence");

const login = extractBacklinkQualificationSignals({
  candidate: candidate({ sourceUrl: "https://example.com/account/login" }),
  query: { ...baseQuery, query: "neutral search" },
  policy: DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1,
});
assert(login.blockingSignalCodes.includes("LOGIN_PAGE"), "login URL must be blocking");
assert(login.proposedPageType === "unknown", "login must override page inference");
const legal = extractBacklinkQualificationSignals({
  candidate: candidate({ sourceUrl: "https://example.com/legal/privacy" }),
  query: { ...baseQuery, query: "neutral search" },
  policy: DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1,
});
assert(legal.blockingSignalCodes.includes("LEGAL_PAGE"), "legal URL must be blocking");
const support = extractBacklinkQualificationSignals({
  candidate: candidate({ sourceUrl: "https://example.com/help/knowledge_base" }),
  query: { ...baseQuery, query: "neutral search" },
  policy: DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1,
});
assert(support.riskSignalCodes.includes("SUPPORT_PAGE_SIGNAL"), "support URL must be risky");
assert(support.proposedPageType === "support_page", "support page must be inferred");

const contextual = extractBacklinkQualificationSignals({
  candidate: candidate({
    languageCode: "en",
    countryCode: "US",
    rank: 3,
    pageTitle: "Neutral title",
    snippet: "Neutral snippet",
  }),
  query: baseQuery,
  policy: DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1,
});
assert(contextual.signals.some((signal) => signal.code === "LANGUAGE_MATCH"), "language must match exactly");
assert(contextual.signals.some((signal) => signal.code === "COUNTRY_MATCH"), "country must match exactly");
assert(contextual.signals.some((signal) => signal.code === "HIGH_SERP_POSITION"), "rank three must be high position");
assert(contextual.signals.some((signal) => signal.code === "TITLE_PRESENT"), "title must be detected");
assert(contextual.signals.some((signal) => signal.code === "SNIPPET_PRESENT"), "snippet must be detected");
assert(
  !codesFor(
    candidate({ languageCode: "fr", countryCode: null, rank: 4 }),
  ).includes("LANGUAGE_MATCH"),
  "language mismatch must not match",
);

const insufficient = extractBacklinkQualificationSignals({
  candidate: candidate({ pageTitle: null, snippet: null }),
  query: { ...baseQuery, query: "neutral search" },
  policy: DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1,
});
assert(
  insufficient.signals.some((signal) => signal.code === "INSUFFICIENT_EVIDENCE"),
  "missing title, snippet, topical and editorial evidence must be explicit",
);

const inferredSignals: BacklinkQualificationSignal[] = [
  { code: "DIRECTORY_SIGNAL", category: "editorial", evidence: "directory" },
  { code: "RESOURCE_PAGE_SIGNAL", category: "editorial", evidence: "resource" },
];
assert(
  inferBacklinkQualificationOpportunityType(inferredSignals) === "Directory",
  "directory must outrank resource",
);
assert(
  inferBacklinkQualificationPageType(inferredSignals) === "directory",
  "directory page type must be inferred",
);

const immutableCandidate = candidate({
  pageTitle: "A ".repeat(150),
  snippet: "B ".repeat(150),
});
const immutableQuery: BacklinkQualificationQueryInput = { ...baseQuery };
const immutablePolicy = policy();
const candidateSnapshot = JSON.stringify(immutableCandidate);
const querySnapshot = JSON.stringify(immutableQuery);
const policySnapshot = JSON.stringify(immutablePolicy);
const firstResult = extractBacklinkQualificationSignals({
  candidate: immutableCandidate,
  query: immutableQuery,
  policy: immutablePolicy,
});
const secondResult = extractBacklinkQualificationSignals({
  candidate: immutableCandidate,
  query: immutableQuery,
  policy: immutablePolicy,
});
assert(JSON.stringify(firstResult) === JSON.stringify(secondResult), "results must be deterministic");
assert(firstResult !== secondResult, "results must be independent objects");
assert(firstResult.signals !== secondResult.signals, "signal arrays must be independent");
assert(JSON.stringify(immutableCandidate) === candidateSnapshot, "candidate must not be mutated");
assert(JSON.stringify(immutableQuery) === querySnapshot, "query must not be mutated");
assert(JSON.stringify(immutablePolicy) === policySnapshot, "policy must not be mutated");
assert(
  firstResult.signals.every((signal) => signal.evidence.length <= 200),
  "all evidence must be bounded",
);
assert(!("decision" in firstResult), "signal extraction must not decide");
assert(!("qualificationScore" in firstResult), "signal extraction must not score");

console.log("PASS — Automation Backlink qualification signals smoke");
