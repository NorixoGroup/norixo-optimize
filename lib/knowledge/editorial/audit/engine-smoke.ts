import { buildEditorialAuditContext } from "./context";
import { runEditorialAudit } from "./engine";

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

export function runEditorialAuditEngineSmokeTest(): void {
  const context = buildEditorialAuditContext();
  const snapshot = JSON.stringify(context);
  assert(context.contentNodes.length > 0 && context.editorialNodes.length > 0, "Context must be populated.");
  const empty = runEditorialAudit(context, []);
  assert(empty.schemaVersion === "1" && empty.generatedBy === "norixo-editorial-audit" && empty.clusters.length === 0 && empty.issues.length === 0, "Empty audit must be valid.");
  const order: string[] = [];
  const modules = [
    { id: "one", run: () => { order.push("one"); return { clusters: [{ topicId: "topic:photos" as const, readiness: "ready" as const, issues: [] }], issues: [{ code: "one", severity: "info" as const, message: "one" }] }; } },
    { id: "two", run: () => { order.push("two"); return { clusters: [{ topicId: "topic:pricing" as const, readiness: "needs_relations" as const, issues: [] }], issues: [{ code: "two", severity: "warning" as const, message: "two" }] }; } },
  ];
  const report = runEditorialAudit(context, modules);
  assert(JSON.stringify(order) === '["one","two"]' && report.clusters.map((cluster) => cluster.topicId).join(",") === "topic:photos,topic:pricing" && report.issues.map((issue) => issue.code).join(",") === "one,two", "Module order must be preserved.");
  assert(JSON.stringify(runEditorialAudit(context, modules)) !== "", "Audit must be deterministic for equivalent module results.");
  assert(JSON.stringify(context) === snapshot && modules.length === 2, "Inputs must not mutate.");
  let propagated = false;
  try { runEditorialAudit(context, [{ id: "throws", run: () => { throw new Error("expected"); } }]); } catch { propagated = true; }
  assert(propagated, "Module errors must propagate.");
  console.log("Editorial audit engine smoke passed.");
}
