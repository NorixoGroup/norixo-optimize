import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DemoContent } from "@/components/marketing/DemoContent";
import { isLocale, type Locale } from "@/data/i18n";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";
import { getSeoLocaleConfig } from "@/lib/seo/seoLocales";
import { buildLocalizedUrl } from "@/lib/seo/seoUrls";

type Props = {
  params: Promise<{
    locale: string;
  }>;
};

const pageTitle = "Norixo Optimize demo – Airbnb & Booking listing audit";
const pageDescription =
  "Preview how Norixo Optimize analyzes Airbnb and Booking listings, highlights optimization priorities and turns insights into practical actions.";

const localizedMetadata: Partial<Record<Locale, { title: string; description: string }>> = {
  ja: {
    title: "Norixo Optimize デモ – Airbnb・Booking掲載監査",
    description:
      "Norixo Optimize が Airbnb と Booking の掲載をどのように分析し、最適化の優先順位を示し、実行可能な改善アクションへ変えるかを確認できます。",
  },
  zh: {
    title: "Norixo Optimize 演示 – Airbnb 与 Booking 房源审计",
    description:
      "预览 Norixo Optimize 如何分析 Airbnb 和 Booking 房源、标出优化优先级，并将洞察转化为可执行的改进措施。",
  },
  ko: {
    title: "Norixo Optimize 데모 – Airbnb 및 Booking 숙소 감사",
    description:
      "Norixo Optimize가 Airbnb 및 Booking 숙소를 어떻게 분석하고, 최적화 우선순위를 제시하며, 인사이트를 실행 가능한 개선 조치로 바꾸는지 미리 확인하세요.",
  },
  ar: {
    title: "عرض Norixo Optimize – تدقيق إعلانات Airbnb وBooking",
    description:
      "اطّلع على كيفية تحليل Norixo Optimize لإعلانات Airbnb وBooking، وإبراز أولويات التحسين، وتحويل الرؤى إلى إجراءات عملية.",
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
      ...buildHreflangAlternates("/demo"),
      canonical: buildLocalizedUrl("/demo", locale),
    },
    openGraph: {
      title: metadataCopy.title,
      description: metadataCopy.description,
      url: buildLocalizedUrl("/demo", locale),
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

export default async function DemoPage({ params }: Props) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return <DemoContent />;
}
