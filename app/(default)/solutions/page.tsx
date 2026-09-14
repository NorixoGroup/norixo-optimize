import Link from "next/link";
import type { Metadata } from "next";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";
import { defaultLocale } from "@/data/i18n";
import { solutions } from "@/data/solutions";

export const metadata: Metadata = {
  title: "Airbnb Optimization Solutions | Norixo",
  description:
    "Explore Norixo solutions for Airbnb SEO, pricing, listing quality, conversion, revenue, and overall booking performance.",
  alternates: buildHreflangAlternates("/solutions", { locales: [defaultLocale] }),
  openGraph: {
    title: "Airbnb Optimization Solutions | Norixo",
    description:
      "Explore Norixo solutions for Airbnb SEO, pricing, listing quality, conversion, revenue, and overall booking performance.",
    url: "/solutions",
    type: "website",
  },
};

export default function SolutionsPage() {
  return (
    <main className="min-h-screen bg-[#FAF7F2]">
      <section className="mx-auto max-w-6xl px-6 py-20">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[#D96C3B]">
          Norixo Solutions
        </p>

        <h1 className="text-5xl font-semibold tracking-tight">
          Airbnb Optimization Solutions
        </h1>

        <p className="mt-6 max-w-3xl text-lg text-[#4C5C55]">
          Discover Norixo solutions designed to improve Airbnb SEO,
          pricing, listing quality, conversion, revenue and overall
          booking performance.
        </p>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {solutions.map((solution) => (
            <Link
              key={solution.slug}
              href={`/solutions/${solution.slug}`}
              className="rounded-3xl border border-[#10231F]/10 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <h2 className="text-2xl font-semibold">
                {solution.title}
              </h2>

              <p className="mt-4 leading-7 text-[#5F6F68]">
                {solution.description}
              </p>

              <span className="mt-6 inline-block font-semibold text-[#D96C3B]">
                Learn more →
              </span>
            </Link>
          ))}
        </div>

        <section className="mt-20 max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#D96C3B]">
            A connected approach
          </p>

          <h2 className="mt-3 text-3xl font-semibold tracking-tight">
            How Norixo approaches listing optimization
          </h2>

          <div className="mt-6 space-y-5 leading-8 text-[#4C5C55]">
            <p>
              Airbnb performance rarely depends on one element alone. Pricing,
              photos, titles, descriptions, amenities, guest trust and market
              positioning work together. Norixo organizes these signals into
              focused analyses so hosts can identify where a listing may be
              losing visibility, confidence or booking conversion.
            </p>

            <p>
              A listing audit provides the broader review. The SEO and listing
              optimization solutions focus on how the property is presented and
              positioned, while pricing analysis compares price with market
              context and perceived value. Conversion and revenue optimization
              connect those findings with the factors that influence booking
              decisions and overall performance.
            </p>

            <p>
              The objective is to prioritize useful changes rather than apply
              the same recommendation to every property. Depending on the
              listing, that may mean improving presentation, clarifying the
              value proposition, reviewing pricing against relevant
              competition, strengthening trust signals or combining several of
              these improvements.
            </p>
          </div>
        </section>

        <section className="mt-16 max-w-4xl">
          <h2 className="text-3xl font-semibold tracking-tight">
            Choose the analysis that matches your goal
          </h2>

          <div className="mt-6 space-y-5 leading-8 text-[#4C5C55]">
            <p>
              Start with the area you want to understand, or use the Airbnb
              Listing Audit for a broader view of the factors that may be
              limiting performance.
            </p>

            <p>
              Visibility questions are covered by Airbnb SEO and listing
              optimization. Pricing optimization focuses on price, competition
              and market context, while conversion and revenue optimization
              examine how positioning, trust and pricing can influence booking
              performance.
            </p>
          </div>

          <Link
            href="/solutions/airbnb-listing-audit"
            className="mt-6 inline-flex font-semibold text-[#D96C3B] underline-offset-4 hover:underline"
          >
            Explore the Airbnb Listing Audit →
          </Link>
        </section>
      </section>
    </main>
  );
}
