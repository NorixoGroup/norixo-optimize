import Link from "next/link";
import type { Metadata } from "next";

import { defaultLocale } from "@/data/i18n";
import {
  buildDefaultNextPublicationCatalog,
  getNextPublicationCards,
} from "@/lib/intelligencePublishing/nextWebPublicationAdapter";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";

const siteUrl = "https://norixo.io";
const socialImage = "/og/norixo-research.png";
const reportsCatalog = buildDefaultNextPublicationCatalog();
const publicReportCards = getNextPublicationCards(reportsCatalog)
  .filter((card) => card.source === "ipp_canonical")
  .slice(0, 6);

export const metadata: Metadata = {
  title: "Research & Methodology | Norixo",
  description:
    "Learn how Norixo explains public market data, methodology, confidence, limitations, citation guidance, and publication safeguards.",
  alternates: buildHreflangAlternates("/research", {
    locales: [defaultLocale],
  }),
  openGraph: {
    title: "Research & Methodology | Norixo",
    description:
      "Learn how Norixo explains public market data, methodology, confidence, limitations, citation guidance, and publication safeguards.",
    url: "/research",
    siteName: "Norixo",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: socialImage,
        width: 1200,
        height: 630,
        alt: "Norixo Research",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Research & Methodology | Norixo",
    description:
      "Learn how Norixo explains public market data, methodology, confidence, limitations, citation guidance, and publication safeguards.",
    images: [socialImage],
  },
};

const documents = [
  {
    href: "/research/methodology",
    eyebrow: "Available now",
    title: "Methodology",
    description:
      "Understand how to read aggregated public market data, confidence signals, freshness, limitations, citation guidance, and publication status.",
  },
  {
    href: "/reports",
    eyebrow: "Public outputs",
    title: "Research reports",
    description:
      "Open the public report catalog and review publication-specific scope, evidence, dates, and limitations where available.",
  },
] as const;

export default function ResearchHubPage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "@id": `${siteUrl}/research#webpage`,
      name: "Norixo Research & Methodology",
      description: metadata.description,
      url: `${siteUrl}/research`,
      isPartOf: { "@id": `${siteUrl}/#website` },
      about: { "@id": `${siteUrl}/#organization` },
      publisher: { "@id": `${siteUrl}/#organization` },
      mainEntity: { "@id": `${siteUrl}/research/methodology#article` },
      hasPart: publicReportCards.map((report) => ({
        "@type": "Report",
        name: report.title,
        url: `${siteUrl}${report.href}`,
      })),
    },
    ...(publicReportCards.length > 0
      ? [
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            "@id": `${siteUrl}/research#published-reports`,
            name: "Published Norixo research reports",
            itemListElement: publicReportCards.map((report, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: report.title,
              url: `${siteUrl}${report.href}`,
            })),
          },
        ]
      : []),
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: siteUrl,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Research",
          item: `${siteUrl}/research`,
        },
      ],
    },
  ];

  return (
    <main className="min-h-screen bg-[#FAF7F2] text-[#10231F]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="mx-auto max-w-6xl px-6 py-20">
        <nav className="text-sm text-[#5F6F68]">
          <Link href="/" className="hover:text-[#10231F]">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span>Research</span>
        </nav>

        <p className="mt-10 text-sm font-semibold uppercase tracking-[0.2em] text-[#D96C3B]">
          Norixo Research
        </p>
        <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-tight md:text-6xl">
          Research & Methodology
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-[#4C5C55]">
          This is where Norixo explains how public market information is
          prepared, interpreted, published, corrected, and cited. The goal is to
          make the scope and limits of a signal as clear as its value.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-10">
        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#D96C3B]">
            How to use this hub
          </p>
          <h2 className="mt-3 text-3xl font-semibold">
            Different resources answer different questions
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <article className="rounded-2xl border border-[#10231F]/10 bg-[#FAF7F2] p-5">
              <h3 className="text-xl font-semibold">Guides</h3>
              <p className="mt-3 leading-7 text-[#4C5C55]">
                Educational resources for understanding listing decisions, from
                pricing and photos to visibility and conversion analysis.
              </p>
            </article>
            <article className="rounded-2xl border border-[#10231F]/10 bg-[#FAF7F2] p-5">
              <h3 className="text-xl font-semibold">Tools</h3>
              <p className="mt-3 leading-7 text-[#4C5C55]">
                Simple calculators that help turn a defined metric into a
                practical calculation or comparison.
              </p>
            </article>
            <article className="rounded-2xl border border-[#10231F]/10 bg-[#FAF7F2] p-5">
              <h3 className="text-xl font-semibold">Private audits</h3>
              <p className="mt-3 leading-7 text-[#4C5C55]">
                Listing-specific analysis stays in the customer workspace and
                is not published as a public market example.
              </p>
            </article>
            <article className="rounded-2xl border border-[#10231F]/10 bg-[#FAF7F2] p-5">
              <h3 className="text-xl font-semibold">Public reports</h3>
              <p className="mt-3 leading-7 text-[#4C5C55]">
                Public reports are the preferred citation targets when their
                scope, evidence, publication date, freshness, and limitations
                are available on the report itself.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-10">
        <div className="rounded-3xl bg-[#FFF7ED] p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#D96C3B]">
            Documentation, not marketing claims
          </p>
          <h2 className="mt-3 text-3xl font-semibold">
            Why Norixo documents its methodology
          </h2>
          <p className="mt-4 max-w-3xl leading-8 text-[#4C5C55]">
            Market signals are useful only when readers can understand their
            scope, freshness, limitations, and publication status. This
            documentation explains the public safeguards behind eligible
            reports without exposing private listings, customer data, or
            proprietary audit logic.
          </p>
        </div>
      </section>

      {publicReportCards.length > 0 ? (
        <section className="mx-auto max-w-6xl px-6 pb-10">
          <div className="rounded-3xl border border-[#10231F]/10 bg-white p-8 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#D96C3B]">
              Published research reports
            </p>
            <h2 className="mt-3 text-3xl font-semibold">
              Cite the report that contains the market evidence
            </h2>
            <p className="mt-4 max-w-3xl leading-8 text-[#4C5C55]">
              These public reports are generated from the publication catalog
              and link to their canonical report routes. Use the specific
              report page when citing a market claim, then check its period,
              confidence, freshness, scope, and limitations before reusing the
              evidence.
            </p>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {publicReportCards.map((report) => (
                <Link
                  key={report.key}
                  href={report.href}
                  className="rounded-2xl border border-[#10231F]/10 bg-[#FAF7F2] p-5 transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <h3 className="text-xl font-semibold">{report.title}</h3>
                  <p className="mt-3 leading-7 text-[#4C5C55]">
                    {report.description}
                  </p>
                </Link>
              ))}
            </div>
            <p className="mt-6">
              <Link
                href="/reports"
                className="text-sm font-semibold text-[#10231F] underline underline-offset-4"
              >
                Browse the full reports catalog
              </Link>
            </p>
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-6xl px-6 pb-10">
        <div className="rounded-3xl border border-[#10231F]/10 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#D96C3B]">
            Citation path
          </p>
          <h2 className="mt-3 text-3xl font-semibold">
            Cite the specific Norixo source, not the homepage
          </h2>
          <p className="mt-4 max-w-3xl leading-8 text-[#4C5C55]">
            For a market claim, link to the exact report that contains the
            evidence. For definitions, safeguards, or interpretation rules,
            cite the methodology page. Each citation should preserve the page
            title, publication or update date when available, and canonical URL.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="mb-8 max-w-3xl">
          <h2 className="text-3xl font-semibold">Available documentation</h2>
          <p className="mt-4 leading-7 text-[#4C5C55]">
            Each public research resource should make its scope and limitations
            clear enough for a reader to decide whether it is appropriate to
            cite.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {documents.map((document) => (
            <Link
              key={document.href}
              href={document.href}
              className="rounded-3xl border border-[#10231F]/10 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#D96C3B]">
                {document.eyebrow}
              </p>
              <h3 className="mt-3 text-xl font-semibold">{document.title}</h3>
              <p className="mt-3 leading-7 text-[#4C5C55]">
                {document.description}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
