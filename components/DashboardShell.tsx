"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";

const navItems = [
  { href: "/dashboard", label: "Vue d’ensemble" },
  { href: "/dashboard/listings", label: "Annonces" },
  { href: "/dashboard/audits", label: "Audits" },
  { href: "/dashboard/billing", label: "Facturation" },
  { href: "/dashboard/settings", label: "Paramètres" },
];

function TopNavbar({
  pathname,
  isAuditDetailRoute,
}: {
  pathname: string;
  isAuditDetailRoute: boolean;
}) {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const navbarContainerRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isAuditDetailRoute || typeof window === "undefined") return;

    function logAuditNavbarWidth() {
      const navbarEl = navbarContainerRef.current;
      if (!navbarEl) return;

      const rect = navbarEl.getBoundingClientRect();
      console.info("[audit-detail][layout] navbar", {
        width: Math.round(rect.width),
        viewportWidth: window.innerWidth,
        className: navbarEl.className,
      });
    }

    logAuditNavbarWidth();
    window.addEventListener("resize", logAuditNavbarWidth);
    return () => {
      window.removeEventListener("resize", logAuditNavbarWidth);
    };
  }, [isAuditDetailRoute]);

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
    <header className="sticky top-0 z-[80] border-b border-slate-800/70 bg-slate-950/70 backdrop-blur-xl">
      <div
        ref={navbarContainerRef}
        data-audit-layout={isAuditDetailRoute ? "navbar" : undefined}
        className={
          isAuditDetailRoute
            ? "mx-auto flex w-full max-w-none items-center gap-5 px-6 py-3 md:px-8 xl:px-10 2xl:px-12"
            : "nk-section-tight flex items-center gap-5"
        }
      >
        <div className="flex flex-none items-center gap-3.5">
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
          <div className="space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              LCO by NkriDari
            </div>
            <div className="text-lg font-semibold tracking-tight text-slate-50">
              Listing Conversion Optimizer
            </div>
          </div>
        </div>

        <nav className="flex flex-1 items-center justify-center gap-1.5 text-[13px] font-bold uppercase tracking-[0.16em]">
          {navItems.map((item) => {
            const active =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname === item.href || pathname.startsWith(item.href + "/");

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex items-center justify-center rounded-full px-3.5 py-2 leading-none transition-colors ${
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

          <div ref={menuRef} className="relative">
            <button
              type="button"
              title={userEmail ?? "Authenticated user"}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-700/80 bg-slate-900/70 text-[11px] font-medium text-slate-300 transition hover:border-slate-600 hover:bg-slate-800"
            >
              {userInitials}
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-[calc(100%+0.5rem)] min-w-[180px] rounded-2xl border border-slate-800/80 bg-slate-950/95 p-1.5 shadow-[0_18px_45px_rgba(15,23,42,0.35)] backdrop-blur-xl">
                {userEmail && (
                  <div className="px-3 py-2 text-[11px] text-slate-400">
                    {userEmail}
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isSigningOut}
                  className="flex w-full items-center rounded-xl px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200 transition hover:bg-slate-900/80 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSigningOut ? "Signing out..." : "Sign out"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAuditDetailRoute =
    pathname?.startsWith("/dashboard/audits/") && pathname !== "/dashboard/audits";
  const mainContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isAuditDetailRoute || typeof window === "undefined") return;

    function logAuditMainWidth() {
      const mainEl = mainContainerRef.current;
      if (!mainEl) return;

      const rect = mainEl.getBoundingClientRect();
      console.info("[audit-detail][layout] main-container", {
        width: Math.round(rect.width),
        viewportWidth: window.innerWidth,
        className: mainEl.className,
      });
    }

    logAuditMainWidth();
    window.addEventListener("resize", logAuditMainWidth);
    return () => {
      window.removeEventListener("resize", logAuditMainWidth);
    };
  }, [isAuditDetailRoute]);

  return (
    <div className="relative min-h-screen text-slate-100">
      <div className="nk-dashboard-bg" />

      <div className="relative z-10">
        <TopNavbar pathname={pathname} isAuditDetailRoute={isAuditDetailRoute} />

        <main className="flex-1">
          <div
            ref={mainContainerRef}
            data-audit-layout={isAuditDetailRoute ? "main-container" : undefined}
            className={
              isAuditDetailRoute
                ? "mx-auto w-full max-w-[1600px] px-6 pb-10 pt-6 md:px-8 md:pt-8 xl:px-10 2xl:px-12"
                : "nk-section pb-10 pt-6 md:pt-8"
            }
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
