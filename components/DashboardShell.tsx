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
                src="/logo-nkridari.png"
                alt="Norixo Optimize logo"
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

          <nav className="nk-dashboard-topbar-nav order-3 flex w-full min-w-0 flex-1 items-center justify-start gap-1.5 overflow-x-auto pb-1 text-[11px] font-bold uppercase tracking-[0.14em] whitespace-nowrap [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:order-none md:w-auto md:justify-center md:pb-0 md:text-[13px] md:tracking-[0.16em]">
            {navItems.map((item) => {
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
          </nav>

          <div className="ml-auto flex flex-none items-center gap-2 md:gap-4">
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
