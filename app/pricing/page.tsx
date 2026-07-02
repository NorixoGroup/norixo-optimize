import type { Metadata } from "next";

import PricingContent from "./PricingContent";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";

const pageTitle = "Norixo Optimize Pricing – Airbnb & Booking listing audits";
const pageDescription =
  "Explore Norixo Optimize pricing for Airbnb and Booking listing audits: audit credits, multi-listing packs, and conversion optimization for your properties.";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: buildHreflangAlternates("/pricing"),
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    url: "/pricing",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description: pageDescription,
  },
};

export default function PricingPage() {
  return <PricingContent />;
}
