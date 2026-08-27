import Link from "next/link";
import type { Metadata } from "next";

import { cities } from "@/data/cities";
import { defaultLocale } from "@/data/i18n";
import { localSeoTopics } from "@/data/localSeo";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";

const pageTitle = "Airbnb Optimizer | Norixo";
const pageDescription =
  "Audit and improve Airbnb listings by market, city, pricing, content, photos, and conversion signals.";
const siteUrl = "https://norixo.io";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: buildHreflangAlternates("/airbnb-optimizer", {
    locales: [defaultLocale],
  }),
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    url: "/airbnb-optimizer",
    siteName: "Norixo",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description: pageDescription,
  },
};

export default function AirbnbOptimizerHubPage() {
  const featuredCities = cities;
  const featuredTopicLinks = cities.slice(0, 6).map((city, index) => ({
    city,
    topic: localSeoTopics[index],
  }));

  const pageUrl = `${siteUrl}/airbnb-optimizer`;
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "@id": `${pageUrl}#webpage`,
      name: pageTitle,
      description: pageDescription,
      url: pageUrl,
      inLanguage: "en",
      isPartOf: {
        "@id": `${siteUrl}/#website`,
      },
      publisher: {
        "@id": `${siteUrl}/#organization`,
      },
      about: {
        "@id": `${siteUrl}/#software`,
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
          item: siteUrl,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Airbnb Optimizer",
          item: pageUrl,
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
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[#D96C3B]">
          Airbnb market optimization
        </p>

        <h1 className="max-w-4xl text-4xl font-semibold tracking-tight md:text-6xl">
          Airbnb Optimizer
        </h1>

        <p className="mt-6 max-w-3xl text-lg leading-8 text-[#4C5C55]">
          Audit and improve Airbnb listings by market, city, pricing, content,
          photos, and conversion signals. Explore city-specific optimization
          pages to understand local competition, guest expectations, and the
          changes that can improve booking performance.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/airbnb-optimizer/paris"
            className="rounded-full bg-[#10231F] px-6 py-3 text-sm font-semibold text-white"
          >
            Explore Paris optimizer
          </Link>
          <Link
            href="/free-audit"
            className="rounded-full border border-[#10231F]/20 px-6 py-3 text-sm font-semibold"
          >
            Audit my Airbnb listing
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="mb-8 max-w-3xl">
          <h2 className="text-3xl font-semibold">
            Explore Airbnb optimization by city
          </h2>
          <p className="mt-4 leading-7 text-[#4C5C55]">
            Browse city pages built around local pricing pressure, competition,
            guest expectations, and listing quality signals. Each city hub
            points to more detailed optimization topics for that market.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {featuredCities.map((city) => (
            <Link
              key={city.slug}
              href={`/airbnb-optimizer/${city.slug}`}
              className="rounded-3xl border border-[#10231F]/10 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#D96C3B]">
                {city.country}
              </p>
              <h2 className="mt-3 text-2xl font-semibold">{city.name}</h2>
              <p className="mt-3 leading-7 text-[#4C5C55]">{city.marketAngle}</p>
              <div className="mt-4 flex flex-wrap gap-3 text-sm text-[#5F6F68]">
                <span>EUR {city.avgPrice}/night</span>
                <span>{city.avgRating.toFixed(1)}/5</span>
                <span>{city.avgPhotos} photos</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-8 max-w-3xl">
          <h2 className="text-3xl font-semibold">
            What the Airbnb Optimizer covers
          </h2>
          <p className="mt-4 leading-7 text-[#4C5C55]">
            Norixo helps hosts and property managers review the listing signals
            that influence clicks, trust, and booking decisions across
            different Airbnb markets.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {[
            "Pricing and positioning",
            "Listing quality",
            "Photo performance",
            "Conversion signals",
            "Guest expectations",
            "Local competition",
            "Revenue opportunities",
          ].map((item) => (
            <article
              key={item}
              className="rounded-3xl border border-[#10231F]/10 bg-white p-6 shadow-sm"
            >
              <h3 className="text-xl font-semibold">{item}</h3>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <h2 className="text-3xl font-semibold">Use local market signals</h2>
          <p className="mt-4 leading-8 text-[#4C5C55]">
            Each city comes with its own competition pattern, guest demand,
            pricing pressure, positioning logic, and content quality
            expectations. The Airbnb Optimizer organizes these signals by city
            so hosts can compare their listing against the local market instead
            of relying on generic advice.
          </p>
          <p className="mt-4 leading-8 text-[#4C5C55]">
            This makes it easier to understand how pricing, photos,
            reassurance, description quality, and perceived value influence
            performance in each market.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20 pt-12">
        <div className="mb-8 max-w-3xl">
          <h2 className="text-3xl font-semibold">
            Popular optimization topics
          </h2>
          <p className="mt-4 leading-7 text-[#4C5C55]">
            Explore a few high-interest topic pages to see how Norixo connects
            city-level market context with pricing, SEO, photos, trust, and
            conversion improvements.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {featuredTopicLinks.map(({ city, topic }) => (
            <Link
              key={`${city.slug}-${topic.slug}`}
              href={`/airbnb-optimizer/${city.slug}/${topic.slug}`}
              className="rounded-3xl border border-[#10231F]/10 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#D96C3B]">
                {city.name}
              </p>
              <h3 className="mt-3 text-xl font-semibold">
                {city.name} {topic.titleSuffix}
              </h3>
              <p className="mt-3 leading-7 text-[#4C5C55]">
                {topic.description}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
