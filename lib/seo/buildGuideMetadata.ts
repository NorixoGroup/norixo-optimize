import type { Metadata } from "next";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";
import { defaultLocale } from "@/data/i18n";
import type { Guide } from "@/data/guides";

export function buildGuideMetadata(guide: Guide): Metadata {
  const title = `${guide.title} | Norixo`;
  const description = guide.description;
  const url = `https://norixo.io/guides/${guide.slug}`;

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
      "Norixo Optimize",
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
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}
