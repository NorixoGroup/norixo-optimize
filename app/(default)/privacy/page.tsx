import type { Metadata } from "next";

import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { PrivacyContent } from "@/components/marketing/PrivacyContent";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";
import { buildCanonicalUrl } from "@/lib/seo/seoUrls";

export const metadata: Metadata = {
  title: "Privacy Policy | Norixo",
  description:
    "Privacy policy for Norixo, including how we handle personal data and related rights.",
  alternates: buildHreflangAlternates("/privacy"),
  openGraph: {
    title: "Privacy Policy | Norixo",
    description:
      "Privacy policy for Norixo, including how we handle personal data and related rights.",
    url: buildCanonicalUrl("/privacy"),
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Privacy Policy | Norixo",
    description:
      "Privacy policy for Norixo, including how we handle personal data and related rights.",
  },
};

export default function PrivacyPage() {
  return (
    <MarketingPageShell>
      <PrivacyContent />
    </MarketingPageShell>
  );
}
