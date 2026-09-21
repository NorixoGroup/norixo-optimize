import { evaluateAutonomousOutreachPolicy, type AutonomousOutreachPolicyInput } from "@/lib/backlinks/services/autonomousOutreachPolicy";

export type BacklinkAutonomyPipelineTaskKind =
  | "backlinks.contact_validation"
  | "backlinks.campaign_prepare"
  | "backlinks.draft_prepare"
  | "backlinks.outreach_decision";

export type BacklinkAutonomyPlannedTask = {
  taskKind: BacklinkAutonomyPipelineTaskKind;
  taskKey: string;
  dependsOnTaskKey: string | null;
  input: Readonly<Record<string, string>>;
};

export type BacklinkAutonomyPipelinePlan = {
  currentStage: "contact_validation";
  tasks: readonly BacklinkAutonomyPlannedTask[];
  manualReviewRequired: boolean;
  blockedReason: string | null;
};

/**
 * A dependency-key plan only: it never calls AutomationTask persistence. A
 * future gated coordinator resolves keys to task IDs using create-or-get.
 */
export function buildBacklinkAutonomyPipelinePlan(input: {
  workspaceId: string;
  runId: string;
  resolutionTaskKey: string;
  domainId: string;
  opportunityId: string;
  contactId: string;
}): BacklinkAutonomyPipelinePlan {
  const scope = { workspaceId: input.workspaceId, runId: input.runId, domainId: input.domainId, opportunityId: input.opportunityId, contactId: input.contactId };
  const validationKey = `contact-validation:${input.opportunityId}:${input.contactId}`;
  const campaignKey = `campaign-prepare:${input.opportunityId}:${input.contactId}`;
  const draftKey = `draft-prepare:${input.opportunityId}:${input.contactId}`;
  const decisionKey = `outreach-decision:${input.opportunityId}:${input.contactId}`;
  return {
    currentStage: "contact_validation",
    manualReviewRequired: false,
    blockedReason: null,
    tasks: [
      { taskKind: "backlinks.contact_validation", taskKey: validationKey, dependsOnTaskKey: input.resolutionTaskKey, input: scope },
      { taskKind: "backlinks.campaign_prepare", taskKey: campaignKey, dependsOnTaskKey: validationKey, input: scope },
      { taskKind: "backlinks.draft_prepare", taskKey: draftKey, dependsOnTaskKey: campaignKey, input: scope },
      { taskKind: "backlinks.outreach_decision", taskKey: decisionKey, dependsOnTaskKey: draftKey, input: scope },
    ],
  };
}

/** Existing campaign apply/creation is intentionally supplied, never invoked here. */
export type BacklinkCampaignPreparationAdapter = {
  prepare(input: { workspaceId: string; opportunityId: string; contactId: string }): Promise<{ campaignId: string; disposition: "created" | "existing" }>;
};

/** Existing createBacklinkOutreachDraftService is intentionally supplied, never invoked here. */
export type BacklinkDraftPreparationAdapter = {
  prepare(input: { workspaceId: string; campaignId: string; opportunityId: string; contactId: string; channel: "email" | "contact_form" | "linkedin" }): Promise<{ outreachId: string; disposition: "created" | "existing"; status: string }>;
};

export type BacklinkExecutionDescriptor =
  | { kind: "email_sender"; workspaceId: string; outreachId: string }
  | { kind: "contact_form_worker"; workspaceId: string; outreachId: string }
  | { kind: "linkedin_manual_action"; workspaceId: string; outreachId: string };

export type BacklinkAutonomyDecisionResult = {
  outcome: "blocked" | "manual_review" | "manual_action_required" | "execution_eligible";
  reasons: readonly string[];
  execution: BacklinkExecutionDescriptor | null;
};

const TERMINAL_POLICY_REASONS = new Set([
  "BACKLINKS_DISABLED",
  "LIVE_AUTOMATION_DISABLED",
  "CONTACT_DO_NOT_CONTACT",
  "CONTACT_ARCHIVED",
  "OPPORTUNITY_INVALID",
  "CAMPAIGN_INVALID",
  "DRAFT_INVALID",
  "INBOUND_REPLY_STOP",
  "PROVIDER_STOP",
  "OPEN_ATTEMPT",
  "RATE_LIMIT",
  "MAX_ATTEMPTS",
]);

/** Pure policy coordinator. It does not call campaign, draft, Ready, or execution adapters. */
export function evaluateBacklinkAutonomyDownstreamDecision(input: AutonomousOutreachPolicyInput & { workspaceId: string; outreachId: string }): BacklinkAutonomyDecisionResult {
  const decision = evaluateAutonomousOutreachPolicy(input);
  if (decision.kind === "manual_review") {
    return {
      outcome: decision.reasons.some((reason) => TERMINAL_POLICY_REASONS.has(reason)) ? "blocked" : "manual_review",
      reasons: decision.reasons,
      execution: null,
    };
  }
  if (decision.kind === "manual_action_required") return { outcome: "manual_action_required", reasons: ["LINKEDIN_MANUAL_ACTION_REQUIRED"], execution: { kind: "linkedin_manual_action", workspaceId: input.workspaceId, outreachId: input.outreachId } };
  return decision.kind === "eligible_for_email_sender"
    ? { outcome: "execution_eligible", reasons: [], execution: { kind: "email_sender", workspaceId: input.workspaceId, outreachId: input.outreachId } }
    : { outcome: "execution_eligible", reasons: [], execution: { kind: "contact_form_worker", workspaceId: input.workspaceId, outreachId: input.outreachId } };
}
