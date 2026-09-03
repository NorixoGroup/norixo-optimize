import type { MetadataRoute } from "next";

import { cities } from "@/data/cities";
import { defaultLocale, locales } from "@/data/i18n";
import { countries } from "@/data/countries";
import { rankings } from "@/data/rankings";
import { solutions } from "@/data/solutions";
import { tools } from "@/data/tools";
import { articles } from "@/data/articles";
import { guides } from "@/data/guides";
import { localSeoTopics } from "@/data/localSeo";
import { isCityTopicSitemapEligible } from "@/lib/seo/sitemapEligibility";
import {
  buildDefaultNextPublicationCatalog,
  buildNextSitemapEntries,
} from "@/lib/intelligencePublishing/nextWebPublicationAdapter";
import { buildLocalizedPath } from "@/lib/seo/seoUrls";

const publicSiteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://norixo.io"
).replace(/\/$/, "");

const staticPaths = [
  "/",
  "/pricing",
  "/demo",
  "/how-it-works",
  "/free-audit",
  "/booking-optimization",
  "/privacy",
  "/legal",
  "/terms",
  "/contact",
  "/research",
  "/research/methodology",
  "/guides",
  "/countries",
  "/rankings",
  "/articles",
  "/tools",
  "/reports",
  "/airbnb-optimizer",
  "/solutions",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const reportsCatalog = buildDefaultNextPublicationCatalog();
  const builtAt = new Date();
  const entries: MetadataRoute.Sitemap = staticPaths.map((path) => ({
    url: `${publicSiteUrl}${path}`,
    lastModified: builtAt,
  }));

  const localizedPublicPaths = ["/", "/pricing", "/demo", "/how-it-works", "/free-audit"] as const;

  for (const locale of locales) {
    if (locale.code === defaultLocale) continue;
    for (const path of localizedPublicPaths) {
      entries.push({
        url: `${publicSiteUrl}${buildLocalizedPath(path, locale.code)}`,
        lastModified: builtAt,
      });
    }
  }

  for (const city of cities) {
    entries.push({
      url: `${publicSiteUrl}/airbnb-optimizer/${city.slug}`,
    });
  }

  for (const city of cities) {
    for (const topic of localSeoTopics) {
      const pathname =
        `/airbnb-optimizer/${city.slug}/${topic.slug}`;

      if (!isCityTopicSitemapEligible(pathname)) {
        continue;
      }

      entries.push({
        url: `${publicSiteUrl}${pathname}`,
      });
    }
  }

  for (const country of countries) {
    entries.push({
      url: `${publicSiteUrl}/countries/${country.slug}`,
    });
  }

  for (const ranking of rankings) {
    entries.push({
      url: `${publicSiteUrl}/rankings/${ranking.slug}`,
    });
  }

  for (const article of articles) {
    entries.push({
      url: `${publicSiteUrl}/articles/${article.slug}`,
    });
  }

  for (const guide of guides) {
    entries.push({
      url: `${publicSiteUrl}/guides/${guide.slug}`,
    });
  }

  for (const solution of solutions) {
    entries.push({
      url: `${publicSiteUrl}/solutions/${solution.slug}`,
    });
  }

  for (const tool of tools) {
    entries.push({
      url: `${publicSiteUrl}/tools/${tool.slug}`,
    });
  }

  entries.push(...buildNextSitemapEntries(reportsCatalog));
  return entries;
}
