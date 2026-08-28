import Link from "next/link";

import type { NextPublicationCard, NextPublicationResolution } from "@/lib/intelligencePublishing/nextWebPublicationAdapter";

export const IPP_REPORT_VIEW_LOCALES = ["en", "fr"] as const;

export type IppMarketReportViewLocale =
  (typeof IPP_REPORT_VIEW_LOCALES)[number];

type Props = Readonly<{
  locale: IppMarketReportViewLocale;
  resolution: NextPublicationResolution;
  relatedCards: readonly NextPublicationCard[];
}>;

function formatValue(
  value: string | number | boolean | null,
  locale: string,
): string {
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  if (typeof value === "boolean") {
    if (locale === "fr") {
      return value ? "Oui" : "Non";
    }
    return value ? "Yes" : "No";
  }
  if (value == null) {
    return locale === "fr" ? "Indisponible" : "Unavailable";
  }
  return value;
}

function getCopy(locale: string) {
  if (locale === "fr") {
    return {
      home: "Accueil",
      reports: "Rapports",
      marketIntelligence: "Intelligence marché",
      confidence: "Confiance",
      freshness: "Fraîcheur",
      canonicalRoute: "Route canonique",
      available: "Disponible",
      methodologyAndLimits: "Méthodologie et limites",
      sources: "Sources",
      citationTitle: "Citer ce rapport",
      citationIntro:
        "Citez la page canonique de ce rapport. Conservez également toute date de publication ou de mise à jour affichée par le rapport.",
      methodologyLink: "Méthodologie de recherche Norixo",
      moreMarketReports: "Autres rapports de marché",
    } as const;
  }

  return {
    home: "Home",
    reports: "Reports",
    marketIntelligence: "Market intelligence",
    confidence: "Confidence",
    freshness: "Freshness",
    canonicalRoute: "Canonical route",
    available: "Available",
    methodologyAndLimits: "Methodology and limits",
    sources: "Sources",
    citationTitle: "Cite this report",
    citationIntro:
      "Cite this report's canonical page. Preserve any publication or update date displayed by the report when one is available.",
    methodologyLink: "Norixo research methodology",
    moreMarketReports: "More market reports",
  } as const;
}

export default function IppMarketReportView({
  locale,
  resolution,
  relatedCards,
}: Props) {
  const manifest = resolution.entry?.manifest;
  if (manifest == null) {
    return null;
  }

  const page = manifest.page;
  const structuredData = manifest.seo.structuredData;
  const copy = getCopy(locale);
  const canonicalUrl = `https://norixo.io${manifest.route.canonical.pathname}`;

  return (
    <main className="min-h-screen bg-[#FAF7F2] text-[#10231F]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <section className="mx-auto max-w-5xl px-6 py-20">
        <nav className="mb-8 text-sm text-[#5F6F68]">
          <Link href="/" className="hover:text-[#10231F]">
            {copy.home}
          </Link>
          <span className="mx-2">/</span>
          <Link href="/reports" className="hover:text-[#10231F]">
            {copy.reports}
          </Link>
          <span className="mx-2">/</span>
          <span>{page.heading}</span>
        </nav>

        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[#D96C3B]">
          {copy.marketIntelligence}
        </p>
        <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
          {page.heading}
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-[#4C5C55]">
          {page.introduction}
        </p>

        <div className="mt-8 flex flex-wrap gap-3 text-sm text-[#10231F]">
          {page.confidence != null ? (
            <span className="rounded-full border border-[#10231F]/10 bg-white px-4 py-2 font-semibold">
              {copy.confidence}: {String(page.confidence.label ?? copy.available)}
            </span>
          ) : null}
          {page.freshness != null ? (
            <span className="rounded-full border border-[#10231F]/10 bg-white px-4 py-2 font-semibold">
              {copy.freshness}: {String(page.freshness.label ?? copy.available)}
            </span>
          ) : null}
          <span className="rounded-full border border-[#10231F]/10 bg-white px-4 py-2 font-semibold">
            {copy.canonicalRoute}: {manifest.route.canonical.pathname}
          </span>
        </div>
      </section>

      {page.facts.length > 0 ? (
        <section className="mx-auto max-w-6xl px-6 pb-12">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {page.facts.slice(0, 8).map((fact) => (
              <article
                key={String(fact.key)}
                className="rounded-3xl bg-white p-6 shadow-sm"
              >
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#D96C3B]">
                  {String(fact.label ?? fact.key)}
                </p>
                <p className="mt-3 text-2xl font-semibold">
                  {formatValue(
                    (fact.value as string | number | boolean | null | undefined) ?? null,
                    locale,
                  )}
                  {typeof fact.unit === "string" && fact.unit.length > 0
                    ? ` ${fact.unit}`
                    : ""}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-6xl px-6 pb-12">
        <div className="grid gap-6">
          {page.sections.map((section) => (
            <article key={section.sectionId} className="rounded-3xl bg-white p-8 shadow-sm">
              <h2 className="text-3xl font-semibold">{section.title}</h2>
              {section.summary ? (
                <p className="mt-4 leading-8 text-[#4C5C55]">{section.summary}</p>
              ) : null}

              {section.dataPoints.length > 0 ? (
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {section.dataPoints.map((point) => (
                    <div
                      key={point.key}
                      className="rounded-2xl border border-[#10231F]/10 bg-[#FAF7F2] p-4"
                    >
                      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#D96C3B]">
                        {point.label}
                      </p>
                      <p className="mt-2 text-xl font-semibold">
                        {formatValue(point.value, locale)}
                        {point.unit ? ` ${point.unit}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      {page.methodology != null || page.disclaimers.length > 0 || page.sources.length > 0 ? (
        <section className="mx-auto max-w-6xl px-6 pb-12">
          <div className="rounded-3xl bg-[#FFF7ED] p-8 shadow-sm">
            <h2 className="text-3xl font-semibold">{copy.methodologyAndLimits}</h2>
            {page.methodology != null ? (
              <>
                <p className="mt-4 leading-8 text-[#4C5C55]">
                  {String(page.methodology.title ?? "")}
                </p>
                {Array.isArray(page.methodology.bullets) ? (
                  <ul className="mt-4 space-y-2 text-[#4C5C55]">
                    {page.methodology.bullets.map((bullet) => (
                      <li key={bullet}>• {bullet}</li>
                    ))}
                  </ul>
                ) : null}
              </>
            ) : null}
            {page.disclaimers.length > 0 ? (
              <ul className="mt-6 space-y-2 text-[#4C5C55]">
                {page.disclaimers.map((disclaimer) => (
                  <li key={disclaimer}>• {disclaimer}</li>
                ))}
              </ul>
            ) : null}
            {page.sources.length > 0 ? (
              <div className="mt-6">
                <h3 className="text-lg font-semibold">{copy.sources}</h3>
                <ul className="mt-3 space-y-2 text-[#4C5C55]">
                  {page.sources.map((source) => (
                    <li key={source}>• {source}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="mt-6">
              <Link
                href="/research/methodology"
                className="text-sm font-semibold text-[#10231F] underline underline-offset-4"
              >
                {copy.methodologyLink}
              </Link>
            </p>
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-6xl px-6 pb-12">
        <div className="rounded-3xl border border-[#10231F]/10 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#D96C3B]">
            Norixo Research
          </p>
          <h2 className="mt-3 text-3xl font-semibold">{copy.citationTitle}</h2>
          <p className="mt-4 max-w-3xl leading-8 text-[#4C5C55]">
            {copy.citationIntro}
          </p>
          <div className="mt-6 rounded-2xl bg-[#FAF7F2] p-5 text-sm leading-7 text-[#4C5C55]">
            <p className="font-semibold text-[#10231F]">Norixo, “{page.heading}”</p>
            <p className="mt-2 break-all">{canonicalUrl}</p>
          </div>
        </div>
      </section>

      {relatedCards.length > 0 ? (
        <section className="mx-auto max-w-6xl px-6 pb-20">
          <h2 className="text-3xl font-semibold">{copy.moreMarketReports}</h2>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {relatedCards.slice(0, 4).map((card) => (
              <Link
                key={card.key}
                href={card.href}
                className="rounded-2xl border border-[#10231F]/10 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <p className="font-semibold">{card.title}</p>
                <p className="mt-2 text-sm leading-6 text-[#5F6F68]">
                  {card.description}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
