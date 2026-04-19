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
  const [isAdminPrivate, setIsAdminPrivate] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const navbarContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadAdminAccess(accessToken: string | null | undefined) {
      if (!accessToken) {
        if (mounted) setIsAdminPrivate(false);
        return;
      }

      const response = await fetch("/api/admin/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      }).catch(() => null);
      const data = response?.ok
        ? ((await response.json().catch(() => null)) as { isAdminPrivate?: boolean } | null)
        : null;

      if (data?.isAdminPrivate) {
        if (mounted) setIsAdminPrivate(true);
        return;
      }

      const fallbackResponse = response?.ok
        ? null
        : await fetch("/api/admin/sales?period=7", {
            headers: { Authorization: `Bearer ${accessToken}` },
            cache: "no-store",
          }).catch(() => null);

      if (mounted) setIsAdminPrivate(Boolean(fallbackResponse?.ok));
    }

    async function loadUser() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;
      setUserEmail(session?.user?.email ?? null);
      await loadAdminAccess(session?.access_token);
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
      void loadAdminAccess(session?.access_token);
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
    setIsMobileNavOpen(false);
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

  const visibleNavItems = useMemo(
    () =>
      isAdminPrivate
        ? [...navItems, { href: "/dashboard/admin", label: "Admin" }]
        : navItems,
    [isAdminPrivate]
  );

  async function handleLogout() {
    try {
      setIsSigningOut(true);
      setIsAdminPrivate(false);
      await supabase.auth.signOut();
      router.push("/sign-in");
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 px-0">
        <div className="w-full">
          <div
            ref={navbarContainerRef}
            data-audit-layout={isAuditDetailRoute ? "navbar" : undefined}
            className="relative flex items-center justify-between h-[64px] px-6 rounded-none border border-white/10 bg-[linear-gradient(180deg,rgba(2,6,23,0.75)_0%,rgba(2,6,23,0.55)_100%)] backdrop-blur-xl shadow-[0_20px_60px_rgba(2,6,23,0.65)] before:absolute before:inset-0 before:rounded-none before:bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.12),transparent_70%)] before:pointer-events-none"
          >
            <div className="flex items-center gap-3 shrink-0">
              <Link href="/dashboard" className="flex items-center gap-3">
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
                {visibleNavItems.map((item) => {
                  const active =
                    item.href === "/dashboard"
                      ? pathname === "/dashboard"
                      : pathname === item.href || pathname.startsWith(item.href + "/");

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`inline-flex min-w-0 items-center justify-center leading-none whitespace-nowrap transition-all duration-200 ${
                        active
                        ? "rounded-full border border-white/15 bg-[linear-gradient(135deg,#3b82f6_0%,#06b6d4_50%,#7c3aed_100%)] px-4 py-1.5 text-white shadow-[0_12px_30px_rgba(59,130,246,0.30)]"
                        : "rounded-full border border-transparent px-3.5 py-2 text-slate-300 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsMobileNavOpen((open) => !open)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-700/80 bg-slate-900/80 text-slate-100 shadow-sm ring-1 ring-black/20 transition-colors hover:border-slate-500 hover:bg-slate-800 md:hidden"
                aria-label={isMobileNavOpen ? "Fermer le menu de navigation" : "Ouvrir le menu de navigation"}
                aria-expanded={isMobileNavOpen}
              >
                <span className="sr-only">Menu</span>
                <span className="flex flex-col items-center justify-center gap-1.5">
                  <span
                    className={`h-0.5 w-4 rounded-full bg-slate-100 transition-transform duration-150 ${
                      isMobileNavOpen ? "translate-y-[3px] rotate-45" : ""
                    }`}
                  />
                  <span
                    className={`h-0.5 w-4 rounded-full bg-slate-100 transition-opacity duration-150 ${
                      isMobileNavOpen ? "opacity-0" : "opacity-100"
                    }`}
                  />
                  <span
                    className={`h-0.5 w-4 rounded-full bg-slate-100 transition-transform duration-150 ${
                      isMobileNavOpen ? "-translate-y-[3px] -rotate-45" : ""
                    }`}
                  />
                </span>
              </button>

              <div className="nk-dashboard-topbar-workspace min-w-0">
                <WorkspaceSwitcher />
              </div>

              <div ref={menuRef} className="relative">
                <button
                  type="button"
                  title={userEmail ?? "Authenticated user"}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen((open) => !open)}
                  className="nk-dashboard-topbar-avatar flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-semibold transition"
                >
                  {userInitials}
                </button>

                {menuOpen && (
                  <div className="nk-dashboard-topbar-menu absolute right-0 top-[calc(100%+0.5rem)] min-w-[180px] rounded-2xl p-1.5">
                    {userEmail && (
                      <div className="nk-dashboard-topbar-menu-email px-3 py-2 text-[11px]">
                        {userEmail}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleLogout}
                      disabled={isSigningOut}
                      className="nk-dashboard-topbar-menu-action flex w-full items-center rounded-xl px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.16em] transition disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSigningOut ? "Signing out..." : "Sign out"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {isMobileNavOpen && (
            <div className="mt-2 border border-white/10 bg-slate-950/95 rounded-2xl md:hidden">
              <div className="px-4 py-3">
                <nav className="flex flex-col gap-1.5 text-[12px] font-bold uppercase tracking-[0.16em] text-slate-100">
                  {visibleNavItems.map((item) => {
                    const active =
                      item.href === "/dashboard"
                        ? pathname === "/dashboard"
                        : pathname === item.href || pathname.startsWith(item.href + "/");

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setIsMobileNavOpen(false)}
                        className={`flex items-center justify-between rounded-2xl px-3.5 py-2.5 shadow-sm ring-1 transition-colors ${
                          active
                            ? "border-white/15 bg-[linear-gradient(135deg,#3b82f6_0%,#06b6d4_50%,#7c3aed_100%)] text-white ring-black/40 shadow-[0_12px_30px_rgba(59,130,246,0.30)]"
                            : "border-slate-800/80 bg-slate-900/80 text-slate-100 ring-black/40 hover:border-slate-600 hover:bg-slate-900"
                        }`}
                      >
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </div>
          )}
        </div>
      </header>
      <div className="nk-sticky-topbar-spacer nk-dashboard-topbar-spacer" aria-hidden="true" />
    </>
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
    <div className="nk-dashboard-shell relative min-h-screen text-slate-100">
      <div className="relative z-10">
        <TopNavbar pathname={pathname} isAuditDetailRoute={isAuditDetailRoute} />

        <main className="flex-1">
          <div
            ref={mainContainerRef}
            data-audit-layout={isAuditDetailRoute ? "main-container" : undefined}
            className={
              isAuditDetailRoute
                ? "mx-auto w-full max-w-[1600px] px-4 pb-9 pt-4 md:px-8 md:pb-10 md:pt-7 xl:px-10 2xl:px-12"
                : "nk-section pb-10 pt-5 md:pt-7"
            }
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
