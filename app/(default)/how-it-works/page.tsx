import type { Metadata } from "next";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { HowItWorksSectionsClaimSafe } from "@/components/marketing/HowItWorksSectionsClaimSafe";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";

const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://norixo.io"
).replace(/\/$/, "");
const pageTitle =
  "How Norixo works – Airbnb & Booking listing audit";
const pageDescription =
  "Discover how Norixo analyzes your Airbnb and Booking listings, evaluates your market position and generates practical recommendations to improve conversion.";
const alternates = buildHreflangAlternates("/how-it-works");
const socialImage = "/og-cover.png";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates,
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    url: "/how-it-works",
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

const howItWorksJsonLd = {
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
      name: "How it works",
      item: `${siteUrl}/how-it-works`,
    },
  ],
};

export default function HowItWorksPage() {
  return (
    <MarketingPageShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(howItWorksJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <main className="nk-section space-y-10 md:space-y-12">
        <div>
          <HowItWorksSectionsClaimSafe
            includeAnchorId
            showHeroPersuasionNote
            primaryActionLabel="Start my free audit"
            primaryActionHref="/free-audit"
            primaryActionReassurance="No credit card · Based on aggregated market data"
          />
        </div>
      </main>
    </MarketingPageShell>
  );
}
