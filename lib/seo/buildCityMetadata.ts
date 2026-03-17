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
  const canonical = `${normalizedBaseUrl}/airbnb-optimizer/${city.slug}`;

  const title = `Airbnb Listing Optimization Guide for ${city.name} | Listing Conversion Optimizer`;

  const description = `Learn how to optimize your Airbnb listing in ${city.name}, ${city.country}, compare with local competitors, and improve bookings with actionable optimization recommendations.`;

  const openGraph = {
    title,
    description,
    url: canonical,
    type: "website",
  };

  const twitter = {
    card: "summary_large_image" as const,
    title,
    description,
  };

  const keywords = [
    `airbnb optimization ${city.name}`,
    `airbnb listing tips ${city.name}`,
    `improve airbnb bookings ${city.name}`,
    `airbnb listing audit ${city.name}`,
  ];

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph,
    twitter,
    keywords,
  };
}
