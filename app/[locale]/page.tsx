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

const pageTitle = "Norixo – Airbnb & Booking listing audit to improve conversion";
const pageDescription =
  "Analyze your Airbnb and Booking listings with Norixo: conversion audit, optimization priorities and practical recommendations to increase bookings.";
const socialImage = "/og-cover.png";

const localizedMetadata: Partial<Record<Locale, { title: string; description: string }>> = {
  fr: {
    title: "Norixo – Audit d'annonce Airbnb & Booking pour améliorer la conversion",
    description:
      "Analysez vos annonces Airbnb et Booking avec Norixo : audit de conversion, priorités d'optimisation et recommandations concrètes pour augmenter les réservations.",
  },
  es: {
    title: "Norixo – Auditoría de anuncios Airbnb y Booking para mejorar la conversión",
    description:
      "Analiza tus anuncios de Airbnb y Booking con Norixo: auditoría de conversión, prioridades de optimización y recomendaciones prácticas para aumentar las reservas.",
  },
  de: {
    title: "Norixo – Airbnb- und Booking-Anzeigenanalyse zur Verbesserung der Conversion",
    description:
      "Analysieren Sie Ihre Airbnb- und Booking-Anzeigen mit Norixo: Conversion-Audit, Optimierungsprioritäten und konkrete Empfehlungen zur Steigerung der Buchungen.",
  },
  it: {
    title: "Norixo – Audit degli annunci Airbnb e Booking per migliorare la conversione",
    description:
      "Analizza i tuoi annunci Airbnb e Booking con Norixo: audit della conversione, priorità di ottimizzazione e raccomandazioni pratiche per aumentare le prenotazioni.",
  },
  pt: {
    title: "Norixo – Auditoria de anúncios Airbnb e Booking para melhorar a conversão",
    description:
      "Analise os seus anúncios Airbnb e Booking com Norixo: auditoria de conversão, prioridades de otimização e recomendações práticas para aumentar as reservas.",
  },
  nl: {
    title: "Norixo – Audit van Airbnb- en Booking-vermeldingen om conversie te verbeteren",
    description:
      "Analyseer je Airbnb- en Booking-vermeldingen met Norixo: conversie-audit, optimalisatieprioriteiten en praktische aanbevelingen om meer boekingen te genereren.",
  },
  ja: {
    title: "Norixo – Airbnb・Booking掲載の監査でコンバージョンを改善",
    description:
      "Norixo で Airbnb と Booking の掲載を分析し、コンバージョン改善の機会を確認できます。市場での位置と最適化の優先順位を把握し、次の改善施策を整理しましょう。",
  },
  zh: {
    title: "Norixo – 审计 Airbnb 和 Booking 房源以提升转化",
    description:
      "使用 Norixo 分析你的 Airbnb 和 Booking 房源，发现提升转化的机会。了解房源的市场定位和优化优先级，并明确下一步可执行的改进方向。",
  },
  ko: {
    title: "Norixo – Airbnb·Booking 숙소 감사로 전환율 개선",
    description:
      "Norixo로 Airbnb 및 Booking 숙소를 분석하고 전환 개선 기회를 확인하세요. 숙소의 시장 포지션과 최적화 우선순위를 살펴본 뒤 실행 가능한 개선 작업을 정리할 수 있습니다.",
  },
  ar: {
    title: "Norixo – تدقيق إعلانات Airbnb وBooking لتحسين التحويل",
    description:
      "حلّل إعلانات Airbnb وBooking باستخدام Norixo: تدقيق التحويل، أولويات التحسين، وتوصيات عملية تساعدك على زيادة الحجوزات.",
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
    },
    openGraph: {
      title: metadataCopy.title,
      description: metadataCopy.description,
      url: buildLocalizedUrl("/", locale),
      siteName: "Norixo",
      type: "website",
      locale: getSeoLocaleConfig(locale).ogLocale,
      images: [
        {
          url: socialImage,
          width: 1200,
          height: 630,
          alt: metadataCopy.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: metadataCopy.title,
      description: metadataCopy.description,
      images: [socialImage],
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
