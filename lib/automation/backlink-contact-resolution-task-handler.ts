import {
  buildEvidenceBackedContactInput,
  createSafeContactResolutionFetcher,
  persistEvidenceBackedResolvedContact,
  resolveBacklinkContacts,
  type ContactResolutionCandidate,
  type ContactResolutionFetcher,
  type ContactResolutionResult,
  type ResolvedContactPersistenceInput,
} from "@/lib/backlinks/services/contactResolutionService";
import type { ContactInput } from "@/lib/backlinks/services/contactService";

export type BacklinkContactResolutionTaskInput = {
  workspaceId: string;
  domainId: string;
  opportunityId: string;
  actorUserId: string;
};

type ExistingContact = {
  id: string;
  contact_status: string;
  email_normalized: string | null;
  linkedin_url: string | null;
  contact_form_url: string | null;
};

type ResolutionDomain = {
  id: string;
  workspace_id?: string;
  hostname: string;
  lifecycle_status?: string;
  archived_at?: string | null;
};

type ResolutionOpportunity = {
  id: string;
  workspace_id?: string;
  domain_id: string;
  lifecycle_status?: string;
  archived_at?: string | null;
};

export type BacklinkContactResolutionTaskDependencies = {
  getDomain: (workspaceId: string, domainId: string) => Promise<ResolutionDomain>;
  getOpportunity: (workspaceId: string, opportunityId: string) => Promise<ResolutionOpportunity>;
  listContactsByDomain: (workspaceId: string, domainId: string) => Promise<readonly ExistingContact[]>;
  /** Must be backed by a collision-safe canonical allocator before production wiring. */
  allocateContactKey: () => Promise<string>;
  createContact: (workspaceId: string, actorUserId: string, input: ContactInput) => Promise<{ id: string }>;
  fetchPage?: ContactResolutionFetcher;
  resolve?: (input: Parameters<typeof resolveBacklinkContacts>[0]) => Promise<ContactResolutionResult>;
};

export type BacklinkContactResolutionTaskResult = {
  status: ContactResolutionResult["status"];
  domainId: string;
  opportunityId: string;
  inspectedUrlCount: number;
  candidateCount: number;
  createdContactIds: readonly string[];
  existingContactIds: readonly string[];
  hasEmailCandidate: boolean;
  hasContactFormCandidate: boolean;
  hasLinkedInCandidate: boolean;
  manualReviewRequired: boolean;
  reasons: readonly string[];
};

export class BacklinkContactResolutionTaskError extends Error {
  constructor(readonly code: "CONTACT_RESOLUTION_FETCH_FAILED" | "CONTACT_RESOLUTION_TASK_INVALID") {
    super(code);
  }
}

function normalizedUrl(value: string | null): string | null {
  if (value == null) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase();
    url.hash = "";
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch {
    return null;
  }
}

function existingContactForCandidate(
  candidate: ContactResolutionCandidate,
  contacts: readonly ExistingContact[],
): ExistingContact | null {
  const email = candidate.email?.toLowerCase() ?? null;
  const linkedinUrl = normalizedUrl(candidate.linkedinUrl);
  const contactFormUrl = normalizedUrl(candidate.contactFormUrl);
  return contacts.find((contact) =>
    (email != null && contact.email_normalized?.toLowerCase() === email) ||
    (linkedinUrl != null && normalizedUrl(contact.linkedin_url) === linkedinUrl) ||
    (contactFormUrl != null && normalizedUrl(contact.contact_form_url) === contactFormUrl),
  ) ?? null;
}

function terminalResult(
  input: BacklinkContactResolutionTaskInput,
  status: ContactResolutionResult["status"],
  reasons: readonly string[],
): BacklinkContactResolutionTaskResult {
  return {
    status,
    domainId: input.domainId,
    opportunityId: input.opportunityId,
    inspectedUrlCount: 0,
    candidateCount: 0,
    createdContactIds: [],
    existingContactIds: [],
    hasEmailCandidate: false,
    hasContactFormCandidate: false,
    hasLinkedInCandidate: false,
    manualReviewRequired: status === "ambiguous" || status === "blocked",
    reasons,
  };
}

/**
 * Executes no downstream workflow. A failed fetch is thrown so the existing
 * AutomationTask worker owns bounded retry/backoff/dead-letter transitions.
 */
export async function executeBacklinkContactResolutionTask(
  dependencies: BacklinkContactResolutionTaskDependencies,
  input: BacklinkContactResolutionTaskInput,
): Promise<BacklinkContactResolutionTaskResult> {
  if (!input.workspaceId || !input.domainId || !input.opportunityId || !input.actorUserId) {
    throw new BacklinkContactResolutionTaskError("CONTACT_RESOLUTION_TASK_INVALID");
  }
  const [domain, opportunity] = await Promise.all([
    dependencies.getDomain(input.workspaceId, input.domainId),
    dependencies.getOpportunity(input.workspaceId, input.opportunityId),
  ]);
  if (
    domain.id !== input.domainId ||
    opportunity.id !== input.opportunityId ||
    opportunity.domain_id !== domain.id ||
    (domain.workspace_id != null && domain.workspace_id !== input.workspaceId) ||
    (opportunity.workspace_id != null && opportunity.workspace_id !== input.workspaceId) ||
    domain.lifecycle_status === "archived" || domain.archived_at != null ||
    opportunity.lifecycle_status === "archived" || opportunity.archived_at != null
  ) {
    return terminalResult(input, "blocked", ["WORKSPACE_OR_DOMAIN_OPPORTUNITY_MISMATCH"]);
  }

  const resolve = dependencies.resolve ?? resolveBacklinkContacts;
  const resolution = await resolve({
    homepageUrl: `https://${domain.hostname}`,
    domainHostname: domain.hostname,
    fetchPage: dependencies.fetchPage ?? createSafeContactResolutionFetcher({ maxBytes: 500_000, timeoutMs: 6_000 }),
    maxPages: 6,
    maxBytes: 500_000,
    requestTimeoutMs: 6_000,
  });
  if (resolution.status === "failed") {
    throw new BacklinkContactResolutionTaskError("CONTACT_RESOLUTION_FETCH_FAILED");
  }
  if (resolution.status === "blocked" || resolution.status === "ambiguous" || resolution.status === "no_contact_found") {
    return {
      ...terminalResult(input, resolution.status, resolution.reasons),
      inspectedUrlCount: resolution.inspectedUrls.length,
    };
  }

  const contacts = await dependencies.listContactsByDomain(input.workspaceId, input.domainId);
  const createdContactIds: string[] = [];
  const existingContactIds: string[] = [];
  for (const candidate of resolution.candidates) {
    const existing = existingContactForCandidate(candidate, contacts);
    if (existing != null) {
      existingContactIds.push(existing.id);
      continue;
    }
    const contactKey = await dependencies.allocateContactKey();
    const persistenceInput = buildEvidenceBackedContactInput({ domainId: input.domainId, contactKey, candidate });
    const created = await persistEvidenceBackedResolvedContact(
      (contactInput: ResolvedContactPersistenceInput) => dependencies.createContact(input.workspaceId, input.actorUserId, contactInput),
      persistenceInput,
    );
    if (created != null) createdContactIds.push(created.id);
  }
  return {
    status: resolution.status,
    domainId: input.domainId,
    opportunityId: input.opportunityId,
    inspectedUrlCount: resolution.inspectedUrls.length,
    candidateCount: resolution.candidates.length,
    createdContactIds,
    existingContactIds: [...new Set(existingContactIds)],
    hasEmailCandidate: resolution.candidates.some((candidate) => candidate.email != null),
    hasContactFormCandidate: resolution.candidates.some((candidate) => candidate.contactFormUrl != null),
    hasLinkedInCandidate: resolution.candidates.some((candidate) => candidate.linkedinUrl != null),
    manualReviewRequired: resolution.status === "partial",
    reasons: resolution.reasons,
  };
}
