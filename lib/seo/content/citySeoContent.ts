import type { Locale } from "@/data/i18n";

export type CitySeoContentInput = {
  city: {
    slug: string;
    name: string;
    country: string;
  };
  locale?: Locale;
};

const citySeoTemplates = {
  en: {
    title: (city: CitySeoContentInput["city"]) =>
      `${city.name} Airbnb listing optimization — practical guide | Listing Conversion Optimizer`,
    description: (city: CitySeoContentInput["city"]) =>
      `Optimize your Airbnb listing in ${city.name}, ${city.country}: how guests compare places, what to fix first, and practical steps to improve bookings—without guesswork.`,
    keywords: (city: CitySeoContentInput["city"]) => [
      `airbnb optimization ${city.name}`,
      `airbnb listing tips ${city.name}`,
      `improve airbnb bookings ${city.name}`,
      `airbnb listing audit ${city.name}`,
    ],
  },
  fr: {
    title: (city: CitySeoContentInput["city"]) =>
      `Optimisation d’annonce Airbnb à ${city.name} — guide pratique | Norixo`,
    description: (city: CitySeoContentInput["city"]) =>
      `Optimisez votre annonce Airbnb à ${city.name}, ${city.country} : comprenez comment les voyageurs comparent les logements, quoi corriger en priorité et comment améliorer vos réservations.`,
    keywords: (city: CitySeoContentInput["city"]) => [
      `optimisation airbnb ${city.name}`,
      `conseils annonce airbnb ${city.name}`,
      `améliorer réservations airbnb ${city.name}`,
      `audit annonce airbnb ${city.name}`,
    ],
  },
  es: {
    title: (city: CitySeoContentInput["city"]) =>
      `Optimización de anuncios Airbnb en ${city.name} — guía práctica | Norixo`,
    description: (city: CitySeoContentInput["city"]) =>
      `Optimiza tu anuncio de Airbnb en ${city.name}, ${city.country}: entiende cómo comparan los viajeros, qué corregir primero y cómo mejorar tus reservas.`,
    keywords: (city: CitySeoContentInput["city"]) => [
      `optimización airbnb ${city.name}`,
      `consejos anuncio airbnb ${city.name}`,
      `mejorar reservas airbnb ${city.name}`,
      `auditoría anuncio airbnb ${city.name}`,
    ],
  },
  de: {
    title: (city: CitySeoContentInput["city"]) =>
      `Airbnb-Inserat in ${city.name} optimieren — praktischer Leitfaden | Norixo`,
    description: (city: CitySeoContentInput["city"]) =>
      `Optimieren Sie Ihr Airbnb-Inserat in ${city.name}, ${city.country}: verstehen Sie, wie Gäste Unterkünfte vergleichen, was zuerst verbessert werden sollte und wie Sie mehr Buchungen erzielen.`,
    keywords: (city: CitySeoContentInput["city"]) => [
      `airbnb optimierung ${city.name}`,
      `airbnb inserat tipps ${city.name}`,
      `airbnb buchungen verbessern ${city.name}`,
      `airbnb inserat audit ${city.name}`,
    ],
  },
  it: {
    title: (city: CitySeoContentInput["city"]) =>
      `Ottimizzazione annuncio Airbnb a ${city.name} — guida pratica | Norixo`,
    description: (city: CitySeoContentInput["city"]) =>
      `Ottimizza il tuo annuncio Airbnb a ${city.name}, ${city.country}: capisci come i viaggiatori confrontano gli alloggi, cosa correggere prima e come aumentare le prenotazioni.`,
    keywords: (city: CitySeoContentInput["city"]) => [
      `ottimizzazione airbnb ${city.name}`,
      `consigli annuncio airbnb ${city.name}`,
      `aumentare prenotazioni airbnb ${city.name}`,
      `audit annuncio airbnb ${city.name}`,
    ],
  },
  pt: {
    title: (city: CitySeoContentInput["city"]) =>
      `Otimização de anúncio Airbnb em ${city.name} — guia prático | Norixo`,
    description: (city: CitySeoContentInput["city"]) =>
      `Otimize o seu anúncio Airbnb em ${city.name}, ${city.country}: perceba como os viajantes comparam alojamentos, o que corrigir primeiro e como melhorar as reservas.`,
    keywords: (city: CitySeoContentInput["city"]) => [
      `otimização airbnb ${city.name}`,
      `dicas anúncio airbnb ${city.name}`,
      `melhorar reservas airbnb ${city.name}`,
      `audit anúncio airbnb ${city.name}`,
    ],
  },
  nl: {
    title: (city: CitySeoContentInput["city"]) =>
      `Airbnb-advertentie optimaliseren in ${city.name} — praktische gids | Norixo`,
    description: (city: CitySeoContentInput["city"]) =>
      `Optimaliseer uw Airbnb-advertentie in ${city.name}, ${city.country}: begrijp hoe reizigers accommodaties vergelijken, wat u eerst moet verbeteren en hoe u meer boekingen kunt krijgen.`,
    keywords: (city: CitySeoContentInput["city"]) => [
      `airbnb optimalisatie ${city.name}`,
      `airbnb advertentie tips ${city.name}`,
      `airbnb boekingen verbeteren ${city.name}`,
      `airbnb advertentie audit ${city.name}`,
    ],
  },
  ja: {
    title: (city: CitySeoContentInput["city"]) =>
      `${city.name}のAirbnbリスティング最適化 — 実践ガイド | Norixo`,
    description: (city: CitySeoContentInput["city"]) =>
      `${city.name}、${city.country}でAirbnbリスティングを最適化しましょう。旅行者が宿泊先をどう比較するか、何を優先して改善すべきか、そして予約を伸ばすための実践的な手順を紹介します。`,
    keywords: (city: CitySeoContentInput["city"]) => [
      `${city.name} airbnb 最適化`,
      `${city.name} airbnb リスティングのコツ`,
      `${city.name} airbnb 予約を増やす`,
      `${city.name} airbnb リスティング監査`,
    ],
  },
  zh: {
    title: (city: CitySeoContentInput["city"]) =>
      `${city.name} Airbnb 房源优化——实用指南 | Norixo`,
    description: (city: CitySeoContentInput["city"]) =>
      `优化您在${city.name}（${city.country}）的 Airbnb 房源：了解旅客如何比较住宿、应优先修正什么，以及如何在不靠猜测的情况下提升预订。`,
    keywords: (city: CitySeoContentInput["city"]) => [
      `${city.name} airbnb 优化`,
      `${city.name} airbnb 房源技巧`,
      `${city.name} 提升 airbnb 预订`,
      `${city.name} airbnb 房源审计`,
    ],
  },
  ko: {
    title: (city: CitySeoContentInput["city"]) =>
      `${city.name} Airbnb 숙소 최적화 — 실전 가이드 | Norixo`,
    description: (city: CitySeoContentInput["city"]) =>
      `${city.name}, ${city.country}에서 Airbnb 숙소를 최적화하세요. 여행자가 숙소를 어떻게 비교하는지, 무엇을 먼저 개선해야 하는지, 그리고 추측이 아닌 실질적인 방법으로 예약을 늘리는 법을 안내합니다.`,
    keywords: (city: CitySeoContentInput["city"]) => [
      `${city.name} airbnb 최적화`,
      `${city.name} airbnb 숙소 팁`,
      `${city.name} airbnb 예약 늘리기`,
      `${city.name} airbnb 숙소 점검`,
    ],
  },
  ar: {
    title: (city: CitySeoContentInput["city"]) =>
      `تحسين إعلان Airbnb في ${city.name} — دليل عملي | Norixo`,
    description: (city: CitySeoContentInput["city"]) =>
      `حسّن إعلان Airbnb الخاص بك في ${city.name}، ${city.country}: افهم كيف يقارن المسافرون بين أماكن الإقامة، وما الذي يجب إصلاحه أولاً، وكيف يمكنك زيادة الحجوزات بخطوات عملية واضحة.`,
    keywords: (city: CitySeoContentInput["city"]) => [
      `تحسين airbnb ${city.name}`,
      `نصائح إعلان airbnb ${city.name}`,
      `زيادة حجوزات airbnb ${city.name}`,
      `تدقيق إعلان airbnb ${city.name}`,
    ],
  },
} satisfies Record<
  Locale,
  {
    title: (city: CitySeoContentInput["city"]) => string;
    description: (city: CitySeoContentInput["city"]) => string;
    keywords: (city: CitySeoContentInput["city"]) => string[];
  }
>;

export function buildCitySeoContent(input: CitySeoContentInput) {
  const locale = input.locale ?? "en";
  const template = citySeoTemplates[locale] ?? citySeoTemplates.en;

  return {
    title: template.title(input.city),
    description: template.description(input.city),
    keywords: template.keywords(input.city),
  };
}
