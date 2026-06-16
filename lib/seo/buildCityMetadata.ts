import { buildHreflangAlternates } from "@/lib/seo/hreflang";
import { buildCitySeoContent } from "@/lib/seo/content/citySeoContent";

export type CityMetadataInput = {
  city: {
    slug: string;
    name: string;
    country: string;
  };
  baseUrl: string;
};

export function buildCityMetadata(input: CityMetadataInput) {
  const { city, baseUrl } = input;

  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  const path = `/airbnb-optimizer/${city.slug}`;
  const canonical = `${normalizedBaseUrl}${path}`;

  const seo = buildCitySeoContent({
    city,
    locale: "en",
  });

  const title = seo.title;
  const description = seo.description;
  const keywords = seo.keywords;

  const openGraph = {
    title,
    description,
    url: canonical,
    type: "website",
    locale: "en_US",
    siteName: "Listing Conversion Optimizer",
    images: [
      {
        url: "/og-cover.png",
        width: 1200,
        height: 630,
        alt: title,
      },
    ],
  };

  const twitter = {
    card: "summary_large_image" as const,
    title,
    description,
    images: ["/og-cover.png"],
  };

  return {
    title,
    description,
    alternates: buildHreflangAlternates(path),
    openGraph,
    twitter,
    keywords,
  };
}
