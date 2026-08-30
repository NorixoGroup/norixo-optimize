import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { HowItWorksSections } from "@/components/marketing/HowItWorksSections";
import { isLocale, type Locale } from "@/data/i18n";
import { howItWorksI18n } from "@/data/marketing/howItWorksI18n";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";
import { getSeoLocaleConfig } from "@/lib/seo/seoLocales";
import { buildLocalizedPath, buildLocalizedUrl } from "@/lib/seo/seoUrls";

type Props = {
  params: Promise<{
    locale: string;
  }>;
};

const pageTitle =
  "How Norixo works – Airbnb & Booking listing audit";
const pageDescription =
  "Discover how Norixo analyzes your Airbnb and Booking listings, evaluates your market position and generates practical recommendations to improve conversion.";
const socialImage = "/og-cover.png";

const localizedMetadata: Partial<Record<Locale, { title: string; description: string }>> = {
  fr: {
    title: "Comment fonctionne Norixo – Audit d'annonce Airbnb & Booking",
    description:
      "Découvrez comment Norixo analyse vos annonces Airbnb et Booking, évalue votre position sur le marché et génère des recommandations concrètes pour améliorer la conversion.",
  },
  es: {
    title: "Cómo funciona Norixo – Auditoría de anuncios Airbnb y Booking",
    description:
      "Descubre cómo Norixo analiza tus anuncios de Airbnb y Booking, evalúa tu posición en el mercado y genera recomendaciones prácticas para mejorar la conversión.",
  },
  de: {
    title: "So funktioniert Norixo – Airbnb- und Booking-Inseratsanalyse",
    description:
      "Erfahren Sie, wie Norixo Ihre Airbnb- und Booking-Inserate analysiert, Ihre Marktposition bewertet und praktische Empfehlungen zur Verbesserung der Conversion erstellt.",
  },
  it: {
    title: "Come funziona Norixo – Audit degli annunci Airbnb e Booking",
    description:
      "Scopri come Norixo analizza i tuoi annunci Airbnb e Booking, valuta il tuo posizionamento sul mercato e genera raccomandazioni pratiche per migliorare la conversione.",
  },
  pt: {
    title: "Como funciona a Norixo – Auditoria de anúncios Airbnb e Booking",
    description:
      "Descubra como a Norixo analisa os seus anúncios Airbnb e Booking, avalia a sua posição no mercado e gera recomendações práticas para melhorar a conversão.",
  },
  nl: {
    title: "Hoe Norixo werkt – Audit van Airbnb- en Booking-vermeldingen",
    description:
      "Ontdek hoe Norixo je Airbnb- en Booking-vermeldingen analyseert, je marktpositie beoordeelt en praktische aanbevelingen genereert om de conversie te verbeteren.",
  },
  ja: {
    title: "Norixo の仕組み – Airbnb・Booking掲載監査",
    description:
      "Norixo が Airbnb と Booking の掲載をどのように分析し、市場ポジションを評価し、コンバージョン改善のための実践的な提案を生成するかをご覧ください。",
  },
  zh: {
    title: "Norixo 的工作方式 – Airbnb 与 Booking 房源审计",
    description:
      "了解 Norixo 如何分析你的 Airbnb 和 Booking 房源、评估市场定位，并生成提升转化的实用建议。",
  },
  ko: {
    title: "Norixo 작동 방식 – Airbnb 및 Booking 숙소 감사",
    description:
      "Norixo가 Airbnb 및 Booking 숙소를 어떻게 분석하고, 시장 포지션을 평가하며, 전환 개선을 위한 실질적인 권장사항을 생성하는지 확인하세요.",
  },
  ar: {
    title: "كيف يعمل Norixo – تدقيق إعلانات Airbnb وBooking",
    description:
      "اكتشف كيف يحلل Norixo إعلانات Airbnb وBooking، ويقيّم موقعك في السوق، ويولّد توصيات عملية لتحسين التحويل.",
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
  const alternates = buildHreflangAlternates("/how-it-works");

  return {
    title: metadataCopy.title,
    description: metadataCopy.description,
    alternates: {
      ...alternates,
      canonical: buildLocalizedUrl("/how-it-works", locale),
    },
    openGraph: {
      title: metadataCopy.title,
      description: metadataCopy.description,
      url: buildLocalizedUrl("/how-it-works", locale),
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

export default async function HowItWorksPage({ params }: Props) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const localizedPrimaryActionLabel =
    locale === "fr"
      ? "Lancer mon audit gratuit"
      : locale === "en"
        ? "Start my free audit"
        : (howItWorksI18n[locale] ?? howItWorksI18n.en).hero.primaryCta;
  const localizedPrimaryActionReassurance =
    locale === "fr"
      ? "Sans carte bancaire · Base sur les donnees agregees de votre marche"
      : locale === "en"
        ? "No credit card · Based on aggregated market data"
        : (howItWorksI18n[locale] ?? howItWorksI18n.en).hero.reassurance;

  return (
    <MarketingPageShell>
      <main className="nk-section space-y-10 md:space-y-12">
        <div>
          <HowItWorksSections
            includeAnchorId
            showHeroPersuasionNote
            primaryActionLabel={localizedPrimaryActionLabel}
            primaryActionHref={buildLocalizedPath("/free-audit", locale)}
            primaryActionReassurance={localizedPrimaryActionReassurance}
          />
        </div>
      </main>
    </MarketingPageShell>
  );
}
