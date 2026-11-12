import type { Metadata } from "next";

import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { ContactContent } from "@/components/marketing/ContactContent";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";
import { buildCanonicalUrl } from "@/lib/seo/seoUrls";

export const metadata: Metadata = {
  title: "Contact Norixo | Norixo",
  description:
    "Get in touch with the Norixo team for questions about listing audits, pricing, account access, or our Airbnb and Booking.com optimization tools.",
  alternates: buildHreflangAlternates("/contact"),
  openGraph: {
    title: "Contact Norixo | Norixo",
    description:
      "Get in touch with the Norixo team for questions about listing audits, pricing, account access, or our Airbnb and Booking.com optimization tools.",
    url: buildCanonicalUrl("/contact"),
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact Norixo | Norixo",
    description:
      "Get in touch with the Norixo team for questions about listing audits, pricing, account access, or our Airbnb and Booking.com optimization tools.",
  },
};

export default function ContactPage() {
  return (
    <MarketingPageShell>
      <ContactContent />
    </MarketingPageShell>
  );
}
