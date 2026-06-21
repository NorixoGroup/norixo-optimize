import Link from "next/link";
import { MARKETING_AI_PROVIDERS } from "@/lib/admin/marketingAiRegistry";

const CONNECTION_SUMMARY = [
  { label: "Providers listés", value: String(MARKETING_AI_PROVIDERS.length) },
  { label: "Connectés", value: "0" },
  { label: "État global", value: "Lecture seule" },
  { label: "Activation", value: "Désactivée" },
];

export default function MarketingAiProvidersPage() {
  return (
    <div className="space-y-6 text-sm md:space-y-7">
      <section className="nk-card overflow-hidden rounded-3xl border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,rgba(14,116,144,0.10),transparent_34%),radial-gradient(circle_at_90%_10%,rgba(2,132,199,0.10),transparent_28%),linear-gradient(135deg,#ffffff_0%,#f8fafc_52%,#ecfeff_100%)] p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08),0_1px_0_rgba(255,255,255,0.75)_inset]">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-3xl space-y-3">
            <p className="inline-flex rounded-full border border-sky-200/80 bg-white/85 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-700 shadow-sm">
              Norixo AI
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">
              Connexions IA
            </h1>
            <p className="text-sm leading-6 text-slate-600">
              Centre de préparation des futurs providers IA, publication,
              image, vidéo et email. Cette page est strictement en lecture
              seule et ne connecte aucun service externe.
            </p>
          </div>

          <Link
            href="/dashboard/admin/marketing-ai"
            className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
          >
            Retour Norixo AI
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {CONNECTION_SUMMARY.map((item) => (
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
            Providers futurs
          </p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
            Catalogue des connexions prévues
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Les connecteurs ci-dessous sont uniquement affichés comme futures
            fondations. Aucun token, aucune clé API et aucun compte externe ne
            sont lus depuis cette interface.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {MARKETING_AI_PROVIDERS.map((provider) => (
            <article
              key={provider.name}
              className="rounded-3xl border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-slate-950">
                    {provider.name}
                  </p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {provider.type}
                  </p>
                </div>
                <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-700">
                  {provider.status}
                </span>
              </div>

              <p className="mt-4 text-sm leading-6 text-slate-600">
                {provider.scope}
              </p>

              <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50/70 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-800">
                  Connexion désactivée
                </p>
                <p className="mt-1 text-xs leading-5 text-amber-800">
                  Interface préparatoire uniquement. Aucun appel provider réel.
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-sky-100 bg-sky-50/70 p-5">
        <p className="text-sm font-semibold text-slate-950">
          Architecture passive
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          Cette page prépare le futur centre de connexions Norixo AI. Les
          providers, clés API, permissions OAuth et quotas seront ajoutés dans
          des versions ultérieures, après validation explicite. Aucun service
          externe n'est actuellement appelé.
        </p>
      </section>
    </div>
  );
}
