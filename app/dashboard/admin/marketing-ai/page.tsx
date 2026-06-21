import Link from "next/link";
import { getMarketingAiDashboard } from "@/lib/admin/marketingAiDashboard";
import {
  MARKETING_AI_AGENT_REGISTRY,
  MARKETING_AI_PROVIDER_REGISTRY,
  getConnectionSummary,
  getMarketingAiExecutionSimulation,
  getMarketingAiModelCatalog,
} from "@/lib/marketing-ai";

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
  const modelCatalog = getMarketingAiModelCatalog();
  const connectionSummary = getConnectionSummary();
  const executionSimulation = getMarketingAiExecutionSimulation();

  const STATUS_LABELS: Record<string, string> = {
    simulation: "Simulation",
    read_only: "Lecture seule",
    planned: "Planifié",
    not_active: "Non actif",
    active: "Actif",
  };

  return (
    <div className="space-y-6 text-sm md:space-y-7">
      <section className="nk-card overflow-hidden rounded-3xl border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,rgba(14,116,144,0.10),transparent_34%),radial-gradient(circle_at_90%_10%,rgba(2,132,199,0.10),transparent_28%),linear-gradient(135deg,#ffffff_0%,#f8fafc_52%,#ecfeff_100%)] p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08),0_1px_0_rgba(255,255,255,0.75)_inset]">
        <div className="max-w-3xl space-y-3">
          <p className="inline-flex rounded-full border border-sky-200/80 bg-white/85 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-700 shadow-sm">
            NORIXO AI OS
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">
            Norixo AI Operating System
          </h1>
          <p className="text-sm leading-6 text-slate-600">
            Centre de contrôle des agents, providers, routage, sandbox et orchestration du Marketing AI de Norixo.
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
          { label: "Agents", value: String(MARKETING_AI_AGENT_REGISTRY.length) },
          { label: "Providers", value: String(MARKETING_AI_PROVIDER_REGISTRY.length) },
          { label: "Modèles", value: String(modelCatalog.length) },
          { label: "Connexions actives", value: String(connectionSummary.connected) },
          { label: "Étapes simulées", value: String(executionSimulation.totalSteps) },
          { label: "Mode", value: "Simulation" },
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
            AI Core Engines
          </p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
            Moteurs actifs du cockpit Norixo AI
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Vue synthétique des moteurs internes utilisés par le cockpit :
            routage, capacités, connexions, modèles et simulation.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[
            {
              name: "Routing Engine",
              value: "Simulation",
              description: "Sélection du provider et du modèle recommandés.",
            },
            {
              name: "Capability Engine",
              value: "100 %",
              description: "Couverture des capacités requises par les agents.",
            },
            {
              name: "Connection Manager",
              value: `${connectionSummary.total} providers`,
              description: `${connectionSummary.connected} connexion active actuellement.`,
            },
            {
              name: "Execution Simulator",
              value: `${executionSimulation.totalSteps} étapes`,
              description: "Timeline simulée sans appel API ni coût réel.",
            },
            {
              name: "Model Catalog",
              value: `${modelCatalog.length} modèles`,
              description: "Catalogue généré depuis les providers disponibles.",
            },
            {
              name: "Sandbox",
              value: "Passive",
              description: "Zone de test en lecture seule, sans exécution réelle.",
            },
          ].map((engine) => (
            <article
              key={engine.name}
              className="rounded-3xl border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-sm"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {engine.name}
              </p>
              <p className="mt-3 text-lg font-semibold tracking-tight text-slate-950">
                {engine.value}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {engine.description}
              </p>
            </article>
          ))}
        </div>
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
          {MARKETING_AI_AGENT_REGISTRY.map((agent) => (
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
                    {STATUS_LABELS[agent.status] ?? agent.status}
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
                    {agent.description}
                  </p>
                </div>

                <div className="pt-1">
                  <Link
                    href={`/dashboard/admin/marketing-ai/settings/${agent.id}`}
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
