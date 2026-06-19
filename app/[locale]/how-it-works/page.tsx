import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { HowItWorksSections } from "@/components/marketing/HowItWorksSections";
import { isLocale } from "@/data/i18n";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";

type Props = {
  params: Promise<{
    locale: string;
  }>;
};

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

export default async function HowItWorksPage({ params }: Props) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

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
