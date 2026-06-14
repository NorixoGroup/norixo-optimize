import type { MetadataRoute } from "next";

import { cities } from "@/data/cities";
import { countries } from "@/data/countries";

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


  for (const country of countries) {
    entries.push({
      url: `${publicSiteUrl}/countries/${country.slug}`,
      lastModified,
    });
  }

  return entries;
}
