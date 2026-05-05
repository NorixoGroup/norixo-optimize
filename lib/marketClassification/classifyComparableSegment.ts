/**
 * Classification segment comparables — couche lecture seule (v1).
 * Non branchée au pipeline : aucun impact sur accept/reject marché.
 */

export type ComparableSegment =
  | "studio_like"
  | "apartment_like"
  | "villa_like"
  | "house_like"
  | "hotel_like"
  | "unknown";

export type ComparableSegmentSignal = {
  source: "propertyType" | "title" | "description" | "url";
  value: string;
  weight?: number;
};

export type ComparableSegmentResult = {
  segment: ComparableSegment;
  confidence: number;
  signals: ComparableSegmentSignal[];
  raw: {
    propertyType?: string | null;
    title?: string | null;
    url?: string | null;
  };
};

export type ClassifyComparableSegmentInput = {
  propertyType?: string | null;
  title?: string | null;
  description?: string | null;
  url?: string | null;
  platform?: string | null;
};

function stripAccentsLower(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normField(value: string | null | undefined): string {
  return typeof value === "string" ? stripAccentsLower(value) : "";
}

type PatternDef = {
  /** Motif après normalisation (sans accents). */
  re: RegExp;
  /** Libellé court pour signal.value */
  label: string;
};

const STUDIO_PATTERNS: PatternDef[] = [
  { re: /\bstudio\b/, label: "studio" },
  { re: /\bstudette\b/, label: "studette" },
  { re: /\b1\s*[-]?\s*bedroom\b/, label: "1 bedroom" },
  { re: /\bone\s+bedroom\b/, label: "one bedroom" },
  { re: /\b1\s*bdr\b/, label: "1 bdr" },
  { re: /\bbdr\b/, label: "bdr" },
  { re: /\bt1\b/, label: "t1" },
];

/**
 * Signaux de **type de logement** : suffisants seuls pour envisager `apartment_like`
 * (priorité studio déjà traitée plus haut dans le pipeline de tiers).
 */
const APARTMENT_PRIMARY_PATTERNS: PatternDef[] = [
  { re: /\bappartements?\b/, label: "appartement" },
  { re: /\bapartments?\b/, label: "apartment" },
  { re: /\bapt\b/, label: "apt" },
  { re: /\bflat\b/, label: "flat" },
];

/**
 * Quartiers / zones (Gueliz, Médina…) : signaux **contextuels faibles**, pas des segments logement.
 * Ils ne doivent **pas** à eux seuls déclencher `apartment_like` (ex. riad/dar dont la description cite
 * seulement « medina » ou « hivernage »). Ne sont ajoutés aux `signals` que si au moins un primaire matche.
 */
const APARTMENT_WEAK_AREA_PATTERNS: PatternDef[] = [
  { re: /\bhivernage\b/, label: "hivernage" },
  { re: /\bgueliz\b/, label: "gueliz" },
  { re: /\bcentre\b/, label: "centre" },
  { re: /\bcenter\b/, label: "center" },
  { re: /\bmedinas?\b/, label: "medina" },
];

const VILLA_PATTERNS: PatternDef[] = [
  { re: /\bvillas?\b/, label: "villa" },
  { re: /\bprivate\s+pool\b/, label: "private pool" },
  { re: /\bpiscine\s+privee\b/, label: "piscine privee" },
  { re: /\bvilla\s+privee\b/, label: "villa privee" },
  { re: /\bpalais\b/, label: "palais" },
  { re: /\bdomaine\b/, label: "domaine" },
];

const HOUSE_PATTERNS: PatternDef[] = [
  { re: /\bhouses?\b/, label: "house" },
  { re: /\bmaisons?\b/, label: "maison" },
  { re: /\bdars?\b/, label: "dar" },
  { re: /\briads?\b/, label: "riad" },
];

const HOTEL_PATTERNS: PatternDef[] = [
  { re: /\bhotels?\b/, label: "hotel" },
  { re: /\bhostels?\b/, label: "hostel" },
  { re: /\bguest\s+houses?\b/, label: "guest house" },
  { re: /\bchambres?\b/, label: "chambre" },
  { re: /\brooms?\b/, label: "room" },
];

const FIELD_ORDER: ComparableSegmentSignal["source"][] = [
  "propertyType",
  "title",
  "url",
  "description",
];

function collectMatches(
  normalizedByField: Record<ComparableSegmentSignal["source"], string>,
  patterns: PatternDef[],
  signalSource: ComparableSegmentSignal["source"]
): ComparableSegmentSignal[] {
  const text = normalizedByField[signalSource];
  const out: ComparableSegmentSignal[] = [];
  const seen = new Set<string>();
  for (const { re, label } of patterns) {
    if (!re.test(text)) continue;
    const dedupeKey = `${signalSource}:${label}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push({ source: signalSource, value: label });
  }
  return out;
}

function firstTierWithHits(
  normalizedByField: Record<ComparableSegmentSignal["source"], string>,
  patterns: PatternDef[],
  segment: ComparableSegment
): { segment: ComparableSegment; signals: ComparableSegmentSignal[] } | null {
  const signals: ComparableSegmentSignal[] = [];
  for (const signalSource of FIELD_ORDER) {
    if (!normalizedByField[signalSource]) continue;
    const found = collectMatches(normalizedByField, patterns, signalSource);
    signals.push(...found);
  }
  if (signals.length === 0) return null;
  return { segment, signals };
}

const WEAK_AREA_SIGNAL_WEIGHT = 0.35;

/** `apartment_like` uniquement si au moins un signal logement primaire ; quartiers = signaux secondaires pondérés. */
function apartmentTierWithPrimaryRequired(
  normalizedByField: Record<ComparableSegmentSignal["source"], string>
): { segment: ComparableSegment; signals: ComparableSegmentSignal[] } | null {
  const primarySignals: ComparableSegmentSignal[] = [];
  for (const signalSource of FIELD_ORDER) {
    if (!normalizedByField[signalSource]) continue;
    primarySignals.push(
      ...collectMatches(normalizedByField, APARTMENT_PRIMARY_PATTERNS, signalSource)
    );
  }
  if (primarySignals.length === 0) return null;

  const weakSignals: ComparableSegmentSignal[] = [];
  for (const signalSource of FIELD_ORDER) {
    if (!normalizedByField[signalSource]) continue;
    for (const s of collectMatches(
      normalizedByField,
      APARTMENT_WEAK_AREA_PATTERNS,
      signalSource
    )) {
      weakSignals.push({ ...s, weight: WEAK_AREA_SIGNAL_WEIGHT });
    }
  }

  return {
    segment: "apartment_like",
    signals: [...primarySignals, ...weakSignals],
  };
}

function confidenceFromSignals(signals: ComparableSegmentSignal[]): number {
  const n = signals.length;
  /** v1 prudente : plafonne à 1, monte peu avec synonymes multiples */
  const base = 0.55;
  const perExtra = 0.12;
  return Math.min(1, base + (n - 1) * perExtra + Math.min(0.2, n * 0.05));
}

/**
 * Dérive un segment _like depuis champs listing, sans invoquer getNormalizedComparableType.
 * Ordre strict : studio > apartment > villa > house > hotel.
 */
export function classifyComparableSegment(input: ClassifyComparableSegmentInput): ComparableSegmentResult {
  const raw = {
    propertyType: input.propertyType ?? null,
    title: input.title ?? null,
    url: input.url ?? null,
  };

  const normalizedByField: Record<ComparableSegmentSignal["source"], string> = {
    propertyType: normField(input.propertyType),
    title: normField(input.title),
    description: normField(input.description),
    url: normField(input.url),
  };

  const studioHit = firstTierWithHits(
    normalizedByField,
    STUDIO_PATTERNS,
    "studio_like"
  );
  if (studioHit) {
    return {
      segment: studioHit.segment,
      confidence: confidenceFromSignals(studioHit.signals),
      signals: studioHit.signals,
      raw,
    };
  }

  const apartmentHit = apartmentTierWithPrimaryRequired(normalizedByField);
  if (apartmentHit) {
    return {
      segment: apartmentHit.segment,
      confidence: confidenceFromSignals(apartmentHit.signals),
      signals: apartmentHit.signals,
      raw,
    };
  }

  const lowerTiers: Array<{ patterns: PatternDef[]; segment: ComparableSegment }> = [
    { patterns: VILLA_PATTERNS, segment: "villa_like" },
    { patterns: HOUSE_PATTERNS, segment: "house_like" },
    { patterns: HOTEL_PATTERNS, segment: "hotel_like" },
  ];

  for (const { patterns, segment } of lowerTiers) {
    const hit = firstTierWithHits(normalizedByField, patterns, segment);
    if (hit) {
      return {
        segment: hit.segment,
        confidence: confidenceFromSignals(hit.signals),
        signals: hit.signals,
        raw,
      };
    }
  }

  return {
    segment: "unknown",
    confidence: 0,
    signals: [],
    raw,
  };
}
