"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Aperçu" },
  { href: "/dashboard/listings", label: "Annonces" },
  { href: "/dashboard/audits", label: "Audits" },
  { href: "/dashboard/billing", label: "Facturation" },
  { href: "/dashboard/settings", label: "Paramètres" },
];

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-neutral-950 text-neutral-200">
      <aside className="hidden w-72 flex-shrink-0 flex-col border-r border-neutral-800 bg-neutral-900/90 px-5 py-6 md:flex">
        <div className="flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-500/10 text-sm font-semibold text-emerald-300 shadow-lg shadow-emerald-950/20">
            LCO
          </div>

          <div>
            <div className="text-sm font-semibold tracking-tight text-white">
              Listing Conversion Optimizer
            </div>
            <div className="text-xs text-neutral-500">Espace de démonstration</div>
          </div>
        </div>

        <nav className="mt-10 space-y-2">
          {navItems.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium transition-all ${
                  active
                    ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 shadow-md shadow-emerald-950/20"
                    : "border border-transparent text-neutral-300 hover:border-neutral-800 hover:bg-neutral-800/60 hover:text-white"
                }`}
              >
                <span>{item.label}</span>
                {active && (
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mt-8 rounded-2xl border border-neutral-800 bg-neutral-950/80 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            Plan actif
          </p>
          <p className="mt-2 text-sm font-semibold text-white">Concierge</p>
          <p className="mt-1 text-xs text-neutral-400">
            39 €/mois · jusqu’à 5 annonces incluses
          </p>
        </div>

        <div className="mt-auto border-t border-neutral-800 pt-4 text-[11px] leading-5 text-neutral-500">
          Authentification, facturation et IA encore en cours d’intégration.
          Branche ici Supabase, Stripe et OpenAI.
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col bg-neutral-950">
        <header className="sticky top-0 z-10 border-b border-neutral-800 bg-neutral-950/80 px-4 py-4 backdrop-blur md:px-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                Tableau de bord
              </div>
              <div className="mt-1 text-base font-semibold tracking-tight text-white">
                Optimiseur de conversion d’annonces
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-300">
                Service de conciergerie · 39 €/mois
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 pb-10 pt-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}