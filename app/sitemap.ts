import type { MetadataRoute } from "next";

import { cities } from "@/data/cities";
import { countries } from "@/data/countries";
import { rankings } from "@/data/rankings";
import { articles } from "@/data/articles";
import { localSeoTopics } from "@/data/localSeo";

const publicSiteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://norixo.io"
).replace(/\/$/, "");

const staticPaths = [
  "/",
  "/pricing",
  "/demo",
  "/how-it-works",
  "/analyze",
  "/booking-optimization",
  "/privacy",
  "/legal",
  "/contact",
  "/guides",
  "/countries",
  "/rankings",
  "/articles",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const entries: MetadataRoute.Sitemap = staticPaths.map((path) => ({
    url: `${publicSiteUrl}${path}`,
    lastModified,
  }));

  for (const city of cities) {
    entries.push({
      url: `${publicSiteUrl}/airbnb-optimizer/${city.slug}`,
      lastModified,
    });
  }

  for (const city of cities) {
    for (const topic of localSeoTopics) {
      entries.push({
        url: `${publicSiteUrl}/airbnb-optimizer/${city.slug}/${topic.slug}`,
        lastModified,
      });
    }
  }


  for (const country of countries) {
    entries.push({
      url: `${publicSiteUrl}/countries/${country.slug}`,
      lastModified,
    });
  }

  for (const ranking of rankings) {
    entries.push({
      url: `${publicSiteUrl}/rankings/${ranking.slug}`,
      lastModified,
    });
  }

  for (const article of articles) {
    entries.push({
      url: `${publicSiteUrl}/articles/${article.slug}`,
      lastModified,
    });
  }


  return entries;
}
