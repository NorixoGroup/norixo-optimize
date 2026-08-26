import type { Metadata } from "next";

import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { TermsContent } from "@/components/marketing/TermsContent";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";
import { buildCanonicalUrl } from "@/lib/seo/seoUrls";

export const metadata: Metadata = {
  title: "Terms of Service | Norixo",
  description:
    "Terms of service for Norixo, including accounts, audits, billing, AI-assisted outputs, backlinks, and service limitations.",
  alternates: buildHreflangAlternates("/terms"),
  openGraph: {
    title: "Terms of Service | Norixo",
    description:
      "Terms of service for Norixo, including accounts, audits, billing, AI-assisted outputs, backlinks, and service limitations.",
    url: buildCanonicalUrl("/terms"),
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Terms of Service | Norixo",
    description:
      "Terms of service for Norixo, including accounts, audits, billing, AI-assisted outputs, backlinks, and service limitations.",
  },
};

export default function TermsPage() {
  return (
    <MarketingPageShell>
      <TermsContent />
    </MarketingPageShell>
  );
}
