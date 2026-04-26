import type { MetadataRoute } from "next";

import { cities } from "@/data/cities";

const publicSiteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://norixo-optimize.vercel.app"
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

  return entries;
}
