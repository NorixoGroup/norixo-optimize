import type { Metadata } from "next";

import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { LegalContent } from "@/components/marketing/LegalContent";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";

export const metadata: Metadata = {
  title: "Mentions légales | Norixo",
  description: "Mentions légales et informations éditeur pour les services Norixo.",
};

export default function LegalPage() {
  return (
    <MarketingPageShell>
      <LegalContent />
    </MarketingPageShell>
  );
}
