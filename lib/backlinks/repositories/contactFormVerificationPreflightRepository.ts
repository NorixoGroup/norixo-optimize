import type { Database } from "@/types/database.types";
import type { BacklinkRepositoryClient } from "./repositoryClient";
import { BacklinkRepositoryError, normalizeBacklinkRepositoryError } from "./errors";
import type { Json } from "@/types/database.types";

export type ContactFormVerificationPreflight = Database["public"]["Tables"]["backlink_contact_form_verification_preflights"]["Row"];
export type ContactFormVerificationPreflightClaim = Readonly<{ claimed: boolean; preflight: ContactFormVerificationPreflight }>;

const PREFLIGHT_STATUSES = new Set(["pending", "running", "verified", "manual_review", "failed", "blocked"]);

function invalidRpcResponse(operation: string): never {
  throw new BacklinkRepositoryError({ code: "VALIDATION", operation, message: "The database returned an invalid preflight response." });
}

function stringField(row: Record<string, unknown>, field: string, operation: string) {
  const value = row[field];
  if (typeof value !== "string") invalidRpcResponse(operation);
  return value;
}

function nullableStringField(row: Record<string, unknown>, field: string, operation: string) {
  const value = row[field];
  if (value !== null && typeof value !== "string") invalidRpcResponse(operation);
  return value;
}

function decodePreflightRow(value: unknown, operation: string): ContactFormVerificationPreflight {
  if (typeof value !== "object" || value == null || Array.isArray(value)) invalidRpcResponse(operation);
  const row = value as Record<string, unknown>;
  const status = stringField(row, "status", operation);
  const attemptCount = row.attempt_count;
  if (!PREFLIGHT_STATUSES.has(status) || typeof attemptCount !== "number" || !Number.isInteger(attemptCount) || attemptCount < 0 || attemptCount > 2) invalidRpcResponse(operation);
  return {
    id: stringField(row, "id", operation), workspace_id: stringField(row, "workspace_id", operation), contact_id: stringField(row, "contact_id", operation), form_url: stringField(row, "form_url", operation), idempotency_key: stringField(row, "idempotency_key", operation), status,
    attempt_count: attemptCount, requested_by: stringField(row, "requested_by", operation), requested_at: stringField(row, "requested_at", operation), started_at: nullableStringField(row, "started_at", operation), completed_at: nullableStringField(row, "completed_at", operation), cooldown_until: nullableStringField(row, "cooldown_until", operation), worker_id: nullableStringField(row, "worker_id", operation), safe_error_code: nullableStringField(row, "safe_error_code", operation), created_at: stringField(row, "created_at", operation), updated_at: stringField(row, "updated_at", operation),
  };
}

function decodeClaim(value: unknown): ContactFormVerificationPreflightClaim {
  if (typeof value !== "object" || value == null || Array.isArray(value)) invalidRpcResponse("claimContactFormVerificationPreflight");
  const claim = value as Record<string, unknown>;
  if (typeof claim.claimed !== "boolean") invalidRpcResponse("claimContactFormVerificationPreflight");
  return { claimed: claim.claimed, preflight: decodePreflightRow(claim.preflight, "claimContactFormVerificationPreflight") };
}

function required(value: string, field: string) {
  const normalized = value.trim();
  if (!normalized) throw new BacklinkRepositoryError({ code: "VALIDATION", operation: "contactFormVerificationPreflight", message: `${field} is required.` });
  return normalized;
}

export async function getContactFormVerificationPreflight(client: BacklinkRepositoryClient, workspaceId: string, contactId: string) {
  const { data, error } = await client.from("backlink_contact_form_verification_preflights")
    .select("*").eq("workspace_id", required(workspaceId, "workspaceId")).eq("contact_id", required(contactId, "contactId"))
    .order("requested_at", { ascending: false }).order("id", { ascending: false }).maybeSingle();
  if (error != null) throw normalizeBacklinkRepositoryError("getContactFormVerificationPreflight", error);
  return data;
}

export async function listContactFormVerificationPreflightStatesForContacts(
  client: BacklinkRepositoryClient,
  workspaceId: string,
  contacts: readonly { id: string; formUrl: string | null }[],
): Promise<Record<string, "pending" | "running" | "verified" | "manual_review" | "failed" | "blocked">> {
  const eligible = contacts.filter((contact) => contact.formUrl?.trim());
  if (eligible.length === 0) return {};
  const { data, error } = await client.from("backlink_contact_form_verification_preflights")
    .select("contact_id,form_url,status,requested_at,id").eq("workspace_id", required(workspaceId, "workspaceId"))
    .in("contact_id", eligible.map((contact) => contact.id))
    .order("requested_at", { ascending: false }).order("id", { ascending: false });
  if (error != null) throw normalizeBacklinkRepositoryError("listContactFormVerificationPreflightStatesForContacts", error);
  const currentUrls = new Map(eligible.map((contact) => [contact.id, contact.formUrl?.trim()]));
  const states: Record<string, "pending" | "running" | "verified" | "manual_review" | "failed" | "blocked"> = {};
  for (const row of data ?? []) {
    if (states[row.contact_id] != null || currentUrls.get(row.contact_id) !== row.form_url) continue;
    if (row.status === "pending" || row.status === "running" || row.status === "verified" || row.status === "manual_review" || row.status === "failed" || row.status === "blocked") states[row.contact_id] = row.status;
  }
  return states;
}

export async function createOrGetContactFormVerificationPreflight(client: BacklinkRepositoryClient, input: { workspaceId: string; contactId: string; formUrl: string; idempotencyKey: string; requestedBy: string }) {
  const payload = { workspace_id: required(input.workspaceId, "workspaceId"), contact_id: required(input.contactId, "contactId"), form_url: required(input.formUrl, "formUrl"), idempotency_key: required(input.idempotencyKey, "idempotencyKey"), requested_by: required(input.requestedBy, "requestedBy") };
  const { data, error } = await client.from("backlink_contact_form_verification_preflights").insert(payload).select("*").maybeSingle();
  if (error == null && data != null) return { disposition: "created" as const, preflight: data };
  if ((error as { code?: string } | null)?.code !== "23505") throw normalizeBacklinkRepositoryError("createContactFormVerificationPreflight", error);
  const { data: existing, error: existingError } = await client.from("backlink_contact_form_verification_preflights").select("*")
    .eq("workspace_id", payload.workspace_id).eq("contact_id", payload.contact_id).eq("form_url", payload.form_url).maybeSingle();
  if (existingError != null || existing == null) throw normalizeBacklinkRepositoryError("getExistingContactFormVerificationPreflight", existingError ?? error);
  return { disposition: "existing" as const, preflight: existing };
}

export async function claimContactFormVerificationPreflight(client: BacklinkRepositoryClient, input: { workspaceId: string; preflightId: string; workerId: string; startedAt: string }) {
  const { data, error } = await client.rpc("claim_backlink_contact_form_verification_preflight", { p_workspace_id: required(input.workspaceId, "workspaceId"), p_preflight_id: required(input.preflightId, "preflightId"), p_worker_id: required(input.workerId, "workerId"), p_started_at: required(input.startedAt, "startedAt") });
  if (error != null || data == null) throw normalizeBacklinkRepositoryError("claimContactFormVerificationPreflight", error ?? new Error("Missing claim."));
  return decodeClaim(data);
}

export async function completeContactFormVerificationPreflight(client: BacklinkRepositoryClient, input: { workspaceId: string; preflightId: string; workerId: string; status: "manual_review" | "failed" | "blocked"; safeErrorCode?: string | null; completedAt: string }) {
  const { data, error } = await client.rpc("complete_backlink_contact_form_verification_preflight", { p_workspace_id: required(input.workspaceId, "workspaceId"), p_preflight_id: required(input.preflightId, "preflightId"), p_worker_id: required(input.workerId, "workerId"), p_status: input.status, p_safe_error_code: input.safeErrorCode?.trim() ?? "", p_completed_at: required(input.completedAt, "completedAt") });
  if (error != null || data == null) throw normalizeBacklinkRepositoryError("completeContactFormVerificationPreflight", error ?? new Error("Missing completion."));
  return data;
}

export async function completeVerifiedContactFormVerificationPreflightAtomically(client: BacklinkRepositoryClient, input: { workspaceId: string; preflightId: string; workerId: string; contactId: string; formUrl: string; verifiedAt: string; evidenceVersion: string; formFingerprint?: string | null; safeEvidence: Json; completedAt: string }) {
  const { data, error } = await client.rpc("complete_verified_backlink_contact_form_preflight_atomic", {
    p_workspace_id: required(input.workspaceId, "workspaceId"), p_preflight_id: required(input.preflightId, "preflightId"), p_worker_id: required(input.workerId, "workerId"), p_contact_id: required(input.contactId, "contactId"), p_form_url: required(input.formUrl, "formUrl"), p_verified_at: required(input.verifiedAt, "verifiedAt"), p_evidence_version: required(input.evidenceVersion, "evidenceVersion"), p_form_fingerprint: input.formFingerprint?.trim() ?? "", p_safe_evidence: input.safeEvidence, p_completed_at: required(input.completedAt, "completedAt"),
  });
  if (error != null || data == null) throw normalizeBacklinkRepositoryError("completeVerifiedContactFormVerificationPreflightAtomically", error ?? new Error("Missing completion."));
  return decodePreflightRow(data, "completeVerifiedContactFormVerificationPreflightAtomically");
}

export async function reconcileAbandonedContactFormVerificationPreflight(client: BacklinkRepositoryClient, input: { workspaceId: string; preflightId: string; reconciledBy: string }) {
  const { data, error } = await client.rpc("reconcile_abandoned_backlink_contact_form_preflight", { p_workspace_id: required(input.workspaceId, "workspaceId"), p_preflight_id: required(input.preflightId, "preflightId"), p_reconciled_by: required(input.reconciledBy, "reconciledBy") });
  if (error != null || data == null) throw normalizeBacklinkRepositoryError("reconcileAbandonedContactFormVerificationPreflight", error ?? new Error("Missing reconciliation."));
  return decodePreflightRow(data, "reconcileAbandonedContactFormVerificationPreflight");
}
