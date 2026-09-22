export type MailboxVerificationStatus = "deliverable" | "undeliverable" | "risky" | "unknown" | "provider_error";

export type MailboxVerificationResult = {
  status: MailboxVerificationStatus;
  provider: string | null;
  safeReason: string;
  providerReference?: string | null;
  safeMetadata?: {
    catchAll?: boolean;
    disposable?: boolean;
    roleBased?: boolean;
  } | null;
};

export interface MailboxVerificationProvider {
  verify(input: { email: string; domain: string }): Promise<MailboxVerificationResult>;
}

/** Default production-closed implementation: no provider, no network request. */
export const disabledMailboxVerificationProvider: MailboxVerificationProvider = {
  async verify() {
    return { status: "unknown", provider: null, safeReason: "MAILBOX_VERIFICATION_PROVIDER_UNAVAILABLE" };
  },
};

export type MailboxVerifiedTransitionDecision = {
  verificationTransitionEligible: boolean;
  outcome: "eligible" | "blocked" | "manual_review" | "retryable";
  reasons: readonly string[];
};

/**
 * This is a decision only. A future explicitly authorized coordinator owns any
 * contact-status write after invoking a configured provider.
 */
export function evaluateMailboxVerifiedTransition(input: {
  providerResult: MailboxVerificationResult;
  officialDomainEmail: boolean;
  explicitPublicEvidence: boolean;
  contactStatus: string;
  inboundReplyStop: boolean;
  complaintOrBounceStop: boolean;
}): MailboxVerifiedTransitionDecision {
  const safetyReasons = [
    !input.officialDomainEmail && "EMAIL_DOMAIN_NOT_OFFICIAL",
    !input.explicitPublicEvidence && "EMAIL_EVIDENCE_INSUFFICIENT",
    input.contactStatus === "do_not_contact" && "CONTACT_DO_NOT_CONTACT",
    input.contactStatus === "archived" && "CONTACT_ARCHIVED",
    input.contactStatus !== "unverified" && input.contactStatus !== "verified" && "CONTACT_STATUS_UNRECOGNIZED",
    input.inboundReplyStop && "INBOUND_REPLY_STOP",
    input.complaintOrBounceStop && "PROVIDER_STOP",
  ].filter((value): value is string => Boolean(value));
  if (input.contactStatus === "verified") return { verificationTransitionEligible: false, outcome: "blocked", reasons: ["EXISTING_VERIFIED_PRESERVED"] };
  if (safetyReasons.length) return { verificationTransitionEligible: false, outcome: "blocked", reasons: safetyReasons };
  if (input.providerResult.status === "deliverable") return { verificationTransitionEligible: true, outcome: "eligible", reasons: ["MAILBOX_PROVIDER_DELIVERABLE"] };
  if (input.providerResult.status === "provider_error") return { verificationTransitionEligible: false, outcome: "retryable", reasons: ["MAILBOX_PROVIDER_ERROR"] };
  if (input.providerResult.status === "risky" || input.providerResult.status === "unknown") return { verificationTransitionEligible: false, outcome: "manual_review", reasons: ["MAILBOX_VERIFICATION_INCONCLUSIVE"] };
  return { verificationTransitionEligible: false, outcome: "blocked", reasons: ["MAILBOX_UNDELIVERABLE"] };
}
