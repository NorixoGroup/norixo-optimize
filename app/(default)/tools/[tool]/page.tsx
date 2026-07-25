import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { articles } from "@/data/articles";
import { tools, getToolBySlug } from "@/data/tools";
import { guides } from "@/data/guides";
import { buildToolMetadata } from "@/lib/seo/buildToolMetadata";
import { getKnowledgeObject, resolvePrimaryFormulaForProjection } from "@/lib/knowledge";
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

type EditorialSource = {
  name: string;
  href: string;
};

type KpiCalculatorContent = {
  example: {
    inputs: { label: string; value: string }[];
    resultLabel: string;
    resultValue: string;
  };
  whenToUse: string;
  convention: {
    included: string;
    excluded: string;
    comparable: string;
    limitation: string;
    secondaryFormula?: {
      formula: string;
      explanation: string;
    };
  };
  decision: {
    metricName: string;
    cannotTell: string;
    relatedKpis: { href: string; label: string; explanation: string }[];
    scenario?: {
      title: string;
      properties: {
        name: string;
        adr: string;
        occupancy: string;
        revpar: string;
      }[];
      explanation: string;
    };
  };
  editorial: {
    methodology: string;
    claims: {
      text: string;
      source: EditorialSource;
    }[];
    sources: EditorialSource[];
  };
  mistakes: string[];
  faq: { question: string; answer: string }[];
};

type ResolvedKpiCalculatorEditorial = KpiCalculatorContent["editorial"] & {
  owner: string;
  reviewedOn: {
    display: string;
    iso: string;
  };
};

const ADR_KNOWLEDGE_OBJECT_ID = "metrics.average-daily-rate";
const REVPAR_KNOWLEDGE_OBJECT_ID = "metrics.revenue-per-available-rental-night";
const OCCUPANCY_KNOWLEDGE_OBJECT_ID = "metrics.occupancy-rate";

const KPI_CALCULATOR_FORMULA_PRESENTATIONS: Partial<
  Record<(typeof tools)[number]["slug"], { canonicalId: string; suffix: string }>
> = {
  "airbnb-adr-calculator": {
    canonicalId: ADR_KNOWLEDGE_OBJECT_ID,
    suffix: ". This helps hosts understand average revenue per booked night.",
  },
  "airbnb-occupancy-calculator": {
    canonicalId: OCCUPANCY_KNOWLEDGE_OBJECT_ID,
    suffix: ".",
  },
  "airbnb-revpar-calculator": {
    canonicalId: REVPAR_KNOWLEDGE_OBJECT_ID,
    suffix: ".",
  },
};

function getKpiCalculatorFormulaDescription(
  slug: (typeof tools)[number]["slug"]
): string | undefined {
  const presentation = KPI_CALCULATOR_FORMULA_PRESENTATIONS[slug];

  if (!presentation) {
    return undefined;
  }

  return `${resolvePrimaryFormulaForProjection(presentation.canonicalId).expression}${presentation.suffix}`;
}

const REVIEW_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function formatCanonicalReviewDate(reviewDate: string): string {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(reviewDate);

  if (!parts) {
    throw new Error(`Canonical review date must use YYYY-MM-DD format: ${reviewDate}`);
  }

  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    month < 1 ||
    month > REVIEW_MONTHS.length ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Canonical review date is invalid: ${reviewDate}`);
  }

  return `${REVIEW_MONTHS[month - 1]} ${day}, ${year}`;
}

function getKpiCalculatorEditorial(
  slug: (typeof tools)[number]["slug"],
  content: KpiCalculatorContent | undefined
): ResolvedKpiCalculatorEditorial | undefined {
  if (!content) {
    return undefined;
  }

  const knowledgeObjectId =
    slug === "airbnb-adr-calculator"
      ? ADR_KNOWLEDGE_OBJECT_ID
      : slug === "airbnb-revpar-calculator"
        ? REVPAR_KNOWLEDGE_OBJECT_ID
        : slug === "airbnb-occupancy-calculator"
          ? OCCUPANCY_KNOWLEDGE_OBJECT_ID
          : undefined;

  if (!knowledgeObjectId) {
    return undefined;
  }

  const knowledgeObject = getKnowledgeObject(knowledgeObjectId);
  const reviewDate = knowledgeObject?.identity.reviewDate;
  const owner = knowledgeObject?.identity.owner;
  const calculatorName =
    slug === "airbnb-adr-calculator"
      ? "ADR"
      : slug === "airbnb-revpar-calculator"
        ? "RevPAR"
        : "Occupancy";

  if (!knowledgeObject || !owner || !reviewDate) {
    throw new Error(`The canonical ${calculatorName} knowledge object must be available and reviewed.`);
  }

  return {
    ...content.editorial,
    owner,
    reviewedOn: {
      iso: reviewDate,
      display: formatCanonicalReviewDate(reviewDate),
    },
  };
}

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
    convention: {
      included:
        "Norixo calculates ADR as accommodation revenue divided by booked nights. Use revenue and booked nights from the same period so the result describes one consistent window of performance.",
      excluded:
        "Keep taxes, refundable deposits and platform commissions separate from accommodation revenue. Cleaning fees need a consistent treatment: exclude them for every period, or include them for every period if that is the convention used in your records.",
      comparable:
        "Compare ADR only when the date range, revenue treatment and booking scope are the same. Platforms and data providers can use different revenue conventions, so their figures may not be directly comparable to this calculation.",
      limitation:
        "ADR alone does not measure occupancy, revenue per available night or net profitability.",
    },
    decision: {
      metricName: "ADR",
      cannotTell:
        "A high ADR can sit alongside low occupancy. It does not show total revenue across the period, net margin or operating costs, so it cannot describe financial performance on its own.",
      relatedKpis: [
        {
          href: "/tools/airbnb-occupancy-calculator",
          label: "Calculate your occupancy rate",
          explanation: "to see how much of the available calendar converted into bookings.",
        },
        {
          href: "/tools/airbnb-revpar-calculator",
          label: "Understand revenue per available night",
          explanation: "to connect the achieved rate to available nights.",
        },
      ],
    },
    editorial: {
      methodology:
        "Norixo uses accommodation revenue divided by booked nights. Enter revenue and booked nights from the same measurement period. For comparisons, apply the same treatment to cleaning fees, taxes, deposits and commissions in every period. This is Norixo’s calculator convention, not a universal provider standard: data sources can define revenue differently, so results should be reconciled before they are compared.",
      claims: [
        {
          text:
            "AirDNA defines ADR as total revenue divided by booked nights. Its own methodology includes host-set cleaning fees while excluding Airbnb service fees, illustrating that an ADR definition depends on the revenue components selected.",
          source: {
            name: "AirDNA: How does AirDNA calculate ADR?",
            href: "https://help.airdna.co/en/articles/8062173-how-does-airdna-calculate-average-daily-rate-adr",
          },
        },
        {
          text:
            "PriceLabs notes that PMS-supplied revenue can include different combinations of rent, fees and taxes. Its documentation therefore confirms that a provider figure may use a revenue convention different from the one used in this calculator.",
          source: {
            name: "PriceLabs: Portfolio Analytics terminology",
            href: "https://help.pricelabs.co/portal/en/kb/articles/portfolio-analytics-terminology",
          },
        },
      ],
      sources: [
        {
          name: "AirDNA: How does AirDNA calculate ADR?",
          href: "https://help.airdna.co/en/articles/8062173-how-does-airdna-calculate-average-daily-rate-adr",
        },
        {
          name: "PriceLabs: Portfolio Analytics terminology",
          href: "https://help.pricelabs.co/portal/en/kb/articles/portfolio-analytics-terminology",
        },
      ],
    },
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
    convention: {
      included:
        "Booked nights are nights reserved by paying guests. Available nights are the nights counted as open for guest bookings in the period you are measuring.",
      excluded:
        "Owner stays, blocked nights and maintenance closures may be removed from available nights when they were intentionally unavailable to guests. They are distinct from nights that were open but did not book.",
      comparable:
        "Occupancy depends on the availability convention. Some analyses exclude voluntarily unavailable nights, while others use the full calendar inventory. Compare results only when the same convention, property scope and date range are used.",
      limitation:
        "High occupancy does not necessarily mean strong financial performance if prices are too low or costs are too high.",
    },
    decision: {
      metricName: "Occupancy",
      cannotTell:
        "A 95% occupancy rate does not necessarily mean strong profitability. It does not show the rate achieved, total revenue, operating costs or whether lower-priced nights were needed to fill the calendar.",
      relatedKpis: [
        {
          href: "/tools/airbnb-adr-calculator",
          label: "Measure your average daily rate",
          explanation: "to see the accommodation revenue earned on booked nights.",
        },
        {
          href: "/tools/airbnb-revpar-calculator",
          label: "Compare pricing and occupancy with RevPAR",
          explanation: "to combine rate and calendar utilisation in one measure.",
        },
      ],
    },
    editorial: {
      methodology:
        "Norixo uses booked nights divided by available nights. Available nights are the nights included in the sellable inventory for the selected period. Owner stays, maintenance closures and other blocked dates need a consistent availability treatment. This calculator does not claim that one inventory definition is universal: comparisons are meaningful only when the property scope, date range and availability convention are the same.",
      claims: [
        {
          text:
            "AirDNA calculates occupancy from reserved days and active listing nights. Its methodology distinguishes blocked calendar nights from guest bookings, showing why the availability definition is necessary to interpret an occupancy result.",
          source: {
            name: "AirDNA: How does AirDNA calculate occupancy rate?",
            href: "https://help.airdna.co/en/articles/8062178-how-does-airdna-calculate-occupancy-rate",
          },
        },
        {
          text:
            "PriceLabs documents total, adjusted and paid occupancy variants. Its adjusted occupancy excludes blocked nights from available inventory, while other variants use a different denominator; this demonstrates why labels alone are not enough for comparison.",
          source: {
            name: "PriceLabs: Report Builder metrics",
            href: "https://help.pricelabs.co/portal/en/kb/articles/a-complete-guide-to-report-builder-metrics",
          },
        },
      ],
      sources: [
        {
          name: "AirDNA: How does AirDNA calculate occupancy rate?",
          href: "https://help.airdna.co/en/articles/8062178-how-does-airdna-calculate-occupancy-rate",
        },
        {
          name: "PriceLabs: Report Builder metrics",
          href: "https://help.pricelabs.co/portal/en/kb/articles/a-complete-guide-to-report-builder-metrics",
        },
      ],
    },
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
    convention: {
      included:
        "Norixo calculates RevPAR as accommodation revenue divided by available nights. The revenue period must match the period used to count available nights.",
      excluded:
        "Keep the revenue definition consistent when comparing periods. Taxes, refundable deposits, cleaning fees and platform commissions can be treated differently in different records, so do not mix conventions within one comparison.",
      comparable:
        "Available nights depend on the availability convention. Removing nights from inventory changes the denominator, so compare RevPAR only when the revenue treatment, date range and inventory convention are alike.",
      limitation:
        "RevPAR combines price and occupancy, but it does not measure costs, commissions or net margin.",
      secondaryFormula: {
        formula: "RevPAR = ADR × Occupancy rate",
        explanation:
          "Use occupancy as a decimal in this formula: 70% = 0.70.",
      },
    },
    decision: {
      metricName: "RevPAR",
      cannotTell:
        "RevPAR does not show which part of performance came from pricing and which came from occupancy. It also does not measure costs, commissions or net margin.",
      scenario: {
        title: "Why ADR alone can mislead",
        properties: [
          { name: "Property A", adr: "€220", occupancy: "35%", revpar: "€77" },
          { name: "Property B", adr: "€145", occupancy: "70%", revpar: "€102" },
        ],
        explanation:
          "Property A achieves the higher ADR, but Property B earns more per available night because its lower rate is paired with stronger occupancy.",
      },
      relatedKpis: [
        {
          href: "/tools/airbnb-adr-calculator",
          label: "Compare ADR with RevPAR",
          explanation: "to see the rate earned on nights that booked.",
        },
        {
          href: "/tools/airbnb-occupancy-calculator",
          label: "Calculate your occupancy rate",
          explanation: "to see how much of the available calendar was booked.",
        },
      ],
    },
    editorial: {
      methodology:
        "Norixo uses accommodation revenue divided by available nights. Revenue and availability must describe the same period. For comparisons, keep both the revenue treatment and the inventory convention consistent, including how unavailable dates are handled. This calculator reports a transparent formula for the values entered; it does not reconcile provider-specific definitions of revenue, availability or blocked inventory.",
      claims: [
        {
          text:
            "AirDNA documents daily and monthly RevPAR as revenue divided by the relevant available inventory for the same period. Its daily and monthly definitions make the measurement period and availability denominator explicit.",
          source: {
            name: "AirDNA: What is RevPAR?",
            href: "https://help.airdna.co/en/articles/8062179-what-is-revpar",
          },
        },
        {
          text:
            "PriceLabs documents both RevPAR as revenue divided by non-blocked nights and RevPAR as ADR multiplied by occupancy. These equivalent expressions show why a consistent revenue and inventory convention is required before comparing RevPAR values.",
          source: {
            name: "PriceLabs: Report Builder metrics",
            href: "https://help.pricelabs.co/portal/en/kb/articles/a-complete-guide-to-report-builder-metrics",
          },
        },
      ],
      sources: [
        {
          name: "AirDNA: What is RevPAR?",
          href: "https://help.airdna.co/en/articles/8062179-what-is-revpar",
        },
        {
          name: "PriceLabs: Report Builder metrics",
          href: "https://help.pricelabs.co/portal/en/kb/articles/a-complete-guide-to-report-builder-metrics",
        },
      ],
    },
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

function buildToolNextSteps(tool: (typeof tools)[number]): {
  title: string;
  description: string;
  resources: ToolNextResource[];
} | null {
  const guideBySlug = (guideSlug: string) =>
    guides.find((guide) => guide.slug === guideSlug);
  const articleBySlug = (articleSlug: string) =>
    articles.find((article) => article.slug === articleSlug);

  if (tool.slug === "airbnb-adr-calculator") {
    const pricingGuide = guideBySlug("airbnb-pricing-optimization");
    const adrArticle = articleBySlug("airbnb-adr");

    return {
      title: "Go deeper on pricing decisions",
      description:
        "Use the ADR calculator for the metric, then use these resources for the pricing strategy and editorial context behind it.",
      resources: [
        adrArticle
          ? {
              href: `/articles/${adrArticle.slug}`,
              eyebrow: "Article",
              title: adrArticle.title,
              description: adrArticle.description,
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
      ].filter((resource): resource is ToolNextResource => Boolean(resource)),
    };
  }

  if (tool.slug === "airbnb-pricing-calculator") {
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
        occupancyArticle
          ? {
              href: `/articles/${occupancyArticle.slug}`,
              eyebrow: "Article",
              title: occupancyArticle.title,
              description: occupancyArticle.description,
            }
          : null,
        revenueGuide
          ? {
              href: `/guides/${revenueGuide.slug}`,
              eyebrow: "Guide",
              title: revenueGuide.title,
              description: revenueGuide.description,
            }
          : null,
      ].filter((resource): resource is ToolNextResource => Boolean(resource)),
    };
  }

  if (tool.slug === "airbnb-revpar-calculator") {
    const revenueGuide = guideBySlug("airbnb-revenue-optimization");
    const revparArticle = articleBySlug("airbnb-revpar");

    return {
      title: "Go deeper on revenue performance",
      description:
        "Use the RevPAR calculator for the metric, then use these resources for revenue strategy and longer-form analysis.",
      resources: [
        revparArticle
          ? {
              href: `/articles/${revparArticle.slug}`,
              eyebrow: "Article",
              title: revparArticle.title,
              description: revparArticle.description,
            }
          : null,
        revenueGuide
          ? {
              href: `/guides/${revenueGuide.slug}`,
              eyebrow: "Guide",
              title: revenueGuide.title,
              description: revenueGuide.description,
            }
          : null,
      ].filter((resource): resource is ToolNextResource => Boolean(resource)),
    };
  }

  if (tool.slug === "airbnb-revenue-calculator") {
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
  const kpiEditorial = getKpiCalculatorEditorial(tool.slug, kpiContent);
  const canonicalFormulaDescription = getKpiCalculatorFormulaDescription(tool.slug);
  const calculatorTool = canonicalFormulaDescription
    ? { ...tool, formulaDescription: canonicalFormulaDescription }
    : tool;
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
      ...(kpiEditorial
        ? {
            author: {
              "@type": "Organization",
              name: kpiEditorial.owner,
            },
            dateModified: kpiEditorial.reviewedOn.iso,
            citation: kpiEditorial.sources.map((source) => ({
              "@type": "CreativeWork",
              name: source.name,
              url: source.href,
            })),
          }
        : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: displayedFaq.map((item) => ({
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
          name: "Tools",
          item: "https://norixo.io/tools",
        },
        {
          "@type": "ListItem",
          position: 3,
          name: tool.title,
          item: `https://norixo.io/tools/${tool.slug}`,
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
        <Calculator tool={calculatorTool} />
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

              <div className="mt-7 border-t border-[#10231F]/10 pt-7">
                <h2 className="text-2xl font-semibold">Calculation convention</h2>
                <dl className="mt-5 space-y-5 text-sm leading-6 text-[#4C5C55]">
                  <div>
                    <dt className="font-semibold text-[#10231F]">What is included?</dt>
                    <dd className="mt-1">{kpiContent.convention.included}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-[#10231F]">What is excluded?</dt>
                    <dd className="mt-1">{kpiContent.convention.excluded}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-[#10231F]">When is the result comparable?</dt>
                    <dd className="mt-1">{kpiContent.convention.comparable}</dd>
                  </div>
                  {kpiContent.convention.secondaryFormula ? (
                    <div className="rounded-2xl bg-[#FAF7F2] p-4">
                      <dt className="font-semibold text-[#10231F]">
                        {kpiContent.convention.secondaryFormula.formula}
                      </dt>
                      <dd className="mt-1">
                        {kpiContent.convention.secondaryFormula.explanation}
                      </dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="font-semibold text-[#10231F]">What can this metric not tell you?</dt>
                    <dd className="mt-1">{kpiContent.convention.limitation}</dd>
                  </div>
                </dl>
              </div>
            </section>

            <section className="rounded-3xl border border-[#10231F]/10 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-semibold">What this metric cannot tell you</h2>
              <p className="mt-4 leading-7 text-[#4C5C55]">
                {kpiContent.decision.cannotTell}
              </p>

              {kpiContent.decision.scenario ? (
                <div className="mt-7 rounded-2xl bg-[#FAF7F2] p-4">
                  <h3 className="font-semibold text-[#10231F]">
                    {kpiContent.decision.scenario.title}
                  </h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {kpiContent.decision.scenario.properties.map((property) => (
                      <div key={property.name} className="rounded-xl bg-white p-4 text-sm">
                        <p className="font-semibold text-[#10231F]">{property.name}</p>
                        <dl className="mt-3 space-y-1 text-[#4C5C55]">
                          <div className="flex justify-between gap-4">
                            <dt>ADR</dt>
                            <dd>{property.adr}</dd>
                          </div>
                          <div className="flex justify-between gap-4">
                            <dt>Occupancy</dt>
                            <dd>{property.occupancy}</dd>
                          </div>
                          <div className="flex justify-between gap-4">
                            <dt>RevPAR</dt>
                            <dd>{property.revpar}</dd>
                          </div>
                        </dl>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-sm leading-6 text-[#4C5C55]">
                    {kpiContent.decision.scenario.explanation}
                  </p>
                </div>
              ) : null}

              <h2 className="mt-7 text-2xl font-semibold">
                When should you use {kpiContent.decision.metricName}?
              </h2>
              <p className="mt-4 leading-7 text-[#4C5C55]">{kpiContent.whenToUse}</p>

              <h2 className="mt-7 text-2xl font-semibold">
                Which KPI should you combine with {kpiContent.decision.metricName}?
              </h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-[#4C5C55]">
                {kpiContent.decision.relatedKpis.map((relatedKpi) => (
                  <li key={relatedKpi.href}>
                    <Link
                      href={relatedKpi.href}
                      className="font-semibold text-[#10231F] underline-offset-4 hover:underline"
                    >
                      {relatedKpi.label}
                    </Link>{" "}
                    {relatedKpi.explanation}
                  </li>
                ))}
              </ul>

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

      {kpiEditorial ? (
        <section className="mx-auto max-w-5xl px-6 pb-12">
          <div className="rounded-3xl border border-[#10231F]/10 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold">Methodology and sources</h2>
            <p className="mt-4 leading-7 text-[#4C5C55]">
              {kpiEditorial.methodology}
            </p>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-[#4C5C55]">
              {kpiEditorial.claims.map((claim) => (
                <li key={claim.source.href}>
                  {claim.text}{" "}
                  <a
                    href={claim.source.href}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-[#10231F] underline-offset-4 hover:underline"
                  >
                    [{claim.source.name}]
                  </a>
                </li>
              ))}
            </ul>
            <div className="mt-6 border-t border-[#10231F]/10 pt-5">
              <h3 className="font-semibold">Sources</h3>
              <ul className="mt-3 space-y-2 text-sm text-[#4C5C55]">
                {kpiEditorial.sources.map((source) => (
                  <li key={source.href}>
                    <a
                      href={source.href}
                      target="_blank"
                      rel="noreferrer"
                      className="underline-offset-4 hover:text-[#10231F] hover:underline"
                    >
                      {source.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <p className="mt-6 text-sm text-[#5F6F68]">
              Editorial owner: {kpiEditorial.owner} · Last reviewed: {kpiEditorial.reviewedOn.display}
            </p>
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-5xl px-6">
        <EEAT updated={kpiEditorial?.reviewedOn.display ?? "June 2026"} />
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
        {!kpiContent && relatedGuides.length > 0 ? (
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
