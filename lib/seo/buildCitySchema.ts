export type CitySchemaInput = {
  city: {
    slug: string;
    name: string;
    country: string;
  };
  baseUrl: string;
};

/**
 * Build deterministic JSON-LD schema objects for a city-based Airbnb optimization page.
 */
export function buildCitySchema(input: CitySchemaInput): Record<string, unknown>[] {
  const { city, baseUrl } = input;
  const canonicalUrl = `${baseUrl.replace(/\/$/, "")}/airbnb-optimizer/${city.slug}`;

  const pageTitle = `Airbnb Listing Optimization Guide for ${city.name}`;
  const pageDescription = `Learn how to optimize your Airbnb listing in ${city.name}, ${city.country} to improve bookings and overall listing performance.`;

  const webPage: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: pageTitle,
    description: pageDescription,
    url: canonicalUrl,
    mainEntity: {
      "@type": "Thing",
      name: `${city.name} Airbnb listing optimization guide`,
    },
  };

  const faqPage: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `How can I improve my Airbnb listing performance in ${city.name}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Focus on your first photos, opening description and amenity list. Guests comparing places in ${city.name} quickly scan for a strong first image, a clear explanation of who the listing is for, and the essentials they expect for their stay.`,
        },
      },
      {
        "@type": "Question",
        name: `Do better photos really increase bookings in ${city.name}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Yes. High-quality photos with a strong cover image are one of the main drivers of clicks and bookings in ${city.name}. Reordering your gallery to highlight light, space and unique features can significantly improve listing performance.`,
        },
      },
      {
        "@type": "Question",
        name: `How should I price my Airbnb in ${city.name}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Start by looking at similar listings in ${city.name} with comparable size, location and amenities. Your nightly rate should feel aligned with those options, while your photos and description clearly justify any premium you charge.`,
        },
      },
      {
        "@type": "Question",
        name: `Can a listing optimization tool help increase bookings in ${city.name}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `A dedicated optimization tool can audit your listing for ${city.name}, benchmark it against similar homes and provide an actionable checklist to improve conversion, photos, copy and pricing.`,
        },
      },
    ],
  };

  const softwareApplication: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Listing Conversion Optimizer",
    applicationCategory: "MarketingApplication",
    operatingSystem: "Web",
    url: `${baseUrl.replace(/\/$/, "")}/analyze`,
    description:
      "Listing Conversion Optimizer is a web-based SaaS tool that audits Airbnb listings, benchmarks them against competitors and recommends changes to improve bookings.",
  };

  const breadcrumbList: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: baseUrl.replace(/\/$/, ""),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Airbnb Optimizer",
        item: `${baseUrl.replace(/\/$/, "")}/airbnb-optimizer`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: city.name,
        item: canonicalUrl,
      },
    ],
  };

  return [webPage, faqPage, softwareApplication, breadcrumbList];
}
