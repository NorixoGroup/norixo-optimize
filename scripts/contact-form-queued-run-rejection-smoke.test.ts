import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/20260905120000_reject_queued_contact_form_run.sql"), "utf8");
const repository = readFileSync(join(process.cwd(), "lib/backlinks/repositories/contactFormAutomationRepository.ts"), "utf8");
const worker = readFileSync(join(process.cwd(), "lib/backlinks/services/contactFormNavigationWorker.ts"), "utf8");
const cli = readFileSync(join(process.cwd(), "scripts/contact-form-navigation-worker.ts"), "utf8");
const exactClaimMigration = readFileSync(join(process.cwd(), "supabase/migrations/20260904120000_add_exact_contact_form_run_claim.sql"), "utf8");

const rejectionFunction = migration.match(/create function public\.reject_backlink_contact_form_queued_run_v1[\s\S]*?end; \$\$;/i)?.[0] ?? "";
assert.ok(rejectionFunction, "pre-execution rejection RPC must exist");
assert.match(rejectionFunction, /p_run_id\s+is\s+null/i, "exact run id is required");
assert.match(rejectionFunction, /reason\s+!~\s+'\^\[A-Z0-9_\]\{1,80\}\$'/i, "reason code must be bounded and safe");
assert.match(rejectionFunction, /where\s+id\s*=\s*p_run_id\s+and\s+state\s*=\s*'queued'\s+for\s+update/i, "RPC must lock only the exact queued run");
assert.match(rejectionFunction, /if\s+not\s+found\s+then\s+return/i, "missing or non-queued target must fail closed without mutation");
assert.match(rejectionFunction, /update\s+public\.backlink_contact_form_runs\s+set\s+state='manual_review'[\s\S]*finished_at=now_value[\s\S]*safe_error_code=reason[\s\S]*where\s+id\s*=\s*r\.id\s+returning\s+\*\s+into\s+r/i, "RPC must transition only the locked row to manual_review and set finished_at/safe_error_code");
assert.match(rejectionFunction, /insert\s+into\s+public\.backlink_contact_form_run_events[\s\S]*'manual_review'[\s\S]*'pre_execution_manual_review'[\s\S]*jsonb_build_object\('reason_code',reason,'source','admin_pre_execution_rejection'\)[\s\S]*reason[\s\S]*now_value/i, "RPC must append one bounded immutable event");
assert.doesNotMatch(rejectionFunction, /order\s+by\s+created_at|limit\s+1|skip\s+locked|claim_next_backlink_contact_form_run_v1/i, "RPC must not contain generic queued-run fallback selection");
assert.doesNotMatch(rejectionFunction, /insert\s+into\s+public\.backlink_outreach_attempts/i, "RPC must not create outreach attempts");
assert.doesNotMatch(rejectionFunction, /update\s+public\.backlink_outreach\b/i, "RPC must not mutate outreach");
assert.doesNotMatch(rejectionFunction, /update\s+public\.backlink_contact_form_approvals\b/i, "RPC must not mutate approvals");
assert.doesNotMatch(rejectionFunction, /claimed_by\s*=|claimed_at\s*=|lease_expires_at\s*=|heartbeat_at\s*=|started_at\s*=|final_attempt_id\s*=/i, "RPC must not claim, lease, start, or attach attempts");
assert.match(migration, /revoke all on function public\.reject_backlink_contact_form_queued_run_v1\(uuid,text\) from public, anon, authenticated/i, "RPC must revoke public/anon/authenticated execution");
assert.match(migration, /grant execute on function public\.reject_backlink_contact_form_queued_run_v1\(uuid,text\) to service_role/i, "RPC must grant only service_role execution");

const rejectionRepositoryHelper = repository.match(/export async function rejectQueuedContactFormRun[\s\S]*?\n}\nexport async function heartbeatContactFormRun/)?.[0] ?? "";
assert.ok(rejectionRepositoryHelper, "repository helper must exist");
assert.match(rejectionRepositoryHelper, /client\.rpc\("reject_backlink_contact_form_queued_run_v1"/, "repository helper must call only rejection RPC");
assert.doesNotMatch(rejectionRepositoryHelper, /\.from\(|\.update\(/, "repository helper must not emulate select/update app-side");

assert.doesNotMatch(`${worker}\n${cli}`, /reject_backlink_contact_form_queued_run_v1|rejectQueuedContactFormRun|pre_execution_manual_review/, "worker/CLI must not integrate administrative rejection implicitly");
assert.match(exactClaimMigration, /create function public\.claim_backlink_contact_form_run_by_id_v1/i, "existing exact-run claim migration remains present");
assert.match(exactClaimMigration, /where id=p_run_id and state='queued' for update/i, "existing exact-run claim remains exact queued-only");
assert.match(worker, /CONTACT_FORM_REAL_SUBMISSION_ENABLED === "true"/, "real-submission gate remains exact true only");

console.log("contact-form queued-run rejection smoke tests passed");
