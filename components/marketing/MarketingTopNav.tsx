"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";
import { useTranslation } from "@/components/i18n/useTranslation";
import { defaultLocale, locales } from "@/data/i18n";

const marketingNavCopy = {
  en: {
    home: "Home",
    howItWorks: "How it works",
    demo: "Demo",
    pricing: "Pricing",
    signIn: "Sign in",
    openMenu: "Open menu",
    closeMenu: "Close menu",
  },
  fr: {
    home: "Accueil",
    howItWorks: "Comment ça marche",
    demo: "Démo",
    pricing: "Tarifs",
    signIn: "Se connecter",
    openMenu: "Ouvrir le menu",
    closeMenu: "Fermer le menu",
  },
  es: {
    home: "Inicio",
    howItWorks: "Cómo funciona",
    demo: "Demo",
    pricing: "Precios",
    signIn: "Iniciar sesión",
    openMenu: "Abrir menú",
    closeMenu: "Cerrar menú",
  },
  de: {
    home: "Startseite",
    howItWorks: "So funktioniert es",
    demo: "Demo",
    pricing: "Preise",
    signIn: "Anmelden",
    openMenu: "Menü öffnen",
    closeMenu: "Menü schließen",
  },
  it: {
    home: "Home",
    howItWorks: "Come funziona",
    demo: "Demo",
    pricing: "Prezzi",
    signIn: "Accedi",
    openMenu: "Apri menu",
    closeMenu: "Chiudi menu",
  },
  pt: {
    home: "Início",
    howItWorks: "Como funciona",
    demo: "Demonstração",
    pricing: "Preços",
    signIn: "Entrar",
    openMenu: "Abrir menu",
    closeMenu: "Fechar menu",
  },
  nl: {
    home: "Home",
    howItWorks: "Hoe het werkt",
    demo: "Demo",
    pricing: "Prijzen",
    signIn: "Inloggen",
    openMenu: "Menu openen",
    closeMenu: "Menu sluiten",
  },
} as const;

function stripLocale(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  const first = parts[0];

  if (locales.some((locale) => locale.code === first)) {
    return "/" + parts.slice(1).join("/");
  }

  return pathname;
}

const navItems = [
  { href: "/", key: "home" },
  { href: "/how-it-works", key: "howItWorks" },
  { href: "/demo", key: "demo" },
  { href: "/pricing", key: "pricing" },
] as const;

export function MarketingTopNav() {
  const pathname = usePathname();
  const { copy, locale } = useTranslation(marketingNavCopy);
  const cleanPath = stripLocale(pathname);
  const localePrefix = locale === defaultLocale ? "" : `/${locale}`;

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 px-0">
        <div className="w-full">
          <div className="relative flex items-center justify-between h-[64px] px-6 rounded-none border border-white/10 bg-[linear-gradient(180deg,rgba(2,6,23,0.75)_0%,rgba(2,6,23,0.55)_100%)] backdrop-blur-xl shadow-[0_20px_60px_rgba(2,6,23,0.65)] before:absolute before:inset-0 before:rounded-none before:bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.12),transparent_70%)] before:pointer-events-none">
            <div className="flex items-center gap-3 shrink-0">
              <Link href="/" className="flex items-center gap-3">
                <Image
                  src="/brand/norixo-logo-mark.png"
                  alt="Norixo"
                  width={36}
                  height={36}
                  className="h-9 w-auto"
                  priority
                />
                <div className="flex flex-col justify-center leading-tight">
                  <div className="flex items-center gap-0.5">
                    <span className="bg-gradient-to-r from-indigo-500 via-blue-400 to-cyan-400 bg-clip-text text-[26px] font-semibold leading-none tracking-[-0.04em] text-transparent drop-shadow-[0_0_14px_rgba(59,130,246,0.28)]">
                      N
                    </span>

                    <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-indigo-400 bg-clip-text text-[18px] font-semibold tracking-[0.08em] text-transparent drop-shadow-[0_0_16px_rgba(59,130,246,0.24)]">
                      ORIXO
                    </span>
                  </div>
                  <span className="text-xs tracking-wide text-white/70">Optimizer</span>
                </div>
              </Link>
            </div>

            <div className="hidden md:flex items-center justify-center flex-1">
              <nav className="flex items-center gap-6 text-[11px] font-bold uppercase tracking-[0.16em]">
                {navItems.map((item) => {
                  const active =
                    cleanPath === item.href || cleanPath.startsWith(item.href + "/");

                  return (
                    <Link
                      key={item.href}
                      href={`${localePrefix}${item.href}`}
                      className={`inline-flex min-w-0 items-center justify-center leading-none whitespace-nowrap transition-all duration-200 ${
                        active
                          ? "rounded-full border border-white/15 bg-[linear-gradient(135deg,#3b82f6_0%,#06b6d4_50%,#7c3aed_100%)] px-4 py-1.5 text-white shadow-[0_12px_30px_rgba(59,130,246,0.30)]"
                          : "rounded-full border border-transparent px-3.5 py-2 text-slate-300 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {copy[item.key]}
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 md:gap-3">
              <div className="hidden sm:block">
                <LanguageSwitcher />
              </div>
              <Link
                href="/sign-in"
                className="inline-flex min-w-0 items-center justify-center leading-none whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.16em] transition-all duration-200 rounded-full border border-white/15 bg-[linear-gradient(135deg,#3b82f6_0%,#06b6d4_50%,#7c3aed_100%)] px-4 py-1.5 text-white shadow-[0_12px_30px_rgba(59,130,246,0.30)]"
              >
                {copy.signIn}
              </Link>
              <div className="flex flex-none items-center gap-3.5 md:hidden">
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen((open) => !open)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-700/80 bg-slate-900/80 text-slate-100 shadow-sm ring-1 ring-black/20 transition-colors hover:border-slate-500 hover:bg-slate-800"
                  aria-label={isMobileMenuOpen ? copy.closeMenu : copy.openMenu}
                  aria-expanded={isMobileMenuOpen}
                >
                  <span className="sr-only">Menu</span>
                  <span className="flex flex-col items-center justify-center gap-1.5">
                    <span
                      className={`h-0.5 w-4 rounded-full bg-slate-100 transition-transform duration-150 ${
                        isMobileMenuOpen ? "translate-y-[3px] rotate-45" : ""
                      }`}
                    />
                    <span
                      className={`h-0.5 w-4 rounded-full bg-slate-100 transition-opacity duration-150 ${
                        isMobileMenuOpen ? "opacity-0" : "opacity-100"
                      }`}
                    />
                    <span
                      className={`h-0.5 w-4 rounded-full bg-slate-100 transition-transform duration-150 ${
                        isMobileMenuOpen ? "-translate-y-[3px] -rotate-45" : ""
                      }`}
                    />
                  </span>
                </button>
              </div>
            </div>
          </div>

          {isMobileMenuOpen && (
            <div className="mt-2 border border-white/10 bg-slate-950/95 rounded-2xl md:hidden">
              <div className="px-4 py-3">
                <div className="mb-3">
                  <LanguageSwitcher />
                </div>
                <nav className="flex flex-col gap-1.5 text-[12px] font-bold uppercase tracking-[0.16em] text-slate-100">
                  {navItems.map((item) => {
                    const active =
                      cleanPath === item.href || cleanPath.startsWith(item.href + "/");

                    return (
                      <Link
                        key={item.href}
                        href={`${localePrefix}${item.href}`}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={`flex items-center justify-between rounded-2xl px-3.5 py-2.5 shadow-sm ring-1 transition-colors ${
                          active
                            ? "border-white/15 bg-[linear-gradient(135deg,#3b82f6_0%,#06b6d4_50%,#7c3aed_100%)] text-white ring-black/40 shadow-[0_12px_30px_rgba(59,130,246,0.30)]"
                            : "border-slate-800/80 bg-slate-900/80 text-slate-100 ring-black/40 hover:border-slate-600 hover:bg-slate-900"
                        }`}
                      >
                        <span className="truncate">{copy[item.key]}</span>
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </div>
          )}
        </div>
      </header>
      <div className="nk-sticky-topbar-spacer nk-marketing-topbar-spacer" aria-hidden="true" />
    </>
  );
}
