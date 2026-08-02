import {
  deduplicateNormalizedBacklinkDiscoveryCandidates,
  normalizeBacklinkDiscoveryCandidate,
  normalizeBacklinkDiscoveryUrl,
  validateBacklinkDiscoveryRequest,
  type BacklinkDiscoveryRequestV1,
} from "../lib/automation";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertThrows(operation: () => void, message: string): void {
  try {
    operation();
  } catch (error) {
    assert(error instanceof Error && error.message.includes(message), message);
    return;
  }

  throw new Error(`Expected error: ${message}`);
}

const input: BacklinkDiscoveryRequestV1 = {
  version: 1,
  source: "manual_dashboard",
  provider: "mock",
  searches: [{ query: "airbnb host resources", countryCode: "US", languageCode: "en" }],
  maxResultsPerSearch: 10,
  maxCandidates: 20,
  suggestedAssetKey: "home-page",
};

function main(): void {
  const inputBefore = JSON.stringify(input);
  validateBacklinkDiscoveryRequest(input);
  assert(JSON.stringify(input) === inputBefore, "Validation must not mutate input");

  assertThrows(
    () => validateBacklinkDiscoveryRequest({ ...input, version: 2 }),
    "discovery version must be 1",
  );
  assertThrows(
    () => validateBacklinkDiscoveryRequest({ ...input, provider: "unknown" }),
    "discovery provider is not supported",
  );
  assertThrows(
    () => validateBacklinkDiscoveryRequest({ ...input, searches: [] }),
    "discovery searches must contain between 1 and 10 entries",
  );
  assertThrows(
    () => validateBacklinkDiscoveryRequest({ ...input, maxCandidates: 51 }),
    "maxCandidates must be an integer between 1 and 50",
  );

  const normalizedUrl = normalizeBacklinkDiscoveryUrl(
    "HTTPS://WWW.Example.COM:443/resources/?utm_source=newsletter&keep=value&gclid=test#section",
  );
  assert(
    normalizedUrl.sourceUrl === "https://www.example.com/resources/?keep=value",
    "URL must remove tracking data, fragment, and default port",
  );
  assert(normalizedUrl.hostname === "www.example.com", "Hostname must be lowercase and preserve www");
  assertThrows(
    () => normalizeBacklinkDiscoveryUrl("https://localhost/resources"),
    "discovery URL hostname must be public",
  );
  assertThrows(
    () => normalizeBacklinkDiscoveryUrl("https://192.168.1.10/resources"),
    "discovery URL hostname must be public",
  );

  const first = normalizeBacklinkDiscoveryCandidate({
    sourceUrl: "https://example.com/resources?utm_source=first",
    pageTitle: "Resources",
    snippet: "First",
    queryIndex: 0,
    rank: 1,
    countryCode: "US",
    languageCode: "en",
    suggestedAssetKey: null,
  });
  const duplicate = normalizeBacklinkDiscoveryCandidate({
    ...first,
    sourceUrl: "https://example.com/resources#duplicate",
    pageTitle: "Ignored duplicate",
  });
  const second = normalizeBacklinkDiscoveryCandidate({
    ...first,
    sourceUrl: "https://example.com/partners",
    pageTitle: "Partners",
    rank: 2,
  });
  const deduplicated = deduplicateNormalizedBacklinkDiscoveryCandidates([first, duplicate, second]);

  assert(deduplicated.length === 2, "Candidates must be deduplicated");
  assert(deduplicated[0] === first && deduplicated[1] === second, "Deduplication must preserve stable order");
  assert(first.hostname === "example.com" && second.hostname === "example.com", "Candidates must be normalized");
  console.log("PASS — Automation backlink discovery normalization smoke");
}

main();
