import Link from "next/link";
import { Hero, SectionHeader, SummaryCard } from "@/components/admin/marketing-ai";
import { MARKETING_AI_PROVIDER_REGISTRY } from "@/lib/marketing-ai";

const CONNECTION_SUMMARY = [
  { label: "Providers listés", value: String(MARKETING_AI_PROVIDER_REGISTRY.length) },
  { label: "Connectés", value: "0" },
  { label: "État global", value: "Lecture seule" },
  { label: "Activation", value: "Désactivée" },
];

export default function MarketingAiProvidersPage() {
  return (
    <div className="space-y-6 text-sm md:space-y-7">
      <Hero
        title="Connexions IA"
        description={
          <>
            Centre de préparation des futurs providers IA, publication, image,
            vidéo et email. Cette page est strictement en lecture seule et ne
            connecte aucun service externe.
          </>
        }
        actions={
          <Link
            href="/dashboard/admin/marketing-ai"
            className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
          >
            Retour Norixo AI
          </Link>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {CONNECTION_SUMMARY.map((item) => (
          <SummaryCard key={item.label} label={item.label} value={item.value} />
        ))}
      </section>

      <section className="nk-card rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_18px_48px_rgba(15,23,42,0.07),0_1px_0_rgba(255,255,255,0.75)_inset]">
        <SectionHeader
          eyebrow="Providers futurs"
          title="Catalogue des connexions prévues"
          description="Les connecteurs ci-dessous sont uniquement affichés comme futures fondations. Aucun token, aucune clé API et aucun compte externe ne sont lus depuis cette interface."
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {MARKETING_AI_PROVIDER_REGISTRY.map((provider) => (
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
                    {provider.category.join(" / ")}
                  </p>
                </div>
                <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-700">
                  {provider.isConnected ? "Connecté" : "Non connecté"}
                </span>
              </div>

              <p className="mt-4 text-sm leading-6 text-slate-600">
                {provider.description}
              </p>

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
