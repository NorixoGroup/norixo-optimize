import type { Metadata } from "next";
import { HomeContent } from "@/components/marketing/HomeContent";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";

const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://norixo.io"
).replace(/\/$/, "");
const pageTitle = "Norixo Optimize – Airbnb & Booking listing audit to improve conversion";
const pageDescription =
  "Analyze your Airbnb and Booking listings with Norixo Optimize: conversion audit, optimization priorities, and practical recommendations to increase bookings.";
const alternates = buildHreflangAlternates("/");
const socialImage = "/og-cover.png";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates,
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    url: "/",
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

const homeJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": `${siteUrl}/#software`,
  name: "Norixo Optimize",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: siteUrl,
  description: pageDescription,
  provider: {
    "@id": `${siteUrl}/#organization`,
  },
  brand: {
    "@id": `${siteUrl}/#organization`,
  },
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(homeJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <HomeContent />
    </>
  );
}
