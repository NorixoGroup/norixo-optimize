import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FreeAuditListingContent } from "@/app/(default)/free-audit/FreeAuditListingContent";
import { getFreeAuditListingSeoCopy } from "@/app/(default)/free-audit/freeAuditListingSeoCopy";
import { defaultLocale, isLocale } from "@/data/i18n";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";
import { getSeoLocaleConfig } from "@/lib/seo/seoLocales";
import { buildLocalizedUrl } from "@/lib/seo/seoUrls";

type Props = {
  params: Promise<{
    locale: string;
  }>;
};

const socialImage = "/og/free-listing-audit.png";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  if (!isLocale(locale) || locale === defaultLocale) {
    return {};
  }

  const metadataCopy = getFreeAuditListingSeoCopy(locale);
  const alternates = buildHreflangAlternates("/free-audit");

  return {
    title: metadataCopy.title,
    description: metadataCopy.description,
    alternates: {
      ...alternates,
      canonical: buildLocalizedUrl("/free-audit", locale),
    },
    openGraph: {
      title: metadataCopy.title,
      description: metadataCopy.description,
      url: buildLocalizedUrl("/free-audit", locale),
      siteName: "Norixo",
      type: "website",
      locale: getSeoLocaleConfig(locale).ogLocale,
      images: [
        {
          url: socialImage,
          width: 1200,
          height: 630,
          alt: metadataCopy.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: metadataCopy.title,
      description: metadataCopy.description,
      images: [socialImage],
    },
  };
}

export default async function LocalizedFreeAuditPage({ params }: Props) {
  const { locale } = await params;

  if (!isLocale(locale) || locale === defaultLocale) {
    notFound();
  }

  return <FreeAuditListingContent />;
}
