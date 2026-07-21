import Link from "next/link";

import type { NextPublicationCard, NextPublicationResolution } from "@/lib/intelligencePublishing/nextWebPublicationAdapter";

type Props = Readonly<{
  resolution: NextPublicationResolution;
  relatedCards: readonly NextPublicationCard[];
}>;

function formatValue(value: string | number | boolean | null): string {
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  return value ?? "Unavailable";
}

export default function IppMarketReportView({ resolution, relatedCards }: Props) {
  const manifest = resolution.entry?.manifest;
  if (manifest == null) {
    return null;
  }

  const page = manifest.page;
  const structuredData = manifest.seo.structuredData;

  return (
    <main className="min-h-screen bg-[#FAF7F2] text-[#10231F]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <section className="mx-auto max-w-5xl px-6 py-20">
        <nav className="mb-8 text-sm text-[#5F6F68]">
          <Link href="/" className="hover:text-[#10231F]">
            Home
          </Link>
          <span className="mx-2">/</span>
          <Link href="/reports" className="hover:text-[#10231F]">
            Reports
          </Link>
          <span className="mx-2">/</span>
          <span>{page.heading}</span>
        </nav>

        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[#D96C3B]">
          Market intelligence
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
              Confidence: {String(page.confidence.label ?? "Available")}
            </span>
          ) : null}
          {page.freshness != null ? (
            <span className="rounded-full border border-[#10231F]/10 bg-white px-4 py-2 font-semibold">
              Freshness: {String(page.freshness.label ?? "Available")}
            </span>
          ) : null}
          <span className="rounded-full border border-[#10231F]/10 bg-white px-4 py-2 font-semibold">
            Canonical route: {manifest.route.canonical.pathname}
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
                        {formatValue(point.value)}
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
            <h2 className="text-3xl font-semibold">Methodology and limits</h2>
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
                <h3 className="text-lg font-semibold">Sources</h3>
                <ul className="mt-3 space-y-2 text-[#4C5C55]">
                  {page.sources.map((source) => (
                    <li key={source}>• {source}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {relatedCards.length > 0 ? (
        <section className="mx-auto max-w-6xl px-6 pb-20">
          <h2 className="text-3xl font-semibold">More market reports</h2>
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
