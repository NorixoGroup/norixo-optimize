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
  const pageDescription = `Learn how to review and optimize your Airbnb listing in ${city.name}, ${city.country}, including photos, copy, amenities and pricing context.`;

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
        name: `What should I review when optimizing my Airbnb listing in ${city.name}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Focus on your first photos, opening description and amenity list. Guests comparing places in ${city.name} quickly scan for a strong first image, a clear explanation of who the listing is for, and the essentials they expect for their stay.`,
        },
      },
      {
        "@type": "Question",
        name: `What should I review in my listing photos for ${city.name}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Review whether your cover image and gallery clearly represent the property's light, space, layout and distinctive features. Photo order can also help guests understand the listing more quickly while comparing options in ${city.name}.`,
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
        name: `What can a listing optimization tool review for a property in ${city.name}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `A listing optimization tool can review listing presentation, photos, copy, amenities and pricing context, then organize observations and recommendations into an actionable checklist.`,
        },
      },
    ],
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

  return [webPage, faqPage, breadcrumbList];
}
