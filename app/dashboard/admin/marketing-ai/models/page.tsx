import Link from "next/link";
import { Hero, SectionHeader, SummaryCard } from "@/components/admin/marketing-ai";
import { getMarketingAiModelCatalog } from "@/lib/marketing-ai";

const MARKETING_AI_MODEL_CATALOG = getMarketingAiModelCatalog();

const MODEL_SUMMARY = [
  { label: "LLM", value: String(MARKETING_AI_MODEL_CATALOG.filter((model) => model.category === "LLM").length) },
  { label: "Image", value: String(MARKETING_AI_MODEL_CATALOG.filter((model) => model.category === "Image").length) },
  { label: "Vidéo", value: String(MARKETING_AI_MODEL_CATALOG.filter((model) => model.category === "Vidéo").length) },
  { label: "Voix", value: String(MARKETING_AI_MODEL_CATALOG.filter((model) => model.category === "Voix").length) },
];

export default function MarketingAiModelsPage() {
  return (
    <div className="space-y-6 text-sm md:space-y-7">
      <Hero
        title="Modèles IA"
        description={
          <>
            Catalogue préparatoire des futurs modèles IA utilisables par les
            agents Norixo. Aucun modèle n'est actuellement appelé depuis cette
            interface.
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
              href="/dashboard/admin/marketing-ai"
              className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
            >
              Retour Norixo AI
            </Link>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {MODEL_SUMMARY.map((item) => (
          <SummaryCard key={item.label} label={item.label} value={item.value} />
        ))}
      </section>

      <section className="nk-card rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_18px_48px_rgba(15,23,42,0.07),0_1px_0_rgba(255,255,255,0.75)_inset]">
        <SectionHeader
          eyebrow="Catalogue modèles"
          title="Modèles prévus par catégorie"
          description="Cette liste prépare les futurs choix de modèles pour les agents contenu, image, vidéo, voix, analytics et learning. Toutes les valeurs sont statiques."
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {MARKETING_AI_MODEL_CATALOG.map((model) => (
            <article
              key={`${model.provider}-${model.name}`}
              className="rounded-3xl border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-slate-950">
                    {model.name}
                  </p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {model.category}
                  </p>
                </div>
                <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-700">
                  {model.status}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Provider
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {model.provider}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Usage prévu
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {model.usage}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-sky-100 bg-sky-50/70 p-5">
        <p className="text-sm font-semibold text-slate-950">
          Catalogue passif
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          Les modèles affichés constituent le futur catalogue IA de Norixo.
          Aucun modèle n'est actuellement utilisé, aucune requête IA n'est
          exécutée et aucune clé provider n'est lue depuis cette page.
        </p>
      </section>
    </div>
  );
}
