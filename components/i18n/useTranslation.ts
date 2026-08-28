"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import { defaultLocale, type Locale } from "@/data/i18n";

const safeImpactCopy: Record<Locale, string> = {
  en: "Potential impact depends on the listing, market conditions, demand and the changes actually implemented.",
  fr: "L’impact potentiel dépend de l’annonce, du marché, de la demande et des changements réellement appliqués.",
  es: "El impacto potencial depende del anuncio, del mercado, de la demanda y de los cambios realmente aplicados.",
  de: "Die mögliche Wirkung hängt vom Inserat, den Marktbedingungen, der Nachfrage und den tatsächlich umgesetzten Änderungen ab.",
  it: "L’impatto potenziale dipende dall’annuncio, dalle condizioni di mercato, dalla domanda e dalle modifiche effettivamente applicate.",
  pt: "O impacto potencial depende do anúncio, das condições de mercado, da procura e das alterações efetivamente aplicadas.",
  nl: "De mogelijke impact hangt af van de advertentie, marktomstandigheden, vraag en de daadwerkelijk doorgevoerde wijzigingen.",
  ja: "期待できる影響は、リスティング、市場環境、需要、実際に行った変更によって異なります。",
  zh: "潜在影响取决于房源本身、市场状况、需求以及实际实施的改动。",
  ko: "잠재적 영향은 숙소, 시장 상황, 수요 및 실제로 적용한 변경 사항에 따라 달라집니다.",
  ar: "يعتمد الأثر المحتمل على الإعلان وظروف السوق والطلب والتغييرات التي يتم تطبيقها فعليًا.",
};

function normalizeNorixoPublicCopy(value: unknown, locale: Locale): unknown {
  if (typeof value === "string") {
    if (value.includes("+18%") && value.includes("+32%")) {
      return safeImpactCopy[locale] ?? safeImpactCopy[defaultLocale];
    }

    return value
      .replaceAll("Listing Conversion Optimizer", "Norixo")
      .replaceAll("Norixo Optimize", "Norixo");
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeNorixoPublicCopy(item, locale));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        normalizeNorixoPublicCopy(item, locale),
      ]),
    );
  }

  return value;
}

export function useTranslation<T extends Partial<Record<Locale, unknown>>>(dictionary: T) {
  const { locale } = useI18n();
  const resolvedLocale = dictionary[locale] ? locale : defaultLocale;
  const resolvedCopy = dictionary[resolvedLocale] ?? dictionary[defaultLocale];

  return {
    locale: resolvedLocale,
    copy: normalizeNorixoPublicCopy(resolvedCopy, resolvedLocale) as NonNullable<T[keyof T]>,
  };
}
