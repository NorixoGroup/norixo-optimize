import type { Metadata } from "next";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";
import { defaultLocale } from "@/data/i18n";
import type { Guide } from "@/data/guides";

const LEGACY_GUIDE_DESCRIPTIONS: Record<string, string> = {
  "airbnb-seo":
    "A practical Airbnb SEO guide for reviewing listing relevance, presentation, pricing context, guest trust, and other observable signals that may affect how guests compare a listing.",
  "airbnb-listing-optimization":
    "A practical Airbnb listing optimization guide for reviewing photos, titles, descriptions, pricing, amenities, guest trust, and market positioning without promising ranking or booking outcomes.",
};

export function buildGuideMetadata(guide: Guide): Metadata {
  const title = `${guide.title} | Norixo`;
  const description = LEGACY_GUIDE_DESCRIPTIONS[guide.slug] ?? guide.description;
  const url = `https://norixo.io/guides/${guide.slug}`;
  const socialImage = {
    url: "/og-cover.png",
    width: 1200,
    height: 630,
    alt: title,
  };

  return {
    title,
    description,
    keywords: [
      guide.title,
      "Airbnb optimization",
      "Airbnb SEO",
      "Airbnb listing audit",
      "Airbnb pricing optimization",
      "Airbnb conversion optimization",
      "Norixo",
    ],
    alternates: buildHreflangAlternates(`/guides/${guide.slug}`, {
      locales: [defaultLocale],
    }),
    openGraph: {
      title,
      description,
      url,
      siteName: "Norixo",
      type: "article",
      images: [socialImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [socialImage.url],
    },
  };
}
