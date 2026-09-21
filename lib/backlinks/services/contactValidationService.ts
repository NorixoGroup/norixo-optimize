export type ContactValidationDisposition = "verified" | "unverified" | "invalid" | "manual_review" | "manual_action_required";

export type ContactValidationEvidence = {
  kind: "mailto" | "visible_email" | "contact_form" | "linkedin";
  value: string;
  sourceUrl: string;
  confidence: "strong" | "medium";
};

export type BacklinkContactValidationInput = {
  domainHostname: string;
  contactStatus: string;
  email: string | null;
  contactFormUrl: string | null;
  linkedinUrl: string | null;
  sourceReference: string | null;
  contactFormAmbiguous?: boolean;
  contactFormCaptchaOrManualReview?: boolean;
  /** MX is advisory only and can never prove a mailbox exists. */
  hasMxRecords?: boolean | null;
};

export type BacklinkContactValidationResult = {
  overall: ContactValidationDisposition;
  email: ContactValidationDisposition | null;
  contactForm: ContactValidationDisposition | null;
  linkedin: ContactValidationDisposition | null;
  reasons: readonly string[];
};

function hostname(value: string): string | null {
  try {
    const url = new URL(value);
    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function sameOfficialHost(value: string, domainHostname: string): boolean {
  const found = hostname(value);
  const expected = domainHostname.toLowerCase().replace(/^www\./, "");
  return found === expected || found?.endsWith(`.${expected}`) === true;
}

function parseEvidence(value: string | null): ContactValidationEvidence[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is ContactValidationEvidence =>
      typeof item === "object" && item != null &&
      ["mailto", "visible_email", "contact_form", "linkedin"].includes((item as { kind?: unknown }).kind as string) &&
      typeof (item as { value?: unknown }).value === "string" &&
      typeof (item as { sourceUrl?: unknown }).sourceUrl === "string",
    );
  } catch {
    return [];
  }
}

function hasEvidence(evidence: readonly ContactValidationEvidence[], kind: ContactValidationEvidence["kind"], value: string, domainHostname: string): boolean {
  return evidence.some((item) => item.kind === kind && item.value === value && sameOfficialHost(item.sourceUrl, domainHostname));
}

function isOfficialEmail(email: string, domainHostname: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  const expected = domainHostname.toLowerCase().replace(/^www\./, "");
  return domain === expected || domain?.endsWith(`.${expected}`) === true;
}

function isHttpsOfficialUrl(value: string, domainHostname: string): boolean {
  try {
    return new URL(value).protocol === "https:" && sameOfficialHost(value, domainHostname);
  } catch {
    return false;
  }
}

function isLinkedInUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "linkedin.com" || url.hostname.endsWith(".linkedin.com")) && /^\/(?:in|company)\//i.test(url.pathname);
  } catch {
    return false;
  }
}

/**
 * Pure validation. Existing verified contacts are preserved; new evidence does
 * not establish mailbox ownership/deliverability and therefore cannot promote
 * an unverified contact to verified.
 */
export function validateBacklinkContact(input: BacklinkContactValidationInput): BacklinkContactValidationResult {
  if (input.contactStatus === "do_not_contact") return { overall: "manual_review", email: null, contactForm: null, linkedin: null, reasons: ["CONTACT_DO_NOT_CONTACT"] };
  if (input.contactStatus === "archived") return { overall: "manual_review", email: null, contactForm: null, linkedin: null, reasons: ["CONTACT_ARCHIVED"] };
  if (input.contactStatus === "verified") return { overall: "verified", email: input.email ? "verified" : null, contactForm: input.contactFormUrl ? "manual_review" : null, linkedin: input.linkedinUrl ? "manual_action_required" : null, reasons: ["EXISTING_VERIFIED_PRESERVED"] };
  if (input.contactStatus !== "unverified") return { overall: "manual_review", email: null, contactForm: null, linkedin: null, reasons: ["CONTACT_STATUS_UNRECOGNIZED"] };

  const evidence = parseEvidence(input.sourceReference);
  const reasons: string[] = [];
  let email: ContactValidationDisposition | null = null;
  if (input.email != null) {
    const normalized = input.email.trim().toLowerCase();
    if (normalized !== input.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) {
      email = "invalid";
      reasons.push("EMAIL_SYNTAX_INVALID");
    } else if (!isOfficialEmail(normalized, input.domainHostname)) {
      email = "invalid";
      reasons.push("EMAIL_DOMAIN_NOT_OFFICIAL");
    } else if (!hasEvidence(evidence, "mailto", normalized, input.domainHostname) && !hasEvidence(evidence, "visible_email", normalized, input.domainHostname)) {
      email = "unverified";
      reasons.push("EMAIL_EVIDENCE_INSUFFICIENT");
    } else {
      email = "unverified";
      reasons.push(input.hasMxRecords === true ? "EMAIL_MAILBOX_PROOF_UNAVAILABLE_MX_INSUFFICIENT" : "EMAIL_MAILBOX_PROOF_UNAVAILABLE");
    }
  }

  let contactForm: ContactValidationDisposition | null = null;
  if (input.contactFormUrl != null) {
    if (input.contactFormAmbiguous || input.contactFormCaptchaOrManualReview) {
      contactForm = "manual_review";
      reasons.push("CONTACT_FORM_MANUAL_REVIEW_REQUIRED");
    } else if (!isHttpsOfficialUrl(input.contactFormUrl, input.domainHostname) || !hasEvidence(evidence, "contact_form", input.contactFormUrl, input.domainHostname)) {
      contactForm = "invalid";
      reasons.push("CONTACT_FORM_EVIDENCE_OR_ORIGIN_INVALID");
    } else {
      contactForm = "unverified";
      reasons.push("CONTACT_FORM_REQUIRES_EXISTING_APPROVAL_GATE");
    }
  }

  let linkedin: ContactValidationDisposition | null = null;
  if (input.linkedinUrl != null) {
    if (isLinkedInUrl(input.linkedinUrl) && hasEvidence(evidence, "linkedin", input.linkedinUrl, input.domainHostname)) {
      linkedin = "manual_action_required";
      reasons.push("LINKEDIN_MANUAL_ACTION_REQUIRED");
    } else {
      linkedin = "invalid";
      reasons.push("LINKEDIN_EVIDENCE_OR_URL_INVALID");
    }
  }
  const overall: ContactValidationDisposition = contactForm === "manual_review" || linkedin === "manual_action_required"
    ? "manual_review"
    : email === "invalid" || contactForm === "invalid" || linkedin === "invalid"
      ? "invalid"
      : "unverified";
  return { overall, email, contactForm, linkedin, reasons: [...new Set(reasons)] };
}
