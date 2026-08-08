export { BacklinkCampaignEngineTaskValidationError } from "./backlink-campaign-engine-task-types";
import type { Json } from "@/types/database.types";
import { validateBacklinkCampaignEnginePreviewOutput } from "./backlink-campaign-engine-validation";
import type { BacklinkCampaignEngineTaskInputV1 } from "./backlink-campaign-engine-task-types";
import { BacklinkCampaignEngineTaskValidationError } from "./backlink-campaign-engine-task-types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateBacklinkCampaignEngineTaskInput(value: unknown): BacklinkCampaignEngineTaskInputV1 {
  const input = assertExactRecord(value, ["version", "campaignId", "source", "opportunityIds", "requestedLimits"], "INVALID_CAMPAIGN_ENGINE_TASK_INPUT");
  if (input.version !== 1) fail("INVALID_CAMPAIGN_ENGINE_TASK_INPUT");
  assertUuid(input.campaignId, "INVALID_CAMPAIGN_ENGINE_TASK_INPUT");
  if (input.source !== "manual_dashboard" && input.source !== "automation_campaign") fail("INVALID_CAMPAIGN_ENGINE_TASK_INPUT");
  if (!Array.isArray(input.opportunityIds)) fail("INVALID_CAMPAIGN_ENGINE_TASK_INPUT");
  for (const opportunityId of input.opportunityIds) {
    assertUuid(opportunityId, "INVALID_CAMPAIGN_ENGINE_TASK_INPUT");
  }
  const limits = assertExactRecord(input.requestedLimits, ["maxSelectedOpportunities", "maxPerDomain"], "INVALID_CAMPAIGN_ENGINE_TASK_INPUT");
  assertPositiveInteger(limits.maxSelectedOpportunities, "INVALID_CAMPAIGN_ENGINE_TASK_INPUT");
  assertPositiveInteger(limits.maxPerDomain, "INVALID_CAMPAIGN_ENGINE_TASK_INPUT");
  if (limits.maxPerDomain > limits.maxSelectedOpportunities) fail("INVALID_CAMPAIGN_ENGINE_TASK_INPUT");
  return value as BacklinkCampaignEngineTaskInputV1;
}

export function validateBacklinkCampaignEngineTaskOutput(value: unknown): unknown {
  return validateBacklinkCampaignEnginePreviewOutput(value);
}

function assertExactRecord(value: unknown, expectedKeys: string[], code: BacklinkCampaignEngineTaskValidationError["code"]): Record<string, Json> {
  if (!isRecord(value)) fail(code);
  if (!expectedKeys.every((key) => Object.prototype.hasOwnProperty.call(value, key))) fail(code);
  return value as Record<string, Json>;
}

function assertUuid(value: unknown, code: BacklinkCampaignEngineTaskValidationError["code"]): asserts value is string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) fail(code);
}

function assertPositiveInteger(value: unknown, code: BacklinkCampaignEngineTaskValidationError["code"]): asserts value is number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) fail(code);
}

function isRecord(value: unknown): value is Record<string, Json> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(code: BacklinkCampaignEngineTaskValidationError["code"]): never {
  throw new BacklinkCampaignEngineTaskValidationError(code);
}
