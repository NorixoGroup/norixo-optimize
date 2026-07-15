import type { Metadata } from "next";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";
import { defaultLocale } from "@/data/i18n";
import type { Tool } from "@/data/tools";

export function buildToolMetadata(tool: Tool): Metadata {
  const title = `${tool.title} | Norixo`;
  const description = tool.description;
  const url = `https://norixo.io/tools/${tool.slug}`;
  const socialImage = {
    url: "/og-cover.png",
    width: 1200,
    height: 630,
    alt: title,
  };

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
    alternates: buildHreflangAlternates(`/tools/${tool.slug}`, {
      locales: [defaultLocale],
    }),
    openGraph: {
      title,
      description,
      url,
      siteName: "Norixo",
      type: "website",
      images: [socialImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [socialImage.url],
    },
  };
}
