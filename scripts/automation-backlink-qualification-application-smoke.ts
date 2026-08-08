import {
  BACKLINK_QUALIFICATION_INPUT_VERSION,
  BACKLINK_QUALIFICATION_POLICY_VERSION,
} from "../lib/automation";
import { applyBacklinkQualificationFromTask } from "../lib/automation/backlink-qualification-apply-service";
import type { ApplyServiceDependencies, ApplyQualificationInput } from "../lib/automation/backlink-qualification-application-types";
import type { BacklinkQualificationPreviewInputV1, BacklinkQualificationPreviewOutputV1 } from "../lib/automation/backlink-qualification-types";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function candidate(candidateKey: string, hostname: string, path: string) {
  return {
    candidateKey,
    hostname,
    sourceUrl: `https://${hostname}${path}`,
    pageTitle: "Title",
    snippet: "Snippet",
    queryIndex: 0,
    rank: 1,
    countryCode: "US",
    languageCode: "en",
    suggestedAssetKey: null,
    evidenceSummary: "evidence",
    discoveryScore: 100,
  };
}

async function main() {
  const workspaceId = "00000000-0000-4000-8000-000000000001";
  const runId = "00000000-0000-4000-8000-000000000002";
  const taskId = "00000000-0000-4000-8000-000000000003";
  const opportunityId = "00000000-0000-4000-8000-000000000004";

  const qualificationInput: BacklinkQualificationPreviewInputV1 = {
    version: BACKLINK_QUALIFICATION_INPUT_VERSION,
    source: "automation_discovery",
    policyVersion: BACKLINK_QUALIFICATION_POLICY_VERSION,
    queries: [{ query: "test", countryCode: null, languageCode: null }],
    candidates: [candidate("c-1", "example.com", "/resources")],
    maxCandidates: 1,
  };

  const qualificationOutputQualified = {
    version: 1,
    kind: "backlinks.qualification.preview",
    dryRun: true,
    policyVersion: BACKLINK_QUALIFICATION_POLICY_VERSION,
    summary: { candidatesEvaluated: 1, qualified: 1, review: 0, rejected: 0 },
    results: [
      {
        candidateKey: "c-1",
        decision: "qualified",
        qualificationScore: 85,
        confidence: "medium",
        reasons: [],
        flags: [],
        proposedOpportunityType: null,
        proposedPageType: "resource_page",
      },
    ],
  };

  const qualificationOutputReview = { ...qualificationOutputQualified, summary: { candidatesEvaluated: 1, qualified: 0, review: 1, rejected: 0 }, results: [{ ...qualificationOutputQualified.results[0], decision: "review" }] };

  const qualificationOutputRejected = { ...qualificationOutputQualified, summary: { candidatesEvaluated: 1, qualified: 0, review: 0, rejected: 1 }, results: [{ ...qualificationOutputQualified.results[0], decision: "rejected" }] };

  // --- Updated case ---
  let updateCalled = 0;
  const depsQualified: ApplyServiceDependencies<BacklinkQualificationPreviewInputV1, { id: string; target_page_url: string; qualification_status: string }> = {
    readQualificationTask: async () => ({ input: qualificationInput, output: qualificationOutputQualified as BacklinkQualificationPreviewOutputV1 }),
    getOpportunityById: async () => ({ id: opportunityId, target_page_url: "https://example.com/resources", qualification_status: "Needs Review" }),
    updateOpportunityQualificationStatus: async (_workspaceId: string, _opportunityId: string, qualificationStatus: string) => {
      updateCalled++;
      return { id: opportunityId, target_page_url: "https://example.com/resources", qualification_status: qualificationStatus };
    },
  };

  const inputUpdated: ApplyQualificationInput = { workspaceId, actorUserId: "u", runId, taskId, opportunityId };
  const resultUpdated = await applyBacklinkQualificationFromTask(depsQualified, inputUpdated);
  assert(resultUpdated.disposition === "updated", "Expected updated disposition");
  assert(resultUpdated.qualificationStatus === "Qualified", "Expected Qualified status");
  assert(updateCalled === 1, "Expected one update call");

  // --- Existing case ---
  updateCalled = 0;
  const depsExisting: ApplyServiceDependencies<BacklinkQualificationPreviewInputV1, { id: string; target_page_url: string; qualification_status: string }> = {
    readQualificationTask: async () => ({ input: qualificationInput, output: qualificationOutputQualified as BacklinkQualificationPreviewOutputV1 }),
    getOpportunityById: async () => ({ id: opportunityId, target_page_url: "https://example.com/resources", qualification_status: "Qualified" }),
    updateOpportunityQualificationStatus: async () => {
      updateCalled++;
      throw new Error("should not be called");
    },
  };

  const inputExisting: ApplyQualificationInput = { workspaceId, actorUserId: "u", runId, taskId, opportunityId };
  const resultExisting = await applyBacklinkQualificationFromTask(depsExisting, inputExisting);
  assert(resultExisting.disposition === "existing", "Expected existing disposition");
  assert(updateCalled === 0, "Expected zero update calls");

  // --- Not applicable (rejected) ---
  const depsRejected: ApplyServiceDependencies<BacklinkQualificationPreviewInputV1, { id: string; target_page_url: string; qualification_status: string }> = {
    readQualificationTask: async () => ({ input: qualificationInput, output: qualificationOutputRejected as BacklinkQualificationPreviewOutputV1 }),
    getOpportunityById: async () => ({ id: opportunityId, target_page_url: "https://example.com/resources", qualification_status: "Needs Review" }),
    updateOpportunityQualificationStatus: async () => {
      throw new Error("should not be called");
    },
  };

  const inputRejected: ApplyQualificationInput = { workspaceId, actorUserId: "u", runId, taskId, opportunityId };
  const resultNotApplicable = await applyBacklinkQualificationFromTask(depsRejected, inputRejected);
  assert(resultNotApplicable.disposition === "not_applicable", "Expected not_applicable disposition");
  assert(resultNotApplicable.qualificationStatus === null, "Expected null qualificationStatus");

  console.log("PASS — Backlink qualification application smoke");
}

void main();
