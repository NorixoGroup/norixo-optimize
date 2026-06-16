import type { Metadata } from "next";

import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { PrivacyContent } from "@/components/marketing/PrivacyContent";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";

export const metadata: Metadata = {
  title: "Politique de confidentialité | Norixo",
  description:
    "Informations sur le traitement des données personnelles dans le cadre du service Norixo Optimize.",
};

export default function PrivacyPage() {
  return (
    <MarketingPageShell>
      <PrivacyContent />
    </MarketingPageShell>
  );
}
