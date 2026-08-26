import type { Metadata } from "next";

import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { LegalContent } from "@/components/marketing/LegalContent";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";
import { buildCanonicalUrl } from "@/lib/seo/seoUrls";

export const metadata: Metadata = {
  title: "Legal Notice | Norixo",
  description:
    "Legal notice for Norixo, including publisher, hosting, and site use information.",
  alternates: buildHreflangAlternates("/legal"),
  openGraph: {
    title: "Legal Notice | Norixo",
    description:
      "Legal notice for Norixo, including publisher, hosting, and site use information.",
    url: buildCanonicalUrl("/legal"),
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Legal Notice | Norixo",
    description:
      "Legal notice for Norixo, including publisher, hosting, and site use information.",
  },
};

export default function LegalPage() {
  return (
    <MarketingPageShell>
      <LegalContent />
    </MarketingPageShell>
  );
}
