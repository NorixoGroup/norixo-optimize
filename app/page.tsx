import type { Metadata } from "next";
import { HomeContent } from "@/components/marketing/HomeContent";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";

const pageTitle = "Norixo Optimize – Airbnb & Booking listing audit to improve conversion";
const pageDescription =
  "Analyze your Airbnb and Booking listings with Norixo Optimize: conversion audit, optimization priorities, and practical recommendations to increase bookings.";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: buildHreflangAlternates("/"),
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    url: "/",
    type: "website",
    locale: "en_US",
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
