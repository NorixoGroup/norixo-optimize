import type { Metadata } from "next";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { HowItWorksSections } from "@/components/marketing/HowItWorksSections";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";

const pageTitle =
  "How Norixo Optimize works – Airbnb & Booking listing audit";
const pageDescription =
  "Discover how Norixo Optimize analyzes your Airbnb and Booking listings, evaluates your market position and generates practical recommendations to improve conversion.";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: buildHreflangAlternates("/how-it-works"),
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    url: "/how-it-works",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description: pageDescription,
  },
};

export default function HowItWorksPage() {
  return (
    <MarketingPageShell>
      <main className="nk-section space-y-10 md:space-y-12">
        <div>
          <HowItWorksSections includeAnchorId showHeroPersuasionNote />
        </div>
      </main>
    </MarketingPageShell>
  );
}
