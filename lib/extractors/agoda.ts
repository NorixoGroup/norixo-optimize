import * as cheerio from "cheerio";
import axios from "axios";
import type { ExtractorResult } from "./types";
import {
  fetchUnlockedPageData,
  type CapturedNetworkPayload,
} from "@/lib/brightdata";
import {
  buildFieldMeta,
  buildPhotoMeta,
  inferDescriptionQuality,
  inferPhotoQuality,
  inferTitleQuality,
} from "./quality";
import {
  dedupeImageUrls,
  extractImageUrlsFromUnknown,
  normalizeWhitespace,
  uniqueStrings,
} from "./shared";

const DEBUG_GUEST_AUDIT = process.env.DEBUG_GUEST_AUDIT === "true";

function debugGuestAuditLog(...args: unknown[]) {
  if (!DEBUG_GUEST_AUDIT) return;
  console.log(...args);
}

type TextCandidate = {
  source: string;
  value: string;
};

type NumericCandidate = {
  source: string;
  value: string;
  parsed: number | null;
};

type AgodaGallerySnapshot = {
  urls: string[];
  total: number | null;
  source: string | null;
};

function extractJsonLd(html: string): Record<string, unknown>[] {
  const $ = cheerio.load(html);
  const blocks: Record<string, unknown>[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).html();
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((item) => {
          if (item && typeof item === "object") {
            blocks.push(item as Record<string, unknown>);
          }
        });
      } else if (parsed && typeof parsed === "object") {
        blocks.push(parsed as Record<string, unknown>);
      }
    } catch {
      // ignore invalid json-ld
    }
  });

  return blocks;
}

function safeJsonParse<T = unknown>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function extractStructuredScriptData(html: string): unknown[] {
  const $ = cheerio.load(html);
  const blocks: unknown[] = [];

  $("script").each((_, el) => {
    const raw = $(el).html()?.trim();
    if (!raw || raw.length < 2) return;

    if (raw.startsWith("{") || raw.startsWith("[")) {
      try {
        blocks.push(JSON.parse(raw));
        return;
      } catch {
        // ignore
      }
    }

    const assignmentPatterns = [
      /__INITIAL_STATE__\s*=\s*({[\s\S]*?})\s*;/,
      /window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?})\s*;/,
      /window\.__NEXT_DATA__\s*=\s*({[\s\S]*?})\s*;/,
    ];

    for (const pattern of assignmentPatterns) {
      const match = raw.match(pattern);
      if (!match?.[1]) continue;

      try {
        blocks.push(JSON.parse(match[1]));
        break;
      } catch {
        // ignore
      }
    }
  });

  return blocks;
}

function collectStringValuesByKeyPattern(
  value: unknown,
  pattern: RegExp,
  path = "root"
): TextCandidate[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      collectStringValuesByKeyPattern(item, pattern, `${path}.${index}`)
    );
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;

    return Object.entries(record).flatMap(([key, entry]) => {
      const nextPath = `${path}.${key}`;
      const direct =
        pattern.test(key) && typeof entry === "string"
          ? [{ source: nextPath, value: normalizeWhitespace(entry) }]
          : [];

      return [...direct, ...collectStringValuesByKeyPattern(entry, pattern, nextPath)];
    });
  }

  return [];
}

function scoreDescriptionCandidate(candidate: TextCandidate): number {
  const value = normalizeWhitespace(candidate.value);
  if (!value) return -1;

  if (
    /window\.|propertypageparams|promise\.resolve|function\s*\(|__next_data__/i.test(value)
  ) {
    return -1;
  }

  const lowerSource = candidate.source.toLowerCase();
  const lowerValue = value.toLowerCase();
  let score = value.length;

  if (isAgodaLocationPoiText(value) || isAgodaPolicyRulesText(value)) return -1;

  if (
    lowerSource.includes("description") ||
    lowerSource.includes("overview") ||
    lowerSource.includes("about") ||
    lowerSource.includes("summary")
  ) {
    score += 250;
  }
  if (lowerSource.includes("abouthost") || lowerSource.includes("hostprofile") || lowerSource.includes("host")) {
    score -= 320;
  }
  if (
    lowerSource.includes("legal") ||
    lowerSource.includes("policy") ||
    lowerSource.includes("guestpolicies") ||
    lowerSource.includes("childpolicies") ||
    lowerSource.includes("extrabed") ||
    lowerSource.includes("usefulinfogroups")
  ) {
    score -= 420;
  }

  if (lowerSource.includes("json_ld")) score += 100;
  if (lowerSource.includes("meta_description")) score += 30;
  if (lowerSource.includes("marketing")) score -= 120;
  if (lowerSource.includes("aboutHotel.hotelDesc.overview".toLowerCase())) score -= 60;
  if (lowerSource.includes("html_narrative_details")) score += 420;

  if (
    /profitez d['’]un sejour|séjour tout confort|why choose this property|about this property|pourquoi choisir cet etablissement|studio fonctionnel|studio elegant|acc[eè]s gratuit a la piscine|parfait pour un couple|voyageur solo|parking priv[eé]/i.test(
      lowerValue
    )
  ) {
    score += 260;
  }

  if (value.length < 120) score -= 160;
  if (
    lowerValue.includes("popular facilities") ||
    lowerValue.includes("agoda homes") ||
    lowerValue.includes("see all") ||
    lowerValue.includes("great location") ||
    lowerValue.includes("the facilities and services provided by") ||
    lowerValue.includes("around the property")
  ) {
    score -= 220;
  }

  return score;
}

function isAgodaLocationPoiText(value: string) {
  const normalized = normalizeWhitespace(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (!normalized) return false;

  const strongPoiPatterns = [
    /aeroports?\s+a\s+proximite/,
    /transports?\s+en\s+commun/,
    /hopitaux?\s+et\s+cliniques?/,
    /shopping\s+(nearby|a\s+proximite)/,
    /activites?\s+a\s+proximite/,
    /lieux?\s+a\s+voir\s+(en\s+vogue|a\s+proximite)/,
    /nearby airports?/,
    /public transportation/,
    /hospitals?\s*(and|&)\s*clinics?/,
    /things to do nearby/,
    /top sights nearby/,
    /distributeur\s+de\s+billets/,
    /superettes?/,
    /\batm\b/,
  ];
  if (strongPoiPatterns.some((pattern) => pattern.test(normalized))) return true;

  const weakSignals = [
    "emplacement",
    "gueliz",
    "marrakech",
    "maroc",
    "airport",
    "transport",
    "shopping",
    "attraction",
    "nearby",
    "poi",
  ];
  const weakHits = weakSignals.filter((signal) => normalized.includes(signal)).length;
  return weakHits >= 4;
}

function isAgodaPolicyRulesText(value: string) {
  const normalized = normalizeWhitespace(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (!normalized) return false;

  const strongPolicyPatterns = [
    /conditions?\s+de\s+l['’]?etablissement/,
    /enfants?\s+et\s+lits?\s+supplementaires?/,
    /regles?\s+du\s+logement/,
    /pour\s+votre\s+information/,
    /arrivee\s*\/\s*depart/,
    /check[- ]?in\s+a\s+partir\s+de/,
    /check[- ]?out\s+jusqu['’]?a/,
    /enregistrement\s+jusqu['’]?a/,
    /numero\s+de\s+licence/,
    /\bice\b/,
    /house\s+rules?/,
    /children\s+and\s+extra\s+beds?/,
    /useful\s+info/,
    /property\s+polic(y|ies)/,
    /\blicen[sc]e\b/,
  ];
  if (strongPolicyPatterns.some((pattern) => pattern.test(normalized))) return true;

  const weakSignals = [
    "conditions",
    "regles",
    "rules",
    "check-in",
    "check out",
    "arrivee",
    "depart",
    "enregistrement",
    "licence",
    "license",
    "ice",
  ];
  const weakHits = weakSignals.filter((signal) => normalized.includes(signal)).length;
  return weakHits >= 4;
}

function extractAgodaNarrativeDetailsDescription($: cheerio.CheerioAPI) {
  const headingPattern =
    /plus de d(?:e|é)tails? sur|why choose this property|about this property|pourquoi choisir cet etablissement|pourquoi choisir cet établissement/i;
  const lines: string[] = [];

  $("h1, h2, h3, h4, h5, [role='heading']").each((_, el) => {
    const heading = normalizeWhitespace($(el).text());
    if (!headingPattern.test(heading)) return;

    const container = $(el).closest("section, article, div").first();
    const candidates = [
      ...container.find("p, li").map((__, node) => normalizeWhitespace($(node).text())).get(),
      ...$(el)
        .nextAll("p, ul li, ol li")
        .slice(0, 12)
        .map((__, node) => normalizeWhitespace($(node).text()))
        .get(),
    ];

    candidates.forEach((line) => {
      const cleaned = line.replace(/^[•·\-–]\s*/, "");
      if (!cleaned || cleaned.length < 18 || cleaned.length > 320) return;
      if (isAgodaLocationPoiText(cleaned) || isAgodaPolicyRulesText(cleaned)) return;
      if (
        /(check[- ]?in|check[- ]?out|policy|rules?|conditions?|house rules?|hebergeur|host|member since|inscription le|licence|license|\bice\b)/i.test(
          cleaned
        )
      ) {
        return;
      }
      lines.push(cleaned);
    });
  });

  const uniqueLines = uniqueStrings(lines);
  if (uniqueLines.length === 0) return "";

  return uniqueLines.map((line, index) => (index === 0 ? line : `- ${line}`)).join("\n");
}

function scoreAgodaTitleCandidate(candidate: TextCandidate): number {
  const value = normalizeAgodaTitle(candidate.value);
  if (!value) return -1;

  const lowerSource = candidate.source.toLowerCase();
  const lowerValue = value.toLowerCase();
  let score = value.length;

  if (candidate.source === "h1") score += 500;
  if (lowerSource.includes("hotelname") || lowerSource.includes("propertyname")) score += 360;
  if (lowerSource.includes("json_ld_name")) score += 280;
  if (lowerSource.includes("og:title")) score += 220;
  if (lowerSource.includes("document_title")) score += 140;
  if (lowerSource.includes("area") || lowerSource.includes("address") || lowerSource.includes("location")) {
    score -= 320;
  }

  if (value.split(/\s+/).length < 2) score -= 180;
  if (lowerValue.includes("agoda")) score -= 220;
  if (lowerValue === "guéliz" || lowerValue === "gueliz") score -= 260;

  return score;
}

function pickBestTextCandidate(
  candidates: TextCandidate[],
  scorer: (candidate: TextCandidate) => number
) {
  return (
    candidates
      .map((candidate) => ({
        source: candidate.source,
        value: normalizeWhitespace(candidate.value),
      }))
      .filter((candidate) => candidate.value.length > 0)
      .sort((a, b) => scorer(b) - scorer(a))[0] ?? null
  );
}

function normalizeAgodaTitle(value: string) {
  return normalizeWhitespace(
    value
      .replace(/\s*-\s*(?:Best Price|Room Rates|Tarifs?|Offres?).*$/i, "")
      .replace(/\s*-\s*Agoda(?:\.com)?$/i, "")
      .replace(/\|\s*Agoda(?:\.com)?$/i, "")
  );
}

function extractDomTextCandidates(
  $: cheerio.CheerioAPI,
  selectors: Array<{ source: string; selector: string }>
): TextCandidate[] {
  return selectors.flatMap(({ source, selector }) =>
    $(selector)
      .map((_, el) => ({
        source,
        value: $(el).text(),
      }))
      .get()
  );
}

function scoreAgodaRichTextCandidate(candidate: TextCandidate): number {
  const value = normalizeWhitespace(candidate.value);
  if (!value) return -1;

  const lowerSource = candidate.source.toLowerCase();
  const lowerValue = value.toLowerCase();
  let score = value.length;

  if (
    lowerSource.includes("about") ||
    lowerSource.includes("description") ||
    lowerSource.includes("overview") ||
    lowerSource.includes("summary")
  ) {
    score += 180;
  }

  if (lowerSource.includes("policy") || lowerSource.includes("rule")) score -= 120;
  if (lowerSource.includes("footer") || lowerSource.includes("nav")) score -= 220;

  if (value.length < 80) score -= 120;
  if (value.split(/\s+/).length >= 40) score += 60;

  if (
    lowerValue.includes("agoda") ||
    lowerValue.includes("popular destinations") ||
    lowerValue.includes("see all properties") ||
    lowerValue.includes("check availability")
  ) {
    score -= 240;
  }

  return score;
}

function isPlausibleAgodaHostName(value: string) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return false;
  if (normalized.length < 2 || normalized.length > 60) return false;
  if ((normalized.match(/[.!?]/g) ?? []).length >= 2) return false;

  const folded = normalized
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (
    /(^|\b)(je m'appelle|i am|my name is|about host|about the host|host bio|bio|hebergeur verifie|verified host|inscription le|member since|check[- ]?in|check[- ]?out|conditions?|regles?|rules?|policy|ice|licence|license)(\b|$)/i.test(
      folded
    )
  ) {
    return false;
  }

  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 4) return false;
  if (/\d{2,}/.test(normalized)) return false;
  if (/[.!?]$/.test(normalized)) return false;

  return true;
}

function extractAgodaHostNameFromMixedText(value: string): string | null {
  const raw = value.replace(/\u00a0/g, " ").trim();
  if (!raw) return null;

  const extractedFromLabel =
    raw.match(
      /(?:host(?:ed)? by|h[eé]bergeur|g[eé]r[eé]\s+par|managed by|owner)\s*[:\-]\s*([A-Za-zÀ-ÖØ-öø-ÿ'’.\- ]{2,80})/i
    )?.[1] ?? null;

  const truncated = normalizeWhitespace(
    raw.split(/(?:h[eé]bergeur verifi[eé]|verified host|inscription le|member since|about host|host bio)/i)[0] ?? ""
  );

  const candidates = uniqueStrings(
    [
      extractedFromLabel,
      truncated,
      ...raw.split(/[\n\r|•·]/).map((part) => normalizeWhitespace(part)),
      normalizeWhitespace(raw),
    ]
      .map((candidate) =>
        normalizeWhitespace(
          candidate
            ?.replace(/^(?:host(?:ed)? by|h[eé]bergeur|managed by|owner|partner)\s*[:\-]\s*/i, "")
            .replace(/[,:;|]+$/, "")
            .trim() ?? ""
        )
      )
      .filter(Boolean)
  );

  const scored = candidates
    .map((candidate) => {
      if (!isPlausibleAgodaHostName(candidate)) return { candidate, score: -1 };
      let score = 120 - candidate.length;
      if (candidate.split(/\s+/).length === 1) score += 60;
      if (/^[A-ZÀ-ÖØ-Þ'’.\- ]+$/.test(candidate) && /[A-ZÀ-ÖØ-Þ]/.test(candidate)) score += 40;
      return { candidate, score };
    })
    .filter((item) => item.score >= 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.candidate ?? null;
}

function scoreAgodaHostNameCandidate(candidate: TextCandidate): number {
  const value = normalizeWhitespace(candidate.value);
  if (!isPlausibleAgodaHostName(value)) return -1;

  const lowerSource = candidate.source.toLowerCase();
  let score = 120 - value.length;

  if (
    /(hostname|displayname|partnername|ownername|html_host_name|propertyhost)/i.test(lowerSource)
  ) {
    score += 260;
  } else if (/(managedby|host|owner|provider)/i.test(lowerSource)) {
    score += 160;
  }

  if (value.split(/\s+/).length === 1) score += 50;
  if (/^[A-ZÀ-ÖØ-Þ'’.\- ]+$/.test(value) && /[A-ZÀ-ÖØ-Þ]/.test(value)) score += 30;

  return score;
}

function cleanAgodaListValue(value: string) {
  return normalizeWhitespace(value)
    .replace(/([a-zà-ÿ])([A-ZÀ-Ý])/g, "$1 $2")
    .replace(/^[•·\-–]\s*/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function isAgodaJunkText(value: string) {
  const lower = value.toLowerCase();

  return (
    /https?:\/\//i.test(value) ||
    lower.includes("window.") ||
    lower.includes("propertypageparams") ||
    lower.includes("promise.resolve") ||
    /\{\d+\}/.test(value)
  );
}

function looksUsefulAgodaListValue(value: string) {
  const normalized = cleanAgodaListValue(value);
  if (!normalized) return false;
  if (isAgodaJunkText(normalized)) return false;

  const lower = normalized.toLowerCase();
  if (
    normalized.length < 3 ||
    normalized.length > 120 ||
    lower === "agoda" ||
    lower.startsWith("réservez à") ||
    lower.startsWith("reservez a") ||
    lower.startsWith("book ") ||
    lower.startsWith("equipements") ||
    lower.startsWith("équipements") ||
    lower.startsWith("amenities") ||
    lower.includes("show more") ||
    lower.includes("show less") ||
    lower.includes("see all") ||
    lower.includes("view all") ||
    lower.includes("more details") ||
    lower.includes("read more") ||
    lower.includes("check availability") ||
    lower.includes("select room") ||
    lower.includes("popular destinations") ||
    lower.includes("sign in")
  ) {
    return false;
  }

  return true;
}

function looksUsefulAgodaAmenityValue(value: string) {
  const normalized = cleanAgodaListValue(value);
  if (!normalized || !looksUsefulAgodaListValue(normalized)) return false;

  const lower = normalized.toLowerCase();
  if (
    normalized.length > 80 ||
    /^\d+\s*(nuits?|weeks?|months?)$/i.test(normalized) ||
    /(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre|\bcalendar\b|\bcalendrier\b)/i.test(normalized) ||
    /(prix approximatifs|approximate prices|je suis flexible|i'?m flexible|sélectionnez le mois|select.*month|voir les offres|view deals|search|recherche|check-in|check out|check-out)/i.test(lower) ||
    /^(équipements?( et services)?|equipements?( et services)?|services|accès|acces|mobilité|mobilite|équipements de confort|comforts|access|getting around|things you'll love|points forts)$/i.test(lower) ||
    /(\d+\s*(m|km)\b)|public transportation|transport/i.test(lower)
  ) {
    return false;
  }

  return true;
}

function normalizeAgodaAmenityDisplay(value: string) {
  return cleanAgodaListValue(value)
    .replace(/\[on-site\]/gi, "on-site")
    .replace(/free wi-?fi in all rooms!?/gi, "Free Wi-Fi")
    .replace(/^car park$/i, "Parking")
    .replace(/^car park on-site$/i, "Parking on-site")
    .replace(/^air conditioning$/i, "Air conditioning")
    .replace(/^keyless access$/i, "Keyless access")
    .replace(/^24[- ]?hour check[- ]?in$/i, "24-hour check-in")
    .replace(/^24[- ]?hour front desk$/i, "24-hour front desk")
    .replace(/^unionpay$/i, "UnionPay")
    .replace(/^internet access(?: – wireless)?$/i, "Internet")
    .trim();
}

function getAgodaAmenityKey(value: string) {
  const normalized = normalizeAgodaAmenityDisplay(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (/wi-?fi/.test(normalized)) return "wifi";
  if (/internet/.test(normalized)) return "internet";
  if (/unionpay/.test(normalized)) return "unionpay";
  if (/24[- ]?hour|24h|front desk|reception/.test(normalized)) return "front_desk_24h";
  if (/check-in/.test(normalized)) return "check_in_24h";
  if (/keyless/.test(normalized)) return "keyless_access";
  if (/air conditioning|climatisation|climatisation|clim/.test(normalized)) {
    return "air_conditioning";
  }
  if (/parking|car park/.test(normalized)) {
    return /on-site/.test(normalized) ? "parking_on_site" : "parking";
  }

  return normalized;
}

function isAgodaModalAmenitySupplementValue(value: string) {
  const normalized = cleanAgodaListValue(value);
  if (!looksUsefulAgodaAmenityValue(normalized)) return false;

  return /(wi-?fi|internet|parking|car park|unionpay|24[- ]?hour|24h|front desk|reception|keyless|air conditioning|climatisation|clim)/i.test(
    normalized
  );
}

function extractAgodaModalAmenityTokens(values: string[]) {
  const tokens: string[] = [];
  const patterns: Array<{ label: string; pattern: RegExp }> = [
    { label: "Free Wi-Fi", pattern: /(free wi-?fi(?: in all rooms)?|wi-?fi gratuit(?: dans toutes les chambres)?)/i },
    { label: "Internet", pattern: /\binternet\b/i },
    { label: "24-hour front desk", pattern: /(réception\s*24h\/24|reception\s*24h\/24|24[- ]?hour front desk|front desk\s*\[?24[- ]?hour\]?)/i },
    { label: "UnionPay", pattern: /\bunion\s*pay\b/i },
    { label: "Parking on-site", pattern: /(parking sur site|car park\s*\[?on-site\]?)/i },
    { label: "Parking", pattern: /\b(parking|car park)\b/i },
    { label: "Air conditioning", pattern: /(air conditioning|climatisation|climatisation|climatisation|clim)/i },
    { label: "Keyless access", pattern: /(acc[eè]s sans cl[eé]|keyless access)/i },
  ];

  values.forEach((value) => {
    const normalized = cleanAgodaListValue(value);
    if (!normalized || isAgodaJunkText(normalized)) return;

    patterns.forEach(({ label, pattern }) => {
      if (pattern.test(normalized)) {
        tokens.push(label);
      }
    });
  });

  return uniqueStrings(tokens);
}

function looksUsefulAgodaLocationValue(value: string) {
  const normalized = cleanAgodaListValue(value);
  if (!normalized || isAgodaJunkText(normalized)) return false;

  const lower = normalized.toLowerCase();
  if (
    normalized.length < 3 ||
    normalized.length > 140 ||
    lower.includes("colomiers, france") ||
    lower.includes("réservez à") ||
    lower.includes("reservez a") ||
    lower.includes("view on map") ||
    lower.includes("show on map")
  ) {
    return false;
  }

  return true;
}

function pickBestAgodaListSource(sources: Array<{ source: string; values: string[] }>) {
  return (
    sources
      .map((source) => ({
        source: source.source,
        values: uniqueStrings(source.values.map(cleanAgodaListValue).filter(looksUsefulAgodaListValue)),
        score:
          (source.source.startsWith("payload.") ? 200 :
            source.source.startsWith("structured.") ? 120 :
            source.source.includes("modal") ? 90 :
            source.source.startsWith("html_") ? 40 : 0) +
          uniqueStrings(source.values.map(cleanAgodaListValue).filter(looksUsefulAgodaListValue)).length,
      }))
      .filter((source) => source.values.length > 0)
      .sort((a, b) => b.score - a.score)[0] ?? null
  );
}

function extractAgodaAmenityValuesFromStructuredValue(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];

  const root = value as Record<string, unknown>;
  const rawItems: string[] = [];

  const aboutHotel = root.aboutHotel;
  if (aboutHotel && typeof aboutHotel === "object") {
    const aboutHotelRecord = aboutHotel as Record<string, unknown>;
    const hotelDescRecord =
      typeof aboutHotelRecord.hotelDesc === "object" && aboutHotelRecord.hotelDesc
        ? (aboutHotelRecord.hotelDesc as Record<string, unknown>)
        : null;
    const overview =
      hotelDescRecord && typeof hotelDescRecord.overview === "string"
        ? hotelDescRecord.overview
        : null;
    if (overview && /free wi-?fi|wifi/i.test(overview)) {
      rawItems.push("Internet");
    }

    const featureGroups = aboutHotelRecord.featureGroups;
    if (Array.isArray(featureGroups)) {
      featureGroups.forEach((group) => {
        if (!group || typeof group !== "object") return;
        const features = (group as Record<string, unknown>).feature;
        if (!Array.isArray(features)) return;

        features.forEach((feature) => {
          if (!feature || typeof feature !== "object") return;
          const record = feature as Record<string, unknown>;
          const available =
            typeof record.available === "boolean" ? record.available : true;
          const name = typeof record.name === "string" ? record.name : null;
          const iconCss = typeof record.iconCss === "string" ? record.iconCss : "";
          if (available && name) rawItems.push(name);
          if (available && /24hour-check-in/i.test(iconCss)) {
            rawItems.push("24-hour check-in");
          }
        });
      });
    }
  }

  const featuresYouLove = root.featuresYouLove;
  if (featuresYouLove && typeof featuresYouLove === "object") {
    const features = (featuresYouLove as Record<string, unknown>).features;
    if (Array.isArray(features)) {
      features.forEach((feature) => {
        if (!feature || typeof feature !== "object") return;
        const featureRecord = feature as Record<string, unknown>;
        const text = typeof featureRecord.text === "string"
          ? featureRecord.text
          : null;
        if (text) rawItems.push(text);
      });
    }
  }

  return rawItems;
}

function extractAgodaListFromStructured(
  blocks: unknown[],
  pattern: RegExp
): Array<{ source: string; values: string[] }> {
  return blocks.map((block, index) => ({
    source: `structured.${index}`,
    values: collectStringValuesByKeyPattern(block, pattern).map((candidate) => candidate.value),
  }));
}

function collectAgodaStructureCandidates(
  blocks: unknown[]
): Array<TextCandidate> {
  return blocks.flatMap((block) =>
    collectStringValuesByKeyPattern(
      block,
      /^(bedrooms?|bathrooms?|beds?|guests?|maxOccupancy|occupancy|propertyType|roomType|area|size)$/i
    )
  );
}

function parseNetworkPayloads(payloads: CapturedNetworkPayload[]) {
  return payloads
    .map((payload) => ({
      ...payload,
      parsed: safeJsonParse(payload.bodyText),
    }))
    .filter((payload): payload is CapturedNetworkPayload & { parsed: unknown } => payload.parsed != null);
}

function collectPayloadTextCandidates(
  payloads: Array<CapturedNetworkPayload & { parsed: unknown }>,
  pattern: RegExp
): TextCandidate[] {
  return payloads.flatMap((payload, index) =>
    collectStringValuesByKeyPattern(payload.parsed, pattern, `payload.${index}`)
  );
}

function collectPayloadListSources(
  payloads: Array<CapturedNetworkPayload & { parsed: unknown }>,
  pattern: RegExp
) {
  return payloads.map((payload, index) => ({
    source: `payload.${index}`,
    values: collectStringValuesByKeyPattern(payload.parsed, pattern, `payload.${index}`).map(
      (candidate) => candidate.value
    ),
  }));
}

function collectPayloadImageUrls(
  payloads: Array<CapturedNetworkPayload & { parsed: unknown }>
) {
  return payloads.flatMap((payload) =>
    extractImageUrlsFromUnknown(payload.parsed).filter(isLikelyAgodaListingPhotoUrl)
  );
}

function collectAgodaPhotoTotalCandidatesFromValue(
  value: unknown,
  path = "root"
): NumericCandidate[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    const lowerPath = path.toLowerCase();
    const directCandidates: NumericCandidate[] = [];

    if (
      (lowerPath.endsWith(".images") || lowerPath.endsWith(".mosaicimages")) &&
      value.every((entry) => entry && typeof entry === "object")
    ) {
      directCandidates.push({
        source: path,
        value: `array_length:${value.length}`,
        parsed: value.length > 0 && value.length <= 2000 ? value.length : null,
      });
    }

    if (lowerPath.endsWith(".imagecategories")) {
      const sum = value.reduce((total, entry) => {
        if (!entry || typeof entry !== "object") return total;
        const record = entry as Record<string, unknown>;
        const count = typeof record.count === "number"
          ? record.count
          : typeof record.count === "string"
            ? Number.parseInt(record.count, 10)
            : null;
        return count != null && Number.isFinite(count) ? total + count : total;
      }, 0);

      if (sum > 0 && sum <= 2000) {
        directCandidates.push({
          source: path,
          value: `categories_sum:${sum}`,
          parsed: sum,
        });
      }
    }

    return [
      ...directCandidates,
      ...value.flatMap((entry, index) =>
        collectAgodaPhotoTotalCandidatesFromValue(entry, `${path}.${index}`)
      ),
    ];
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const candidates: NumericCandidate[] = [];
    const lowerPath = path.toLowerCase();

    if (
      lowerPath.endsWith(".imageparams") &&
      (typeof record.totalNumberOfImages === "number" ||
        typeof record.totalNumberOfImages === "string")
    ) {
      const parsed =
        typeof record.totalNumberOfImages === "number"
          ? record.totalNumberOfImages
          : Number.parseInt(record.totalNumberOfImages, 10);

      if (Number.isFinite(parsed) && parsed > 0 && parsed <= 2000) {
        candidates.push({
          source: `${path}.totalNumberOfImages`,
          value: String(parsed),
          parsed,
        });
      }
    }

    return [
      ...candidates,
      ...Object.entries(record).flatMap(([key, entry]) =>
        collectAgodaPhotoTotalCandidatesFromValue(entry, `${path}.${key}`)
      ),
    ];
  }

  return [];
}

function collectPayloadNumericCandidates(
  payloads: Array<CapturedNetworkPayload & { parsed: unknown }>,
  pattern: RegExp,
  parser: (text: string) => number | null,
  validator: (value: number) => boolean
): NumericCandidate[] {
  return payloads.flatMap((payload, index) =>
    collectStringValuesByKeyPattern(payload.parsed, pattern, `payload.${index}`).map((candidate) => {
      const parsed = parser(candidate.value);
      return {
        source: candidate.source,
        value: candidate.value,
        parsed: parsed != null && validator(parsed) ? parsed : null,
      };
    })
  );
}

function isLikelyAgodaListingPhotoUrl(value: string): boolean {
  const normalizedValue = value.startsWith("//") ? `https:${value}` : value;
  if (!/^https?:\/\//i.test(normalizedValue)) return false;

  const lower = normalizedValue.toLowerCase();

  if (
    lower.includes("thumbnail") ||
    lower.includes("thumb") ||
    lower.includes("icon") ||
    lower.includes("logo") ||
    lower.includes("avatar") ||
    lower.includes("placeholder") ||
    lower.includes("sprite") ||
    lower.includes("map")
  ) {
    return false;
  }

  return (
    lower.includes("agoda.net") ||
    lower.includes("agoda.com") ||
    lower.includes("q-xx.bstatic.com") ||
    lower.includes("pix8.agoda.net") ||
    lower.includes("cdn6.agoda.net")
  );
}

function parseAgodaExternalId(url: string): string | null {
  const pathMatch = url.match(/\/(?:[a-z]{2}-[a-z]{2}\/)?([^/?#]+)\/hotel\//i);
  if (pathMatch?.[1]) return pathMatch[1];

  const queryMatch = url.match(/[?&](?:hotel_id|hotelId)=([^&#]+)/i);
  return queryMatch?.[1] ?? null;
}

function parseAgodaMaybeNumber(text: string): number | null {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return null;

  const candidate = normalized.match(/\d+(?:[.,]\d+)?/);
  if (!candidate?.[0]) return null;

  const value = Number.parseFloat(candidate[0].replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function pickFirstNumericCandidate(
  candidates: Array<{ source: string; value: string; parsed: number | null }>
) {
  return (
    candidates
      .map((candidate) => ({
        source: candidate.source,
        value: normalizeWhitespace(candidate.value),
        parsed: candidate.parsed,
      }))
      .find((candidate) => candidate.value.length > 0 && candidate.parsed != null) ?? null
  );
}

function pickLargestNumericCandidate(
  candidates: Array<{ source: string; value: string; parsed: number | null }>
) {
  return (
    candidates
      .map((candidate) => ({
        source: candidate.source,
        value: normalizeWhitespace(candidate.value),
        parsed: candidate.parsed,
      }))
      .filter((candidate) => candidate.value.length > 0 && candidate.parsed != null)
      .sort((a, b) => (b.parsed ?? 0) - (a.parsed ?? 0))[0] ?? null
  );
}

function parseAgodaPlausibleRating(text: string): number | null {
  const normalized = normalizeWhitespace(text);
  if (!normalized || isAgodaJunkText(normalized)) return null;

  const value = parseAgodaMaybeNumber(normalized);
  return value != null && value >= 0 && value <= 10 ? value : null;
}

function parseAgodaPlausibleReviewCount(text: string): number | null {
  const normalized = normalizeWhitespace(text);
  if (!normalized || isAgodaJunkText(normalized)) return null;

  const value = parseAgodaMaybeNumber(normalized);
  return value != null && value > 0 && value <= 100000 ? Math.round(value) : null;
}

function parseAgodaPhotoTotalFromText(text: string): number | null {
  const normalized = normalizeWhitespace(text);
  if (!normalized || isAgodaJunkText(normalized)) return null;

  const lower = normalized.toLowerCase();
  if (!/(toutes?|all|photos?|images?|gallery|galerie|voir toutes?|view all)/i.test(lower)) {
    return null;
  }

  const parenMatch = normalized.match(/\((\d{1,4})\)/);
  if (parenMatch?.[1]) {
    const value = Number.parseInt(parenMatch[1], 10);
    return Number.isFinite(value) && value > 0 && value <= 1000 ? value : null;
  }

  const countMatch = normalized.match(/\b(\d{1,4})\b/);
  if (!countMatch?.[1]) return null;

  const value = Number.parseInt(countMatch[1], 10);
  return Number.isFinite(value) && value > 0 && value <= 1000 ? value : null;
}

function stripHtmlToText(value: string) {
  return normalizeWhitespace(
    value
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/p>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
  );
}

function cleanAgodaDescriptionValue(source: string, value: string) {
  let cleaned = stripHtmlToText(value);
  if (!cleaned) return "";

  cleaned = cleaned
    .replace(/^[^.]{0,140}the facilities and services provided by .*? ensure a pleasant stay for guests\.?\s*/i, "")
    .replace(/\bpost your pictures and answer your emails whenever you want,?\s*/i, "")
    .replace(/\bvisit the sights and local attractions .*$/i, "")
    .trim();

  if (/around the property/i.test(cleaned)) {
    cleaned = cleaned.split(/around the property/i)[0]?.trim() ?? cleaned;
  }

  if (source === "body_fallback" && /window\.|propertypageparams|promise\.resolve|__next_data__/i.test(cleaned)) {
    return "";
  }

  return normalizeWhitespace(cleaned);
}

function extractAgodaSecondaryApiUrl(html: string) {
  const match = html.match(/apiUrl="([^"]*GetSecondaryData[^"]*)"/i);
  if (!match?.[1]) return null;

  const relative = match[1].replace(/&amp;/g, "&");
  return relative.startsWith("http") ? relative : `https://www.agoda.com${relative}`;
}

async function fetchAgodaSecondaryPayload(html: string, sourceUrl: string) {
  const apiUrl = extractAgodaSecondaryApiUrl(html);
  if (!apiUrl) return null;

  try {
    const response = await axios.get(apiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "fr-FR,fr;q=0.9",
        Referer: sourceUrl,
      },
      timeout: 20000,
      responseType: "json",
    });

    if (!response.data || typeof response.data !== "object") return null;
    return response.data;
  } catch {
    return null;
  }
}

function buildAgodaReviewCandidates(
  payloads: Array<CapturedNetworkPayload & { parsed: unknown }>,
  hotelJson: Record<string, unknown> | null
) {
  const ratingCandidates: NumericCandidate[] = [];
  const reviewCountCandidates: NumericCandidate[] = [];

  payloads.forEach((payload, index) => {
    if (!payload.parsed || typeof payload.parsed !== "object") return;
    const root = payload.parsed as Record<string, unknown>;
    const reviews = root.reviews && typeof root.reviews === "object"
      ? (root.reviews as Record<string, unknown>)
      : null;

    if (reviews) {
      const directScore =
        typeof reviews.score === "string" || typeof reviews.score === "number"
          ? parseAgodaPlausibleRating(String(reviews.score))
          : null;
      if (directScore != null) {
        ratingCandidates.push({
          source: `payload.${index}.reviews.score`,
          value: String(reviews.score),
          parsed: directScore,
        });
      }

      const directCount =
        typeof reviews.reviewsCount === "string" || typeof reviews.reviewsCount === "number"
          ? parseAgodaPlausibleReviewCount(String(reviews.reviewsCount))
          : null;
      if (directCount != null) {
        reviewCountCandidates.push({
          source: `payload.${index}.reviews.reviewsCount`,
          value: String(reviews.reviewsCount),
          parsed: directCount,
        });
      }

      const combinedScore =
        reviews.combinedReview && typeof reviews.combinedReview === "object"
          ? (reviews.combinedReview as Record<string, unknown>).score
          : null;
      if (combinedScore && typeof combinedScore === "object") {
        const combinedScoreRecord = combinedScore as Record<string, unknown>;
        const overallRating =
          typeof combinedScoreRecord.score === "string" || typeof combinedScoreRecord.score === "number"
            ? parseAgodaPlausibleRating(String(combinedScoreRecord.score))
            : null;
        if (overallRating != null) {
          ratingCandidates.push({
            source: `payload.${index}.reviews.combinedReview.score.score`,
            value: String(combinedScoreRecord.score),
            parsed: overallRating,
          });
        }

        const overallCount =
          typeof combinedScoreRecord.reviewCount === "string" || typeof combinedScoreRecord.reviewCount === "number"
            ? parseAgodaPlausibleReviewCount(String(combinedScoreRecord.reviewCount))
            : null;
        if (overallCount != null) {
          reviewCountCandidates.push({
            source: `payload.${index}.reviews.combinedReview.score.reviewCount`,
            value: String(combinedScoreRecord.reviewCount),
            parsed: overallCount,
          });
        }
      }
    }
  });

  if (hotelJson?.aggregateRating && typeof hotelJson.aggregateRating === "object") {
    const aggregateRating = hotelJson.aggregateRating as Record<string, unknown>;
    const rating =
      typeof aggregateRating.ratingValue === "string" || typeof aggregateRating.ratingValue === "number"
        ? parseAgodaPlausibleRating(String(aggregateRating.ratingValue))
        : null;
    if (rating != null) {
      ratingCandidates.push({
        source: "json_ld_aggregate_rating",
        value: String(aggregateRating.ratingValue),
        parsed: rating,
      });
    }

    const count =
      typeof aggregateRating.reviewCount === "string" || typeof aggregateRating.reviewCount === "number"
        ? parseAgodaPlausibleReviewCount(String(aggregateRating.reviewCount))
        : null;
    if (count != null) {
      reviewCountCandidates.push({
        source: "json_ld_aggregate_rating",
        value: String(aggregateRating.reviewCount),
        parsed: count,
      });
    }
  }

  return {
    ratingCandidates,
    reviewCountCandidates,
  };
}

function buildAgodaGallerySnapshot(
  payloads: Array<CapturedNetworkPayload & { parsed: unknown }>,
  structuredScriptData: unknown[],
  fallbackUrls: string[]
): AgodaGallerySnapshot {
  const snapshots: AgodaGallerySnapshot[] = [];

  const collectFromValue = (value: unknown, sourcePrefix: string) => {
    if (!value || typeof value !== "object") return;
    const root = value as Record<string, unknown>;
    const mosaicInitData =
      root.mosaicInitData && typeof root.mosaicInitData === "object"
        ? (root.mosaicInitData as Record<string, unknown>)
        : null;
    if (!mosaicInitData) return;

    const images = Array.isArray(mosaicInitData.images) ? mosaicInitData.images : [];
    const imageUrls = dedupeImageUrls(
      uniqueStrings(
        images
          .flatMap((image) => {
            if (!image || typeof image !== "object") return [];
            const record = image as Record<string, unknown>;
            return [
              typeof record.location === "string" ? record.location : "",
              typeof record.locationMediumRectangle === "string"
                ? record.locationMediumRectangle
                : "",
            ];
          })
          .map((photo) => (photo.startsWith("//") ? `https:${photo}` : photo))
          .filter(isLikelyAgodaListingPhotoUrl)
      )
    );

    const categories = Array.isArray(mosaicInitData.imageCategories)
      ? mosaicInitData.imageCategories
      : [];
    const categoriesTotal = categories.reduce((total, entry) => {
      if (!entry || typeof entry !== "object") return total;
      const record = entry as Record<string, unknown>;
      const count =
        typeof record.count === "number"
          ? record.count
          : typeof record.count === "string"
            ? Number.parseInt(record.count, 10)
            : null;
      return count != null && Number.isFinite(count) ? total + count : total;
    }, 0);

    const total = categoriesTotal > 0 ? categoriesTotal : imageUrls.length > 0 ? imageUrls.length : null;
    if (total != null || imageUrls.length > 0) {
      snapshots.push({
        urls: imageUrls,
        total,
        source: `${sourcePrefix}.mosaicInitData`,
      });
    }
  };

  payloads.forEach((payload, index) => collectFromValue(payload.parsed, `payload.${index}`));
  structuredScriptData.forEach((block, index) => collectFromValue(block, `structured.${index}`));

  const bestSnapshot =
    snapshots
      .filter((snapshot) => snapshot.total != null || snapshot.urls.length > 0)
      .sort((a, b) => (b.total ?? b.urls.length) - (a.total ?? a.urls.length))[0] ?? null;

  if (bestSnapshot) return bestSnapshot;

  return {
    urls: fallbackUrls,
    total: fallbackUrls.length > 0 ? fallbackUrls.length : null,
    source: fallbackUrls.length > 0 ? "fallback_gallery_urls" : null,
  };
}

function collectAgodaDomPhotoTotalCandidates($: cheerio.CheerioAPI): NumericCandidate[] {
  return $(
    '[role="tab"], [role="button"], button, a, [data-selenium*="photo"], [data-element-name*="photo"], [class*="Photo"], [class*="Gallery"]'
  )
    .map((_, el) => {
      const value = normalizeWhitespace(
        $(el).attr("aria-label") ||
          $(el).attr("title") ||
          $(el).text() ||
          ""
      );

      return {
        source: "html_gallery_tabs",
        value,
        parsed: parseAgodaPhotoTotalFromText(value),
      };
    })
    .get()
    .filter((candidate) => candidate.parsed != null);
}

export async function extractAgoda(url: string): Promise<ExtractorResult> {
  const pageData = await fetchUnlockedPageData(url, {
    platform: "agoda",
    preferredTransport: "cdp",
    payloadUrlPattern: /(property|hotel|listing|review|facility|amenity|photo|gallery|location)/i,
    maxPayloads: 60,
    afterLoad: async (page) => {
      const wait = async (ms: number) => {
        await page.waitForTimeout(ms).catch(() => {});
      };
      const clickFirstVisible = async (patterns: RegExp[]) => {
        for (const pattern of patterns) {
          const roleTargets = [
            page.getByRole("button", { name: pattern }).first(),
            page.getByRole("link", { name: pattern }).first(),
            page.getByRole("tab", { name: pattern }).first(),
          ];

          for (const target of roleTargets) {
            try {
              if ((await target.count()) > 0 && (await target.isVisible().catch(() => false))) {
                await target.click().catch(() => {});
                await wait(800);
                return true;
              }
            } catch {
              // keep trying other candidates
            }
          }

          const textTarget = page.getByText(pattern, { exact: false }).first();
          try {
            if ((await textTarget.count()) > 0 && (await textTarget.isVisible().catch(() => false))) {
              await textTarget.click().catch(() => {});
              await wait(800);
              return true;
            }
          } catch {
            // keep trying other candidates
          }
        }

        return false;
      };

      const infoOpened = await clickFirstVisible([
        /Informations sur l['’]établissement/i,
        /Property information/i,
        /Informaci[oó]n sobre el alojamiento/i,
        /Informações da propriedade/i,
      ]);

      let amenitiesTabOpened = false;
      if (infoOpened) {
        amenitiesTabOpened = await clickFirstVisible([
          /^Équipements$/i,
          /^Equipements$/i,
          /^Amenities$/i,
          /^Facilities$/i,
          /^Services$/i,
        ]);
      }

      const modal = page.locator('[role="dialog"]:visible, [aria-modal="true"]:visible').last();
      const modalVisibleItems =
        (await modal
          .locator(
            'li:visible, [role="listitem"]:visible, [class*="Amenit"]:visible li, [class*="Facility"]:visible li, [class*="Service"]:visible li'
          )
          .evaluateAll((nodes) =>
            nodes
              .map((node) => (node.textContent || "").replace(/\s+/g, " ").trim())
              .filter(Boolean)
          )
          .catch(() => [])) ?? [];

      return {
        agodaModalAmenitiesOpened: infoOpened,
        agodaAmenitiesTabOpened: amenitiesTabOpened,
        agodaModalVisibleItems: modalVisibleItems,
      };
    },
  });
  const { html, payloads } = pageData;
  const $ = cheerio.load(html);
  const jsonLdBlocks = extractJsonLd(html);
  const structuredScriptData = extractStructuredScriptData(html);
  const fetchedSecondaryPayload = await fetchAgodaSecondaryPayload(html, url);
  const parsedPayloads = parseNetworkPayloads([
    ...payloads,
    ...(fetchedSecondaryPayload
      ? [
          {
            url: extractAgodaSecondaryApiUrl(html) ?? "agoda_secondary_payload",
            contentType: "application/json",
            bodyText: JSON.stringify(fetchedSecondaryPayload),
          } satisfies CapturedNetworkPayload,
        ]
      : []),
  ]);
  const modalVisibleItems = Array.isArray(pageData.data?.agodaModalVisibleItems)
    ? pageData.data.agodaModalVisibleItems.filter(
        (value): value is string => typeof value === "string"
      )
    : [];

  const hotelJson =
    jsonLdBlocks.find((item) =>
      ["Hotel", "LodgingBusiness", "Apartment", "Residence"].includes(
        String(item["@type"] ?? "")
      )
    ) ?? null;

  const selectedTitleCandidate =
    pickBestTextCandidate([
      ...collectPayloadTextCandidates(
        parsedPayloads,
        /^(hotelName|propertyName|name|headline|title|hotelTitle|propertyTitle)$/i
      ),
      ...structuredScriptData.flatMap((block) =>
        collectStringValuesByKeyPattern(
          block,
          /^(hotelName|propertyName|name|headline|title|hotelTitle|propertyTitle)$/i
        )
      ),
      {
        source: "h1",
        value: $("h1").first().text(),
      },
      {
        source: "og:title",
        value: $('meta[property="og:title"]').attr("content") || "",
      },
      {
        source: "document_title",
        value: $("title").text(),
      },
      {
        source: "json_ld_name",
        value: typeof hotelJson?.name === "string" ? hotelJson.name : "",
      },
    ], scoreAgodaTitleCandidate) ?? { source: "fallback_default", value: "Untitled Agoda listing" };
  const title = normalizeAgodaTitle(selectedTitleCandidate.value);
  const narrativeDetailsDescription = extractAgodaNarrativeDetailsDescription($);

  const descriptionCandidates: TextCandidate[] = [
    ...collectPayloadTextCandidates(
      parsedPayloads,
      /^(description|hotelDescription|propertyDescription|overview|about|summary|marketingMessage|aboutProperty|hotelOverview)$/i
    ),
    ...structuredScriptData.flatMap((block) =>
      collectStringValuesByKeyPattern(
        block,
        /^(description|hotelDescription|propertyDescription|overview|about|summary|marketingMessage|aboutProperty)$/i
      )
    ),
    ...extractDomTextCandidates($, [
      { source: "html_about", selector: '[data-selenium*="about"], [data-element-name*="about"]' },
      {
        source: "html_description_section",
        selector:
          '[data-selenium="hotel-description"], [data-element-name*="description"], [class*="Description"], [class*="description"]',
      },
    ]),
    {
      source: "json_ld_description",
      value: typeof hotelJson?.description === "string" ? hotelJson.description : "",
    },
    {
      source: "meta_description",
      value: $('meta[name="description"]').attr("content") || "",
    },
    {
      source: "og_description",
      value: $('meta[property="og:description"]').attr("content") || "",
    },
    {
      source: "html_narrative_details",
      value: narrativeDetailsDescription,
    },
  ];

  let selectedDescriptionCandidate =
    pickBestTextCandidate(descriptionCandidates, scoreDescriptionCandidate) ?? {
      source: "meta_description",
      value: $('meta[name="description"]').attr("content") || "",
    };
  let description = cleanAgodaDescriptionValue(
    selectedDescriptionCandidate.source,
    selectedDescriptionCandidate.value
  );
  const descriptionIsRejected =
    isAgodaLocationPoiText(description) || isAgodaPolicyRulesText(description);
  if (descriptionIsRejected) {
    const fallbackDescriptionCandidate = pickBestTextCandidate(
      descriptionCandidates.filter((candidate) => {
        if (candidate.source === selectedDescriptionCandidate.source) return false;
        if (isAgodaLocationPoiText(candidate.value)) return false;
        if (isAgodaPolicyRulesText(candidate.value)) return false;
        return true;
      }),
      scoreDescriptionCandidate
    );

    if (fallbackDescriptionCandidate) {
      selectedDescriptionCandidate = fallbackDescriptionCandidate;
      description = cleanAgodaDescriptionValue(
        selectedDescriptionCandidate.source,
        selectedDescriptionCandidate.value
      );
    }
  }
  const narrativeFallbackDescription = cleanAgodaDescriptionValue(
    "html_narrative_details",
    narrativeDetailsDescription
  );
  if (
    (isAgodaLocationPoiText(description) || isAgodaPolicyRulesText(description)) &&
    narrativeFallbackDescription &&
    !isAgodaLocationPoiText(narrativeFallbackDescription) &&
    !isAgodaPolicyRulesText(narrativeFallbackDescription)
  ) {
    selectedDescriptionCandidate = {
      source: "html_narrative_details",
      value: narrativeFallbackDescription,
    };
    description = narrativeFallbackDescription;
  }
  if (isAgodaLocationPoiText(description) || isAgodaPolicyRulesText(description)) {
    description = "";
  }

  const payloadPhotos = collectPayloadImageUrls(parsedPayloads);
  const jsonEmbeddedPhotos = structuredScriptData
    .flatMap((block) => extractImageUrlsFromUnknown(block))
    .filter(isLikelyAgodaListingPhotoUrl);
  const jsonLdPhotos = jsonLdBlocks
    .flatMap((block) => extractImageUrlsFromUnknown(block))
    .filter(isLikelyAgodaListingPhotoUrl);
  const domPhotos = [
    ...$('meta[property="og:image"]').map((_, el) => $(el).attr("content") || "").get(),
    ...$('meta[name="twitter:image"]').map((_, el) => $(el).attr("content") || "").get(),
    ...$('[data-selenium*="gallery"] img, img')
      .map((_, el) => $(el).attr("src") || $(el).attr("data-src") || "")
      .get(),
  ].filter(isLikelyAgodaListingPhotoUrl);

  const fallbackPhotos = dedupeImageUrls(
    uniqueStrings(
      [...payloadPhotos, ...jsonEmbeddedPhotos, ...jsonLdPhotos, ...domPhotos].map((photo) =>
        photo.startsWith("//") ? `https:${photo}` : photo
      )
    ).filter(
      isLikelyAgodaListingPhotoUrl
    )
  ).slice(0, 80);
  const gallerySnapshot = buildAgodaGallerySnapshot(
    parsedPayloads,
    structuredScriptData,
    fallbackPhotos
  );
  const photos = gallerySnapshot.urls.length > 0 ? gallerySnapshot.urls.slice(0, 80) : fallbackPhotos;
  const payloadPhotoTotalCandidate = pickLargestNumericCandidate([
    ...parsedPayloads.flatMap((payload, index) =>
      collectAgodaPhotoTotalCandidatesFromValue(payload.parsed, `payload.${index}`)
    ),
    ...collectPayloadNumericCandidates(
      parsedPayloads,
      /^(photoCount|photosCount|imageCount|imagesCount|galleryCount|totalPhotos|totalImages|mediaCount)$/i,
      parseAgodaMaybeNumber,
      (value) => value > 0 && value <= 1000
    ),
    ...collectPayloadTextCandidates(
      parsedPayloads,
      /^(title|label|name|tabTitle|categoryName|caption)$/i
    )
      .map((candidate) => ({
        source: candidate.source,
        value: candidate.value,
        parsed: parseAgodaPhotoTotalFromText(candidate.value),
      }))
      .filter((candidate) => candidate.parsed != null),
  ]);
  const structuredPhotoTotalCandidate = pickLargestNumericCandidate([
    ...structuredScriptData.flatMap((block, index) =>
      collectAgodaPhotoTotalCandidatesFromValue(block, `structured.${index}`)
    ),
    ...structuredScriptData.flatMap((block) =>
      collectStringValuesByKeyPattern(
        block,
        /^(photoCount|photosCount|imageCount|imagesCount|galleryCount|totalPhotos|totalImages|mediaCount)$/i
      ).map((candidate) => ({
        source: candidate.source,
        value: candidate.value,
        parsed: (() => {
          const value = parseAgodaMaybeNumber(candidate.value);
          return value != null && value > 0 && value <= 1000 ? Math.round(value) : null;
        })(),
      }))
    ),
    ...structuredScriptData.flatMap((block) =>
      collectStringValuesByKeyPattern(
        block,
        /^(title|label|name|tabTitle|categoryName|caption)$/i
      ).map((candidate) => ({
        source: candidate.source,
        value: candidate.value,
        parsed: parseAgodaPhotoTotalFromText(candidate.value),
      }))
    ).filter((candidate) => candidate.parsed != null),
  ]);
  const domPhotoTabCandidate = pickLargestNumericCandidate(collectAgodaDomPhotoTotalCandidates($));
  const totalFromPayloads = payloadPhotoTotalCandidate?.parsed ?? null;
  const totalFromScripts = structuredPhotoTotalCandidate?.parsed ?? null;
  const totalFromTabs = domPhotoTabCandidate?.parsed ?? null;
  const galleryConfirmedTotal = gallerySnapshot.total ?? null;
  const confirmedTotal = [galleryConfirmedTotal, totalFromPayloads, totalFromScripts, totalFromTabs]
    .filter((value): value is number => typeof value === "number" && value > 0 && value <= 2000)
    .sort((a, b) => a - b)[0] ?? null;
  const finalPhotosCount = confirmedTotal ?? photos.length;

  const photoSource =
    gallerySnapshot.source
      ? gallerySnapshot.source
      : payloadPhotos.length > 0
      ? "network_payload"
      : jsonEmbeddedPhotos.length > 0
      ? "json_embedded"
      : jsonLdPhotos.length > 0
        ? "json_ld"
          : domPhotos.length > 0
          ? "html_gallery"
          : null;
  const photoCountSource =
    galleryConfirmedTotal != null && finalPhotosCount === galleryConfirmedTotal
      ? `${photoSource ?? "unknown"}+gallery_total`
      : finalPhotosCount > photos.length
      ? totalFromPayloads === finalPhotosCount
        ? `${photoSource ?? "unknown"}+payload_total`
        : totalFromScripts === finalPhotosCount
          ? `${photoSource ?? "unknown"}+structured_total`
          : totalFromTabs === finalPhotosCount
            ? `${photoSource ?? "unknown"}+dom_tabs_total`
            : photoSource
      : photoSource;

  const highlightSource = pickBestAgodaListSource([
    ...collectPayloadListSources(
      parsedPayloads,
      /^(highlight|highlights|feature|features|benefit|benefits|topFeature|topFeatures)$/i
    ),
    ...extractAgodaListFromStructured(
      structuredScriptData,
      /^(highlight|highlights|feature|features|benefit|benefits)$/i
    ),
    {
      source: "html_highlights",
      values: extractDomTextCandidates($, [
        { source: "html_highlights", selector: '[data-selenium*="highlight"], [class*="Highlight"] li, [class*="Benefit"] li' },
      ]).map((candidate) => candidate.value),
    },
  ]);

  const structuredAmenityRawValues = uniqueStrings([
    ...parsedPayloads.flatMap((payload) => extractAgodaAmenityValuesFromStructuredValue(payload.parsed)),
    ...structuredScriptData.flatMap((block) => extractAgodaAmenityValuesFromStructuredValue(block)),
  ]);
  const modalAmenitiesValues = [
    ...extractDomTextCandidates($, [
      {
        source: "html_amenities_modal",
        selector:
          '[role="dialog"] li, [role="dialog"] [class*="Amenit"], [role="dialog"] [class*="Facility"], [role="dialog"] [class*="Service"], [aria-modal="true"] li',
      },
    ]).map((candidate) => candidate.value),
    ...$('[role="dialog"] button, [aria-modal="true"] button, [role="dialog"] span, [aria-modal="true"] span')
      .map((_, el) => $(el).text())
      .get(),
  ];
  const visibleBodyAmenityTokens = extractAgodaModalAmenityTokens([
    $("body").text(),
  ]);

  const payloadAmenitiesSources = collectPayloadListSources(
    parsedPayloads,
    /^(amenit|facilit|feature|services?|comfort|access|mobility|accessibility|facilityGroups?|facilitiesList)$/i
  );
  const structuredAmenitiesSources = extractAgodaListFromStructured(
    structuredScriptData,
    /^(amenit|facilit|feature|services?|comfort|access|mobility|accessibility)$/i
  );
  const domAmenitiesValues = [
    ...extractDomTextCandidates($, [
      {
        source: "html_amenities",
        selector:
          '[data-selenium*="facility"], [data-element-name*="facility"], [class*="Amenit"] li, [class*="Facility"] li, [class*="facility"] li, [class*="Service"] li',
      },
    ]).map((candidate) => candidate.value),
    ...$("li, span, div")
      .map((_, el) => $(el).text())
      .get()
      .filter((text) => {
        const value = text.toLowerCase();
        return (
          value.length >= 3 &&
          value.length <= 80 &&
          [
            "wifi",
            "pool",
            "parking",
            "breakfast",
            "air conditioning",
            "spa",
            "gym",
            "restaurant",
            "kitchen",
            "beach",
            "shuttle",
            "tv",
          ].some((keyword) => value.includes(keyword))
        );
      }),
  ];
  const structuredAmenitySource = {
    source: "payload_structured_amenities",
    values: structuredAmenityRawValues,
  };
  const structuredAmenityBaseItems = uniqueStrings(
    structuredAmenitySource.values
      .map(cleanAgodaListValue)
      .filter(looksUsefulAgodaAmenityValue)
      .map(normalizeAgodaAmenityDisplay)
  );
  const modalAmenityExtractedTokens = uniqueStrings([
    ...extractAgodaModalAmenityTokens(modalAmenitiesValues),
    ...extractAgodaModalAmenityTokens(modalVisibleItems),
    ...visibleBodyAmenityTokens,
  ]);
  const modalAmenitySupplementItems = uniqueStrings(
    [...modalAmenitiesValues, ...modalVisibleItems, ...modalAmenityExtractedTokens]
      .map(cleanAgodaListValue)
      .filter(isAgodaModalAmenitySupplementValue)
      .map(normalizeAgodaAmenityDisplay)
  );

  const amenitiesSourceCandidate = (
    [
      {
        source: structuredAmenitySource.source,
        rawValues: structuredAmenitySource.values,
        normalizedValues: uniqueStrings(
          structuredAmenitySource.values.map(cleanAgodaListValue).filter(looksUsefulAgodaAmenityValue)
        ),
      },
      ...payloadAmenitiesSources.map((source) => ({
        source: source.source,
        rawValues: source.values,
        normalizedValues: uniqueStrings(
          source.values.map(cleanAgodaListValue).filter(looksUsefulAgodaAmenityValue)
        ),
      })),
      ...structuredAmenitiesSources.map((source) => ({
        source: source.source,
        rawValues: source.values,
        normalizedValues: uniqueStrings(
          source.values.map(cleanAgodaListValue).filter(looksUsefulAgodaAmenityValue)
        ),
      })),
      {
        source: "html_amenities",
        rawValues: domAmenitiesValues,
        normalizedValues: uniqueStrings(
          domAmenitiesValues.map(cleanAgodaListValue).filter(looksUsefulAgodaAmenityValue)
        ),
      },
      {
        source: "html_amenities_modal",
        rawValues: modalAmenitiesValues,
        normalizedValues: uniqueStrings(
          modalAmenitiesValues.map(cleanAgodaListValue).filter(looksUsefulAgodaAmenityValue)
        ),
      },
    ]
      .map((source) => ({
        ...source,
        score:
          (source.source === "payload_structured_amenities" ? 260 :
            source.source.startsWith("payload.") ? 200 :
            source.source.startsWith("structured.") ? 120 :
            source.source.includes("modal") ? 90 :
            source.source.startsWith("html_") ? 40 : 0) +
          source.normalizedValues.length,
      }))
      .filter((source) => source.normalizedValues.length > 0)
      .sort((a, b) => b.score - a.score)[0] ?? null
  );

  const highlights = highlightSource?.values.slice(0, 20) ?? [];
  const amenityMap = new Map<string, string>();
  structuredAmenityBaseItems.forEach((item) => {
    amenityMap.set(getAgodaAmenityKey(item), item);
  });
  const modalSupplementAdded: string[] = [];
  modalAmenitySupplementItems.forEach((item) => {
    const key = getAgodaAmenityKey(item);
    if (!amenityMap.has(key)) {
      amenityMap.set(key, item);
      modalSupplementAdded.push(item);
    }
  });
  const amenities = [...amenityMap.values()].slice(0, 80);
  const payloadAmenitiesCount = payloadAmenitiesSources.reduce((max, source) => {
    const filtered = uniqueStrings(source.values.map(cleanAgodaListValue).filter(looksUsefulAgodaAmenityValue));
    return Math.max(max, filtered.length);
  }, 0);
  const domAmenitiesCount = uniqueStrings(
    domAmenitiesValues.map(cleanAgodaListValue).filter(looksUsefulAgodaAmenityValue)
  ).length;
  const modalAmenitiesCount = uniqueStrings(
    modalAmenitiesValues.map(cleanAgodaListValue).filter(looksUsefulAgodaAmenityValue)
  ).length;

  const hostCandidate =
    pickBestTextCandidate(
      [
        ...collectPayloadTextCandidates(
          parsedPayloads,
          /^(hostName|host|propertyHost|managedBy|owner|provider|aboutHost|hostInfo)$/i
        ),
        ...structuredScriptData.flatMap((block) =>
          collectStringValuesByKeyPattern(
            block,
            /^(hostName|host|propertyHost|managedBy|owner|provider|aboutHost)$/i
          )
        ),
        ...extractDomTextCandidates($, [
          {
            source: "html_host",
            selector:
              '[data-selenium*="host"], [data-element-name*="host"], [class*="Host"], [class*="host"]',
          },
        ]),
      ],
      scoreAgodaRichTextCandidate
    ) ?? null;
  const hostNameCandidate =
    pickBestTextCandidate(
      [
        ...collectPayloadTextCandidates(
          parsedPayloads,
          /^(hostName|displayName|partnerName|ownerName|propertyHost|managedBy|owner|provider|host)$/i
        ),
        ...structuredScriptData.flatMap((block) =>
          collectStringValuesByKeyPattern(
            block,
            /^(hostName|displayName|partnerName|ownerName|propertyHost|managedBy|owner|provider|host)$/i
          )
        ),
        ...extractDomTextCandidates($, [
          {
            source: "html_host_name",
            selector:
              '[data-selenium*="host"], [data-element-name*="host"], [class*="Host"], [class*="host"]',
          },
        ]),
        ...(hostCandidate?.value
          ? [{ source: "host_from_host_info", value: hostCandidate.value }]
          : []),
      ]
        .map((candidate) => ({
          source: candidate.source,
          value: extractAgodaHostNameFromMixedText(candidate.value) ?? "",
        }))
        .filter((candidate) => candidate.value.length > 0),
      scoreAgodaHostNameCandidate
    ) ?? null;

  const rulesSource = pickBestAgodaListSource([
    ...collectPayloadListSources(
      parsedPayloads,
      /^(checkIn|checkOut|policy|policies|houseRules|rules|childrenPolicy|smoking|pets|propertyPolicy|importantInfo)$/i
    ),
    ...extractAgodaListFromStructured(
      structuredScriptData,
      /^(checkIn|checkOut|policy|policies|houseRules|rules|childrenPolicy|smoking|pets|propertyPolicy)$/i
    ),
    {
      source: "html_rules",
      values: extractDomTextCandidates($, [
        {
          source: "html_rules",
          selector:
            '[data-selenium*="policy"], [data-selenium*="check"], [data-element-name*="policy"], [class*="Policy"] li, [class*="Rule"] li, [class*="CheckIn"]',
        },
      ]).map((candidate) => candidate.value),
    },
  ]);

  const locationSource = pickBestAgodaListSource([
    ...collectPayloadListSources(
      parsedPayloads,
      /^(location|address|area|district|neighborhood|landmark|transport|airport|attraction|poi|nearby|place|places)$/i
    ),
    ...extractAgodaListFromStructured(
      structuredScriptData,
      /^(location|address|area|district|neighborhood|landmark|transport|airport|attraction|poi|nearby)$/i
    ),
    {
      source: "html_location",
      values: extractDomTextCandidates($, [
        {
          source: "html_location",
          selector:
            '[data-selenium*="location"], [data-selenium*="address"], [data-element-name*="location"], [class*="Location"], [class*="Nearby"] li, [class*="Transport"] li',
        },
      ]).map((candidate) => candidate.value),
    },
  ]);
  const normalizedLocationValues = uniqueStrings(
    (locationSource?.values ?? []).map(cleanAgodaListValue).filter(looksUsefulAgodaLocationValue)
  );
  const htmlReviewScoreRaw =
    $('[data-selenium="review-score"]').first().text() ||
    $('[class*="ReviewScore"]').first().text() ||
    $('[class*="review-score"]').first().text();
  const htmlReviewCountRaw =
    $('[data-selenium="review-count"]').first().text() ||
    $('[class*="Review-comment"]').first().text() ||
    $('[class*="review-count"]').first().text();
  const structuredReviewCandidates = buildAgodaReviewCandidates(parsedPayloads, hotelJson);
  const ratingCandidate = pickFirstNumericCandidate([
    ...structuredReviewCandidates.ratingCandidates,
    {
      source: "html_review_score",
      value: htmlReviewScoreRaw,
      parsed: parseAgodaPlausibleRating(htmlReviewScoreRaw),
    },
  ]);

  const reviewCountCandidate = pickFirstNumericCandidate([
    ...structuredReviewCandidates.reviewCountCandidates,
    {
      source: "html_review_count",
      value: htmlReviewCountRaw,
      parsed: parseAgodaPlausibleReviewCount(htmlReviewCountRaw),
    },
  ]);
  const reliableRatingCandidate = ratingCandidate?.parsed != null ? ratingCandidate : null;
  const reliableReviewCountCandidate =
    reliableRatingCandidate && reviewCountCandidate?.parsed != null ? reviewCountCandidate : null;

  const structureSourceCandidates = [
    ...collectPayloadTextCandidates(
      parsedPayloads,
      /^(bedrooms?|bathrooms?|beds?|guests?|maxOccupancy|occupancy|propertyType|roomType|area|size)$/i
    ),
    ...collectAgodaStructureCandidates(structuredScriptData),
  ];
  const structure = {
    capacity:
      parseAgodaMaybeNumber(
        structureSourceCandidates.find((candidate) => /guests?|occupancy/i.test(candidate.source))
          ?.value ?? ""
      ) ?? null,
    bedrooms:
      parseAgodaMaybeNumber(
        structureSourceCandidates.find((candidate) => /bedrooms?/i.test(candidate.source))?.value ??
          ""
      ) ?? null,
    bedCount:
      parseAgodaMaybeNumber(
        structureSourceCandidates.find((candidate) => /beds?/i.test(candidate.source))?.value ?? ""
      ) ?? null,
    bathrooms:
      parseAgodaMaybeNumber(
        structureSourceCandidates.find((candidate) => /bathrooms?/i.test(candidate.source))?.value ??
          ""
      ) ?? null,
    propertyType:
      structureSourceCandidates.find((candidate) => /propertytype|roomtype/i.test(candidate.source))
        ?.value ?? null,
    locationLabel: normalizedLocationValues[0] ?? null,
  };

  const warnings = uniqueStrings([
    selectedDescriptionCandidate.source.startsWith("html_") ||
    selectedDescriptionCandidate.source === "meta_description" ||
    selectedDescriptionCandidate.source === "body_fallback"
      ? "Description probablement partielle"
      : "",
    "Plateforme limite l'acces aux donnees",
    photos.length === 0 ? "Photos non trouvees" : "",
    photoSource === "html_gallery" ? "Photos obtenues via fallback DOM" : "",
    amenitiesSourceCandidate?.source === "html_amenities" ? "Equipements obtenus via fallback DOM" : "",
    parsedPayloads.length === 0 ? "Aucun payload reseau Agoda utile capture" : "",
  ]);

  const titleConfidence =
    selectedTitleCandidate.source.startsWith("payload.") ||
    selectedTitleCandidate.source.startsWith("root.") ||
    selectedTitleCandidate.source === "json_ld_name"
      ? 0.7
      : selectedTitleCandidate.source === "h1"
        ? 0.6
        : 0.5;

  const descriptionConfidence =
    selectedDescriptionCandidate.source.startsWith("payload.")
      ? 0.8
      : selectedDescriptionCandidate.source.startsWith("root.")
      ? 0.65
      : selectedDescriptionCandidate.source.startsWith("html_")
        ? 0.5
        : selectedDescriptionCandidate.source === "meta_description" ||
            selectedDescriptionCandidate.source === "og_description"
          ? 0.35
          : 0.4;

  const photoConfidence =
    photoSource === "network_payload" || photoSource?.includes("mosaicInitData")
      ? 0.82
      : photoSource === "json_embedded"
      ? 0.7
      : photoSource === "json_ld"
        ? 0.6
        : photoSource === "html_gallery"
        ? 0.45
          : 0.3;

  debugGuestAuditLog("[guest-audit][agoda][debug]", {
    networkPayloads: {
      count: parsedPayloads.length,
      matchedUrls: parsedPayloads.slice(0, 20).map((payload) => payload.url),
    },
    title: {
      source: selectedTitleCandidate.source,
      value: title,
    },
    description: {
      source: selectedDescriptionCandidate.source,
      length: description.length,
      preview: description.slice(0, 200),
    },
    photos: {
      source: photoCountSource,
      count: finalPhotosCount,
      urlsCount: photos.length,
      totalFromTabs,
      totalFromPayloads: totalFromPayloads ?? totalFromScripts,
    },
    amenities: {
      source: amenitiesSourceCandidate?.source ?? null,
      count: amenities.length,
      preview: amenities.slice(0, 10),
    },
    review: {
      rating: {
        source: reliableRatingCandidate?.source ?? null,
        value: reliableRatingCandidate?.value ?? null,
        scale: reliableRatingCandidate?.parsed != null ? 10 : null,
      },
      reviewCount: {
        source: reliableReviewCountCandidate?.source ?? null,
        value: reliableReviewCountCandidate?.value ?? null,
      },
    },
    structure: {
      source: structureSourceCandidates.length > 0 ? "structured_candidates" : null,
      value: structure,
    },
    host: {
      source: hostCandidate?.source ?? null,
      value: hostCandidate?.value ?? null,
    },
    rules: {
      source: rulesSource?.source ?? null,
      value: rulesSource?.values.slice(0, 10) ?? [],
    },
    location: {
      source: locationSource?.source ?? null,
      value: normalizedLocationValues.slice(0, 10),
    },
    domSignals: {
      hasGallery: photos.length > 0,
      hasAmenities: amenities.length > 0,
      hasDescription: description.length > 0,
      hasHost: Boolean(hostCandidate?.value),
      hasRules: Boolean(rulesSource?.values.length),
      hasLocation: Boolean(normalizedLocationValues.length),
      hasStructuredData: structuredScriptData.length > 0 || jsonLdBlocks.length > 0,
    },
  });

  debugGuestAuditLog("[guest-audit][agoda][photo-amenities-debug]", {
    photos: {
      urlsCount: photos.length,
      totalFromPayloads,
      totalFromScripts,
      totalFromTabs,
      finalCount: finalPhotosCount,
      source: photoCountSource,
    },
    amenities: {
      payloadCount: payloadAmenitiesCount,
      domCount: domAmenitiesCount,
      modalCount: modalAmenitiesCount,
      finalCount: amenities.length,
      source: amenitiesSourceCandidate?.source ?? null,
      preview: amenities.slice(0, 10),
    },
  });

  debugGuestAuditLog("[guest-audit][agoda][AMENITIES-FINAL]", {
    rawItems: {
      structured: structuredAmenitySource.values,
      modal: modalAmenitiesValues,
    },
    normalizedItems: {
      structuredBase: structuredAmenityBaseItems,
      modalExtractedTokens: modalAmenityExtractedTokens,
      visibleBodyTokens: visibleBodyAmenityTokens,
      modalCandidates: modalAmenitySupplementItems,
      modalSupplementAdded,
    },
    finalItems: amenities,
    finalCount: amenities.length,
    source: `${amenitiesSourceCandidate?.source ?? null}+modal_supplement`,
  });

  debugGuestAuditLog("[guest-audit][agoda][MODAL-AMENITIES]", {
    structuredBase: structuredAmenityBaseItems,
    modalVisibleItems,
    finalItems: amenities,
    finalCount: amenities.length,
    source: `${amenitiesSourceCandidate?.source ?? null}+modal_visible`,
    opened: {
      info: Boolean(pageData.data?.agodaModalAmenitiesOpened),
      amenitiesTab: Boolean(pageData.data?.agodaAmenitiesTabOpened),
    },
  });

  debugGuestAuditLog("[guest-audit][agoda][FINAL-PHOTOS]", {
    urlsCount: photos.length,
    totalFromPayloads,
    totalFromScripts,
    totalFromTabs,
    chosenTotal: finalPhotosCount,
  });

  debugGuestAuditLog("[guest-audit][agoda][CASE-DEBUG]", {
    title: {
      source: selectedTitleCandidate.source,
      value: title,
    },
    description: {
      source: selectedDescriptionCandidate.source,
      length: description.length,
      preview: description.slice(0, 200),
    },
    photos: {
      source: photoCountSource,
      urlsCount: photos.length,
      totalFromPayloads,
      totalFromScripts,
      totalFromTabs,
      chosenTotal: finalPhotosCount,
    },
    review: {
      rating: {
        source: reliableRatingCandidate?.source ?? null,
        value: reliableRatingCandidate?.value ?? null,
        scale: reliableRatingCandidate?.parsed != null ? 10 : null,
      },
      reviewCount: {
        source: reliableReviewCountCandidate?.source ?? null,
        value: reliableReviewCountCandidate?.value ?? null,
      },
    },
  });

  return {
    url,
    sourceUrl: url,
    platform: "agoda",
    sourcePlatform: "agoda",
    externalId: parseAgodaExternalId(url),
    title,
    titleMeta: {
      ...buildFieldMeta({
        source: selectedTitleCandidate.source,
        value: title,
        quality: inferTitleQuality(title),
      }),
      confidence: titleConfidence,
    },
    description,
    descriptionMeta: {
      ...buildFieldMeta({
        source: selectedDescriptionCandidate.source,
        value: description,
        quality: inferDescriptionQuality(description),
      }),
      confidence: descriptionConfidence,
    },
    amenities,
    highlights,
    hostName: hostNameCandidate?.value ?? null,
    hostInfo: hostCandidate?.value ?? null,
    rules: rulesSource?.values.slice(0, 20) ?? [],
    locationDetails: normalizedLocationValues.slice(0, 20),
    photos,
    photosCount: finalPhotosCount,
    photoMeta: {
      ...buildPhotoMeta({
        source: photoCountSource,
        photos,
      }),
      count: finalPhotosCount,
      quality: inferPhotoQuality(finalPhotosCount),
      confidence: photoConfidence,
    },
    structure,
    capacity: structure.capacity,
    bedrooms: structure.bedrooms,
    bedCount: structure.bedCount,
    bathrooms: structure.bathrooms,
    locationLabel: structure.locationLabel,
    propertyType: structure.propertyType,
    rating: reliableRatingCandidate?.parsed ?? null,
    ratingValue: reliableRatingCandidate?.parsed ?? null,
    ratingScale: reliableRatingCandidate?.parsed != null ? 10 : null,
    reviewCount: reliableReviewCountCandidate?.parsed ?? null,
    occupancyObservation: {
      status: "unavailable",
      rate: null,
      unavailableDays: 0,
      availableDays: 0,
      observedDays: 0,
      windowDays: 60,
      source: null,
      message: "Donnees d'occupation non disponibles pour cette annonce",
    },
    extractionMeta: {
      extractor: "agoda",
      extractedAt: new Date().toISOString(),
      warnings,
    },
  };
}

                                             