import { listContactFormAutomationHistory, type ContactFormRunState } from "@/lib/backlinks/repositories/contactFormAutomationRepository";
import type { BacklinkRepositoryClient } from "@/lib/backlinks/repositories/repositoryClient";

export const CONTACT_FORM_TERMINAL_STATES = new Set<ContactFormRunState>(["submission_confirmed", "submission_ambiguous", "blocked_captcha", "blocked_policy", "failed_pre_submit", "manual_review"]);
export type ContactFormDashboardNextAction = "approve" | "worker" | "submission_complete" | "manual_review";

export function getContactFormDashboardNextAction(currentRun: Readonly<{ state: string }> | null): ContactFormDashboardNextAction {
  if (currentRun == null) return "approve";
  switch (currentRun.state) {
    case "submission_confirmed":
      return "submission_complete";
    case "submission_ambiguous":
    case "blocked_captcha":
    case "blocked_policy":
    case "failed_pre_submit":
    case "manual_review":
      return "manual_review";
    default:
      return "worker";
  }
}

export async function getContactFormAutomationHistory(client: BacklinkRepositoryClient, workspaceId: string, outreachId: string) {
  const history = await listContactFormAutomationHistory(client, workspaceId, outreachId);
  const currentRun = history.runs[0] ?? null;
  const lastEvent = history.events.at(-1) ?? null;
  const states = new Set(history.events.map((event) => event.state));
  const reached = (state: ContactFormRunState) => states.has(state) || currentRun?.state === state;
  return { outreach: history.outreach, latestApproval: history.approvals[0] ?? null, currentRun, events: history.events, finalAttemptId: currentRun?.final_attempt_id ?? null, finalAttemptStatus: currentRun?.state === "submission_confirmed" ? "accepted" : null, dashboard: { channel: "contact_form", approval_state: history.approvals[0] ? "approved" : "not_approved", run_state: currentRun?.state ?? "not_queued", last_event: lastEvent?.event_type ?? null, form_url: currentRun?.form_url ?? history.approvals[0]?.form_url ?? null, discovery_state: reached("discovered") ? "discovered" : "pending", mapping_state: reached("mapped") ? "mapped" : "pending", fill_state: reached("filled") ? "filled" : "pending", pre_submit_state: reached("pre_submit_validated") ? "validated" : "pending", submit_state: currentRun?.state === "submission_confirmed" ? "confirmed" : currentRun?.state === "submission_ambiguous" ? "ambiguous" : reached("submitting") ? "submitting" : "pending", evidence_state: currentRun?.evidence_reference ? "recorded" : "none", attempt_state: currentRun?.final_attempt_id ? "accepted" : "none", delivery_state: "unknown", reply_state: "unknown", backlink_state: "unknown", block_reason: currentRun?.safe_error_code ?? null, next_action: getContactFormDashboardNextAction(currentRun), approved_at: history.approvals[0]?.approved_at ?? null, queued_at: currentRun?.created_at ?? null, submit_started_at: currentRun?.submit_started_at ?? null, finished_at: currentRun?.finished_at ?? null, updated_at: currentRun?.updated_at ?? history.approvals[0]?.created_at ?? null } };
}
