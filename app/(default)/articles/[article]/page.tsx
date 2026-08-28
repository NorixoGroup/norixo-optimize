import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { articles, getArticleBySlug } from "@/data/articles";
import { guides } from "@/data/guides";
import { rankings } from "@/data/rankings";
import { tools } from "@/data/tools";
import { buildArticleMetadata } from "@/lib/seo/buildArticleMetadata";
import { normalizeArticleClaimText } from "@/lib/seo/articleClaimSafety";
import { getKnowledgeObject } from "@/lib/knowledge";
import { resolveEditorialLinks } from "@/lib/knowledge/editorial";
import EEAT from "@/components/seo/EEAT";

type Props = {
  params: Promise<{
    article: string;
  }>;
};

type ArticleNextResource = {
  href: string;
  eyebrow: string;
  title: string;
  description: string;
};

const ADR_ARTICLE_KNOWLEDGE_OBJECT_ID = "metrics.average-daily-rate";
const REVPAR_ARTICLE_KNOWLEDGE_OBJECT_ID = "metrics.revenue-per-available-rental-night";
const OCCUPANCY_ARTICLE_KNOWLEDGE_OBJECT_ID = "metrics.occupancy-rate";

function buildArticleNextSteps(article: (typeof articles)[number]): {
  title: string;
  description: string;
  resources: ArticleNextResource[];
} {
  const guideBySlug = (guideSlug: string) =>
    guides.find((guide) => guide.slug === guideSlug);
  const toolBySlug = (toolSlug: string) =>
    tools.find((tool) => tool.slug === toolSlug);

  if (article.cluster === "Pricing Optimization") {
    const guide = guideBySlug("airbnb-pricing-optimization");
    const toolSlug =
      article.slug === "airbnb-occupancy-rate"
        ? "airbnb-occupancy-calculator"
        : article.slug === "airbnb-revpar"
          ? "airbnb-revpar-calculator"
          : article.slug === "airbnb-adr"
            ? "airbnb-adr-calculator"
            : "airbnb-pricing-calculator";
    const tool = toolBySlug(toolSlug);

    return {
      title: "Apply this with market data",
      description:
        "Use the method, test the metric, then compare it against real Airbnb market context.",
      resources: [
        guide
          ? {
              href: `/guides/${guide.slug}`,
              eyebrow: "Guide",
              title: guide.title,
              description: guide.description,
            }
          : null,
        tool
          ? {
              href: `/tools/${tool.slug}`,
              eyebrow: "Calculator",
              title: tool.title,
              description: tool.description,
            }
          : null,
        {
          href: "/reports",
          eyebrow: "Market data",
          title: "Compare Airbnb market reports",
          description:
            "Review pricing pressure and competition before adjusting your nightly rate.",
        },
      ].filter((resource): resource is ArticleNextResource => Boolean(resource)),
    };
  }

  if (article.cluster === "Airbnb SEO") {
    const guide = guideBySlug("airbnb-seo");
    const auditGuide = guideBySlug("airbnb-listing-audit");

    return {
      title: "Continue with visibility analysis",
      description:
        "Go from ranking theory to listing diagnosis and city-specific search context.",
      resources: [
        guide
          ? {
              href: `/guides/${guide.slug}`,
              eyebrow: "Guide",
              title: guide.title,
              description: guide.description,
            }
          : null,
        auditGuide
          ? {
              href: `/guides/${auditGuide.slug}`,
              eyebrow: "Guide",
              title: auditGuide.title,
              description: auditGuide.description,
            }
          : null,
        {
          href: "/airbnb-optimizer",
          eyebrow: "Local SEO",
          title: "Explore city optimizer pages",
          description:
            "See how visibility, demand, and competition vary across major Airbnb markets.",
        },
      ].filter((resource): resource is ArticleNextResource => Boolean(resource)),
    };
  }

  if (article.cluster === "Airbnb Photos") {
    const guide = guideBySlug("airbnb-photo-optimization");
    const listingGuide = guideBySlug("airbnb-listing-optimization");

    return {
      title: "Continue with photo execution",
      description:
        "Turn visual advice into a clearer gallery structure and a better market-facing listing.",
      resources: [
        guide
          ? {
              href: `/guides/${guide.slug}`,
              eyebrow: "Guide",
              title: guide.title,
              description: guide.description,
            }
          : null,
        listingGuide
          ? {
              href: `/guides/${listingGuide.slug}`,
              eyebrow: "Guide",
              title: listingGuide.title,
              description: listingGuide.description,
            }
          : null,
        {
          href: "/airbnb-optimizer",
          eyebrow: "Local context",
          title: "Compare city photo expectations",
          description:
            "Use local market pages to understand what guests expect to see first.",
        },
      ].filter((resource): resource is ArticleNextResource => Boolean(resource)),
    };
  }

  const conversionGuide = guideBySlug("airbnb-conversion-optimization");
  const listingAuditGuide = guideBySlug("airbnb-listing-audit");

  return {
    title: "Continue with booking analysis",
    description:
      "Follow this topic with a stronger conversion framework and a practical listing diagnosis.",
    resources: [
      conversionGuide
        ? {
            href: `/guides/${conversionGuide.slug}`,
            eyebrow: "Guide",
            title: conversionGuide.title,
            description: conversionGuide.description,
          }
        : null,
      listingAuditGuide
        ? {
            href: `/guides/${listingAuditGuide.slug}`,
            eyebrow: "Guide",
            title: listingAuditGuide.title,
            description: listingAuditGuide.description,
          }
        : null,
      {
        href: "/free-audit",
        eyebrow: "Free Audit",
        title: "Start with a free market preview",
        description:
          "Begin with public market context before moving into a full listing audit.",
      },
    ].filter((resource): resource is ArticleNextResource => Boolean(resource)),
  };
}

export function generateStaticParams() {
  return articles.map((article) => ({
    article: article.slug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { article: slug } = await params;
  const article = getArticleBySlug(slug);

  if (!article) {
    return {};
  }

  return buildArticleMetadata(article);
}

export default async function ArticlePage({ params }: Props) {
  const { article: slug } = await params;
  const article = getArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  if (article.slug === "airbnb-adr") {
    const adrKnowledgeObject = getKnowledgeObject(ADR_ARTICLE_KNOWLEDGE_OBJECT_ID);

    if (!adrKnowledgeObject || !adrKnowledgeObject.identity.reviewDate) {
      throw new Error("The canonical ADR knowledge object must be available and reviewed.");
    }
  }

  if (article.slug === "airbnb-revpar") {
    const revparKnowledgeObject = getKnowledgeObject(REVPAR_ARTICLE_KNOWLEDGE_OBJECT_ID);

    if (!revparKnowledgeObject || !revparKnowledgeObject.identity.reviewDate) {
      throw new Error("The canonical RevPAR knowledge object must be available and reviewed.");
    }
  }

  if (article.slug === "airbnb-occupancy-rate") {
    const occupancyKnowledgeObject = getKnowledgeObject(OCCUPANCY_ARTICLE_KNOWLEDGE_OBJECT_ID);

    if (!occupancyKnowledgeObject || !occupancyKnowledgeObject.identity.reviewDate) {
      throw new Error("The canonical Occupancy knowledge object must be available and reviewed.");
    }
  }

  const relatedGuides = guides.filter((guide) =>
    article.relatedGuides.includes(guide.slug)
  );

  const relatedRankings = rankings.filter((ranking) =>
    article.relatedRankings.includes(ranking.slug)
  );
  const nextSteps = buildArticleNextSteps(article);
  const relatedReadingClusters = new Set(["Airbnb Photos", "Pricing Optimization", "Airbnb Revenue"]);
  const resolvedEditorialLinks = relatedReadingClusters.has(article.cluster)
    ? resolveEditorialLinks(`content:article:${article.slug}`)
    : [];
  const occupiedPaths = new Set([...nextSteps.resources.map((resource) => resource.href), ...relatedGuides.map((guide) => `/guides/${guide.slug}`), ...relatedRankings.map((ranking) => `/rankings/${ranking.slug}`)]);
  const editorialLinks = resolvedEditorialLinks.filter((link) => !occupiedPaths.has(link.path));

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: article.title,
      description: normalizeArticleClaimText(article.description),
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
        "@id": `https://norixo.io/articles/${article.slug}`,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: article.faq.map((item) => ({
        "@type": "Question",
        name: normalizeArticleClaimText(item.question),
        acceptedAnswer: {
          "@type": "Answer",
          text: normalizeArticleClaimText(item.answer),
        },
      })),
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
          <Link href="/articles" className="hover:text-[#10231F]">
            Articles
          </Link>
          <span className="mx-2">/</span>
          <span>{article.title}</span>
        </nav>

        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[#D96C3B]">
          {article.cluster}
        </p>

        <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
          {normalizeArticleClaimText(article.heroTitle)}
        </h1>

        <p className="mt-6 max-w-3xl text-lg leading-8 text-[#4C5C55]">
          {normalizeArticleClaimText(article.heroSubtitle)}
        </p>
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-10">
        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <p className="text-lg leading-8 text-[#4C5C55]">{normalizeArticleClaimText(article.intro)}</p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-8">
        <div className="space-y-6">
          {article.sections.map((section) => (
            <article key={section.title} className="rounded-3xl bg-white p-8 shadow-sm">
              <h2 className="text-2xl font-semibold">{normalizeArticleClaimText(section.title)}</h2>
              <p className="mt-4 leading-8 text-[#4C5C55]">{normalizeArticleClaimText(section.body)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-10">
        <h2 className="text-3xl font-semibold">Frequently asked questions</h2>
        <div className="mt-6 space-y-4">
          {article.faq.map((item) => (
            <details key={item.question} className="rounded-2xl bg-white p-5">
              <summary className="cursor-pointer font-semibold">
                {normalizeArticleClaimText(item.question)}
              </summary>
              <p className="mt-3 leading-7 text-[#4C5C55]">{normalizeArticleClaimText(item.answer)}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6">
        <EEAT updated="June 2026" />
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <div className="rounded-3xl bg-[#10231F] p-8 text-white md:p-10">
          <h2 className="text-3xl font-semibold">
            Audit your Airbnb listing with Norixo
          </h2>
          <p className="mt-4 max-w-2xl leading-7 text-white/80">
            Review pricing, photos, description, trust, and market-positioning signals
            to identify what deserves attention first.
          </p>
          <Link
            href="/free-audit"
            className="mt-6 inline-flex rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#10231F]"
          >
            Start an Airbnb audit
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-20">
        {nextSteps.resources.length > 0 ? (
          <>
            <h2 className="text-2xl font-semibold">{nextSteps.title}</h2>
            <p className="mt-3 max-w-3xl leading-7 text-[#4C5C55]">
              {nextSteps.description}
            </p>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {nextSteps.resources.map((resource) => (
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
          </>
        ) : null}
        {editorialLinks.length > 0 ? (
          <section className="mt-8" aria-labelledby="related-reading-heading">
            <h2 id="related-reading-heading" className="text-2xl font-semibold">Continue learning</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {editorialLinks.map((editorialLink) => (
                <Link key={editorialLink.targetId} href={editorialLink.path} className="rounded-2xl border border-[#10231F]/10 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D96C3B]">{editorialLink.contentType}</p>
                  <p className="mt-3 font-semibold">{editorialLink.title}</p>
                  <p className="mt-2 text-sm leading-6 text-[#5F6F68]">{editorialLink.reason}</p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
        {relatedGuides.length > 0 || relatedRankings.length > 0 ? (
          <div className="mt-8 rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#D96C3B]">
              Broader discovery
            </p>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#4C5C55]">
              {relatedGuides.slice(0, 2).map((guide) => (
                <Link
                  key={guide.slug}
                  href={`/guides/${guide.slug}`}
                  className="underline-offset-4 hover:text-[#10231F] hover:underline"
                >
                  Explore the {guide.title}
                </Link>
              ))}
              {relatedRankings.slice(0, 1).map((ranking) => (
                <Link
                  key={ranking.slug}
                  href={`/rankings/${ranking.slug}`}
                  className="underline-offset-4 hover:text-[#10231F] hover:underline"
                >
                  Compare the {ranking.title.toLowerCase()}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}