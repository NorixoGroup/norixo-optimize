import { applyBacklinkQualificationBatch } from "../lib/automation/backlink-qualification-batch-apply-service";
import { BacklinkQualificationBatchApplyServiceError } from "../lib/automation/backlink-qualification-batch-application-types";
import { BacklinkQualificationApplyServiceError } from "../lib/automation/backlink-qualification-application-types";
import type { ApplyQualificationBatchDependencies } from "../lib/automation/backlink-qualification-batch-application-types";
import type { BacklinkQualificationPreviewInputV1, BacklinkQualificationPreviewOutputV1 } from "../lib/automation/backlink-qualification-types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function assertRejects(operation: () => Promise<unknown>, code: string): Promise<void> {
  try {
    await operation();
  } catch (error) {
    assert(error instanceof BacklinkQualificationBatchApplyServiceError || error instanceof BacklinkQualificationApplyServiceError, "Expected qualification error.");
    assert(error.code === code, `Expected ${code}, got ${error.code}.`);
    return;
  }
  throw new Error(`Expected ${code}.`);
}

function id(value: number): string {
  return `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
}

async function main(): Promise<void> {
  const workspaceId = id(1);
  const runId = id(2);
  const taskId = id(3);
  const discoveryTaskId = id(4);
  const opportunityIds = [id(10), id(11), id(12), id(13), id(14), id(15), id(16)];
  const [updatedId, existingId, rejectedId, blockedId, notSuitableId, mismatchId, missingId] = opportunityIds;
  const candidateKeys = ["updated", "existing", "rejected", "blocked", "not-suitable", "mismatch"];
  const input: BacklinkQualificationPreviewInputV1 = {
    version: 1,
    source: "automation_discovery",
    policyVersion: "backlink-qualification-v1",
    queries: [{ query: "q", countryCode: null, languageCode: null }],
    candidates: candidateKeys.map((candidateKey) => ({ candidateKey, hostname: "example.com", sourceUrl: `https://example.com/${candidateKey}`, pageTitle: null, snippet: null, queryIndex: 0, rank: 1, countryCode: null, languageCode: null, suggestedAssetKey: null, evidenceSummary: "evidence", discoveryScore: 90 })),
    maxCandidates: candidateKeys.length,
  };
  const output: BacklinkQualificationPreviewOutputV1 = {
    version: 1,
    kind: "backlinks.qualification.preview",
    dryRun: true,
    policyVersion: "backlink-qualification-v1",
    summary: { candidatesEvaluated: candidateKeys.length, qualified: 5, review: 0, rejected: 1 },
    results: candidateKeys.map((candidateKey) => ({ candidateKey, decision: candidateKey === "rejected" ? "rejected" : "qualified", qualificationScore: 90, confidence: "medium", reasons: [], flags: [], proposedOpportunityType: null, proposedPageType: "resource_page" })),
  };
  const statuses = new Map<string, string>([
    [updatedId, "Needs Review"],
    [existingId, "Qualified"],
    [rejectedId, "Needs Review"],
    [blockedId, "Blocked"],
    [notSuitableId, "Not Suitable"],
    [mismatchId, "Needs Review"],
  ]);
  let mappingReads = 0;
  const deps: ApplyQualificationBatchDependencies = {
    readQualificationTask: async () => ({ input, output, discoveryTaskId }),
    listDiscoveryIntakeApplications: async () => {
      mappingReads += 1;
      return [
        { candidateKey: "updated", opportunityId: updatedId },
        { candidateKey: "existing", opportunityId: existingId },
        { candidateKey: "rejected", opportunityId: rejectedId },
        { candidateKey: "blocked", opportunityId: blockedId },
        { candidateKey: "not-suitable", opportunityId: notSuitableId },
      ];
    },
    getOpportunityById: async (_workspaceId, opportunityId) => {
      const status = statuses.get(opportunityId);
      if (status === undefined) throw new BacklinkQualificationApplyServiceError("QUALIFICATION_OPPORTUNITY_NOT_FOUND", "not found");
      return { id: opportunityId, target_page_url: `https://example.com/${opportunityId}`, qualification_status: status };
    },
    updateOpportunityQualificationStatus: async (_workspaceId, opportunityId, qualificationStatus) => {
      statuses.set(opportunityId, qualificationStatus);
      return { id: opportunityId, target_page_url: `https://example.com/${opportunityId}`, qualification_status: qualificationStatus };
    },
  };
  const batchInput = { workspaceId, actorUserId: id(5), runId, taskId, opportunityIds };
  const first = await applyBacklinkQualificationBatch(deps, batchInput);
  assert(first.total === 7 && first.updated === 1 && first.existing === 1 && first.notApplicable === 3 && first.failed === 2, "Expected mixed best-effort result.");
  assert(mappingReads === 1, "Mappings must be loaded exactly once.");
  assert(first.items.find((item) => item.opportunityId === blockedId)?.reasonCode === "OPPORTUNITY_STATUS_PROTECTED", "Blocked must be protected.");
  assert(first.items.find((item) => item.opportunityId === notSuitableId)?.reasonCode === "OPPORTUNITY_STATUS_PROTECTED", "Not Suitable must be protected.");
  assert(first.items.find((item) => item.opportunityId === rejectedId)?.reasonCode === "REJECTED_DECISION", "Rejected must remain distinct.");
  assert(first.items.find((item) => item.opportunityId === mismatchId)?.disposition === "failed", "Mapping mismatch must fail locally.");
  assert(first.items.find((item) => item.opportunityId === missingId)?.error?.code === "QUALIFICATION_OPPORTUNITY_NOT_FOUND", "Missing opportunity must fail locally.");

  const retry = await applyBacklinkQualificationBatch(deps, batchInput);
  assert(retry.updated === 0 && retry.existing === 2 && retry.failed === 2, "Retry must preserve idempotence and retry failures.");

  await assertRejects(() => applyBacklinkQualificationBatch(deps, { ...batchInput, opportunityIds: [] }), "QUALIFICATION_BATCH_INPUT_INVALID");
  await assertRejects(() => applyBacklinkQualificationBatch(deps, { ...batchInput, opportunityIds: [updatedId, updatedId] }), "QUALIFICATION_BATCH_DUPLICATE_OPPORTUNITY_ID");
  await assertRejects(() => applyBacklinkQualificationBatch(deps, { ...batchInput, opportunityIds: Array.from({ length: 51 }, (_, index) => id(index + 100)) }), "QUALIFICATION_BATCH_TOO_MANY_OPPORTUNITIES");

  let itemReads = 0;
  const invalidTaskDeps: ApplyQualificationBatchDependencies = {
    ...deps,
    readQualificationTask: async () => { throw new BacklinkQualificationApplyServiceError("QUALIFICATION_PREVIEW_TASK_NOT_COMPLETED", "not completed"); },
    getOpportunityById: async () => {
      itemReads += 1;
      return { id: updatedId, target_page_url: "https://example.com/updated", qualification_status: "Needs Review" };
    },
  };
  await assertRejects(() => applyBacklinkQualificationBatch(invalidTaskDeps, batchInput), "QUALIFICATION_PREVIEW_TASK_NOT_COMPLETED");
  assert(itemReads === 0, "Invalid task must stop before item processing.");

  console.log("PASS — Backlink qualification batch apply service smoke");
}

void main();
