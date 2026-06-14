import type { Metadata } from "next";
import type { Tool } from "@/data/tools";

export function buildToolMetadata(tool: Tool): Metadata {
  const title = `${tool.title} | Norixo`;
  const description = tool.description;
  const url = `https://norixo.io/tools/${tool.slug}`;

  return {
    title,
    description,
    keywords: [
      tool.title,
      "Airbnb calculator",
      "Airbnb revenue calculator",
      "Airbnb pricing calculator",
      "Airbnb ADR calculator",
      "Airbnb occupancy calculator",
      "Airbnb optimization tool",
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
