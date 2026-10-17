import type { BacklinkRepositoryClient } from "../repositories/repositoryClient";
import { getBacklinkContactById } from "../repositories/contactsRepository";
import { claimContactFormVerificationPreflight, completeContactFormVerificationPreflight, completeVerifiedContactFormVerificationPreflightAtomically, type ContactFormVerificationPreflight } from "../repositories/contactFormVerificationPreflightRepository";
import { normalizeContactFormVerificationUrl } from "../repositories/contactFormAutomationRepository";
import { fetchContactFormStaticHtml, type ContactFormStaticHtmlResult } from "../http/contactFormStaticHtmlFetcher";
import { parseStaticContactFormHtml, type ContactFormStaticHtmlParseResult } from "./contactFormStaticHtmlParser";

type PreflightClaim = Awaited<ReturnType<typeof claimContactFormVerificationPreflight>>;
type Contact = Awaited<ReturnType<typeof getBacklinkContactById>>;

export type ContactFormVerificationPreflightDependencies = Readonly<{
  claim: (client: BacklinkRepositoryClient, input: { workspaceId: string; preflightId: string; workerId: string; startedAt: string }) => Promise<PreflightClaim>;
  getContact: (client: BacklinkRepositoryClient, workspaceId: string, contactId: string) => Promise<Contact>;
  complete: (client: BacklinkRepositoryClient, input: { workspaceId: string; preflightId: string; workerId: string; status: "manual_review" | "failed" | "blocked"; safeErrorCode?: string | null; completedAt: string }) => Promise<ContactFormVerificationPreflight>;
  completeVerifiedAtomically: typeof completeVerifiedContactFormVerificationPreflightAtomically;
  fetchStaticHtml: (url: string) => Promise<ContactFormStaticHtmlResult>;
  parseStaticHtml: (input: { finalUrl: string; html: string; contentType: string }) => ContactFormStaticHtmlParseResult;
}>;

const productionDependencies: ContactFormVerificationPreflightDependencies = {
  claim: claimContactFormVerificationPreflight,
  getContact: getBacklinkContactById,
  complete: completeContactFormVerificationPreflight,
  completeVerifiedAtomically: completeVerifiedContactFormVerificationPreflightAtomically,
  fetchStaticHtml: fetchContactFormStaticHtml,
  parseStaticHtml: parseStaticContactFormHtml,
};

const BLOCKED_FETCH_ERRORS = new Set([
  "CONTACT_FORM_STATIC_URL_INVALID", "CONTACT_FORM_STATIC_HTTPS_REQUIRED", "CONTACT_FORM_STATIC_CREDENTIALS_REJECTED", "CONTACT_FORM_STATIC_HOSTNAME_REJECTED", "CONTACT_FORM_STATIC_PORT_REJECTED", "CONTACT_FORM_STATIC_DNS_UNSAFE", "CONTACT_FORM_STATIC_REDIRECT_INVALID", "CONTACT_FORM_STATIC_REDIRECT_FORBIDDEN", "CONTACT_FORM_STATIC_REDIRECT_LIMIT",
]);

function completionForFetch(result: Extract<ContactFormStaticHtmlResult, { ok: false }>): { status: "failed" | "blocked"; safeErrorCode: string } {
  return { status: BLOCKED_FETCH_ERRORS.has(result.safeErrorCode) ? "blocked" : "failed", safeErrorCode: result.safeErrorCode };
}

/** Static-only preflight. It has no browser, navigation, proxy, or submission capability. */
export async function executeContactFormVerificationPreflight(input: {
  client: BacklinkRepositoryClient;
  workspaceId: string;
  preflightId: string;
  workerId: string;
  dependencies?: ContactFormVerificationPreflightDependencies;
}) {
  const deps = input.dependencies ?? productionDependencies;
  const claim = await deps.claim(input.client, { workspaceId: input.workspaceId, preflightId: input.preflightId, workerId: input.workerId, startedAt: new Date().toISOString() });
  const claimed = claim.preflight;
  if (!claim.claimed) return claimed;
  const contact = await deps.getContact(input.client, input.workspaceId, claimed.contact_id);
  const formUrl = normalizeContactFormVerificationUrl(contact.contact_form_url);
  if (formUrl == null || formUrl !== claimed.form_url) return deps.complete(input.client, { workspaceId: input.workspaceId, preflightId: claimed.id, workerId: input.workerId, status: "blocked", safeErrorCode: "CONTACT_FORM_PREFLIGHT_FORM_MISMATCH", completedAt: new Date().toISOString() });

  const fetched = await deps.fetchStaticHtml(formUrl);
  if (!fetched.ok) {
    const completion = completionForFetch(fetched);
    return deps.complete(input.client, { workspaceId: input.workspaceId, preflightId: claimed.id, workerId: input.workerId, ...completion, completedAt: new Date().toISOString() });
  }
  const parsed = deps.parseStaticHtml({ finalUrl: fetched.finalUrl, html: fetched.html, contentType: fetched.contentType });
  if (parsed.status !== "verified" || parsed.evidence?.ok !== true) return deps.complete(input.client, { workspaceId: input.workspaceId, preflightId: claimed.id, workerId: input.workerId, status: parsed.status === "manual_review" ? "manual_review" : "failed", safeErrorCode: parsed.safeReasonCode ?? "CONTACT_FORM_STATIC_PARSE_UNVERIFIED", completedAt: new Date().toISOString() });

  const completedAt = new Date().toISOString();
  return deps.completeVerifiedAtomically(input.client, { workspaceId: input.workspaceId, preflightId: claimed.id, workerId: input.workerId, contactId: contact.id, formUrl, verifiedAt: completedAt, evidenceVersion: parsed.evidence.evidenceVersion, safeEvidence: parsed.evidence.safeEvidence, completedAt });
}
