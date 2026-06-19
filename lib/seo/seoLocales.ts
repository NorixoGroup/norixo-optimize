import { defaultLocale, locales, type Locale } from "@/data/i18n";

export const seoLocales = locales.map((locale) => locale.code);

export const seoDefaultLocale = defaultLocale;

export const seoLocaleConfig: Record<
  Locale,
  {
    htmlLang: string;
    ogLocale: string;
  }
> = {
  en: {
    htmlLang: "en",
    ogLocale: "en_US",
  },
  fr: {
    htmlLang: "fr",
    ogLocale: "fr_FR",
  },
  es: {
    htmlLang: "es",
    ogLocale: "es_ES",
  },
  de: {
    htmlLang: "de",
    ogLocale: "de_DE",
  },
  it: {
    htmlLang: "it",
    ogLocale: "it_IT",
  },
  pt: {
    htmlLang: "pt",
    ogLocale: "pt_PT",
  },
  nl: {
    htmlLang: "nl",
    ogLocale: "nl_NL",
  },
  ja: {
    htmlLang: "ja",
    ogLocale: "ja_JP",
  },
  zh: {
    htmlLang: "zh-CN",
    ogLocale: "zh_CN",
  },
  ko: {
    htmlLang: "ko",
    ogLocale: "ko_KR",
  },
  ar: {
    htmlLang: "ar",
    ogLocale: "ar_SA",
  },
};

export function getSeoLocaleConfig(locale: Locale) {
  return seoLocaleConfig[locale] ?? seoLocaleConfig[seoDefaultLocale];
}
