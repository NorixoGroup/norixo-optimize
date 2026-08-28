import type { Metadata } from "next";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";
import { defaultLocale } from "@/data/i18n";
import type { Article } from "@/data/articles";

const articleDescriptionOverrides: Record<string, string> = {
  "how-airbnb-seo-works":
    "Learn how hosts can review Airbnb relevance, pricing, photos, reviews, amenities, availability, and guest-facing signals without treating them as a guaranteed ranking formula.",
  "airbnb-search-ranking-factors":
    "Review public and observable factors that may shape Airbnb search eligibility and guest response, while keeping private ranking weights and outcomes explicitly uncertain.",
  "airbnb-listing-visibility":
    "Review the listing and market conditions that can affect Airbnb search eligibility, relevance, presentation, and guest understanding without promising visibility gains.",
  "airbnb-search-algorithm":
    "A practical, bounded explanation of Airbnb search using public and observable listing signals without claiming access to Airbnb's private ranking logic.",
};

export function buildArticleMetadata(article: Article): Metadata {
  const title = `${article.title} | Norixo`;
  const description = articleDescriptionOverrides[article.slug] ?? article.description;
  const url = `https://norixo.io/articles/${article.slug}`;
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
      article.title,
      article.cluster,
      "Airbnb SEO",
      "Airbnb optimization",
      "Airbnb ranking",
      "Airbnb listing visibility",
      "Norixo",
    ],
    alternates: buildHreflangAlternates(`/articles/${article.slug}`, {
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
