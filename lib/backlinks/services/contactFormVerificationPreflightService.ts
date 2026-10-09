import { buildContactFormMappingPreview, type ContactFormDiscoveredPage } from "./contactFormMappingPreview";
import { buildContactFormVerificationEvidenceFromRuntime } from "./contactFormVerificationRuntimeAdapter";

/** Deliberately reduced browser surface: this preflight cannot fill or submit. */
export type ContactFormVerificationPreflightPage = Readonly<{
  goto: (url: string, options: { timeoutMs: number }) => Promise<void>;
  url: () => string;
  evaluatePageSignals: () => Promise<{ hasCaptcha: boolean; hasLoginWall: boolean; hasPasswordField: boolean }>;
  inspectForms: () => Promise<ContactFormDiscoveredPage>;
  listSubmitControls: (formOrdinal: number) => Promise<readonly { formOrdinal: number; controlOrdinal: number; tag: string; type: string; name: string | null; id: string | null; visible: boolean; enabled: boolean; disabled: boolean; hidden: boolean; fingerprint: string }[]>;
}>;

export type ContactFormVerificationPreflightResult =
  | { status: "verified"; evidenceVersion: string; safeEvidence: Record<string, boolean | number> }
  | { status: "manual_review" | "failed" | "blocked"; safeErrorCode: string };

export async function inspectContactFormVerificationPreflight(input: { page: ContactFormVerificationPreflightPage; formUrl: string; navigationTimeoutMs?: number }): Promise<ContactFormVerificationPreflightResult> {
  try { await input.page.goto(input.formUrl, { timeoutMs: input.navigationTimeoutMs ?? 15_000 }); }
  catch { return { status: "failed", safeErrorCode: "CONTACT_FORM_NAVIGATION_FAILED" }; }
  const signals = await input.page.evaluatePageSignals();
  if (signals.hasCaptcha) return { status: "manual_review", safeErrorCode: "CONTACT_FORM_CAPTCHA_DETECTED" };
  if (signals.hasLoginWall || signals.hasPasswordField) return { status: "manual_review", safeErrorCode: "CONTACT_FORM_LOGIN_WALL_DETECTED" };
  const page = await input.page.inspectForms();
  // Structural placeholders are never filled or transmitted; mapping needs only field shapes.
  const mapping = buildContactFormMappingPreview({ page, approvedContent: { senderName: "Verification", senderFirstName: "Verification", senderLastName: "Only", senderEmail: "preflight@example.invalid", senderCompany: "Norixo", senderWebsite: "https://norixo.io/", subject: "Structural verification", body: "Structural verification only." }, pageSignals: signals });
  if (mapping.selectedFormOrdinal == null) return { status: "blocked", safeErrorCode: "CONTACT_FORM_NOT_MAPPABLE" };
  const evidence = buildContactFormVerificationEvidenceFromRuntime({ page, mapping, pageSignals: signals, submitControls: await input.page.listSubmitControls(mapping.selectedFormOrdinal) });
  if (!evidence.ok) return { status: "blocked", safeErrorCode: `CONTACT_FORM_EVIDENCE_${evidence.reason.toUpperCase()}` };
  return { status: "verified", evidenceVersion: evidence.evidenceVersion, safeEvidence: evidence.safeEvidence };
}
