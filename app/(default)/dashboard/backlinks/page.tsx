"use client";

import { useState } from "react";

type BacklinkSection = "opportunities" | "campaigns" | "outreach" | "links";

const summaryCards = [
  {
    label: "Opportunités",
    description: "Domaines et pistes identifiés.",
  },
  {
    label: "Campagnes",
    description: "Initiatives d’acquisition organisées.",
  },
  {
    label: "Outreach",
    description: "Prises de contact suivies.",
  },
  {
    label: "Liens obtenus",
    description: "Backlinks enregistrés et vérifiés.",
  },
] as const;

const sections: Record<
  BacklinkSection,
  { label: string; title: string; emptyState: string }
> = {
  opportunities: {
    label: "Opportunités",
    title: "Opportunités de backlinks",
    emptyState:
      "Les opportunités qualifiées apparaîtront ici lorsque la couche de services sera connectée.",
  },
  campaigns: {
    label: "Campagnes",
    title: "Campagnes d’acquisition",
    emptyState: "Les campagnes d’acquisition apparaîtront ici.",
  },
  outreach: {
    label: "Outreach",
    title: "Suivi de l’outreach",
    emptyState: "Les prises de contact et leur suivi apparaîtront ici.",
  },
  links: {
    label: "Liens",
    title: "Liens obtenus",
    emptyState: "Les backlinks acquis et leur statut de vérification apparaîtront ici.",
  },
};

export default function BacklinksPage() {
  const [activeSection, setActiveSection] = useState<BacklinkSection>("opportunities");
  const activeContent = sections[activeSection];

  return (
    <div className="space-y-6 text-slate-900">
      <section className="nk-card overflow-hidden rounded-3xl border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.11),transparent_34%),radial-gradient(circle_at_90%_10%,rgba(16,185,129,0.10),transparent_30%),linear-gradient(135deg,#ffffff_0%,#f8fafc_48%,#eef6ff_100%)] p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08),0_1px_0_rgba(255,255,255,0.75)_inset] md:p-8">
        <div className="max-w-3xl space-y-3">
          <span className="inline-flex rounded-full border border-slate-300 bg-white/80 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">
            Admin privé
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">
              Pilotage des backlinks
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
              Centralisez les opportunités, les campagnes d’outreach et les liens obtenus pour développer
              l’autorité SEO de Norixo.
            </p>
          </div>
        </div>
      </section>

      <section aria-label="Synthèse backlinks" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <article
            key={card.label}
            className="nk-card rounded-3xl border border-slate-200/80 bg-white/95 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.08),0_1px_0_rgba(255,255,255,0.62)_inset]"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{card.label}</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">—</p>
            <p className="mt-3 text-sm leading-5 text-slate-600">{card.description}</p>
          </article>
        ))}
      </section>

      <section className="nk-card rounded-3xl border border-slate-200/80 bg-white/95 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.07),0_1px_0_rgba(255,255,255,0.75)_inset] md:p-6">
        <div
          role="tablist"
          aria-label="Sections backlinks"
          className="flex gap-2 overflow-x-auto border-b border-slate-200 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {(Object.keys(sections) as BacklinkSection[]).map((section) => {
            const isActive = activeSection === section;

            return (
              <button
                key={section}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`backlinks-panel-${section}`}
                id={`backlinks-tab-${section}`}
                onClick={() => setActiveSection(section)}
                className={`rounded-full px-3.5 py-2 text-xs font-bold uppercase tracking-[0.12em] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600 ${
                  isActive
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {sections[section].label}
              </button>
            );
          })}
        </div>

        <div
          id={`backlinks-panel-${activeSection}`}
          role="tabpanel"
          aria-labelledby={`backlinks-tab-${activeSection}`}
          className="py-10 text-center"
        >
          <h2 className="text-lg font-semibold text-slate-950">{activeContent.title}</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">{activeContent.emptyState}</p>
        </div>
      </section>
    </div>
  );
}
