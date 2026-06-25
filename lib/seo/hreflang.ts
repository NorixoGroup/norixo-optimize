import { locales, defaultLocale, type Locale } from "@/data/i18n";
import { buildLocalizedUrl } from "./seoUrls";

type BuildHreflangAlternatesOptions = {
  locales?: Locale[];
};

export function buildHreflangAlternates(
  path: string,
  options?: BuildHreflangAlternatesOptions,
) {
  const languages: Record<string, string> = {};
  const allowedLocales = options?.locales ?? locales.map((locale) => locale.code);

  for (const locale of allowedLocales) {
    languages[locale] = buildLocalizedUrl(path, locale);
  }

  languages["x-default"] = buildLocalizedUrl(path, defaultLocale);

  return {
    canonical: buildLocalizedUrl(path, defaultLocale),
    languages,
  };
}
