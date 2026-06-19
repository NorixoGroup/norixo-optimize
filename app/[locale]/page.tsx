import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { HomeContent } from "@/components/marketing/HomeContent";
import { isLocale, defaultLocale, type Locale } from "@/data/i18n";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";
import { getSeoLocaleConfig } from "@/lib/seo/seoLocales";
import { buildLocalizedUrl } from "@/lib/seo/seoUrls";

type Props = {
  params: Promise<{
    locale: string;
  }>;
};

const pageTitle = "Norixo Optimize – Airbnb & Booking listing audit to improve conversion";
const pageDescription =
  "Analyze your Airbnb and Booking listings with Norixo Optimize: conversion audit, optimization priorities and practical recommendations to increase bookings.";

const localizedMetadata: Partial<Record<Locale, { title: string; description: string }>> = {
  ja: {
    title: "Norixo Optimize – Airbnb・Booking掲載の監査でコンバージョンを改善",
    description:
      "Norixo Optimize で Airbnb と Booking の掲載を分析。コンバージョン監査、最適化の優先順位、実践的な改善提案で予約数の向上を支援します。",
  },
  zh: {
    title: "Norixo Optimize – 审计 Airbnb 和 Booking 房源以提升转化",
    description:
      "使用 Norixo Optimize 分析你的 Airbnb 和 Booking 房源：转化审计、优化优先级和可执行建议，帮助你提升预订量。",
  },
  ko: {
    title: "Norixo Optimize – Airbnb·Booking 숙소 감사로 전환율 개선",
    description:
      "Norixo Optimize로 Airbnb 및 Booking 숙소를 분석하세요. 전환 감사, 최적화 우선순위, 실행 가능한 권장사항으로 예약 증가를 돕습니다.",
  },
  ar: {
    title: "Norixo Optimize – تدقيق إعلانات Airbnb وBooking لتحسين التحويل",
    description:
      "حلّل إعلانات Airbnb وBooking باستخدام Norixo Optimize: تدقيق التحويل، أولويات التحسين، وتوصيات عملية تساعدك على زيادة الحجوزات.",
  },
};

export function generateStaticParams() {
  return ["fr", "es", "de", "it", "pt", "nl", "ja", "zh", "ko", "ar"].map((locale) => ({
    locale,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  if (!isLocale(locale) || locale === defaultLocale) {
    return {};
  }

  const metadataCopy = localizedMetadata[locale] ?? {
    title: pageTitle,
    description: pageDescription,
  };

  return {
    title: metadataCopy.title,
    description: metadataCopy.description,
    alternates: {
      ...buildHreflangAlternates("/"),
      canonical: buildLocalizedUrl("/", locale),
    },
    openGraph: {
      title: metadataCopy.title,
      description: metadataCopy.description,
      url: buildLocalizedUrl("/", locale),
      type: "website",
      locale: getSeoLocaleConfig(locale).ogLocale,
    },
    twitter: {
      card: "summary_large_image",
      title: metadataCopy.title,
      description: metadataCopy.description,
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
