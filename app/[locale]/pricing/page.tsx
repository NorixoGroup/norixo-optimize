import type { Metadata } from "next";
import { notFound } from "next/navigation";

import PricingContent from "@/app/pricing/PricingContent";
import { isLocale } from "@/data/i18n";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";

type Props = {
  params: Promise<{
    locale: string;
  }>;
};

const pageTitle = "Tarifs Norixo Optimize – Audits Airbnb & Booking";
const pageDescription =
  "Découvrez les tarifs Norixo Optimize pour vos audits d'annonces Airbnb et Booking : crédits d'audit, packs multi-annonces et optimisation de conversion pour vos hébergements.";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: buildHreflangAlternates("/pricing"),
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    url: "/pricing",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description: pageDescription,
  },
};

export default async function PricingPage({ params }: Props) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return <PricingContent />;
}
