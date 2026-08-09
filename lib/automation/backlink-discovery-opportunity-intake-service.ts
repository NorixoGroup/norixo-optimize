import { normalizeBacklinkDiscoveryUrl } from "./backlink-discovery-normalization";
import type { BacklinkDiscoveryPreviewCandidate } from "./backlink-discovery-handler-types";
import type { ResolveBacklinkDomainOpportunityResult } from "@/lib/backlinks/repositories/domainOpportunityResolutionRepository";

export type DiscoveryOpportunityIntakeInput = {
  workspaceId: string;
  requestedBy: string;
  runId: string;
  taskId: string;
  candidateKey: string;
  assetId: string;
};

export type DiscoveryOpportunityIntakeResult = {
  domainId: string;
  domainKey: string;
  domainDisposition: "created" | "existing";
  opportunityId: string;
  opportunityKey: string;
  opportunityDisposition: "created" | "existing";
  qualificationStatus: string;
};

export type DiscoveryOpportunityIntakeDependencies = {
  readCandidate: (input: {
    workspaceId: string;
    runId: string;
    taskId: string;
    candidateKey: string;
  }) => Promise<{ candidate: BacklinkDiscoveryPreviewCandidate }>;
  getAssetById: (input: {
    workspaceId: string;
    assetId: string;
  }) => Promise<{ id: string; workspaceId: string; lifecycleStatus: string } | null>;
  resolveDomainOpportunity: (input: {
    workspaceId: string;
    hostname: string;
    assetId: string;
    targetPageUrl: string;
    targetPageTitle: string;
    opportunityType: string;
    pageType: string;
    evidenceSummary: string;
  }) => Promise<ResolveBacklinkDomainOpportunityResult>;
};

export type DiscoveryOpportunityIntakeErrorCode =
  | "DISCOVERY_INTAKE_ELIGIBILITY_MISSING"
  | "DISCOVERY_INTAKE_CANDIDATE_NOT_ELIGIBLE"
  | "DISCOVERY_INTAKE_CANDIDATE_INVALID"
  | "DISCOVERY_INTAKE_ASSET_NOT_FOUND"
  | "DISCOVERY_INTAKE_ASSET_NOT_ACTIVE"
  | "DISCOVERY_INTAKE_URL_INVALID";

export class DiscoveryOpportunityIntakeError extends Error {
  readonly code: DiscoveryOpportunityIntakeErrorCode;

  constructor(code: DiscoveryOpportunityIntakeErrorCode) {
    super("The discovery candidate could not be intaken as a backlink opportunity.");
    this.name = "DiscoveryOpportunityIntakeError";
    this.code = code;
  }
}

function fail(code: DiscoveryOpportunityIntakeErrorCode): never {
  throw new DiscoveryOpportunityIntakeError(code);
}

function mapResult(result: ResolveBacklinkDomainOpportunityResult): DiscoveryOpportunityIntakeResult {
  return {
    domainId: result.domainId,
    domainKey: result.domainKey,
    domainDisposition: result.domainDisposition,
    opportunityId: result.opportunityId,
    opportunityKey: result.opportunityKey,
    opportunityDisposition: result.opportunityDisposition,
    qualificationStatus: result.qualificationStatus,
  };
}

export async function intakeBacklinkDiscoveryOpportunity(
  dependencies: DiscoveryOpportunityIntakeDependencies,
  input: DiscoveryOpportunityIntakeInput,
): Promise<DiscoveryOpportunityIntakeResult> {
  void input.requestedBy;
  const { candidate } = await dependencies.readCandidate({
    workspaceId: input.workspaceId,
    runId: input.runId,
    taskId: input.taskId,
    candidateKey: input.candidateKey,
  });
  if (candidate.intakeEligibility === undefined) {
    return fail("DISCOVERY_INTAKE_ELIGIBILITY_MISSING");
  }
  if (candidate.intakeEligibility.status === "review_only") {
    return fail("DISCOVERY_INTAKE_CANDIDATE_NOT_ELIGIBLE");
  }
  if (typeof candidate.pageTitle !== "string" || candidate.pageTitle.trim().length === 0) {
    return fail("DISCOVERY_INTAKE_CANDIDATE_INVALID");
  }

  let normalized;
  try {
    normalized = normalizeBacklinkDiscoveryUrl(candidate.sourceUrl);
  } catch {
    return fail("DISCOVERY_INTAKE_URL_INVALID");
  }
  const asset = await dependencies.getAssetById({ workspaceId: input.workspaceId, assetId: input.assetId });
  if (asset === null || asset.id !== input.assetId || asset.workspaceId !== input.workspaceId) {
    return fail("DISCOVERY_INTAKE_ASSET_NOT_FOUND");
  }
  if (asset.lifecycleStatus !== "active") {
    return fail("DISCOVERY_INTAKE_ASSET_NOT_ACTIVE");
  }

  return mapResult(await dependencies.resolveDomainOpportunity({
    workspaceId: input.workspaceId,
    hostname: normalized.hostname,
    assetId: asset.id,
    targetPageUrl: normalized.sourceUrl,
    targetPageTitle: candidate.pageTitle.trim(),
    opportunityType: candidate.intakeEligibility.opportunityType,
    pageType: candidate.intakeEligibility.pageType,
    evidenceSummary: candidate.evidenceSummary,
  }));
}
