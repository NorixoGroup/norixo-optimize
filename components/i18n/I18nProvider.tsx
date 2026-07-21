"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { defaultLocale, isLocale, type Locale } from "@/data/i18n";
import { getSeoLocaleConfig } from "@/lib/seo/seoLocales";
import { usePathname } from "next/navigation";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

const I18nContext = createContext<I18nContextValue | null>(null);

const NON_LOCALIZED_HUB_PREFIXES = [
  "/guides",
  "/articles",
  "/reports",
  "/tools",
] as const;

function isNonLocalizedHubPath(pathname: string) {
  return NON_LOCALIZED_HUB_PREFIXES.some(
    (prefix) => pathname === prefix || pathname === `${prefix}/` || pathname.startsWith(`${prefix}/`),
  );
}

export function I18nProvider({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  const pathname = usePathname();
  const [locale, setLocaleState] = useState<Locale>(initialLocale ?? defaultLocale);

  useEffect(() => {
    const firstSegment = pathname.split("/").filter(Boolean)[0];

    if (isNonLocalizedHubPath(pathname)) {
      document.documentElement.lang = "en";
      document.documentElement.dir = "ltr";

      if (locale !== defaultLocale) {
        setLocaleState(defaultLocale);
      }

      return;
    }

    if (firstSegment && isLocale(firstSegment)) {
      document.documentElement.lang = getSeoLocaleConfig(firstSegment).htmlLang;
      document.documentElement.dir = firstSegment === "ar" ? "rtl" : "ltr";
      if (locale !== firstSegment) {
        setLocaleState(firstSegment);
      }
      window.localStorage.setItem("norixo-locale", firstSegment);
      return;
    }

    document.documentElement.lang = "en";
    document.documentElement.dir = "ltr";

    const savedLocale = window.localStorage.getItem("norixo-locale");

    if (savedLocale && isLocale(savedLocale) && locale !== savedLocale) {
      setLocaleState(savedLocale);
    }
  }, [pathname, locale]);

  function setLocale(nextLocale: Locale) {
    setLocaleState(nextLocale);
    window.localStorage.setItem("norixo-locale", nextLocale);
  }

  const value = useMemo(
    () => ({
      locale,
      setLocale,
    }),
    [locale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider");
  }

  return context;
}
