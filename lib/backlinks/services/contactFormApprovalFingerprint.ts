import { createHash } from "node:crypto";

export const CONTACT_FORM_FINGERPRINT_VERSION = "cf1" as const;

export type ContactFormApprovalFingerprintInput = Readonly<{
  workspaceId: string;
  campaignId: string;
  outreachId: string;
  contactId: string;
  opportunityId: string;
  targetUrl: string;
  formUrl: string;
  senderName: string;
  senderEmail: string;
  senderCompany: string;
  senderWebsite: string;
  subject: string;
  body: string;
}>;

const normalize = (value: string) => value.trim();

export function buildContactFormApprovalFingerprint(input: ContactFormApprovalFingerprintInput): string {
  const values = [
    CONTACT_FORM_FINGERPRINT_VERSION,
    input.workspaceId, input.campaignId, input.outreachId, input.contactId, input.opportunityId,
    input.targetUrl, input.formUrl, input.senderName, input.senderEmail, input.senderCompany,
    input.senderWebsite, input.subject, input.body,
  ].map(normalize);
  return `${CONTACT_FORM_FINGERPRINT_VERSION}_${createHash("sha256").update(JSON.stringify(values)).digest("hex")}`;
}
