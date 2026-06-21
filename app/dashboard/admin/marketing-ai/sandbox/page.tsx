import Link from "next/link";
import { MARKETING_SANDBOX_SCENARIOS } from "@/lib/admin/marketingAiRegistry";

const SANDBOX_SUMMARY = [
  { label: "État", value: "Désactivé" },
  { label: "Exécutions", value: "0" },
  { label: "Providers actifs", value: "0" },
  { label: "Dernier test", value: "Aucun" },
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
      <section className="nk-card overflow-hidden rounded-3xl border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,rgba(14,116,144,0.10),transparent_34%),radial-gradient(circle_at_90%_10%,rgba(2,132,199,0.10),transparent_28%),linear-gradient(135deg,#ffffff_0%,#f8fafc_52%,#ecfeff_100%)] p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08),0_1px_0_rgba(255,255,255,0.75)_inset]">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-3xl space-y-3">
            <p className="inline-flex rounded-full border border-sky-200/80 bg-white/85 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-700 shadow-sm">
              Norixo AI
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">
              Sandbox IA
            </h1>
            <p className="text-sm leading-6 text-slate-600">
              Zone préparatoire des futurs tests IA. Cette interface simule les
              scénarios de test sans envoyer de prompt, sans appeler de provider
              et sans déclencher d'exécution réelle.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
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
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {SANDBOX_SUMMARY.map((item) => (
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
            Scénarios de test
          </p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
            Simulations prévues
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Ces scénarios préparent les futurs tests sandbox, mais restent
            entièrement statiques et non exécutables.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {MARKETING_SANDBOX_SCENARIOS.map((scenario) => (
            <article
              key={scenario.name}
              className="rounded-3xl border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-slate-950">
                    {scenario.name}
                  </p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Test futur
                  </p>
                </div>
                <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-700">
                  {scenario.status}
                </span>
              </div>

              <p className="mt-4 text-sm leading-6 text-slate-600">
                {scenario.description}
              </p>

              <div className="mt-4 grid gap-3">
                <div className="rounded-2xl border border-slate-200/80 bg-white p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Modèle prévu
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {scenario.model}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200/80 bg-white p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Provider prévu
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {scenario.provider}
                  </p>
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
