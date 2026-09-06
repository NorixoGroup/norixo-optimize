import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildContactFormApprovalFingerprint } from "../lib/backlinks/services/contactFormApprovalFingerprint";
import { getContactFormDashboardNextAction } from "../lib/backlinks/services/contactFormAutomationService";

const input = { workspaceId: " workspace ", campaignId: " campaign ", outreachId: " outreach ", contactId: " contact ", opportunityId: " opportunity ", targetUrl: " https://norixo.example/target ", formUrl: " https://example.com/contact ", senderName: " Norixo ", senderEmail: " team@norixo.example ", senderCompany: " Norixo ", senderWebsite: " https://norixo.example ", subject: " Hello ", body: " Body " };
const fingerprint = buildContactFormApprovalFingerprint(input);
assert.match(fingerprint, /^cf1_[0-9a-f]{64}$/);
assert.equal(fingerprint, "cf1_e5ed1a4979bcbdecd752de1a63236875e98a8b0fd26d37b3d58037a9382bb56f");
assert.equal(fingerprint, buildContactFormApprovalFingerprint({ ...input }));
assert.equal(fingerprint, buildContactFormApprovalFingerprint({ ...input, senderFirstName: " ", senderLastName: null }));
for (const key of ["subject", "body", "formUrl", "targetUrl"] as const) assert.notEqual(fingerprint, buildContactFormApprovalFingerprint({ ...input, [key]: `${input[key]} changed` }));
const splitFingerprint = buildContactFormApprovalFingerprint({ ...input, senderName: " Test Sender ", senderFirstName: " Test ", senderLastName: " Sender " });
assert.match(splitFingerprint, /^cf2_[0-9a-f]{64}$/);
assert.equal(splitFingerprint, "cf2_b68c2447a1cf431dbeaf7be8c45c4177a871b264c610098c4d88f1203faa2ed2");
assert.equal(splitFingerprint, buildContactFormApprovalFingerprint({ ...input, senderName: "Test Sender", senderFirstName: "Test", senderLastName: "Sender" }));
assert.notEqual(splitFingerprint, buildContactFormApprovalFingerprint({ ...input, senderName: "Test Sender", senderFirstName: "Changed", senderLastName: "Sender" }));
assert.notEqual(splitFingerprint, buildContactFormApprovalFingerprint({ ...input, senderName: "Test Sender", senderFirstName: "Test", senderLastName: "Changed" }));
assert.notEqual(splitFingerprint, buildContactFormApprovalFingerprint({ ...input, senderName: "Test Sender", senderLastName: "Sender" }));
assert.notEqual(splitFingerprint, buildContactFormApprovalFingerprint({ ...input, senderName: "Test Sender" }));

assert.equal(getContactFormDashboardNextAction(null), "approve");
for (const state of ["queued", "claimed", "navigating", "discovered", "mapped", "filled", "pre_submit_validated", "submitting"]) {
  assert.equal(getContactFormDashboardNextAction({ state }), "worker", `${state} should route to worker`);
}
assert.equal(getContactFormDashboardNextAction({ state: "submission_confirmed" }), "submission_complete");
for (const state of ["submission_ambiguous", "blocked_captcha", "blocked_policy", "failed_pre_submit", "manual_review"]) {
  assert.equal(getContactFormDashboardNextAction({ state }), "manual_review", `${state} should route to manual review`);
}

const migration = readFileSync(join(process.cwd(), "supabase/migrations/20260902120000_add_backlink_contact_form_automation_foundation.sql"), "utf8");
const splitIdentityMigration = readFileSync(join(process.cwd(), "supabase/migrations/20260906120000_add_contact_form_split_sender_identity.sql"), "utf8");
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
for (const clause of [
  "add column sender_first_name text",
  "add column sender_last_name text",
  "content_fingerprint ~ '^(cf1|cf2)_[0-9a-f]{64}$'",
  "create function public.contact_form_approval_fingerprint_v2",
  "drop function public.approve_backlink_contact_form_initial_v1(uuid,uuid,uuid,text,text,text,text)",
  "p_sender_first_name text default null",
  "p_sender_last_name text default null",
  "if sfn is null and sln is null then",
  "public.contact_form_approval_fingerprint(",
  "public.contact_form_approval_fingerprint_v2(",
  "sender_name,sender_first_name,sender_last_name,sender_email",
  "has_current_backlink_contact_form_verification",
  "a.sender_first_name is null and a.sender_last_name is null",
  "grant execute on function public.approve_backlink_contact_form_initial_v1(uuid,uuid,uuid,text,text,text,text,text,text) to service_role",
]) assert.ok(splitIdentityMigration.includes(clause), `missing split identity migration contract: ${clause}`);
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
const approvalRoute = readFileSync(join(process.cwd(), "app/api/backlinks/outreach/[id]/contact-form/approval/route.ts"), "utf8");
assert.match(approvalRoute, /senderFirstName\?: string \| null/);
assert.match(approvalRoute, /senderLastName\?: string \| null/);
assert.match(approvalRoute, /keys\.length < REQUIRED_FIELDS\.length/);
assert.doesNotMatch(approvalRoute, /keys\.length !== 6/);
const repository = readFileSync(join(process.cwd(), "lib/backlinks/repositories/contactFormAutomationRepository.ts"), "utf8");
assert.match(repository, /p_sender_first_name: optionalSenderIdentityPart\(input\.senderFirstName/);
assert.match(repository, /p_sender_last_name: optionalSenderIdentityPart\(input\.senderLastName/);
const databaseTypes = readFileSync(join(process.cwd(), "types/database.types.ts"), "utf8");
assert.match(databaseTypes, /sender_first_name: string \| null/);
assert.match(databaseTypes, /sender_last_name: string \| null/);
assert.match(databaseTypes, /p_sender_first_name\?: string \| null/);
assert.match(databaseTypes, /p_sender_last_name\?: string \| null/);
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
