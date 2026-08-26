import type { Metadata } from "next";

import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { TermsContent } from "@/components/marketing/TermsContent";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";
import { buildCanonicalUrl } from "@/lib/seo/seoUrls";

export const metadata: Metadata = {
  title: "Terms of Service | Norixo",
  description: "Terms of service for using Norixo Optimize.",
  alternates: buildHreflangAlternates("/terms"),
  openGraph: {
    title: "Terms of Service | Norixo",
    description: "Terms of service for using Norixo Optimize.",
    url: buildCanonicalUrl("/terms"),
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Terms of Service | Norixo",
    description: "Terms of service for using Norixo Optimize.",
  },
};

export default function TermsPage() {
  return (
    <MarketingPageShell>
      <TermsContent />
    </MarketingPageShell>
  );
}
