import type { Metadata } from "next";
import type { City } from "@/data/cities";
import type { LocalSeoTopic } from "@/data/localSeo";

export function buildLocalSeoMetadata(city: City, topic: LocalSeoTopic): Metadata {
  const title = `${city.name} ${topic.titleSuffix} | Norixo`;
  const description = `${topic.description} Learn how to optimize Airbnb listings in ${city.name}, ${city.country}.`;
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
