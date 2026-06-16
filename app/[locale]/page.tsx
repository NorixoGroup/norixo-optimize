import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { HomeContent } from "@/components/marketing/HomeContent";
import { isLocale, defaultLocale, type Locale } from "@/data/i18n";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";

type Props = {
  params: Promise<{
    locale: string;
  }>;
};

const pageTitle = "Norixo Optimize – Airbnb & Booking listing audit to improve conversion";
const pageDescription =
  "Analyze your Airbnb and Booking listings with Norixo Optimize: conversion audit, optimization priorities and practical recommendations to increase bookings.";

export function generateStaticParams() {
  return ["fr", "es", "de", "it", "pt", "nl"].map((locale) => ({
    locale,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  if (!isLocale(locale) || locale === defaultLocale) {
    return {};
  }

  return {
    title: pageTitle,
    description: pageDescription,
    alternates: buildHreflangAlternates("/"),
    openGraph: {
      title: pageTitle,
      description: pageDescription,
      url: `/${locale}`,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description: pageDescription,
    },
  };
}

export default async function LocalizedHomePage({ params }: Props) {
  const { locale } = await params;

  if (!isLocale(locale) || locale === defaultLocale) {
    notFound();
  }

  return <HomeContent />;
}
