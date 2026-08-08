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
    assert((error as any).code === expectedCode, `Expected code ${expectedCode} got ${(error as any).code}`);
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

  console.log("PASS — Backlink qualification apply service smoke");
}

void main();
