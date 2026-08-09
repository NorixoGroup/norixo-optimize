import {
  DiscoveryOpportunityIntakeError,
  intakeBacklinkDiscoveryOpportunity,
  type DiscoveryOpportunityIntakeDependencies,
} from "../lib/automation/backlink-discovery-opportunity-intake-service";
import type { BacklinkDiscoveryPreviewCandidate } from "../lib/automation/backlink-discovery-handler-types";

const input = { workspaceId: "00000000-0000-4000-8000-000000000001", requestedBy: "00000000-0000-4000-8000-000000000002", runId: "00000000-0000-4000-8000-000000000003", taskId: "00000000-0000-4000-8000-000000000004", candidateKey: "discovery:one", assetId: "00000000-0000-4000-8000-000000000005" };
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function candidate(eligibility: BacklinkDiscoveryPreviewCandidate["intakeEligibility"], title = " Resource page "): BacklinkDiscoveryPreviewCandidate {
  return { candidateKey: input.candidateKey, hostname: "example.com", sourceUrl: "HTTPS://EXAMPLE.COM:443/resources?utm_source=x#top", pageTitle: title, snippet: null, queryIndex: 0, rank: 1, countryCode: null, languageCode: null, proposedOpportunityType: null, proposedPageType: null, intakeEligibility: eligibility, suggestedAssetKey: null, evidenceSummary: "Discovery evidence", discoveryScore: 100 };
}
function dependencies(value: BacklinkDiscoveryPreviewCandidate, lifecycleStatus = "active", existing = false, mappingOpportunityId = "opportunity") {
  const calls = { asset: 0, resolver: 0, mapping: 0 };
  const deps: DiscoveryOpportunityIntakeDependencies = {
    async readCandidate() { return { candidate: value }; },
    async getAssetById() { calls.asset += 1; return { id: input.assetId, workspaceId: input.workspaceId, lifecycleStatus }; },
    async resolveDomainOpportunity(resolverInput) { calls.resolver += 1; assert(resolverInput.hostname === "example.com" && resolverInput.targetPageUrl === "https://example.com/resources" && resolverInput.targetPageTitle === "Resource page" && resolverInput.opportunityType === "Resource Page" && resolverInput.pageType === "Resource Page" && resolverInput.evidenceSummary === "Discovery evidence", "Exact resolver mapping."); return { domainId: "domain", domainKey: "BK-0001", domainDisposition: existing ? "existing" as const : "created" as const, opportunityId: "opportunity", opportunityKey: "OP-000001", opportunityDisposition: existing ? "existing" as const : "created" as const, qualificationStatus: existing ? "Qualified" : "Needs Review" }; },
    async recordIntakeApplication(mappingInput) { calls.mapping += 1; assert(mappingInput.workspaceId === input.workspaceId && mappingInput.discoveryTaskId === input.taskId && mappingInput.candidateKey === input.candidateKey && mappingInput.assetId === input.assetId && mappingInput.opportunityId === "opportunity", "Exact intake mapping."); return { applicationId: "application", opportunityId: mappingOpportunityId }; },
  };
  return { deps, calls };
}
async function expectError(operation: () => Promise<unknown>, code: string): Promise<void> { try { await operation(); } catch (error) { assert(error instanceof DiscoveryOpportunityIntakeError && error.code === code, `Expected ${code}.`); return; } throw new Error(`Expected ${code}.`); }
async function main(): Promise<void> {
  const eligible = { status: "eligible", opportunityType: "Resource Page", pageType: "Resource Page" } as const;
  const created = dependencies(candidate(eligible));
  const createdResult = await intakeBacklinkDiscoveryOpportunity(created.deps, input);
  assert(created.calls.asset === 1 && created.calls.resolver === 1 && created.calls.mapping === 1 && createdResult.domainDisposition === "created" && createdResult.qualificationStatus === "Needs Review", "Eligible created intake.");
  const historical = dependencies(candidate(undefined));
  await expectError(() => intakeBacklinkDiscoveryOpportunity(historical.deps, input), "DISCOVERY_INTAKE_ELIGIBILITY_MISSING");
  assert(historical.calls.asset === 0 && historical.calls.resolver === 0 && historical.calls.mapping === 0, "Historical output must stop before mutations.");
  const review = dependencies(candidate({ status: "review_only", reason: "missing_page_title" }));
  await expectError(() => intakeBacklinkDiscoveryOpportunity(review.deps, input), "DISCOVERY_INTAKE_CANDIDATE_NOT_ELIGIBLE");
  assert(review.calls.asset === 0 && review.calls.resolver === 0 && review.calls.mapping === 0, "Review-only must stop before mutations.");
  const invalidTitle = dependencies(candidate(eligible, " "));
  await expectError(() => intakeBacklinkDiscoveryOpportunity(invalidTitle.deps, input), "DISCOVERY_INTAKE_CANDIDATE_INVALID");
  const inactive = dependencies(candidate(eligible), "paused");
  await expectError(() => intakeBacklinkDiscoveryOpportunity(inactive.deps, input), "DISCOVERY_INTAKE_ASSET_NOT_ACTIVE");
  assert(inactive.calls.resolver === 0 && inactive.calls.mapping === 0, "Inactive asset must not resolve or map.");
  const existing = dependencies(candidate(eligible), "active", true);
  const existingResult = await intakeBacklinkDiscoveryOpportunity(existing.deps, input);
  assert(existingResult.domainDisposition === "existing" && existingResult.opportunityDisposition === "existing" && existingResult.qualificationStatus === "Qualified", "Existing status must be preserved.");
  const conflict = dependencies(candidate(eligible), "active", false, "other-opportunity");
  await expectError(() => intakeBacklinkDiscoveryOpportunity(conflict.deps, input), "DISCOVERY_INTAKE_MAPPING_CONFLICT");
  console.log("PASS — Automation backlink discovery opportunity intake service smoke");
}
void main();
