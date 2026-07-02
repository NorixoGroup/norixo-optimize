import type { Metadata } from "next";
import { DemoContent } from "@/components/marketing/DemoContent";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";

const pageTitle = "Norixo Optimize Demo – Airbnb & Booking listing audit";
const pageDescription =
  "See how Norixo Optimize analyzes your Airbnb and Booking listings, highlights optimization priorities, and turns insights into practical actions.";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: buildHreflangAlternates("/demo"),
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    url: "/demo",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description: pageDescription,
  },
};

export default function DemoPage() {
  return <DemoContent />;
}
