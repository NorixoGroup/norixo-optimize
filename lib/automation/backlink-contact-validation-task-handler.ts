import {
  validateBacklinkContact,
  type BacklinkContactValidationResult,
} from "@/lib/backlinks/services/contactValidationService";

export type BacklinkContactValidationTaskInput = {
  workspaceId: string;
  domainId: string;
  opportunityId: string;
  contactId: string;
};

export type BacklinkContactValidationTaskDependencies = {
  getDomain: (workspaceId: string, domainId: string) => Promise<{ id: string; workspace_id?: string; hostname: string; archived_at?: string | null }>;
  getOpportunity: (workspaceId: string, opportunityId: string) => Promise<{ id: string; workspace_id?: string; domain_id: string; archived_at?: string | null }>;
  getContact: (workspaceId: string, contactId: string) => Promise<{
    id: string;
    workspace_id?: string;
    domain_id: string;
    contact_status: string;
    do_not_contact_at?: string | null;
    archived_at?: string | null;
    email_normalized: string | null;
    contact_form_url: string | null;
    linkedin_url: string | null;
    source_reference: string | null;
  }>;
  getContactFormSafety?: (input: { workspaceId: string; contactId: string }) => Promise<{ ambiguous: boolean; captchaOrManualReview: boolean }>;
  hasMxRecords?: (hostname: string) => Promise<boolean | null>;
};

export type BacklinkContactValidationTaskResult = {
  status: BacklinkContactValidationResult["overall"] | "blocked";
  domainId: string;
  opportunityId: string;
  contactId: string;
  contactStatus: string | null;
  currentNormalizedEmail: string | null;
  suppressed: boolean;
  email: BacklinkContactValidationResult["email"];
  contactForm: BacklinkContactValidationResult["contactForm"];
  linkedin: BacklinkContactValidationResult["linkedin"];
  statusTransition: "preserved" | "none";
  manualReviewRequired: boolean;
  reasons: readonly string[];
};

function blocked(input: BacklinkContactValidationTaskInput, reason: string): BacklinkContactValidationTaskResult {
  return {
    status: "blocked",
    domainId: input.domainId,
    opportunityId: input.opportunityId,
    contactId: input.contactId,
    contactStatus: null,
    currentNormalizedEmail: null,
    suppressed: false,
    email: null,
    contactForm: null,
    linkedin: null,
    statusTransition: "none",
    manualReviewRequired: true,
    reasons: [reason],
  };
}

/**
 * No automatic status update is performed: this stage has no mailbox-proof
 * capability. It only preserves existing terminal/verified statuses and emits
 * a deterministic, PII-minimized assessment for a future gated coordinator.
 */
export async function executeBacklinkContactValidationTask(
  dependencies: BacklinkContactValidationTaskDependencies,
  input: BacklinkContactValidationTaskInput,
): Promise<BacklinkContactValidationTaskResult> {
  if (!input.workspaceId || !input.domainId || !input.opportunityId || !input.contactId) {
    return blocked(input, "VALIDATION_TASK_IDENTIFIERS_INVALID");
  }
  const [domain, opportunity, contact] = await Promise.all([
    dependencies.getDomain(input.workspaceId, input.domainId),
    dependencies.getOpportunity(input.workspaceId, input.opportunityId),
    dependencies.getContact(input.workspaceId, input.contactId),
  ]);
  if (
    domain.id !== input.domainId || opportunity.id !== input.opportunityId || contact.id !== input.contactId ||
    opportunity.domain_id !== domain.id || contact.domain_id !== domain.id ||
    (domain.workspace_id != null && domain.workspace_id !== input.workspaceId) ||
    (opportunity.workspace_id != null && opportunity.workspace_id !== input.workspaceId) ||
    (contact.workspace_id != null && contact.workspace_id !== input.workspaceId) ||
    domain.archived_at != null || opportunity.archived_at != null
  ) return blocked(input, "WORKSPACE_OR_DOMAIN_CONTACT_OPPORTUNITY_MISMATCH");

  const formSafety = dependencies.getContactFormSafety == null
    ? { ambiguous: false, captchaOrManualReview: false }
    : await dependencies.getContactFormSafety({ workspaceId: input.workspaceId, contactId: input.contactId });
  const emailHost = contact.email_normalized?.split("@")[1] ?? domain.hostname;
  const validation = validateBacklinkContact({
    domainHostname: domain.hostname,
    contactStatus: contact.contact_status,
    email: contact.email_normalized,
    contactFormUrl: contact.contact_form_url,
    linkedinUrl: contact.linkedin_url,
    sourceReference: contact.source_reference,
    contactFormAmbiguous: formSafety.ambiguous,
    contactFormCaptchaOrManualReview: formSafety.captchaOrManualReview,
    hasMxRecords: dependencies.hasMxRecords == null ? null : await dependencies.hasMxRecords(emailHost),
  });
  return {
    status: validation.overall,
    domainId: input.domainId,
    opportunityId: input.opportunityId,
    contactId: input.contactId,
    contactStatus: contact.contact_status,
    currentNormalizedEmail: contact.email_normalized,
    suppressed: contact.contact_status === "do_not_contact" || contact.contact_status === "archived" || contact.do_not_contact_at != null || contact.archived_at != null,
    email: validation.email,
    contactForm: validation.contactForm,
    linkedin: validation.linkedin,
    statusTransition: contact.contact_status === "verified" || contact.contact_status === "do_not_contact" || contact.contact_status === "archived" ? "preserved" : "none",
    manualReviewRequired: validation.overall === "manual_review" || validation.overall === "invalid",
    reasons: validation.reasons,
  };
}
