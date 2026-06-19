export type Locale = "en" | "fr" | "es" | "it" | "pt" | "nl" | "de" | "ja" | "zh" | "ko" | "ar";

export const defaultLocale: Locale = "en";

export const locales: {
  code: Locale;
  label: string;
  nativeLabel: string;
  flag: string;
}[] = [
  {
    code: "en",
    label: "English",
    nativeLabel: "English",
    flag: "🇬🇧",
  },
  {
    code: "fr",
    label: "French",
    nativeLabel: "Français",
    flag: "🇫🇷",
  },
  {
    code: "es",
    label: "Spanish",
    nativeLabel: "Español",
    flag: "🇪🇸",
  },
  {
    code: "it",
    label: "Italian",
    nativeLabel: "Italiano",
    flag: "🇮🇹",
  },
  {
    code: "pt",
    label: "Portuguese",
    nativeLabel: "Português",
    flag: "🇵🇹",
  },
  {
    code: "nl",
    label: "Dutch",
    nativeLabel: "Nederlands",
    flag: "🇳🇱",
  },
  {
    code: "de",
    label: "German",
    nativeLabel: "Deutsch",
    flag: "🇩🇪",
  },
  {
    code: "ja",
    label: "Japanese",
    nativeLabel: "日本語",
    flag: "🇯🇵",
  },
  {
    code: "zh",
    label: "Chinese",
    nativeLabel: "简体中文",
    flag: "🇨🇳",
  },
  {
    code: "ko",
    label: "Korean",
    nativeLabel: "한국어",
    flag: "🇰🇷",
  },
  {
    code: "ar",
    label: "Arabic",
    nativeLabel: "العربية",
    flag: "🇸🇦",
  },
];

export function isLocale(value: string): value is Locale {
  return locales.some((locale) => locale.code === value);
}

export type BaseLocale = "en" | "fr" | "es";

export function toBaseLocale(locale: Locale): BaseLocale {
  return locale === "fr" || locale === "es" ? locale : "en";
}
