"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/how-it-works", label: "Comment ça marche" },
  { href: "/onboarding", label: "Onboarding" },
  { href: "/demo", label: "Démo" },
  { href: "/pricing", label: "Tarifs" },
] as const;

export function MarketingTopNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-[70] border-b border-slate-800/70 bg-slate-950/80 backdrop-blur-xl">
      <div className="nk-section-tight flex items-center gap-5 py-3">
        <div className="flex flex-none items-center gap-3.5">
          <Link href="/how-it-works" className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/95 p-1 ring-1 ring-slate-200/20">
              <Image
                src="/logo-nkridari.png"
                alt="NkriDari logo"
                width={32}
                height={32}
                className="h-8 w-8 rounded-xl object-contain"
                priority
              />
            </div>
            <div className="hidden space-y-1 sm:block">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                LCO by NkriDari
              </div>
              <div className="text-sm font-semibold tracking-tight text-slate-50 sm:text-base">
                Listing Conversion Optimizer
              </div>
            </div>
          </Link>
        </div>

        <nav className="flex flex-1 items-center justify-center gap-1.5 overflow-x-auto text-[11px] font-bold uppercase tracking-[0.16em] text-slate-200 sm:text-[12px]">
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

        <div className="hidden flex-none items-center gap-3.5 sm:flex">
          {/* Intentionally left empty to mirror dashboard layout without user controls */}
        </div>
      </div>
    </header>
  );
}
