import { normalizeBacklinkDiscoveryUrl } from "./backlink-discovery-normalization";
import {
  BACKLINK_PROMOTION_MAX_ASSET_KEY_LENGTH,
  BACKLINK_PROMOTION_MAX_EVIDENCE_LENGTH,
  BACKLINK_PROMOTION_MAX_TITLE_LENGTH,
  type BacklinkPromotionProposal,
} from "./backlink-promotion-types";
import {
  BacklinkPromotionApplyServiceError,
  type ApplyBacklinkPromotionProposalDependencies,
  type ApplyBacklinkPromotionProposalInput,
  type ApplyBacklinkPromotionProposalResult,
} from "./backlink-promotion-apply-service-types";

const INPUT_KEYS = ["workspaceId", "actorUserId", "runId", "promotionTaskId", "proposalKey", "assetId"] as const;
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

function fail(code: BacklinkPromotionApplyServiceError["code"]): never {
  throw new BacklinkPromotionApplyServiceError(code);
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

function assertInput(input: ApplyBacklinkPromotionProposalInput): void {
  const value: unknown = input;
  if (!isRecord(value) || !hasExactKeys(value, INPUT_KEYS)) {
    fail("INVALID_PROMOTION_APPLY_INPUT");
  }
  if (
    !isUuid(value.workspaceId) ||
    !isUuid(value.actorUserId) ||
    !isUuid(value.runId) ||
    !isUuid(value.promotionTaskId) ||
    !isUuid(value.assetId) ||
    !isCleanText(value.proposalKey, BACKLINK_PROMOTION_MAX_ASSET_KEY_LENGTH)
  ) {
    fail("INVALID_PROMOTION_APPLY_INPUT");
  }
}

function normalizeHostname(hostname: string): string {
  if (hostname !== hostname.trim() || hostname !== hostname.toLowerCase() || hostname.includes("://")) {
    return fail("PROMOTION_HOSTNAME_INVALID");
  }

  let parsed: URL;
  try {
    parsed = new URL(`https://${hostname}`);
  } catch {
    return fail("PROMOTION_HOSTNAME_INVALID");
  }

  if (parsed.hostname !== hostname || parsed.port.length > 0 || parsed.pathname !== "/" || parsed.search.length > 0) {
    return fail("PROMOTION_HOSTNAME_INVALID");
  }

  try {
    const normalized = normalizeBacklinkDiscoveryUrl(`https://${hostname}`);
    if (normalized.hostname !== hostname) {
      return fail("PROMOTION_HOSTNAME_INVALID");
    }
  } catch {
    return fail("PROMOTION_HOSTNAME_INVALID");
  }

  return hostname;
}

function normalizeTargetUrl(targetPageUrl: string): { sourceUrl: string; hostname: string } {
  try {
    return normalizeBacklinkDiscoveryUrl(targetPageUrl);
  } catch {
    return fail("PROMOTION_TARGET_URL_INVALID");
  }
}

function assertProposal(proposal: BacklinkPromotionProposal, proposalKey: string): void {
  if (
    proposal.proposalKey !== proposalKey ||
    proposal.promotionDecision !== "propose" ||
    !isCleanText(proposal.candidateKey, BACKLINK_PROMOTION_MAX_ASSET_KEY_LENGTH) ||
    !isCleanText(proposal.targetPageTitle, BACKLINK_PROMOTION_MAX_TITLE_LENGTH) ||
    !OPPORTUNITY_TYPES.has(proposal.opportunityType) ||
    !PAGE_TYPES.has(proposal.pageType) ||
    !["Tier A", "Tier B", "Tier C"].includes(proposal.priority) ||
    !Number.isInteger(proposal.qualificationScore) ||
    proposal.qualificationScore < 0 ||
    proposal.qualificationScore > 100 ||
    !["low", "medium"].includes(proposal.qualificationConfidence) ||
    !isCleanText(proposal.evidenceSummary, BACKLINK_PROMOTION_MAX_EVIDENCE_LENGTH)
  ) {
    fail("PROMOTION_PROPOSAL_INVALID");
  }
}

export async function applyBacklinkPromotionProposal(
  dependencies: ApplyBacklinkPromotionProposalDependencies,
  input: ApplyBacklinkPromotionProposalInput,
): Promise<ApplyBacklinkPromotionProposalResult> {
  assertInput(input);
  const readerResult = await dependencies.readPromotionProposal({
    workspaceId: input.workspaceId,
    runId: input.runId,
    promotionTaskId: input.promotionTaskId,
    proposalKey: input.proposalKey,
  });
  const { proposal, promotionPreview } = readerResult;
  assertProposal(proposal, input.proposalKey);
  const hostname = normalizeHostname(proposal.hostname);
  const canonicalTargetUrl = normalizeTargetUrl(proposal.targetPageUrl);
  if (canonicalTargetUrl.hostname !== hostname) {
    fail("PROMOTION_HOSTNAME_URL_MISMATCH");
  }

  const asset = await dependencies.getAssetById({
    workspaceId: input.workspaceId,
    assetId: input.assetId,
  });
  if (asset === null) {
    fail("PROMOTION_ASSET_NOT_FOUND");
  }
  if (asset.workspaceId !== input.workspaceId || asset.id !== input.assetId) {
    fail("PROMOTION_ASSET_WORKSPACE_MISMATCH");
  }
  if (asset.lifecycleStatus !== "active") {
    fail("PROMOTION_ASSET_NOT_ACTIVE");
  }

  const application = await dependencies.applyPromotionTransaction({
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    runId: input.runId,
    promotionTaskId: input.promotionTaskId,
    proposalKey: proposal.proposalKey,
    candidateKey: proposal.candidateKey,
    hostname,
    targetPageUrl: canonicalTargetUrl.sourceUrl,
    targetPageTitle: proposal.targetPageTitle,
    opportunityType: proposal.opportunityType,
    pageType: proposal.pageType,
    priority: proposal.priority,
    evidenceSummary: proposal.evidenceSummary,
    assetId: asset.id,
    qualificationScore: proposal.qualificationScore,
    qualificationConfidence: proposal.qualificationConfidence,
    promotionPolicyVersion: promotionPreview.policyVersion,
  });

  return {
    kind: "applied",
    disposition: application.opportunityDisposition,
    domainDisposition: application.domainDisposition,
    applicationId: application.applicationId,
    domainId: application.domainId,
    opportunityId: application.opportunityId,
    auditWritten: application.auditWritten,
  };
}
