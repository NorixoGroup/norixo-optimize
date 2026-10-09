import type { Database } from "@/types/database.types";
import type { BacklinkRepositoryClient } from "./repositoryClient";
import { BacklinkRepositoryError, normalizeBacklinkRepositoryError } from "./errors";

export type ContactFormVerificationPreflight = Database["public"]["Tables"]["backlink_contact_form_verification_preflights"]["Row"];

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
  return data;
}

export async function completeContactFormVerificationPreflight(client: BacklinkRepositoryClient, input: { workspaceId: string; preflightId: string; workerId: string; status: "verified" | "manual_review" | "failed" | "blocked"; safeErrorCode?: string | null; completedAt: string }) {
  const { data, error } = await client.rpc("complete_backlink_contact_form_verification_preflight", { p_workspace_id: required(input.workspaceId, "workspaceId"), p_preflight_id: required(input.preflightId, "preflightId"), p_worker_id: required(input.workerId, "workerId"), p_status: input.status, p_safe_error_code: input.safeErrorCode?.trim() ?? "", p_completed_at: required(input.completedAt, "completedAt") });
  if (error != null || data == null) throw normalizeBacklinkRepositoryError("completeContactFormVerificationPreflight", error ?? new Error("Missing completion."));
  return data;
}
