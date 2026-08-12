import { buildEditorialAuditContext } from "./context";
import { runEditorialAudit } from "./engine";
import type { EditorialAuditModule } from "./engine";
import type { EditorialClusterAudit } from "./types";

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

export function runEditorialAuditEngineSmokeTest(): void {
  const context = buildEditorialAuditContext();
  const snapshot = JSON.stringify(context);
  assert(context.contentNodes.length > 0 && context.editorialNodes.length > 0, "Context must be populated.");
  const empty = runEditorialAudit(context, []);
  assert(empty.schemaVersion === "1" && empty.generatedBy === "norixo-editorial-audit" && empty.clusters.length === 0 && empty.issues.length === 0 && JSON.stringify(empty.diagnostics) === "{}", "Empty audit must be valid.");
  const order: string[] = [];
  const modules: readonly EditorialAuditModule<{
    clusters?: readonly EditorialClusterAudit[];
    issues?: readonly { code: string; severity: "info" | "warning"; message: string }[];
    diagnostics?: Record<string, unknown>;
  }>[] = [
    {
      id: "one",
      run: (_context, state) => {
        assert(state, "The engine must provide execution state.");
        assert(state.clusters.length === 0 && state.issues.length === 0 && Object.keys(state.diagnostics).length === 0, "The first module must receive an empty state.");
        order.push("one");
        return { clusters: [{ topicId: "topic:photos", readiness: "ready", issues: [] }], issues: [{ code: "one", severity: "info", message: "one" }], diagnostics: { one: { source: "one" } } };
      },
    },
    {
      id: "two",
      run: (_context, state) => {
        assert(state, "The engine must provide execution state.");
        assert(state.clusters.map((cluster) => cluster.topicId).join(",") === "topic:photos" && state.issues.map((issue) => issue.code).join(",") === "one" && JSON.stringify(state.diagnostics) === '{"one":{"source":"one"}}', "The second module must receive the first module results.");
        order.push("two");
        return { clusters: [{ topicId: "topic:pricing", readiness: "needs_relations", issues: [] }], issues: [{ code: "two", severity: "warning", message: "two" }], diagnostics: { two: { source: "two" } } };
      },
    },
    {
      id: "three",
      run: (_context, state) => {
        assert(state, "The engine must provide execution state.");
        assert(state.clusters.map((cluster) => cluster.topicId).join(",") === "topic:photos,topic:pricing" && state.issues.map((issue) => issue.code).join(",") === "one,two" && Object.keys(state.diagnostics).join(",") === "one,two", "The third module must receive the first two module results.");
        order.push("three");
        return { diagnostics: { three: { source: "three" } } };
      },
    },
  ];
  const report = runEditorialAudit(context, modules);
  assert(JSON.stringify(order) === '["one","two","three"]' && report.clusters.map((cluster) => cluster.topicId).join(",") === "topic:photos,topic:pricing" && report.issues.map((issue) => issue.code).join(",") === "one,two" && Object.keys(report.diagnostics).join(",") === "one,two,three", "Module order and existing results must be preserved.");
  const repeatedOrder: string[] = [];
  const repeatedReport = runEditorialAudit(context, modules.map((module) => ({
    ...module,
    run: (moduleContext, state) => {
      repeatedOrder.push(module.id);
      return module.run(moduleContext, state);
    },
  })));
  assert(JSON.stringify(repeatedOrder) === '["one","two","three"]' && JSON.stringify(repeatedReport) === JSON.stringify(report), "Audit execution must be deterministic.");
  let mutationBlocked = 0;
  const mutationReport = runEditorialAudit(context, [
    { id: "source", run: () => ({ clusters: [{ topicId: "topic:photos" as const, issues: [] }], issues: [{ code: "source", severity: "info" as const, message: "source" }], diagnostics: { source: { value: true } } }) },
    {
      id: "mutator",
      run: (_context, state) => {
        assert(state, "The engine must provide execution state.");
        try { Object.defineProperty(state.clusters, "1", { value: { topicId: "topic:pricing", issues: [] } }); } catch { mutationBlocked += 1; }
        try { Object.defineProperty(state.issues, "0", { value: { code: "mutated" } }); } catch { mutationBlocked += 1; }
        try { Object.defineProperty(state.diagnostics, "mutated", { value: true }); } catch { mutationBlocked += 1; }
        try { Object.defineProperty(state.clusters[0], "topicId", { value: "topic:pricing" }); } catch { mutationBlocked += 1; }
        try { Object.defineProperty(state.diagnostics.source as object, "value", { value: false }); } catch { mutationBlocked += 1; }
        return {};
      },
    },
  ]);
  assert(mutationBlocked === 5 && mutationReport.clusters.length === 1 && mutationReport.clusters[0].topicId === "topic:photos" && mutationReport.issues.length === 1 && JSON.stringify(mutationReport.diagnostics) === '{"source":{"value":true}}', "State mutation attempts must not change accumulated results.");
  assert(JSON.stringify(context) === snapshot && modules.length === 3, "Inputs must not mutate.");
  let collided = false;
  try {
    runEditorialAudit(context, [
      { id: "diagnostic-one", run: () => ({ diagnostics: { shared: "one" } }) },
      { id: "diagnostic-two", run: () => ({ diagnostics: { shared: "two" } }) },
    ]);
  } catch (error) {
    collided = error instanceof Error && error.message === "Duplicate editorial audit diagnostic key: shared";
  }
  assert(collided, "Duplicate diagnostic keys must throw explicitly.");
  let propagated = false;
  try { runEditorialAudit(context, [{ id: "throws", run: () => { throw new Error("expected"); } }]); } catch { propagated = true; }
  assert(propagated, "Module errors must propagate.");
  console.log("Editorial audit engine smoke passed.");
}
