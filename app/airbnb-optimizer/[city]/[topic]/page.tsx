import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { cities } from "@/data/cities";
import { localSeoTopics, getLocalSeoTopicBySlug } from "@/data/localSeo";
import { buildLocalSeoMetadata } from "@/lib/seo/buildLocalSeoMetadata";

type Props = {
  params: Promise<{
    city: string;
    topic: string;
  }>;
};

export function generateStaticParams() {
  return cities.flatMap((city) =>
    localSeoTopics.map((topic) => ({
      city: city.slug,
      topic: topic.slug,
    }))
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city: citySlug, topic: topicSlug } = await params;
  const city = cities.find((item) => item.slug === citySlug);
  const topic = getLocalSeoTopicBySlug(topicSlug);

  if (!city || !topic) {
    return {};
  }

  return buildLocalSeoMetadata(city, topic);
}

export default async function LocalSeoPage({ params }: Props) {
  const { city: citySlug, topic: topicSlug } = await params;
  const city = cities.find((item) => item.slug === citySlug);
  const topic = getLocalSeoTopicBySlug(topicSlug);

  if (!city || !topic) {
    notFound();
  }

  const relatedTopics = localSeoTopics.filter((item) => item.slug !== topic.slug);

  const pageUrl = `https://norixo.io/airbnb-optimizer/${city.slug}/${topic.slug}`;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "@id": pageUrl,
      url: pageUrl,
      name: `${city.name} ${topic.titleSuffix}`,
      description: topic.description,
      inLanguage: "en",
      isPartOf: {
        "@type": "WebSite",
        name: "Norixo",
        url: "https://norixo.io",
      },
      about: [
        "Airbnb optimization",
        city.name,
        topic.label,
      ],
      mainEntity: {
        "@type": "Article",
        "@id": `${pageUrl}#article`,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "Article",
      "@id": `${pageUrl}#article`,
      headline: `${city.name} ${topic.titleSuffix}`,
      description: topic.description,
      author: {
        "@type": "Organization",
        name: "Norixo",
      },
      publisher: {
        "@type": "Organization",
        name: "Norixo",
      },
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": `https://norixo.io/airbnb-optimizer/${city.slug}/${topic.slug}`,
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
          name: "Airbnb Optimizer",
          item: "https://norixo.io/airbnb-optimizer",
        },
        {
          "@type": "ListItem",
          position: 3,
          name: city.name,
          item: `https://norixo.io/airbnb-optimizer/${city.slug}`,
        },
        {
          "@type": "ListItem",
          position: 4,
          name: topic.label,
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

      <section className="mx-auto max-w-5xl px-6 py-20">
        <nav className="mb-8 text-sm text-[#5F6F68]">
          <Link href="/" className="hover:text-[#10231F]">
            Home
          </Link>
          <span className="mx-2">/</span>
          <Link href={`/airbnb-optimizer/${city.slug}`} className="hover:text-[#10231F]">
            {city.name}
          </Link>
          <span className="mx-2">/</span>
          <span>{topic.label}</span>
        </nav>

        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[#D96C3B]">
          Local Airbnb optimization
        </p>

        <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
          {city.name} {topic.titleSuffix}
        </h1>

        <p className="mt-6 max-w-3xl text-lg leading-8 text-[#4C5C55]">
          {topic.description} This local guide helps hosts understand how to
          improve Airbnb performance in {city.name}, {city.country}.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/analyze"
            className="rounded-full bg-[#10231F] px-6 py-3 text-sm font-semibold text-white"
          >
            Audit my Airbnb listing
          </Link>
          <Link
            href={`/guides/${topic.guideSlug}`}
            className="rounded-full border border-[#10231F]/20 px-6 py-3 text-sm font-semibold"
          >
            Read full guide
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-12 md:grid-cols-3">
        <article className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Market context</h2>
          <p className="mt-4 leading-7 text-[#4C5C55]">
            {city.marketAngle}
          </p>
        </article>

        <article className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Competition</h2>
          <p className="mt-4 leading-7 text-[#4C5C55]">
            {city.competitionAngle}
          </p>
        </article>

        <article className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Guest expectations</h2>
          <p className="mt-4 leading-7 text-[#4C5C55]">
            {city.guestExpectationAngle}
          </p>
        </article>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <h2 className="text-3xl font-semibold">
            How to improve Airbnb performance in {city.name}
          </h2>
          <p className="mt-4 leading-8 text-[#4C5C55]">
            In {city.name}, hosts should align pricing, photos, listing copy,
            amenities, and guest trust signals with local competition. The
            average reference price in this market is around €{city.avgPrice} per
            night, while guest expectations are shaped by location, property
            type, reviews, and perceived value.
          </p>
          <p className="mt-4 leading-8 text-[#4C5C55]">
            A strong listing should explain why the property is relevant for the
            guest's trip, show the full stay clearly, justify the price, and
            reduce uncertainty before booking.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <h2 className="text-2xl font-semibold">
          More local Airbnb guides for {city.name}
        </h2>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {relatedTopics.map((item) => (
            <Link
              key={item.slug}
              href={`/airbnb-optimizer/${city.slug}/${item.slug}`}
              className="rounded-2xl border border-[#10231F]/10 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <p className="font-semibold">
                {city.name} {item.titleSuffix}
              </p>
              <p className="mt-2 text-sm leading-6 text-[#5F6F68]">
                {item.description}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
