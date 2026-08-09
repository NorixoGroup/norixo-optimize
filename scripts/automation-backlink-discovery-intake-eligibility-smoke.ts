import {
  executeBacklinkDiscoveryPreview,
  type BacklinkDiscoveryPreviewOutputV1,
  type BacklinkDiscoveryProvider,
  type ExecuteAutomationTaskHandlerInput,
} from "../lib/automation";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertPreview(value: unknown): asserts value is BacklinkDiscoveryPreviewOutputV1 {
  assert(isRecord(value) && value.kind === "backlinks.discovery.preview" && Array.isArray(value.candidates), "Expected discovery preview output.");
}

function task(provider: "mock" | "brave_search", query: string): ExecuteAutomationTaskHandlerInput {
  return {
    workspaceId: "00000000-0000-4000-8000-000000000001",
    runId: "00000000-0000-4000-8000-000000000002",
    taskId: "00000000-0000-4000-8000-000000000003",
    taskKind: "backlinks.discovery.preview",
    attemptedAt: "2026-08-09T10:00:00.000Z",
    input: { version: 1, source: "manual_dashboard", provider, searches: [{ query }], maxResultsPerSearch: 10, maxCandidates: 10 },
  };
}

function provider(name: "mock" | "brave_search", item: { url: string; title: string | null; snippet: string | null }): BacklinkDiscoveryProvider {
  return {
    name,
    async search(input) {
      return { query: input.query, queryIndex: input.queryIndex, countryCode: input.countryCode, languageCode: input.languageCode, items: [{ ...item, rank: 1 }] };
    },
  };
}

async function candidate(name: "mock" | "brave_search", query: string, item: { url: string; title: string | null; snippet: string | null }) {
  const result = await executeBacklinkDiscoveryPreview({ providers: { [name]: provider(name, item) } }, task(name, query));
  const output = result.output;
  assertPreview(output);
  const value = output.candidates[0];
  assert(value !== undefined, "Expected one candidate.");
  return value;
}

async function main(): Promise<void> {
  const resource = await candidate("mock", "airbnb host resources", { url: "https://example.com/resources", title: "Host resources", snippet: "Airbnb links" });
  assert(resource.intakeEligibility?.status === "eligible" && resource.intakeEligibility.opportunityType === "Resource Page" && resource.intakeEligibility.pageType === "Resource Page", "Resource mapping.");
  const directory = await candidate("mock", "host directory", { url: "https://example.com/directory", title: "Host directory", snippet: null });
  assert(directory.intakeEligibility?.status === "eligible" && directory.intakeEligibility.opportunityType === "Directory" && directory.intakeEligibility.pageType === "Directory", "Directory mapping.");
  const guest = await candidate("mock", "guest post hosts", { url: "https://example.com/write-for-us", title: "Write for us", snippet: "Guest post" });
  assert(guest.intakeEligibility?.status === "eligible" && guest.intakeEligibility.opportunityType === "Guest Post" && guest.intakeEligibility.pageType === "Blog Article", "Guest post mapping.");
  const missingTitle = await candidate("mock", "airbnb host resources", { url: "https://example.com/resources", title: null, snippet: "Resources" });
  assert(missingTitle.intakeEligibility?.status === "review_only" && missingTitle.intakeEligibility.reason === "missing_page_title", "Missing title must be review-only.");
  const unknown = await candidate("mock", "unrelated phrase", { url: "https://example.com/page", title: "A page", snippet: null });
  assert(unknown.intakeEligibility?.status === "review_only" && unknown.intakeEligibility.reason === "unsupported_opportunity_type", "Unclassifiable candidate must be review-only.");
  const brave = await candidate("brave_search", "airbnb host resources", { url: "HTTPS://EXAMPLE.COM:443/resources?utm_source=x#top", title: "Resources", snippet: null });
  assert(brave.sourceUrl === "https://example.com/resources" && brave.intakeEligibility?.status === "eligible", "Brave-shaped candidate must normalize and classify.");
  console.log("PASS — Automation backlink discovery intake eligibility smoke");
}

void main();
