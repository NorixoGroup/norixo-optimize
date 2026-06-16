import { locales, defaultLocale, type Locale } from "@/data/i18n";
import { buildLocalizedUrl } from "./seoUrls";

export function buildHreflangAlternates(path: string) {
  const languages: Record<string, string> = {};

  for (const locale of locales) {
    languages[locale.code] = buildLocalizedUrl(path, locale.code as Locale);
  }

  languages["x-default"] = buildLocalizedUrl(path, defaultLocale);

  return {
    canonical: buildLocalizedUrl(path, defaultLocale),
    languages,
  };
}
