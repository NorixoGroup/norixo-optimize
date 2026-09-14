import { createHash } from "node:crypto";

export const CONTACT_FORM_FINGERPRINT_VERSION = "cf1" as const;
export const CONTACT_FORM_SPLIT_IDENTITY_FINGERPRINT_VERSION = "cf2" as const;

export type ContactFormApprovalFingerprintInput = Readonly<{
  workspaceId: string;
  campaignId: string;
  outreachId: string;
  contactId: string;
  opportunityId: string;
  targetUrl: string;
  formUrl: string;
  senderName: string;
  senderFirstName?: string | null;
  senderLastName?: string | null;
  senderEmail: string;
  senderCompany: string;
  senderWebsite: string;
  subject: string;
  body: string;
}>;

const normalize = (value: string) => value.trim();
const normalizeOptional = (value: string | null | undefined) => {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
};

export function buildContactFormApprovalFingerprint(input: ContactFormApprovalFingerprintInput): string {
  const senderFirstName = normalizeOptional(input.senderFirstName);
  const senderLastName = normalizeOptional(input.senderLastName);
  if (senderFirstName == null && senderLastName == null) {
    const values = [
      CONTACT_FORM_FINGERPRINT_VERSION,
      input.workspaceId, input.campaignId, input.outreachId, input.contactId, input.opportunityId,
      input.targetUrl, input.formUrl, input.senderName, input.senderEmail, input.senderCompany,
      input.senderWebsite, input.subject, input.body,
    ].map(normalize);
    return `${CONTACT_FORM_FINGERPRINT_VERSION}_${createHash("sha256").update(JSON.stringify(values)).digest("hex")}`;
  }
  const values = [
    CONTACT_FORM_SPLIT_IDENTITY_FINGERPRINT_VERSION,
    input.workspaceId, input.campaignId, input.outreachId, input.contactId, input.opportunityId,
    input.targetUrl, input.formUrl, input.senderName, senderFirstName ?? "", senderLastName ?? "",
    input.senderEmail, input.senderCompany, input.senderWebsite, input.subject, input.body,
  ].map(normalize);
  return `${CONTACT_FORM_SPLIT_IDENTITY_FINGERPRINT_VERSION}_${createHash("sha256").update(JSON.stringify(values)).digest("hex")}`;
}
