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
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  const canonicalUrl = `${normalizedBaseUrl}/airbnb-optimizer/${city.slug}`;

  const pageTitle = `Airbnb Listing Optimization Guide for ${city.name}`;
  const pageDescription = `Learn how to optimize your Airbnb listing in ${city.name}, ${city.country} by reviewing listing quality, market positioning and booking friction.`;

  const webPage: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${canonicalUrl}#webpage`,
    name: pageTitle,
    description: pageDescription,
    url: canonicalUrl,
    isPartOf: {
      "@id": `${normalizedBaseUrl}/#website`,
    },
    publisher: {
      "@id": `${normalizedBaseUrl}/#organization`,
    },
    about: {
      "@id": `${normalizedBaseUrl}/#software`,
    },
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
          text: `Review the first photos, opening description, amenities, pricing context and trust signals. Guests comparing places in ${city.name} need to understand quickly what the listing offers and how it differs from nearby alternatives.`,
        },
      },
      {
        "@type": "Question",
        name: `Do better photos help an Airbnb listing in ${city.name}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Photos shape the first impression guests get when comparing listings in ${city.name}. A clear cover image and a well-ordered gallery can make the property easier to understand before guests read the full description.`,
        },
      },
      {
        "@type": "Question",
        name: `How should I price my Airbnb in ${city.name}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Compare similar listings in ${city.name} with relevant property type, location and amenities, then review whether your presentation and trust signals support the price position you choose.`,
        },
      },
      {
        "@type": "Question",
        name: `Can a listing optimization tool help with an Airbnb in ${city.name}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `A listing optimization tool can help organize listing and market signals, identify potential friction in photos, copy, pricing and positioning, and prioritize what the host should review first.`,
        },
      },
    ],
  };

  const softwareApplication: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${normalizedBaseUrl}/#software`,
    name: "Norixo",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: normalizedBaseUrl,
    description:
      "Norixo is a web-based SaaS tool for auditing short-term-rental listings, reviewing market positioning and prioritizing listing improvements.",
    provider: {
      "@id": `${normalizedBaseUrl}/#organization`,
    },
    brand: {
      "@id": `${normalizedBaseUrl}/#organization`,
    },
  };

  const breadcrumbList: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: normalizedBaseUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Airbnb Optimizer",
        item: `${normalizedBaseUrl}/airbnb-optimizer`,
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
