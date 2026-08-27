import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DemoContent } from "@/components/marketing/DemoContent";
import { VideoObjectJsonLd } from "@/components/seo/VideoObjectJsonLd";
import { isLocale, type Locale } from "@/data/i18n";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";
import { getSeoLocaleConfig } from "@/lib/seo/seoLocales";
import { buildLocalizedUrl } from "@/lib/seo/seoUrls";

type Props = {
  params: Promise<{
    locale: string;
  }>;
};

const pageTitle = "Norixo demo – Airbnb & Booking listing audit";
const pageDescription =
  "Preview how Norixo analyzes Airbnb and Booking listings, highlights optimization priorities and turns insights into practical actions.";
const socialImage = "/marketing/norixo-demo-thumbnail.jpg";

const localizedMetadata: Partial<Record<Locale, { title: string; description: string }>> = {
  fr: {
    title: "Démo Norixo – Audit d'annonce Airbnb & Booking",
    description:
      "Découvrez comment Norixo analyse les annonces Airbnb et Booking, met en avant les priorités d'optimisation et transforme les constats en actions concrètes.",
  },
  es: {
    title: "Demo de Norixo – Auditoría de anuncios Airbnb y Booking",
    description:
      "Descubre cómo Norixo analiza anuncios de Airbnb y Booking, destaca las prioridades de optimización y convierte los hallazgos en acciones concretas.",
  },
  de: {
    title: "Norixo Demo – Airbnb- und Booking-Inseratsanalyse",
    description:
      "Entdecken Sie, wie Norixo Airbnb- und Booking-Inserate analysiert, Optimierungsprioritäten sichtbar macht und Erkenntnisse in konkrete Maßnahmen umsetzt.",
  },
  it: {
    title: "Demo di Norixo – Audit degli annunci Airbnb e Booking",
    description:
      "Scopri come Norixo analizza gli annunci Airbnb e Booking, evidenzia le priorità di ottimizzazione e trasforma gli insight in azioni concrete.",
  },
  pt: {
    title: "Demo da Norixo – Auditoria de anúncios Airbnb e Booking",
    description:
      "Descubra como a Norixo analisa anúncios Airbnb e Booking, destaca as prioridades de otimização e transforma insights em ações concretas.",
  },
  nl: {
    title: "Norixo demo – Audit van Airbnb- en Booking-vermeldingen",
    description:
      "Ontdek hoe Norixo Airbnb- en Booking-vermeldingen analyseert, optimalisatieprioriteiten zichtbaar maakt en inzichten omzet in concrete acties.",
  },
  ja: {
    title: "Norixo デモ – Airbnb・Booking掲載監査",
    description:
      "Norixo が Airbnb と Booking の掲載をどのように分析し、最適化の優先順位を示し、実行可能な改善アクションへ変えるかを確認できます。",
  },
  zh: {
    title: "Norixo 演示 – Airbnb 与 Booking 房源审计",
    description:
      "预览 Norixo 如何分析 Airbnb 和 Booking 房源、标出优化优先级，并将洞察转化为可执行的改进措施。",
  },
  ko: {
    title: "Norixo 데모 – Airbnb 및 Booking 숙소 감사",
    description:
      "Norixo 데모에서 Airbnb 및 Booking 숙소를 분석하고 최적화하는 과정을 확인하세요. 숙소의 전환 개선 우선순위와 실행 가능한 권장사항이 어떻게 제시되는지 살펴볼 수 있습니다.",
  },
  ar: {
    title: "عرض Norixo – تدقيق إعلانات Airbnb وBooking",
    description:
      "اطّلع على كيفية تحليل Norixo لإعلانات Airbnb وBooking، وإبراز أولويات التحسين، وتحويل الرؤى إلى إجراءات عملية.",
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
  const alternates = buildHreflangAlternates("/demo");

  return {
    title: metadataCopy.title,
    description: metadataCopy.description,
    alternates: {
      ...alternates,
      canonical: buildLocalizedUrl("/demo", locale),
    },
    openGraph: {
      title: metadataCopy.title,
      description: metadataCopy.description,
      url: buildLocalizedUrl("/demo", locale),
      siteName: "Norixo",
      type: "website",
      locale: getSeoLocaleConfig(locale).ogLocale,
      images: [
        {
          url: socialImage,
          width: 1200,
          height: 675,
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

export default async function DemoPage({ params }: Props) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const isFrench = locale === "fr";

  const videoName = isFrench
    ? localizedMetadata.fr?.title ?? pageTitle
    : pageTitle;

  const videoDescription = isFrench
    ? localizedMetadata.fr?.description ?? pageDescription
    : pageDescription;

  return (
    <>
      <VideoObjectJsonLd
        name={videoName}
        description={videoDescription}
        contentUrl={
          isFrench
            ? "/marketing/norixo-demo-fr.mp4"
            : "/marketing/norixo-demo-en.mp4"
        }
        pageUrl={`/${locale}/demo`}
        language={isFrench ? "fr" : "en"}
      />
      <DemoContent />
    </>
  );
}
