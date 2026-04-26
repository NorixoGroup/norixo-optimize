import type { MetadataRoute } from "next";

const publicSiteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://norixo-optimize.vercel.app"
).replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dashboard/", "/onboarding/"],
    },
    sitemap: `${publicSiteUrl}/sitemap.xml`,
  };
}
