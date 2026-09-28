export const CONTACT_FORM_VERIFICATION_EVIDENCE_VERSION = "cfv1" as const;

type TriState = boolean | null;

export type ContactFormVerificationEvidenceInput = Readonly<{
  formCount: number;
  selectedFormOrdinal: number | null;
  mappingResult: string;
  mappedSemanticFields: readonly string[];
  messageFieldPresent: boolean;
  strictSubmitControlPresent: boolean;
  hasLoginWall: boolean;
  hasPasswordField: boolean;
  newsletterOnly: boolean;
  supportOnly: TriState;
  salesDemoOnly: TriState;
}>;

export type ContactFormVerificationSafeEvidence = Readonly<{
  actual_form_observed: true;
  form_count: number;
  message_field_present: true;
  submit_control_present: true;
  contact_intent: true;
  newsletter_only: false;
  login_only: false;
  support_only: false;
  sales_demo_only: false;
}>;

export type ContactFormVerificationEvidenceCandidate =
  | Readonly<{
      ok: true;
      evidenceVersion: typeof CONTACT_FORM_VERIFICATION_EVIDENCE_VERSION;
      safeEvidence: ContactFormVerificationSafeEvidence;
    }>
  | Readonly<{
      ok: false;
      reason: string;
    }>;

export function buildContactFormVerificationEvidenceCandidate(
  input: ContactFormVerificationEvidenceInput,
): ContactFormVerificationEvidenceCandidate {
  if (!Number.isInteger(input.formCount) || input.formCount < 1) {
    return { ok: false, reason: "actual_form_not_observed" };
  }

  if (
    input.selectedFormOrdinal == null ||
    !Number.isInteger(input.selectedFormOrdinal) ||
    input.selectedFormOrdinal < 0
  ) {
    return { ok: false, reason: "selected_form_not_observed" };
  }

  if (input.mappingResult !== "mapped") {
    return { ok: false, reason: "form_not_mapped" };
  }

  if (!input.messageFieldPresent) {
    return { ok: false, reason: "message_field_not_observed" };
  }

  if (!input.strictSubmitControlPresent) {
    return { ok: false, reason: "strict_submit_control_not_observed" };
  }

  const mappedFields = new Set(input.mappedSemanticFields);

  if (!mappedFields.has("sender_email") || !mappedFields.has("message")) {
    return { ok: false, reason: "contact_intent_not_proven" };
  }

  if (input.newsletterOnly) {
    return { ok: false, reason: "newsletter_only" };
  }

  if (input.hasLoginWall || input.hasPasswordField) {
    return { ok: false, reason: "login_only" };
  }

  if (input.supportOnly !== false) {
    return {
      ok: false,
      reason:
        input.supportOnly === true
          ? "support_only"
          : "support_only_unknown",
    };
  }

  if (input.salesDemoOnly !== false) {
    return {
      ok: false,
      reason:
        input.salesDemoOnly === true
          ? "sales_demo_only"
          : "sales_demo_only_unknown",
    };
  }

  return {
    ok: true,
    evidenceVersion: CONTACT_FORM_VERIFICATION_EVIDENCE_VERSION,
    safeEvidence: {
      actual_form_observed: true,
      form_count: input.formCount,
      message_field_present: true,
      submit_control_present: true,
      contact_intent: true,
      newsletter_only: false,
      login_only: false,
      support_only: false,
      sales_demo_only: false,
    },
  };
}
