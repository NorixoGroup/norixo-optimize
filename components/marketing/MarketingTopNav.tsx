"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navItems = [
  { href: "/how-it-works", label: "Comment ça marche" },
  { href: "/demo", label: "Démo" },
  { href: "/pricing", label: "Tarifs" },
] as const;

export function MarketingTopNav() {
  const pathname = usePathname();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-[70] border-b border-slate-800/70 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] w-full max-w-[1680px] items-center justify-between px-6 lg:px-8 xl:px-10">
        <div className="flex flex-none items-center gap-3.5">
          <Link href="/" className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/95 p-1 ring-1 ring-slate-200/20">
              <Image
                src="/logo-nkridari.png"
                alt="Norixo Optimize logo"
                width={32}
                height={32}
                className="h-8 w-8 rounded-xl object-contain"
                priority
              />
            </div>
            <div className="hidden space-y-1 sm:block">
              <div className="text-sm tracking-wide text-slate-50 sm:text-base">
                <span className="font-semibold">Norixo</span>{" "}
                <span className="font-normal text-slate-200/80">Optimize</span>
              </div>
            </div>
          </Link>
        </div>

        <nav className="hidden items-center gap-1.5 overflow-x-auto text-[11px] font-bold uppercase tracking-[0.16em] text-slate-200 sm:text-[12px] md:flex">
          {navItems.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex min-w-0 items-center justify-center rounded-full px-3.5 py-2 leading-none whitespace-nowrap transition-colors ${
                  active
                    ? "border border-orange-400/70 bg-orange-500/20 text-orange-50 shadow-[0_0_0_1px_rgba(15,23,42,0.9)]"
                    : "border border-transparent text-slate-200 hover:border-slate-700/80 hover:bg-slate-900/70 hover:text-slate-50"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex flex-none items-center gap-3.5 md:hidden">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((open) => !open)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-700/80 bg-slate-900/80 text-slate-100 shadow-sm ring-1 ring-black/20 transition-colors hover:border-slate-500 hover:bg-slate-800"
            aria-label={isMobileMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
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

        <div className="hidden flex-none items-center gap-3.5 sm:flex md:hidden" />
        <div className="hidden flex-none items-center gap-3.5 md:flex">
          <Link
            href="/audit/new"
            className="inline-flex items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#f97316,#fb923c)] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-950 shadow-[0_12px_30px_rgba(249,115,22,0.24)] transition-all duration-200 hover:-translate-y-[1px] hover:brightness-110"
          >
            Lancer un audit
          </Link>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="border-t border-slate-800/70 bg-slate-950/95 md:hidden">
          <div className="mx-auto w-full max-w-[1680px] px-6 py-3 lg:px-8 xl:px-10">
            <nav className="flex flex-col gap-1.5 text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-100">
              {navItems.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(item.href + "/");

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center justify-between rounded-2xl px-3.5 py-2.5 shadow-sm ring-1 transition-colors ${
                      active
                        ? "border-orange-400/80 bg-orange-500/15 text-orange-50 ring-black/40"
                        : "border-slate-800/80 bg-slate-900/80 text-slate-100 ring-black/40 hover:border-slate-600 hover:bg-slate-900"
                    }`}
                  >
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            <Link
              href="/audit/new"
              onClick={() => setIsMobileMenuOpen(false)}
              className="mt-3 inline-flex w-full items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#f97316,#fb923c)] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-950 shadow-[0_10px_26px_rgba(249,115,22,0.22)] transition-all duration-200 hover:brightness-110"
            >
              Lancer un audit
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
