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

  const title = `${city.name} Airbnb listing optimization — practical guide | Listing Conversion Optimizer`;

  const description = `Optimize your Airbnb listing in ${city.name}, ${city.country}: how guests compare places, what to fix first, and practical steps to improve bookings—without guesswork.`;

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
