import {
  BACKLINK_PROMOTION_MAX_ASSET_KEY_LENGTH,
  BACKLINK_PROMOTION_MAX_EVIDENCE_LENGTH,
  BACKLINK_PROMOTION_MAX_TITLE_LENGTH,
  type BacklinkPromotionPreviewOutputV1,
  type BacklinkPromotionProposal,
} from "./backlink-promotion-types";
import { validateBacklinkPromotionPreviewOutput } from "./backlink-promotion-validation";
import {
  BacklinkPromotionProposalReaderError,
  type ReadBacklinkPromotionProposalDependencies,
  type ReadBacklinkPromotionProposalInput,
  type ReadBacklinkPromotionProposalResult,
} from "./backlink-promotion-proposal-reader-types";

const INPUT_KEYS = ["workspaceId", "runId", "promotionTaskId", "proposalKey"] as const;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OPPORTUNITY_TYPES = new Set([
  "Resource Page",
  "Guest Post",
  "Tools List",
  "Comparison",
  "Directory",
  "Partnership",
  "Editorial Mention",
  "Other",
]);
const PAGE_TYPES = new Set([
  "Resource Page",
  "Guide",
  "Best Tools List",
  "Directory",
  "Blog Article",
  "Knowledge Base",
]);

function fail(code: BacklinkPromotionProposalReaderError["code"]): never {
  throw new BacklinkPromotionProposalReaderError(code);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actualKeys = Object.keys(value);
  return actualKeys.length === keys.length && actualKeys.every((key) => keys.includes(key));
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isCleanText(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.length > 0 && value === value.trim() && value.length <= maximum;
}

function isHttpUrl(value: unknown): boolean {
  if (typeof value !== "string" || value.length === 0 || value !== value.trim()) {
    return false;
  }

  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && url.hostname.length > 0;
  } catch {
    return false;
  }
}

function assertInput(input: ReadBacklinkPromotionProposalInput): void {
  const value: unknown = input;
  if (!isRecord(value) || !hasExactKeys(value, INPUT_KEYS)) {
    fail("INVALID_PROMOTION_PROPOSAL_READ_INPUT");
  }
  if (
    !isUuid(value.workspaceId) ||
    !isUuid(value.runId) ||
    !isUuid(value.promotionTaskId) ||
    !isCleanText(value.proposalKey, BACKLINK_PROMOTION_MAX_ASSET_KEY_LENGTH)
  ) {
    fail("INVALID_PROMOTION_PROPOSAL_READ_INPUT");
  }
}

function assertTask(
  input: ReadBacklinkPromotionProposalInput,
  task: Awaited<ReturnType<ReadBacklinkPromotionProposalDependencies["getTaskByIdInRun"]>>,
): asserts task is NonNullable<typeof task> {
  if (task === null) {
    fail("PROMOTION_TASK_NOT_FOUND");
  }
  if (task.id !== input.promotionTaskId || task.workspaceId !== input.workspaceId || task.runId !== input.runId) {
    fail("PROMOTION_TASK_SCOPE_MISMATCH");
  }
  if (task.taskKind !== "backlinks.promotion.preview") {
    fail("PROMOTION_TASK_KIND_INVALID");
  }
  if (task.status !== "completed") {
    fail("PROMOTION_TASK_NOT_COMPLETED");
  }
  if (task.output === null) {
    fail("PROMOTION_OUTPUT_INVALID");
  }
}

function assertProposal(proposal: BacklinkPromotionProposal, proposalKey: string): void {
  if (
    proposal.promotionDecision !== "propose" ||
    proposal.proposalKey !== proposalKey ||
    !isCleanText(proposal.candidateKey, BACKLINK_PROMOTION_MAX_ASSET_KEY_LENGTH) ||
    !isCleanText(proposal.hostname, 253) ||
    !isHttpUrl(proposal.targetPageUrl) ||
    !isCleanText(proposal.targetPageTitle, BACKLINK_PROMOTION_MAX_TITLE_LENGTH) ||
    !OPPORTUNITY_TYPES.has(proposal.opportunityType) ||
    !PAGE_TYPES.has(proposal.pageType) ||
    !["Tier A", "Tier B", "Tier C"].includes(proposal.priority) ||
    !Number.isInteger(proposal.qualificationScore) ||
    proposal.qualificationScore < 0 ||
    proposal.qualificationScore > 100 ||
    !["low", "medium"].includes(proposal.qualificationConfidence) ||
    !isCleanText(proposal.evidenceSummary, BACKLINK_PROMOTION_MAX_EVIDENCE_LENGTH) ||
    (proposal.suggestedAssetKey !== null &&
      !isCleanText(proposal.suggestedAssetKey, BACKLINK_PROMOTION_MAX_ASSET_KEY_LENGTH))
  ) {
    fail("PROMOTION_PROPOSAL_INVALID");
  }
}

function findProposal(
  preview: BacklinkPromotionPreviewOutputV1,
  proposalKey: string,
): BacklinkPromotionProposal {
  const matches = preview.proposals.filter((proposal) => proposal.proposalKey === proposalKey);
  if (matches.length === 0) {
    fail("PROMOTION_PROPOSAL_NOT_FOUND");
  }
  if (matches.length > 1) {
    fail("PROMOTION_PROPOSAL_MULTIPLE_MATCHES");
  }
  const proposal = matches[0];
  if (proposal === undefined) {
    fail("PROMOTION_PROPOSAL_NOT_FOUND");
  }
  assertProposal(proposal, proposalKey);
  return proposal;
}

export async function readBacklinkPromotionProposal(
  dependencies: ReadBacklinkPromotionProposalDependencies,
  input: ReadBacklinkPromotionProposalInput,
): Promise<ReadBacklinkPromotionProposalResult> {
  assertInput(input);
  const promotionTask = await dependencies.getTaskByIdInRun({
    workspaceId: input.workspaceId,
    runId: input.runId,
    taskId: input.promotionTaskId,
  });
  assertTask(input, promotionTask);

  const promotionPreview = validateBacklinkPromotionPreviewOutput(promotionTask.output);
  const proposal = findProposal(promotionPreview, input.proposalKey);

  return { promotionTask, promotionPreview, proposal };
}
