import {
  BACKLINK_CAMPAIGN_ENGINE_INPUT_VERSION,
  type BacklinkCampaignEngineCampaignInputV1,
  type BacklinkCampaignEngineOpportunityInputV1,
  type BacklinkCampaignOpportunityPriority,
  type BacklinkCampaignEnginePreviewInputV1,
} from "./backlink-campaign-engine-types";
import { validateBacklinkCampaignEnginePreviewInput } from "./backlink-campaign-engine-validation";
import {
  BacklinkCampaignEngineInputBuilderError,
  type BacklinkCampaignEngineInputBuilderErrorCode,
  type BuildBacklinkCampaignEnginePreviewInput,
  type BuildBacklinkCampaignEnginePreviewInputDependencies,
  type BuildBacklinkCampaignEnginePreviewInputResult,
} from "./backlink-campaign-engine-input-builder-types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CAMPAIGN_STATUSES = new Set([
  "draft",
  "active",
  "paused",
  "completed",
  "archived",
]);
const PRIORITIES = new Set(["Tier A", "Tier B", "Tier C"]);

export async function buildBacklinkCampaignEnginePreviewInput(
  value: unknown,
  dependencies: BuildBacklinkCampaignEnginePreviewInputDependencies,
): Promise<BuildBacklinkCampaignEnginePreviewInputResult> {
  const input = validateInput(value);
  const campaign = await dependencies.getCampaignById({
    workspaceId: input.workspaceId,
    campaignId: input.campaignId,
  });
  if (campaign === null) fail("CAMPAIGN_ENGINE_CAMPAIGN_NOT_FOUND");
  assertCampaign(campaign, input);

  const opportunities: BuildBacklinkCampaignEnginePreviewInputResult["opportunities"] = [];
  const domains: BuildBacklinkCampaignEnginePreviewInputResult["domains"] = [];
  const mappedOpportunities: BacklinkCampaignEngineOpportunityInputV1[] = [];
  const domainsById = new Map<string, BuildBacklinkCampaignEnginePreviewInputResult["domains"][number]>();

  for (const opportunityId of input.opportunityIds) {
    const opportunity = await dependencies.getOpportunityById({
      workspaceId: input.workspaceId,
      opportunityId,
    });
    if (opportunity === null) fail("CAMPAIGN_ENGINE_OPPORTUNITY_NOT_FOUND");
    assertOpportunity(opportunity, input.workspaceId, opportunityId);

    let domain = domainsById.get(opportunity.domain_id);
    if (domain === undefined) {
      const fetchedDomain = await dependencies.getDomainById({
        workspaceId: input.workspaceId,
        domainId: opportunity.domain_id,
      });
      if (fetchedDomain === null) fail("CAMPAIGN_ENGINE_DOMAIN_NOT_FOUND");
      assertDomain(fetchedDomain, input.workspaceId, opportunity.domain_id);
      domain = fetchedDomain;
      domainsById.set(domain.id, domain);
    }
    assertDomainMatchesOpportunity(domain.hostname, opportunity.target_page_url);

    opportunities.push(opportunity);
    domains.push(domain);
    mappedOpportunities.push({
      opportunityId: opportunity.id,
      opportunityKey: opportunity.opportunity_key,
      domainId: opportunity.domain_id,
      domain: domain.hostname,
      targetPageUrl: opportunity.target_page_url,
      title: opportunity.target_page_title,
      priority: toPriority(opportunity.priority),
      qualificationStatus: opportunity.qualification_status,
      editorialStatus: opportunity.editorial_status,
      lifecycleStatus: opportunity.lifecycle_status,
    });
  }

  const previewInput: BacklinkCampaignEnginePreviewInputV1 = {
    version: BACKLINK_CAMPAIGN_ENGINE_INPUT_VERSION,
    workspaceId: input.workspaceId,
    runId: input.runId,
    mode: "preview",
    source: input.source,
    campaign: mapCampaign(campaign),
    opportunities: mappedOpportunities,
    requestedLimits: {
      maxSelectedOpportunities: input.requestedLimits.maxSelectedOpportunities,
      maxPerDomain: input.requestedLimits.maxPerDomain,
    },
  };
  const validatedPreviewInput = validateBacklinkCampaignEnginePreviewInput(previewInput);
  if (validatedPreviewInput !== previewInput) {
    fail("CAMPAIGN_ENGINE_DATA_INVARIANT_FAILED");
  }

  return { campaign, opportunities, domains, previewInput };
}

function validateInput(value: unknown): BuildBacklinkCampaignEnginePreviewInput {
  const record = exactRecord(value, [
    "workspaceId",
    "runId",
    "campaignId",
    "source",
    "opportunityIds",
    "requestedLimits",
  ]);
  const workspaceId = record.workspaceId;
  const runId = record.runId;
  const campaignId = record.campaignId;
  const source = record.source;
  assertUuid(workspaceId);
  assertUuid(runId);
  assertUuid(campaignId);
  if (source !== "manual_dashboard" && source !== "automation_campaign") {
    fail("INVALID_CAMPAIGN_ENGINE_BUILDER_INPUT");
  }
  const rawOpportunityIds = record.opportunityIds;
  if (!Array.isArray(rawOpportunityIds)) fail("INVALID_CAMPAIGN_ENGINE_BUILDER_INPUT");
  if (rawOpportunityIds.length > 100) fail("CAMPAIGN_ENGINE_TOO_MANY_OPPORTUNITIES");
  const seenOpportunityIds = new Set<string>();
  const opportunityIds: string[] = [];
  for (const opportunityId of rawOpportunityIds) {
    assertUuid(opportunityId);
    if (seenOpportunityIds.has(opportunityId)) {
      fail("CAMPAIGN_ENGINE_DUPLICATE_OPPORTUNITY_ID");
    }
    seenOpportunityIds.add(opportunityId);
    opportunityIds.push(opportunityId);
  }
  const requestedLimits = exactRecord(record.requestedLimits, [
    "maxSelectedOpportunities",
    "maxPerDomain",
  ]);
  assertLimit(requestedLimits.maxSelectedOpportunities);
  assertLimit(requestedLimits.maxPerDomain);
  if (requestedLimits.maxPerDomain > requestedLimits.maxSelectedOpportunities) {
    fail("INVALID_CAMPAIGN_ENGINE_BUILDER_INPUT");
  }
  return {
    workspaceId,
    runId,
    campaignId,
    source,
    opportunityIds,
    requestedLimits: {
      maxSelectedOpportunities: requestedLimits.maxSelectedOpportunities,
      maxPerDomain: requestedLimits.maxPerDomain,
    },
  };
}

function assertCampaign(
  campaign: NonNullable<Awaited<ReturnType<BuildBacklinkCampaignEnginePreviewInputDependencies["getCampaignById"]>>>,
  input: BuildBacklinkCampaignEnginePreviewInput,
): void {
  if (campaign.id !== input.campaignId) fail("CAMPAIGN_ENGINE_DATA_INVARIANT_FAILED");
  if (campaign.workspace_id !== input.workspaceId) {
    fail("CAMPAIGN_ENGINE_CAMPAIGN_SCOPE_MISMATCH");
  }
  if (
    !isNonEmptyString(campaign.campaign_key, 160) ||
    !isNonEmptyString(campaign.name, 255) ||
    !isNonEmptyString(campaign.objective, 4000) ||
    !CAMPAIGN_STATUSES.has(campaign.status)
  ) {
    fail("CAMPAIGN_ENGINE_DATA_INVARIANT_FAILED");
  }
}

function assertOpportunity(
  opportunity: NonNullable<Awaited<ReturnType<BuildBacklinkCampaignEnginePreviewInputDependencies["getOpportunityById"]>>>,
  workspaceId: string,
  opportunityId: string,
): void {
  if (opportunity.id !== opportunityId) fail("CAMPAIGN_ENGINE_DATA_INVARIANT_FAILED");
  if (opportunity.workspace_id !== workspaceId) {
    fail("CAMPAIGN_ENGINE_OPPORTUNITY_SCOPE_MISMATCH");
  }
  if (
    !UUID_PATTERN.test(opportunity.domain_id) ||
    !isNonEmptyString(opportunity.opportunity_key, 160) ||
    !isHttpUrl(opportunity.target_page_url) ||
    !isNonEmptyString(opportunity.target_page_title, 500) ||
    !PRIORITIES.has(opportunity.priority) ||
    !isNonEmptyString(opportunity.qualification_status, 100) ||
    !isNonEmptyString(opportunity.editorial_status, 100) ||
    !isNonEmptyString(opportunity.lifecycle_status, 100)
  ) {
    fail("CAMPAIGN_ENGINE_DATA_INVARIANT_FAILED");
  }
}

function assertDomain(
  domain: NonNullable<Awaited<ReturnType<BuildBacklinkCampaignEnginePreviewInputDependencies["getDomainById"]>>>,
  workspaceId: string,
  domainId: string,
): void {
  if (domain.id !== domainId) fail("CAMPAIGN_ENGINE_DATA_INVARIANT_FAILED");
  if (domain.workspace_id !== workspaceId) {
    fail("CAMPAIGN_ENGINE_DOMAIN_SCOPE_MISMATCH");
  }
  if (!isHostname(domain.hostname)) fail("CAMPAIGN_ENGINE_DATA_INVARIANT_FAILED");
}

function mapCampaign(
  campaign: BuildBacklinkCampaignEnginePreviewInputResult["campaign"],
): BacklinkCampaignEngineCampaignInputV1 {
  return {
    campaignId: campaign.id,
    campaignKey: campaign.campaign_key,
    name: campaign.name,
    objective: campaign.objective,
    status: toCampaignStatus(campaign.status),
  };
}

function assertDomainMatchesOpportunity(hostname: string, targetPageUrl: string): void {
  try {
    if (new URL(targetPageUrl).hostname !== hostname) {
      fail("CAMPAIGN_ENGINE_DATA_INVARIANT_FAILED");
    }
  } catch (error) {
    if (error instanceof BacklinkCampaignEngineInputBuilderError) throw error;
    fail("CAMPAIGN_ENGINE_DATA_INVARIANT_FAILED");
  }
}

function exactRecord(value: unknown, keys: string[]): Record<string, unknown> {
  if (
    !isRecord(value) ||
    Object.keys(value).length !== keys.length ||
    !keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  ) {
    fail("INVALID_CAMPAIGN_ENGINE_BUILDER_INPUT");
  }
  return value;
}

function assertUuid(value: unknown): asserts value is string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    fail("INVALID_CAMPAIGN_ENGINE_BUILDER_INPUT");
  }
}

function assertLimit(value: unknown): asserts value is number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 100
  ) {
    fail("INVALID_CAMPAIGN_ENGINE_BUILDER_INPUT");
  }
}

function isNonEmptyString(value: unknown, maximumLength: number): value is string {
  return (
    typeof value === "string" &&
    value.trim() === value &&
    value.length > 0 &&
    value.length <= maximumLength
  );
}

function isHttpUrl(value: unknown): value is string {
  if (!isNonEmptyString(value, 2048)) return false;
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.hostname.length > 0
    );
  } catch {
    return false;
  }
}

function isHostname(value: unknown): value is string {
  if (!isNonEmptyString(value, 253) || value !== value.toLowerCase()) return false;
  try {
    return new URL(`https://${value}`).hostname === value;
  } catch {
    return false;
  }
}

function toPriority(value: string): BacklinkCampaignOpportunityPriority {
  if (value === "Tier A" || value === "Tier B" || value === "Tier C") return value;
  return fail("CAMPAIGN_ENGINE_DATA_INVARIANT_FAILED");
}

function toCampaignStatus(
  value: string,
): BacklinkCampaignEngineCampaignInputV1["status"] {
  if (
    value === "draft" ||
    value === "active" ||
    value === "paused" ||
    value === "completed" ||
    value === "archived"
  ) {
    return value;
  }
  return fail("CAMPAIGN_ENGINE_DATA_INVARIANT_FAILED");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(code: BacklinkCampaignEngineInputBuilderErrorCode): never {
  throw new BacklinkCampaignEngineInputBuilderError(code);
}
