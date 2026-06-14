import type { Metadata } from "next";
import type { Solution } from "@/data/solutions";

export function buildSolutionMetadata(solution: Solution): Metadata {
  const title = `${solution.title} Software | Norixo`;
  const description = solution.description;
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
