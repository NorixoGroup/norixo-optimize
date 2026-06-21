import Link from "next/link";
import { MARKETING_WORKFLOW_STEPS } from "@/lib/admin/marketingAiRegistry";

const WORKFLOW_SUMMARY = [
  { label: "Étapes", value: String(MARKETING_WORKFLOW_STEPS.length) },
  { label: "Actives", value: "0" },
  { label: "En préparation", value: String(MARKETING_WORKFLOW_STEPS.length) },
  { label: "Exécution", value: "Désactivée" },
];

export default function MarketingAiWorkflowsPage() {
  return (
    <div className="space-y-6 text-sm md:space-y-7">
      <section className="nk-card overflow-hidden rounded-3xl border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,rgba(14,116,144,0.10),transparent_34%),radial-gradient(circle_at_90%_10%,rgba(2,132,199,0.10),transparent_28%),linear-gradient(135deg,#ffffff_0%,#f8fafc_52%,#ecfeff_100%)] p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08),0_1px_0_rgba(255,255,255,0.75)_inset]">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-3xl space-y-3">
            <p className="inline-flex rounded-full border border-sky-200/80 bg-white/85 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-700 shadow-sm">
              Norixo AI
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">
              Workflows IA
            </h1>
            <p className="text-sm leading-6 text-slate-600">
              Vue préparatoire du futur pipeline d'orchestration des agents
              Norixo AI. Aucun workflow réel n'est exécuté depuis cette page.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
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
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {WORKFLOW_SUMMARY.map((item) => (
          <article
            key={item.label}
            className="nk-card rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_16px_42px_rgba(15,23,42,0.06),0_1px_0_rgba(255,255,255,0.72)_inset]"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {item.label}
            </p>
            <p className="mt-3 text-lg font-semibold tracking-tight text-slate-950">
              {item.value}
            </p>
          </article>
        ))}
      </section>

      <section className="nk-card rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_18px_48px_rgba(15,23,42,0.07),0_1px_0_rgba(255,255,255,0.75)_inset]">
        <div className="mb-5 border-b border-slate-200/70 pb-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Pipeline agentique
          </p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
            Marketing Brain → Publication → Learning
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Les étapes ci-dessous représentent le futur flux d'orchestration.
            Toutes les entrées, sorties et statuts sont statiques.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          {MARKETING_WORKFLOW_STEPS.map((step, index) => (
            <article
              key={step.name}
              className="rounded-3xl border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Étape {index + 1}
                  </p>
                  <h3 className="mt-1 text-base font-semibold text-slate-950">
                    {step.name}
                  </h3>
                </div>
                <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-700">
                  {step.status}
                </span>
              </div>

              <p className="mt-3 text-sm font-semibold text-slate-800">
                {step.role}
              </p>

              <div className="mt-4 grid gap-3">
                <div className="rounded-2xl border border-slate-200/80 bg-white p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Entrée prévue
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {step.input}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200/80 bg-white p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Sortie prévue
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {step.output}
                  </p>
                </div>
              </div>
            </article>
          ))}
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
