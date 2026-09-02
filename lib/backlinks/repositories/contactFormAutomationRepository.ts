import type { Database, Json } from "@/types/database.types";
import type { BacklinkRepositoryClient } from "./repositoryClient";
import { BacklinkRepositoryError, normalizeBacklinkRepositoryError } from "./errors";

export type ContactFormRunState = "queued" | "claimed" | "navigating" | "discovered" | "mapped" | "filled" | "pre_submit_validated" | "submitting" | "submission_confirmed" | "submission_ambiguous" | "blocked_captcha" | "blocked_policy" | "failed_pre_submit" | "manual_review";
export type ContactFormApproval = Database["public"]["Tables"]["backlink_contact_form_approvals"]["Row"];
export type ContactFormRun = Database["public"]["Tables"]["backlink_contact_form_runs"]["Row"];
export type ContactFormRunEvent = Database["public"]["Tables"]["backlink_contact_form_run_events"]["Row"];
export type ContactFormExecutionOutreach = Pick<Database["public"]["Tables"]["backlink_outreach"]["Row"], "body" | "campaign_id" | "channel" | "contact_id" | "current_attempt" | "id" | "opportunity_id" | "status" | "subject" | "workspace_id">;
export type ContactFormExecutionContact = Pick<Database["public"]["Tables"]["backlink_contacts"]["Row"], "archived_at" | "contact_form_url" | "contact_status" | "do_not_contact_at" | "id" | "workspace_id">;
export type ContactFormExecutionOpportunity = Pick<Database["public"]["Tables"]["backlink_opportunities"]["Row"], "id" | "target_page_url" | "workspace_id">;
export type ContactFormRunExecutionContext = {
  run: ContactFormRun;
  approval: ContactFormApproval;
  outreach: ContactFormExecutionOutreach;
  contact: ContactFormExecutionContact;
  opportunity: ContactFormExecutionOpportunity;
  outreachAttemptCount: number;
};

function required(value: string, field: string) { const normalized = value.trim(); if (!normalized) throw new BacklinkRepositoryError({ code: "VALIDATION", operation: "contactFormAutomation", message: `${field} is required.` }); return normalized; }
function rpcError(operation: string, error: unknown) { return normalizeBacklinkRepositoryError(operation, error); }

export async function listContactFormAutomationHistory(client: BacklinkRepositoryClient, workspaceId: string, outreachId: string) {
  const [outreachResult, approvalsResult, runsResult] = await Promise.all([
    client.from("backlink_outreach").select("*").eq("workspace_id", required(workspaceId, "workspaceId")).eq("id", required(outreachId, "outreachId")).maybeSingle(),
    client.from("backlink_contact_form_approvals").select("*").eq("workspace_id", required(workspaceId, "workspaceId")).eq("outreach_id", required(outreachId, "outreachId")).order("created_at", { ascending: false }).order("id", { ascending: false }),
    client.from("backlink_contact_form_runs").select("*").eq("workspace_id", required(workspaceId, "workspaceId")).eq("outreach_id", required(outreachId, "outreachId")).order("created_at", { ascending: false }).order("id", { ascending: false }),
  ]);
  if (outreachResult.error != null || outreachResult.data == null) throw rpcError("getContactFormOutreach", outreachResult.error ?? new Error("Outreach not found."));
  if (approvalsResult.error != null) throw rpcError("listContactFormApprovals", approvalsResult.error);
  if (runsResult.error != null) throw rpcError("listContactFormRuns", runsResult.error);
  const runIds = (runsResult.data ?? []).map((run) => run.id);
  if (!runIds.length) return { outreach: outreachResult.data, approvals: approvalsResult.data ?? [], runs: runsResult.data ?? [], events: [] as ContactFormRunEvent[] };
  const { data: events, error } = await client.from("backlink_contact_form_run_events").select("*").eq("workspace_id", workspaceId.trim()).eq("outreach_id", outreachId.trim()).in("run_id", runIds).order("occurred_at", { ascending: true }).order("created_at", { ascending: true }).order("id", { ascending: true });
  if (error != null) throw rpcError("listContactFormRunEvents", error);
  return { outreach: outreachResult.data, approvals: approvalsResult.data ?? [], runs: runsResult.data ?? [], events: events ?? [] };
}

export async function getContactFormRunExecutionContext(client: BacklinkRepositoryClient, run: ContactFormRun): Promise<ContactFormRunExecutionContext> {
  const workspaceId = required(run.workspace_id, "workspaceId");
  const outreachId = required(run.outreach_id, "outreachId");
  const [approvalResult, outreachResult, attemptsResult] = await Promise.all([
    client.from("backlink_contact_form_approvals").select("*").eq("workspace_id", workspaceId).eq("outreach_id", outreachId).eq("id", required(run.approval_id, "approvalId")).maybeSingle(),
    client.from("backlink_outreach").select("id,workspace_id,campaign_id,contact_id,opportunity_id,channel,status,current_attempt,subject,body").eq("workspace_id", workspaceId).eq("id", outreachId).maybeSingle(),
    client.from("backlink_outreach_attempts").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("outreach_id", outreachId),
  ]);
  if (approvalResult.error != null || approvalResult.data == null) throw rpcError("getContactFormRunApproval", approvalResult.error ?? new Error("Approval not found."));
  if (outreachResult.error != null || outreachResult.data == null) throw rpcError("getContactFormRunOutreach", outreachResult.error ?? new Error("Outreach not found."));
  if (attemptsResult.error != null) throw rpcError("countContactFormOutreachAttempts", attemptsResult.error);
  const [contactResult, opportunityResult] = await Promise.all([
    client.from("backlink_contacts").select("id,workspace_id,contact_status,do_not_contact_at,archived_at,contact_form_url").eq("workspace_id", workspaceId).eq("id", outreachResult.data.contact_id).maybeSingle(),
    client.from("backlink_opportunities").select("id,workspace_id,target_page_url").eq("workspace_id", workspaceId).eq("id", outreachResult.data.opportunity_id).maybeSingle(),
  ]);
  if (contactResult.error != null || contactResult.data == null) throw rpcError("getContactFormRunContact", contactResult.error ?? new Error("Contact not found."));
  if (opportunityResult.error != null || opportunityResult.data == null) throw rpcError("getContactFormRunOpportunity", opportunityResult.error ?? new Error("Opportunity not found."));
  return { run, approval: approvalResult.data, outreach: outreachResult.data, contact: contactResult.data, opportunity: opportunityResult.data, outreachAttemptCount: attemptsResult.count ?? 0 };
}

export async function approveContactFormInitial(client: BacklinkRepositoryClient, input: { workspaceId: string; outreachId: string; approvedByUserId: string; senderName: string; senderEmail: string; senderCompany: string; senderWebsite: string }) {
  const args: Database["public"]["Functions"]["approve_backlink_contact_form_initial_v1"]["Args"] = { p_workspace_id: required(input.workspaceId, "workspaceId"), p_outreach_id: required(input.outreachId, "outreachId"), p_approved_by_user_id: required(input.approvedByUserId, "approvedByUserId"), p_sender_name: required(input.senderName, "senderName"), p_sender_email: required(input.senderEmail, "senderEmail"), p_sender_company: required(input.senderCompany, "senderCompany"), p_sender_website: required(input.senderWebsite, "senderWebsite") };
  const { data, error } = await client.rpc("approve_backlink_contact_form_initial_v1", args);
  if (error != null || !Array.isArray(data) || data.length !== 1) throw rpcError("approveContactFormInitial", error ?? new Error("Invalid approval result."));
  return data[0];
}
export async function queueContactFormRun(client: BacklinkRepositoryClient, input: { workspaceId: string; outreachId: string; approvalId: string }) {
  const args: Database["public"]["Functions"]["queue_backlink_contact_form_run_v1"]["Args"] = { p_workspace_id: required(input.workspaceId, "workspaceId"), p_outreach_id: required(input.outreachId, "outreachId"), p_approval_id: required(input.approvalId, "approvalId") };
  const { data, error } = await client.rpc("queue_backlink_contact_form_run_v1", args);
  if (error != null || !Array.isArray(data) || data.length !== 1) throw rpcError("queueContactFormRun", error ?? new Error("Invalid queue result."));
  return data[0];
}
export async function claimNextContactFormRun(client: BacklinkRepositoryClient, workerId: string, leaseDurationSeconds: number) {
  const { data, error } = await client.rpc("claim_next_backlink_contact_form_run_v1", { p_worker_id: required(workerId, "workerId"), p_lease_duration_seconds: leaseDurationSeconds });
  if (error != null) throw rpcError("claimNextContactFormRun", error); return data?.[0] ?? null;
}
export async function heartbeatContactFormRun(client: BacklinkRepositoryClient, input: { runId: string; workerId: string; leaseDurationSeconds: number }) {
  const { data, error } = await client.rpc("heartbeat_backlink_contact_form_run_v1", { p_run_id: required(input.runId, "runId"), p_worker_id: required(input.workerId, "workerId"), p_lease_duration_seconds: input.leaseDurationSeconds });
  if (error != null || data == null) throw rpcError("heartbeatContactFormRun", error ?? new Error("Missing heartbeat result.")); return data;
}
export async function transitionContactFormRun(client: BacklinkRepositoryClient, input: { runId: string; workerId: string; nextState: ContactFormRunState; eventType: string; safeMetadata?: Json; safeErrorCode?: string; evidenceReference?: string; finalUrl?: string }) {
  const { data, error } = await client.rpc("transition_backlink_contact_form_run_v1", { p_run_id: required(input.runId, "runId"), p_worker_id: required(input.workerId, "workerId"), p_next_state: input.nextState, p_event_type: required(input.eventType, "eventType"), p_safe_metadata: input.safeMetadata ?? {}, p_safe_error_code: input.safeErrorCode?.trim() || null, p_evidence_reference: input.evidenceReference?.trim() || null, p_final_url: input.finalUrl?.trim() || null });
  if (error != null || data == null) throw rpcError("transitionContactFormRun", error ?? new Error("Missing transition result.")); return data;
}
export async function confirmContactFormSubmission(client: BacklinkRepositoryClient, input: { runId: string; workerId: string; evidenceReference: string; finalUrl?: string }) {
  const { data, error } = await client.rpc("confirm_backlink_contact_form_submission_v1", { p_run_id: required(input.runId, "runId"), p_worker_id: required(input.workerId, "workerId"), p_evidence_reference: required(input.evidenceReference, "evidenceReference"), p_final_url: input.finalUrl?.trim() || null });
  if (error != null || !Array.isArray(data) || data.length !== 1) throw rpcError("confirmContactFormSubmission", error ?? new Error("Invalid confirmation result.")); return data[0];
}
export async function retryContactFormPreSubmitRun(client: BacklinkRepositoryClient, input: { runId: string; workerId: string }) {
  const { data, error } = await client.rpc("retry_backlink_contact_form_pre_submit_v1", { p_run_id: required(input.runId, "runId"), p_worker_id: required(input.workerId, "workerId") });
  if (error != null || data == null) throw rpcError("retryContactFormPreSubmitRun", error ?? new Error("Missing retry result.")); return data;
}
