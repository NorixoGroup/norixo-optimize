import type { Database } from "@/types/database.types";
import { normalizeBacklinkRepositoryError } from "./errors";
import type { BacklinkRepositoryClient } from "./repositoryClient";

export type MailboxVerificationRequest = Database["public"]["Tables"]["backlink_contact_mailbox_verification_requests"]["Row"];
export type MailboxVerificationState = "verified" | "risky" | "undeliverable" | "unknown" | "provider_error" | "running" | "indeterminate" | "exhausted" | "unverified";

export async function claimMailboxVerificationRequest(client: BacklinkRepositoryClient, input: { workspaceId: string; contactId: string; emailFingerprint: string; startedAt: string }) {
  const { data, error } = await client.rpc("claim_backlink_contact_mailbox_verification_request", { p_workspace_id: input.workspaceId, p_contact_id: input.contactId, p_email_fingerprint: input.emailFingerprint, p_started_at: input.startedAt });
  if (error != null) throw normalizeBacklinkRepositoryError("claimMailboxVerificationRequest", error);
  if (!Array.isArray(data) || data.length !== 1) throw new Error("MAILBOX_VERIFICATION_REQUEST_INVALID_CLAIM");
  return data[0];
}

export async function completeMailboxVerificationRequest(client: BacklinkRepositoryClient, input: { workspaceId: string; requestId: string; status: "succeeded" | "terminal" | "retryable"; result: string | null; reason: string; completedAt: string }) {
  const { data, error } = await client.rpc("complete_backlink_contact_mailbox_verification_request", { p_workspace_id: input.workspaceId, p_request_id: input.requestId, p_status: input.status, p_result: input.result, p_reason: input.reason, p_completed_at: input.completedAt });
  if (error != null) throw normalizeBacklinkRepositoryError("completeMailboxVerificationRequest", error);
  return data;
}

export async function getLatestMailboxVerificationRequest(client: BacklinkRepositoryClient, workspaceId: string, contactId: string): Promise<MailboxVerificationRequest | null> {
  const { data, error } = await client.from("backlink_contact_mailbox_verification_requests").select("*").eq("workspace_id", workspaceId).eq("contact_id", contactId).order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (error != null) throw normalizeBacklinkRepositoryError("getLatestMailboxVerificationRequest", error);
  return data;
}

export async function getCanonicalMailboxVerificationForEmail(client: BacklinkRepositoryClient, workspaceId: string, contactId: string, emailFingerprint: string) {
  const { data, error } = await client.from("backlink_contact_mailbox_verifications").select("provider,result,email_fingerprint,checked_at,created_at,id").eq("workspace_id", workspaceId).eq("contact_id", contactId).eq("email_fingerprint", emailFingerprint).order("checked_at", { ascending: false }).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(1).maybeSingle();
  if (error != null) throw normalizeBacklinkRepositoryError("getCanonicalMailboxVerificationForEmail", error);
  return data;
}

export async function listMailboxVerificationStatesForContacts(client: BacklinkRepositoryClient, workspaceId: string, contacts: Array<{ id: string; emailFingerprint: string; contactStatus: string }>): Promise<Record<string, MailboxVerificationState>> {
  if (contacts.length === 0) return {};
  const contactIds = contacts.map((contact) => contact.id);
  const [requestsResult, verificationsResult] = await Promise.all([
    client.from("backlink_contact_mailbox_verification_requests").select("contact_id,email_fingerprint,status,last_result,updated_at").eq("workspace_id", workspaceId).in("contact_id", contactIds).order("updated_at", { ascending: false }),
    client.from("backlink_contact_mailbox_verifications").select("contact_id,email_fingerprint,result,checked_at").eq("workspace_id", workspaceId).in("contact_id", contactIds).order("checked_at", { ascending: false }),
  ]);
  if (requestsResult.error != null) throw normalizeBacklinkRepositoryError("listMailboxVerificationStatesForContacts", requestsResult.error);
  if (verificationsResult.error != null) throw normalizeBacklinkRepositoryError("listMailboxVerificationStatesForContacts", verificationsResult.error);
  const expectedFingerprints = new Map(contacts.map((contact) => [contact.id, contact.emailFingerprint]));
  const requests = new Map<string, { status: string; last_result: string | null }>();
  for (const row of requestsResult.data ?? []) if (expectedFingerprints.get(row.contact_id) === row.email_fingerprint && !requests.has(row.contact_id)) requests.set(row.contact_id, row);
  const verifications = new Map<string, { result: string }>();
  for (const row of verificationsResult.data ?? []) if (expectedFingerprints.get(row.contact_id) === row.email_fingerprint && !verifications.has(row.contact_id)) verifications.set(row.contact_id, row);
  return Object.fromEntries(contacts.map((contact) => {
    if (contact.contactStatus === "verified") return [contact.id, "verified"];
    const request = requests.get(contact.id);
    if (request?.status === "running") return [contact.id, "running"];
    if (request?.status === "terminal" && request.last_result === "provider_error") return [contact.id, "exhausted"];
    if (request?.status === "terminal" && request.last_result == null) return [contact.id, "indeterminate"];
    if (request?.last_result === "risky" || request?.last_result === "undeliverable" || request?.last_result === "unknown" || request?.last_result === "provider_error") return [contact.id, request.last_result];
    const verification = verifications.get(contact.id);
    if (verification?.result === "risky" || verification?.result === "undeliverable" || verification?.result === "unknown" || verification?.result === "provider_error") return [contact.id, verification.result];
    return [contact.id, "unverified"];
  }));
}
