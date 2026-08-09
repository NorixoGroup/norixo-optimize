import type { Database } from "@/types/database.types";

import { BacklinkRepositoryError } from "./errors";

type ResolveBacklinkDomainOpportunityRpcName = "resolve_backlink_domain_opportunity";
type ResolveBacklinkDomainOpportunityRpcArgs = Database["public"]["Functions"][ResolveBacklinkDomainOpportunityRpcName]["Args"];

type ResolveBacklinkDomainOpportunityRpcClient = {
  rpc: (
    functionName: ResolveBacklinkDomainOpportunityRpcName,
    args: ResolveBacklinkDomainOpportunityRpcArgs,
  ) => PromiseLike<{ data: unknown; error: unknown }>;
};

export type ResolveBacklinkDomainOpportunityInput = {
  workspaceId: string;
  hostname: string;
  assetId: string;
  targetPageUrl: string;
  targetPageTitle: string;
  opportunityType: string;
  pageType: string;
  evidenceSummary: string;
};

export type ResolveBacklinkDomainOpportunityResult = {
  domainId: string;
  domainKey: string;
  domainDisposition: "created" | "existing";
  opportunityId: string;
  opportunityKey: string;
  opportunityDisposition: "created" | "existing";
  qualificationStatus: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function throwRepositoryError(operation: string, code: "DATABASE" | "VALIDATION"): never {
  throw new BacklinkRepositoryError({
    code,
    operation,
    message: code === "VALIDATION" ? "The database returned an invalid resolution result." : "The database operation could not be completed.",
  });
}

function mapResult(value: unknown): ResolveBacklinkDomainOpportunityResult {
  if (!isRecord(value)) {
    return throwRepositoryError("resolveBacklinkDomainOpportunityTransaction", "VALIDATION");
  }

  const {
    domain_id: domainId,
    domain_key: domainKey,
    domain_disposition: domainDisposition,
    opportunity_id: opportunityId,
    opportunity_key: opportunityKey,
    opportunity_disposition: opportunityDisposition,
    qualification_status: qualificationStatus,
  } = value;
  if (
    typeof domainId !== "string" ||
    typeof domainKey !== "string" ||
    (domainDisposition !== "created" && domainDisposition !== "existing") ||
    typeof opportunityId !== "string" ||
    typeof opportunityKey !== "string" ||
    (opportunityDisposition !== "created" && opportunityDisposition !== "existing") ||
    typeof qualificationStatus !== "string"
  ) {
    return throwRepositoryError("resolveBacklinkDomainOpportunityTransaction", "VALIDATION");
  }

  return {
    domainId,
    domainKey,
    domainDisposition,
    opportunityId,
    opportunityKey,
    opportunityDisposition,
    qualificationStatus,
  };
}

export async function resolveBacklinkDomainOpportunityTransaction(
  client: ResolveBacklinkDomainOpportunityRpcClient,
  input: ResolveBacklinkDomainOpportunityInput,
): Promise<ResolveBacklinkDomainOpportunityResult> {
  const operation = "resolveBacklinkDomainOpportunityTransaction";
  const { data, error } = await client.rpc("resolve_backlink_domain_opportunity", {
    p_workspace_id: input.workspaceId,
    p_hostname: input.hostname,
    p_asset_id: input.assetId,
    p_target_page_url: input.targetPageUrl,
    p_target_page_title: input.targetPageTitle,
    p_opportunity_type: input.opportunityType,
    p_page_type: input.pageType,
    p_evidence_summary: input.evidenceSummary,
  });

  if (error !== null) {
    return throwRepositoryError(operation, "DATABASE");
  }
  if (!Array.isArray(data) || data.length !== 1) {
    return throwRepositoryError(operation, "VALIDATION");
  }

  return mapResult(data[0]);
}
