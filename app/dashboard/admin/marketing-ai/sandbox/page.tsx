import Link from "next/link";
import { Hero, SectionHeader, SummaryCard } from "@/components/admin/marketing-ai";
import { getMarketingAiExecutionSimulation } from "@/lib/marketing-ai";

const executionSimulation = getMarketingAiExecutionSimulation();

const SANDBOX_SUMMARY = [
  { label: "État", value: executionSimulation.status },
  { label: "Étapes", value: String(executionSimulation.totalSteps) },
  { label: "Appels API", value: String(executionSimulation.apiCalls) },
  { label: "Coût simulé", value: `${executionSimulation.totalCostEur} €` },
];

const SANDBOX_SAFETY = [
  "Aucun prompt envoyé",
  "Aucune API appelée",
  "Aucune donnée utilisateur utilisée",
  "Aucun coût généré",
  "Aucune publication déclenchée",
  "Aucun provider connecté",
];

export default function MarketingAiSandboxPage() {
  return (
    <div className="space-y-6 text-sm md:space-y-7">
      <Hero
        title="Sandbox IA"
        description={
          <>
            Zone préparatoire des futurs tests IA. Cette interface simule les
            scénarios de test sans envoyer de prompt, sans appeler de provider
            et sans déclencher d'exécution réelle.
          </>
        }
        actions={
          <>
            <Link
              href="/dashboard/admin/marketing-ai/workflows"
              className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
            >
              Workflows IA
            </Link>
            <Link
              href="/dashboard/admin/marketing-ai"
              className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
            >
              Retour Norixo AI
            </Link>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {SANDBOX_SUMMARY.map((item) => (
          <SummaryCard key={item.label} label={item.label} value={item.value} />
        ))}
      </section>

      <section className="nk-card rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_18px_48px_rgba(15,23,42,0.07),0_1px_0_rgba(255,255,255,0.75)_inset]">
        <SectionHeader
          eyebrow="Simulation d'exécution"
          title="Timeline IA simulée"
          description="Cette timeline est générée par l'Execution Simulator Engine. Elle montre le futur flux inter-agents sans appel API, sans provider connecté et sans coût réel."
        />

        <div className="grid gap-4 xl:grid-cols-3">
          {executionSimulation.steps.map((step) => (
            <article
              key={`${step.order}-${step.agentId}`}
              className="rounded-3xl border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Étape {step.order}
                  </p>
                  <p className="mt-1 text-base font-semibold text-slate-950">
                    {step.agentName}
                  </p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {step.role}
                  </p>
                </div>
                <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-700">
                  {step.status}
                </span>
              </div>

              <div className="mt-4 grid gap-3">
                <div className="rounded-2xl border border-slate-200/80 bg-white p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Provider simulé
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {step.providerName}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200/80 bg-white p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Modèle simulé
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {step.model}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200/80 bg-white p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Capacités utilisées
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {step.requiredCapabilities.length > 0
                      ? step.requiredCapabilities.join(" / ")
                      : "Non applicable"}
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200/80 bg-white p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Durée simulée
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">
                      {step.simulatedDurationMs} ms
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200/80 bg-white p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Coût simulé
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">
                      {step.simulatedCostEur} €
                    </p>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="nk-card rounded-3xl border border-emerald-100 bg-emerald-50/70 p-6">
        <div className="mb-4">
          <p className="text-sm font-semibold text-slate-950">
            Sécurité sandbox
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            Les garde-fous ci-dessous garantissent que cette page reste une
            prévisualisation UI sans effet réel.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {SANDBOX_SAFETY.map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-emerald-100 bg-white/80 p-3 text-sm font-semibold text-emerald-800"
            >
              {item}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-amber-100 bg-amber-50/70 p-5">
        <p className="text-sm font-semibold text-slate-950">
          Sandbox désactivée
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          Cette page ne contient aucun formulaire actif, aucun champ modifiable,
          aucun bouton d'exécution et aucun appel API. Elle prépare uniquement
          la future zone de test de Norixo AI.
        </p>
      </section>
    </div>
  );
}
