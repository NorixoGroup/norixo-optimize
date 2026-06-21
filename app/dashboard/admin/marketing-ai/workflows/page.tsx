import Link from "next/link";
import { Hero, SectionHeader, SummaryCard } from "@/components/admin/marketing-ai";
import { MARKETING_AI_AGENT_REGISTRY } from "@/lib/marketing-ai";

const WORKFLOW_SUMMARY = [
  { label: "Étapes", value: String(MARKETING_AI_AGENT_REGISTRY.length) },
  { label: "Actives", value: "0" },
  { label: "En préparation", value: String(MARKETING_AI_AGENT_REGISTRY.length) },
  { label: "Exécution", value: "Désactivée" },
];

export default function MarketingAiWorkflowsPage() {
  return (
    <div className="space-y-6 text-sm md:space-y-7">
      <Hero
        title="Workflows IA"
        description={
          <>
            Vue préparatoire du futur pipeline d'orchestration des agents
            Norixo AI. Aucun workflow réel n'est exécuté depuis cette page.
          </>
        }
        actions={
          <>
            <Link
              href="/dashboard/admin/marketing-ai/providers"
              className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
            >
              Connexions IA
            </Link>
            <Link
              href="/dashboard/admin/marketing-ai/models"
              className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
            >
              Modèles IA
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
        {WORKFLOW_SUMMARY.map((item) => (
          <SummaryCard key={item.label} label={item.label} value={item.value} />
        ))}
      </section>

      <section className="nk-card rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_18px_48px_rgba(15,23,42,0.07),0_1px_0_rgba(255,255,255,0.75)_inset]">
        <SectionHeader
          eyebrow="Pipeline agentique"
          title="Marketing Manager → Publication → Learning"
          description="Les étapes ci-dessous représentent le futur flux d'orchestration. Toutes les entrées, sorties et statuts sont statiques."
        />

        <div className="space-y-0">
          {MARKETING_AI_AGENT_REGISTRY.map((step, index) => {
            const isLastStep = index === MARKETING_AI_AGENT_REGISTRY.length - 1;

            return (
              <div key={step.name} className="relative">
                <article className="rounded-3xl border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-violet-200 bg-violet-50 text-xs font-bold text-violet-700">
                        {index + 1}
                      </div>
                      <div>
                        <h3 className="text-base font-semibold tracking-tight text-slate-950">
                          {step.name}
                        </h3>
                        <p className="mt-1 text-xs leading-5 text-slate-600">
                          {step.role}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-2 text-xs md:grid-cols-2 md:text-right">
                      <div>
                        <p className="font-semibold uppercase tracking-[0.14em] text-slate-400">
                          Entrée
                        </p>
                        <p className="mt-1 font-semibold text-slate-700">
                          {step.inputType}
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold uppercase tracking-[0.14em] text-slate-400">
                          Sortie
                        </p>
                        <p className="mt-1 font-semibold text-slate-700">
                          {step.outputType}
                        </p>
                      </div>
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

      <section className="rounded-3xl border border-amber-100 bg-amber-50/70 p-5">
        <p className="text-sm font-semibold text-slate-950">
          Orchestration passive
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          Cette page prépare uniquement la représentation du futur workflow
          inter-agents. Aucun runner, aucune file d'attente, aucun provider et
          aucune publication ne sont activés.
        </p>
      </section>
    </div>
  );
}
