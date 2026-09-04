import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildContactFormApprovalFingerprint } from "../lib/backlinks/services/contactFormApprovalFingerprint";
import { getContactFormDashboardNextAction } from "../lib/backlinks/services/contactFormAutomationService";

const input = { workspaceId: " workspace ", campaignId: " campaign ", outreachId: " outreach ", contactId: " contact ", opportunityId: " opportunity ", targetUrl: " https://norixo.example/target ", formUrl: " https://example.com/contact ", senderName: " Norixo ", senderEmail: " team@norixo.example ", senderCompany: " Norixo ", senderWebsite: " https://norixo.example ", subject: " Hello ", body: " Body " };
const fingerprint = buildContactFormApprovalFingerprint(input);
assert.match(fingerprint, /^cf1_[0-9a-f]{64}$/);
assert.equal(fingerprint, buildContactFormApprovalFingerprint({ ...input }));
for (const key of ["subject", "body", "formUrl", "targetUrl"] as const) assert.notEqual(fingerprint, buildContactFormApprovalFingerprint({ ...input, [key]: `${input[key]} changed` }));

assert.equal(getContactFormDashboardNextAction(null), "approve");
for (const state of ["queued", "claimed", "navigating", "discovered", "mapped", "filled", "pre_submit_validated", "submitting"]) {
  assert.equal(getContactFormDashboardNextAction({ state }), "worker", `${state} should route to worker`);
}
assert.equal(getContactFormDashboardNextAction({ state: "submission_confirmed" }), "submission_complete");
for (const state of ["submission_ambiguous", "blocked_captcha", "blocked_policy", "failed_pre_submit", "manual_review"]) {
  assert.equal(getContactFormDashboardNextAction({ state }), "manual_review", `${state} should route to manual review`);
}

const migration = readFileSync(join(process.cwd(), "supabase/migrations/20260902120000_add_backlink_contact_form_automation_foundation.sql"), "utf8");
for (const clause of [
  "create table public.backlink_contact_form_approvals", "create table public.backlink_contact_form_runs", "create table public.backlink_contact_form_run_events",
  "CONTACT_FORM_APPROVAL_IMMUTABLE", "CONTACT_FORM_RUN_EVENT_IMMUTABLE", "enable row level security",
  "grant select on public.backlink_contact_form_approvals, public.backlink_contact_form_runs, public.backlink_contact_form_run_events to authenticated",
  "revoke all on public.backlink_contact_form_approvals, public.backlink_contact_form_runs, public.backlink_contact_form_run_events from anon, authenticated",
  "r.state='submitting' and p_next_state in ('submission_ambiguous','manual_review')", "prevent_backlink_contact_form_post_submit_retry", "CONTACT_FORM_RUN_POST_SUBMIT_RETRY_FORBIDDEN",
  "safe_error_code text", "case when r.state='failed_pre_submit' then nullif(trim(p_safe_error_code),'') else null end", "finished_at=null, safe_error_code=null",
  "r.state <> 'failed_pre_submit' or r.pre_submit_attempt_count >= r.max_pre_submit_attempts", "CONTACT_FORM_APPROVAL_STALE",
  "a.content_fingerprint <> fingerprint", "CONTACT_FORM_ACCEPTED_INITIAL_EXISTS", "'contact_form'", "'accepted'",
  "revoke all on function public.confirm_backlink_contact_form_submission_v1", "grant execute on function public.confirm_backlink_contact_form_submission_v1(uuid,text,text,text) to service_role",
  "order by created_at,id", "Durable contact-form browser execution queue. C2 defines no browser execution.",
]) assert.ok(migration.includes(clause), `missing migration contract: ${clause}`);
assert.match(
  migration,
  /from\s+public\.backlink_contact_form_approvals\s+as\s+approval\s+where[\s\S]*?approval\.content_fingerprint\s*=\s*f\s+for\s+update/i,
  "approval idempotence lookup must use an explicit SQL table alias",
);
assert.doesNotMatch(
  migration,
  /from\s+public\.backlink_contact_form_approvals\s+where[\s\S]*?a\.content_fingerprint\s*=\s*f\s+for\s+update/i,
  "PL/pgSQL row variable must not masquerade as a SQL table alias",
);
assert.match(
  migration,
  /from\s+public\.backlink_contact_form_runs\s+as\s+run\s+where[\s\S]*?run\.state\s+in\s*\(\s*'queued'/i,
  "queue live-run lookup must qualify RETURNS TABLE state through a SQL table alias",
);
assert.doesNotMatch(
  migration,
  /from\s+public\.backlink_contact_form_runs\s+where[\s\S]*?\bstate\s+in\s*\(\s*'queued'/i,
  "queue live-run lookup must not use unqualified RETURNS TABLE state",
);
const sourceFiles = [
  "app/api/backlinks/outreach/[id]/contact-form/route.ts",
  "app/api/backlinks/outreach/[id]/contact-form/approval/route.ts",
  "app/api/backlinks/outreach/[id]/contact-form/queue/route.ts",
  "lib/backlinks/repositories/contactFormAutomationRepository.ts",
  "lib/backlinks/services/contactFormAutomationService.ts",
  "lib/backlinks/services/contactFormApprovalFingerprint.ts",
];
const automationService = readFileSync(join(process.cwd(), "lib/backlinks/services/contactFormAutomationService.ts"), "utf8");
assert.match(automationService, /finalAttemptStatus: currentRun\?\.state === "submission_confirmed" \? "accepted" : null/);
assert.match(automationService, /delivery_state: "unknown"/);
assert.match(automationService, /reply_state: "unknown"/);
assert.match(automationService, /backlink_state: "unknown"/);

const executionPrimitive = /(?:from\s+["'](?:playwright|playwright-core|puppeteer)["']|require\(["'](?:playwright|playwright-core|puppeteer)["']\)|\b(?:chromium|firefox|webkit)\s*\.\s*launch\s*\(|\b(?:scheduleJob|setInterval|setTimeout|cron)\s*\()/;
for (const file of sourceFiles) {
  const source = readFileSync(join(process.cwd(), file), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
  assert.ok(!executionPrimitive.test(source), `unexpected browser execution or scheduler primitive: ${file}`);
}
console.log("contact-form automation foundation contract tests passed");
