import type { Metadata } from "next";
import { HomeContent } from "@/components/marketing/HomeContent";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";

const pageTitle = "Norixo Optimize – Audit d'annonce Airbnb & Booking pour améliorer la conversion";
const pageDescription =
  "Analysez vos annonces Airbnb et Booking avec Norixo Optimize : audit de conversion, priorités d'optimisation et recommandations concrètes pour augmenter les réservations.";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: buildHreflangAlternates("/"),
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    url: "/",
    type: "website",
    locale: "fr_FR",
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description: pageDescription,
  },
};

export default function Home() {
  return <HomeContent />;
}
