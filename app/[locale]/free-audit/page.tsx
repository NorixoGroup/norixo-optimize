import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FreeAuditContent } from "@/app/free-audit/FreeAuditContent";
import { defaultLocale, isLocale, type Locale } from "@/data/i18n";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";
import { getSeoLocaleConfig } from "@/lib/seo/seoLocales";
import { buildLocalizedUrl } from "@/lib/seo/seoUrls";

type Props = {
  params: Promise<{
    locale: string;
  }>;
};

const pageTitle = "Free Airbnb pricing audit: compare your price to the market | Norixo";
const pageDescription =
  "Compare your declared nightly price to aggregated market benchmarks for free, with no credit card and no scraping of your listing.";

const localizedMetadata: Partial<Record<Locale, { title: string; description: string }>> = {
  fr: {
    title: "Audit Airbnb gratuit : comparez votre prix au marche | Norixo",
    description:
      "Comparez gratuitement votre prix declare aux benchmarks agreges de votre marche, sans carte bancaire et sans scraping de votre annonce.",
  },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  if (!isLocale(locale) || locale === defaultLocale) {
    return {};
  }

  const metadataCopy = localizedMetadata[locale] ?? {
    title: pageTitle,
    description: pageDescription,
  };
  const alternates = buildHreflangAlternates("/free-audit");

  return {
    title: metadataCopy.title,
    description: metadataCopy.description,
    alternates: {
      ...alternates,
      canonical: buildLocalizedUrl("/free-audit", locale),
      languages: {
        ...alternates.languages,
        "x-default": "https://norixo.io",
      },
    },
    openGraph: {
      title: metadataCopy.title,
      description: metadataCopy.description,
      url: buildLocalizedUrl("/free-audit", locale),
      type: "website",
      locale: getSeoLocaleConfig(locale).ogLocale,
    },
    twitter: {
      card: "summary_large_image",
      title: metadataCopy.title,
      description: metadataCopy.description,
    },
  };
}

export default async function LocalizedFreeAuditPage({ params }: Props) {
  const { locale } = await params;

  if (!isLocale(locale) || locale === defaultLocale) {
    notFound();
  }

  return <FreeAuditContent />;
}
