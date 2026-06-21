import Link from "next/link";
import { Hero, SectionHeader, SummaryCard } from "@/components/admin/marketing-ai";


const MARKETING_STUDIO_WORKFLOW = [
  {
    name: "Marketing Manager",
    role: "Décide la stratégie de communication Norixo.io",
    inputType: "Objectif marketing",
    outputType: "Brief stratégique",
  },
  {
    name: "Content Planner",
    role: "Prépare le calendrier éditorial",
    inputType: "Brief stratégique",
    outputType: "Planning 7 jours",
  },
  {
    name: "Instagram Studio",
    role: "Prépare Reels, stories, carrousels et hashtags",
    inputType: "Planning social",
    outputType: "Contenus Instagram prêts à valider",
  },
  {
    name: "Facebook Studio",
    role: "Prépare les publications pour la page Facebook Norixo",
    inputType: "Planning social",
    outputType: "Posts Facebook prêts à valider",
  },
  {
    name: "LinkedIn Studio",
    role: "Prépare les posts B2B pour conciergeries et gestionnaires",
    inputType: "Angle produit",
    outputType: "Posts LinkedIn prêts à valider",
  },
  {
    name: "SEO Studio",
    role: "Prépare articles, FAQ et contenus Google pour Norixo.io",
    inputType: "Sujet SEO",
    outputType: "Contenus SEO prêts à intégrer",
  },
  {
    name: "Creative Director",
    role: "Définit le style visuel, les images et les assets",
    inputType: "Brief créatif",
    outputType: "Prompts visuels et direction artistique",
  },
  {
    name: "Video Script Agent",
    role: "Écrit les scripts vidéo, voix off et storyboards",
    inputType: "Brief vidéo",
    outputType: "Script vidéo prêt à produire",
  },
  {
    name: "Video Assembly Agent",
    role: "Assemblera plus tard captures, voix, musique et transitions",
    inputType: "Script + assets",
    outputType: "Vidéo prête à publier",
  },
];

const WORKFLOW_SUMMARY = [
  { label: "Étapes", value: String(MARKETING_STUDIO_WORKFLOW.length) },
  { label: "Canaux", value: "Instagram · Facebook · LinkedIn · SEO" },
  { label: "Validation", value: "Manuelle" },
  { label: "Publication", value: "Après contrôle" },
];

export default function MarketingAiWorkflowsPage() {
  return (
    <div className="space-y-6 text-sm md:space-y-7">
      <Hero
        title="Campagnes Marketing"
        description={
          <>
            Visualisez comment les contenus marketing seront préparés avant validation et publication.
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
          eyebrow="Workflow Marketing"
          title="Marketing Manager → Contenus → Validation → Publication"
          description="Les étapes ci-dessous représentent le flux cible pour préparer les contenus marketing de Norixo.io avant validation humaine."
        />

        <div className="space-y-0">
          {MARKETING_STUDIO_WORKFLOW.map((step, index) => {
            const isLastStep = index === MARKETING_STUDIO_WORKFLOW.length - 1;

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
