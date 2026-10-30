"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";
import { useTranslation } from "@/components/i18n/useTranslation";
import { dashboardCopy } from "@/data/dashboardI18n";
import { getSharedSession, getSharedUser } from "@/lib/supabase/sharedAuth";

const BASE_NAV_ITEMS = [
  { href: "/dashboard", copyKey: "overview" },
  { href: "/dashboard/listings", copyKey: "listings" },
  { href: "/dashboard/audits", copyKey: "audits" },
  { href: "/dashboard/billing", copyKey: "billing" },
  { href: "/dashboard/settings", copyKey: "settings" },
] as const;

const ADMIN_NAV_SECTIONS = [
  { href: "/dashboard/admin", label: "Business Cockpit" },
  { href: "/dashboard/backlinks", label: "Backlinks & SEO" },
  { href: "/dashboard/admin/marketing-studio", label: "Norixo AI — Marketing Studio" },
  { href: "/dashboard/nomad-studio", label: "🎬 Nomad Studio" },
] as const;

function isAdminSectionActive(pathname: string, href: string) {
  if (href === "/dashboard/admin") {
    return (
      pathname === "/dashboard/admin" ||
      (pathname.startsWith("/dashboard/admin/") &&
        !pathname.startsWith("/dashboard/admin/marketing-studio"))
    );
  }

  return pathname === href || pathname.startsWith(href + "/");
}

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
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false);
  const [isMobileAdminOpen, setIsMobileAdminOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [adminMenuPosition, setAdminMenuPosition] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement | null>(null);
  const adminMenuRef = useRef<HTMLDivElement | null>(null);
  const adminMenuPanelRef = useRef<HTMLDivElement | null>(null);
  const adminMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const navbarContainerRef = useRef<HTMLDivElement | null>(null);
  const { copy } = useTranslation(dashboardCopy);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const {
        data: { user },
      } = await getSharedUser();

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
    let mounted = true;

    async function loadAdminStatus() {
      try {
        const {
          data: { session },
        } = await getSharedSession();

        if (!session?.access_token) {
          if (mounted) setIsPlatformAdmin(false);
          return;
        }

        const res = await fetch("/api/admin/me", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          cache: "no-store",
        });

        const body = res.ok ? await res.json() : null;

        if (!res.ok || !body?.isAdminPrivate) {
          if (mounted) setIsPlatformAdmin(false);
          return;
        }

        const sessionResponse = await fetch("/api/admin/session", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          cache: "no-store",
        });
        const sessionBody = sessionResponse.ok
          ? await sessionResponse.json()
          : null;

        if (mounted) {
          setIsPlatformAdmin(Boolean(sessionBody?.isAdminPrivate));
        }
      } catch {
        if (mounted) setIsPlatformAdmin(false);
      }
    }

    void loadAdminStatus();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
      const target = event.target as Node;
      const isInsideAdminTrigger = adminMenuRef.current?.contains(target);
      const isInsideAdminPanel = adminMenuPanelRef.current?.contains(target);
      if (!isInsideAdminTrigger && !isInsideAdminPanel) {
        setIsAdminMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  useEffect(() => {
    if (!isAdminMenuOpen) return;

    function updateAdminMenuPosition() {
      const buttonEl = adminMenuButtonRef.current;
      if (!buttonEl) return;
      const rect = buttonEl.getBoundingClientRect();
      setAdminMenuPosition({ top: rect.bottom + 8, left: rect.left });
    }

    updateAdminMenuPosition();
    window.addEventListener("resize", updateAdminMenuPosition);
    window.addEventListener("scroll", updateAdminMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateAdminMenuPosition);
      window.removeEventListener("scroll", updateAdminMenuPosition, true);
    };
  }, [isAdminMenuOpen]);

  useEffect(() => {
    if (!isAdminMenuOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsAdminMenuOpen(false);
        adminMenuButtonRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAdminMenuOpen]);

  useEffect(() => {
    setMenuOpen(false);
    setIsMobileNavOpen(false);
    setIsAdminMenuOpen(false);
    setIsMobileAdminOpen(false);
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
      BASE_NAV_ITEMS.map((item) => ({
        href: item.href,
        label: copy.nav[item.copyKey],
      })),
    [copy]
  );

  const isAdminParentActive = useMemo(
    () => ADMIN_NAV_SECTIONS.some((section) => isAdminSectionActive(pathname, section.href)),
    [pathname]
  );

  async function handleLogout() {
    try {
      setIsSigningOut(true);
      await fetch("/api/admin/session", { method: "DELETE", cache: "no-store" });
      await supabase.auth.signOut();
      router.push("/sign-in");
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <>
      <header className="nk-dashboard-topbar nk-sticky-topbar">
        <div
          ref={navbarContainerRef}
          data-audit-layout={isAuditDetailRoute ? "navbar" : undefined}
          className={
            isAuditDetailRoute
              ? "mx-auto flex w-full max-w-none flex-wrap items-center gap-3 px-4 py-3.5 md:gap-6 md:px-8 xl:px-10 2xl:px-12"
              : "nk-section-tight flex flex-wrap items-center gap-3 md:gap-6"
          }
        >
          <div className="flex flex-none items-center gap-3 md:gap-4">
            <div className="nk-dashboard-topbar-logo flex h-10 w-10 items-center justify-center rounded-2xl p-1">
              <Image
                src="/brand/norixo-logo-mark.png"
                alt="Norixo logo"
                width={32}
                height={32}
                className="h-8 w-8 rounded-xl object-contain"
                priority
              />
            </div>
            <div className="space-y-1">
              <div className="nk-dashboard-topbar-brand-kicker text-[10px] font-semibold uppercase tracking-[0.16em]">
                NORIXO
              </div>
              <div className="nk-dashboard-topbar-brand text-base leading-none tracking-tight md:text-lg">
                <span className="font-semibold">Norixo</span>{" "}
                <span className="nk-dashboard-topbar-brand-muted font-normal">Optimize</span>
              </div>
            </div>
          </div>

          <nav className="nk-dashboard-topbar-nav hidden min-w-0 flex-1 items-center justify-center gap-1.5 overflow-x-auto text-[13px] font-bold uppercase tracking-[0.16em] whitespace-nowrap [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:flex">
            {visibleNavItems.map((item) => {
              const active =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname === item.href || pathname.startsWith(item.href + "/");

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nk-dashboard-topbar-link inline-flex items-center justify-center rounded-full px-3 py-1.5 leading-none md:px-3.5 md:py-2 ${
                    active
                      ? "nk-dashboard-topbar-link-active"
                      : "nk-dashboard-topbar-link-inactive"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}

            {isPlatformAdmin && (
              <div ref={adminMenuRef} className="relative">
                <button
                  ref={adminMenuButtonRef}
                  type="button"
                  onClick={() => setIsAdminMenuOpen((open) => !open)}
                  aria-expanded={isAdminMenuOpen}
                  aria-controls="admin-nav-submenu"
                  className={`nk-dashboard-topbar-link inline-flex items-center justify-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-bold uppercase leading-none tracking-[0.16em] whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 md:px-3.5 md:py-2 ${
                    isAdminParentActive
                      ? "nk-dashboard-topbar-link-active"
                      : "nk-dashboard-topbar-link-inactive"
                  }`}
                >
                  {copy.nav.admin}
                  <span
                    aria-hidden="true"
                    className={`inline-block text-[10px] transition-transform ${
                      isAdminMenuOpen ? "rotate-180" : ""
                    }`}
                  >
                    ▾
                  </span>
                </button>

                {isMounted &&
                  createPortal(
                    <div
                      ref={adminMenuPanelRef}
                      id="admin-nav-submenu"
                      hidden={!isAdminMenuOpen}
                      style={{ position: "fixed", top: adminMenuPosition.top, left: adminMenuPosition.left }}
                      className="nk-dashboard-topbar-menu z-[100] min-w-[220px] max-w-[min(280px,calc(100vw-2rem))] rounded-2xl p-1.5"
                    >
                      {ADMIN_NAV_SECTIONS.map((section) => {
                        const active = isAdminSectionActive(pathname, section.href);

                        return (
                          <Link
                            key={section.href}
                            href={section.href}
                            onClick={() => setIsAdminMenuOpen(false)}
                            className={`nk-dashboard-topbar-menu-action flex w-full items-center rounded-xl px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.16em] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${
                              active ? "nk-dashboard-topbar-link-active" : ""
                            }`}
                          >
                            {section.label}
                          </Link>
                        );
                      })}
                    </div>,
                    document.body
                  )}
              </div>
            )}
          </nav>

          <div className="ml-auto flex flex-none items-center gap-2 md:gap-4">
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

            <div className="hidden min-w-[150px] md:block">
              <LanguageSwitcher />
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
                    {isSigningOut ? copy.auth.signingOut : copy.auth.signOut}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {isMobileNavOpen && (
          <div className="border-t border-slate-800/70 bg-slate-950/95 md:hidden">
            <nav className="nk-section-tight flex flex-col gap-1.5 py-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-100">
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
                    className={`inline-flex w-full items-center justify-between rounded-2xl px-3.5 py-2.5 transition-all duration-200 ${
                      active
                        ? "border border-cyan-300/35 bg-[var(--nk-gradient-main)] text-slate-50 shadow-[0_10px_24px_rgba(30,64,175,0.28)]"
                        : "border border-slate-800/80 bg-slate-900/80 text-slate-100 hover:border-slate-600 hover:bg-slate-900"
                    }`}
                  >
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}

              {isPlatformAdmin && (
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsMobileAdminOpen((open) => !open)}
                    aria-expanded={isMobileAdminOpen}
                    aria-controls="admin-nav-mobile-submenu"
                    className={`inline-flex w-full items-center justify-between rounded-2xl px-3.5 py-2.5 transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${
                      isAdminParentActive
                        ? "border border-cyan-300/35 bg-[var(--nk-gradient-main)] text-slate-50 shadow-[0_10px_24px_rgba(30,64,175,0.28)]"
                        : "border border-slate-800/80 bg-slate-900/80 text-slate-100 hover:border-slate-600 hover:bg-slate-900"
                    }`}
                  >
                    <span className="truncate">{copy.nav.admin}</span>
                    <span
                      aria-hidden="true"
                      className={`inline-block text-[10px] transition-transform ${
                        isMobileAdminOpen ? "rotate-180" : ""
                      }`}
                    >
                      ▾
                    </span>
                  </button>

                  <div id="admin-nav-mobile-submenu" hidden={!isMobileAdminOpen} className="flex flex-col gap-1.5 pl-3">
                    {ADMIN_NAV_SECTIONS.map((section) => {
                      const active = isAdminSectionActive(pathname, section.href);

                      return (
                        <Link
                          key={section.href}
                          href={section.href}
                          onClick={() => {
                            setIsMobileAdminOpen(false);
                            setIsMobileNavOpen(false);
                          }}
                          className={`inline-flex w-full items-center justify-between rounded-2xl px-3.5 py-2.5 transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${
                            active
                              ? "border border-cyan-300/35 bg-[var(--nk-gradient-main)] text-slate-50 shadow-[0_10px_24px_rgba(30,64,175,0.28)]"
                              : "border border-slate-800/80 bg-slate-900/80 text-slate-100 hover:border-slate-600 hover:bg-slate-900"
                          }`}
                        >
                          <span className="truncate">{section.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mt-3 border-t border-slate-800/70 pt-3">
                <LanguageSwitcher />
              </div>
            </nav>
          </div>
        )}
      </header>
      <div className="nk-sticky-topbar-spacer nk-dashboard-topbar-spacer" aria-hidden="true" />
    </>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAuditDetailRoute =
    pathname?.startsWith("/dashboard/audits/") && pathname !== "/dashboard/audits";
  const isPrivateBacklinksRoute = pathname?.startsWith("/dashboard/backlinks") ?? false;
  const mainContainerRef = useRef<HTMLDivElement | null>(null);
  const [isBacklinksAdmin, setIsBacklinksAdmin] = useState(false);
  const [hasResolvedBacklinksAdmin, setHasResolvedBacklinksAdmin] = useState(false);

  useEffect(() => {
    if (!isPrivateBacklinksRoute) {
      return;
    }

    let mounted = true;

    async function checkBacklinksAccess() {
      try {
        const {
          data: { session },
        } = await getSharedSession();

        if (!session?.access_token) {
          if (mounted) {
            setIsBacklinksAdmin(false);
            setHasResolvedBacklinksAdmin(true);
          }
          return;
        }

        const response = await fetch("/api/admin/me", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          cache: "no-store",
        });
        const body = response.ok ? await response.json() : null;

        if (mounted) {
          setIsBacklinksAdmin(Boolean(body?.isAdminPrivate));
          setHasResolvedBacklinksAdmin(true);
        }
      } catch {
        if (mounted) {
          setIsBacklinksAdmin(false);
          setHasResolvedBacklinksAdmin(true);
        }
      }
    }

    void checkBacklinksAccess();

    return () => {
      mounted = false;
    };
  }, [isPrivateBacklinksRoute]);

  useEffect(() => {
    if (isPrivateBacklinksRoute && hasResolvedBacklinksAdmin && !isBacklinksAdmin) {
      router.replace("/dashboard");
    }
  }, [hasResolvedBacklinksAdmin, isBacklinksAdmin, isPrivateBacklinksRoute, router]);

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

  if (isPrivateBacklinksRoute && (!hasResolvedBacklinksAdmin || !isBacklinksAdmin)) {
    return null;
  }

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
