import { createHash } from "node:crypto";

export const CONTACT_SELECTION_REASON_CODES = [
  "HUMAN_REVIEW_SELECTED",
  "HUMAN_REVIEW_REJECTED_INSUFFICIENT_EVIDENCE",
  "HUMAN_REVIEW_REJECTED_NO_APPROPRIATE_CONTACT",
  "HUMAN_REVIEW_REJECTED_POLICY_CONSTRAINT",
] as const;

export type ContactSelectionReasonCode = (typeof CONTACT_SELECTION_REASON_CODES)[number];
export type ContactSelectionMailboxState = "verified" | "risky" | "undeliverable" | "unknown" | "provider_error" | "running" | "indeterminate" | "exhausted" | "unverified";
export type ContactSelectionFormState = "pending" | "running" | "verified" | "manual_review" | "failed" | "blocked" | "not_applicable";

export const CONTACT_EVIDENCE_KINDS = ["mailto", "visible_email", "contact_form", "linkedin"] as const;
export type ContactEvidenceKind = (typeof CONTACT_EVIDENCE_KINDS)[number];
export const CONTACT_EVIDENCE_CONFIDENCES = ["strong", "medium"] as const;
export type ContactEvidenceConfidence = (typeof CONTACT_EVIDENCE_CONFIDENCES)[number];
export type ContactEvidenceSummaryItem = { kind: ContactEvidenceKind; confidence: ContactEvidenceConfidence; count: number };
export type LinkedInProfileKind = "person" | "company" | "unknown" | "not_applicable";

export const CONTACT_SELECTION_MAILBOX_KINDS = ["generic_mailbox", "possibly_personal_mailbox", "unknown"] as const;
export type ContactSelectionMailboxKind = (typeof CONTACT_SELECTION_MAILBOX_KINDS)[number];

export type ContactSelectionCandidate = {
  id: string;
  fullName: string | null;
  roleTitle: string | null;
  channels: { email: boolean; contactForm: boolean; linkedIn: boolean };
  contactStatus: "unverified" | "verified" | "archived" | "do_not_contact";
  evidenceSummary: ContactEvidenceSummaryItem[];
  linkedinProfileKind: LinkedInProfileKind;
  mailboxKind: ContactSelectionMailboxKind;
  mailboxState: ContactSelectionMailboxState;
  contactFormState: ContactSelectionFormState;
  selectable: boolean;
  blockingCodes: string[];
};

export type ContactSelectionCase = {
  promotionApplicationId: string;
  sourceResolutionTaskId: string;
  sourceAutonomyRunId: string;
  candidateFingerprint: string;
  candidateCount: number;
  decision: null | { status: "contact_selected" | "promotion_rejected"; reasonCode: ContactSelectionReasonCode; decidedAt: string };
  candidates: ContactSelectionCandidate[];
};

export type ContactSelectionDecisionInput = {
  promotionApplicationId: string;
  sourceResolutionTaskId: string;
  selectedContactId: string | null;
  candidateFingerprint: string;
  idempotencyKey: string;
  reasonCode: ContactSelectionReasonCode;
  confirm: true;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FINGERPRINT = /^[a-f0-9]{64}$/;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export function candidateFingerprint(input: { workspaceId: string; promotionApplicationId: string; sourceResolutionTaskId: string; candidateIds: readonly string[] }): string {
  const candidates = [...input.candidateIds].sort().join(",");
  return createHash("sha256").update(
    `backlink-contact-selection-v1|workspace=${input.workspaceId}|promotion=${input.promotionApplicationId}|task=${input.sourceResolutionTaskId}|candidates=${candidates}`,
    "utf8",
  ).digest("hex");
}

export function parseCandidateIds(output: unknown): string[] | null {
  if (typeof output !== "object" || output == null || Array.isArray(output)) return null;
  const value = output as Record<string, unknown>;
  const created = value.createdContactIds;
  const existing = value.existingContactIds;
  if (!Array.isArray(created) || !Array.isArray(existing)) return null;
  const ids = [...created, ...existing];
  if (ids.length < 2 || ids.length > 100 || !ids.every(isUuid)) return null;
  const unique = [...new Set(ids.map((id) => id.toLowerCase()))].sort();
  return unique.length === ids.length ? unique : null;
}

function isContactEvidenceKind(value: unknown): value is ContactEvidenceKind {
  return typeof value === "string" && (CONTACT_EVIDENCE_KINDS as readonly string[]).includes(value);
}

function isContactEvidenceConfidence(value: unknown): value is ContactEvidenceConfidence {
  return typeof value === "string" && (CONTACT_EVIDENCE_CONFIDENCES as readonly string[]).includes(value);
}

const MAX_EVIDENCE_SOURCE_LENGTH = 20_000;
const MAX_EVIDENCE_ITEMS = 50;

/**
 * source_reference is free text (also writable via the manual contact-creation
 * route), never a jsonb column, so this must never throw on malformed input
 * and must never let an unrecognized shape through as evidence.
 */
export function parseContactEvidenceSummary(sourceReference: unknown): ContactEvidenceSummaryItem[] {
  if (typeof sourceReference !== "string") return [];
  const trimmed = sourceReference.trim();
  if (!trimmed || trimmed.length > MAX_EVIDENCE_SOURCE_LENGTH) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const counts = new Map<string, number>();
  for (const item of parsed.slice(0, MAX_EVIDENCE_ITEMS)) {
    if (typeof item !== "object" || item == null || Array.isArray(item)) continue;
    const { kind, confidence } = item as Record<string, unknown>;
    if (!isContactEvidenceKind(kind) || !isContactEvidenceConfidence(confidence)) continue;
    const key = `${kind}|${confidence}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => {
      const [kind, confidence] = key.split("|") as [ContactEvidenceKind, ContactEvidenceConfidence];
      return { kind, confidence, count };
    })
    .sort((a, b) => (a.kind === b.kind ? a.confidence.localeCompare(b.confidence) : a.kind.localeCompare(b.kind)));
}

/**
 * Classifies by URL shape only; the URL itself is never returned to callers.
 * A company page must never be treated as a named person.
 */
export function classifyLinkedInProfile(linkedinUrl: string | null): LinkedInProfileKind {
  if (linkedinUrl == null) return "not_applicable";
  let url: URL;
  try {
    url = new URL(linkedinUrl);
  } catch {
    return "unknown";
  }
  const hostname = url.hostname.toLowerCase();
  if (hostname !== "linkedin.com" && !hostname.endsWith(".linkedin.com")) return "unknown";
  if (/^\/in\//i.test(url.pathname)) return "person";
  if (/^\/company\//i.test(url.pathname)) return "company";
  return "unknown";
}

const GENERIC_MAILBOX_LOCAL_PARTS = [
  "info", "contact", "contactus", "hello", "support", "help",
  "admin", "office", "sales", "marketing", "press", "media",
  "editorial", "editor", "team", "careers", "jobs", "hr", "recruiting",
  "legal", "privacy", "security", "abuse", "webmaster", "postmaster",
  "noreply", "no-reply", "donotreply",
  "billing", "accounts", "accounting", "orders", "shop", "store",
  "service", "services", "customerservice", "customercare",
  "enquiries", "enquiry", "inquiries", "inquiry", "general",
  "newsletter", "subscribe", "unsubscribe",
  "partnerships", "partnership", "reservations", "reservation", "booking", "bookings",
] as const;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Exact token match plus an optional single separator and a numeric-only suffix
// (e.g. "info2", "info-2"). Deliberately no free-form prefix/partial matching.
const GENERIC_MAILBOX_LOCAL_PART = new RegExp(
  `^(?:${GENERIC_MAILBOX_LOCAL_PARTS.map(escapeRegExp).join("|")})(?:[.\\-_]?[0-9]+)?$`,
  "i",
);

// Exactly two alphabetic segments separated by a single delimiter (e.g. "jane.doe",
// "j.doe"). A bare concatenation ("jdoe") or a single unrecognized word ("events")
// never matches this, by design.
const POSSIBLY_PERSONAL_MAILBOX_LOCAL_PART = /^([a-z]+)[.\-_]([a-z]{2,})$/i;

function isKnownGenericToken(segment: string): boolean {
  return GENERIC_MAILBOX_LOCAL_PARTS.some((token) => token.toLowerCase() === segment.toLowerCase());
}

/**
 * Classifies by local-part shape only; never infers or returns a real name.
 * possibly_personal_mailbox is intentionally narrow: any segment that is itself
 * a known generic token (e.g. "sales-eu") stays unknown rather than being
 * guessed as personal just because it has the two-segment shape.
 */
export function classifyMailboxKind(email: string | null): ContactSelectionMailboxKind {
  if (email == null) return "unknown";
  const atIndex = email.indexOf("@");
  if (atIndex <= 0) return "unknown";
  const localPart = email.slice(0, atIndex);
  if (GENERIC_MAILBOX_LOCAL_PART.test(localPart)) return "generic_mailbox";
  const personalMatch = localPart.match(POSSIBLY_PERSONAL_MAILBOX_LOCAL_PART);
  if (personalMatch && !isKnownGenericToken(personalMatch[1]!) && !isKnownGenericToken(personalMatch[2]!)) {
    return "possibly_personal_mailbox";
  }
  return "unknown";
}

export function parseContactSelectionDecision(value: unknown): ContactSelectionDecisionInput | null {
  if (typeof value !== "object" || value == null || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  const expected = ["promotionApplicationId", "sourceResolutionTaskId", "selectedContactId", "candidateFingerprint", "idempotencyKey", "reasonCode", "confirm"];
  if (Object.keys(body).length !== expected.length || !expected.every((key) => key in body)) return null;
  if (!isUuid(body.promotionApplicationId) || !isUuid(body.sourceResolutionTaskId)) return null;
  if (body.selectedContactId !== null && !isUuid(body.selectedContactId)) return null;
  if (typeof body.candidateFingerprint !== "string" || !FINGERPRINT.test(body.candidateFingerprint)) return null;
  if (typeof body.idempotencyKey !== "string" || body.idempotencyKey !== body.idempotencyKey.trim() || body.idempotencyKey.length < 16 || body.idempotencyKey.length > 255) return null;
  if (!CONTACT_SELECTION_REASON_CODES.includes(body.reasonCode as ContactSelectionReasonCode) || body.confirm !== true) return null;
  if ((body.selectedContactId == null) === (body.reasonCode === "HUMAN_REVIEW_SELECTED")) return null;
  return { promotionApplicationId: body.promotionApplicationId, sourceResolutionTaskId: body.sourceResolutionTaskId, selectedContactId: body.selectedContactId, candidateFingerprint: body.candidateFingerprint, idempotencyKey: body.idempotencyKey, reasonCode: body.reasonCode as ContactSelectionReasonCode, confirm: true };
}
