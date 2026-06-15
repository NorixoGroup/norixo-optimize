"use client";

import { usePathname, useRouter } from "next/navigation";
import { defaultLocale, locales, isLocale } from "@/data/i18n";
import { useI18n } from "@/components/i18n/I18nProvider";

function stripLocale(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  const first = parts[0];

  if (locales.some((locale) => locale.code === first)) {
    return "/" + parts.slice(1).join("/");
  }

  return pathname;
}

function getCurrentLocale(pathname: string) {
  const first = pathname.split("/").filter(Boolean)[0];
  return locales.find((locale) => locale.code === first)?.code ?? defaultLocale;
}

export default function LanguageSwitcher() {
  const pathname = usePathname();
  const router = useRouter();

  const { locale: currentLocale, setLocale } = useI18n();
  const cleanPath = stripLocale(pathname);

  function changeLocale(locale: string) {
    if (!isLocale(locale)) return;

    setLocale(locale);

    const isDashboardPath =
      pathname === "/dashboard" || pathname.startsWith("/dashboard/");

    if (isDashboardPath) {
      return;
    }

    const nextPath =
      locale === defaultLocale
        ? cleanPath || "/"
        : `/${locale}${cleanPath === "/" ? "" : cleanPath}`;

    router.push(nextPath);
  }

  return (
    <label className="block">
      <span className="sr-only">Language</span>

      <select
        value={currentLocale}
        onChange={(event) => changeLocale(event.target.value)}
        className="h-9 min-w-[132px] rounded-full border border-cyan-300/35 bg-[var(--nk-gradient-main)] px-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-50 shadow-[0_10px_24px_rgba(30,64,175,0.28)] outline-none transition hover:border-cyan-200/60 focus:ring-2 focus:ring-cyan-400/30"
      >
        {locales.map((locale) => (
          <option key={locale.code} value={locale.code}>
            {locale.flag} {locale.code.toUpperCase()}
          </option>
        ))}
      </select>
    </label>
  );
}
