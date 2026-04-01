"use client";

import type { ReactNode } from "react";
import { MarketingTopNav } from "@/components/marketing/MarketingTopNav";

export function MarketingPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen text-slate-100">
      <div className="relative z-10 flex min-h-screen flex-col">
        <MarketingTopNav />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
