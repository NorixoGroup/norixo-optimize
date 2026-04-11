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
    <header className="sticky top-0 z-[80] border-b border-slate-200/90 bg-white/92 shadow-[0_8px_26px_rgba(15,23,42,0.06)] backdrop-blur-xl">
      <div
        ref={navbarContainerRef}
        data-audit-layout={isAuditDetailRoute ? "navbar" : undefined}
        className={
          isAuditDetailRoute
            ? "mx-auto flex w-full max-w-none items-center gap-6 px-6 py-3.5 md:px-8 xl:px-10 2xl:px-12"
            : "nk-section-tight flex items-center gap-6"
        }
      >
        <div className="flex flex-none items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(180deg,#ffffff,#f8fafc)] p-1 ring-1 ring-slate-200 shadow-[0_8px_18px_rgba(15,23,42,0.10)]">
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
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              NORIXO
            </div>
            <div className="text-lg leading-none tracking-tight text-slate-900">
              <span className="font-semibold">Norixo</span>{" "}
              <span className="font-normal text-slate-600">Optimize</span>
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
                    ? "border border-orange-300 bg-orange-50 text-orange-700 shadow-[0_0_0_1px_rgba(249,115,22,0.15)]"
                    : "border border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-none items-center gap-4">
          <WorkspaceSwitcher />

          <div ref={menuRef} className="relative">
            <button
              type="button"
              title={userEmail ?? "Authenticated user"}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f8fafc)] text-[11px] font-semibold text-slate-700 shadow-[0_6px_14px_rgba(15,23,42,0.08)] transition hover:border-slate-300 hover:bg-slate-50"
            >
              {userInitials}
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-[calc(100%+0.5rem)] min-w-[180px] rounded-2xl border border-slate-200 bg-white/95 p-1.5 shadow-[0_18px_45px_rgba(15,23,42,0.18)] backdrop-blur-xl">
                {userEmail && (
                  <div className="px-3 py-2 text-[11px] text-slate-500">
                    {userEmail}
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isSigningOut}
                  className="flex w-full items-center rounded-xl px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
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
                ? "mx-auto w-full max-w-[1600px] px-6 pb-10 pt-5 md:px-8 md:pt-7 xl:px-10 2xl:px-12"
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
