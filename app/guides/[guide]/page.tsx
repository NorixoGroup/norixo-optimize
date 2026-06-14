import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { guides, getGuideBySlug } from "@/data/guides";
import { countries } from "@/data/countries";
import { cities } from "@/data/cities";
import { buildGuideMetadata } from "@/lib/seo/buildGuideMetadata";
import { GuideHero } from "@/components/seo/GuideHero";
import { GuideSection } from "@/components/seo/GuideSection";
import { GuideCTA } from "@/components/seo/GuideCTA";
import { GuideFAQ } from "@/components/seo/GuideFAQ";
import { RelatedGuides } from "@/components/seo/RelatedGuides";
import { RelatedCountries } from "@/components/seo/RelatedCountries";
import { RelatedCities } from "@/components/seo/RelatedCities";

type Props = {
  params: Promise<{
    guide: string;
  }>;
};

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

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: guide.title,
      description: guide.description,
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
        "@id": `https://norixo.io/guides/${guide.slug}`,
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
          name: "Guides",
          item: "https://norixo.io/guides",
        },
        {
          "@type": "ListItem",
          position: 3,
          name: guide.title,
          item: `https://norixo.io/guides/${guide.slug}`,
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
        primaryCtaLabel="Audit my Airbnb listing"
        secondaryCtaHref="/pricing"
        secondaryCtaLabel="View pricing"
      />

      <section className="mx-auto max-w-4xl px-6 pb-10">
        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <p className="text-lg leading-8 text-[#4C5C55]">{guide.intro}</p>
        </div>
      </section>

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

      <GuideCTA />

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
