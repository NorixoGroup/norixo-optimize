import type { Metadata } from "next";
import type { ResolvedSearchEligibility } from "@/lib/seo/searchEligibility";
import type { City } from "@/data/cities";
import type { LocalSeoTopic } from "@/data/localSeo";

export function buildLocalSeoMetadata(
  city: City,
  topic: LocalSeoTopic,
  eligibility?: ResolvedSearchEligibility,
): Metadata {
  const title = `${city.name} ${topic.label} | Airbnb optimization`;
  const description = `${topic.description} Optimize Airbnb performance in ${city.name}, ${city.country}.`;
  const url = `https://norixo.io/airbnb-optimizer/${city.slug}/${topic.slug}`;
  const imageUrl = "https://norixo.io/og-cover.png";

  return {
    title,
    description,
    keywords: [
      `${city.name} ${topic.titleSuffix}`,
      `Airbnb ${city.name}`,
      `Airbnb optimization ${city.name}`,
      `Airbnb pricing ${city.name}`,
      `Airbnb SEO ${city.name}`,
      "Airbnb listing optimization",
      "Norixo",
    ],
    alternates: {
      canonical: url,
    },
    robots: {
      index: eligibility?.indexDirective !== "noindex",
      follow: true,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: "Norixo",
      type: "article",
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}
