"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { supabase } from "@/lib/supabase";

const navItems = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/listings", label: "Listings" },
  { href: "/dashboard/audits", label: "Audits" },
  { href: "/dashboard/billing", label: "Billing" },
  { href: "/dashboard/settings", label: "Settings" },
];

function TopNavbar({ pathname }: { pathname: string }) {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;
      setUserEmail(user?.email ?? null);
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const userInitials = useMemo(() => {
    if (!userEmail) return "??";

    const source = userEmail.split("@")[0] || userEmail;
    const parts = source
      .split(/[.\-_ ]+/)
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length === 0) return "??";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }, [userEmail]);

  async function handleLogout() {
    try {
      setIsSigningOut(true);
      await supabase.auth.signOut();
      router.push("/sign-in");
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-10 border-b border-slate-800/70 bg-slate-950/70 backdrop-blur-xl">
      <div className="nk-section-tight flex items-center gap-5">
        <div className="flex flex-none items-center gap-3.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-500/15 text-xs font-semibold uppercase tracking-[0.22em] text-orange-200 ring-1 ring-orange-400/30">
            LCO
          </div>
          <div>
            <div className="text-[13px] font-semibold tracking-tight text-slate-50">
              Listing Conversion Optimizer
            </div>
            <div className="text-[11px] text-slate-400">
              Conversion audit workspace
            </div>
          </div>
        </div>

        <nav className="flex flex-1 items-center justify-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.18em]">
          {navItems.map((item) => {
            const active =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname === item.href || pathname.startsWith(item.href + "/");

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-3.5 py-1.5 transition-colors ${
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

        <div className="flex flex-none items-center gap-3.5">
          <WorkspaceSwitcher />

          <span className="nk-badge-accent hidden md:inline-flex">
            Concierge plan · 39 €/month
          </span>

          <button
            type="button"
            onClick={handleLogout}
            disabled={isSigningOut}
            className="hidden rounded-full border border-slate-700/80 bg-slate-900/70 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200 transition hover:border-slate-600 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 md:inline-flex"
          >
            {isSigningOut ? "Signing out..." : "Sign out"}
          </button>

          <div
            title={userEmail ?? "Authenticated user"}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-700/80 bg-slate-900/70 text-[11px] font-medium text-slate-300"
          >
            {userInitials}
          </div>
        </div>
      </div>
    </header>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="relative min-h-screen text-slate-100">
      <div className="nk-dashboard-bg" />

      <div className="relative z-10">
        <TopNavbar pathname={pathname} />

        <main className="flex-1">
          <div className="nk-section pb-10 pt-6 md:pt-8">{children}</div>
        </main>
      </div>
    </div>
  );
}