import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FreeAuditContent } from "@/app/free-audit/FreeAuditContent";
import { getFreeAuditSeoCopy } from "@/app/free-audit/freeAuditTranslations";
import { defaultLocale, isLocale } from "@/data/i18n";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";
import { getSeoLocaleConfig } from "@/lib/seo/seoLocales";
import { buildLocalizedUrl } from "@/lib/seo/seoUrls";

type Props = {
  params: Promise<{
    locale: string;
  }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  if (!isLocale(locale) || locale === defaultLocale) {
    return {};
  }

  const metadataCopy = getFreeAuditSeoCopy(locale);
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
