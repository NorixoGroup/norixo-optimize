import type { Metadata } from "next";
import Link from "next/link";

import { buildHreflangAlternates } from "@/lib/seo/hreflang";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://norixo.io").replace(
  /\/$/,
  "",
);
const pageTitle = "About Norixo | Airbnb & Booking Listing Optimization";
const pageDescription =
  "Learn about Norixo, a platform for analyzing Airbnb and Booking listings and prioritizing practical improvements.";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: buildHreflangAlternates("/about"),
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    url: "/about",
    siteName: "Norixo",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/og-cover.png",
        width: 1200,
        height: 630,
        alt: pageTitle,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description: pageDescription,
    images: ["/og-cover.png"],
  },
};

const aboutJsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "@id": `${siteUrl}/about#webpage`,
    url: `${siteUrl}/about`,
    name: "About Norixo",
    isPartOf: { "@id": `${siteUrl}/#website` },
    about: { "@id": `${siteUrl}/#organization` },
    mainEntity: { "@id": `${siteUrl}/#organization` },
  },
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
        name: "About",
        item: `${siteUrl}/about`,
      },
    ],
  },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#FAF7F2] text-[#10231F]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(aboutJsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <section className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <nav aria-label="Breadcrumb" className="mb-8 text-sm text-[#5B6B66]">
          <Link className="transition hover:text-[#10231F]" href="/">
            Home
          </Link>
          <span aria-hidden="true" className="mx-2">
            /
          </span>
          <span aria-current="page">About</span>
        </nav>

        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#587065]">
          About Norixo
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
          About Norixo
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-[#3F514B]">
          Norixo is a platform for analyzing and optimizing short-term-rental
          listings. It audits Airbnb and Booking listings, evaluates listing and
          market signals, and returns prioritized recommendations.
        </p>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-20 sm:pb-24 lg:grid-cols-2">
        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-semibold">What Norixo does</h2>
          <p className="mt-4 leading-7 text-[#3F514B]">
            Norixo helps hosts assess listing quality, photos, pricing context,
            market positioning, guest confidence, and booking conversion. Its
            recommendations are designed to make practical improvement priorities
            clearer.
          </p>
          <Link
            className="mt-6 inline-flex text-sm font-semibold text-[#23483B] underline underline-offset-4"
            href="/how-it-works"
          >
            How Norixo works
          </Link>
        </div>

        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-semibold">What it does not do</h2>
          <p className="mt-4 leading-7 text-[#3F514B]">
            Norixo provides analysis and recommendations, not guaranteed outcomes.
            Recommendations are indicative and should be reviewed before a
            decision. The audit reads a public listing page and does not change
            the listing itself.
          </p>
        </div>

        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-semibold">Public research and private audits</h2>
          <p className="mt-4 leading-7 text-[#3F514B]">
            Private listing audits stay in the customer workspace and are not
            published as public market examples. Norixo&apos;s public research uses
            aggregated market signals, with scope, freshness, confidence, and
            limitations documented separately.
          </p>
          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-[#23483B]">
            <Link className="underline underline-offset-4" href="/research">
              Explore research
            </Link>
            <Link
              className="underline underline-offset-4"
              href="/research/methodology"
            >
              Read the methodology
            </Link>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-semibold">Published by Norixo</h2>
          <p className="mt-4 leading-7 text-[#3F514B]">
            Norixo publishes its listing-audit platform, public research, and
            educational resources for short-term-rental hosts. Private analysis
            supports listing-specific decisions, while public resources explain
            market information and methodology.
          </p>
          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-[#23483B]">
            <Link className="underline underline-offset-4" href="/pricing">
              View pricing
            </Link>
            <Link className="underline underline-offset-4" href="/contact">
              Contact Norixo
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
