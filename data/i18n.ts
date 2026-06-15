export type Locale = "en" | "fr" | "es";

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
];

export function isLocale(value: string): value is Locale {
  return locales.some((locale) => locale.code === value);
}
