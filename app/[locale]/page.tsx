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
  fr: {
    title: "Norixo Optimize – Audit d'annonce Airbnb & Booking pour améliorer la conversion",
    description:
      "Analysez vos annonces Airbnb et Booking avec Norixo Optimize : audit de conversion, priorités d'optimisation et recommandations concrètes pour augmenter les réservations.",
  },
  es: {
    title: "Norixo Optimize – Auditoría de anuncios Airbnb y Booking para mejorar la conversión",
    description:
      "Analiza tus anuncios de Airbnb y Booking con Norixo Optimize: auditoría de conversión, prioridades de optimización y recomendaciones prácticas para aumentar las reservas.",
  },
  de: {
    title: "Norixo Optimize – Airbnb- und Booking-Anzeigenanalyse zur Verbesserung der Conversion",
    description:
      "Analysieren Sie Ihre Airbnb- und Booking-Anzeigen mit Norixo Optimize: Conversion-Audit, Optimierungsprioritäten und konkrete Empfehlungen zur Steigerung der Buchungen.",
  },
  it: {
    title: "Norixo Optimize – Audit degli annunci Airbnb e Booking per migliorare la conversione",
    description:
      "Analizza i tuoi annunci Airbnb e Booking con Norixo Optimize: audit della conversione, priorità di ottimizzazione e raccomandazioni pratiche per aumentare le prenotazioni.",
  },
  pt: {
    title: "Norixo Optimize – Auditoria de anúncios Airbnb e Booking para melhorar a conversão",
    description:
      "Analise os seus anúncios Airbnb e Booking com Norixo Optimize: auditoria de conversão, prioridades de otimização e recomendações práticas para aumentar as reservas.",
  },
  nl: {
    title: "Norixo Optimize – Audit van Airbnb- en Booking-vermeldingen om conversie te verbeteren",
    description:
      "Analyseer je Airbnb- en Booking-vermeldingen met Norixo Optimize: conversie-audit, optimalisatieprioriteiten en praktische aanbevelingen om meer boekingen te genereren.",
  },
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
  const alternates = buildHreflangAlternates("/");

  return {
    title: metadataCopy.title,
    description: metadataCopy.description,
    alternates: {
      ...alternates,
      canonical: buildLocalizedUrl("/", locale),
      languages: {
        ...alternates.languages,
        "x-default": "https://norixo.io",
      },
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
