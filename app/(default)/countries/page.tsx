import Link from "next/link";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";
import { defaultLocale } from "@/data/i18n";
import { countries } from "@/data/countries";

export const metadata = {
  title: "Airbnb Optimizer by Country | Norixo",
  description:
    "Explore Airbnb optimization markets by country. Find country-level Airbnb SEO, pricing, listing audit, and city optimization resources.",
  alternates: buildHreflangAlternates("/countries", { locales: [defaultLocale] }),
  openGraph: {
    title: "Airbnb Optimizer by Country | Norixo",
    description:
      "Explore Airbnb optimization markets by country. Find country-level Airbnb SEO, pricing, listing audit, and city optimization resources.",
    url: "/countries",
    siteName: "Norixo",
    type: "website",
    images: ["/og-cover.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Airbnb Optimizer by Country | Norixo",
    description:
      "Explore Airbnb optimization markets by country. Find country-level Airbnb SEO, pricing, listing audit, and city optimization resources.",
    images: ["/og-cover.png"],
  },
};

export default function CountriesHubPage() {
  return (
    <main className="min-h-screen bg-[#FAF7F2] text-[#10231F]">
      <section className="mx-auto max-w-6xl px-6 py-20">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[#D96C3B]">
          Airbnb market hubs
        </p>

        <h1 className="max-w-4xl text-4xl font-semibold tracking-tight md:text-6xl">
          Airbnb Optimizer by Country
        </h1>

        <p className="mt-6 max-w-3xl text-lg leading-8 text-[#4C5C55]">
          Explore country-level Airbnb optimization guides with city links,
          pricing context, competition insights, and listing improvement
          opportunities for major short-term rental markets.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/analyze"
            className="rounded-full bg-[#10231F] px-6 py-3 text-sm font-semibold text-white"
          >
            Audit my Airbnb listing
          </Link>
          <Link
            href="/guides"
            className="rounded-full border border-[#10231F]/20 px-6 py-3 text-sm font-semibold"
          >
            Read Airbnb guides
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {countries.map((country) => (
            <Link
              key={country.slug}
              href={`/countries/${country.slug}`}
              className="rounded-3xl border border-[#10231F]/10 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#D96C3B]">
                {country.continent}
              </p>
              <h2 className="mt-3 text-xl font-semibold">{country.name}</h2>
              <p className="mt-3 line-clamp-3 leading-7 text-[#4C5C55]">
                {country.marketSummary}
              </p>
              <p className="mt-4 text-sm font-semibold">
                {country.featuredCities.length} city optimizers →
              </p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
