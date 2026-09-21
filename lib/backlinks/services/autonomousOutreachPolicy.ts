export type AutonomousOutreachDecision =
  | { kind: "manual_review"; reasons: readonly string[] }
  | { kind: "manual_action_required"; channel: "linkedin" }
  | { kind: "eligible_for_existing_sender" };

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
  contactFormAmbiguous?: boolean;
};

/** Pure fail-closed policy. It authorizes no provider call. */
export function evaluateAutonomousOutreachPolicy(input: AutonomousOutreachPolicyInput): AutonomousOutreachDecision {
  if (input.channel === "linkedin") return { kind: "manual_action_required", channel: "linkedin" };
  const reasons = [
    !input.backlinksEnabled && "BACKLINKS_DISABLED",
    !input.liveAutomationEnabled && "LIVE_AUTOMATION_DISABLED",
    !input.evidenceBackedContact && "CONTACT_EVIDENCE_INSUFFICIENT",
    (input.contactStatus === "do_not_contact" || input.contactStatus === "archived") && "CONTACT_UNAVAILABLE",
    !input.validOpportunity && "OPPORTUNITY_INVALID",
    !input.validCampaign && "CAMPAIGN_INVALID",
    !input.validDraft && "DRAFT_INVALID",
    input.inboundReplyStop && "INBOUND_REPLY_STOP",
    input.complaintOrBounceStop && "PROVIDER_STOP",
    input.conflictingOpenAttempt && "OPEN_ATTEMPT",
    !input.rateLimitEligible && "RATE_LIMIT",
    !input.maxAttemptEligible && "MAX_ATTEMPTS",
    input.channel === "contact_form" && input.contactFormAmbiguous && "CONTACT_FORM_AMBIGUOUS",
  ].filter((value): value is string => Boolean(value));
  return reasons.length ? { kind: "manual_review", reasons } : { kind: "eligible_for_existing_sender" };
}
