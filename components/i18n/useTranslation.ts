"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import { defaultLocale, type Locale } from "@/data/i18n";

export function useTranslation<T extends Record<Locale, unknown>>(dictionary: T) {
  const { locale } = useI18n();

  return {
    locale,
    copy: (dictionary[locale] ?? dictionary[defaultLocale]) as T[Locale],
  };
}
