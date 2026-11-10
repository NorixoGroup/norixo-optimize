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

export type ContactSelectionCandidate = {
  id: string;
  channels: { email: boolean; contactForm: boolean; linkedIn: boolean };
  contactStatus: "unverified" | "verified" | "archived" | "do_not_contact";
  provenancePresent: boolean;
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
