import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ContactContent } from "@/components/marketing/ContactContent";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { isLocale, type Locale } from "@/data/i18n";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";
import { getSeoLocaleConfig } from "@/lib/seo/seoLocales";
import { buildLocalizedUrl } from "@/lib/seo/seoUrls";

type Props = {
  params: Promise<{
    locale: string;
  }>;
};

const socialImage = "/og-cover.png";

const localizedMetadata: Record<Locale, { title: string; description: string }> = {
  en: {
    title: "Contact Norixo | Norixo",
    description: "Contact Norixo for product, billing, support or personal-data questions.",
  },
  fr: {
    title: "Contacter Norixo | Norixo",
    description: "Contactez Norixo pour toute question sur le produit, la facturation, le support ou vos données personnelles.",
  },
  es: {
    title: "Contactar con Norixo | Norixo",
    description: "Contacta con Norixo para preguntas sobre el producto, la facturación, el soporte o tus datos personales.",
  },
  de: {
    title: "Norixo kontaktieren | Norixo",
    description: "Kontaktieren Sie Norixo bei Fragen zum Produkt, zur Abrechnung, zum Support oder zu Ihren personenbezogenen Daten.",
  },
  it: {
    title: "Contatta Norixo | Norixo",
    description: "Contatta Norixo per domande sul prodotto, sulla fatturazione, sull'assistenza o sui tuoi dati personali.",
  },
  pt: {
    title: "Contactar a Norixo | Norixo",
    description: "Contacte a Norixo para questões sobre o produto, faturação, apoio ao cliente ou os seus dados pessoais.",
  },
  nl: {
    title: "Contact opnemen met Norixo | Norixo",
    description: "Neem contact op met Norixo voor vragen over het product, facturatie, ondersteuning of uw persoonsgegevens.",
  },
  ja: {
    title: "Norixo へのお問い合わせ | Norixo",
    description: "製品、請求、サポート、個人データに関するご質問は Norixo までお問い合わせください。",
  },
  zh: {
    title: "联系 Norixo | Norixo",
    description: "如对产品、账单、支持或个人数据有任何问题，请联系 Norixo。",
  },
  ko: {
    title: "Norixo 문의 | Norixo",
    description: "제품, 청구, 지원 또는 개인정보 관련 문의는 Norixo로 연락해 주세요.",
  },
  ar: {
    title: "اتصل بـ Norixo | Norixo",
    description: "تواصل مع Norixo للاستفسار عن المنتج أو الفوترة أو الدعم أو بياناتك الشخصية.",
  },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const metadataCopy = localizedMetadata[locale];
  const alternates = buildHreflangAlternates("/contact");

  return {
    title: metadataCopy.title,
    description: metadataCopy.description,
    alternates: {
      ...alternates,
      canonical: buildLocalizedUrl("/contact", locale),
    },
    openGraph: {
      title: metadataCopy.title,
      description: metadataCopy.description,
      url: buildLocalizedUrl("/contact", locale),
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

export default async function ContactPage({ params }: Props) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return (
    <MarketingPageShell>
      <ContactContent />
    </MarketingPageShell>
  );
}
