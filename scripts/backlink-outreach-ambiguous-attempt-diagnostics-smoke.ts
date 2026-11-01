import { diagnoseBacklinkOutreachAmbiguousAttempts } from "../lib/backlinks/services/outreachAmbiguousAttemptDiagnosticsService";
import { listAmbiguousBacklinkOutreachAttempts, type BacklinkOutreachAmbiguousAttemptRow } from "../lib/backlinks/repositories/outreachAttemptsRepository";
import type { BacklinkRepositoryClient } from "../lib/backlinks/repositories/repositoryClient";

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const NOW = "2026-11-01T12:00:00.000Z";
const ago = (s: number) => new Date(Date.parse(NOW) - s * 1000).toISOString();
const row = (id: string, status: string, s: number): BacklinkOutreachAmbiguousAttemptRow => ({ id, outreach_id: "o-" + id, status, channel: "email", provider: "resend", attempt_kind: "initial", requested_at: ago(s), error_code: null, has_provider_message_id: false });

async function main() {
  const calls: string[] = [];
  const store: Record<string, BacklinkOutreachAmbiguousAttemptRow[]> = {
    w1: [row("recent", "requested", 14 * 60 + 59), row("edge", "requested", 15 * 60), row("old", "requested", 3600), row("unk", "unknown", 5), row("ok", "accepted", 9999)],
    w2: [row("other", "unknown", 100)],
  };
  const run = diagnoseBacklinkOutreachAmbiguousAttempts({ now: () => NOW, listAmbiguousAttempts: async (w) => { calls.push(w); return { rows: store[w] ?? [], truncated: false }; } });
  const out = await run({ workspaceId: "w1" });
  const res = out.attempts;
  assert(out.truncated === false && out.limit === 200, "small result must not be truncated");
  const ids = res.map((r) => r.attemptId).sort().join(",");
  assert(ids === "edge,old,unk", `unexpected ids ${ids}`);
  assert(res.every((r) => r.requiresHumanReview === true), "requiresHumanReview must be true");
  assert(res.find((r) => r.attemptId === "old")?.ageSeconds === 3600, "age must come from requested_at");
  assert(res.find((r) => r.attemptId === "unk")?.status === "unknown", "unknown status preserved");
  assert(!/recipient|subject|body|retry/i.test(JSON.stringify(res)), "no sensitive/retry fields");
  assert(calls.length === 1 && calls[0] === "w1", "only requested workspace is read");
  assert(!(await run({ workspaceId: "w2" })).attempts.some((r) => r.attemptId === "old"), "workspace isolation");

  // Repository: only select/filters are used; any write/rpc throws.
  const log: string[] = [];
  const builder: Record<string, unknown> = {};
  for (const m of ["select", "eq", "or", "order", "limit"]) builder[m] = (...a: unknown[]) => { log.push(`${m}:${a.join("|")}`); return builder; };
  builder.then = (resolve: (v: unknown) => void) => resolve({ data: [{ ...row("r1", "unknown", 1), provider_message_id: "pm" }], error: null });
  const forbidden = (n: string) => () => { throw new Error(`forbidden ${n}`); };
  const client = { from: (t: string) => { log.push(`from:${t}`); return Object.assign(builder, { insert: forbidden("insert"), update: forbidden("update"), delete: forbidden("delete"), upsert: forbidden("upsert") }); }, rpc: forbidden("rpc") } as unknown as BacklinkRepositoryClient;
  const { rows } = await listAmbiguousBacklinkOutreachAttempts(client, "w1", ago(900));
  assert(log.includes("eq:workspace_id|w1"), "workspace filter required");
  assert(log[1].startsWith("select:") && !/recipient|reply_token/.test(log[1]), "select must not include recipient or tokens");
  assert(log.includes("limit:201"), "must query limit + 1");
  assert(rows[0].has_provider_message_id === true && !("provider_message_id" in rows[0]), "provider message id not exposed");

  // Truncation: fake source holds N eligible rows and honours .limit(); no writes possible.
  const eligible = Array.from({ length: 201 }, (_, i) => ({ ...row("m" + String(i).padStart(3, "0"), "unknown", 1000 - i), provider_message_id: null }));
  const fakeClient = (available: number) => {
    const b: Record<string, unknown> = {};
    let asked = 0;
    for (const m of ["select", "eq", "or", "order"]) b[m] = () => b;
    b.limit = (l: number) => { asked = l; return b; };
    b.then = (resolve: (v: unknown) => void) => resolve({ data: eligible.slice(0, Math.min(available, asked)), error: null });
    return { from: () => b, rpc: forbidden("rpc") } as unknown as BacklinkRepositoryClient;
  };
  const p201 = await listAmbiguousBacklinkOutreachAttempts(fakeClient(201), "w1", ago(900), 200);
  assert(p201.rows.length === 200 && p201.truncated === true, "201 eligible -> 200 returned and truncated");
  const p200 = await listAmbiguousBacklinkOutreachAttempts(fakeClient(200), "w1", ago(900), 200);
  assert(p200.rows.length === 200 && p200.truncated === false, "exactly 200 eligible -> not truncated");
  const viaService = await diagnoseBacklinkOutreachAmbiguousAttempts({ now: () => NOW, listAmbiguousAttempts: (_w, before, limit) => listAmbiguousBacklinkOutreachAttempts(fakeClient(201), "w1", before, limit) })({ workspaceId: "w1" });
  assert(viaService.attempts.length === 200 && viaService.truncated === true && viaService.limit === 200, "service must expose truncated for 201 eligible");
  const viaService200 = await diagnoseBacklinkOutreachAmbiguousAttempts({ now: () => NOW, listAmbiguousAttempts: (_w, before, limit) => listAmbiguousBacklinkOutreachAttempts(fakeClient(200), "w1", before, limit) })({ workspaceId: "w1" });
  assert(viaService200.attempts.length === 200 && viaService200.truncated === false, "200 eligible must not be truncated");
  console.log("backlink-outreach-ambiguous-attempt-diagnostics-smoke: OK");
}
main().catch((e) => { console.error(e); process.exit(1); });
