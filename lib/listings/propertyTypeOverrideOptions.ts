import { isLocale, type Locale } from "@/data/i18n";

/** Valeurs POST /api/audits et `SearchCompetitorsInput.propertyTypeOverride` (hors chaîne vide). */
export type PropertyTypeOverrideSlug =
  | "studio"
  | "apartment"
  | "villa"
  | "riad"
  | "room"
  | "hotel";

const ALLOWED = new Set<PropertyTypeOverrideSlug>([
  "studio",
  "apartment",
  "villa",
  "riad",
  "room",
  "hotel",
]);

type PropertyTypeOptionValue = "" | PropertyTypeOverrideSlug;

type PropertyTypeOption = {
  value: PropertyTypeOptionValue;
  label: string;
};

const PROPERTY_TYPE_LABELS: Record<
  Locale,
  Record<PropertyTypeOptionValue, string>
> = {
  en: {
    "": "Choose the property type",
    studio: "Studio",
    apartment: "Apartment",
    villa: "Villa / House",
    riad: "Riad / Dar",
    room: "Room",
    hotel: "Hotel",
  },
  fr: {
    "": "Choisir le type de bien",
    studio: "Studio",
    apartment: "Appartement",
    villa: "Villa / Maison",
    riad: "Riad / Dar",
    room: "Chambre",
    hotel: "Hôtel",
  },
  es: {
    "": "Elegir el tipo de alojamiento",
    studio: "Estudio",
    apartment: "Apartamento",
    villa: "Villa / Casa",
    riad: "Riad / Dar",
    room: "Habitación",
    hotel: "Hotel",
  },
  de: {
    "": "Unterkunftstyp wählen",
    studio: "Studio",
    apartment: "Apartment",
    villa: "Villa / Haus",
    riad: "Riad / Dar",
    room: "Zimmer",
    hotel: "Hotel",
  },
  it: {
    "": "Scegli il tipo di alloggio",
    studio: "Monolocale",
    apartment: "Appartamento",
    villa: "Villa / Casa",
    riad: "Riad / Dar",
    room: "Camera",
    hotel: "Hotel",
  },
  pt: {
    "": "Escolha o tipo de alojamento",
    studio: "Estúdio",
    apartment: "Apartamento",
    villa: "Villa / Casa",
    riad: "Riad / Dar",
    room: "Quarto",
    hotel: "Hotel",
  },
  nl: {
    "": "Kies het type accommodatie",
    studio: "Studio",
    apartment: "Appartement",
    villa: "Villa / Huis",
    riad: "Riad / Dar",
    room: "Kamer",
    hotel: "Hotel",
  },
  ja: {
    "": "宿泊施設タイプを選択",
    studio: "スタジオ",
    apartment: "アパートメント",
    villa: "ヴィラ / 一軒家",
    riad: "リヤド / ダール",
    room: "部屋",
    hotel: "ホテル",
  },
  zh: {
    "": "选择房源类型",
    studio: "单间公寓",
    apartment: "公寓",
    villa: "别墅 / 独栋住宅",
    riad: "Riad / Dar",
    room: "房间",
    hotel: "酒店",
  },
  ko: {
    "": "숙소 유형 선택",
    studio: "스튜디오",
    apartment: "아파트",
    villa: "빌라 / 주택",
    riad: "리아드 / 다르",
    room: "객실",
    hotel: "호텔",
  },
  ar: {
    "": "اختر نوع الإقامة",
    studio: "استوديو",
    apartment: "شقة",
    villa: "فيلا / منزل",
    riad: "رياض / دار",
    room: "غرفة",
    hotel: "فندق",
  },
};

const PROPERTY_TYPE_VALUES: readonly PropertyTypeOptionValue[] = [
  "",
  "studio",
  "apartment",
  "villa",
  "riad",
  "room",
  "hotel",
] as const;

function getActiveLocale(): Locale {
  if (typeof window !== "undefined") {
    const firstSegment = window.location.pathname.split("/").filter(Boolean)[0];
    if (firstSegment && isLocale(firstSegment)) {
      return firstSegment;
    }

    const storedLocale = window.localStorage.getItem("norixo-locale");
    if (storedLocale && isLocale(storedLocale)) {
      return storedLocale;
    }
  }

  return "en";
}

function getPropertyTypeLabel(value: PropertyTypeOptionValue, locale = getActiveLocale()): string {
  return PROPERTY_TYPE_LABELS[locale][value];
}

export function getPropertyTypeOptions(locale = getActiveLocale()): ReadonlyArray<PropertyTypeOption> {
  return PROPERTY_TYPE_VALUES.map((value) => ({
    value,
    get label() {
      return getPropertyTypeLabel(value, locale);
    },
  }));
}

export const PROPERTY_TYPE_OPTIONS: ReadonlyArray<{
  value: "" | PropertyTypeOverrideSlug;
  label: string;
}> = PROPERTY_TYPE_VALUES.map((value) => ({
  value,
  get label() {
    return getPropertyTypeLabel(value);
  },
}));

export function parsePropertyTypeOverride(raw: unknown): PropertyTypeOverrideSlug | undefined {
  if (typeof raw !== "string") return undefined;
  const t = raw.trim().toLowerCase();
  if (!t) return undefined;
  return ALLOWED.has(t as PropertyTypeOverrideSlug) ? (t as PropertyTypeOverrideSlug) : undefined;
}

/** Valeurs `propertyType` cohérentes avec `getNormalizedComparableType` (tokens primaires). */
export function mapPropertyTypeOverrideToListingPropertyType(
  slug: PropertyTypeOverrideSlug
): string {
  switch (slug) {
    case "studio":
      return "studio";
    case "apartment":
      return "appartement";
    case "villa":
      return "villa";
    case "riad":
      return "riad";
    case "room":
      return "chambre";
    case "hotel":
      return "hotel";
  }
}

/** Profil _like pour les logs DEBUG (spec produit — peut différer du typage affiné listing). */
export function normalizeOverrideTypeForMarketDebug(slug: string): string | null {
  switch (slug.trim().toLowerCase()) {
    case "studio":
    case "apartment":
      return "apartment_like";
    case "villa":
      return "villa_like";
    case "riad":
      return "riad_like";
    case "room":
      return "room_like";
    case "hotel":
      return "hotel_like";
    default:
      return null;
  }
}
