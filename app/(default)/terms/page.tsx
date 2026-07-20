import type { Metadata } from "next";

import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { TermsContent } from "@/components/marketing/TermsContent";

export const metadata: Metadata = {
  title: "Conditions de service | Norixo",
  description: "Conditions d’utilisation du service Norixo Optimize.",
};

export default function TermsPage() {
  return (
    <MarketingPageShell>
      <TermsContent />
    </MarketingPageShell>
  );
}
