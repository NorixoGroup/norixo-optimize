import {
  BacklinkDiscoveryProviderError,
  createDryRunAutomationTaskHandlers,
  createMockBacklinkDiscoveryProvider,
  executeBacklinkDiscoveryPreview,
  type BacklinkDiscoveryPreviewOutputV1,
  type BacklinkDiscoveryProvider,
  type BacklinkDiscoveryProviderSearchInput,
  type ExecuteAutomationTaskHandlerInput,
  type MockBacklinkDiscoveryFixture,
} from "../lib/automation";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertPreviewOutput(value: unknown): asserts value is BacklinkDiscoveryPreviewOutputV1 {
  assert(isRecord(value), "Discovery output must be an object");
  assert(value.kind === "backlinks.discovery.preview", "Discovery output kind");
  assert(value.version === 1 && value.dryRun === true, "Discovery output envelope");
  assert(Array.isArray(value.candidates) && Array.isArray(value.rejections), "Discovery output arrays");
}

async function assertRejects(
  operation: () => Promise<unknown>,
  message: string,
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    assert(error instanceof Error && error.message.includes(message), message);
    return;
  }

  throw new Error(`Expected rejection: ${message}`);
}

function taskInput(
  input: ExecuteAutomationTaskHandlerInput["input"],
): ExecuteAutomationTaskHandlerInput {
  return {
    workspaceId: "00000000-0000-4000-8000-000000000001",
    runId: "00000000-0000-4000-8000-000000000002",
    taskId: "00000000-0000-4000-8000-000000000003",
    taskKind: "backlinks.discovery.preview",
    input,
    attemptedAt: "2026-08-03T10:00:00.000Z",
  };
}

async function executePreview(
  provider: BacklinkDiscoveryProvider | undefined,
  input: ExecuteAutomationTaskHandlerInput["input"],
): Promise<BacklinkDiscoveryPreviewOutputV1> {
  const result = await executeBacklinkDiscoveryPreview(
    { providers: provider === undefined ? {} : { mock: provider } },
    taskInput(input),
  );
  assertPreviewOutput(result.output);
  return result.output;
}

const nominalRequest = {
  version: 1,
  source: "manual_dashboard",
  provider: "mock",
  searches: [
    { query: "airbnb host resources", countryCode: "US", languageCode: "en" },
    { query: "property manager tools", countryCode: "FR", languageCode: "fr" },
  ],
  maxResultsPerSearch: 10,
  maxCandidates: 10,
  suggestedAssetKey: "home-page",
};

const fixtures: readonly MockBacklinkDiscoveryFixture[] = [
  {
    query: "airbnb host resources",
    countryCode: "US",
    languageCode: "en",
    items: [
      {
        url: "HTTPS://WWW.Example.COM:443/resources/?utm_source=newsletter&keep=value&gclid=abc#top",
        title: "  Airbnb resources  ",
        snippet: "   ",
        rank: 1,
      },
      {
        url: "https://www.example.com/resources/?keep=value#duplicate",
        title: "Duplicate",
        snippet: "Duplicate",
        rank: 2,
      },
      { url: "not a URL", title: null, snippet: null, rank: 3 },
      { url: "ftp://example.com/file", title: null, snippet: null, rank: 4 },
      { url: "https://localhost/resources", title: null, snippet: null, rank: 5 },
      { url: "https://192.168.1.10/resources", title: null, snippet: null, rank: 6 },
    ],
  },
  {
    query: "property manager tools",
    countryCode: "FR",
    languageCode: "fr",
    items: [
      {
        url: "https://www.example.com/resources/?keep=value",
        title: "Duplicate cross-query",
        snippet: "Duplicate",
        rank: 1,
      },
      {
        url: "http://WWW.Example.org:80/path?fbclid=abc",
        title: "  French tools  ",
        snippet: "Useful listing",
        rank: 100,
      },
      {
        url: "https://example.org/low-rank",
        title: "Low rank",
        snippet: "Low result",
        rank: 102,
      },
    ],
  },
];

async function main(): Promise<void> {
  const receivedSearches: BacklinkDiscoveryProviderSearchInput[] = [];
  const fixtureProvider = createMockBacklinkDiscoveryProvider(fixtures);
  const provider: BacklinkDiscoveryProvider = {
    name: "mock",
    async search(input) {
      receivedSearches.push({ ...input });
      return fixtureProvider.search(input);
    },
  };
  const requestBefore = JSON.stringify(nominalRequest);
  const fixturesBefore = JSON.stringify(fixtures);

  const skipped = await executePreview(provider, {});
  assert(skipped.skipped === "no_searches", "Empty input must be skipped");
  assert(
    skipped.summary.searchesRequested === 0 &&
      skipped.summary.resultsReceived === 0 &&
      skipped.summary.candidatesAccepted === 0 &&
      skipped.summary.candidatesRejected === 0 &&
      skipped.summary.truncated === false,
    "Skipped summary",
  );
  assert(skipped.candidates.length === 0 && skipped.rejections.length === 0, "Skipped output arrays");
  const skippedCallCount = receivedSearches.length;
  assert(skippedCallCount === 0, "Skipped input must not call a provider");

  const first = await executePreview(provider, nominalRequest);
  const second = await executePreview(provider, nominalRequest);
  assert(JSON.stringify(first) === JSON.stringify(second), "Identical calls must be deterministic");
  assert(receivedSearches.length === 4, "Two calls must search both queries sequentially");
  assert(
    receivedSearches[0]?.query === nominalRequest.searches[0]?.query &&
      receivedSearches[0]?.queryIndex === 0 &&
      receivedSearches[0]?.countryCode === "US" &&
      receivedSearches[0]?.languageCode === "en" &&
      receivedSearches[0]?.maxResults === 10 &&
      receivedSearches[1]?.query === nominalRequest.searches[1]?.query &&
      receivedSearches[1]?.queryIndex === 1 &&
      receivedSearches[2]?.queryIndex === 0 &&
      receivedSearches[3]?.queryIndex === 1,
    "Search inputs and order",
  );
  assert(first.provider === "mock", "Provider name");
  assert(
    first.summary.searchesRequested === 2 &&
      first.summary.resultsReceived === 9 &&
      first.summary.candidatesAccepted === 3 &&
      first.summary.candidatesRejected === 6,
    "Nominal summary",
  );
  const [firstCandidate, secondCandidate, thirdCandidate] = first.candidates;
  assert(
    firstCandidate?.sourceUrl === "https://www.example.com/resources/?keep=value" &&
      firstCandidate.hostname === "www.example.com" &&
      firstCandidate.pageTitle === "Airbnb resources" &&
      firstCandidate.snippet === null,
    "Candidate normalization",
  );
  assert(
    secondCandidate?.sourceUrl === "http://www.example.org/path" &&
      secondCandidate.pageTitle === "French tools" &&
      secondCandidate.discoveryScore === 1 &&
      thirdCandidate?.discoveryScore === 0,
    "HTTP normalization and rank score",
  );
  assert(firstCandidate.discoveryScore === 100, "Rank one score");
  assert(
    firstCandidate.candidateKey === second.candidates[0]?.candidateKey &&
      firstCandidate.candidateKey.startsWith("discovery:") &&
      firstCandidate.candidateKey.length === "discovery:".length + 64,
    "Candidate key must be deterministic and URL-based",
  );
  assert(
    firstCandidate.suggestedAssetKey === "home-page" &&
      firstCandidate.intakeEligibility?.status === "eligible" &&
      firstCandidate.intakeEligibility.opportunityType === "Resource Page" &&
      firstCandidate.intakeEligibility.pageType === "Resource Page" &&
      first.candidates.every(
        (candidate) =>
          candidate.proposedOpportunityType === null && candidate.proposedPageType === null,
      ),
    "Candidates must retain Promotion fields and expose explicit intake eligibility",
  );
  assert(
    firstCandidate.evidenceSummary.length <= 500 &&
      firstCandidate.evidenceSummary.trim() === firstCandidate.evidenceSummary &&
      firstCandidate.evidenceSummary.includes("airbnb host resources") &&
      !/crawl|verif/i.test(firstCandidate.evidenceSummary),
    "Evidence summary must be bounded and honest",
  );
  assert(
    JSON.stringify(first.rejections) ===
      JSON.stringify([
        { code: "invalid_url", count: 1 },
        { code: "unsupported_protocol", count: 1 },
        { code: "private_host", count: 2 },
        { code: "duplicate_url", count: 2 },
      ]),
    "Rejection summaries",
  );

  const sameUrlOtherQuery = await executePreview(provider, {
    ...nominalRequest,
    searches: [{ query: "other query", countryCode: "US", languageCode: "en" }],
  });
  const sameUrlProvider = createMockBacklinkDiscoveryProvider([
    {
      query: "other query",
      countryCode: "US",
      languageCode: "en",
      items: [{ url: "https://www.example.com/resources/?keep=value#next", title: null, snippet: null, rank: 9 }],
    },
  ]);
  const sameUrlOutput = await executePreview(sameUrlProvider, {
    ...nominalRequest,
    searches: [{ query: "other query", countryCode: "US", languageCode: "en" }],
  });
  assert(
    sameUrlOtherQuery.candidates.length === 0 &&
      sameUrlOutput.candidates[0]?.candidateKey === firstCandidate.candidateKey &&
      sameUrlOutput.candidates[0]?.intakeEligibility?.status === "review_only" &&
      sameUrlOutput.candidates[0]?.intakeEligibility.reason === "missing_page_title",
    "Candidate key must not depend on query or rank",
  );

  const noAssetOutput = await executePreview(provider, {
    ...nominalRequest,
    suggestedAssetKey: undefined,
    searches: [nominalRequest.searches[0]!],
  });
  assert(noAssetOutput.candidates[0]?.suggestedAssetKey === null, "Missing asset must remain null");

  const truncationProvider = createMockBacklinkDiscoveryProvider([
    {
      query: "many candidates",
      items: Array.from({ length: 4 }, (_, index) => ({
        url: `https://example.com/candidate-${index + 1}`,
        title: `Candidate ${index + 1}`,
        snippet: null,
        rank: index + 1,
      })),
    },
  ]);
  const truncated = await executePreview(truncationProvider, {
    ...nominalRequest,
    searches: [{ query: "many candidates" }],
    maxCandidates: 2,
  });
  assert(
    truncated.summary.truncated === true &&
      truncated.summary.candidatesAccepted === 2 &&
      truncated.summary.candidatesRejected === 2 &&
      truncated.candidates[0]?.sourceUrl.endsWith("candidate-1") &&
      truncated.candidates[1]?.sourceUrl.endsWith("candidate-2") &&
      JSON.stringify(truncated.rejections) === JSON.stringify([{ code: "candidate_limit", count: 2 }]),
    "maxCandidates truncation",
  );

  const longText = "x".repeat(1000);
  const budgetSearches = Array.from({ length: 5 }, (_, queryIndex) => ({
    query: `budget candidates ${queryIndex + 1}`,
  }));
  const budgetProvider = createMockBacklinkDiscoveryProvider([
    ...budgetSearches.map((search, queryIndex) => ({
      query: search.query,
      items: Array.from({ length: 10 }, (_, itemIndex) => ({
        url: `https://example.net/${"a".repeat(1_500)}-${queryIndex + 1}-${itemIndex + 1}`,
        title: longText,
        snippet: longText,
        rank: itemIndex + 1,
      })),
    })),
  ]);
  const budgetOutput = await executePreview(budgetProvider, {
    ...nominalRequest,
    searches: budgetSearches,
    maxCandidates: 50,
  });
  assert(
    budgetOutput.summary.truncated === true &&
      budgetOutput.candidates.length < 50 &&
      budgetOutput.rejections.some(
        (rejection) => rejection.code === "candidate_limit" && rejection.count > 0,
      ) &&
      budgetOutput.candidates.every(
        (candidate) =>
          candidate.pageTitle === null ||
          candidate.pageTitle.length <= 300 &&
            (candidate.snippet === null || candidate.snippet.length <= 500) &&
            candidate.evidenceSummary.length <= 500,
      ) &&
      new TextEncoder().encode(JSON.stringify(budgetOutput)).length <= 64 * 1024,
    "Output budget truncation",
  );

  const missingProviderInput = { ...nominalRequest, provider: "brave_search" };
  await assertRejects(
    () => executePreview(provider, missingProviderInput),
    "BACKLINK_DISCOVERY_PROVIDER_NOT_CONFIGURED",
  );

  const providerError = new BacklinkDiscoveryProviderError(
    "PROVIDER_TRANSIENT_ERROR",
    "Deterministic provider failure",
    true,
  );
  let followingSearches = 0;
  const failingProvider: BacklinkDiscoveryProvider = {
    name: "mock",
    async search() {
      followingSearches += 1;
      throw providerError;
    },
  };
  try {
    await executePreview(failingProvider, nominalRequest);
    throw new Error("Expected provider error");
  } catch (error) {
    assert(error === providerError && followingSearches === 1, "Provider errors must propagate by identity");
  }

  const invalidInputs: readonly [ExecuteAutomationTaskHandlerInput["input"], string][] = [
    [{ ...nominalRequest, version: 2 }, "discovery version must be 1"],
    [{ ...nominalRequest, provider: "unknown" }, "discovery provider is not supported"],
    [{ ...nominalRequest, source: "unknown" }, "discovery source is not supported"],
    [{ ...nominalRequest, searches: [] }, "discovery searches must contain between 1 and 10 entries"],
    [{ ...nominalRequest, searches: [{ query: "   " }] }, "discovery search query must not be empty"],
    [
      { ...nominalRequest, searches: Array.from({ length: 11 }, () => ({ query: "search" })) },
      "discovery searches must contain between 1 and 10 entries",
    ],
    [{ ...nominalRequest, maxResultsPerSearch: 0 }, "maxResultsPerSearch must be an integer between 1 and 10"],
    [{ ...nominalRequest, maxCandidates: 51 }, "maxCandidates must be an integer between 1 and 50"],
    [{ ...nominalRequest, searches: [{ query: "x".repeat(17_000) }] }, "discovery input must not exceed 16384 bytes"],
  ];
  const beforeInvalidCalls = receivedSearches.length;
  for (const [invalidInput, message] of invalidInputs) {
    await assertRejects(() => executePreview(provider, invalidInput), message);
  }
  assert(receivedSearches.length === beforeInvalidCalls, "Invalid input must not call a provider");

  const handlers = createDryRunAutomationTaskHandlers({ providers: { mock: provider } });
  const handlerResult = await handlers.execute(taskInput(nominalRequest));
  assertPreviewOutput(handlerResult.output);
  assert(handlerResult.output.candidates.length === 3, "Registry must use discovery handler");
  const noop = await handlers.execute({ ...taskInput({}), taskKind: "noop" });
  const qualification = await handlers.execute({ ...taskInput({ candidates: ["one"] }), taskKind: "backlinks.qualification.preview" });
  assert(noop.output.kind === "noop" && qualification.output.qualifiedCount === 0, "Other handlers unchanged");
  const emptyHandlers = createDryRunAutomationTaskHandlers({ providers: {} });
  const emptySkipped = await emptyHandlers.execute(taskInput({}));
  assertPreviewOutput(emptySkipped.output);
  assert(emptySkipped.output.skipped === "no_searches", "Empty registry must support skipped input");
  await assertRejects(
    () => emptyHandlers.execute(taskInput(nominalRequest)),
    "BACKLINK_DISCOVERY_PROVIDER_NOT_CONFIGURED",
  );

  assert(JSON.stringify(nominalRequest) === requestBefore, "Request must not mutate");
  assert(JSON.stringify(fixtures) === fixturesBefore, "Fixtures must not mutate");
  assert(first.candidates[0]?.pageTitle === "Airbnb resources", "Previous output must not mutate");
  console.log("PASS — Automation backlink discovery handler smoke");
}

void main();
