import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { HowItWorksSections } from "@/components/marketing/HowItWorksSections";
import { isLocale, type Locale } from "@/data/i18n";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";
import { getSeoLocaleConfig } from "@/lib/seo/seoLocales";
import { buildLocalizedUrl } from "@/lib/seo/seoUrls";

type Props = {
  params: Promise<{
    locale: string;
  }>;
};

const pageTitle =
  "How Norixo Optimize works – Airbnb & Booking listing audit";
const pageDescription =
  "Discover how Norixo Optimize analyzes your Airbnb and Booking listings, evaluates your market position and generates practical recommendations to improve conversion.";

const localizedMetadata: Partial<Record<Locale, { title: string; description: string }>> = {
  ja: {
    title: "Norixo Optimize の仕組み – Airbnb・Booking掲載監査",
    description:
      "Norixo Optimize が Airbnb と Booking の掲載をどのように分析し、市場ポジションを評価し、コンバージョン改善のための実践的な提案を生成するかをご覧ください。",
  },
  zh: {
    title: "Norixo Optimize 的工作方式 – Airbnb 与 Booking 房源审计",
    description:
      "了解 Norixo Optimize 如何分析你的 Airbnb 和 Booking 房源、评估市场定位，并生成提升转化的实用建议。",
  },
  ko: {
    title: "Norixo Optimize 작동 방식 – Airbnb 및 Booking 숙소 감사",
    description:
      "Norixo Optimize가 Airbnb 및 Booking 숙소를 어떻게 분석하고, 시장 포지션을 평가하며, 전환 개선을 위한 실질적인 권장사항을 생성하는지 확인하세요.",
  },
  ar: {
    title: "كيف يعمل Norixo Optimize – تدقيق إعلانات Airbnb وBooking",
    description:
      "اكتشف كيف يحلل Norixo Optimize إعلانات Airbnb وBooking، ويقيّم موقعك في السوق، ويولّد توصيات عملية لتحسين التحويل.",
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

  return {
    title: metadataCopy.title,
    description: metadataCopy.description,
    alternates: {
      ...buildHreflangAlternates("/how-it-works"),
      canonical: buildLocalizedUrl("/how-it-works", locale),
    },
    openGraph: {
      title: metadataCopy.title,
      description: metadataCopy.description,
      url: buildLocalizedUrl("/how-it-works", locale),
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

export default async function HowItWorksPage({ params }: Props) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return (
    <MarketingPageShell>
      <main className="nk-section space-y-10 md:space-y-12">
        <div>
          <HowItWorksSections includeAnchorId showHeroPersuasionNote />
        </div>
      </main>
    </MarketingPageShell>
  );
}
