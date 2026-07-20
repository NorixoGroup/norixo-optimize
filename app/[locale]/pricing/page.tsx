import type { Metadata } from "next";
import { notFound } from "next/navigation";

import PricingContent from "@/app/(default)/pricing/PricingContent";
import { isLocale, type Locale } from "@/data/i18n";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";
import { getSeoLocaleConfig } from "@/lib/seo/seoLocales";
import { buildLocalizedUrl } from "@/lib/seo/seoUrls";

type Props = {
  params: Promise<{
    locale: string;
  }>;
};

const pageTitle = "Tarifs Norixo Optimize – Audits Airbnb & Booking";
const pageDescription =
  "Découvrez les tarifs Norixo Optimize pour vos audits d'annonces Airbnb et Booking : crédits d'audit, packs multi-annonces et optimisation de conversion pour vos hébergements.";
const socialImage = "/og-cover.png";

const localizedMetadata: Partial<Record<Locale, { title: string; description: string }>> = {
  es: {
    title: "Precios de Norixo Optimize – Auditorías Airbnb y Booking",
    description:
      "Descubre los precios de Norixo Optimize para tus auditorías de anuncios de Airbnb y Booking: créditos de auditoría, packs multi anuncio y optimización de conversión para tus alojamientos.",
  },
  de: {
    title: "Preise von Norixo Optimize – Airbnb- und Booking-Audits",
    description:
      "Entdecken Sie die Preise von Norixo Optimize für Ihre Airbnb- und Booking-Inseratsanalysen: Audit-Guthaben, Pakete für mehrere Inserate und Conversion-Optimierung für Ihre Unterkünfte.",
  },
  it: {
    title: "Prezzi di Norixo Optimize – Audit Airbnb e Booking",
    description:
      "Scopri i prezzi di Norixo Optimize per i tuoi audit di annunci Airbnb e Booking: crediti audit, pacchetti multi-annuncio e ottimizzazione della conversione per i tuoi alloggi.",
  },
  pt: {
    title: "Precos da Norixo Optimize – Auditorias Airbnb e Booking",
    description:
      "Descubra os precos da Norixo Optimize para as suas auditorias de anuncios Airbnb e Booking: creditos de auditoria, pacotes multi-anuncio e otimizacao da conversao para os seus alojamentos.",
  },
  nl: {
    title: "Norixo Optimize-prijzen – Airbnb- en Booking-audits",
    description:
      "Ontdek de prijzen van Norixo Optimize voor je Airbnb- en Booking-advertentie-audits: auditcredits, pakketten voor meerdere advertenties en conversie-optimalisatie voor je accommodaties.",
  },
  ja: {
    title: "Norixo Optimize 料金 – Airbnb・Booking監査",
    description:
      "Airbnb と Booking の掲載監査向け Norixo Optimize の料金をご覧ください。監査クレジット、複数掲載向けパック、コンバージョン最適化を確認できます。",
  },
  zh: {
    title: "Norixo Optimize 定价 – Airbnb 与 Booking 审计",
    description:
      "了解 Norixo Optimize 针对 Airbnb 和 Booking 房源审计的定价：审计额度、多房源套餐以及转化优化方案。",
  },
  ko: {
    title: "Norixo Optimize 요금 – Airbnb 및 Booking 감사",
    description:
      "Airbnb 및 Booking 숙소 감사를 위한 Norixo Optimize 요금을 확인하세요. 감사 크레딧, 다중 숙소 패키지, 전환 최적화를 살펴볼 수 있습니다.",
  },
  ar: {
    title: "أسعار Norixo Optimize – تدقيق إعلانات Airbnb وBooking",
    description:
      "اكتشف أسعار Norixo Optimize لتدقيق إعلانات Airbnb وBooking: أرصدة التدقيق، باقات متعددة الإعلانات، وتحسين التحويل لإقاماتك.",
  },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const metadataCopy = localizedMetadata[locale] ?? {
    title: pageTitle,
    description: pageDescription,
  };
  const alternates = buildHreflangAlternates("/pricing");

  return {
    title: metadataCopy.title,
    description: metadataCopy.description,
    alternates: {
      ...alternates,
      canonical: buildLocalizedUrl("/pricing", locale),
    },
    openGraph: {
      title: metadataCopy.title,
      description: metadataCopy.description,
      url: buildLocalizedUrl("/pricing", locale),
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

export default async function PricingPage({ params }: Props) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return <PricingContent />;
}
