import type { Metadata } from "next";
import type { Ranking } from "@/data/rankings";

export function buildRankingMetadata(ranking: Ranking): Metadata {
  const title = `${ranking.title} | Norixo`;
  const description = ranking.description;
  const url = `https://norixo.io/rankings/${ranking.slug}`;

  return {
    title,
    description,
    keywords: [
      ranking.title,
      "Best Airbnb cities",
      "Best Airbnb markets",
      "Airbnb investment markets",
      "Airbnb optimization",
      "Airbnb pricing",
      "Airbnb SEO",
      "Norixo",
    ],
    alternates: {
      canonical: url,
    },
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
