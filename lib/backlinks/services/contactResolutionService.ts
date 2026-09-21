import { load } from "cheerio";
import { createHash } from "node:crypto";

import { extractHtmlAnchors, parseHtmlDocument } from "../html";
import { fetchHttp } from "../http";
import { BacklinkRepositoryError } from "../repositories/errors";
import type { ContactInput } from "./contactService";

export type ContactResolutionEvidenceKind = "mailto" | "visible_email" | "contact_form" | "linkedin";
export type ContactResolutionStatus = "resolved" | "partial" | "no_contact_found" | "ambiguous" | "blocked" | "failed";

export type ContactResolutionEvidence = {
  kind: ContactResolutionEvidenceKind;
  value: string;
  sourceUrl: string;
  confidence: "strong" | "medium";
};

export type ContactResolutionCandidate = {
  email: string | null;
  contactFormUrl: string | null;
  linkedinUrl: string | null;
  evidence: readonly ContactResolutionEvidence[];
};

export type ContactResolutionPage = {
  url: string;
  status: number;
  contentType: string | null;
  body: string;
};

export type ContactResolutionFetcher = (url: string) => Promise<ContactResolutionPage>;

/**
 * Production adapter for a future worker. It deliberately reuses the existing
 * DNS/private-address, redirect, timeout, and response-size protections in
 * fetchHttp; constructing it does not make a request.
 */
export function createSafeContactResolutionFetcher(input: {
  timeoutMs?: number;
  maxBytes?: number;
} = {}): ContactResolutionFetcher {
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxResponseBytes = input.maxBytes ?? DEFAULT_MAX_BYTES;
  return async (url) => {
    const response = await fetchHttp({
      url,
      timeoutMs,
      maxRedirects: 2,
      maxResponseBytes,
      userAgent: "NorixoBacklinksContactResolution/1.0",
    });
    return {
      url: response.finalUrl,
      status: response.status,
      contentType: response.contentType,
      body: response.body,
    };
  };
}

export type ContactResolutionInput = {
  homepageUrl: string;
  domainHostname: string;
  fetchPage: ContactResolutionFetcher;
  maxPages?: number;
  maxBytes?: number;
  requestTimeoutMs?: number;
};

export type ContactResolutionResult = {
  status: ContactResolutionStatus;
  inspectedUrls: readonly string[];
  candidates: readonly ContactResolutionCandidate[];
  reasons: readonly string[];
};

export type ResolvedContactPersistenceInput = Pick<
  ContactInput,
  "domain_id" | "contact_key" | "email_normalized" | "linkedin_url" | "contact_form_url" | "contact_status" | "source_type" | "source_reference"
>;

export type ResolvedContactIdentity = {
  channel: "email" | "contact_form" | "linkedin";
  value: string;
  scopedIdentity: string;
  contactKey: string;
  candidate: ContactResolutionCandidate;
};

export type ExistingResolvedContact = {
  id: string;
  workspace_id?: string;
  domain_id?: string;
  contact_status: string;
  email_normalized: string | null;
  linkedin_url: string | null;
  contact_form_url: string | null;
};

export type ResolvedContactPersistenceResult = {
  id: string;
  disposition: "created" | "reused";
};

export class ResolvedContactPersistenceError extends Error {
  constructor(readonly code: "CONTACT_IDENTITY_INVALID" | "CONTACT_IDENTITY_CONFLICT") {
    super(code);
  }
}

const DEFAULT_MAX_PAGES = 6;
const DEFAULT_MAX_BYTES = 750_000;
const DEFAULT_TIMEOUT_MS = 8_000;
const RELEVANT_PATH = /\/(?:contact|about(?:-us)?|team|editorial|write-for-us|contribute|advertise|press)(?:\/|$)/i;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

/**
 * Converts explicit evidence into the existing contact-service input shape.
 * The caller owns duplicate checks and key allocation; this helper deliberately
 * cannot invent either, and has no persistence side effect.
 */
export function buildEvidenceBackedContactInput(input: {
  domainId: string;
  contactKey: string;
  candidate: ContactResolutionCandidate;
}): ResolvedContactPersistenceInput | null {
  if (input.candidate.evidence.length === 0 || (!input.candidate.email && !input.candidate.linkedinUrl && !input.candidate.contactFormUrl)) return null;
  return {
    domain_id: input.domainId,
    contact_key: input.contactKey,
    email_normalized: input.candidate.email,
    linkedin_url: input.candidate.linkedinUrl,
    contact_form_url: input.candidate.contactFormUrl,
    contact_status: "unverified",
    source_type: "public_website",
    source_reference: JSON.stringify(input.candidate.evidence),
  };
}

function canonicalHttpsUrl(value: string | null): string | null {
  if (value == null) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password) return null;
    url.protocol = "https:";
    url.hostname = url.hostname.toLowerCase();
    url.hash = "";
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Establishes one canonical, scoped resolver identity. Resolver candidates
 * normally carry one channel; accepting several would make reuse ambiguous.
 */
export function resolveCanonicalContactIdentity(input: {
  workspaceId: string;
  domainId: string;
  candidate: ContactResolutionCandidate;
}): ResolvedContactIdentity | null {
  const suppliedChannels = [input.candidate.email, input.candidate.contactFormUrl, input.candidate.linkedinUrl]
    .filter((value) => value != null).length;
  const email = input.candidate.email == null ? null : normalizeEmail(input.candidate.email);
  const contactFormUrl = canonicalHttpsUrl(input.candidate.contactFormUrl);
  const linkedinUrl = canonicalHttpsUrl(input.candidate.linkedinUrl);
  const identities = [
    email == null ? null : { channel: "email" as const, value: email },
    contactFormUrl == null ? null : { channel: "contact_form" as const, value: contactFormUrl },
    linkedinUrl == null ? null : { channel: "linkedin" as const, value: linkedinUrl },
  ].filter((value): value is { channel: "email" | "contact_form" | "linkedin"; value: string } => value != null);
  if (!input.workspaceId || !input.domainId || suppliedChannels !== 1 || identities.length !== 1) return null;

  const identity = identities[0]!;
  if (identity.channel === "linkedin") {
    const hostname = new URL(identity.value).hostname;
    if (hostname !== "linkedin.com" && !hostname.endsWith(".linkedin.com")) return null;
  }
  const scopedIdentity = `${input.workspaceId}:${input.domainId}:${identity.channel}:${identity.value}`;
  // BigInt retains the full digest entropy without unsafe-number conversion.
  const numericDigest = BigInt(`0x${createHash("sha256").update(scopedIdentity).digest("hex")}`).toString(10);
  const candidate: ContactResolutionCandidate = {
    email: identity.channel === "email" ? identity.value : null,
    contactFormUrl: identity.channel === "contact_form" ? identity.value : null,
    linkedinUrl: identity.channel === "linkedin" ? identity.value : null,
    evidence: input.candidate.evidence,
  };
  return { ...identity, scopedIdentity, contactKey: `CT-${numericDigest}`, candidate };
}

function exactCompatibleContacts(
  identity: ResolvedContactIdentity,
  contacts: readonly ExistingResolvedContact[],
  workspaceId: string,
  domainId: string,
): ExistingResolvedContact[] {
  return contacts.filter((contact) => {
    if ((contact.workspace_id != null && contact.workspace_id !== workspaceId) || (contact.domain_id != null && contact.domain_id !== domainId)) return false;
    if (identity.channel === "email") return normalizeEmail(contact.email_normalized ?? "") === identity.value;
    if (identity.channel === "contact_form") return canonicalHttpsUrl(contact.contact_form_url) === identity.value;
    return canonicalHttpsUrl(contact.linkedin_url) === identity.value;
  });
}

function exactlyOneCompatibleContact(
  identity: ResolvedContactIdentity,
  contacts: readonly ExistingResolvedContact[],
  workspaceId: string,
  domainId: string,
): ExistingResolvedContact | null {
  const matches = exactCompatibleContacts(identity, contacts, workspaceId, domainId);
  if (matches.length > 1) throw new ResolvedContactPersistenceError("CONTACT_IDENTITY_CONFLICT");
  return matches[0] ?? null;
}

/**
 * Creates through the canonical contact service, or reuses only one proven
 * same-scope, same-channel identity. It never resolves a key collision by row
 * order, mutation, or a new random key.
 */
export async function persistOrReuseEvidenceBackedResolvedContact(input: {
  workspaceId: string;
  domainId: string;
  actorUserId: string;
  candidate: ContactResolutionCandidate;
  listContactsByDomain: (workspaceId: string, domainId: string) => Promise<readonly ExistingResolvedContact[]>;
  createContact: (workspaceId: string, actorUserId: string, input: ContactInput) => Promise<{ id: string }>;
}): Promise<ResolvedContactPersistenceResult> {
  const identity = resolveCanonicalContactIdentity(input);
  if (identity == null) throw new ResolvedContactPersistenceError("CONTACT_IDENTITY_INVALID");

  const existing = exactlyOneCompatibleContact(
    identity,
    await input.listContactsByDomain(input.workspaceId, input.domainId),
    input.workspaceId,
    input.domainId,
  );
  if (existing != null) return { id: existing.id, disposition: "reused" };

  const persistenceInput = buildEvidenceBackedContactInput({
    domainId: input.domainId,
    contactKey: identity.contactKey,
    candidate: identity.candidate,
  });
  if (persistenceInput == null) throw new ResolvedContactPersistenceError("CONTACT_IDENTITY_INVALID");
  try {
    const created = await input.createContact(input.workspaceId, input.actorUserId, persistenceInput);
    return { id: created.id, disposition: "created" };
  } catch (error) {
    if (!(error instanceof BacklinkRepositoryError) || error.code !== "CONFLICT") throw error;
  }

  const reread = exactlyOneCompatibleContact(
    identity,
    await input.listContactsByDomain(input.workspaceId, input.domainId),
    input.workspaceId,
    input.domainId,
  );
  if (reread == null) throw new ResolvedContactPersistenceError("CONTACT_IDENTITY_CONFLICT");
  return { id: reread.id, disposition: "reused" };
}

/** Uses the existing contact-service abstraction; invocation remains opt-in. */
export async function persistEvidenceBackedResolvedContact<T>(
  createContact: (input: ResolvedContactPersistenceInput) => Promise<T>,
  input: ResolvedContactPersistenceInput | null,
): Promise<T | null> {
  return input ? createContact(input) : null;
}

function hostname(value: string): string | null {
  try {
    const result = new URL(value);
    return result.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function sameOriginHttpUrl(value: string, origin: URL, expectedHostname: string): string | null {
  try {
    const url = new URL(value, origin);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    if (url.hostname.toLowerCase().replace(/^www\./, "") !== expectedHostname) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeEmail(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalized) ? normalized : null;
}

function isOfficialDomainEmail(email: string, expectedHostname: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase().replace(/^www\./, "") ?? "";
  return domain === expectedHostname || domain.endsWith(`.${expectedHostname}`);
}

function addEvidence(
  map: Map<string, ContactResolutionCandidate>,
  evidence: ContactResolutionEvidence,
): void {
  const key = evidence.kind === "contact_form" ? `form:${evidence.value}` : evidence.kind === "linkedin" ? `linkedin:${evidence.value}` : `email:${evidence.value}`;
  const current = map.get(key);
  const candidate: ContactResolutionCandidate = current ?? {
    email: evidence.kind === "mailto" || evidence.kind === "visible_email" ? evidence.value : null,
    contactFormUrl: evidence.kind === "contact_form" ? evidence.value : null,
    linkedinUrl: evidence.kind === "linkedin" ? evidence.value : null,
    evidence: [],
  };
  if (!candidate.evidence.some((item) => item.kind === evidence.kind && item.sourceUrl === evidence.sourceUrl && item.value === evidence.value)) {
    map.set(key, { ...candidate, evidence: [...candidate.evidence, evidence] });
  }
}

function pageEvidence(page: ContactResolutionPage, origin: URL, expectedHostname: string, candidates: Map<string, ContactResolutionCandidate>): string[] {
  const document = parseHtmlDocument({ url: page.url, status: page.status, contentType: page.contentType, body: page.body, fetchedAt: "" });
  if (!document.isHtml || document.isEmpty) return [];
  const anchors = extractHtmlAnchors(document).anchors;
  const $ = load(document.html);
  // Cheerio's aggregate .text() can concatenate adjacent element text (for
  // example "Email" + "editor@example.com") into a false address. Preserve
  // a separator between individual text nodes before applying email matching.
  const text = $("body, body *").contents().toArray()
    .filter((node) => node.type === "text")
    .map((node) => $(node).text())
    .join(" ")
    .replace(/\s+/g, " ");
  for (const match of text.matchAll(EMAIL)) {
    const email = normalizeEmail(match[0]);
    if (email && isOfficialDomainEmail(email, expectedHostname)) addEvidence(candidates, { kind: "visible_email", value: email, sourceUrl: page.url, confidence: "strong" });
  }
  const discovered: string[] = [];
  for (const anchor of anchors) {
    const href = anchor.href?.trim() ?? "";
    if (href.toLowerCase().startsWith("mailto:")) {
      const email = normalizeEmail(href.slice("mailto:".length).split("?", 1)[0] ?? "");
      if (email && isOfficialDomainEmail(email, expectedHostname)) addEvidence(candidates, { kind: "mailto", value: email, sourceUrl: page.url, confidence: "strong" });
      continue;
    }
    let absolute: URL;
    try { absolute = new URL(href, origin); } catch { continue; }
    if (absolute.hostname.toLowerCase().replace(/^www\./, "") === "linkedin.com" || absolute.hostname.toLowerCase().endsWith(".linkedin.com")) {
      if (/^\/(?:in|company)\//i.test(absolute.pathname)) addEvidence(candidates, { kind: "linkedin", value: absolute.toString(), sourceUrl: page.url, confidence: "medium" });
      continue;
    }
    const safe = sameOriginHttpUrl(href, origin, expectedHostname);
    if (!safe) continue;
    if (RELEVANT_PATH.test(new URL(safe).pathname) || /contact|editorial|team|write for us|contribute|advertise|press/i.test(`${anchor.text} ${anchor.title ?? ""}`)) discovered.push(safe);
  }
  const forms = $("form").toArray();
  if (forms.length === 1) addEvidence(candidates, { kind: "contact_form", value: page.url, sourceUrl: page.url, confidence: "medium" });
  if (forms.length > 1) discovered.push("AMBIGUOUS_FORM");
  return discovered;
}

async function fetchWithinTimeout(
  fetchPage: ContactResolutionFetcher,
  url: string,
  timeoutMs: number,
): Promise<ContactResolutionPage> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fetchPage(url),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("FETCH_TIMEOUT")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer != null) clearTimeout(timer);
  }
}

/**
 * Resolves only explicit, public evidence. It never guesses addresses, persists
 * candidates, or follows cross-origin/private/non-HTTP URLs.
 */
export async function resolveBacklinkContacts(input: ContactResolutionInput): Promise<ContactResolutionResult> {
  const expectedHostname = input.domainHostname.trim().toLowerCase().replace(/^www\./, "");
  let homepageOrigin: URL;
  try {
    homepageOrigin = new URL(input.homepageUrl);
  } catch {
    return { status: "blocked", inspectedUrls: [], candidates: [], reasons: ["INVALID_OR_UNSAFE_INPUT"] };
  }
  const homepage = sameOriginHttpUrl(input.homepageUrl, homepageOrigin, expectedHostname);
  const maxPages = input.maxPages ?? DEFAULT_MAX_PAGES;
  const maxBytes = input.maxBytes ?? DEFAULT_MAX_BYTES;
  const requestTimeoutMs = input.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!homepage || !expectedHostname || !Number.isInteger(maxPages) || maxPages < 1 || maxPages > 12 || !Number.isInteger(maxBytes) || maxBytes < 1 || !Number.isInteger(requestTimeoutMs) || requestTimeoutMs < 100 || requestTimeoutMs > 30_000) {
    return { status: "blocked", inspectedUrls: [], candidates: [], reasons: ["INVALID_OR_UNSAFE_INPUT"] };
  }
  const queue = [homepage];
  const inspected = new Set<string>();
  const candidates = new Map<string, ContactResolutionCandidate>();
  const reasons: string[] = [];
  let ambiguous = false;
  while (queue.length && inspected.size < maxPages) {
    const url = queue.shift()!;
    if (url === "AMBIGUOUS_FORM" || inspected.has(url)) continue;
    inspected.add(url);
    let page: ContactResolutionPage;
    try {
      page = await fetchWithinTimeout(input.fetchPage, url, requestTimeoutMs);
    } catch { reasons.push("FETCH_FAILED"); continue; }
    if (page.status < 200 || page.status >= 300 || Buffer.byteLength(page.body, "utf8") > maxBytes) { reasons.push("PAGE_SKIPPED"); continue; }
    const finalHostname = hostname(page.url);
    if (finalHostname !== expectedHostname) { reasons.push("CROSS_ORIGIN_REDIRECT_SKIPPED"); continue; }
    const found = pageEvidence(page, new URL(page.url), expectedHostname, candidates);
    if (found.includes("AMBIGUOUS_FORM")) ambiguous = true;
    for (const next of found) if (next !== "AMBIGUOUS_FORM" && !inspected.has(next) && !queue.includes(next)) queue.push(next);
  }
  if (queue.length) reasons.push("PAGE_LIMIT_REACHED");
  const values = [...candidates.values()].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const status: ContactResolutionStatus = ambiguous && values.length === 0 ? "ambiguous" : values.length === 0 ? (reasons.includes("FETCH_FAILED") ? "failed" : "no_contact_found") : ambiguous || reasons.includes("PAGE_LIMIT_REACHED") ? "partial" : "resolved";
  return { status, inspectedUrls: [...inspected], candidates: values, reasons: [...new Set(reasons)] };
}
