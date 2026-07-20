import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { articles } from "@/data/articles";
import { tools, getToolBySlug } from "@/data/tools";
import { guides } from "@/data/guides";
import { buildToolMetadata } from "@/lib/seo/buildToolMetadata";
import EEAT from "@/components/seo/EEAT";
import Calculator from "@/components/tools/Calculator";

type Props = {
  params: Promise<{
    tool: string;
  }>;
};

type ToolNextResource = {
  href: string;
  eyebrow: string;
  title: string;
  description: string;
};

function buildToolNextSteps(tool: (typeof tools)[number]): {
  title: string;
  description: string;
  resources: ToolNextResource[];
} | null {
  const guideBySlug = (guideSlug: string) =>
    guides.find((guide) => guide.slug === guideSlug);
  const articleBySlug = (articleSlug: string) =>
    articles.find((article) => article.slug === articleSlug);

  if (tool.slug === "airbnb-adr-calculator" || tool.slug === "airbnb-pricing-calculator") {
    const pricingGuide = guideBySlug("airbnb-pricing-optimization");
    const pricingArticle = articleBySlug("airbnb-pricing-strategy");

    return {
      title: "Use this pricing metric in context",
      description:
        "Pair the calculation with pricing strategy and real market benchmarks before changing your nightly rate.",
      resources: [
        pricingGuide
          ? {
              href: `/guides/${pricingGuide.slug}`,
              eyebrow: "Guide",
              title: pricingGuide.title,
              description: pricingGuide.description,
            }
          : null,
        pricingArticle
          ? {
              href: `/articles/${pricingArticle.slug}`,
              eyebrow: "Article",
              title: pricingArticle.title,
              description: pricingArticle.description,
            }
          : null,
        {
          href: "/reports",
          eyebrow: "Market data",
          title: "Compare Airbnb market reports",
          description:
            "See how pricing pressure changes across major Airbnb markets before you reposition.",
        },
      ].filter((resource): resource is ToolNextResource => Boolean(resource)),
    };
  }

  if (tool.slug === "airbnb-occupancy-calculator") {
    const revenueGuide = guideBySlug("airbnb-revenue-optimization");
    const occupancyArticle = articleBySlug("airbnb-occupancy-rate");

    return {
      title: "Connect occupancy to revenue strategy",
      description:
        "Occupancy matters most when you read it alongside pricing, demand, and total revenue efficiency.",
      resources: [
        revenueGuide
          ? {
              href: `/guides/${revenueGuide.slug}`,
              eyebrow: "Guide",
              title: revenueGuide.title,
              description: revenueGuide.description,
            }
          : null,
        occupancyArticle
          ? {
              href: `/articles/${occupancyArticle.slug}`,
              eyebrow: "Article",
              title: occupancyArticle.title,
              description: occupancyArticle.description,
            }
          : null,
        {
          href: "/reports",
          eyebrow: "Market data",
          title: "Review Airbnb market reports",
          description:
            "Use local market context to judge whether your occupancy target is realistic.",
        },
      ].filter((resource): resource is ToolNextResource => Boolean(resource)),
    };
  }

  if (tool.slug === "airbnb-revpar-calculator" || tool.slug === "airbnb-revenue-calculator") {
    const revenueGuide = guideBySlug("airbnb-revenue-optimization");
    const revparArticle = articleBySlug("airbnb-revpar");

    return {
      title: "Connect this metric to revenue efficiency",
      description:
        "Use the calculator with revenue strategy and local benchmarks so the number leads to a better decision.",
      resources: [
        revenueGuide
          ? {
              href: `/guides/${revenueGuide.slug}`,
              eyebrow: "Guide",
              title: revenueGuide.title,
              description: revenueGuide.description,
            }
          : null,
        revparArticle
          ? {
              href: `/articles/${revparArticle.slug}`,
              eyebrow: "Article",
              title: revparArticle.title,
              description: revparArticle.description,
            }
          : null,
        {
          href: "/reports",
          eyebrow: "Market data",
          title: "Compare Airbnb market reports",
          description:
            "Evaluate revenue expectations against competition, pricing, and guest demand.",
        },
      ].filter((resource): resource is ToolNextResource => Boolean(resource)),
    };
  }

  if (tool.slug === "airbnb-profit-calculator") {
    const revenueGuide = guideBySlug("airbnb-revenue-optimization");
    const pricingGuide = guideBySlug("airbnb-pricing-optimization");
    const resources = [
      revenueGuide
        ? {
            href: `/guides/${revenueGuide.slug}`,
            eyebrow: "Guide",
            title: revenueGuide.title,
            description: revenueGuide.description,
          }
        : null,
      pricingGuide
        ? {
            href: `/guides/${pricingGuide.slug}`,
            eyebrow: "Guide",
            title: pricingGuide.title,
            description: pricingGuide.description,
          }
        : null,
      {
        href: "/reports",
        eyebrow: "Market data",
        title: "Compare Airbnb market reports",
        description:
          "Use market context to judge whether your revenue assumptions can support real profit.",
      },
    ].filter((resource): resource is ToolNextResource => Boolean(resource));

    return resources.length > 0
      ? {
          title: "Connect profit to pricing and demand",
          description:
            "Profit improves when nightly rate, occupancy, and market positioning support each other.",
          resources,
        }
      : null;
  }

  return null;
}

export function generateStaticParams() {
  return tools.map((tool) => ({
    tool: tool.slug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tool: slug } = await params;
  const tool = getToolBySlug(slug);

  if (!tool) {
    return {};
  }

  return buildToolMetadata(tool);
}

export default async function ToolPage({ params }: Props) {
  const { tool: slug } = await params;
  const tool = getToolBySlug(slug);

  if (!tool) {
    notFound();
  }

  const relatedGuides = guides.filter((guide) =>
    tool.relatedGuides.includes(guide.slug)
  );
  const nextSteps = buildToolNextSteps(tool);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: tool.title,
      description: tool.description,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: `https://norixo.io/tools/${tool.slug}`,
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: tool.faq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
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
          <Link href="/tools" className="hover:text-[#10231F]">
            Tools
          </Link>
          <span className="mx-2">/</span>
          <span>{tool.title}</span>
        </nav>

        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[#D96C3B]">
          Free Airbnb calculator
        </p>

        <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
          {tool.heroTitle}
        </h1>

        <p className="mt-6 max-w-3xl text-lg leading-8 text-[#4C5C55]">
          {tool.heroSubtitle}
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-12">
        <Calculator tool={tool} />
      </section>

      <section className="mx-auto max-w-5xl px-6">
        <EEAT updated="June 2026" />
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <h2 className="text-3xl font-semibold">Frequently asked questions</h2>
        <div className="mt-6 space-y-4">
          {tool.faq.map((item) => (
            <details key={item.question} className="rounded-2xl bg-white p-5">
              <summary className="cursor-pointer font-semibold">
                {item.question}
              </summary>
              <p className="mt-3 leading-7 text-[#4C5C55]">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-20">
        {nextSteps && nextSteps.resources.length > 0 ? (
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
        {relatedGuides.length > 0 ? (
          <div className="mt-8 rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#D96C3B]">
              Method guides
            </p>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#4C5C55]">
              {relatedGuides.slice(0, 2).map((guide) => (
                <Link
                  key={guide.slug}
                  href={`/guides/${guide.slug}`}
                  className="underline-offset-4 hover:text-[#10231F] hover:underline"
                >
                  Read the {guide.title}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
