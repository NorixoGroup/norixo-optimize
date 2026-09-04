import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/20260904120000_add_exact_contact_form_run_claim.sql"), "utf8");
const repository = readFileSync(join(process.cwd(), "lib/backlinks/repositories/contactFormAutomationRepository.ts"), "utf8");
const worker = readFileSync(join(process.cwd(), "lib/backlinks/services/contactFormNavigationWorker.ts"), "utf8");
const cli = readFileSync(join(process.cwd(), "scripts/contact-form-navigation-worker.ts"), "utf8");

const exactFunction = migration.match(/create function public\.claim_backlink_contact_form_run_by_id_v1[\s\S]*?end; \$\$;/i)?.[0] ?? "";
assert.ok(exactFunction, "exact-run claim function must exist");
assert.match(exactFunction, /p_run_id\s+is\s+null/i, "exact-run claim must validate non-null run id");
assert.match(exactFunction, /worker=''/i, "exact-run claim must validate non-empty worker id");
assert.match(exactFunction, /p_lease_duration_seconds\s+not\s+between\s+30\s+and\s+3600/i, "exact-run claim must preserve generic lease bounds");
assert.match(exactFunction, /where\s+id\s*=\s*p_run_id\s+and\s+state\s*=\s*'queued'\s+for\s+update/i, "exact-run claim must lock only the requested queued run");
assert.match(exactFunction, /update\s+public\.backlink_contact_form_runs[\s\S]*where\s+id\s*=\s*r\.id\s+returning\s+\*\s+into\s+r/i, "exact-run claim must update only the locked row");
assert.doesNotMatch(exactFunction, /order\s+by\s+created_at/i, "exact-run claim must not use generic queued-run ordering");
assert.doesNotMatch(exactFunction, /limit\s+1/i, "exact-run claim must not select an arbitrary run");
assert.doesNotMatch(exactFunction, /skip\s+locked/i, "exact-run claim must not skip to another run");
assert.match(migration, /revoke all on function public\.claim_backlink_contact_form_run_by_id_v1\(uuid,text,integer\) from public, anon, authenticated/i, "exact-run claim must revoke public/authenticated execution");
assert.match(migration, /grant execute on function public\.claim_backlink_contact_form_run_by_id_v1\(uuid,text,integer\) to service_role/i, "exact-run claim must grant service_role only");

const exactRepositoryHelper = repository.match(/export async function claimContactFormRunById[\s\S]*?\n}\nexport async function heartbeatContactFormRun/)?.[0] ?? "";
assert.ok(exactRepositoryHelper, "repository helper must exist");
assert.match(exactRepositoryHelper, /client\.rpc\("claim_backlink_contact_form_run_by_id_v1"/, "repository helper must call exact-run RPC");
assert.doesNotMatch(exactRepositoryHelper, /\.from\(|\.update\(/, "repository helper must not emulate atomic claim in application code");

assert.match(worker, /targetRunId\?:\s*string/, "worker options must accept targetRunId");
assert.match(worker, /claimRunById:\s*\(runId,\s*workerId,\s*leaseDurationSeconds\)\s*=>\s*claimContactFormRunById/, "production dependencies must map exact claim to repository RPC helper");
assert.match(worker, /settings\.targetRunId == null\s*\?\s*await deps\.claimNextRun[\s\S]*:\s*await deps\.claimRunById/, "worker must branch between generic and exact claim");
assert.doesNotMatch(worker, /claimRunById[\s\S]{0,200}\?\?[\s\S]{0,200}claimNextRun/, "worker must not fall back from exact claim to generic claim with nullish coalescing");
assert.match(worker, /input\.browserRuntime == null && settings\.targetRunId != null[\s\S]*claimContactFormRunById[\s\S]*if \(claimedRun == null\) return \{ kind: "target_unavailable"[\s\S]*createPlaywrightChromiumBrowserRuntime/i, "top-level targeted path must claim before creating browser runtime");
assert.match(cli, /CONTACT_FORM_TARGET_RUN_ID/, "CLI must expose target run id env input");
assert.match(cli, /targetRunId:\s*readTargetRunId\(\)/, "CLI must pass trimmed targetRunId to worker options");
assert.doesNotMatch(cli, /CONTACT_FORM_TARGET_RUN_ID[\s\S]{0,240}allowRealSubmission:\s*true/, "target run id must not enable real submission");

console.log("contact-form exact-run targeting smoke tests passed");
