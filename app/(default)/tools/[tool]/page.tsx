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

type KpiCalculatorContent = {
  example: {
    inputs: { label: string; value: string }[];
    resultLabel: string;
    resultValue: string;
  };
  whenToUse: string;
  mistakes: string[];
  faq: { question: string; answer: string }[];
};

const KPI_CALCULATOR_CONTENT: Partial<Record<(typeof tools)[number]["slug"], KpiCalculatorContent>> = {
  "airbnb-adr-calculator": {
    example: {
      inputs: [
        { label: "Accommodation revenue", value: "€3,000" },
        { label: "Booked nights", value: "20" },
      ],
      resultLabel: "ADR",
      resultValue: "€150",
    },
    whenToUse:
      "Use ADR to check the average revenue earned on nights that actually booked. Read it alongside occupancy and RevPAR before raising or lowering your nightly rate.",
    mistakes: [
      "Mixing accommodation revenue with taxes or platform payouts.",
      "Comparing ADR from different seasons without accounting for demand.",
      "Treating ADR as performance without checking occupancy.",
    ],
    faq: [
      {
        question: "What is the difference between ADR and average price?",
        answer:
          "ADR is the average accommodation revenue earned per booked night over a period. Your displayed nightly price can vary by date and may not match the revenue you actually earned.",
      },
      {
        question: "Should taxes be included in ADR?",
        answer:
          "No. Use accommodation revenue that you earned for the stay, and keep taxes outside the calculation so periods remain comparable.",
      },
    ],
  },
  "airbnb-occupancy-calculator": {
    example: {
      inputs: [
        { label: "Booked nights", value: "21" },
        { label: "Available nights", value: "30" },
      ],
      resultLabel: "Occupancy",
      resultValue: "70%",
    },
    whenToUse:
      "Use occupancy to understand how much of your sellable calendar converted into bookings. Compare the same period year over year, then read it with ADR and RevPAR.",
    mistakes: [
      "Counting owner stays or blocked nights as available nights.",
      "Comparing peak-season occupancy with a low-season period.",
      "Treating 100% occupancy as the goal regardless of rate or profit.",
    ],
    faq: [
      {
        question: "What is a good occupancy rate for Airbnb?",
        answer:
          "There is no universal target. A useful rate depends on your market, season, property type and ADR. Compare similar dates and similar listings rather than a national average.",
      },
      {
        question: "Should blocked nights count in occupancy?",
        answer:
          "No. If a night could not be booked by a guest, exclude it from available nights when measuring the performance of your sellable calendar.",
      },
    ],
  },
  "airbnb-revpar-calculator": {
    example: {
      inputs: [
        { label: "Accommodation revenue", value: "€3,000" },
        { label: "Available nights", value: "30" },
      ],
      resultLabel: "RevPAR",
      resultValue: "€100",
    },
    whenToUse:
      "Use RevPAR when you need one metric that reflects both pricing and occupancy. It is most useful for comparing like-for-like periods, property types and markets.",
    mistakes: [
      "Comparing high-season and low-season periods without context.",
      "Using booked nights instead of available nights in the denominator.",
      "Mixing gross and net revenue between periods.",
    ],
    faq: [
      {
        question: "What is a good RevPAR for Airbnb?",
        answer:
          "A good RevPAR is relative to your market, property type and season. Compare it with your own prior periods and genuinely comparable nearby listings before deciding what to change.",
      },
      {
        question: "Does RevPAR include cleaning fees?",
        answer:
          "Use a consistent accommodation-revenue definition. If cleaning fees are excluded for one period, exclude them for every period you compare.",
      },
    ],
  },
};

const KPI_TOOL_LINKS = [
  { href: "/tools/airbnb-adr-calculator", label: "ADR Calculator" },
  { href: "/tools/airbnb-occupancy-calculator", label: "Occupancy Calculator" },
  { href: "/tools/airbnb-revpar-calculator", label: "RevPAR Calculator" },
] as const;

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
  const kpiContent = KPI_CALCULATOR_CONTENT[tool.slug];
  const displayedFaq = kpiContent ? [...tool.faq, ...kpiContent.faq] : tool.faq;

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

      {kpiContent ? (
        <section className="mx-auto max-w-5xl px-6 pb-12">
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-3xl border border-[#10231F]/10 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#D96C3B]">
                Worked example
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {kpiContent.example.inputs.map((input) => (
                  <div key={input.label} className="rounded-2xl bg-[#FAF7F2] p-4">
                    <p className="text-sm text-[#5F6F68]">{input.label}</p>
                    <p className="mt-1 text-xl font-semibold">{input.value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-2xl border border-[#D96C3B]/20 bg-[#FFF7F2] p-4">
                <p className="text-sm font-semibold text-[#5F6F68]">
                  {kpiContent.example.resultLabel}
                </p>
                <p className="mt-1 text-2xl font-semibold text-[#10231F]">
                  {kpiContent.example.resultValue}
                </p>
              </div>
            </section>

            <section className="rounded-3xl border border-[#10231F]/10 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-semibold">When should I use this KPI?</h2>
              <p className="mt-4 leading-7 text-[#4C5C55]">{kpiContent.whenToUse}</p>
              <h2 className="mt-7 text-2xl font-semibold">Common mistakes</h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-[#4C5C55]">
                {kpiContent.mistakes.map((mistake) => (
                  <li key={mistake} className="flex gap-3">
                    <span aria-hidden="true" className="text-[#D96C3B]">•</span>
                    <span>{mistake}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-5xl px-6">
        <EEAT updated="June 2026" />
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <h2 className="text-3xl font-semibold">Frequently asked questions</h2>
        <div className="mt-6 space-y-4">
          {displayedFaq.map((item) => (
            <details key={item.question} className="rounded-2xl bg-white p-5">
              <summary className="cursor-pointer font-semibold">
                {item.question}
              </summary>
              <p className="mt-3 leading-7 text-[#4C5C55]">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      {kpiContent ? (
        <section className="mx-auto max-w-5xl px-6 pb-12">
          <div className="rounded-3xl border border-[#10231F]/10 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold">Understand the full picture</h2>
            <p className="mt-3 max-w-3xl leading-7 text-[#4C5C55]">
              ADR, occupancy and RevPAR should always be interpreted together. One number explains less than the relationship between all three.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              {KPI_TOOL_LINKS.filter((kpiTool) => kpiTool.href !== `/tools/${tool.slug}`).map((kpiTool) => (
                <Link
                  key={kpiTool.href}
                  href={kpiTool.href}
                  className="rounded-full border border-[#10231F]/10 px-4 py-2 text-sm font-semibold text-[#10231F] transition hover:border-[#D96C3B] hover:text-[#D96C3B]"
                >
                  {kpiTool.label}
                </Link>
              ))}
            </div>
            <p className="mt-6 text-sm text-[#5F6F68]">
              Need deeper insights?{" "}
              <Link
                href="/sign-in?next=/audit/new"
                className="font-semibold text-[#10231F] underline-offset-4 hover:underline"
              >
                Run a complete audit.
              </Link>
            </p>
          </div>
        </section>
      ) : null}

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
