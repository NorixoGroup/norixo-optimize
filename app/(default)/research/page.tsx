import Link from "next/link";
import type { Metadata } from "next";

import { defaultLocale } from "@/data/i18n";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";

export const metadata: Metadata = {
  title: "Research & Methodology | Norixo",
  description:
    "Learn how Norixo explains public market data, methodology, confidence, limitations, and privacy safeguards.",
  alternates: buildHreflangAlternates("/research", {
    locales: [defaultLocale],
  }),
};

const documents = [
  {
    href: "/research/methodology",
    eyebrow: "Available now",
    title: "Methodology",
    description:
      "Understand how to read aggregated public market data, confidence signals, freshness, limitations, and publication status.",
  },
] as const;

export default function ResearchHubPage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Norixo Research & Methodology",
      description: metadata.description,
      url: "https://norixo.io/research",
      publisher: {
        "@type": "Organization",
        name: "Norixo",
        url: "https://norixo.io",
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
          prepared, interpreted, and published. Our goal is to make the limits
          of a signal as clear as its value.
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
                Educational resources for improving a listing, from pricing and
                photos to visibility and conversion.
              </p>
            </article>
            <article className="rounded-2xl border border-[#10231F]/10 bg-[#FAF7F2] p-5">
              <h3 className="text-xl font-semibold">Tools</h3>
              <p className="mt-3 leading-7 text-[#4C5C55]">
                Simple calculators that help turn a metric into a practical
                decision.
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
                Market documents can publish aggregated signals when their
                evidence, limitations, and publication checks are satisfied.
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
            scope, freshness, and limitations. This documentation explains the
            public safeguards behind eligible reports without exposing private
            listings, customer data, or proprietary audit logic.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="mb-8 max-w-3xl">
          <h2 className="text-3xl font-semibold">Available documentation</h2>
          <p className="mt-4 leading-7 text-[#4C5C55]">
            The hub is designed to grow as additional public documentation is
            ready. Each document explains one part of the public research
            framework.
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
