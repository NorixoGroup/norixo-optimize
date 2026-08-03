import type { Metadata } from "next";

import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { LegalContent } from "@/components/marketing/LegalContent";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";

export const metadata: Metadata = {
  title: "Mentions légales | Norixo",
  description:
    "Consultez les mentions légales de Norixo : informations sur l’éditeur du service, conditions d’utilisation applicables et obligations légales associées au site.",
};

export default function LegalPage() {
  return (
    <MarketingPageShell>
      <LegalContent />
    </MarketingPageShell>
  );
}
