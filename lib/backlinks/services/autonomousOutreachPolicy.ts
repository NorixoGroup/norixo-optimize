export type AutonomousOutreachDecision =
  | { kind: "manual_review"; reasons: readonly string[] }
  | { kind: "manual_action_required"; channel: "linkedin" }
  | { kind: "eligible_for_email_sender" }
  | { kind: "eligible_for_contact_form_worker" };

export type AutonomousOutreachPolicyInput = {
  backlinksEnabled: boolean;
  liveAutomationEnabled: boolean;
  evidenceBackedContact: boolean;
  contactStatus: string;
  channel: "email" | "contact_form" | "linkedin";
  validOpportunity: boolean;
  validCampaign: boolean;
  validDraft: boolean;
  inboundReplyStop: boolean;
  complaintOrBounceStop: boolean;
  conflictingOpenAttempt: boolean;
  rateLimitEligible: boolean;
  maxAttemptEligible: boolean;
  contactFormVerified?: boolean;
};

/** Pure fail-closed policy. It authorizes no provider call. */
export function evaluateAutonomousOutreachPolicy(input: AutonomousOutreachPolicyInput): AutonomousOutreachDecision {
  const contactStatusReason = input.contactStatus === "verified"
    ? false
    : input.contactStatus === "do_not_contact"
      ? "CONTACT_DO_NOT_CONTACT"
      : input.contactStatus === "archived"
        ? "CONTACT_ARCHIVED"
        : "CONTACT_NOT_VERIFIED";
  const reasons = [
    !input.backlinksEnabled && "BACKLINKS_DISABLED",
    !input.liveAutomationEnabled && "LIVE_AUTOMATION_DISABLED",
    !input.evidenceBackedContact && "CONTACT_EVIDENCE_INSUFFICIENT",
    contactStatusReason,
    !input.validOpportunity && "OPPORTUNITY_INVALID",
    !input.validCampaign && "CAMPAIGN_INVALID",
    !input.validDraft && "DRAFT_INVALID",
    input.inboundReplyStop && "INBOUND_REPLY_STOP",
    input.complaintOrBounceStop && "PROVIDER_STOP",
    input.conflictingOpenAttempt && "OPEN_ATTEMPT",
    !input.rateLimitEligible && "RATE_LIMIT",
    !input.maxAttemptEligible && "MAX_ATTEMPTS",
    input.channel === "contact_form" && input.contactFormVerified !== true && "CONTACT_FORM_NOT_VERIFIED",
  ].filter((value): value is string => Boolean(value));
  if (reasons.length) return { kind: "manual_review", reasons };
  if (input.channel === "linkedin") return { kind: "manual_action_required", channel: "linkedin" };
  return input.channel === "email"
    ? { kind: "eligible_for_email_sender" }
    : { kind: "eligible_for_contact_form_worker" };
}
