import { getMarketingAiDashboard } from "@/lib/admin/marketingAiDashboard";

export default async function MarketingAiAdminPage() {
  const dashboard = await getMarketingAiDashboard();

  return (
    <div className="space-y-6 text-sm md:space-y-7">
      <section className="nk-card overflow-hidden rounded-3xl border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,rgba(14,116,144,0.10),transparent_34%),radial-gradient(circle_at_90%_10%,rgba(2,132,199,0.10),transparent_28%),linear-gradient(135deg,#ffffff_0%,#f8fafc_52%,#ecfeff_100%)] p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08),0_1px_0_rgba(255,255,255,0.75)_inset]">
        <div className="max-w-3xl space-y-3">
          <p className="inline-flex rounded-full border border-sky-200/80 bg-white/85 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-700 shadow-sm">
            Norixo AI
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">
            Marketing AI Operating System
          </h1>
          <p className="text-sm leading-6 text-slate-600">
            Vue admin dédiée au pipeline Marketing AI. Cette V1 lit les exports
            structurés de{" "}
            <code className="rounded-md border border-slate-200/80 bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-800 shadow-sm">
              marketing-agent/dashboard-data/scenario-registry.json
            </code>
            .
          </p>
          {!dashboard.available ? (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 shadow-sm">
              {dashboard.message}
            </p>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[
          { label: "Global Status", value: dashboard.globalStatus },
          { label: "Scenarios", value: String(dashboard.scenarios) },
          { label: "Healthy", value: String(dashboard.healthy) },
          { label: "Warnings", value: String(dashboard.warnings) },
          { label: "Errors", value: String(dashboard.errors) },
          { label: "Ready Scenario", value: dashboard.readyScenario },
        ].map((card) => (
          <article
            key={card.label}
            className="nk-card rounded-3xl border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-[0_16px_42px_rgba(15,23,42,0.06),0_1px_0_rgba(255,255,255,0.72)_inset]"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {card.label}
            </p>
            <p className="mt-3 text-lg font-semibold tracking-tight text-slate-950">
              {card.value}
            </p>
          </article>
        ))}
      </section>

      <section className="nk-card rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_18px_48px_rgba(15,23,42,0.07),0_1px_0_rgba(255,255,255,0.75)_inset]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Readiness
        </p>
        <div
          className={`mt-4 inline-flex rounded-full px-4 py-2 text-sm font-semibold ${
            dashboard.readiness === "READY FOR REAL PROVIDERS"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          {dashboard.readiness}
        </div>
      </section>
    </div>
  );
}
