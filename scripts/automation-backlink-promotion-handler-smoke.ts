import type { Json } from "@/types/database.types";

import {
  DEFAULT_BACKLINK_PROMOTION_POLICY_V1,
  executeBacklinkPromotionPreviewHandler,
  type AutomationTask,
  type BacklinkDiscoveryPreviewOutputV1,
  type BacklinkQualificationPreviewOutputV1,
} from "../lib/automation";

const workspaceId = "00000000-0000-4000-8000-000000000001";
const runId = "00000000-0000-4000-8000-000000000002";
const discoveryId = "00000000-0000-4000-8000-000000000003";
const qualificationId = "00000000-0000-4000-8000-000000000004";
const promotionId = "00000000-0000-4000-8000-000000000005";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function task(overrides: Partial<AutomationTask> = {}): AutomationTask {
  return {
    id: promotionId, workspaceId, runId, dependsOnTaskId: qualificationId, system: "backlinks",
    taskKind: "backlinks.promotion.preview", taskKey: "promotion-preview", status: "running",
    priority: 30, scheduledAt: "2026-08-04T10:00:00.000Z", availableAt: "2026-08-04T10:00:00.000Z",
    claimedAt: "2026-08-04T10:00:00.000Z", startedAt: "2026-08-04T10:00:00.000Z",
    heartbeatAt: "2026-08-04T10:00:00.000Z", leaseExpiresAt: "2026-08-04T10:02:00.000Z",
    completedAt: null, failedAt: null, cancelledAt: null, workerId: "worker-smoke", attemptCount: 1,
    maxAttempts: 3, backoffBaseSeconds: 60, input: { source: "automation_qualification", requestedScope: "preview" },
    output: null, errorCode: null, errorMessage: null, createdAt: "2026-08-04T10:00:00.000Z", updatedAt: "2026-08-04T10:00:00.000Z",
    ...overrides,
  };
}

const discoveryOutput: BacklinkDiscoveryPreviewOutputV1 = {
  version: 1, kind: "backlinks.discovery.preview", dryRun: true, provider: "mock",
  summary: { searchesRequested: 1, resultsReceived: 1, candidatesAccepted: 1, candidatesRejected: 0, truncated: false },
  candidates: [{ candidateKey: "candidate-one", hostname: "example.com", sourceUrl: "https://example.com/resources", pageTitle: "Host resources", snippet: "Hosts", queryIndex: 0, rank: 1, countryCode: "US", languageCode: "en", proposedOpportunityType: null, proposedPageType: null, suggestedAssetKey: "asset-guide", evidenceSummary: "Relevant resources", discoveryScore: 90 }], rejections: [],
};
const qualificationOutput: BacklinkQualificationPreviewOutputV1 = {
  version: 1, kind: "backlinks.qualification.preview", dryRun: true, policyVersion: "backlink-qualification-v1",
  summary: { candidatesEvaluated: 1, qualified: 1, review: 0, rejected: 0 },
  results: [{ candidateKey: "candidate-one", decision: "qualified", qualificationScore: 85, confidence: "medium", reasons: [{ code: "TOPICAL_RELEVANCE_STRONG", impact: 35, evidence: "Host resources" }], flags: [], proposedOpportunityType: "Resource Page", proposedPageType: "resource_page" }],
};
const qualificationTask = task({ id: qualificationId, taskKind: "backlinks.qualification.preview", taskKey: "qualification-preview", status: "completed", dependsOnTaskId: discoveryId, output: qualificationOutput });
const discoveryTask = task({ id: discoveryId, taskKind: "backlinks.discovery.preview", taskKey: "discovery-preview", status: "completed", dependsOnTaskId: null, output: discoveryOutput });

async function main(): Promise<void> {
  const promotionTask = task();
  const before = JSON.stringify({ promotionTask, qualificationTask, discoveryTask, policy: DEFAULT_BACKLINK_PROMOTION_POLICY_V1 });
  const calls: string[] = [];
  const output = await executeBacklinkPromotionPreviewHandler(
    { task: promotionTask },
    { getTaskByIdInRun: async (lookup) => { calls.push(lookup.taskId); return lookup.taskId === qualificationId ? qualificationTask : discoveryTask; }, policy: DEFAULT_BACKLINK_PROMOTION_POLICY_V1 },
  );
  const persistedJson: Json = output;
  assert(persistedJson === output && calls.join(",") === `${qualificationId},${discoveryId}`, "Handler must use ordered durable lookups");
  assert(output.kind === "backlinks.promotion.preview" && output.proposals.length === 1 && output.skippedItems.length === 0, "Handler output must be direct Promotion V1");
  assert(!Object.hasOwn(output, "task") && !Object.hasOwn(output, "workspaceId"), "Output must not expose task metadata");

  const zeroQualification = task({ ...qualificationTask, output: { ...qualificationOutput, summary: { candidatesEvaluated: 0, qualified: 0, review: 0, rejected: 0 }, results: [] } });
  const zero = await executeBacklinkPromotionPreviewHandler({ task: promotionTask }, { getTaskByIdInRun: async (lookup) => lookup.taskId === qualificationId ? zeroQualification : discoveryTask, policy: DEFAULT_BACKLINK_PROMOTION_POLICY_V1 });
  assert(zero.summary.qualificationResults === 0 && zero.proposals.length === 0, "Zero results must remain empty");

  const repositoryError = new Error("repository failure");
  try { await executeBacklinkPromotionPreviewHandler({ task: promotionTask }, { getTaskByIdInRun: async () => { throw repositoryError; }, policy: DEFAULT_BACKLINK_PROMOTION_POLICY_V1 }); } catch (error) { assert(error === repositoryError, "Repository error must propagate by identity"); }
  try { await executeBacklinkPromotionPreviewHandler({ task: task({ status: "queued" }) }, { getTaskByIdInRun: async () => null, policy: DEFAULT_BACKLINK_PROMOTION_POLICY_V1 }); } catch (error) { assert(error instanceof Error && error.name === "BacklinkPromotionDependencyError", "Builder errors must propagate"); }
  try { await executeBacklinkPromotionPreviewHandler({ task: promotionTask }, { getTaskByIdInRun: async (lookup) => lookup.taskId === qualificationId ? qualificationTask : discoveryTask, policy: { ...DEFAULT_BACKLINK_PROMOTION_POLICY_V1, tierAThreshold: 70 } }); } catch (error) { assert(error instanceof Error && error.name === "BacklinkPromotionPolicyError", "Injected policy must be used"); }
  const second = await executeBacklinkPromotionPreviewHandler({ task: promotionTask }, { getTaskByIdInRun: async (lookup) => lookup.taskId === qualificationId ? qualificationTask : discoveryTask, policy: DEFAULT_BACKLINK_PROMOTION_POLICY_V1 });
  assert(JSON.stringify(output) === JSON.stringify(second) && output !== second, "Outputs must be deterministic and independent");
  assert(JSON.stringify({ promotionTask, qualificationTask, discoveryTask, policy: DEFAULT_BACKLINK_PROMOTION_POLICY_V1 }) === before, "Inputs must remain immutable");
  console.log("PASS — Automation backlink promotion handler smoke");
}

void main();
