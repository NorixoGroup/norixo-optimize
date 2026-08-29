"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import { defaultLocale, type Locale } from "@/data/i18n";

function normalizeNorixoBrand(value: unknown): unknown {
  if (typeof value === "string") {
    return value
      .replaceAll("Listing Conversion Optimizer", "Norixo")
      .replaceAll("Norixo Optimize", "Norixo");
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeNorixoBrand(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        normalizeNorixoBrand(item),
      ]),
    );
  }

  return value;
}

export function useTranslation<T extends Partial<Record<Locale, unknown>>>(dictionary: T) {
  const { locale } = useI18n();
  const resolvedLocale = dictionary[locale] ? locale : defaultLocale;
  const resolvedCopy = dictionary[resolvedLocale] ?? dictionary[defaultLocale];

  return {
    locale: resolvedLocale,
    copy: normalizeNorixoBrand(resolvedCopy) as NonNullable<T[keyof T]>,
  };
}
