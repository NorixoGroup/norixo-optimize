// G4-M4: runs the real G4-M3 repository query through a real PostgREST over a throwaway local PostgreSQL.
// Driven by scripts/backlink-outreach-ambiguous-attempt-postgrest-harness.sh (do not point at Supabase).
import { createClient } from "@supabase/supabase-js";

import { diagnoseBacklinkOutreachAmbiguousAttempts } from "../lib/backlinks/services/outreachAmbiguousAttemptDiagnosticsService";
import { listAmbiguousBacklinkOutreachAttempts } from "../lib/backlinks/repositories/outreachAttemptsRepository";
import type { BacklinkRepositoryClient } from "../lib/backlinks/repositories/repositoryClient";

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(`ASSERTION FAILED: ${message}`); }
const url = process.env.POSTGREST_URL ?? "";
assert(/^http:\/\/127\.0\.0\.1:\d+$/.test(url), "POSTGREST_URL must be a 127.0.0.1 URL");

const client = createClient(url, "g4m4-anon-key", {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
}) as unknown as BacklinkRepositoryClient;
const W_A = "aaaaaaaa-0000-4000-8000-00000000a001";
const W_B = "bbbbbbbb-0000-4000-8000-00000000b001";
const W_C = "cccccccc-0000-4000-8000-00000000c001";
const W_D = "dddddddd-0000-4000-8000-00000000d001";
const W_E = "eeeeeeee-0000-4000-8000-00000000e001";
const CUTOFF = "2026-11-01T11:45:00.000Z";
const id = (suffix: string) => `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`;

async function main() {
  // 1-6: statuses, boundaries and workspace isolation through the real `.or(...)` + `.eq(workspace_id)`.
  const a = await listAmbiguousBacklinkOutreachAttempts(client, W_A, CUTOFF);
  const ids = a.rows.map((r) => r.id).sort();
  const expected = ["1", "2", "3", "4", "5"].map(id).sort();
  assert(JSON.stringify(ids) === JSON.stringify(expected), `workspace A rows: ${JSON.stringify(ids)}`);
  assert(a.truncated === false, "workspace A must not be truncated");
  const byId = new Map(a.rows.map((r) => [r.id, r]));
  assert(byId.has(id("4")), "requested at exactly the cutoff must be included (lte)");
  assert(byId.has(id("5")), "requested 1 ms before the cutoff must be included");
  assert(!byId.has(id("6")) && !byId.has(id("7")), "recent requested must be excluded");
  assert(!["8", "9", "a", "b"].some((s) => byId.has(id(s))), "accepted/failed/prepared/cancelled must be excluded");
  assert(a.rows.every((r) => r.status === "unknown" || r.status === "requested"), "only unknown/requested returned");
  const b = await listAmbiguousBacklinkOutreachAttempts(client, W_B, CUTOFF);
  assert(b.rows.length === 2 && !b.rows.some((r) => ids.includes(r.id)), "workspace B isolated from A");
  const none = await listAmbiguousBacklinkOutreachAttempts(client, "99999999-0000-4000-8000-000000000000", CUTOFF);
  assert(none.rows.length === 0 && none.truncated === false, "unknown workspace returns nothing");

  // 9: no PII / raw provider_message_id.
  const raw = JSON.stringify([a, b]);
  assert(!/sentinel-recipient|RESEND_SENTINEL/.test(raw), "recipient or raw provider_message_id leaked");
  assert(byId.get(id("1"))?.has_provider_message_id === true && byId.get(id("2"))?.has_provider_message_id === false, "has_provider_message_id flag");
  assert(!("recipient" in a.rows[0]) && !("provider_message_id" in a.rows[0]), "forbidden columns absent");

  // 7-8: limit + 1 / truncated against real PostgREST.
  const c = await listAmbiguousBacklinkOutreachAttempts(client, W_C, CUTOFF, 200);
  assert(c.rows.length === 200 && c.truncated === true, `201 eligible -> 200 + truncated (got ${c.rows.length}/${c.truncated})`);
  assert(c.rows[0].id.endsWith("000000000001") && c.rows[199].id.endsWith("000000000200"), "oldest-first order, 201st dropped");
  const d = await listAmbiguousBacklinkOutreachAttempts(client, W_D, CUTOFF, 200);
  assert(d.rows.length === 200 && d.truncated === false, "exactly 200 eligible -> not truncated");
  const e = await listAmbiguousBacklinkOutreachAttempts(client, W_E, CUTOFF, 200);
  assert(e.rows.length === 150 && e.truncated === false, "300 rows / 150 eligible -> not truncated (ineligible rows not counted)");
  const small = await listAmbiguousBacklinkOutreachAttempts(client, W_D, CUTOFF, 5);
  assert(small.rows.length === 5 && small.truncated === true, "custom limit 5 over 200 eligible -> truncated");

  // Service on top of the real repository (injected clock: cutoff = now - 15 min = CUTOFF).
  const run = diagnoseBacklinkOutreachAmbiguousAttempts({ now: () => "2026-11-01T12:00:00.000Z", listAmbiguousAttempts: (w, before, limit) => listAmbiguousBacklinkOutreachAttempts(client, w, before, limit) });
  const out = await run({ workspaceId: W_A });
  assert(out.attempts.length === 5 && out.truncated === false && out.attempts.every((x) => x.requiresHumanReview === true), "service result on real PostgREST");
  assert(out.attempts.find((x) => x.attemptId === id("4"))?.ageSeconds === 900, "boundary row age is exactly 900 s");
  const outC = await run({ workspaceId: W_C });
  assert(outC.attempts.length === 200 && outC.truncated === true, "service exposes truncated for 201 eligible");

  // 10: negative control — the read-only role cannot write; the harness also checks the table checksum.
  const write = await client.from("backlink_outreach_attempts").update({ status: "accepted" }).eq("workspace_id", W_A);
  assert(write.error != null, "write via the read-only role must be rejected");
  console.log(`write rejected as expected: ${write.error?.code ?? "?"} ${write.error?.message ?? ""}`);
  console.log("backlink-outreach-ambiguous-attempt-postgrest-integration: OK");
}
main().catch((err) => { console.error(err); process.exit(1); });
