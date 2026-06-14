import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { countries, getCountryBySlug } from "@/data/countries";
import { cities } from "@/data/cities";
import { buildCountryMetadata } from "@/lib/seo/buildCountryMetadata";

type Props = {
  params: Promise<{
    country: string;
  }>;
};

export function generateStaticParams() {
  return countries.map((country) => ({
    country: country.slug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { country: slug } = await params;
  const country = getCountryBySlug(slug);

  if (!country) {
    return {};
  }

  return buildCountryMetadata(country);
}

export default async function CountryPage({ params }: Props) {
  const { country: slug } = await params;
  const country = getCountryBySlug(slug);

  if (!country) {
    notFound();
  }

  const countryCities = cities.filter((city) =>
    country.featuredCities.includes(city.slug)
  );

  const faq = [
    {
      question: `How can I optimize an Airbnb listing in ${country.name}?`,
      answer: `To optimize an Airbnb listing in ${country.name}, improve the title, photos, description, pricing, guest trust signals, and positioning against local competitors.`,
    },
    {
      question: `Does Airbnb pricing change by city in ${country.name}?`,
      answer: `Yes. Airbnb pricing in ${country.name} can change significantly depending on the city, season, local events, property type, amenities, and competition.`,
    },
    {
      question: `Why is listing SEO important in ${country.name}?`,
      answer: `Listing SEO helps guests quickly understand why a property is relevant for their trip, which can improve clicks, trust, and booking conversion.`,
    },
    {
      question: `Can Norixo audit Airbnb listings in ${country.name}?`,
      answer: `Norixo helps hosts analyze listing quality, pricing signals, photos, description, and market positioning to identify conversion blockers.`,
    },
    {
      question: `Which cities in ${country.name} are included?`,
      answer: `Norixo currently covers ${countryCities.map((city) => city.name).slice(0, 12).join(", ")} and other important short-term rental markets in ${country.name}.`,
    },
  ];

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: `Airbnb Optimizer ${country.name}`,
      description: country.marketSummary,
      url: `https://norixo.io/countries/${country.slug}`,
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
          name: "Countries",
          item: "https://norixo.io/countries",
        },
        {
          "@type": "ListItem",
          position: 3,
          name: country.name,
          item: `https://norixo.io/countries/${country.slug}`,
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Norixo Optimize",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description:
        "Norixo Optimize helps Airbnb hosts audit listings, improve pricing, strengthen SEO, and identify conversion blockers.",
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Norixo",
      url: "https://norixo.io",
    },
  ];

  return (
    <main className="min-h-screen bg-[#FAF7F2] text-[#10231F]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="mx-auto max-w-6xl px-6 py-20">
        <nav className="mb-8 text-sm text-[#5F6F68]">
          <Link href="/" className="hover:text-[#10231F]">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span>Countries</span>
          <span className="mx-2">/</span>
          <span>{country.name}</span>
        </nav>

        <div className="max-w-4xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[#D96C3B]">
            Airbnb country optimization
          </p>

          <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
            Airbnb Optimizer {country.name}
          </h1>

          <p className="mt-6 max-w-3xl text-lg leading-8 text-[#4C5C55]">
            Analyze Airbnb listing performance in {country.name}. Improve your
            pricing, photos, title, description, SEO signals, and conversion
            positioning across the most important short-term rental markets.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/analyze"
              className="rounded-full bg-[#10231F] px-6 py-3 text-sm font-semibold text-white"
            >
              Audit my Airbnb listing
            </Link>
            <Link
              href="/airbnb-optimizer"
              className="rounded-full border border-[#10231F]/20 px-6 py-3 text-sm font-semibold"
            >
              Explore city optimizers
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-12 md:grid-cols-3">
        <article className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Market overview</h2>
          <p className="mt-4 leading-7 text-[#4C5C55]">{country.marketSummary}</p>
        </article>

        <article className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Pricing strategy</h2>
          <p className="mt-4 leading-7 text-[#4C5C55]">{country.pricingSummary}</p>
        </article>

        <article className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Competition</h2>
          <p className="mt-4 leading-7 text-[#4C5C55]">
            {country.competitionSummary}
          </p>
        </article>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-8 max-w-3xl">
          <h2 className="text-3xl font-semibold">
            Airbnb optimization by city in {country.name}
          </h2>
          <p className="mt-4 leading-7 text-[#4C5C55]">
            Explore local Airbnb optimizer pages for major short-term rental
            markets in {country.name}. Each page focuses on pricing, guest
            expectations, competition, and listing conversion signals.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {countryCities.map((city) => (
            <Link
              key={city.slug}
              href={`/airbnb-optimizer/${city.slug}`}
              className="rounded-2xl border border-[#10231F]/10 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <p className="font-semibold">{city.name}</p>
              <p className="mt-2 text-sm text-[#5F6F68]">
                Average reference price: €{city.avgPrice}/night
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="text-3xl font-semibold">
          Airbnb optimization FAQ for {country.name}
        </h2>

        <div className="mt-6 space-y-4">
          {faq.map((item) => (
            <details key={item.question} className="rounded-2xl bg-white p-5">
              <summary className="cursor-pointer font-semibold">
                {item.question}
              </summary>
              <p className="mt-3 leading-7 text-[#4C5C55]">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
