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
    console.log("[i18n-debug]", { pathname, locale, stored: window.localStorage.getItem("norixo-locale") });
    const firstSegment = pathname.split("/").filter(Boolean)[0];

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
