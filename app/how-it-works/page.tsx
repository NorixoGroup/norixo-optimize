"use client";

import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { HowItWorksSections } from "@/components/marketing/HowItWorksSections";

export default function HowItWorksPage() {
  return (
    <MarketingPageShell>
      <main className="nk-section space-y-16 md:space-y-20">
        <HowItWorksSections includeAnchorId />
      </main>
    </MarketingPageShell>
  );
}
