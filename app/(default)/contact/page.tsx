import type { Metadata } from "next";

import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { ContactContent } from "@/components/marketing/ContactContent";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";
import { buildCanonicalUrl } from "@/lib/seo/seoUrls";

export const metadata: Metadata = {
  title: "Contact Norixo | Norixo",
  description: "Contact Norixo for questions about Norixo Optimize.",
  alternates: buildHreflangAlternates("/contact"),
  openGraph: {
    title: "Contact Norixo | Norixo",
    description: "Contact Norixo for questions about Norixo Optimize.",
    url: buildCanonicalUrl("/contact"),
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact Norixo | Norixo",
    description: "Contact Norixo for questions about Norixo Optimize.",
  },
};

export default function ContactPage() {
  return (
    <MarketingPageShell>
      <ContactContent />
    </MarketingPageShell>
  );
}
