import type { Metadata } from "next";
import type { Solution } from "@/data/solutions";

const solutionMetaDescriptions: Record<string, string> = {
  "airbnb-seo":
    "Airbnb SEO software for hosts who want clearer visibility signals and structured listing, pricing, and content recommendations.",
  "airbnb-listing-optimization":
    "Optimize Airbnb titles, photos, descriptions, amenities, pricing, and trust signals with Norixo's listing optimization software.",
  "airbnb-pricing-optimization":
    "Airbnb pricing optimization software that helps hosts benchmark local competition, improve positioning, and make smarter nightly rate decisions.",
  "airbnb-listing-audit":
    "Airbnb listing audit software that highlights pricing gaps, weak photos, unclear copy, and conversion risks so hosts know what to review first.",
  "airbnb-revenue-optimization":
    "Airbnb revenue optimization software that connects pricing, positioning, occupancy, and conversion signals to help hosts assess revenue opportunities.",
  "airbnb-conversion-optimization":
    "Airbnb conversion optimization software for identifying listing factors that can affect booking decisions, including photos, trust signals, positioning, and content clarity.",
};

export function buildSolutionMetadata(solution: Solution): Metadata {
  const title = `${solution.title} Software | Norixo`;
  const description = solutionMetaDescriptions[solution.slug] ?? solution.description;
  const url = `https://norixo.io/solutions/${solution.slug}`;

  return {
    title,
    description,
    keywords: [
      solution.title,
      `${solution.title} software`,
      `${solution.title} tool`,
      "Airbnb optimization software",
      "Airbnb listing audit",
      "Airbnb SEO tool",
      "Airbnb pricing optimization",
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
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}
