import { createHash } from "node:crypto";
import { listContactFormVerificationPreflightStatesForContacts } from "./contactFormVerificationPreflightRepository";
import { listMailboxVerificationStatesForContacts } from "./mailboxVerificationRequestsRepository";
import { BacklinkRepositoryError, normalizeBacklinkRepositoryError } from "./errors";
import type { BacklinkRepositoryClient } from "./repositoryClient";
import { candidateFingerprint, classifyLinkedInProfile, classifyMailboxKind, parseCandidateIds, parseContactEvidenceSummary, type ContactSelectionCase, type ContactSelectionDecisionInput, type ContactSelectionFormState, type ContactSelectionReasonCode } from "../services/contactSelectionReviewService";

export async function assertContactSelectionAuthority(client: BacklinkRepositoryClient, workspaceId: string): Promise<void> {
  const [privateAdmin, workspaceAdmin] = await Promise.all([
    client.rpc("is_norixo_private_admin", {}),
    client.rpc("is_workspace_admin_or_owner", { target_workspace_id: workspaceId }),
  ]);
  if (privateAdmin.error != null || workspaceAdmin.error != null || privateAdmin.data !== true || workspaceAdmin.data !== true) {
    throw new BacklinkRepositoryError({ code: "FORBIDDEN", operation: "assertContactSelectionAuthority", message: "The operation is not permitted." });
  }
}

function inputIds(input: unknown): { promotionApplicationId: string; opportunityId: string; domainId: string } | null {
  if (typeof input !== "object" || input == null || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  return typeof value.promotionApplicationId === "string" && typeof value.opportunityId === "string" && typeof value.domainId === "string"
    ? { promotionApplicationId: value.promotionApplicationId, opportunityId: value.opportunityId, domainId: value.domainId }
    : null;
}

function emailFingerprint(email: string | null): string {
  return createHash("sha256").update((email ?? "").trim().toLowerCase(), "utf8").digest("hex");
}

export async function listContactSelectionCases(client: BacklinkRepositoryClient, workspaceId: string): Promise<ContactSelectionCase[]> {
  await assertContactSelectionAuthority(client, workspaceId);
  const { data: tasks, error: taskError } = await client.from("automation_tasks")
    .select("id,run_id,input,output,completed_at").eq("workspace_id", workspaceId).eq("system", "backlinks")
    .eq("task_kind", "backlinks.contact_resolution").eq("status", "completed").order("completed_at", { ascending: true }).limit(100);
  if (taskError != null) throw normalizeBacklinkRepositoryError("listContactSelectionCases.tasks", taskError);
  const candidates = (tasks ?? []).map((task) => ({ task, ids: inputIds(task.input), candidateIds: parseCandidateIds(task.output) }))
    .filter((item): item is { task: NonNullable<typeof tasks>[number]; ids: { promotionApplicationId: string; opportunityId: string; domainId: string }; candidateIds: string[] } => item.ids != null && item.candidateIds != null);
  if (candidates.length === 0) return [];
  const taskIds = candidates.map((item) => item.task.id);
  const runIds = [...new Set(candidates.map((item) => item.task.run_id))];
  const appIds = [...new Set(candidates.map((item) => item.ids.promotionApplicationId))];
  const contactIds = [...new Set(candidates.flatMap((item) => item.candidateIds))];
  const [runsResult, appsResult, contactsResult, decisionsResult] = await Promise.all([
    client.from("automation_runs").select("id,workspace_id,system,run_kind,status").eq("workspace_id", workspaceId).in("id", runIds),
    client.from("backlink_promotion_applications").select("id,workspace_id,domain_id,opportunity_id").eq("workspace_id", workspaceId).in("id", appIds),
    client.from("backlink_contacts").select("id,workspace_id,domain_id,full_name,role_title,email_normalized,linkedin_url,contact_form_url,contact_status,source_reference,archived_at,do_not_contact_at").eq("workspace_id", workspaceId).in("id", contactIds),
    client.from("backlink_contact_selection_decisions").select("source_resolution_task_id,decision_status,reason_code,decided_at").eq("workspace_id", workspaceId).in("source_resolution_task_id", taskIds),
  ]);
  for (const [operation, result] of [["runs", runsResult], ["applications", appsResult], ["contacts", contactsResult], ["decisions", decisionsResult]] as const) if (result.error != null) throw normalizeBacklinkRepositoryError(`listContactSelectionCases.${operation}`, result.error);
  const runs = new Map((runsResult.data ?? []).map((row) => [row.id, row]));
  const apps = new Map((appsResult.data ?? []).map((row) => [row.id, row]));
  const contacts = new Map((contactsResult.data ?? []).map((row) => [row.id.toLowerCase(), row]));
  const decisions = new Map((decisionsResult.data ?? []).map((row) => [row.source_resolution_task_id, row]));
  const contactRows = [...contacts.values()];
  const [mailbox, forms] = await Promise.all([
    listMailboxVerificationStatesForContacts(client, workspaceId, contactRows.map((contact) => ({ id: contact.id, emailFingerprint: emailFingerprint(contact.email_normalized), contactStatus: contact.contact_status }))),
    listContactFormVerificationPreflightStatesForContacts(client, workspaceId, contactRows.map((contact) => ({ id: contact.id, formUrl: contact.contact_form_url }))),
  ]);
  return candidates.flatMap(({ task, ids, candidateIds }) => {
    const run = runs.get(task.run_id); const app = apps.get(ids.promotionApplicationId);
    if (run?.system !== "backlinks" || run.run_kind !== "backlinks.autonomy" || run.status !== "completed" || app == null || app.domain_id !== ids.domainId || app.opportunity_id !== ids.opportunityId) return [];
    const candidateRows = candidateIds.map((id) => contacts.get(id));
    if (candidateRows.some((contact) => contact == null || contact.domain_id !== app.domain_id)) return [];
    const mapped = candidateRows.map((contact) => {
      const row = contact!; const blockingCodes: string[] = [];
      if (row.archived_at != null || row.contact_status === "archived") blockingCodes.push("CONTACT_ARCHIVED");
      if (row.do_not_contact_at != null || row.contact_status === "do_not_contact") blockingCodes.push("CONTACT_DO_NOT_CONTACT");
      return { id: row.id, fullName: row.full_name?.trim() || null, roleTitle: row.role_title?.trim() || null, channels: { email: row.email_normalized != null, contactForm: row.contact_form_url != null, linkedIn: row.linkedin_url != null }, contactStatus: row.contact_status as "unverified" | "verified" | "archived" | "do_not_contact", evidenceSummary: parseContactEvidenceSummary(row.source_reference), linkedinProfileKind: classifyLinkedInProfile(row.linkedin_url), mailboxKind: classifyMailboxKind(row.email_normalized), mailboxState: mailbox[row.id] ?? "unverified", contactFormState: ((row.contact_form_url ? forms[row.id] : null) ?? "not_applicable") as ContactSelectionFormState, selectable: blockingCodes.length === 0, blockingCodes };
    });
    const decision = decisions.get(task.id);
    if (decision != null && (decision.decision_status !== "contact_selected" && decision.decision_status !== "promotion_rejected")) return [];
    return [{ promotionApplicationId: app.id, sourceResolutionTaskId: task.id, sourceAutonomyRunId: task.run_id, candidateFingerprint: candidateFingerprint({ workspaceId, promotionApplicationId: app.id, sourceResolutionTaskId: task.id, candidateIds }), candidateCount: candidateIds.length, decision: decision == null ? null : { status: decision.decision_status as "contact_selected" | "promotion_rejected", reasonCode: decision.reason_code as ContactSelectionReasonCode, decidedAt: decision.decided_at }, candidates: mapped }];
  });
}

export async function recordContactSelectionDecision(client: BacklinkRepositoryClient, workspaceId: string, input: ContactSelectionDecisionInput) {
  await assertContactSelectionAuthority(client, workspaceId);
  const { data, error } = await client.rpc("record_backlink_contact_selection_decision", {
    p_workspace_id: workspaceId, p_promotion_application_id: input.promotionApplicationId, p_source_resolution_task_id: input.sourceResolutionTaskId,
    p_selected_contact_id: input.selectedContactId, p_expected_candidate_fingerprint: input.candidateFingerprint, p_idempotency_key: input.idempotencyKey,
    p_reason_code: input.reasonCode, p_confirmed: input.confirm,
  });
  if (error != null) throw normalizeBacklinkRepositoryError("recordContactSelectionDecision", error);
  if (!Array.isArray(data) || data.length !== 1 || (data[0]?.disposition !== "created" && data[0]?.disposition !== "replayed")) throw new BacklinkRepositoryError({ code: "DATABASE", operation: "recordContactSelectionDecision", message: "The database returned an invalid selection decision result." });
  return { decisionId: data[0].decision_id, disposition: data[0].disposition as "created" | "replayed" };
}
