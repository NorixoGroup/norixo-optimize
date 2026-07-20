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
  const visibleAgentIds = new Set([
    "marketing-manager",
    "campaign",
    "content",
    "image",
    "video",
  ]);
  const visibleAgents = MARKETING_AI_AGENT_REGISTRY.filter((agent) =>
    visibleAgentIds.has(agent.id)
  );

  const STATUS_LABELS: Record<string, string> = {
    active: "Actif",
    planned: "Prévu",
    dormant: "Dormant",
  };

  const STATUS_BADGE_CLASSES: Record<string, string> = {
    active: "border-emerald-200 bg-emerald-50 text-emerald-700",
    planned: "border-amber-200 bg-amber-50 text-amber-700",
    dormant: "border-slate-200 bg-slate-100 text-slate-700",
  };

  return (
    <div className="space-y-6 text-sm md:space-y-7">
      <section className="nk-card overflow-hidden rounded-3xl border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,rgba(14,116,144,0.10),transparent_34%),radial-gradient(circle_at_90%_10%,rgba(2,132,199,0.10),transparent_28%),linear-gradient(135deg,#ffffff_0%,#f8fafc_52%,#ecfeff_100%)] p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08),0_1px_0_rgba(255,255,255,0.75)_inset]">
        <div className="max-w-3xl space-y-3">
          <p className="inline-flex rounded-full border border-sky-200/80 bg-white/85 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-700 shadow-sm">
            NORIXO MARKETING STUDIO
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">
            Norixo Marketing Studio
          </h1>
          <p className="text-sm leading-6 text-slate-600">
            Votre studio de création marketing pour développer Norixo.io.
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
              Campagnes Marketing
            </Link>

          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[
          { label: "Studios", value: String(visibleAgents.length) },
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

      <section className="nk-card rounded-3xl border border-emerald-100 bg-emerald-50/70 p-6 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
        <div className="mb-5 border-b border-emerald-100 pb-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
            System Health
          </p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
            Santé opérationnelle du cockpit
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            Résumé passif des fondations Norixo AI. Aucun provider réel n'est
            connecté et aucune exécution n'est déclenchée.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Studios", value: `${visibleAgents.length}/${visibleAgents.length}`, state: "Actifs" },
            { label: "Providers", value: String(MARKETING_AI_PROVIDER_REGISTRY.length), state: "Prêts" },
            { label: "Connexions", value: String(connectionSummary.connected), state: "Simulation" },
            { label: "Routing", value: "OK", state: "Passif" },
            { label: "Capabilities", value: "100 %", state: "Couvert" },
            { label: "Execution", value: "Simulation", state: `${executionSimulation.totalSteps} étapes` },
            { label: "API", value: String(executionSimulation.apiCalls), state: "Aucun appel" },
          ].map((item) => (
            <article
              key={item.label}
              className="rounded-2xl border border-emerald-100 bg-white/85 p-4 shadow-sm"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                {item.label}
              </p>
              <p className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
                {item.value}
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {item.state}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="nk-card rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_18px_48px_rgba(15,23,42,0.07),0_1px_0_rgba(255,255,255,0.75)_inset]">
        <div className="mb-5 border-b border-slate-200/70 pb-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Execution Pipeline
          </p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
            Workflow du Marketing Studio
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Vue générée depuis l'Creative Studio. Elle montre comment les
            agents s'enchaînent sans déclencher d'appel API ni provider réel.
          </p>
        </div>

        <div className="space-y-0">
          {executionSimulation.steps.map((step, index) => {
            const isLastStep = index === executionSimulation.steps.length - 1;

            return (
              <div key={`${step.order}-${step.agentId}`} className="relative">
                <article className="rounded-3xl border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4 shadow-sm">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-violet-200 bg-violet-50 text-xs font-bold text-violet-700">
                        {step.order}
                      </div>
                      <div>
                        <h3 className="text-base font-semibold tracking-tight text-slate-950">
                          {step.agentName}
                        </h3>
                        <p className="mt-1 text-xs leading-5 text-slate-600">
                          {step.role}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="inline-flex rounded-full border border-sky-100 bg-sky-50 px-2.5 py-0.5 font-semibold text-sky-700">
                        {step.providerName}
                      </span>
                      <span className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-0.5 font-semibold text-slate-700">
                        {step.model}
                      </span>
                      <span className="inline-flex rounded-full border border-violet-100 bg-violet-50 px-2.5 py-0.5 font-semibold text-violet-700">
                        {step.status}
                      </span>
                    </div>
                  </div>
                </article>

                {!isLastStep ? (
                  <div className="flex justify-center py-2">
                    <div className="flex flex-col items-center text-violet-400">
                      <span className="h-6 w-px bg-violet-200" />
                      <span className="text-base leading-none">↓</span>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section className="nk-card rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_18px_48px_rgba(15,23,42,0.07),0_1px_0_rgba(255,255,255,0.75)_inset]">
        <div className="mb-5 border-b border-slate-200/70 pb-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Marketing Studio
          </p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
            Outils disponibles
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Les outils actuellement disponibles pour créer les contenus marketing de Norixo.io.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[
            {
              name: "Marketing Manager",
              value: "Simulation",
              description: "Coordonne les campagnes marketing.",
            },
            {
              name: "Content Planner",
              value: "100 %",
              description: "Prépare les contenus à produire.",
            },
            {
              name: "Connexions IA",
              value: `${connectionSummary.total} providers`,
              description: `${connectionSummary.connected} connexion active actuellement.`,
            },
            {
              name: "Creative Studio",
              value: `${executionSimulation.totalSteps} étapes`,
              description: "Prépare les images et vidéos.",
            },
            {
              name: "Catalogue IA",
              value: `${modelCatalog.length} modèles`,
              description: "Modèles IA disponibles.",
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
            Studios marketing
          </p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
            Studios disponibles
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Vue synthétique des studios marketing utiles aujourd’hui, en
            lecture seule, sans exécution d&apos;agent ni appel provider.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleAgents.map((agent) => (
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
                  <span
                    className={`mt-2 inline-flex w-fit rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                      STATUS_BADGE_CLASSES[agent.status] ??
                      "border-slate-200 bg-slate-100 text-slate-700"
                    }`}
                  >
                    {STATUS_LABELS[agent.status] ?? agent.status}
                  </span>
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
