import type { Metadata } from "next";
import type { Country } from "@/data/countries";

export function buildCountryMetadata(country: Country): Metadata {
  const title = `Airbnb Optimizer ${country.name} | Listing SEO, Pricing & Audit Tool`;
  const description = `Optimize your Airbnb listing in ${country.name} with Norixo. Improve pricing, photos, description, SEO, guest trust, and conversion using a structured listing audit.`;
  const url = `https://norixo.io/countries/${country.slug}`;

  return {
    title,
    description,
    keywords: [
      `Airbnb Optimizer ${country.name}`,
      `Airbnb SEO ${country.name}`,
      `Airbnb Pricing ${country.name}`,
      `Airbnb Listing Optimization ${country.name}`,
      `Airbnb Listing Audit ${country.name}`,
      "Airbnb optimization tool",
      "Airbnb revenue optimization",
    ],
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: "Norixo",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}
