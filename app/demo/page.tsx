import type { Metadata } from "next";
import { DemoContent } from "@/components/marketing/DemoContent";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";

const pageTitle = "Démo Norixo Optimize – Audit d'annonce Airbnb & Booking";
const pageDescription =
  "Découvrez comment Norixo Optimize analyse vos annonces Airbnb et Booking, fait ressortir les priorités d'optimisation et transforme les insights en actions concrètes.";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: buildHreflangAlternates("/demo"),
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    url: "/demo",
    type: "website",
    locale: "fr_FR",
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
