import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import {
  marketReports,
  getMarketReportCity,
} from "@/data/marketReports";
import { defaultLocale } from "@/data/i18n";
import { guides } from "@/data/guides";
import { solutions } from "@/data/solutions";
import { tools } from "@/data/tools";
import { localSeoTopics } from "@/data/localSeo";
import EEAT from "@/components/seo/EEAT";
import {
  IPP_REPORT_VIEW_LOCALES,
  type IppMarketReportViewLocale,
  default as IppMarketReportView,
} from "@/components/reports/IppMarketReportView";
import {
  buildDefaultNextPublicationCatalog,
  buildNextMetadataFromPublication,
  buildNextStaticParams,
  getNextPublicationCards,
  resolveNextPublicationBySlug,
} from "@/lib/intelligencePublishing/nextWebPublicationAdapter";

const reportsCatalog = buildDefaultNextPublicationCatalog();
const reportCards = getNextPublicationCards(reportsCatalog);

type Props = {
  params: Promise<{
    report: string;
  }>;
};

export function generateStaticParams() {
  return [...buildNextStaticParams(reportsCatalog)];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { report: slug } = await params;
  const resolution = resolveNextPublicationBySlug(reportsCatalog, slug);
  if (!resolution.found) {
    return {};
  }
  return buildNextMetadataFromPublication(resolution);
}

export default async function MarketReportPage({ params }: Props) {
  const { report: slug } = await params;
  const resolution = resolveNextPublicationBySlug(reportsCatalog, slug);
  if (!resolution.found || resolution.entry == null) {
    notFound();
  }
  if (
    resolution.entry.source === "ipp_alias" &&
    resolution.redirectCandidate != null
  ) {
    permanentRedirect(resolution.redirectCandidate);
  }
  if (resolution.entry.source !== "static_legacy") {
    const manifestLocale =
      resolution.entry.manifest?.route.canonical.locale.toLowerCase() ?? null;
    if (
      manifestLocale == null ||
      !IPP_REPORT_VIEW_LOCALES.includes(
        manifestLocale as IppMarketReportViewLocale,
      )
    ) {
      notFound();
    }
    if (
      manifestLocale !== defaultLocale ||
      resolution.entry.pathname !== `/reports/${slug}`
    ) {
      permanentRedirect(resolution.entry.pathname);
    }
    const relatedCards = reportCards.filter(
      (card) => card.href !== resolution.canonicalPath,
    );
    return (
      <IppMarketReportView
        locale={manifestLocale as IppMarketReportViewLocale}
        resolution={resolution}
        relatedCards={relatedCards}
      />
    );
  }
  const report = resolution.entry.legacyReport;
  if (!report) {
    notFound();
  }

  const city = getMarketReportCity(report);

  if (!city) {
    notFound();
  }

  const relatedGuides = guides.filter((guide) =>
    [
      "airbnb-pricing-optimization",
      "airbnb-listing-optimization",
      "airbnb-photo-optimization",
      "airbnb-conversion-optimization",
    ].includes(guide.slug)
  );

  const relatedSolutions = solutions.filter((solution) =>
    [
      "airbnb-pricing-optimization",
      "airbnb-listing-optimization",
      "airbnb-conversion-optimization",
      "airbnb-listing-audit",
    ].includes(solution.slug)
  );

  const relatedTools = tools.filter((tool) =>
    [
      "airbnb-adr-calculator",
      "airbnb-occupancy-calculator",
      "airbnb-revpar-calculator",
      "airbnb-revenue-calculator",
    ].includes(tool.slug)
  );

  const relatedReports = marketReports.filter(
    (item) => item.slug !== report.slug
  ).slice(0, 4);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Report",
      name: report.title,
      description: report.description,
      url: `https://norixo.io/reports/${report.slug}`,
      publisher: {
        "@type": "Organization",
        name: "Norixo",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: report.title,
      description: report.description,
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
        "@id": `https://norixo.io/reports/${report.slug}`,
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
          name: "Reports",
          item: "https://norixo.io/reports",
        },
        {
          "@type": "ListItem",
          position: 3,
          name: report.title,
          item: `https://norixo.io/reports/${report.slug}`,
        },
      ],
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

      <section className="mx-auto max-w-5xl px-6 py-20">
        <nav className="mb-8 text-sm text-[#5F6F68]">
          <Link href="/" className="hover:text-[#10231F]">Home</Link>
          <span className="mx-2">/</span>
          <Link href="/reports" className="hover:text-[#10231F]">Reports</Link>
          <span className="mx-2">/</span>
          <span>{report.title}</span>
        </nav>

        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[#D96C3B]">
          Airbnb market report
        </p>

        <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
          {report.title}
        </h1>

        <p className="mt-6 max-w-3xl text-lg leading-8 text-[#4C5C55]">
          Practical Airbnb listing optimization guidance for hosts in {city.name}, {city.country}.
          Review positioning, listing clarity, photos, amenities, and guest
          information.
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <div className="rounded-3xl bg-[#FFF7ED] p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#D96C3B]">
            Norixo recommendation
          </p>
          <h2 className="mt-3 text-3xl font-semibold">
            What hosts should prioritize in {city.name}
          </h2>
          <p className="mt-5 leading-8 text-[#4C5C55]">
            For a listing in {city.name}, review whether its price is supported
            by photo quality, description clarity, amenities, reviews and the
            experience it presents.
          </p>
          <p className="mt-5 leading-8 text-[#4C5C55]">
            A Norixo audit helps identify whether performance is limited by
            pricing, presentation, trust signals or guest information.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-8 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#D96C3B]">
            Related Airbnb resources
          </p>
          <h2 className="mt-3 text-3xl font-semibold">
            Continue optimizing your Airbnb listing in {city.name}
          </h2>
          <p className="mt-4 leading-7 text-[#4C5C55]">
            Use these guides, tools and optimization resources to review your
            listing in more detail.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Link
            href={`/airbnb-optimizer/${city.slug}`}
            className="rounded-3xl border border-[#10231F]/10 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <h3 className="text-xl font-semibold">
              Airbnb optimizer {city.name}
            </h3>
            <p className="mt-3 leading-7 text-[#4C5C55]">
              Review the main Airbnb optimization page for {city.name}.
            </p>
          </Link>

          {localSeoTopics.slice(0, 3).map((topic) => (
            <Link
              key={topic.slug}
              href={`/airbnb-optimizer/${city.slug}/${topic.slug}`}
              className="rounded-3xl border border-[#10231F]/10 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <h3 className="text-xl font-semibold">
                {city.name} {topic.titleSuffix}
              </h3>
              <p className="mt-3 leading-7 text-[#4C5C55]">
                {topic.description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="text-3xl font-semibold">Recommended next steps</h2>

        <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {relatedGuides.map((guide) => (
            <Link
              key={guide.slug}
              href={`/guides/${guide.slug}`}
              className="rounded-2xl border border-[#10231F]/10 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <p className="font-semibold">{guide.title}</p>
              <p className="mt-2 text-sm leading-6 text-[#5F6F68]">
                {guide.description}
              </p>
            </Link>
          ))}

          {relatedSolutions.map((solution) => (
            <Link
              key={solution.slug}
              href={`/solutions/${solution.slug}`}
              className="rounded-2xl border border-[#10231F]/10 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <p className="font-semibold">{solution.title}</p>
              <p className="mt-2 text-sm leading-6 text-[#5F6F68]">
                {solution.description}
              </p>
            </Link>
          ))}

          {relatedTools.map((tool) => (
            <Link
              key={tool.slug}
              href={`/tools/${tool.slug}`}
              className="rounded-2xl border border-[#10231F]/10 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <p className="font-semibold">{tool.title}</p>
              <p className="mt-2 text-sm leading-6 text-[#5F6F68]">
                {tool.description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="text-3xl font-semibold">More Airbnb city pages</h2>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {relatedReports.map((item) => (
            <Link
              key={item.slug}
              href={`/reports/${item.slug}`}
              className="rounded-2xl border border-[#10231F]/10 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <p className="font-semibold">{item.title}</p>
              <p className="mt-2 text-sm leading-6 text-[#5F6F68]">
                {item.description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6">
        <EEAT updated="June 2026" />
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <div className="rounded-3xl bg-[#10231F] p-8 text-white md:p-10">
          <h2 className="text-3xl font-semibold">
            Audit your Airbnb listing in {city.name}
          </h2>
          <p className="mt-4 max-w-2xl leading-7 text-white/80">
            Use Norixo to review your listing’s pricing, photos, description
            quality and conversion blockers.
          </p>
          <Link
            href="/analyze"
            className="mt-6 inline-flex rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#10231F]"
          >
            Start an Airbnb audit
          </Link>
        </div>
      </section>
    </main>
  );
}
