import { cities as knownCities } from "@/data/cities";
import {
  canonicalizeMarketCity,
  canonicalizeMarketCountry,
} from "@/lib/competitors/marketNormalization";

export type GeographyCandidateClassificationStatus =
  | "canonical"
  | "recoverable"
  | "district"
  | "ambiguous"
  | "invalid"
  | "missing";

export type GeographyCandidateClassificationInput = Readonly<{
  rawCountry?: string | null;
  rawCity?: string | null;
  comparableCountries?: ReadonlyArray<string | null> | null;
  comparableCities?: ReadonlyArray<string | null> | null;
  source?: string | null;
}>;

export type GeographyCandidateClassificationResult = Readonly<{
  status: GeographyCandidateClassificationStatus;
  country?: string;
  city?: string;
  confidence: "high" | "medium" | "low";
  reasonCodes: string[];
}>;

export type KnownCityCountryLookupResult =
  | Readonly<{ ok: true; country: string }>
  | Readonly<{ ok: false; reason: "missing_city" | "unknown_city" | "ambiguous_city" }>;

const CANONICAL_OR_RECOVERABLE_STATUSES = new Set<
  GeographyCandidateClassificationStatus
>(["canonical", "recoverable"]);

const INVALID_TECHNICAL_CITY_KEYS = new Set([
  "http",
  "https",
  "www",
  "unknown",
  "untitled",
]);

const INVALID_PROPERTY_TYPE_CITY_KEYS = new Set([
  "studio",
  "apartment",
  "appartement",
  "hotel",
  "room",
  "chambre",
  "villa",
  "riad",
]);

const INVALID_PROPERTY_ATTRIBUTE_CITY_KEYS = new Set([
  "piscine",
  "pool",
  "parking",
  "wifi",
  "spa",
]);

const INVALID_MARKETING_CITY_KEYS = new Set([
  "standing",
  "confortable",
  "luxury",
  "deluxe",
  "central",
]);

const DISTRICT_OR_SEPARATE_MUNICIPALITY_KEYS = new Set([
  "gueliz",
  "palmeraie",
  "shinjuku",
  "caversham",
  "levallois perret",
  "l hospitalet de llobregat",
  "sant adria de besos",
]);

const DESCRIPTIVE_CONNECTOR_KEYS = new Set([
  "a",
  "avec",
  "and",
  "et",
  "pres",
  "près",
  "near",
  "dans",
  "de",
  "du",
  "la",
  "le",
]);

const COUNTRY_CODE_TO_LABEL = buildCountryCodeToLabel();
const KNOWN_CITY_TO_COUNTRY_LOOKUP = buildKnownCityToCountryLookup();
const KNOWN_CANONICAL_CITY_KEYS = new Set(KNOWN_CITY_TO_COUNTRY_LOOKUP.keys());

function buildCountryCodeToLabel(): ReadonlyMap<string, string> {
  const labels = new Map<string, string>();

  for (const city of knownCities) {
    const code = canonicalizeMarketCountry(city.country);
    const label = normalizeCountryLabel(city.country);
    if (code == null || label == null || labels.has(code)) {
      continue;
    }
    labels.set(code, label);
  }

  const fallbacks: Array<readonly [string, string]> = [
    ["ma", "morocco"],
    ["fr", "france"],
    ["es", "spain"],
    ["pt", "portugal"],
    ["it", "italy"],
    ["de", "germany"],
    ["be", "belgium"],
    ["gb", "united kingdom"],
    ["us", "united states"],
  ];

  for (const [code, label] of fallbacks) {
    if (!labels.has(code)) {
      labels.set(code, label);
    }
  }

  return labels;
}

function buildKnownCityToCountryLookup(): ReadonlyMap<string, readonly string[]> {
  const countriesByCity = new Map<string, Set<string>>();

  for (const city of knownCities) {
    const canonicalCountry = canonicalCountryLabel(city.country);
    const canonicalCity = canonicalizeMarketCity(city.name);
    const key = normalizeLookupKey(canonicalCity ?? city.name);
    if (canonicalCountry == null || key == null) {
      continue;
    }

    const current = countriesByCity.get(key);
    if (current) {
      current.add(canonicalCountry);
      continue;
    }

    countriesByCity.set(key, new Set([canonicalCountry]));
  }

  return new Map(
    [...countriesByCity.entries()].map(([key, countries]) => [
      key,
      Object.freeze([...countries].sort()),
    ]),
  );
}

function normalizeWhitespace(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeLookupKey(value: string | null | undefined): string | null {
  const normalized = normalizeWhitespace(value);
  if (normalized == null) {
    return null;
  }

  return normalized
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCountryLabel(value: string | null | undefined): string | null {
  const normalized = normalizeWhitespace(value);
  if (normalized == null) {
    return null;
  }

  return normalized
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalCountryLabel(value: string | null | undefined): string | null {
  const canonical = canonicalizeMarketCountry(value);
  if (canonical == null) {
    return null;
  }

  return COUNTRY_CODE_TO_LABEL.get(canonical) ?? normalizeCountryLabel(canonical);
}

function normalizeCityValue(value: string | null | undefined): string | null {
  const normalized = normalizeWhitespace(value);
  if (normalized == null) {
    return null;
  }

  const canonical = canonicalizeMarketCity(normalized);
  return canonical ?? normalizeLookupKey(normalized);
}

function buildReasonedResult(
  status: GeographyCandidateClassificationStatus,
  reasonCodes: string[],
  options?: Readonly<{
    city?: string | null;
    country?: string | null;
    confidence?: "high" | "medium" | "low";
  }>,
): GeographyCandidateClassificationResult {
  return Object.freeze({
    status,
    ...(options?.country ? { country: options.country } : {}),
    ...(options?.city ? { city: options.city } : {}),
    confidence: options?.confidence ?? "low",
    reasonCodes: [...new Set(reasonCodes)],
  });
}

function resolveUniqueComparableCity(
  values: ReadonlyArray<string | null> | null | undefined,
): string | null {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }

  const uniqueCities = new Set<string>();
  for (const value of values) {
    const comparableCity = normalizeCityValue(value);
    if (comparableCity == null) {
      continue;
    }

    const classification = classifyGeographyCandidate({
      rawCity: comparableCity,
      rawCountry: null,
      comparableCities: [],
      comparableCountries: [],
      source: "comparable_city_support",
    });

    if (!CANONICAL_OR_RECOVERABLE_STATUSES.has(classification.status)) {
      continue;
    }

    if (classification.city != null) {
      uniqueCities.add(classification.city);
    }
  }

  if (uniqueCities.size !== 1) {
    return null;
  }

  return [...uniqueCities][0] ?? null;
}

function classifySingleValue(
  rawCountry: string | null | undefined,
  rawCity: string | null | undefined,
): GeographyCandidateClassificationResult {
  const city = normalizeCityValue(rawCity);
  const country = canonicalCountryLabel(rawCountry);

  if (city == null) {
    return buildReasonedResult("missing", ["missing_city"], {
      country,
      confidence: "low",
    });
  }

  const lookupKey = normalizeLookupKey(city);
  const cityWords = (lookupKey ?? "")
    .split(" ")
    .map((word) => word.trim())
    .filter(Boolean);

  if (
    lookupKey != null &&
    (INVALID_TECHNICAL_CITY_KEYS.has(lookupKey) ||
      lookupKey.includes("http ") ||
      lookupKey.includes(" https") ||
      lookupKey.startsWith("www "))
  ) {
    return buildReasonedResult("invalid", ["invalid_city_url_fragment"], {
      city,
      country,
      confidence: "high",
    });
  }

  if (lookupKey != null && INVALID_PROPERTY_TYPE_CITY_KEYS.has(lookupKey)) {
    return buildReasonedResult("invalid", ["invalid_city_property_type"], {
      city,
      country,
      confidence: "high",
    });
  }

  if (lookupKey != null && INVALID_PROPERTY_ATTRIBUTE_CITY_KEYS.has(lookupKey)) {
    return buildReasonedResult("invalid", ["invalid_city_property_attribute"], {
      city,
      country,
      confidence: "high",
    });
  }

  if (lookupKey != null && INVALID_MARKETING_CITY_KEYS.has(lookupKey)) {
    return buildReasonedResult("invalid", ["invalid_city_marketing_word"], {
      city,
      country,
      confidence: "high",
    });
  }

  if (lookupKey != null && DISTRICT_OR_SEPARATE_MUNICIPALITY_KEYS.has(lookupKey)) {
    return buildReasonedResult("district", ["district_not_supported_as_city"], {
      city,
      country,
      confidence: "medium",
    });
  }

  const invalidWordMatches = cityWords.filter(
    (word) =>
      INVALID_PROPERTY_TYPE_CITY_KEYS.has(word) ||
      INVALID_PROPERTY_ATTRIBUTE_CITY_KEYS.has(word) ||
      INVALID_MARKETING_CITY_KEYS.has(word) ||
      INVALID_TECHNICAL_CITY_KEYS.has(word),
  );

  if (
    invalidWordMatches.length >= 2 ||
    (invalidWordMatches.length >= 1 &&
      cityWords.length >= 4 &&
      cityWords.some((word) => DESCRIPTIVE_CONNECTOR_KEYS.has(word)))
  ) {
    return buildReasonedResult("invalid", ["invalid_city_descriptive_phrase"], {
      city,
      country,
      confidence: "high",
    });
  }

  const inferredCountry = inferCountryFromKnownCity(city);
  const rawCountryMatchesKnownCity =
    country == null ||
    (inferredCountry.ok && inferredCountry.country === country);

  if (lookupKey != null && KNOWN_CANONICAL_CITY_KEYS.has(lookupKey) && rawCountryMatchesKnownCity) {
    const normalizedInputCity = normalizeLookupKey(rawCity);
    const canonicalCountry = country ?? (inferredCountry.ok ? inferredCountry.country : null);
    const usedAlias = normalizedInputCity != null && normalizedInputCity !== lookupKey;
    const inferredCountryOnly = country == null && inferredCountry.ok;

    if (usedAlias || inferredCountryOnly) {
      return buildReasonedResult(
        "recoverable",
        [
          ...(usedAlias ? ["city_alias_normalized"] : []),
          ...(inferredCountryOnly ? ["country_inferred_from_known_city"] : []),
        ],
        {
          city,
          country: canonicalCountry,
          confidence: "high",
        },
      );
    }

    return buildReasonedResult("canonical", ["canonical_city"], {
      city,
      country: canonicalCountry,
      confidence: "high",
    });
  }

  if (country != null && inferredCountry.ok && inferredCountry.country !== country) {
    return buildReasonedResult("ambiguous", ["country_city_mismatch"], {
      city,
      country,
      confidence: "low",
    });
  }

  return buildReasonedResult("ambiguous", ["ambiguous_city_candidate"], {
    city,
    country,
    confidence: "low",
  });
}

export function inferCountryFromKnownCity(
  city: string | null | undefined,
  lookup: ReadonlyMap<string, readonly string[]> = KNOWN_CITY_TO_COUNTRY_LOOKUP,
): KnownCityCountryLookupResult {
  const canonicalCity = normalizeCityValue(city);
  const key = normalizeLookupKey(canonicalCity ?? city);
  if (key == null) {
    return { ok: false, reason: "missing_city" };
  }

  const countries = lookup.get(key);
  if (countries == null || countries.length === 0) {
    return { ok: false, reason: "unknown_city" };
  }
  if (countries.length > 1) {
    return { ok: false, reason: "ambiguous_city" };
  }

  return { ok: true, country: countries[0]! };
}

export function classifyGeographyCandidate(
  input: GeographyCandidateClassificationInput,
): GeographyCandidateClassificationResult {
  const directClassification = classifySingleValue(
    input.rawCountry ?? null,
    input.rawCity ?? null,
  );

  if (directClassification.status !== "missing") {
    return directClassification;
  }

  const comparableCity = resolveUniqueComparableCity(input.comparableCities);
  if (comparableCity == null) {
    return directClassification;
  }

  const recoveredClassification = classifySingleValue(
    input.rawCountry ?? null,
    comparableCity,
  );

  if (!CANONICAL_OR_RECOVERABLE_STATUSES.has(recoveredClassification.status)) {
    return directClassification;
  }

  return buildReasonedResult(
    "recoverable",
    [
      ...recoveredClassification.reasonCodes,
      "city_recovered_from_comparables",
    ],
    {
      city: recoveredClassification.city,
      country: recoveredClassification.country,
      confidence: "medium",
    },
  );
}

export function isCanonicalOrRecoverableGeographyCandidate(
  input: GeographyCandidateClassificationResult | GeographyCandidateClassificationStatus,
): boolean {
  const status = typeof input === "string" ? input : input.status;
  return CANONICAL_OR_RECOVERABLE_STATUSES.has(status);
}
