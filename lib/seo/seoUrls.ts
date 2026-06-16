import { defaultLocale, type Locale } from "@/data/i18n";

export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://norixo.io"
).replace(/\/$/, "");

export function normalizePath(path: string) {
  if (!path || path === "/") return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

export function buildCanonicalUrl(path: string) {
  const normalizedPath = normalizePath(path);
  return `${siteUrl}${normalizedPath === "/" ? "" : normalizedPath}`;
}

export function buildLocalizedPath(path: string, locale: Locale) {
  const normalizedPath = normalizePath(path);

  if (locale === defaultLocale) {
    return normalizedPath;
  }

  return `/${locale}${normalizedPath === "/" ? "" : normalizedPath}`;
}

export function buildLocalizedUrl(path: string, locale: Locale) {
  return buildCanonicalUrl(buildLocalizedPath(path, locale));
}
