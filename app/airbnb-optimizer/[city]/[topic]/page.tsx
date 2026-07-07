import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { cities } from "@/data/cities";
import type { City } from "@/data/cities";
import { localSeoTopics, getLocalSeoTopicBySlug } from "@/data/localSeo";
import type { LocalSeoTopic } from "@/data/localSeo";
import { guides } from "@/data/guides";
import { articles } from "@/data/articles";
import { tools } from "@/data/tools";
import { solutions } from "@/data/solutions";
import { rankings } from "@/data/rankings";
import { marketReports } from "@/data/marketReports";
import { buildLocalSeoMetadata } from "@/lib/seo/buildLocalSeoMetadata";

type Props = {
  params: Promise<{
    city: string;
    topic: string;
  }>;
};

function buildExecutiveSummary(city: City, topic: LocalSeoTopic) {
  return [
    `${topic.description} In ${city.name}, ${city.marketAngle.toLowerCase()}`,
    `Hosts in ${city.name}, ${city.country} compete in a market where ${city.competitionAngle.toLowerCase()} ${city.guestExpectationAngle}`,
  ];
}

function buildTopicSpecificAnalysis(city: City, topic: LocalSeoTopic) {
  const slug = topic.slug;

  if (
    [
      "pricing-guide",
      "revenue-optimization",
      "occupancy-guide",
      "seasonality-guide",
      "pricing-positioning",
    ].includes(slug)
  ) {
    return {
      heading: `Pricing and revenue strategy in ${city.name}`,
      paragraphs: [
        `${city.pricingAngle} With an average reference price around €${city.avgPrice} per night, ${city.name} rewards listings that make their value obvious before guests even open the calendar.`,
        `${city.competitionAngle} For ${topic.label.toLowerCase()}, the real goal is to match rate, perceived quality, and demand so that pricing supports both occupancy and revenue instead of weakening both.`,
      ],
    };
  }

  if (["photo-tips", "photo-order", "first-photo"].includes(slug)) {
    return {
      heading: `Photo strategy for ${city.name} listings`,
      paragraphs: [
        `Listings in ${city.name} average about ${city.avgPhotos} photos, which means guests expect a complete visual story before they trust the stay. ${city.guestExpectationAngle}`,
        `${city.competitionAngle} For ${topic.label.toLowerCase()}, the cover image, the order of the first rooms, and the clarity of what guests will experience matter more than simply uploading more photos.`,
      ],
    };
  }

  if (
    [
      "seo-guide",
      "search-visibility",
      "title-optimization",
      "description-optimization",
      "ranking-factors",
    ].includes(slug)
  ) {
    return {
      heading: `Visibility and listing clarity in ${city.name}`,
      paragraphs: [
        `${city.marketAngle} In practice, ${topic.label.toLowerCase()} in ${city.name} is about making the listing easier to understand, easier to trust, and easier to compare in a crowded search result.`,
        `${city.guestExpectationAngle} Clearer titles, sharper positioning, and stronger copy work best when they reflect the local market instead of repeating generic Airbnb language.`,
      ],
    };
  }

  if (
    [
      "guest-trust-guide",
      "review-strategy",
      "conversion-guide",
      "booking-conversion",
    ].includes(slug)
  ) {
    return {
      heading: `Trust and conversion signals in ${city.name}`,
      paragraphs: [
        `The average rating bar in ${city.name} sits near ${city.avgRating.toFixed(1)}/5, so guests compare not only price but also reassurance, consistency, and detail before they book.`,
        `${city.guestExpectationAngle} For ${topic.label.toLowerCase()}, the strongest gains usually come from removing uncertainty, showing the stay clearly, and reinforcing why this listing feels safer or easier to choose than nearby alternatives.`,
      ],
    };
  }

  if (
    [
      "family-travel-guide",
      "business-travel-guide",
      "long-stay-guide",
      "local-demand-guide",
    ].includes(slug)
  ) {
    return {
      heading: `Guest-fit strategy in ${city.name}`,
      paragraphs: [
        `${city.marketAngle} In ${city.name}, different guest types compare stays through very practical signals: layout, comfort, clarity, and how well the listing matches the trip they are actually planning.`,
        `${city.guestExpectationAngle} For ${topic.label.toLowerCase()}, the page should help hosts align pricing, amenities, and listing framing with the needs of the guest profile most likely to convert.`,
      ],
    };
  }

  return {
    heading: `How ${topic.label.toLowerCase()} applies in ${city.name}`,
    paragraphs: [
      `${city.competitionAngle} In ${city.name}, strong Airbnb performance depends on how clearly the listing communicates value, quality, and fit for the trip.`,
      `${topic.description} ${city.guestExpectationAngle} The strongest pages for this market connect local demand, competitive positioning, and booking confidence instead of relying on generic listing advice.`,
    ],
  };
}

function getTopicResourceFamily(topic: LocalSeoTopic) {
  const slug = topic.slug;

  if (
    [
      "pricing-guide",
      "revenue-optimization",
      "occupancy-guide",
      "seasonality-guide",
      "pricing-positioning",
    ].includes(slug)
  ) {
    return "pricing";
  }

  if (["photo-tips", "photo-order", "first-photo"].includes(slug)) {
    return "photo";
  }

  if (
    [
      "seo-guide",
      "search-visibility",
      "title-optimization",
      "description-optimization",
      "ranking-factors",
    ].includes(slug)
  ) {
    return "seo";
  }

  if (
    [
      "guest-trust-guide",
      "review-strategy",
      "conversion-guide",
      "booking-conversion",
    ].includes(slug)
  ) {
    return "conversion";
  }

  if (
    [
      "family-travel-guide",
      "business-travel-guide",
      "long-stay-guide",
      "local-demand-guide",
    ].includes(slug)
  ) {
    return "guest-fit";
  }

  return "general";
}

function buildRecommendedResources(city: City, topic: LocalSeoTopic) {
  const family = getTopicResourceFamily(topic);
  const resources: {
    href: string;
    eyebrow: string;
    title: string;
    description: string;
  }[] = [];

  const pushUnique = (resource: {
    href: string;
    eyebrow: string;
    title: string;
    description: string;
  } | null) => {
    if (!resource || resources.some((item) => item.href === resource.href)) {
      return;
    }

    resources.push(resource);
  };

  const guide = guides.find((item) => item.slug === topic.guideSlug);

  pushUnique(
    guide
      ? {
          href: `/guides/${guide.slug}`,
          eyebrow: "Guide",
          title: guide.title,
          description: guide.description,
        }
      : null,
  );

  const preferredArticleSlugsByFamily: Record<string, string[]> = {
    pricing: ["airbnb-pricing-strategy", "airbnb-dynamic-pricing"],
    photo: ["airbnb-photo-tips", "airbnb-photo-order"],
    seo: ["how-airbnb-seo-works", "airbnb-search-ranking-factors"],
    conversion: ["airbnb-conversion-rate", "airbnb-trust-signals"],
    "guest-fit": ["airbnb-amenities", "airbnb-guest-objections"],
    general: ["airbnb-listing-visibility", "airbnb-listing-copywriting"],
  };

  const preferredArticleSlugs = preferredArticleSlugsByFamily[family] ?? [];
  const preferredArticles = preferredArticleSlugs
    .map((slug) => articles.find((item) => item.slug === slug))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, 2);

  const fallbackArticles = articles
    .filter((item) => item.relatedGuides.includes(topic.guideSlug))
    .filter((item) => !preferredArticles.some((preferred) => preferred.slug === item.slug))
    .slice(0, Math.max(0, 2 - preferredArticles.length));

  [...preferredArticles, ...fallbackArticles].forEach((article) =>
    pushUnique({
      href: `/articles/${article.slug}`,
      eyebrow: "Article",
      title: article.title,
      description: article.description,
    }),
  );

  const toolSlugByTopic: Partial<Record<LocalSeoTopic["slug"], string>> = {
    "pricing-guide": "airbnb-pricing-calculator",
    "pricing-positioning": "airbnb-pricing-calculator",
    "seasonality-guide": "airbnb-pricing-calculator",
    "occupancy-guide": "airbnb-occupancy-calculator",
    "revenue-optimization": "airbnb-revenue-calculator",
  };

  const tool = toolSlugByTopic[topic.slug]
    ? tools.find((item) => item.slug === toolSlugByTopic[topic.slug])
    : null;

  pushUnique(
    tool
      ? {
          href: `/tools/${tool.slug}`,
          eyebrow: "Tool",
          title: tool.title,
          description: tool.description,
        }
      : null,
  );

  const solutionSlugByTopic: Partial<Record<LocalSeoTopic["slug"], string>> = {
    "pricing-guide": "airbnb-pricing-optimization",
    "pricing-positioning": "airbnb-pricing-optimization",
    "seasonality-guide": "airbnb-pricing-optimization",
    "occupancy-guide": "airbnb-revenue-optimization",
    "revenue-optimization": "airbnb-revenue-optimization",
    "photo-tips": "airbnb-listing-optimization",
    "photo-order": "airbnb-listing-optimization",
    "first-photo": "airbnb-listing-optimization",
    "seo-guide": "airbnb-seo",
    "search-visibility": "airbnb-seo",
    "title-optimization": "airbnb-seo",
    "description-optimization": "airbnb-listing-optimization",
    "ranking-factors": "airbnb-seo",
    "guest-trust-guide": "airbnb-conversion-optimization",
    "review-strategy": "airbnb-conversion-optimization",
    "conversion-guide": "airbnb-conversion-optimization",
    "booking-conversion": "airbnb-conversion-optimization",
    "family-travel-guide": "airbnb-listing-optimization",
    "business-travel-guide": "airbnb-listing-optimization",
    "long-stay-guide": "airbnb-listing-optimization",
    "local-demand-guide": "airbnb-listing-audit",
    "market-analysis": "airbnb-listing-audit",
    "competitor-analysis": "airbnb-listing-audit",
    "listing-audit": "airbnb-listing-audit",
  };

  const solution = solutionSlugByTopic[topic.slug]
    ? solutions.find((item) => item.slug === solutionSlugByTopic[topic.slug])
    : null;

  pushUnique(
    solution
      ? {
          href: `/solutions/${solution.slug}`,
          eyebrow: "Solution",
          title: solution.title,
          description: solution.description,
        }
      : null,
  );

  const report = marketReports.find((item) => item.citySlug === city.slug);

  pushUnique(
    report
      ? {
          href: `/reports/${report.slug}`,
          eyebrow: "Market report",
          title: report.title,
          description: report.description,
        }
      : null,
  );

  const preferredRankingSlugsByFamily: Record<string, string[]> = {
    pricing: ["best-airbnb-markets", "best-airbnb-cities"],
    photo: ["best-airbnb-cities-in-france", "best-airbnb-cities-in-europe", "best-airbnb-cities"],
    seo: ["best-airbnb-cities", "best-airbnb-cities-in-europe"],
    conversion: ["best-airbnb-cities", "best-airbnb-markets"],
    "guest-fit": ["best-airbnb-destinations-for-families", "best-airbnb-cities"],
    general: ["best-airbnb-cities", "best-airbnb-markets"],
  };

  const ranking = (preferredRankingSlugsByFamily[family] ?? [])
    .map((slug) => rankings.find((item) => item.slug === slug))
    .find(
      (item) =>
        item &&
        item.items.some(
          (rankingItem) => rankingItem.citySlug === city.slug || rankingItem.name === city.name,
        ),
    );

  pushUnique(
    ranking
      ? {
          href: `/rankings/${ranking.slug}`,
          eyebrow: "Ranking",
          title: ranking.title,
          description: ranking.description,
        }
      : null,
  );

  return resources.slice(0, 6);
}

function buildRelatedTopics(currentTopic: LocalSeoTopic) {
  const currentFamily = getTopicResourceFamily(currentTopic);
  const sameFamily = localSeoTopics.filter(
    (topic) =>
      topic.slug !== currentTopic.slug &&
      getTopicResourceFamily(topic) === currentFamily,
  );
  const remainingTopics = localSeoTopics.filter(
    (topic) =>
      topic.slug !== currentTopic.slug &&
      !sameFamily.some((candidate) => candidate.slug === topic.slug),
  );

  return [...sameFamily, ...remainingTopics].slice(0, 6);
}

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

  const executiveSummary = buildExecutiveSummary(city, topic);
  const topicAnalysis = buildTopicSpecificAnalysis(city, topic);
  const relatedTopics = buildRelatedTopics(topic);
  const recommendedResources = buildRecommendedResources(city, topic);

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
          <Link href="/airbnb-optimizer" className="hover:text-[#10231F]">
            Airbnb Optimizer
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

      <section className="mx-auto max-w-5xl px-6 pb-12">
        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <h2 className="text-3xl font-semibold">Executive summary</h2>
          <p className="mt-4 leading-8 text-[#4C5C55]">{executiveSummary[0]}</p>
          <p className="mt-4 leading-8 text-[#4C5C55]">{executiveSummary[1]}</p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-12">
        <h2 className="text-2xl font-semibold">Local KPI snapshot</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <article className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#5F6F68]">
              Avg. nightly price
            </p>
            <p className="mt-3 text-3xl font-semibold text-[#10231F]">€{city.avgPrice}</p>
            <p className="mt-3 text-sm leading-6 text-[#5F6F68]">
              Reference pricing signal for stronger listings in {city.name}.
            </p>
          </article>
          <article className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#5F6F68]">
              Avg. guest rating
            </p>
            <p className="mt-3 text-3xl font-semibold text-[#10231F]">
              {city.avgRating.toFixed(1)} / 5
            </p>
            <p className="mt-3 text-sm leading-6 text-[#5F6F68]">
              Trust and quality pressure guests bring into this market.
            </p>
          </article>
          <article className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#5F6F68]">
              Avg. photos
            </p>
            <p className="mt-3 text-3xl font-semibold text-[#10231F]">{city.avgPhotos}</p>
            <p className="mt-3 text-sm leading-6 text-[#5F6F68]">
              Visual completeness benchmark for listings in {city.name}.
            </p>
          </article>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <h2 className="text-3xl font-semibold">
            {topicAnalysis.heading}
          </h2>
          {topicAnalysis.paragraphs.map((paragraph) => (
            <p key={paragraph} className="mt-4 leading-8 text-[#4C5C55]">
              {paragraph}
            </p>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-semibold">
            Related Airbnb optimization topics for {city.name}
          </h2>
          <p className="mt-4 text-sm leading-7 text-[#4C5C55]">
            Continue exploring nearby topics for {city.name} without leaving the same market
            context.
          </p>
          <nav
            className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3"
            aria-label={`Related Airbnb optimization topics for ${city.name}`}
          >
            {relatedTopics.map((relatedTopic) => (
              <Link
                key={relatedTopic.slug}
                href={`/airbnb-optimizer/${city.slug}/${relatedTopic.slug}`}
                className="rounded-2xl border border-[#10231F]/10 bg-[#FAF7F2] p-5 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D96C3B]">
                  {city.name}
                </p>
                <p className="mt-3 font-semibold">
                  {city.name} {relatedTopic.titleSuffix}
                </p>
              </Link>
            ))}
          </nav>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <h2 className="text-2xl font-semibold">Recommended resources for this topic</h2>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {recommendedResources.map((resource) => (
            <Link
              key={resource.href}
              href={resource.href}
              className="rounded-2xl border border-[#10231F]/10 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D96C3B]">
                {resource.eyebrow}
              </p>
              <p className="mt-3 font-semibold">{resource.title}</p>
              <p className="mt-2 text-sm leading-6 text-[#5F6F68]">
                {resource.description}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
