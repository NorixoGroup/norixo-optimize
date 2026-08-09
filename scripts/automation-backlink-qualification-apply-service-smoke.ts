import { applyBacklinkQualificationFromTask } from "../lib/automation/backlink-qualification-apply-service";
import type { ApplyServiceDependencies, ApplyQualificationInput } from "../lib/automation/backlink-qualification-application-types";
import type { BacklinkQualificationPreviewInputV1, BacklinkQualificationPreviewOutputV1 } from "../lib/automation/backlink-qualification-types";
import { BacklinkQualificationApplyServiceError } from "../lib/automation/backlink-qualification-application-types";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function assertRejects(operation: () => Promise<unknown>, expectedCode: string) {
  try {
    await operation();
  } catch (error) {
    assert(error instanceof BacklinkQualificationApplyServiceError, "Expected BacklinkQualificationApplyServiceError");
    assert(error.code === expectedCode, `Expected code ${expectedCode} got ${error.code}`);
    return;
  }
  throw new Error(`Expected rejection ${expectedCode}`);
}

async function main() {
  const workspaceId = "00000000-0000-4000-8000-000000000011";
  const runId = "00000000-0000-4000-8000-000000000012";
  const taskId = "00000000-0000-4000-8000-000000000013";
  const opportunityId = "00000000-0000-4000-8000-000000000014";

  const qualificationInput: BacklinkQualificationPreviewInputV1 = {
    version: 1,
    source: "automation_discovery",
    policyVersion: "backlink-qualification-v1",
    queries: [{ query: "q", countryCode: null, languageCode: null }],
    candidates: [],
    maxCandidates: 0,
  };

  const validOutput: BacklinkQualificationPreviewOutputV1 = {
    version: 1,
    kind: "backlinks.qualification.preview",
    dryRun: true,
    policyVersion: "backlink-qualification-v1",
    summary: { candidatesEvaluated: 0, qualified: 0, review: 0, rejected: 0 },
    results: [],
  };

  // 1. task not found
  const depsMissing: ApplyServiceDependencies<BacklinkQualificationPreviewInputV1, { id: string; target_page_url: string; qualification_status: string }> = {
    readQualificationTask: async () => {
      throw new BacklinkQualificationApplyServiceError("QUALIFICATION_PREVIEW_TASK_NOT_FOUND", "not found");
    },
    getOpportunityById: async () => ({ id: opportunityId, target_page_url: "x", qualification_status: "Needs Review" }),
    updateOpportunityQualificationStatus: async () => ({ id: opportunityId, target_page_url: "https://example.com/test-backlink", qualification_status: "Qualified" }),
  };
  const inputMissing: ApplyQualificationInput = { workspaceId, actorUserId: "u", runId, taskId, opportunityId };
  await assertRejects(() => applyBacklinkQualificationFromTask(depsMissing, inputMissing), "QUALIFICATION_PREVIEW_TASK_NOT_FOUND");

  // 2. task not completed
  const depsNotCompleted: ApplyServiceDependencies<BacklinkQualificationPreviewInputV1, { id: string; target_page_url: string; qualification_status: string }> = {
    readQualificationTask: async () => {
      throw new BacklinkQualificationApplyServiceError("QUALIFICATION_PREVIEW_TASK_NOT_COMPLETED", "not completed");
    },
    getOpportunityById: async () => ({ id: opportunityId, target_page_url: "x", qualification_status: "Needs Review" }),
    updateOpportunityQualificationStatus: async () => ({ id: opportunityId, target_page_url: "https://example.com/test-backlink", qualification_status: "Qualified" }),
  };
  const inputNotCompleted: ApplyQualificationInput = { workspaceId, actorUserId: "u", runId, taskId, opportunityId };
  await assertRejects(() => applyBacklinkQualificationFromTask(depsNotCompleted, inputNotCompleted), "QUALIFICATION_PREVIEW_TASK_NOT_COMPLETED");

  // 3. output invalid
  const depsInvalidOutput: ApplyServiceDependencies<BacklinkQualificationPreviewInputV1, { id: string; target_page_url: string; qualification_status: string }> = {
    // readQualificationTask will return an invalid output shape to simulate validation failure
    readQualificationTask: async () => ({ input: qualificationInput, output: { unexpected: true } }),
    getOpportunityById: async () => ({ id: opportunityId, target_page_url: "x", qualification_status: "Needs Review" }),
    updateOpportunityQualificationStatus: async () => ({ id: opportunityId, target_page_url: "https://example.com/test-backlink", qualification_status: "Qualified" }),
  };
  const inputInvalidOutput: ApplyQualificationInput = { workspaceId, actorUserId: "u", runId, taskId, opportunityId };
  await assertRejects(() => applyBacklinkQualificationFromTask(depsInvalidOutput, inputInvalidOutput), "QUALIFICATION_PREVIEW_OUTPUT_INVALID");

  // 4. opportunity mismatch (no candidate match)
  const depsMismatch: ApplyServiceDependencies<BacklinkQualificationPreviewInputV1, { id: string; target_page_url: string; qualification_status: string }> = {
    readQualificationTask: async () => ({ input: qualificationInput, output: validOutput }),
    getOpportunityById: async () => ({ id: opportunityId, target_page_url: "https://no-match.example/", qualification_status: "Needs Review" }),
    updateOpportunityQualificationStatus: async () => ({ id: opportunityId, target_page_url: "https://example.com/test-backlink", qualification_status: "Qualified" }),
  };
  const inputMismatch: ApplyQualificationInput = { workspaceId, actorUserId: "u", runId, taskId, opportunityId };
  await assertRejects(() => applyBacklinkQualificationFromTask(depsMismatch, inputMismatch), "QUALIFICATION_PREVIEW_OPPORTUNITY_MISMATCH");

  const candidate = { candidateKey: "discovery:stable", hostname: "example.com", sourceUrl: "https://example.com/discovery", pageTitle: "Discovery", snippet: null, queryIndex: 0, rank: 1, countryCode: null, languageCode: null, suggestedAssetKey: null, evidenceSummary: "evidence", discoveryScore: 100 } as const;
  const stableInput: BacklinkQualificationPreviewInputV1 = { ...qualificationInput, candidates: [candidate], maxCandidates: 1 };
  const stableOutput: BacklinkQualificationPreviewOutputV1 = { ...validOutput, summary: { candidatesEvaluated: 1, qualified: 1, review: 0, rejected: 0 }, results: [{ candidateKey: candidate.candidateKey, decision: "qualified", qualificationScore: 90, confidence: "medium", reasons: [], flags: [], proposedOpportunityType: "Resource Page", proposedPageType: "resource_page" }] };
  const mappedOpportunityId = "00000000-0000-4000-8000-000000000015";
  const otherOpportunityId = "00000000-0000-4000-8000-000000000016";
  let stableUpdates = 0;
  const stableDeps: ApplyServiceDependencies<BacklinkQualificationPreviewInputV1, { id: string; target_page_url: string; qualification_status: string }> = {
    readQualificationTask: async () => ({ input: stableInput, output: stableOutput, discoveryTaskId: "00000000-0000-4000-8000-000000000017" }),
    listDiscoveryIntakeApplicationsForCandidate: async (value) => {
      assert(value.workspaceId === workspaceId && value.candidateKey === candidate.candidateKey, "Mapping lookup must be workspace/candidate scoped.");
      return [{ opportunityId: mappedOpportunityId }];
    },
    getOpportunityById: async (_workspaceId, id) => ({ id, target_page_url: "https://different.example/not-a-legacy-match", qualification_status: "Needs Review" }),
    updateOpportunityQualificationStatus: async (_workspaceId, id) => { stableUpdates += 1; return { id, target_page_url: "https://different.example/not-a-legacy-match", qualification_status: "Qualified" }; },
  };
  const stableResult = await applyBacklinkQualificationFromTask(stableDeps, { ...inputMissing, opportunityId: mappedOpportunityId });
  assert(stableResult.disposition === "updated" && stableUpdates === 1, "Stable mapping must apply without URL matching.");
  await assertRejects(() => applyBacklinkQualificationFromTask(stableDeps, { ...inputMissing, opportunityId: otherOpportunityId }), "QUALIFICATION_INTAKE_MAPPING_MISMATCH");
  assert(stableUpdates === 1, "Contradictory mapping must not fall back or update.");

  const legacyDeps: ApplyServiceDependencies<BacklinkQualificationPreviewInputV1, { id: string; target_page_url: string; qualification_status: string }> = {
    readQualificationTask: async () => ({ input: stableInput, output: stableOutput, discoveryTaskId: "00000000-0000-4000-8000-000000000017" }),
    listDiscoveryIntakeApplicationsForCandidate: async () => [],
    getOpportunityById: async (_workspaceId, id) => ({ id, target_page_url: candidate.sourceUrl, qualification_status: "Qualified" }),
    updateOpportunityQualificationStatus: async (_workspaceId, id) => ({ id, target_page_url: candidate.sourceUrl, qualification_status: "Qualified" }),
  };
  const legacyResult = await applyBacklinkQualificationFromTask(legacyDeps, { ...inputMissing, opportunityId: mappedOpportunityId });
  assert(legacyResult.disposition === "existing", "Mapping absence must preserve legacy URL fallback and idempotence.");
  const legacyMismatch = { ...legacyDeps, getOpportunityById: async (_workspaceId: string, id: string) => ({ id, target_page_url: "https://other.example/", qualification_status: "Needs Review" }) };
  await assertRejects(() => applyBacklinkQualificationFromTask(legacyMismatch, { ...inputMissing, opportunityId: mappedOpportunityId }), "QUALIFICATION_PREVIEW_OPPORTUNITY_MISMATCH");
  const crossWorkspace = { ...legacyMismatch, listDiscoveryIntakeApplicationsForCandidate: async (value: { workspaceId: string }) => { assert(value.workspaceId === workspaceId, "Cross-workspace mappings must not be queried."); return []; } };
  await assertRejects(() => applyBacklinkQualificationFromTask(crossWorkspace, { ...inputMissing, opportunityId: otherOpportunityId }), "QUALIFICATION_PREVIEW_OPPORTUNITY_MISMATCH");

  console.log("PASS — Backlink qualification apply service smoke");
}

void main();
