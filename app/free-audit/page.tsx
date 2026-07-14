import type { Metadata } from "next";

import { FreeAuditContent } from "@/app/free-audit/FreeAuditContent";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";

const pageTitle = "Free Airbnb pricing audit: compare your price to the market | Norixo";
const pageDescription =
  "Compare your declared nightly price to aggregated market benchmarks for free, with no credit card and no scraping of your listing.";
const alternates = buildHreflangAlternates("/free-audit");

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: {
    ...alternates,
    languages: {
      ...alternates.languages,
      "x-default": "https://norixo.io",
    },
  },
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    url: "/free-audit",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description: pageDescription,
  },
};

export default function FreeAuditPage() {
  return <FreeAuditContent />;
}
