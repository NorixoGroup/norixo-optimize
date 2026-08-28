import type { Metadata } from "next";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";
import { defaultLocale } from "@/data/i18n";
import type { Guide } from "@/data/guides";

const legacyGuideDescriptions: Record<string, string> = {
  "airbnb-seo":
    "Airbnb SEO guide for reviewing listing relevance, search-facing signals, photos, pricing context, trust, and guest decision friction without promising ranking, clicks, or bookings.",
  "airbnb-listing-optimization":
    "Airbnb listing optimization guide for reviewing photos, titles, descriptions, pricing, amenities, trust signals, and competitive positioning without guaranteeing conversion or bookings.",
};

export function buildGuideMetadata(guide: Guide): Metadata {
  const title = `${guide.title} | Norixo`;
  const description = legacyGuideDescriptions[guide.slug] ?? guide.description;
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
