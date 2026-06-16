import type { Metadata } from "next";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";
import type { Article } from "@/data/articles";

export function buildArticleMetadata(article: Article): Metadata {
  const title = `${article.title} | Norixo`;
  const description = article.description;
  const url = `https://norixo.io/articles/${article.slug}`;

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
    alternates: buildHreflangAlternates(`/articles/${article.slug}`),
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
