import Link from "next/link";
import {
  getMarketingAiDashboard,
  MARKETING_AI_AGENTS,
} from "@/lib/admin/marketingAiDashboard";

export default async function MarketingAiAdminPage() {
  const dashboard = await getMarketingAiDashboard();
  const agentStatus = dashboard.available ? "Prêt" : "Indisponible";
  const readinessLabel =
    dashboard.readiness === "READY FOR REAL PROVIDERS"
      ? "PRÊT POUR LES VRAIS PROVIDERS"
      : dashboard.readiness;
  const fallbackMessage = !dashboard.available
    ? "Les données du tableau de bord sont indisponibles.\n\nExécutez l'export du Dashboard pour générer les données."
    : null;
  const scenarioCards = dashboard.scenariosList.map((scenario) => ({
    ...scenario,
    nextStep: "Provider Integration",
  }));

  return (
    <div className="space-y-6 text-sm md:space-y-7">
      <section className="nk-card overflow-hidden rounded-3xl border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,rgba(14,116,144,0.10),transparent_34%),radial-gradient(circle_at_90%_10%,rgba(2,132,199,0.10),transparent_28%),linear-gradient(135deg,#ffffff_0%,#f8fafc_52%,#ecfeff_100%)] p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08),0_1px_0_rgba(255,255,255,0.75)_inset]">
        <div className="max-w-3xl space-y-3">
          <p className="inline-flex rounded-full border border-sky-200/80 bg-white/85 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-700 shadow-sm">
            Norixo AI
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">
            Centre de pilotage Norixo AI
          </h1>
          <p className="text-sm leading-6 text-slate-600">
            Vue d'administration dédiée au pipeline Marketing IA de Norixo.
            <br />
            Les données affichées proviennent des exports structurés du
            Marketing Agent, notamment{" "}
            <code className="rounded-md border border-slate-200/80 bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-800 shadow-sm">
              marketing-agent/dashboard-data/scenario-registry.json
            </code>
            .
          </p>
          {fallbackMessage ? (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 shadow-sm">
              {fallbackMessage}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/dashboard/admin/marketing-ai/providers"
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
            >
              Connexions IA
            </Link>
            <Link
              href="/dashboard/admin/marketing-ai/models"
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
            >
              Modèles IA
            </Link>
            <Link
              href="/dashboard/admin/marketing-ai/workflows"
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
            >
              Workflows IA
            </Link>
            <Link
              href="/dashboard/admin/marketing-ai/sandbox"
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
            >
              Sandbox IA
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[
          { label: "État global", value: dashboard.globalStatus },
          { label: "Scénarios", value: String(dashboard.scenarios) },
          { label: "En bonne santé", value: String(dashboard.healthy) },
          { label: "Avertissements", value: String(dashboard.warnings) },
          { label: "Erreurs", value: String(dashboard.errors) },
          { label: "Scénario prêt", value: dashboard.readyScenario },
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
        <div className="mb-5 border-b border-slate-200/70 pb-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Vue agents
          </p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
            État des agents Norixo AI
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Vue synthétique des briques du Marketing AI Operating System, en
            lecture seule, sans exécution d&apos;agent ni appel provider.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {MARKETING_AI_AGENTS.map((agent) => (
            <article
              key={agent.name}
              className="nk-card rounded-3xl border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-[0_16px_42px_rgba(15,23,42,0.06),0_1px_0_rgba(255,255,255,0.72)_inset]"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {agent.name}
              </p>

              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Statut
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-950">
                    {agentStatus}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Rôle
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {agent.role}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Prochaine étape
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {agent.nextStep}
                  </p>
                </div>

                <div className="pt-1">
                  <Link
                    href={`/dashboard/admin/marketing-ai/settings/${agent.slug}`}
                    className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                  >
                    Paramètres
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>

        <p className="mt-5 text-sm leading-6 text-slate-600">
          Les paramètres avancés des agents seront configurables dans une
          prochaine étape. Pour l&apos;instant, ces boutons préparent la future
          interface de configuration.
        </p>
      </section>

      <section className="nk-card rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_18px_48px_rgba(15,23,42,0.07),0_1px_0_rgba(255,255,255,0.75)_inset]">
        <div className="mb-5 border-b border-slate-200/70 pb-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Vue scénarios
          </p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
            Scénarios Marketing AI
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Vue consolidée des scénarios présents dans l&apos;export dashboard,
            sans lecture directe des fichiers Markdown.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {scenarioCards.map((scenario) => (
            <article
              key={scenario.id}
              className="nk-card rounded-3xl border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-[0_16px_42px_rgba(15,23,42,0.06),0_1px_0_rgba(255,255,255,0.72)_inset]"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {scenario.id}
              </p>

              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Campagne
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-950">
                    {scenario.campaign}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Statut
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-950">
                    {scenario.status}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    État de préparation
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-950">
                    {scenario.readiness}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Prochaine étape
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {scenario.nextStep}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="nk-card rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_18px_48px_rgba(15,23,42,0.07),0_1px_0_rgba(255,255,255,0.75)_inset]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          État de préparation
        </p>
        <div
          className={`mt-4 inline-flex rounded-full px-4 py-2 text-sm font-semibold ${
            dashboard.readiness === "READY FOR REAL PROVIDERS"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          {readinessLabel}
        </div>
      </section>
    </div>
  );
}
