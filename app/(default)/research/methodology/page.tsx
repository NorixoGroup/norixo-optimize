import Link from "next/link";
import type { Metadata } from "next";

import { defaultLocale } from "@/data/i18n";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";

const socialImage = "/og/norixo-research-methodology.png";

export const metadata: Metadata = {
  title: "Public Market Data Methodology | Norixo",
  description:
    "How to interpret Norixo public market data, including aggregation, percentiles, confidence, freshness, limitations, and publication checks.",
  alternates: buildHreflangAlternates("/research/methodology", {
    locales: [defaultLocale],
  }),
  openGraph: {
    title: "Public Market Data Methodology | Norixo",
    description:
      "How to interpret Norixo public market data, including aggregation, percentiles, confidence, freshness, limitations, and publication checks.",
    url: "/research/methodology",
    siteName: "Norixo",
    type: "article",
    locale: "en_US",
    images: [
      {
        url: socialImage,
        width: 1200,
        height: 630,
        alt: "Norixo Research Methodology",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Public Market Data Methodology | Norixo",
    description:
      "How to interpret Norixo public market data, including aggregation, percentiles, confidence, freshness, limitations, and publication checks.",
    images: [socialImage],
  },
};

const readingLayers = [
  {
    title: "Observed fact",
    description:
      "An aggregated market input retained under the public data safeguards. It is not an individual listing, customer record, or private audit.",
  },
  {
    title: "Calculated metric",
    description:
      "A value derived from eligible aggregated inputs, such as a percentile, median, sample band, or freshness status.",
  },
  {
    title: "Interpretation",
    description:
      "Context that helps explain what a signal may mean for a market. It is not a guarantee of price, revenue, ranking, or occupancy.",
  },
  {
    title: "Recommendation",
    description:
      "A practical next step based on the available context. Recommendations should be read alongside the report’s scope and limitations.",
  },
] as const;

const terms = [
  {
    term: "Aggregated data",
    definition:
      "A market-level view created from eligible inputs. Public outputs are designed to describe a market without exposing a private listing or raw observation.",
  },
  {
    term: "Public-safe artifact",
    definition:
      "A versioned public data object that contains only the fields approved for public use, together with its scope and safeguards.",
  },
  {
    term: "Median and percentiles",
    definition:
      "The median describes the middle of an observed distribution. Percentiles show how the distribution is spread, so a reader can see more than a single central value.",
  },
  {
    term: "Confidence",
    definition:
      "A reading of the available evidence under the relevant policy. It can reflect factors such as eligible sample coverage and source diversity; it is not a performance forecast.",
  },
  {
    term: "Freshness",
    definition:
      "A status showing whether an artifact is current, aging, or expired under its policy window. Market conditions can change after a capture period ends.",
  },
  {
    term: "Limitations",
    definition:
      "Important qualifications, such as a limited sample, limited source diversity, broader scope, or unavailable metric. Limits are part of the result, not footnotes to ignore.",
  },
] as const;

export default function ResearchMethodologyPage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: "Public Market Data Methodology",
      description: metadata.description,
      author: {
        "@type": "Organization",
        name: "Norixo",
      },
      publisher: {
        "@type": "Organization",
        name: "Norixo",
        url: "https://norixo.io",
      },
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": "https://norixo.io/research/methodology",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: "https://norixo.io",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Research",
          item: "https://norixo.io/research",
        },
        {
          "@type": "ListItem",
          position: 3,
          name: "Methodology",
          item: "https://norixo.io/research/methodology",
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

      <section className="mx-auto max-w-5xl px-6 py-20">
        <nav className="text-sm text-[#5F6F68]">
          <Link href="/" className="hover:text-[#10231F]">
            Home
          </Link>
          <span className="mx-2">/</span>
          <Link href="/research" className="hover:text-[#10231F]">
            Research
          </Link>
          <span className="mx-2">/</span>
          <span>Methodology</span>
        </nav>

        <p className="mt-10 text-sm font-semibold uppercase tracking-[0.2em] text-[#D96C3B]">
          Norixo Research
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-6xl">
          How to read public market data
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-[#4C5C55]">
          Norixo public reports are designed to describe eligible market
          signals with their scope, freshness, confidence, and limitations.
          They are decision aids, not guarantees of revenue, ranking,
          occupancy, or performance.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-10">
        <div className="rounded-3xl bg-[#FFF7ED] p-8 shadow-sm">
          <h2 className="text-3xl font-semibold">Public by design</h2>
          <p className="mt-4 max-w-3xl leading-8 text-[#4C5C55]">
            Public market information is built from aggregated, eligible inputs.
            Norixo does not publish private listing content, customer data,
            workspace information, audit details, or raw observations in these
            public outputs.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-10">
        <div className="mb-8 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#D96C3B]">
            Four reading layers
          </p>
          <h2 className="mt-3 text-3xl font-semibold">
            Keep evidence and interpretation separate
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {readingLayers.map((layer) => (
            <article
              key={layer.title}
              className="rounded-2xl border border-[#10231F]/10 bg-white p-6"
            >
              <h3 className="text-xl font-semibold">{layer.title}</h3>
              <p className="mt-3 leading-7 text-[#4C5C55]">
                {layer.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-10">
        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#D96C3B]">
            Key terms
          </p>
          <h2 className="mt-3 text-3xl font-semibold">
            What the labels in a report mean
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {terms.map((item) => (
              <article
                key={item.term}
                className="rounded-2xl border border-[#10231F]/10 bg-[#FAF7F2] p-5"
              >
                <h3 className="text-xl font-semibold">{item.term}</h3>
                <p className="mt-3 leading-7 text-[#4C5C55]">
                  {item.definition}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#D96C3B]">
            Publication safeguards
          </p>
          <h2 className="mt-3 text-3xl font-semibold">
            Why some reports are not indexed
          </h2>
          <p className="mt-4 max-w-3xl leading-8 text-[#4C5C55]">
            A public report may remain unavailable to search engines when its
            required evidence is incomplete, expired, or otherwise fails the
            publication checks. This protects readers from treating a partial
            market view as a complete reference.
          </p>
          <p className="mt-4 max-w-3xl leading-8 text-[#4C5C55]">
            When a report is eligible for publication, its own page should show
            the relevant market scope, period, confidence, freshness, and
            limitations so readers can interpret it in context.
          </p>
          <p className="mt-6">
            <Link
              href="/research"
              className="text-sm font-semibold text-[#D96C3B] underline-offset-4 hover:underline"
            >
              Explore the Research Hub
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
