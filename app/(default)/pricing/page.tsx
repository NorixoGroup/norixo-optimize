import type { Metadata } from "next";

import PricingContent from "./PricingContent";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";

const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://norixo.io"
).replace(/\/$/, "");
const pageTitle = "Norixo Pricing – Airbnb & Booking listing audits";
const pageDescription =
  "Explore Norixo pricing for Airbnb and Booking listing audits: audit credits, multi-listing packs, and conversion optimization for your properties.";
const alternates = buildHreflangAlternates("/pricing");
const socialImage = "/og-cover.png";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates,
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    url: "/pricing",
    siteName: "Norixo",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: socialImage,
        width: 1200,
        height: 630,
        alt: pageTitle,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description: pageDescription,
    images: [socialImage],
  },
};

const pricingJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: siteUrl,
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Pricing",
      item: `${siteUrl}/pricing`,
    },
  ],
};

export default function PricingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(pricingJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <PricingContent />
    </>
  );
}
