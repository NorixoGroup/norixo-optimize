import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { articles } from "@/data/articles";
import { guides, getGuideBySlug } from "@/data/guides";
import { countries } from "@/data/countries";
import { cities } from "@/data/cities";
import { tools } from "@/data/tools";
import { buildGuideMetadata } from "@/lib/seo/buildGuideMetadata";
import { getKnowledgeObject } from "@/lib/knowledge";
import { GuideHero } from "@/components/seo/GuideHero";
import { GuideSection } from "@/components/seo/GuideSection";
import { GuideCTA } from "@/components/seo/GuideCTA";
import { GuideFAQ } from "@/components/seo/GuideFAQ";
import { RelatedGuides } from "@/components/seo/RelatedGuides";
import { RelatedCountries } from "@/components/seo/RelatedCountries";
import { RelatedCities } from "@/components/seo/RelatedCities";
import EEAT from "@/components/seo/EEAT";

type Props = {
  params: Promise<{
    guide: string;
  }>;
};

type NextStepResource = {
  href: string;
  eyebrow: string;
  title: string;
  description: string;
};

const REVPAR_GUIDE_KNOWLEDGE_OBJECT_ID = "metrics.revenue-per-available-rental-night";
const ADR_GUIDE_KNOWLEDGE_OBJECT_ID = "metrics.average-daily-rate";

function buildGuideNextSteps(slug: string): {
  title: string;
  description: string;
  resources: NextStepResource[];
} | null {
  const articleBySlug = (articleSlug: string) =>
    articles.find((article) => article.slug === articleSlug);
  const toolBySlug = (toolSlug: string) =>
    tools.find((tool) => tool.slug === toolSlug);

  if (slug === "airbnb-pricing-optimization") {
    const pricingArticle = articleBySlug("airbnb-pricing-strategy");
    const adrTool = toolBySlug("airbnb-adr-calculator");

    return {
      title: "Continue with pricing data",
      description:
        "Move from pricing principles to real benchmarks, nightly-rate math, and market comparisons.",
      resources: [
        pricingArticle
          ? {
              href: `/articles/${pricingArticle.slug}`,
              eyebrow: "Article",
              title: pricingArticle.title,
              description: pricingArticle.description,
            }
          : null,
        adrTool
          ? {
              href: `/tools/${adrTool.slug}`,
              eyebrow: "Calculator",
              title: adrTool.title,
              description: adrTool.description,
            }
          : null,
        {
          href: "/reports",
          eyebrow: "Market data",
          title: "Compare Airbnb market reports",
          description:
            "See how pricing pressure, competition, and demand differ across real markets.",
        },
      ].filter((resource): resource is NextStepResource => Boolean(resource)),
    };
  }

  if (slug === "airbnb-revenue-optimization") {
    const revparArticle = articleBySlug("airbnb-revpar");
    const revparTool = toolBySlug("airbnb-revpar-calculator");

    return {
      title: "Continue with revenue metrics",
      description:
        "Connect your revenue strategy to the metrics that reveal whether pricing and occupancy are working together.",
      resources: [
        revparArticle
          ? {
              href: `/articles/${revparArticle.slug}`,
              eyebrow: "Article",
              title: revparArticle.title,
              description: revparArticle.description,
            }
          : null,
        revparTool
          ? {
              href: `/tools/${revparTool.slug}`,
              eyebrow: "Calculator",
              title: revparTool.title,
              description: revparTool.description,
            }
          : null,
        {
          href: "/reports",
          eyebrow: "Market data",
          title: "Review Airbnb market reports",
          description:
            "Use market context to judge whether your revenue targets fit local competition.",
        },
      ].filter((resource): resource is NextStepResource => Boolean(resource)),
    };
  }

  if (slug === "airbnb-seo" || slug === "airbnb-ranking") {
    const seoArticle = articleBySlug("how-airbnb-seo-works");
    const rankingArticle = articleBySlug("airbnb-search-ranking-factors");

    return {
      title: "Continue with search visibility",
      description:
        "Deepen the method, then apply it to city-specific Airbnb search behavior.",
      resources: [
        seoArticle
          ? {
              href: `/articles/${seoArticle.slug}`,
              eyebrow: "Article",
              title: seoArticle.title,
              description: seoArticle.description,
            }
          : null,
        rankingArticle
          ? {
              href: `/articles/${rankingArticle.slug}`,
              eyebrow: "Article",
              title: rankingArticle.title,
              description: rankingArticle.description,
            }
          : null,
        {
          href: "/airbnb-optimizer",
          eyebrow: "Local SEO",
          title: "Explore city-specific optimizer pages",
          description:
            "Apply SEO principles to local demand, competition, and guest expectations.",
        },
      ].filter((resource): resource is NextStepResource => Boolean(resource)),
    };
  }

  if (slug === "airbnb-photo-optimization") {
    const photoArticle = articleBySlug("airbnb-photo-tips");
    const coverPhotoArticle = articleBySlug("airbnb-cover-photo");

    return {
      title: "Continue with photo execution",
      description:
        "Translate the photo framework into concrete image choices, sequencing, and cover-photo decisions.",
      resources: [
        photoArticle
          ? {
              href: `/articles/${photoArticle.slug}`,
              eyebrow: "Article",
              title: photoArticle.title,
              description: photoArticle.description,
            }
          : null,
        coverPhotoArticle
          ? {
              href: `/articles/${coverPhotoArticle.slug}`,
              eyebrow: "Article",
              title: coverPhotoArticle.title,
              description: coverPhotoArticle.description,
            }
          : null,
        {
          href: "/airbnb-optimizer",
          eyebrow: "Local context",
          title: "Compare city photo expectations",
          description:
            "See how photo depth and guest expectations vary across major Airbnb markets.",
        },
      ].filter((resource): resource is NextStepResource => Boolean(resource)),
    };
  }

  if (
    slug === "airbnb-conversion-optimization" ||
    slug === "airbnb-listing-audit" ||
    slug === "airbnb-listing-optimization"
  ) {
    const visibilityArticle = articleBySlug("airbnb-listing-visibility");
    const copywritingArticle = articleBySlug("airbnb-listing-copywriting");

    return {
      title: "Continue with conversion analysis",
      description:
        "Follow the guide with practical diagnosis of the signals that influence clicks, trust, and booking confidence.",
      resources: [
        visibilityArticle
          ? {
              href: `/articles/${visibilityArticle.slug}`,
              eyebrow: "Article",
              title: visibilityArticle.title,
              description: visibilityArticle.description,
            }
          : null,
        copywritingArticle
          ? {
              href: `/articles/${copywritingArticle.slug}`,
              eyebrow: "Article",
              title: copywritingArticle.title,
              description: copywritingArticle.description,
            }
          : null,
        {
          href: "/free-audit",
          eyebrow: "Free Audit",
          title: "Test the free market preview",
          description:
            "Start with public market context before moving into a full listing diagnosis.",
        },
      ].filter((resource): resource is NextStepResource => Boolean(resource)),
    };
  }

  if (slug === "airbnb-title-generator") {
    const seoGuide = guides.find((guide) => guide.slug === "airbnb-seo");
    const keywordArticle = articleBySlug("airbnb-keyword-optimization");

    const resources = [
      seoGuide
        ? {
            href: `/guides/${seoGuide.slug}`,
            eyebrow: "Guide",
            title: seoGuide.title,
            description: seoGuide.description,
          }
        : null,
      keywordArticle
        ? {
            href: `/articles/${keywordArticle.slug}`,
            eyebrow: "Article",
            title: keywordArticle.title,
            description: keywordArticle.description,
          }
        : null,
    ].filter((resource): resource is NextStepResource => Boolean(resource));

    return resources.length > 0
      ? {
          title: "Continue with title positioning",
          description:
            "Use the generator with stronger keyword choices and clearer search intent.",
          resources,
        }
      : null;
  }

  if (slug === "airbnb-description-generator") {
    const listingGuide = guides.find(
      (guide) => guide.slug === "airbnb-listing-optimization",
    );
    const copywritingArticle = articleBySlug("airbnb-listing-copywriting");

    const resources = [
      listingGuide
        ? {
            href: `/guides/${listingGuide.slug}`,
            eyebrow: "Guide",
            title: listingGuide.title,
            description: listingGuide.description,
          }
        : null,
      copywritingArticle
        ? {
            href: `/articles/${copywritingArticle.slug}`,
            eyebrow: "Article",
            title: copywritingArticle.title,
            description: copywritingArticle.description,
          }
        : null,
    ].filter((resource): resource is NextStepResource => Boolean(resource));

    return resources.length > 0
      ? {
          title: "Continue with listing copy",
          description:
            "Turn generated text into clearer positioning, stronger trust, and better booking flow.",
          resources,
        }
      : null;
  }

  return null;
}

export function generateStaticParams() {
  return guides.map((guide) => ({
    guide: guide.slug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { guide: slug } = await params;
  const guide = getGuideBySlug(slug);

  if (!guide) {
    return {};
  }

  return buildGuideMetadata(guide);
}

export default async function GuidePage({ params }: Props) {
  const { guide: slug } = await params;
  const guide = getGuideBySlug(slug);

  if (!guide) {
    notFound();
  }

  if (guide.slug === "airbnb-revenue-optimization") {
    const revparKnowledgeObject = getKnowledgeObject(REVPAR_GUIDE_KNOWLEDGE_OBJECT_ID);

    if (!revparKnowledgeObject || !revparKnowledgeObject.identity.reviewDate) {
      throw new Error("The canonical RevPAR knowledge object must be available and reviewed.");
    }
  }

  if (guide.slug === "airbnb-pricing-optimization") {
    const adrKnowledgeObject = getKnowledgeObject(ADR_GUIDE_KNOWLEDGE_OBJECT_ID);

    if (!adrKnowledgeObject || !adrKnowledgeObject.identity.reviewDate) {
      throw new Error("The canonical ADR knowledge object must be available and reviewed.");
    }
  }

  const isListingAuditGuide = guide.slug === "airbnb-listing-audit";
  const isGuestExperienceGuide = guide.slug === "airbnb-guest-experience";
  const usesCanonicalGuideEntityGraph = isListingAuditGuide || isGuestExperienceGuide;
  const guideUrl = `https://norixo.io/guides/${guide.slug}`;
  const nextSteps = buildGuideNextSteps(guide.slug);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      ...(usesCanonicalGuideEntityGraph
        ? {
            "@id": `${guideUrl}#article`,
            author: { "@id": "https://norixo.io/#organization" },
            publisher: { "@id": "https://norixo.io/#organization" },
            isPartOf: { "@id": "https://norixo.io/#website" },
            ...(isListingAuditGuide ? { mentions: { "@id": "https://norixo.io/#software" } } : {}),
            mainEntityOfPage: { "@id": `${guideUrl}#webpage` },
          }
        : {
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
              "@id": guideUrl,
            },
          }),
      headline: guide.title,
      description: guide.description,
    },
    ...(usesCanonicalGuideEntityGraph
      ? [
          {
            "@context": "https://schema.org",
            "@type": "WebPage",
            "@id": `${guideUrl}#webpage`,
            url: guideUrl,
            name: guide.title,
            isPartOf: { "@id": "https://norixo.io/#website" },
            mainEntity: { "@id": `${guideUrl}#article` },
          },
        ]
      : []),
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
          name: "Guides",
          item: "https://norixo.io/guides",
        },
        {
          "@type": "ListItem",
          position: 3,
          name: guide.title,
          item: guideUrl,
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: guide.faq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    },
    ...(!usesCanonicalGuideEntityGraph
      ? [
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
        ]
      : []),
  ];

  return (
    <main className="min-h-screen bg-[#FAF7F2] text-[#10231F]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="mx-auto max-w-5xl px-6 pt-10">
        <nav className="text-sm text-[#5F6F68]">
          <Link href="/" className="hover:text-[#10231F]">
            Home
          </Link>
          <span className="mx-2">/</span>
          <Link href="/guides" className="hover:text-[#10231F]">
            Guides
          </Link>
          <span className="mx-2">/</span>
          <span>{guide.title}</span>
        </nav>
      </section>

      <GuideHero
        eyebrow="Airbnb optimization guide"
        title={guide.heroTitle}
        subtitle={guide.heroSubtitle}
        primaryCtaHref="/analyze"
        primaryCtaLabel={guide.cta?.label ?? "Audit my Airbnb listing"}
        secondaryCtaHref="/pricing"
        secondaryCtaLabel="View pricing"
      />

      <section className="mx-auto max-w-4xl px-6 pb-10">
        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <p className="text-lg leading-8 text-[#4C5C55]">{guide.intro}</p>
        </div>
      </section>

      {guide.answerFirst ? (
        <section className="mx-auto max-w-4xl px-6 pb-8">
          <div className="rounded-3xl border border-[#10231F]/10 bg-white p-8 shadow-sm">
            <h2 className="text-2xl font-semibold">{guide.answerFirst.title}</h2>
            <p className="mt-4 leading-8 text-[#4C5C55]">{guide.answerFirst.body}</p>
          </div>
        </section>
      ) : null}

      {guide.auditFramework ? (
        <section className="mx-auto max-w-5xl px-6 py-8">
          <h2 className="text-3xl font-semibold">{guide.auditFramework.title}</h2>
          <div className="mt-6 overflow-x-auto rounded-3xl bg-white shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[#10231F]/10 text-[#10231F]">
                <tr>
                  <th className="px-5 py-4 font-semibold">Audit area</th>
                  <th className="px-5 py-4 font-semibold">What is reviewed</th>
                  <th className="px-5 py-4 font-semibold">Why it matters</th>
                </tr>
              </thead>
              <tbody>
                {guide.auditFramework.rows.map((row) => (
                  <tr key={row.dimension} className="border-b border-[#10231F]/10 last:border-b-0">
                    <th className="px-5 py-4 align-top font-semibold text-[#10231F]">
                      {row.dimension}
                      <span className="mt-2 block text-xs font-medium text-[#5F6F68]">
                        {row.evidenceLabel}
                      </span>
                    </th>
                    <td className="px-5 py-4 align-top leading-6 text-[#4C5C55]">{row.review}</td>
                    <td className="px-5 py-4 align-top leading-6 text-[#4C5C55]">{row.whyItMatters}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-4xl px-6 py-8">
        <div className="space-y-6">
          {guide.sections.map((section) => (
            <GuideSection
              key={section.title}
              title={section.title}
              body={section.body}
            />
          ))}
        </div>
      </section>

      <GuideFAQ items={guide.faq} />

      <GuideCTA {...guide.cta} />

      {guide.evidenceSources ? (
        <section className="mx-auto max-w-5xl px-6 py-12">
          <div className="rounded-3xl border border-[#10231F]/10 bg-white p-8 shadow-sm">
            <h2 className="text-2xl font-semibold">{guide.evidenceSources.title}</h2>
            <p className="mt-4 max-w-3xl leading-7 text-[#4C5C55]">{guide.evidenceSources.note}</p>
            <ul className="mt-6 space-y-3">
              {guide.evidenceSources.sources.map((source) => (
                <li key={source.href} className="leading-7 text-[#4C5C55]">
                  <a
                    href={source.href}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-[#23483B] underline underline-offset-4"
                  >
                    {source.title}
                  </a>
                  <span className="text-[#5F6F68]"> — {source.role}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {nextSteps && nextSteps.resources.length > 0 ? (
        <section className="mx-auto max-w-5xl px-6 py-12">
          <div className="rounded-3xl border border-[#10231F]/10 bg-white p-8 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#D96C3B]">
              Next step
            </p>
            <h2 className="mt-3 text-3xl font-semibold">{nextSteps.title}</h2>
            <p className="mt-4 max-w-3xl leading-7 text-[#4C5C55]">
              {nextSteps.description}
            </p>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {nextSteps.resources.map((resource) => (
                <Link
                  key={resource.href}
                  href={resource.href}
                  className="rounded-2xl border border-[#10231F]/10 bg-[#FAF7F2] p-5 transition hover:-translate-y-0.5 hover:shadow-md"
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
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-5xl px-6">
        <EEAT updated="June 2026" />
      </section>

      <RelatedGuides guides={guides} currentSlug={guide.slug} />

      <RelatedCountries
        countries={countries.filter((country) =>
          [
            "france",
            "morocco",
            "spain",
            "italy",
            "united-states",
            "canada",
          ].includes(country.slug)
        )}
      />

      <RelatedCities
        cities={cities.filter((city) =>
          [
            "paris",
            "marrakech",
            "london",
            "barcelona",
            "new-york",
            "dubai",
            "tokyo",
            "nice",
            "miami",
          ].includes(city.slug)
        )}
        title="Explore high-demand Airbnb markets"
      />
    </main>
  );
}
