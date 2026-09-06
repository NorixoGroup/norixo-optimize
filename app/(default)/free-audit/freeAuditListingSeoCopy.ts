import type { Locale } from "@/data/i18n";

const SEO_COPY: Record<Locale, Readonly<{ title: string; description: string }>> = {
  en: { title: "Free Airbnb & Booking Listing Audit | Norixo", description: "Paste a public Airbnb, Booking, Expedia, Agoda or Vrbo listing URL and receive a free partial Norixo audit with a global score, key findings and priority recommendations." },
  fr: { title: "Audit gratuit d'annonce Airbnb & Booking | Norixo", description: "Collez l'URL publique d'une annonce Airbnb, Booking, Expedia, Agoda ou Vrbo et recevez un audit Norixo partiel gratuit avec score global, constats clés et recommandations prioritaires." },
  es: { title: "Auditoría gratuita de anuncios Airbnb y Booking | Norixo", description: "Pega la URL pública de un anuncio de Airbnb, Booking, Expedia, Agoda o Vrbo y recibe una auditoría parcial gratuita de Norixo con puntuación global, hallazgos clave y recomendaciones prioritarias." },
  it: { title: "Audit gratuito annunci Airbnb e Booking | Norixo", description: "Incolla l'URL pubblico di un annuncio Airbnb, Booking, Expedia, Agoda o Vrbo e ricevi un audit Norixo parziale gratuito con punteggio complessivo, risultati chiave e raccomandazioni prioritarie." },
  pt: { title: "Auditoria gratuita de anúncios Airbnb e Booking | Norixo", description: "Cole o URL público de um anúncio Airbnb, Booking, Expedia, Agoda ou Vrbo e receba uma auditoria parcial gratuita da Norixo com pontuação global, conclusões principais e recomendações prioritárias." },
  nl: { title: "Gratis Airbnb & Booking advertentie-audit | Norixo", description: "Plak de openbare URL van een Airbnb-, Booking-, Expedia-, Agoda- of Vrbo-advertentie en ontvang een gratis gedeeltelijke Norixo-audit met totaalscore, kernbevindingen en prioritaire aanbevelingen." },
  de: { title: "Kostenloser Airbnb & Booking Inserat-Audit | Norixo", description: "Füge die öffentliche URL eines Airbnb-, Booking-, Expedia-, Agoda- oder Vrbo-Inserats ein und erhalte einen kostenlosen teilweisen Norixo-Audit mit Gesamtbewertung, wichtigsten Erkenntnissen und priorisierten Empfehlungen." },
  ja: { title: "Airbnb・Booking 無料リスティング監査 | Norixo", description: "Airbnb、Booking、Expedia、Agoda、Vrbo の公開URLを貼り付け、総合スコア、主な所見、優先提案を含む Norixo の無料部分監査を受けられます。" },
  zh: { title: "Airbnb 与 Booking 免费房源审核 | Norixo", description: "粘贴 Airbnb、Booking、Expedia、Agoda 或 Vrbo 的公开房源 URL，免费获得 Norixo 部分审核，包括总评分、关键发现和优先建议。" },
  ko: { title: "Airbnb 및 Booking 무료 숙소 감사 | Norixo", description: "Airbnb, Booking, Expedia, Agoda 또는 Vrbo의 공개 숙소 URL을 붙여 넣고 종합 점수, 핵심 진단 및 우선 권장사항이 포함된 Norixo 무료 부분 감사를 받아보세요." },
  ar: { title: "تدقيق مجاني لإعلانات Airbnb وBooking | Norixo", description: "ألصق الرابط العام لإعلان على Airbnb أو Booking أو Expedia أو Agoda أو Vrbo واحصل على تدقيق جزئي مجاني من Norixo يتضمن النتيجة الإجمالية وأهم النتائج والتوصيات ذات الأولوية." },
};

export function getFreeAuditListingSeoCopy(locale: Locale) {
  return SEO_COPY[locale];
}
