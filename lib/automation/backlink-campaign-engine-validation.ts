import {
  BACKLINK_CAMPAIGN_ENGINE_INPUT_VERSION,
  BACKLINK_CAMPAIGN_ENGINE_MAX_INPUT_BYTES,
  BACKLINK_CAMPAIGN_ENGINE_MAX_OPPORTUNITIES,
  BACKLINK_CAMPAIGN_ENGINE_MAX_OUTPUT_BYTES,
  BACKLINK_CAMPAIGN_ENGINE_OUTPUT_VERSION,
  BACKLINK_CAMPAIGN_ENGINE_POLICY_VERSION,
  type BacklinkCampaignEnginePreviewInputV1,
  type BacklinkCampaignEnginePreviewOutputV1,
} from "./backlink-campaign-engine-types";
import type { BacklinkCampaignEnginePolicyV1 } from "./backlink-campaign-engine-policy-types";

export type BacklinkCampaignEngineValidationErrorCode =
  | "INVALID_CAMPAIGN_ENGINE_INPUT"
  | "CAMPAIGN_ENGINE_INPUT_TOO_LARGE"
  | "CAMPAIGN_ENGINE_TOO_MANY_OPPORTUNITIES"
  | "CAMPAIGN_ENGINE_DUPLICATE_OPPORTUNITY"
  | "CAMPAIGN_ENGINE_DUPLICATE_TARGET"
  | "INVALID_CAMPAIGN_ENGINE_POLICY"
  | "INVALID_CAMPAIGN_ENGINE_OUTPUT"
  | "CAMPAIGN_ENGINE_OUTPUT_TOO_LARGE";

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
const DECISIONS = new Set(["selected", "review", "skipped"]);
const REASONS = new Set([
  "CAMPAIGN_NOT_DRAFT",
  "OPPORTUNITY_NOT_ACTIVE",
  "OPPORTUNITY_NOT_QUALIFIED",
  "OPPORTUNITY_EDITORIAL_NOT_READY",
  "DOMAIN_LIMIT_REACHED",
  "CAMPAIGN_LIMIT_REACHED",
  "DUPLICATE_OPPORTUNITY",
  "DUPLICATE_TARGET",
  "ELIGIBLE",
]);

export class BacklinkCampaignEngineValidationError extends Error {
  readonly code: BacklinkCampaignEngineValidationErrorCode;

  constructor(code: BacklinkCampaignEngineValidationErrorCode) {
    super(code);
    this.name = "BacklinkCampaignEngineValidationError";
    this.code = code;
  }
}

export function validateBacklinkCampaignEnginePreviewInput(
  value: unknown,
): BacklinkCampaignEnginePreviewInputV1 {
  assertPreviewInput(value);
  return value;
}

export function validateBacklinkCampaignEnginePolicy(
  value: unknown,
): BacklinkCampaignEnginePolicyV1 {
  assertPolicy(value);
  return value;
}

export function validateBacklinkCampaignEnginePreviewOutput(
  value: unknown,
): BacklinkCampaignEnginePreviewOutputV1 {
  assertPreviewOutput(value);
  return value;
}

function assertPreviewInput(
  value: unknown,
): asserts value is BacklinkCampaignEnginePreviewInputV1 {
  const input = assertExactRecord(
    value,
    [
      "version",
      "workspaceId",
      "runId",
      "mode",
      "source",
      "campaign",
      "opportunities",
      "requestedLimits",
    ],
    "INVALID_CAMPAIGN_ENGINE_INPUT",
  );
  if (input.version !== BACKLINK_CAMPAIGN_ENGINE_INPUT_VERSION) {
    fail("INVALID_CAMPAIGN_ENGINE_INPUT");
  }
  assertUuid(input.workspaceId, "INVALID_CAMPAIGN_ENGINE_INPUT");
  assertUuid(input.runId, "INVALID_CAMPAIGN_ENGINE_INPUT");
  if (input.mode !== "preview") fail("INVALID_CAMPAIGN_ENGINE_INPUT");
  if (input.source !== "manual_dashboard" && input.source !== "automation_campaign") {
    fail("INVALID_CAMPAIGN_ENGINE_INPUT");
  }
  assertCampaign(input.campaign);
  if (!Array.isArray(input.opportunities)) fail("INVALID_CAMPAIGN_ENGINE_INPUT");
  if (input.opportunities.length > BACKLINK_CAMPAIGN_ENGINE_MAX_OPPORTUNITIES) {
    fail("CAMPAIGN_ENGINE_TOO_MANY_OPPORTUNITIES");
  }
  const opportunityIds = new Set<string>();
  const targetUrls = new Set<string>();
  for (const opportunity of input.opportunities) {
    const normalized = assertOpportunity(opportunity);
    if (opportunityIds.has(normalized.opportunityId)) {
      fail("CAMPAIGN_ENGINE_DUPLICATE_OPPORTUNITY");
    }
    if (targetUrls.has(normalized.targetPageUrl)) {
      fail("CAMPAIGN_ENGINE_DUPLICATE_TARGET");
    }
    opportunityIds.add(normalized.opportunityId);
    targetUrls.add(normalized.targetPageUrl);
  }
  const limits = assertExactRecord(
    input.requestedLimits,
    ["maxSelectedOpportunities", "maxPerDomain"],
    "INVALID_CAMPAIGN_ENGINE_INPUT",
  );
  assertLimit(limits.maxSelectedOpportunities, "INVALID_CAMPAIGN_ENGINE_INPUT");
  assertLimit(limits.maxPerDomain, "INVALID_CAMPAIGN_ENGINE_INPUT");
  if (limits.maxPerDomain > limits.maxSelectedOpportunities) {
    fail("INVALID_CAMPAIGN_ENGINE_INPUT");
  }
  assertSerializedSize(input, BACKLINK_CAMPAIGN_ENGINE_MAX_INPUT_BYTES, "CAMPAIGN_ENGINE_INPUT_TOO_LARGE");
}

function assertPolicy(value: unknown): asserts value is BacklinkCampaignEnginePolicyV1 {
  const policy = assertExactRecord(
    value,
    [
      "version",
      "eligibleCampaignStatuses",
      "eligibleOpportunityLifecycleStatuses",
      "eligibleQualificationStatuses",
      "eligibleEditorialStatuses",
      "maxSelectedOpportunities",
      "maxPerDomain",
      "duplicateTargetPolicy",
      "initialMembershipStatus",
    ],
    "INVALID_CAMPAIGN_ENGINE_POLICY",
  );
  if (policy.version !== BACKLINK_CAMPAIGN_ENGINE_POLICY_VERSION) {
    fail("INVALID_CAMPAIGN_ENGINE_POLICY");
  }
  assertStringList(policy.eligibleCampaignStatuses, "INVALID_CAMPAIGN_ENGINE_POLICY", CAMPAIGN_STATUSES);
  assertStringList(policy.eligibleOpportunityLifecycleStatuses, "INVALID_CAMPAIGN_ENGINE_POLICY");
  assertStringList(policy.eligibleQualificationStatuses, "INVALID_CAMPAIGN_ENGINE_POLICY");
  assertStringList(policy.eligibleEditorialStatuses, "INVALID_CAMPAIGN_ENGINE_POLICY");
  assertLimit(policy.maxSelectedOpportunities, "INVALID_CAMPAIGN_ENGINE_POLICY");
  assertLimit(policy.maxPerDomain, "INVALID_CAMPAIGN_ENGINE_POLICY");
  if (policy.maxPerDomain > policy.maxSelectedOpportunities) fail("INVALID_CAMPAIGN_ENGINE_POLICY");
  if (policy.duplicateTargetPolicy !== "skip" || policy.initialMembershipStatus !== "planned") {
    fail("INVALID_CAMPAIGN_ENGINE_POLICY");
  }
}

function assertPreviewOutput(
  value: unknown,
): asserts value is BacklinkCampaignEnginePreviewOutputV1 {
  const output = assertExactRecord(
    value,
    ["version", "policyVersion", "workspaceId", "runId", "campaignId", "mode", "source", "summary", "results"],
    "INVALID_CAMPAIGN_ENGINE_OUTPUT",
  );
  if (
    output.version !== BACKLINK_CAMPAIGN_ENGINE_OUTPUT_VERSION ||
    output.policyVersion !== BACKLINK_CAMPAIGN_ENGINE_POLICY_VERSION ||
    output.mode !== "preview" ||
    (output.source !== "manual_dashboard" && output.source !== "automation_campaign")
  ) fail("INVALID_CAMPAIGN_ENGINE_OUTPUT");
  assertUuid(output.workspaceId, "INVALID_CAMPAIGN_ENGINE_OUTPUT");
  assertUuid(output.runId, "INVALID_CAMPAIGN_ENGINE_OUTPUT");
  assertUuid(output.campaignId, "INVALID_CAMPAIGN_ENGINE_OUTPUT");
  if (!Array.isArray(output.results) || output.results.length > BACKLINK_CAMPAIGN_ENGINE_MAX_OPPORTUNITIES) {
    fail("INVALID_CAMPAIGN_ENGINE_OUTPUT");
  }
  const ids = new Set<string>();
  const keys = new Set<string>();
  const counts = { selected: 0, review: 0, skipped: 0, eligible: 0, duplicateOpportunities: 0, duplicateTargets: 0, domainLimited: 0, campaignLimited: 0 };
  for (const result of output.results) {
    const item = assertResult(result);
    if (ids.has(item.opportunityId) || keys.has(item.opportunityKey)) fail("INVALID_CAMPAIGN_ENGINE_OUTPUT");
    ids.add(item.opportunityId);
    keys.add(item.opportunityKey);
    counts[item.decision] += 1;
    if (item.reasons.includes("ELIGIBLE")) counts.eligible += 1;
    if (item.reasons.includes("DUPLICATE_OPPORTUNITY")) counts.duplicateOpportunities += 1;
    if (item.reasons.includes("DUPLICATE_TARGET")) counts.duplicateTargets += 1;
    if (item.reasons.includes("DOMAIN_LIMIT_REACHED")) counts.domainLimited += 1;
    if (item.reasons.includes("CAMPAIGN_LIMIT_REACHED")) counts.campaignLimited += 1;
  }
  const summary = assertExactRecord(output.summary, ["inputOpportunities", "selected", "review", "skipped", "eligible", "duplicateOpportunities", "duplicateTargets", "domainLimited", "campaignLimited"], "INVALID_CAMPAIGN_ENGINE_OUTPUT");
  for (const key of Object.keys(summary)) assertNonNegativeInteger(summary[key], "INVALID_CAMPAIGN_ENGINE_OUTPUT");
  if (
    summary.inputOpportunities !== output.results.length ||
    summary.selected !== counts.selected || summary.review !== counts.review || summary.skipped !== counts.skipped ||
    summary.eligible !== counts.eligible || summary.duplicateOpportunities !== counts.duplicateOpportunities ||
    summary.duplicateTargets !== counts.duplicateTargets || summary.domainLimited !== counts.domainLimited ||
    summary.campaignLimited !== counts.campaignLimited || summary.eligible < summary.selected
  ) fail("INVALID_CAMPAIGN_ENGINE_OUTPUT");
  assertSerializedSize(output, BACKLINK_CAMPAIGN_ENGINE_MAX_OUTPUT_BYTES, "CAMPAIGN_ENGINE_OUTPUT_TOO_LARGE");
}

function assertCampaign(value: unknown): void {
  const campaign = assertExactRecord(value, ["campaignId", "campaignKey", "name", "objective", "status"], "INVALID_CAMPAIGN_ENGINE_INPUT");
  assertUuid(campaign.campaignId, "INVALID_CAMPAIGN_ENGINE_INPUT");
  assertString(campaign.campaignKey, "INVALID_CAMPAIGN_ENGINE_INPUT", 160);
  assertString(campaign.name, "INVALID_CAMPAIGN_ENGINE_INPUT", 255);
  if (campaign.objective !== null) assertString(campaign.objective, "INVALID_CAMPAIGN_ENGINE_INPUT", 4000);
  if (typeof campaign.status !== "string" || !CAMPAIGN_STATUSES.has(campaign.status)) fail("INVALID_CAMPAIGN_ENGINE_INPUT");
}

function assertOpportunity(value: unknown): { opportunityId: string; targetPageUrl: string } {
  const opportunity = assertExactRecord(value, ["opportunityId", "opportunityKey", "domainId", "domain", "targetPageUrl", "title", "priority", "qualificationStatus", "editorialStatus", "lifecycleStatus"], "INVALID_CAMPAIGN_ENGINE_INPUT");
  assertUuid(opportunity.opportunityId, "INVALID_CAMPAIGN_ENGINE_INPUT");
  assertString(opportunity.opportunityKey, "INVALID_CAMPAIGN_ENGINE_INPUT", 160);
  assertUuid(opportunity.domainId, "INVALID_CAMPAIGN_ENGINE_INPUT");
  assertHostname(opportunity.domain);
  assertHttpUrl(opportunity.targetPageUrl);
  if (opportunity.title !== null) assertString(opportunity.title, "INVALID_CAMPAIGN_ENGINE_INPUT", 500);
  if (typeof opportunity.priority !== "string" || !PRIORITIES.has(opportunity.priority)) fail("INVALID_CAMPAIGN_ENGINE_INPUT");
  assertString(opportunity.qualificationStatus, "INVALID_CAMPAIGN_ENGINE_INPUT", 100);
  assertString(opportunity.editorialStatus, "INVALID_CAMPAIGN_ENGINE_INPUT", 100);
  assertString(opportunity.lifecycleStatus, "INVALID_CAMPAIGN_ENGINE_INPUT", 100);
  return { opportunityId: opportunity.opportunityId, targetPageUrl: opportunity.targetPageUrl };
}

function assertResult(value: unknown): { opportunityId: string; opportunityKey: string; decision: "selected" | "review" | "skipped"; reasons: string[] } {
  const result = assertExactRecord(value, ["opportunityId", "opportunityKey", "decision", "reasons", "proposedMembershipStatus", "proposedPriority"], "INVALID_CAMPAIGN_ENGINE_OUTPUT");
  assertUuid(result.opportunityId, "INVALID_CAMPAIGN_ENGINE_OUTPUT");
  assertString(result.opportunityKey, "INVALID_CAMPAIGN_ENGINE_OUTPUT", 160);
  if (typeof result.decision !== "string" || !DECISIONS.has(result.decision)) fail("INVALID_CAMPAIGN_ENGINE_OUTPUT");
  assertStringList(result.reasons, "INVALID_CAMPAIGN_ENGINE_OUTPUT", REASONS);
  if (result.decision === "selected") {
    if (result.proposedMembershipStatus !== "planned" || typeof result.proposedPriority !== "string" || !PRIORITIES.has(result.proposedPriority)) fail("INVALID_CAMPAIGN_ENGINE_OUTPUT");
  } else if (result.proposedMembershipStatus !== null || result.proposedPriority !== null) fail("INVALID_CAMPAIGN_ENGINE_OUTPUT");
  return { opportunityId: result.opportunityId, opportunityKey: result.opportunityKey, decision: toDecision(result.decision), reasons: result.reasons };
}

function assertExactRecord(value: unknown, expected: string[], code: BacklinkCampaignEngineValidationErrorCode): Record<string, unknown> {
  if (!isRecord(value) || Object.keys(value).length !== expected.length || !expected.every((key) => Object.prototype.hasOwnProperty.call(value, key))) fail(code);
  return value;
}

function assertStringList(value: unknown, code: BacklinkCampaignEngineValidationErrorCode, allowed?: Set<string>): asserts value is string[] {
  if (!Array.isArray(value) || value.length === 0) fail(code);
  const values = new Set<string>();
  for (const item of value) {
    assertString(item, code, 100);
    if (allowed && !allowed.has(item)) fail(code);
    if (values.has(item)) fail(code);
    values.add(item);
  }
}

function assertUuid(value: unknown, code: BacklinkCampaignEngineValidationErrorCode): asserts value is string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) fail(code);
}

function assertString(value: unknown, code: BacklinkCampaignEngineValidationErrorCode, maximumLength: number): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0 || value !== value.trim() || value.length > maximumLength) fail(code);
}

function assertLimit(value: unknown, code: BacklinkCampaignEngineValidationErrorCode): asserts value is number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > BACKLINK_CAMPAIGN_ENGINE_MAX_OPPORTUNITIES) fail(code);
}

function assertNonNegativeInteger(value: unknown, code: BacklinkCampaignEngineValidationErrorCode): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) fail(code);
}

function assertHostname(value: unknown): asserts value is string {
  if (typeof value !== "string" || value.trim() !== value || value.length === 0 || value.length > 253 || value !== value.toLowerCase() || value === "localhost" || value.endsWith(".localhost") || isPrivateAddress(value)) fail("INVALID_CAMPAIGN_ENGINE_INPUT");
}

function assertHttpUrl(value: unknown): asserts value is string {
  if (typeof value !== "string" || value.trim() !== value || value.length === 0 || value.length > 2048) fail("INVALID_CAMPAIGN_ENGINE_INPUT");
  try {
    const url = new URL(value);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.hostname.length === 0 || url.hostname === "localhost" || url.hostname.endsWith(".localhost") || isPrivateAddress(url.hostname)) fail("INVALID_CAMPAIGN_ENGINE_INPUT");
  } catch (error) {
    if (error instanceof BacklinkCampaignEngineValidationError) throw error;
    fail("INVALID_CAMPAIGN_ENGINE_INPUT");
  }
}

function isPrivateAddress(hostname: string): boolean {
  const parts = hostname.split(".");
  if (parts.length === 4 && parts.every((part) => /^\d+$/.test(part))) {
    const numbers = parts.map(Number);
    return numbers.some((part) => part > 255) || numbers[0] === 10 || numbers[0] === 127 || (numbers[0] === 169 && numbers[1] === 254) || (numbers[0] === 172 && numbers[1] >= 16 && numbers[1] <= 31) || (numbers[0] === 192 && numbers[1] === 168);
  }
  const lower = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return lower === "::1" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80:");
}

function assertSerializedSize(value: unknown, maximumBytes: number, code: BacklinkCampaignEngineValidationErrorCode): void {
  try {
    if (new TextEncoder().encode(JSON.stringify(value)).byteLength > maximumBytes) fail(code);
  } catch (error) {
    if (error instanceof BacklinkCampaignEngineValidationError) throw error;
    fail(code);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toDecision(value: string): "selected" | "review" | "skipped" {
  if (value === "selected" || value === "review" || value === "skipped") return value;
  fail("INVALID_CAMPAIGN_ENGINE_OUTPUT");
}

function fail(code: BacklinkCampaignEngineValidationErrorCode): never {
  throw new BacklinkCampaignEngineValidationError(code);
}
