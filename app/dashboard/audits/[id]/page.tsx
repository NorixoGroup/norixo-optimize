"use client";

import { useEffect, useMemo, useState } from "react";
import { buildMarketPositionSummary } from "@/ai/marketPosition";
import { buildPhotoSuggestions } from "@/lib/recommendations/buildPhotoSuggestions";
import { buildTextSuggestions } from "@/lib/recommendations/buildTextSuggestions";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getOrCreateWorkspaceForUser } from "@/lib/workspaces/ensureWorkspaceForUser";
import { getWorkspacePlan } from "@/lib/billing/getWorkspacePlan";

type AuditResult = {
  score?: number;
  overallScore?: number;
  scoreBreakdown?: {
    photos?: number | null;
    photoOrder?: number | null;
    description?: number | null;
    amenities?: number | null;
    seo?: number | null;
    trust?: number;
    conversion?: number;
    visibility?: number;
    dataQuality?: number;
  };
  metrics?: {
    photoCount?: number | null;
    reviewCount?: number | null;
    rating?: number | null;
    avgPrice?: number | null;
    currency?: string | null;
    photoQuality?: number | null;
    photoOrder?: number | null;
    descriptionQuality?: number | null;
    amenitiesCompleteness?: number | null;
    seoStrength?: number | null;
    conversionStrength?: number | null;
  };
  market?: {
    position?: "below" | "average" | "above" | null;
    score?: number | null;
    comparableCount?: number | null;
    avgCompetitorPrice?: number | null;
    priceDelta?: number | null;
  };
  business?: {
    bookingPotential?: number | null;
    estimatedRevenueLow?: number | null;
    estimatedRevenueHigh?: number | null;
  };
  content?: {
    summary?: string | null;
    strengths?: string[];
    weaknesses?: string[];
    insights?: string[];
    openingParagraph?: string | null;
    photoOrder?: string[];
    missingAmenities?: string[];
  };
  recommendations?:
    | {
        critical?: string[];
        highImpact?: string[];
        improvements?: string[];
      }
    | string[];
  insights?: string[];
  subScores?: Array<{
    key?: string;
    label?: string;
    score?: number | null;
  }>;
  photoQuality?: number;
  photoOrder?: number | string[];
  descriptionQuality?: number;
  amenitiesCompleteness?: number;
  seoStrength?: number;
  conversionStrength?: number;
  marketPositioning?: {
    status?: string;
    comparableCount?: number;
    averageScore?: number | null;
    avgPrice?: number | null;
    priceDeltaPercent?: number | null;
    comparables?: unknown[] | null;
  };
  marketComparison?:
    | {
        position?: string | null;
        averageScore?: number | null;
        avgCompetitorPrice?: number | null;
        priceDelta?: number | null;
      }
    | null;
  strengths?: string[];
  weaknesses?: string[];
  improvements?: {
    id?: string;
    title?: string;
    description?: string;
    impact?: string;
    orderIndex?: number;
  }[];
  summary?: string | null;
  critical?: string[];
  highImpact?: string[];
  bookingPotential?: number | null;
  estimatedRevenue?: {
    low?: number | null;
    high?: number | null;
  } | null;
  suggestedOpening?: string;
  photoOrderSuggestions?: string[];
  missingAmenities?: string[];
  competitorSummary?: {
    competitorCount?: number;
    averageOverallScore?: number;
    targetVsMarketPosition?: string;
    keyGaps?: string[];
    keyAdvantages?: string[];
  };
  listingQualityIndex?: {
    score?: number;
    label?: string;
    summary?: string;
    components?: {
      listingQuality?: number;
      marketCompetitiveness?: number;
      conversionPotential?: number;
    };
  };
  estimatedBookingLift?: {
    low?: number;
    high?: number;
    label?: string;
    summary?: string;
  };
  estimatedRevenueImpact?: {
    lowMonthly?: number;
    highMonthly?: number;
    summary?: string;
  };
  impactSummary?: string;
  marketPosition?: {
    score?: number;
    label?: "underperforming" | "below_market" | "competitive" | "top_performer";
    summary?: string;
    avgCompetitorPrice?: number | null;
    avgCompetitorScore?: number | null;
    avgCompetitorRating?: number | null;
    priceDeltaPercent?: number | null;
  };
};

type ListingJoin =
  | {
      id: string;
      title: string | null;
      source_platform: string | null;
      source_url: string | null;
      price?: number | null;
      currency?: string | null;
      city?: string | null;
      description?: string | null;
      amenities?: string[] | null;
    }
  | null;

type AiTextSections = {
  main: string;
  logement: string;
  acces: string;
  echanges: string;
  autresInfos: string;
};

type AiVariant = AiTextSections;
type AiTextSectionKey = keyof AiTextSections;

type AuditRecord = {
  id: string;
  listing_id: string;
  created_at: string;
  overall_score: number | null;
  booking_lift_low: number | null;
  booking_lift_high: number | null;
  revenue_impact_low: number | null;
  revenue_impact_high: number | null;
  result_payload: AuditResult | null;
  listings: ListingJoin;
};

function parseAuditResultPayload(value: unknown): AuditResult | null {
  if (!value) return null;

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object") {
        return parsed as AuditResult;
      }
      return null;
    } catch {
      return null;
    }
  }

  if (typeof value === "object") {
    return value as AuditResult;
  }

  return null;
}

function normalizeAuditRecord(value: AuditRecord | null): AuditRecord | null {
  if (!value) return null;

  return {
    ...value,
    result_payload: parseAuditResultPayload(value.result_payload),
  };
}

function normalizeListingJoin(listing: ListingJoin | ListingJoin[] | null) {
  if (!listing) return null;
  if (Array.isArray(listing)) return listing[0] ?? null;
  return listing;
}

function buildAiKeywords(options: { title?: string; location?: string }) {
  const { title, location } = options;
  const keywords: string[] = [];

  if (title) {
    keywords.push(title.toLowerCase());
  }

  if (location) {
    keywords.push(`${location} séjour`.toLowerCase());
    keywords.push(`${location} location courte durée`.toLowerCase());
  }

  if (keywords.length === 0) {
    keywords.push(
      "annonce optimisée",
      "séjour à fort potentiel",
      "hébergement attractif"
    );
  }

  return keywords.slice(0, 4);
}

function limitText(text: string, max: number) {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

function normalizeSentence(value?: string | null) {
  if (!value) return "";
  return value.replace(/\s+/g, " ").trim();
}

function splitIntoSentences(value?: string | null) {
  return normalizeSentence(value)
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinFrenchList(values: string[]) {
  if (values.length === 0) return "";
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} et ${values[1]}`;
  return `${values.slice(0, -1).join(", ")} et ${values[values.length - 1]}`;
}

function sentenceCase(value: string) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function buildAirbnbDescriptionVariants(options: {
  title?: string | null;
  location?: string | null;
  amenities?: string[] | null;
  description?: string | null;
  sourcePlatform?: string | null;
  missingAmenities?: string[];
}): AiVariant[] {
  const title = normalizeSentence(options.title) || "ce logement";
  const location = normalizeSentence(options.location);
  const description = normalizeSentence(options.description);
  const amenities = Array.isArray(options.amenities)
    ? options.amenities
        .map((item) => normalizeSentence(item))
        .filter(Boolean)
        .filter((item, index, array) => array.indexOf(item) === index)
    : [];
  const missingAmenities = Array.isArray(options.missingAmenities)
    ? options.missingAmenities
        .map((item) => normalizeSentence(item))
        .filter(Boolean)
        .filter((item, index, array) => array.indexOf(item) === index)
    : [];
  const sourcePlatform = normalizeSentence(options.sourcePlatform).toLowerCase();

  const amenityGroups = [
    { label: "Wi-Fi", pattern: /wi[\s-]?fi|internet/i },
    { label: "climatisation", pattern: /clim|air ?condition/i },
    { label: "piscine", pattern: /piscine|pool/i },
    { label: "parking", pattern: /parking|garage/i },
    { label: "cuisine équipée", pattern: /cuisine|kitchen|four|micro-ondes|microondes|plaques|cafetière|coffee/i },
    { label: "TV", pattern: /\btv\b|télé|television/i },
    { label: "terrasse ou balcon", pattern: /terrasse|balcon|patio|outdoor/i },
    { label: "lave-linge", pattern: /lave[- ]linge|washer|washing/i },
    { label: "espace de travail", pattern: /bureau|workspace|desk/i },
    { label: "ascenseur", pattern: /ascenseur|elevator|lift/i },
  ];

  const verifiedAmenityLabels = amenityGroups
    .filter(({ pattern }) => amenities.some((item) => pattern.test(item)))
    .map(({ label }) => label);
  const additionalAmenityLabels = amenities
    .filter(
      (item) => !amenityGroups.some(({ pattern }) => pattern.test(item))
    )
    .slice(0, 3)
    .map((item) => item.toLowerCase());
  const guestFacingAmenities = [
    ...verifiedAmenityLabels,
    ...additionalAmenityLabels,
  ].slice(0, 6);

  const descriptionSentences = splitIntoSentences(description);
  const shortDescription = descriptionSentences.slice(0, 2);
  const locationText = location ? ` à ${location}` : "";
  const amenitySentence = guestFacingAmenities.length > 0
    ? `Vous profitez notamment de ${joinFrenchList(guestFacingAmenities.slice(0, 4))}.`
    : "Le logement est présenté comme un lieu simple à vivre, pensé pour un séjour confortable.";
  const reassuranceSentence = verifiedAmenityLabels.length > 0
    ? `L’annonce met en avant des repères concrets comme ${joinFrenchList(
        verifiedAmenityLabels.slice(0, 3)
      )}, pour aider les voyageurs à se projeter rapidement.`
    : "La lecture reste claire et rassurante, avec un ton adapté à une annonce professionnelle.";
  const accessScope = /entier|entière|entire|privatif|privative|private|exclusif/i.test(
    `${title} ${description}`
  )
    ? "Le logement est présenté comme un espace privatif dédié aux voyageurs."
    : "Les voyageurs profitent des espaces et équipements mentionnés dans l’annonce.";
  const platformChannel = sourcePlatform.includes("airbnb")
    ? "via la messagerie Airbnb"
    : sourcePlatform.includes("booking")
    ? "via la messagerie Booking"
    : "via la messagerie de la plateforme";

  const logementParagraphs = [
    `${sentenceCase(title)}${locationText}, avec une présentation centrée sur le confort et la facilité du séjour.`,
    guestFacingAmenities.length > 0
      ? `Équipements repérés dans l’annonce : ${joinFrenchList(guestFacingAmenities)}.`
      : "Le texte met surtout l’accent sur une expérience fluide et agréable au quotidien.",
    ...shortDescription,
  ].filter(Boolean);

  const accesParagraphs = [
    accessScope,
    guestFacingAmenities.length > 0
      ? `Selon les informations disponibles, les voyageurs peuvent profiter des équipements mis en avant, notamment ${joinFrenchList(
          guestFacingAmenities.slice(0, 4)
        )}.`
      : "Les équipements visibles dans l’annonce peuvent être rappelés ici pour clarifier l’expérience sur place.",
    location
      ? `La localisation à ${location} peut aussi être rappelée pour aider les voyageurs à mieux se projeter avant l’arrivée.`
      : "",
  ].filter(Boolean);

  const echangesParagraphs = [
    `Je reste disponible avant l’arrivée et pendant le séjour pour répondre rapidement aux questions pratiques.`,
    `Le contact peut se faire ${platformChannel}, afin de garder des échanges simples et rassurants.`,
    location
      ? `Je peux aussi partager quelques repères utiles pour profiter sereinement de ${location}.`
      : "L’objectif est de garder une communication fluide tout au long du séjour.",
  ].filter(Boolean);

  const autresInfosParagraphs = [
    location
      ? `Le logement se situe à ${location}, un repère utile à rappeler dans la version finale de l’annonce.`
      : "",
    guestFacingAmenities.length > 0
      ? `Parmi les points concrets déjà visibles dans les données : ${joinFrenchList(
          guestFacingAmenities.slice(0, 5)
        )}.`
      : "Les informations complémentaires peuvent insister sur les éléments vraiment confirmés dans l’annonce.",
    missingAmenities.length > 0
      ? `Si ces éléments existent réellement sur place, vous pouvez aussi préciser ${joinFrenchList(
          missingAmenities.slice(0, 3).map((item) => item.toLowerCase())
        )} pour compléter l’annonce.`
      : "",
  ].filter(Boolean);

  const variants: AiVariant[] = [
    {
      main: limitText(
        `Bienvenue dans ${title}${locationText}, une adresse agréable pour profiter du séjour dès les premières heures. ${amenitySentence} ${shortDescription[0] ? `${shortDescription[0]} ` : ""}Le ton reste rassurant, avec une arrivée simple et un cadre pensé pour voyager l’esprit léger.`,
        500
      ),
      logement: logementParagraphs.join("\n\n"),
      acces: accesParagraphs.join("\n\n"),
      echanges: echangesParagraphs.join("\n\n"),
      autresInfos: autresInfosParagraphs.join("\n\n"),
    },
    {
      main: limitText(
        `${title}${locationText} réunit le confort attendu pour un séjour soigné, avec une lecture claire de l’annonce et des équipements utiles au quotidien. ${amenitySentence} ${reassuranceSentence} ${shortDescription[0] ? `${shortDescription[0]} ` : ""}Un choix idéal pour réserver sereinement et profiter d’un pied-à-terre fiable.`,
        500
      ),
      logement: [
        `Le logement est présenté comme un pied-à-terre soigné${locationText}, pensé pour un séjour confortable et lisible dès les premières lignes.`,
        ...logementParagraphs.slice(1),
      ].join("\n\n"),
      acces: accesParagraphs.join("\n\n"),
      echanges: echangesParagraphs.join("\n\n"),
      autresInfos: autresInfosParagraphs.join("\n\n"),
    },
    {
      main: limitText(
        `${title}${locationText}, confortable et facile à vivre. ${amenitySentence} ${shortDescription[0] ? `${shortDescription[0]} ` : ""}Une base claire, pratique et rassurante pour un séjour sans complication.`,
        500
      ),
      logement: [
        `${sentenceCase(title)}${locationText}.`,
        guestFacingAmenities.length > 0
          ? `Points clés : ${joinFrenchList(guestFacingAmenities.slice(0, 5))}.`
          : "Le logement est décrit comme fonctionnel, confortable et simple à prendre en main.",
        ...shortDescription,
      ]
        .filter(Boolean)
        .join("\n\n"),
      acces: accesParagraphs.join("\n\n"),
      echanges: echangesParagraphs.join("\n\n"),
      autresInfos: autresInfosParagraphs.join("\n\n"),
    },
    {
      main: limitText(
        `Séjournez dans ${title}${locationText} et retrouvez l’essentiel pour réserver facilement : un logement lisible, un niveau de confort rassurant et des équipements utiles dès l’arrivée. ${amenitySentence} ${reassuranceSentence} Tout est pensé pour aider le voyageur à se projeter rapidement et à confirmer son séjour avec confiance.`,
        500
      ),
      logement: [
        `Cette version met d’abord en avant ce que le voyageur va retrouver sur place : ${joinFrenchList(
          guestFacingAmenities.slice(0, 4)
        ) || "un cadre agréable et des repères simples"}.`,
        ...logementParagraphs,
      ]
        .filter(Boolean)
        .join("\n\n"),
      acces: accesParagraphs.join("\n\n"),
      echanges: echangesParagraphs.join("\n\n"),
      autresInfos: autresInfosParagraphs.join("\n\n"),
    },
    {
      main: limitText(
        `${title}${locationText} offre une base confortable pour découvrir le quartier et profiter d’un séjour fluide. ${amenitySentence} ${location ? `La localisation à ${location} reste un vrai repère dans la lecture de l’annonce. ` : ""}${shortDescription[0] ? `${shortDescription[0]} ` : ""}La description met en avant les points concrets qui comptent le plus avant réservation.`,
        500
      ),
      logement: logementParagraphs.join("\n\n"),
      acces: accesParagraphs.join("\n\n"),
      echanges: echangesParagraphs.join("\n\n"),
      autresInfos: autresInfosParagraphs.join("\n\n"),
    },
  ];

  return variants;
}

function impactClass(impact?: string) {
  switch (impact) {
    case "high":
      return "border-rose-300 bg-rose-50 text-rose-800";
    case "medium":
      return "border-amber-300 bg-amber-50 text-amber-800";
    case "low":
      return "border-emerald-300 bg-emerald-50 text-emerald-800";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function marketLabelClass(label?: string) {
  switch (label) {
    case "above_market":
    case "top_performer":
      return "text-emerald-700";
    case "below_market":
    case "underperforming":
      return "text-rose-700";
    case "competitive":
      return "text-emerald-700";
    default:
      return "text-amber-700";
  }
}

function marketLabelText(label?: string) {
  switch (label) {
    case "above_market":
    case "top_performer":
      return "Au-dessus du marché";
    case "below_market":
    case "underperforming":
      return "En dessous du marché";
    case "competitive":
      return "Compétitif";
    default:
      return "Dans la moyenne du marché";
  }
}

function lqiLabelText(label?: string) {
  switch (label) {
    case "market_leader":
      return "Leader du marché";
    case "strong_performer":
      return "Très performant";
    case "competitive":
      return "Compétitif";
    case "improving":
      return "En progression";
    case "needs_work":
      return "À renforcer";
    default:
      return "Qualité de l’annonce";
  }
}

function toRoundedMetric(value?: unknown) {
  const numericValue = coerceFiniteNumber(value);
  return numericValue !== null ? Math.round(numericValue) : null;
}

function coerceFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(",", ".").trim();
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

const LEGACY_ENGLISH_MARKERS = [
  /\bthe\b/i,
  /\bwith\b/i,
  /\byour\b/i,
  /\bguests?\b/i,
  /\blisting\b/i,
  /\bmarket\b/i,
  /\bimprove\b/i,
  /\bhighlight\b/i,
  /\breorder\b/i,
  /\bopening paragraph\b/i,
  /\bsuggested\b/i,
  /\bbookings?\b/i,
  /\brevenue\b/i,
  /\bamenities\b/i,
  /\bworkspace\b/i,
];

const LEGACY_TRANSLATIONS: Array<[RegExp, string]> = [
  [/improve the first photo/gi, "améliorer la première photo"],
  [/better cover key rooms/gi, "mieux couvrir les pièces clés"],
  [/reorder photos for more impact/gi, "réorganiser les photos pour plus d’impact"],
  [/strengthen the opening paragraph/gi, "renforcer le paragraphe d’ouverture"],
  [/improve description structure/gi, "améliorer la structure de la description"],
  [/add concrete value points/gi, "ajouter des bénéfices concrets"],
  [/add or better highlight essential amenities/gi, "ajouter ou mieux valoriser les équipements essentiels"],
  [/highlight high-value amenities/gi, "mettre en avant les équipements à forte valeur perçue"],
  [/align amenities with guest expectations/gi, "aligner les équipements avec les attentes des voyageurs"],
  [/improve title clarity/gi, "améliorer la clarté du titre"],
  [/add descriptive keywords/gi, "ajouter des mots-clés descriptifs"],
  [/make the title more specific/gi, "rendre le titre plus précis"],
  [/strengthen trust and reassurance/gi, "renforcer la confiance et la réassurance"],
  [/improve listing completeness/gi, "améliorer la complétude de l’annonce"],
  [/highlight guest experience signals/gi, "mettre en avant les signaux d’expérience voyageur"],
  [/review pricing against the local market/gi, "revoir le prix par rapport au marché local"],
  [/align price with perceived value/gi, "aligner le prix avec la valeur perçue"],
  [/refine pricing strategy/gi, "affiner la stratégie tarifaire"],
  [/main living area/gi, "pièce de vie principale"],
  [/signature photo|hero photo/gi, "photo principale"],
  [/primary bedroom/gi, "chambre principale"],
  [/sleeping area/gi, "espace nuit"],
  [/bathroom/gi, "salle de bain"],
  [/kitchen or dining area/gi, "cuisine ou espace repas"],
  [/workspace or desk/gi, "espace de travail ou bureau"],
  [/key amenities and details/gi, "équipements clés et détails"],
  [/outdoor space, terrace or pool/gi, "espace extérieur, terrasse ou piscine"],
  [/view or neighborhood context/gi, "vue ou environnement du quartier"],
  [/add a clear and descriptive title/gi, "ajoutez un titre clair et descriptif"],
  [/write a short opening paragraph/gi, "rédigez un court paragraphe d’ouverture"],
  [/expand the description/gi, "étoffez la description"],
  [/break the description into short sections/gi, "découpez la description en sections courtes"],
  [/mention wifi availability/gi, "précisez la disponibilité du Wi-Fi"],
  [/highlight/gi, "mettez en avant"],
  [/improve/gi, "améliorez"],
  [/add/gi, "ajoutez"],
  [/update/gi, "mettez à jour"],
  [/reorder/gi, "réorganisez"],
  [/listing/gi, "annonce"],
  [/guests/gi, "voyageurs"],
  [/guest/gi, "voyageur"],
  [/bookings/gi, "réservations"],
  [/revenue/gi, "revenus"],
  [/market/gi, "marché"],
  [/amenities/gi, "équipements"],
  [/photos/gi, "photos"],
  [/description/gi, "description"],
  [/title/gi, "titre"],
];

function looksLegacyEnglish(value?: string | null) {
  if (!value) return false;
  const normalized = value.trim();
  if (!normalized) return false;
  return LEGACY_ENGLISH_MARKERS.some((pattern) => pattern.test(normalized));
}

function translateLegacyAuditText(value?: string | null) {
  if (!value) return "";

  let translated = value.trim();

  for (const [pattern, replacement] of LEGACY_TRANSLATIONS) {
    translated = translated.replace(pattern, replacement);
  }

  translated = translated
    .replace(/\b[Aa]nd\b/g, "et")
    .replace(/\b[Ww]ith\b/g, "avec")
    .replace(/\b[Ff]or\b/g, "pour")
    .replace(/\b[Tt]o\b/g, "pour")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (translated.length > 0) {
    translated = translated.charAt(0).toUpperCase() + translated.slice(1);
  }

  return translated;
}

function localizeGeneratedText(value?: string | null) {
  if (!value) return "";
  return looksLegacyEnglish(value) ? translateLegacyAuditText(value) : value;
}

function localizeGeneratedList(values: string[]) {
  return values
    .map((value) => localizeGeneratedText(value))
    .filter((value) => value.trim().length > 0);
}

export default function AuditDetailPage() {
  const params = useParams();
  const auditId = typeof params?.id === "string" ? params.id : "";

  const [audit, setAudit] = useState<AuditRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [showToast, setShowToast] = useState(true);
  const [, setIsPro] = useState(false);
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [copyToastKey, setCopyToastKey] = useState<AiTextSectionKey | null>(null);
  const [generationSeed, setGenerationSeed] = useState(0);
  const [editableAiDescription, setEditableAiDescription] = useState("");
  const [editableLogementText, setEditableLogementText] = useState("");
  const [editableAccessText, setEditableAccessText] = useState("");
  const [editableEchangesText, setEditableEchangesText] = useState("");
  const [editableAutresInfosText, setEditableAutresInfosText] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadAudit() {
      const auditSelect = `
            id,
            listing_id,
            created_at,
            overall_score,
            booking_lift_low,
            booking_lift_high,
            revenue_impact_low,
            revenue_impact_high,
            result_payload
          `;
      const listingSelect = `
              id,
              title,
              source_platform,
              source_url,
              price,
              currency,
              city
            `;

      if (!auditId) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          if (isMounted) {
            setAudit(null);
            setIsPro(false);
          }
          return;
        }

        const workspace = await getOrCreateWorkspaceForUser({
          userId: user.id,
          email: user.email ?? null,
          client: supabase,
        });

        console.info("[audit-detail] loadAudit workspace resolved", {
          auditId,
          userId: user.id,
          workspaceId: workspace?.id ?? null,
        });

        if (!workspace) {
          if (isMounted) {
            setAudit(null);
            setIsPro(false);
          }
          return;
        }

        try {
          const plan = await getWorkspacePlan(workspace.id, supabase);
          if (isMounted) {
            setIsPro(plan.planCode === "pro");
          }
        } catch (planError) {
          console.warn("Failed to load workspace plan for audit detail", planError);
          if (isMounted) {
            setIsPro(false);
          }
        }

        console.info("[AUDIT LOAD QUERY]", {
          auditTable: "audits",
          auditSelect,
          auditFilters: {
            id: auditId,
            workspace_id: workspace.id,
          },
          listingTable: "listings",
          listingSelect,
        });

        const scopedResponse = await supabase
          .from("audits")
          .select(auditSelect)
          .eq("id", auditId)
          .eq("workspace_id", workspace.id)
          .maybeSingle();

        console.info("[audit-detail] scoped audit response", {
          auditId,
          workspaceId: workspace.id,
          error: scopedResponse.error,
          hasData: Boolean(scopedResponse.data),
          resultPayloadType: scopedResponse.data?.result_payload
            ? typeof scopedResponse.data.result_payload
            : null,
        });

        let data = scopedResponse.data as AuditRecord | null;
        let error = scopedResponse.error;

        if (!data && !error) {
          const fallbackResponse = await supabase
            .from("audits")
            .select(auditSelect)
            .eq("id", auditId)
            .maybeSingle();

          console.info("[audit-detail] fallback audit response", {
            auditId,
            error: fallbackResponse.error,
            hasData: Boolean(fallbackResponse.data),
            resultPayloadType: fallbackResponse.data?.result_payload
              ? typeof fallbackResponse.data.result_payload
              : null,
          });

          data = fallbackResponse.data as AuditRecord | null;
          error = fallbackResponse.error;
        }

        if (error) {
          console.error("Failed to load audit:", {
            error,
            message: error?.message,
            details: error?.details,
            hint: error?.hint,
            code: error?.code,
          });
        }

        let listingData: ListingJoin = null;

        if (data?.listing_id) {
          console.info("[AUDIT LISTING QUERY]", {
            listingTable: "listings",
            listingSelect,
            listingFilters: {
              id: data.listing_id,
              workspace_id: workspace.id,
            },
          });

          const listingResponse = await supabase
            .from("listings")
            .select(listingSelect)
            .eq("id", data.listing_id)
            .eq("workspace_id", workspace.id)
            .maybeSingle();

          if (listingResponse.error) {
            console.error("Failed to load audit listing:", {
              error: listingResponse.error,
              message: listingResponse.error?.message,
              details: listingResponse.error?.details,
              hint: listingResponse.error?.hint,
              code: listingResponse.error?.code,
            });
          } else {
            listingData = (listingResponse.data as ListingJoin) ?? null;
          }
        }

        const normalizedAudit = normalizeAuditRecord(
          data
            ? ({
                ...data,
                listings: listingData,
              } as AuditRecord)
            : null
        );

        console.info("[audit-detail] normalized audit payload", {
          auditId,
          hasAudit: Boolean(normalizedAudit),
          hasResultPayload: Boolean(normalizedAudit?.result_payload),
          listingId: normalizedAudit?.listing_id ?? null,
        });

        if (normalizedAudit?.result_payload) {
          const payload = normalizedAudit.result_payload;

          console.info("[audit-detail] payload diagnostics", {
            auditId: normalizedAudit.id,
            payloadKeys: Object.keys(payload),
            marketPosition: payload.marketPosition ?? null,
            estimatedBookingLift: payload.estimatedBookingLift ?? null,
            estimatedRevenueImpact: payload.estimatedRevenueImpact ?? null,
            impactSummary: payload.impactSummary ?? null,
            listingQualityIndex: payload.listingQualityIndex ?? null,
            competitorSummary: payload.competitorSummary ?? null,
            improvementsCount: Array.isArray(payload.improvements)
              ? payload.improvements.length
              : 0,
            improvementsPreview: Array.isArray(payload.improvements)
              ? payload.improvements.slice(0, 3)
              : [],
            strengthsCount: Array.isArray(payload.strengths) ? payload.strengths.length : 0,
            strengths: payload.strengths ?? [],
            weaknessesCount: Array.isArray(payload.weaknesses)
              ? payload.weaknesses.length
              : 0,
            weaknesses: payload.weaknesses ?? [],
            missingAmenitiesCount: Array.isArray(payload.missingAmenities)
              ? payload.missingAmenities.length
              : 0,
            missingAmenities: payload.missingAmenities ?? [],
            suggestedOpening: payload.suggestedOpening ?? null,
          });
        } else {
          console.info("[audit-detail] payload diagnostics", {
            auditId,
            payloadKeys: [],
            marketPosition: null,
            estimatedBookingLift: null,
            estimatedRevenueImpact: null,
            impactSummary: null,
            listingQualityIndex: null,
            competitorSummary: null,
            improvementsCount: 0,
            improvementsPreview: [],
            strengthsCount: 0,
            strengths: [],
            weaknessesCount: 0,
            weaknesses: [],
            missingAmenitiesCount: 0,
            missingAmenities: [],
            suggestedOpening: null,
          });
        }

        if (isMounted) {
          setAudit(normalizedAudit);
        }
      } catch (error) {
        console.error("[audit-detail] Unexpected loadAudit failure", {
          error,
          message: error instanceof Error ? error.message : undefined,
          details:
            typeof error === "object" && error !== null && "details" in error
              ? (error as { details?: unknown }).details
              : undefined,
          hint:
            typeof error === "object" && error !== null && "hint" in error
              ? (error as { hint?: unknown }).hint
              : undefined,
          code:
            typeof error === "object" && error !== null && "code" in error
              ? (error as { code?: unknown }).code
              : undefined,
        });
        if (isMounted) {
          setAudit(null);
          setIsPro(false);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadAudit();

    return () => {
      isMounted = false;
    };
  }, [auditId]);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowToast(false), 3200);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!actionToast) return;
    const timer = window.setTimeout(() => setActionToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [actionToast]);

  useEffect(() => {
    if (!copyToastKey) return;
    const timer = window.setTimeout(() => setCopyToastKey(null), 1800);
    return () => window.clearTimeout(timer);
  }, [copyToastKey]);

  const listing = useMemo(() => normalizeListingJoin(audit?.listings ?? null), [audit]);

  const payload: AuditResult = audit?.result_payload ?? {};
  const structuredRecommendations =
    payload.recommendations && !Array.isArray(payload.recommendations)
      ? payload.recommendations
      : null;
  const legacyRecommendationList = Array.isArray(payload.recommendations)
    ? payload.recommendations
    : [];
  const subScores = Array.isArray(payload.subScores) ? payload.subScores : [];
  const legacyMarketComparison = payload.marketComparison ?? null;
  const legacyEstimatedBookingLift = payload.estimatedBookingLift ?? null;
  const legacyEstimatedRevenueImpact = payload.estimatedRevenueImpact ?? null;

  const cleanStringArray = (value: unknown): string[] =>
    Array.isArray(value)
      ? value
          .map((item) => (typeof item === "string" ? item.trim() : ""))
          .filter(Boolean)
      : [];

  const pickStringArray = (...sources: unknown[]) => {
    for (const source of sources) {
      const items = cleanStringArray(source);
      if (items.length > 0) {
        return items;
      }
    }
    return [];
  };

  const collectStringArray = (...sources: unknown[]) =>
    sources.flatMap((source) => cleanStringArray(source));

  const readExplicitScoreFromTextSources = (...sources: unknown[]) => {
    for (const source of sources) {
      const items = cleanStringArray(source);
      for (const item of items) {
        const match = item.match(/(\d+(?:[.,]\d+)?)\s*\/\s*10\b/);
        if (!match) continue;
        const score = coerceFiniteNumber(match[1]);
        if (score !== null) {
          return score;
        }
      }
    }
    return null;
  };

  const readLegacySubScore = (...needles: string[]) =>
    coerceFiniteNumber(
      subScores.find((item) => {
        const key = item.key?.toLowerCase() ?? "";
        const label = item.label?.toLowerCase() ?? "";
        return needles.some((needle) => key.includes(needle) || label.includes(needle));
      })?.score
    );

  const deriveLegacyMarketPosition = () => {
    const legacyLabel = String(payload.marketPosition?.label ?? "");
    if (legacyLabel === "top_performer" || legacyLabel === "above_market") return "above";
    if (legacyLabel === "competitive") return "average";
    if (legacyLabel === "below_market" || legacyLabel === "underperforming") return "below";

    const status = payload.marketPositioning?.status?.toLowerCase() ?? "";
    if (status.includes("above") || status === "ok") return "above";
    if (status.includes("partial") || status.includes("average")) return "average";
    if (status.includes("below") || status.includes("under")) return "below";

    const comparisonPosition = legacyMarketComparison?.position?.toLowerCase() ?? "";
    if (comparisonPosition.includes("above")) return "above";
    if (comparisonPosition.includes("average") || comparisonPosition.includes("partial")) {
      return "average";
    }
    if (comparisonPosition.includes("below") || comparisonPosition.includes("under")) {
      return "below";
    }

    return null;
  };

  const mapRecommendationTextToImprovement = (
    text: string,
    impact: "high" | "medium" | "low",
    orderIndex: number
  ) => ({
    id: `${impact}-${orderIndex}`,
    title:
      impact === "high"
        ? `Action critique ${orderIndex}`
        : impact === "medium"
        ? `Action prioritaire ${orderIndex}`
        : `Amélioration ${orderIndex}`,
    description: text,
    impact,
    orderIndex,
  });

  const overallScore =
    coerceFiniteNumber(payload.score) ??
    coerceFiniteNumber(payload.overallScore) ??
    coerceFiniteNumber(audit?.overall_score) ??
    0;
  const photoOrderTextSignals = collectStringArray(
    payload.content?.photoOrder,
    Array.isArray(payload.photoOrder) ? payload.photoOrder : null,
    structuredRecommendations?.improvements,
    payload.insights
  ).filter((item) =>
    /ordre|order|sequen|séquen|premi[eè]re photo|galerie|gallery|couverture visuelle|couverture/i.test(
      item
    )
  );
  const photoQuality =
    coerceFiniteNumber(payload.scoreBreakdown?.photos) ??
    coerceFiniteNumber(payload.metrics?.photoQuality) ??
    readLegacySubScore("photo", "photos", "visual") ??
    coerceFiniteNumber(payload.photoQuality);
  const photoOrder =
    coerceFiniteNumber(payload.scoreBreakdown?.photoOrder) ??
    coerceFiniteNumber(payload.metrics?.photoOrder) ??
    readLegacySubScore("photo_order", "ordre", "order", "gallery", "galerie") ??
    (typeof payload.photoOrder === "number" ? coerceFiniteNumber(payload.photoOrder) : null) ??
    readExplicitScoreFromTextSources(photoOrderTextSignals);
  const descriptionQuality =
    coerceFiniteNumber(payload.scoreBreakdown?.description) ??
    coerceFiniteNumber(payload.metrics?.descriptionQuality) ??
    readLegacySubScore("description", "desc", "text") ??
    coerceFiniteNumber(payload.descriptionQuality);
  const amenitiesCompleteness =
    coerceFiniteNumber(payload.scoreBreakdown?.amenities) ??
    coerceFiniteNumber(payload.metrics?.amenitiesCompleteness) ??
    readLegacySubScore("amenit", "equip") ??
    coerceFiniteNumber(payload.amenitiesCompleteness);
  const seoStrength =
    coerceFiniteNumber(payload.scoreBreakdown?.seo) ??
    coerceFiniteNumber(payload.scoreBreakdown?.visibility) ??
    coerceFiniteNumber(payload.metrics?.seoStrength) ??
    readLegacySubScore("seo", "visib", "visibility") ??
    coerceFiniteNumber(payload.seoStrength);
  const conversionStrength =
    coerceFiniteNumber(payload.scoreBreakdown?.conversion) ??
    coerceFiniteNumber(payload.metrics?.conversionStrength) ??
    coerceFiniteNumber(payload.conversionStrength) ??
    readLegacySubScore("conversion");

  const avgPrice = coerceFiniteNumber(payload.metrics?.avgPrice);

  const marketPosition =
    payload.market?.position ??
    deriveLegacyMarketPosition();
  const comparableCount =
    coerceFiniteNumber(payload.market?.comparableCount) ??
    coerceFiniteNumber(payload.marketPositioning?.comparableCount) ??
    (Array.isArray(payload.marketPositioning?.comparables)
      ? payload.marketPositioning.comparables.length
      : null) ??
    coerceFiniteNumber(payload.competitorSummary?.competitorCount);
  const marketScore =
    coerceFiniteNumber(payload.market?.score) ??
    coerceFiniteNumber(legacyMarketComparison?.averageScore) ??
    coerceFiniteNumber(payload.marketPositioning?.averageScore) ??
    coerceFiniteNumber(payload.marketPosition?.avgCompetitorScore);
  const avgCompetitorPrice =
    coerceFiniteNumber(payload.market?.avgCompetitorPrice) ??
    coerceFiniteNumber(legacyMarketComparison?.avgCompetitorPrice) ??
    coerceFiniteNumber(payload.marketPositioning?.avgPrice) ??
    coerceFiniteNumber(payload.marketPosition?.avgCompetitorPrice);
  const priceDelta =
    coerceFiniteNumber(payload.market?.priceDelta) ??
    coerceFiniteNumber(legacyMarketComparison?.priceDelta) ??
    coerceFiniteNumber(payload.marketPosition?.priceDeltaPercent) ??
    coerceFiniteNumber(payload.marketPositioning?.priceDeltaPercent);
  const bookingPotential =
    coerceFiniteNumber(payload.business?.bookingPotential) ??
    coerceFiniteNumber(payload.bookingPotential) ??
    coerceFiniteNumber(legacyEstimatedBookingLift?.high) ??
    coerceFiniteNumber(legacyEstimatedBookingLift?.low);
  const estimatedRevenueLow =
    coerceFiniteNumber(payload.business?.estimatedRevenueLow) ??
    coerceFiniteNumber(payload.estimatedRevenue?.low) ??
    coerceFiniteNumber(legacyEstimatedRevenueImpact?.lowMonthly) ??
    coerceFiniteNumber(audit?.revenue_impact_low);
  const estimatedRevenueHigh =
    coerceFiniteNumber(payload.business?.estimatedRevenueHigh) ??
    coerceFiniteNumber(payload.estimatedRevenue?.high) ??
    coerceFiniteNumber(legacyEstimatedRevenueImpact?.highMonthly) ??
    coerceFiniteNumber(audit?.revenue_impact_high);

  const summary =
    normalizeSentence(payload.content?.summary) ||
    normalizeSentence(payload.summary) ||
    "";
  const insights = pickStringArray(
    payload.content?.insights,
    payload.insights
  );
  const strengths = pickStringArray(
    payload.content?.strengths,
    payload.strengths
  );
  const weaknesses = pickStringArray(
    payload.content?.weaknesses,
    payload.weaknesses
  );
  const insightSignals = pickStringArray(
    payload.content?.insights,
    payload.insights
  );
  const critical = pickStringArray(
    structuredRecommendations?.critical,
    payload.critical
  );
  const highImpact = pickStringArray(
    structuredRecommendations?.highImpact,
    payload.highImpact
  );
  const legacyImprovementObjects = Array.isArray(payload.improvements)
    ? payload.improvements.map((item, index) => ({
        ...item,
        impact:
          item.impact === "high" || item.impact === "medium" || item.impact === "low"
            ? item.impact
            : "medium",
        orderIndex: item.orderIndex ?? index + 1,
      }))
    : [];
  const improvementStrings = pickStringArray(
    structuredRecommendations?.improvements,
    legacyRecommendationList
  );
  const improvements =
    legacyImprovementObjects.length > 0
      ? legacyImprovementObjects
      : [
          ...critical.map((item, index) =>
            mapRecommendationTextToImprovement(item, "high", index + 1)
          ),
          ...highImpact.map((item, index) =>
            mapRecommendationTextToImprovement(item, "medium", critical.length + index + 1)
          ),
          ...improvementStrings.map((item, index) =>
            mapRecommendationTextToImprovement(
              item,
              "low",
              critical.length + highImpact.length + index + 1
            )
          ),
        ];
  const suggestedOpening =
    payload.content?.openingParagraph ??
    payload.suggestedOpening ??
    summary;
  const photoOrderSuggestions = pickStringArray(
    payload.content?.photoOrder,
    payload.photoOrderSuggestions,
    Array.isArray(payload.photoOrder) ? payload.photoOrder : null
  );
  const missingAmenities = pickStringArray(
    payload.content?.missingAmenities,
    payload.missingAmenities
  );

  const deriveStrengthsAndWeaknessesFromInsights = (items: string[]) => {
    if (items.length === 0) {
      return { strengths: [] as string[], weaknesses: [] as string[] };
    }

    const negativePatterns = [
      /\bpas\b/i,
      /\bmanque/i,
      /\bmanquant/i,
      /\babsent/i,
      /\brisque/i,
      /\bfragil/i,
      /\bfaible/i,
      /\bpeu/i,
      /\bà revoir/i,
      /\bà corriger/i,
      /\bprobl[eè]me/i,
      /\bdifficile/i,
      /\bincomplet/i,
    ];
    const positivePatterns = [
      /\bfort(e)?\b/i,
      /\bpoint fort/i,
      /\bbonne?\b/i,
      /\bclair(e)?\b/i,
      /\bfluide\b/i,
      /\bconvaincant/i,
      /\brassurant/i,
      /\bvaloris[ée]/i,
      /\bmet en avant/i,
    ];

    const derivedStrengths: string[] = [];
    const derivedWeaknesses: string[] = [];

    for (const raw of items) {
      const value = raw.trim();
      if (!value) continue;

      const isNegative = negativePatterns.some((pattern) => pattern.test(value));
      const isPositive = positivePatterns.some((pattern) => pattern.test(value));

      if (isNegative && !derivedWeaknesses.includes(value)) {
        derivedWeaknesses.push(value);
        continue;
      }
      if (isPositive && !derivedStrengths.includes(value)) {
        derivedStrengths.push(value);
        continue;
      }
    }

    // Si on n'a pas réussi à séparer, on fractionne simplement la liste
    if (derivedStrengths.length === 0 && derivedWeaknesses.length === 0) {
      const mid = Math.ceil(items.length / 2);
      return {
        strengths: items.slice(0, mid),
        weaknesses: items.slice(mid),
      };
    }

    return { strengths: derivedStrengths, weaknesses: derivedWeaknesses };
  };

  let resolvedStrengths = strengths;
  let resolvedWeaknesses = weaknesses;

  if (resolvedStrengths.length === 0 && resolvedWeaknesses.length === 0 && insightSignals.length > 0) {
    const split = deriveStrengthsAndWeaknessesFromInsights(insightSignals);
    resolvedStrengths = split.strengths;
    resolvedWeaknesses = split.weaknesses;
  }

  // Évite que les deux listes soient strictement identiques
  if (
    resolvedStrengths.length > 0 &&
    resolvedWeaknesses.length > 0 &&
    resolvedStrengths.length === resolvedWeaknesses.length &&
    resolvedStrengths.every((value, index) => value === resolvedWeaknesses[index])
  ) {
    resolvedWeaknesses = resolvedWeaknesses.slice(0, Math.max(1, Math.floor(resolvedWeaknesses.length / 2)));
  }

  console.log("[FINISH REMAINING CARDS]", {
    photoOrder,
    seoStrength,
    marketScore,
    avgCompetitorPrice,
    priceDelta,
    bookingPotential,
    estimatedRevenueLow,
    estimatedRevenueHigh,
  });

  console.log("[REMAINING MARKET RAW]", {
    market: payload.market,
    legacyMarketComparison,
    legacyMarketPositioning: payload.marketPositioning,
    overallScore,
  });

  console.log("[REMAINING BUSINESS RAW]", {
    business: payload.business,
    auditRevenueLow: audit?.revenue_impact_low,
    auditRevenueHigh: audit?.revenue_impact_high,
    legacyEstimatedRevenue: payload.estimatedRevenue,
    legacyEstimatedRevenueImpact,
    legacyEstimatedBookingLift,
  });

  console.log("[STRENGTHS VS WEAKNESSES]", {
    strengths: resolvedStrengths,
    weaknesses: resolvedWeaknesses,
    insights: insightSignals,
  });

  console.log("[ACTION SOURCES RAW]", {
    recommendations: payload.recommendations,
    legacyRecommendations: legacyRecommendationList,
    improvements: payload.improvements,
    actionPlan: improvements,
  });

  console.log("[ORDER PHOTO RAW]", {
    photoOrder,
    scoreBreakdown: payload.scoreBreakdown,
    subScores,
    photoOrderSuggestions,
    legacyPhotoOrder: payload.photoOrder,
  });

  console.log("[IQA RAW]", {
    quality: payload.scoreBreakdown,
    market: payload.market,
    business: payload.business,
    content: payload.content,
    listingQualityIndex: payload.listingQualityIndex,
  });

  const scorePercent = Math.max(0, Math.min(100, (overallScore / 10) * 100));
  const bookingLiftLow =
    coerceFiniteNumber(legacyEstimatedBookingLift?.low) ??
    coerceFiniteNumber(audit?.booking_lift_low) ??
    0;
  const bookingLiftHigh =
    coerceFiniteNumber(legacyEstimatedBookingLift?.high) ??
    coerceFiniteNumber(audit?.booking_lift_high) ??
    0;
  const revenueImpactLow =
    estimatedRevenueLow ?? coerceFiniteNumber(audit?.revenue_impact_low) ?? 0;
  const revenueImpactHigh =
    estimatedRevenueHigh ?? coerceFiniteNumber(audit?.revenue_impact_high) ?? 0;

  const scoreBarColor =
    overallScore < 4 ? "bg-red-500" : overallScore < 7 ? "bg-orange-500" : "bg-emerald-500";

  const potentialBarColor =
    bookingLiftHigh < 8
      ? "bg-red-500"
      : bookingLiftHigh < 16
      ? "bg-orange-500"
      : "bg-emerald-500";

  const scoreLevelLabel =
    overallScore < 4 ? "Low" : overallScore < 7 ? "Medium" : "High";

  const scoreLevelBadgeClass =
    overallScore < 4
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : overallScore < 7
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";

  const scoreBadgeClass = (score: number | null) => {
    if (score === null || !Number.isFinite(score)) {
      return "border-amber-200 bg-amber-50 text-amber-700";
    }
    if (score < 4) {
      return "border-rose-200 bg-rose-50 text-rose-700";
    }
    if (score < 7) {
      return "border-amber-200 bg-amber-50 text-amber-700";
    }
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  };

  const scoreValueClass = (score: number | null) => {
    if (score === null || !Number.isFinite(score)) {
      return "text-amber-700";
    }
    if (score < 4) {
      return "text-rose-700";
    }
    if (score < 7) {
      return "text-amber-700";
    }
    return "text-emerald-700";
  };

  const indexValueClass = (score: number | null) => {
    if (score === null || !Number.isFinite(score)) {
      return "text-amber-700";
    }
    if (score < 55) {
      return "text-rose-700";
    }
    if (score < 75) {
      return "text-amber-700";
    }
    return "text-emerald-700";
  };

  const competitorCountValueClass = (count: number | null) => {
    if (count === null || !Number.isFinite(count)) {
      return "text-amber-700";
    }
    if (count >= 5) {
      return "text-emerald-700";
    }
    return "text-amber-700";
  };

  const competitorSummary = {
    competitorCount:
      comparableCount ??
      coerceFiniteNumber(payload.competitorSummary?.competitorCount) ??
      0,
    averageOverallScore:
      marketScore ??
      coerceFiniteNumber(payload.competitorSummary?.averageOverallScore) ??
      0,
    targetVsMarketPosition: payload.competitorSummary?.targetVsMarketPosition ?? "",
    keyGaps: pickStringArray(payload.competitorSummary?.keyGaps),
    keyAdvantages: pickStringArray(payload.competitorSummary?.keyAdvantages),
  };

  const listingQualityIndex = payload.listingQualityIndex;
  const lqiScoreRaw = toRoundedMetric(listingQualityIndex?.score);
  const lqiListingQualityRaw = toRoundedMetric(
    listingQualityIndex?.components?.listingQuality
  );
  const lqiMarketCompetitivenessRaw = toRoundedMetric(
    listingQualityIndex?.components?.marketCompetitiveness
  );
  const lqiConversionPotentialRaw =
    toRoundedMetric(listingQualityIndex?.components?.conversionPotential) ??
    (bookingPotential !== null ? Math.round(bookingPotential * 10) : null);

  const lqiScore =
    lqiScoreRaw !== null
      ? lqiScoreRaw
      : overallScore > 0
      ? Math.round(Math.max(0, Math.min(10, overallScore)) * 10)
      : null;

  const deriveIndexFromScores = (scores: Array<number | null>): number | null => {
    const finiteScores = scores.filter(
      (score): score is number => score !== null && Number.isFinite(score)
    );
    if (finiteScores.length === 0) return null;
    const average =
      finiteScores.reduce((sum, value) => sum + value, 0) / finiteScores.length;
    return Math.round(Math.max(0, Math.min(10, average)) * 10);
  };

  const lqiListingQuality =
    lqiListingQualityRaw !== null
      ? lqiListingQualityRaw
      : deriveIndexFromScores([
          photoQuality,
          descriptionQuality,
          amenitiesCompleteness,
          seoStrength,
        ]);

  const lqiMarketCompetitiveness =
    lqiMarketCompetitivenessRaw !== null
      ? lqiMarketCompetitivenessRaw
      : deriveIndexFromScores([
          marketScore,
          overallScore,
        ]);

  const lqiConversionPotential = lqiConversionPotentialRaw;
  const currentListingPrice = coerceFiniteNumber(listing?.price) ?? avgPrice;
  const displayCurrency = listing?.currency || payload.metrics?.currency || "EUR";
  const revenueFormatter = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: displayCurrency,
    maximumFractionDigits: 0,
  });
  const locationLabel = listing?.city ?? undefined;

  const marketFallback = buildMarketPositionSummary({
    overallScore,
    photoQuality: photoQuality ?? 0,
    photoOrder: photoOrder ?? 0,
    descriptionQuality: descriptionQuality ?? 0,
    amenitiesCompleteness: amenitiesCompleteness ?? 0,
    seoStrength: seoStrength ?? 0,
    conversionStrength: conversionStrength ?? 0,
    strengths,
    weaknesses,
    improvements: improvements.map((imp) => ({
      title: imp.title ?? "Amélioration",
      description: imp.description ?? "",
      impact:
        imp.impact === "high" || imp.impact === "medium" || imp.impact === "low"
          ? imp.impact
          : "medium",
    })),
    suggestedOpening,
    photoOrderSuggestions,
    missingAmenities,
    competitorSummary,
  });
  const legacyMarketPosition = payload.marketPosition;
  const market = {
    label:
      marketPosition === "above"
        ? "top_performer"
        : marketPosition === "below"
        ? "below_market"
        : marketPosition === "average"
        ? "competitive"
        : legacyMarketPosition?.label ?? marketFallback.label,
    message:
      legacyMarketPosition?.summary?.trim() ||
      competitorSummary.targetVsMarketPosition ||
      marketFallback.message,
    competitorCount: competitorSummary.competitorCount ?? marketFallback.competitorCount,
    averageOverallScore:
      marketScore ??
      (competitorSummary.averageOverallScore > 0 ? competitorSummary.averageOverallScore : null),
    avgCompetitorPrice: avgCompetitorPrice,
    avgCompetitorRating: coerceFiniteNumber(legacyMarketPosition?.avgCompetitorRating),
    priceDeltaPercent: priceDelta,
    deltaVsAverage:
      overallScore > 0 && marketScore !== null
        ? Number((overallScore - marketScore).toFixed(1))
        : null,
  };
  const bookingLiftLabel =
    legacyEstimatedBookingLift?.label?.trim() ||
    (bookingPotential !== null ? `${bookingPotential.toFixed(1)}/10` : null);
  const bookingLiftSummary = legacyEstimatedBookingLift?.summary?.trim() || null;
  const revenueImpactSummary = legacyEstimatedRevenueImpact?.summary?.trim() || null;
  const impactSummary = payload.impactSummary?.trim() || summary || null;
  const marketScoreDelta =
    typeof market.deltaVsAverage === "number" && Number.isFinite(market.deltaVsAverage)
      ? market.deltaVsAverage
      : null;
  const marketAverageScore =
    typeof market.averageOverallScore === "number" && market.averageOverallScore > 0
      ? market.averageOverallScore
      : null;
  const marketAvgCompetitorPrice = market.avgCompetitorPrice;
  const marketCompetitorCount = market.competitorCount > 0 ? market.competitorCount : null;
  const priceDeltaPercent = market.priceDeltaPercent;
  const marketSummaryText =
    market.message?.trim() ||
    "La lecture marché sera enrichie dès que davantage de signaux locaux seront disponibles.";
  const benchmarkSupportText =
    marketScoreDelta !== null
      ? marketScoreDelta > 0
        ? `Votre annonce se situe actuellement ${marketScoreDelta.toFixed(1)} point${Math.abs(
            marketScoreDelta
          ) >= 2 ? "s" : ""} au-dessus du score moyen observé.`
        : marketScoreDelta < 0
        ? `Votre annonce se situe actuellement ${Math.abs(marketScoreDelta).toFixed(
            1
          )} point${Math.abs(marketScoreDelta) >= 2 ? "s" : ""} en dessous du score moyen observé.`
        : "Votre annonce se situe au niveau moyen des annonces comparables observées."
      : marketCompetitorCount !== null
      ? `Lecture établie à partir de ${marketCompetitorCount} annonce${
          marketCompetitorCount > 1 ? "s comparables" : " comparable"
        } dans votre zone.`
      : "Lecture locale disponible dès qu’un volume suffisant d’annonces comparables sera observé.";
  const marketPricePositionText =
    priceDeltaPercent !== null
      ? priceDeltaPercent > 0
        ? `Votre tarif se situe au-dessus du niveau moyen observé sur ce marché.`
        : priceDeltaPercent < 0
        ? `Votre tarif se situe en dessous du niveau moyen observé sur ce marché.`
        : "Votre tarif est aligné avec le niveau moyen observé sur ce marché."
      : "Le positionnement tarifaire sera précisé dès qu’un prix moyen concurrent fiable sera disponible.";
  const marketRatingContext =
    market.avgCompetitorRating !== null
      ? `Note moyenne des concurrents observés : ${market.avgCompetitorRating.toFixed(1)}/5.`
      : "La note moyenne des concurrents n’est pas encore exploitable.";
  const lqiAvailableComponents = [
    lqiScore,
    lqiListingQuality,
    lqiMarketCompetitiveness,
    lqiConversionPotential,
  ].filter((value) => value !== null).length;
  const lqiSummaryText =
    listingQualityIndex?.summary?.trim() ||
    (lqiAvailableComponents > 0
      ? "Cet indice synthétise la qualité perçue de l’annonce, sa compétitivité locale et son potentiel de conversion."
      : "Cet indicateur s’affichera dès que les signaux de qualité et de marché seront suffisamment complets.");
  const estimatedImpactHeadline =
    impactSummary ||
    bookingLiftSummary ||
    revenueImpactSummary ||
    "Les estimations seront affinées dès que le rapport disposera de signaux suffisamment fiables.";
  const estimatedImpactDetail =
    revenueImpactSummary ||
    bookingLiftSummary ||
    (bookingLiftHigh > 0
      ? `Le scénario central retient un potentiel de +${bookingLiftLow.toFixed(
          0
        )}% à +${bookingLiftHigh.toFixed(0)}% de réservations après optimisation.`
      : "Aucune projection exploitable n’est disponible à ce stade.");
  const revenuePricingLead =
    revenueImpactSummary ||
    (marketAvgCompetitorPrice !== null && priceDeltaPercent !== null
      ? `Le prix moyen des annonces comparables est de ${revenueFormatter.format(
          marketAvgCompetitorPrice
        )} et votre position tarifaire se situe à ${priceDeltaPercent > 0 ? "+" : ""}${priceDeltaPercent.toFixed(
          0
        )}% vs marché.`
      : marketAvgCompetitorPrice !== null
      ? `Le prix moyen des annonces comparables est de ${revenueFormatter.format(
          marketAvgCompetitorPrice
        )}.`
      : priceDeltaPercent !== null
      ? `Votre position tarifaire se situe à ${priceDeltaPercent > 0 ? "+" : ""}${priceDeltaPercent.toFixed(
          0
        )}% vs marché.`
      : marketAverageScore !== null
      ? `Le score moyen des annonces comparables est de ${marketAverageScore.toFixed(1)}/10.`
      : null) ||
    impactSummary ||
    (revenueImpactHigh > 0
      ? `Le revenu additionnel estimé peut atteindre ${revenueFormatter.format(
          revenueImpactHigh
        )} par mois selon les hypothèses du rapport.`
      : "Les recommandations tarifaires s’afficheront dès qu’une lecture revenu fiable sera disponible.");
  const currentPriceContext =
    currentListingPrice !== null
      ? marketAvgCompetitorPrice !== null
        ? `À comparer au prix moyen du marché estimé à ${revenueFormatter.format(
            marketAvgCompetitorPrice
          )}.`
        : "Tarif actuel détecté sur l’annonce."
      : "Le tarif actuel n’est pas remonté pour cette annonce.";
  const marketScoreContext =
    marketAverageScore !== null
      ? marketScoreDelta !== null
        ? marketScoreDelta > 0
          ? `Votre score dépasse actuellement le marché de ${marketScoreDelta.toFixed(1)} point.`
          : marketScoreDelta < 0
          ? `Votre score reste inférieur au marché de ${Math.abs(marketScoreDelta).toFixed(
              1
            )} point.`
          : "Votre score est parfaitement aligné avec le niveau moyen du marché."
        : "Lecture calculée à partir des annonces comparables observées."
      : marketScoreDelta !== null
      ? marketScoreDelta > 0
        ? `Le score moyen du marché ressort environ ${marketScoreDelta.toFixed(
            1
          )} point sous votre annonce.`
        : marketScoreDelta < 0
        ? `Le score moyen du marché ressort environ ${Math.abs(marketScoreDelta).toFixed(
            1
          )} point au-dessus de votre annonce.`
        : "Le marché ressort globalement au même niveau que votre annonce."
      : "Le score moyen du marché n’est pas encore disponible.";
  const marketPositionNarrative =
    competitorSummary.targetVsMarketPosition?.trim() || marketSummaryText;
  const scoreLiftDisplay =
    bookingLiftHigh > 0
      ? `+${bookingLiftLow.toFixed(0)}% à +${bookingLiftHigh.toFixed(0)}%`
      : bookingLiftLabel || "Impact à préciser";
  const revenueImpactDisplay =
    revenueImpactHigh > 0
      ? revenueFormatter.format(revenueImpactHigh)
      : revenueImpactSummary
      ? "Estimation disponible"
      : "À estimer";
  const scoreMarketValueDisplay =
    marketAverageScore !== null
      ? `${marketAverageScore.toFixed(1)}/10`
      : marketScoreDelta !== null
      ? `${marketScoreDelta > 0 ? "-" : "+"}${Math.abs(marketScoreDelta).toFixed(1)} pt`
      : "À confirmer";
  const competitorCountDisplay =
    marketCompetitorCount !== null
      ? String(marketCompetitorCount)
      : marketPositionNarrative
      ? "Lecture ciblée"
      : "Base limitée";
  const competitorCountSupport =
    marketCompetitorCount !== null
      ? "Base utilisée pour situer votre annonce par rapport à son marché."
      : marketPositionNarrative
      ? "Le positionnement reste exploitable, même si le volume exact de comparables n’est pas consolidé."
      : "La lecture marché reste partielle tant que le volume de comparables n’est pas consolidé.";
  const lqiLabelDisplay = listingQualityIndex?.label
    ? lqiLabelText(listingQualityIndex.label)
    : lqiAvailableComponents > 0
    ? "Indice partiel"
    : "À consolider";
  const lqiScoreDisplay =
    lqiScore !== null
      ? `${lqiScore} / 100`
      : lqiAvailableComponents > 0
      ? `${lqiAvailableComponents}/4 signaux`
      : "À consolider";
 const avgCompetitorPriceDisplay =
  marketAvgCompetitorPrice !== null
    ? revenueFormatter.format(marketAvgCompetitorPrice)
    : currentListingPrice !== null
      ? "Repère partiel"
      : "À confirmer";

const avgCompetitorPriceSupport =
  marketAvgCompetitorPrice !== null
    ? "Point de repère prix pour situer votre annonce."
    : currentListingPrice !== null
      ? `Le prix de l’annonce est connu (${revenueFormatter.format(
          currentListingPrice
        )}), mais le repère marché reste incomplet.`
      : "Le repère prix sera plus utile dès qu’un prix moyen concurrent fiable pourra être consolidé.";const priceDeltaDisplay =
    priceDeltaPercent !== null
      ? `${priceDeltaPercent > 0 ? "+" : ""}${priceDeltaPercent.toFixed(0)}%`
      : marketAvgCompetitorPrice !== null && currentListingPrice !== null
      ? "Écart calculé"
      : "Lecture partielle";
  const estimatedImpactValueDisplay =
    bookingLiftHigh > 0
      ? `+${bookingLiftLow.toFixed(0)}% à +${bookingLiftHigh.toFixed(0)}% de réservations`
      : bookingPotential !== null
      ? `${bookingPotential.toFixed(1)}/10`
      : bookingLiftSummary || impactSummary
      ? bookingLiftLabel || "Estimation disponible"
      : "Projection à consolider";
  const currentPriceDisplay =
    currentListingPrice !== null ? revenueFormatter.format(currentListingPrice) : "À confirmer";
  const marketScoreDisplay =
    marketAverageScore !== null
      ? `${marketAverageScore.toFixed(1)}/10`
      : marketScoreDelta !== null
      ? `${marketScoreDelta > 0 ? "-" : "+"}${Math.abs(marketScoreDelta).toFixed(1)} pt`
      : "À confirmer";
  const bookingLiftRangeDisplay =
    bookingLiftHigh > 0
      ? `+${bookingLiftLow.toFixed(0)}% à +${bookingLiftHigh.toFixed(0)}%`
      : bookingPotential !== null
      ? `${bookingPotential.toFixed(1)}/10`
      : bookingLiftLabel || (bookingLiftSummary ? "Estimation disponible" : "Potentiel à confirmer");
  const revenueImpactRangeDisplay =
    revenueImpactHigh > 0
      ? revenueImpactLow > 0
        ? `${revenueFormatter.format(revenueImpactLow)} à ${revenueFormatter.format(revenueImpactHigh)}`
        : revenueFormatter.format(revenueImpactHigh)
      : revenueImpactSummary
      ? "Estimation disponible"
      : "Lecture disponible";

  const localizedMissingAmenities = localizeGeneratedList(missingAmenities);

  const aiDescriptionVariants = useMemo(
    () =>
      buildAirbnbDescriptionVariants({
        title: listing?.title ?? null,
        location: locationLabel ?? null,
        amenities: listing?.amenities ?? null,
        description: listing?.description ?? null,
        sourcePlatform: listing?.source_platform ?? null,
        missingAmenities: localizedMissingAmenities,
      }),
    [
      listing?.amenities,
      listing?.description,
      listing?.source_platform,
      listing?.title,
      locationLabel,
      localizedMissingAmenities,
    ]
  );

  const currentAiVariant =
    aiDescriptionVariants[generationSeed % aiDescriptionVariants.length] ?? {
      main: "",
      logement: "",
      acces: "",
      echanges: "",
      autresInfos: "",
    };
  const aiDescription = currentAiVariant.main;
  const currentAiVariantIndex =
    aiDescriptionVariants.length > 0
      ? (generationSeed % aiDescriptionVariants.length) + 1
      : 0;

  useEffect(() => {
    setEditableAiDescription(aiDescription);
    setEditableLogementText(currentAiVariant.logement);
    setEditableAccessText(currentAiVariant.acces);
    setEditableEchangesText(currentAiVariant.echanges);
    setEditableAutresInfosText(currentAiVariant.autresInfos);
  }, [aiDescription, currentAiVariant.acces, currentAiVariant.autresInfos, currentAiVariant.echanges, currentAiVariant.logement]);

  const aiKeywords = useMemo(() => {
    const listingTitle: string | undefined = listing?.title ?? undefined;

    return buildAiKeywords({
      title: listingTitle,
      location: locationLabel,
    });
  }, [listing, locationLabel]);

  const textSuggestions = buildTextSuggestions({
      title: listing?.title ?? undefined,
      city: locationLabel ?? null,
  });

  const photoSuggestions = buildPhotoSuggestions({
      title: listing?.title ?? undefined,
      description: suggestedOpening,
  });

  const localizedStrengths = localizeGeneratedList(resolvedStrengths);
  const localizedWeaknesses = localizeGeneratedList(resolvedWeaknesses);
  const localizedCompetitorGaps = localizeGeneratedList(competitorSummary.keyGaps);
  const localizedCompetitorAdvantages = localizeGeneratedList(
    competitorSummary.keyAdvantages
  );
  const localizedTargetVsMarketPosition =
    localizeGeneratedText(competitorSummary.targetVsMarketPosition) || "";
  const localizedSuggestedOpening =
    localizeGeneratedText(suggestedOpening) || textSuggestions.suggestedOpeningParagraph;
  const localizedPhotoOrderSuggestions = (() => {
    const localized = localizeGeneratedList(photoOrderSuggestions);
    if (localized.length > 0) {
      return localized;
    }
    return photoSuggestions.suggestedPhotoOrder;
  })();
  const localizedImprovements = improvements.map((item, index) => ({
    ...item,
    title: localizeGeneratedText(item.title) || `Amélioration ${index + 1}`,
    description:
      localizeGeneratedText(item.description) || "Détail non communiqué.",
  }));

  const groupedImprovements = {
    high: localizedImprovements.filter((item) => item.impact === "high"),
    medium: localizedImprovements.filter((item) => item.impact === "medium"),
    low: localizedImprovements.filter((item) => item.impact === "low"),
  };

  const priorityLossSignals = [
    ...localizedWeaknesses.slice(0, 3),
    ...localizedCompetitorGaps.slice(0, 2),
  ].filter(Boolean);

  const subScoreCards = [
    {
      label: "Photos",
      value: photoQuality,
      note: "Qualité visuelle",
      fallback: "Analyse photo en attente de signaux visuels plus complets.",
    },
    {
      label: "Ordre des photos",
      value: photoOrder,
      note: "Première impression",
      fallback: "L’ordre des photos sera qualifié dès qu’une lecture visuelle plus fine sera disponible.",
    },
    {
      label: "Description",
      value: descriptionQuality,
      note: "Clarté du message",
      fallback: "La qualité du message reste partiellement lisible, mais pas encore suffisamment notée.",
    },
    {
      label: "Équipements",
      value: amenitiesCompleteness,
      note: "Complétude perçue",
      fallback: "La lecture des équipements reste incomplète à ce stade.",
    },
    {
      label: "SEO",
      value: seoStrength,
      note: "Visibilité de l’annonce",
      fallback: "Le niveau de lisibilité commerciale n’est pas encore scoré de façon fiable.",
    },
    {
      label: "Conversion",
      value: conversionStrength,
      note: "Potentiel de réservation",
      fallback: "Le potentiel de conversion reste partiellement estimé pour cet audit.",
    },
  ];
  const pricingRecommendations = [
    revenueImpactSummary,
    marketAvgCompetitorPrice !== null
      ? `Le prix moyen des annonces comparables est de ${revenueFormatter.format(
          marketAvgCompetitorPrice
        )}.`
      : null,
    priceDeltaPercent !== null
      ? priceDeltaPercent > 0
        ? `Votre position tarifaire se situe actuellement à +${priceDeltaPercent.toFixed(
            0
          )}% vs marché. Cette position demande une promesse perçue plus forte pour rester compétitif.`
        : priceDeltaPercent < 0
        ? `Votre position tarifaire se situe actuellement à ${priceDeltaPercent.toFixed(
            0
          )}% vs marché. Vous pouvez conserver cet avantage prix ou renforcer la valeur perçue pour mieux le monétiser.`
        : "Votre position tarifaire est actuellement alignée avec le marché."
      : marketAvgCompetitorPrice !== null
      ? null
      : null,
    priceDeltaPercent !== null && marketAvgCompetitorPrice !== null
      ? priceDeltaPercent > 0
        ? `Votre tarif se situe actuellement au-dessus du prix moyen observé (${revenueFormatter.format(
            marketAvgCompetitorPrice
          )}).`
        : priceDeltaPercent < 0
        ? `Votre tarif se situe actuellement en dessous du prix moyen observé (${revenueFormatter.format(
            marketAvgCompetitorPrice
          )}).`
        : `Votre tarif est actuellement aligné avec le prix moyen observé (${revenueFormatter.format(
            marketAvgCompetitorPrice
          )}).`
      : null,
    marketAverageScore !== null
      ? `Le score moyen des annonces comparables est de ${marketAverageScore.toFixed(
          1
        )}/10. Votre lecture tarifaire doit rester cohérente avec ce niveau de qualité perçue.`
      : null,
    currentListingPrice !== null && marketAvgCompetitorPrice !== null
      ? `Tarif actuel de l’annonce : ${revenueFormatter.format(
          currentListingPrice
        )}, à comparer au niveau moyen du marché local.`
      : null,
  ].filter((value): value is string => Boolean(value && value.trim()));
  const pricingRecommendationsUnique = pricingRecommendations.filter(
    (item, index, array) => array.indexOf(item) === index
  );

  console.log("[AUDIT DETAIL FINAL MISSING CARDS]", {
    currentPrice: currentListingPrice,
    avgCompetitorPrice: marketAvgCompetitorPrice,
    priceDelta: priceDeltaPercent,
    estimatedRevenueLow,
    estimatedRevenueHigh,
    listingQualityIndex: payload.listingQualityIndex,
  });
  const heroImpactLabel =
    bookingLiftLabel ||
    (bookingLiftHigh > 0
      ? `Potentiel estimé de +${bookingLiftLow.toFixed(0)}% à +${bookingLiftHigh.toFixed(
          0
        )} de réservations`
      : "Lecture d’impact en cours de consolidation");
  const heroImpactSupport =
    impactSummary ||
    bookingLiftSummary ||
    revenueImpactSummary ||
    localizedTargetVsMarketPosition ||
    marketSummaryText;
  const heroRevenueSupport =
    revenueImpactSummary ||
    (revenueImpactHigh > 0
      ? `Jusqu’à ${revenueFormatter.format(revenueImpactHigh)} de revenu mensuel estimé`
      : marketSummaryText);
  const scoreOverviewTitle =
    impactSummary ||
    localizedTargetVsMarketPosition ||
    "Lecture détaillée de votre performance de conversion";
  const scoreOverviewText =
    bookingLiftSummary ||
    localizedTargetVsMarketPosition ||
    "Cette vue vous aide à prioriser les leviers qui pèsent le plus sur la performance de l’annonce.";
  const lqiComponentNotes = {
    listing:
      lqiListingQuality !== null
        ? lqiListingQuality >= 75
          ? "La qualité perçue de l’annonce soutient déjà une lecture compétitive."
          : "La qualité perçue de l’annonce reste perfectible sur ses éléments visibles."
        : "La qualité perçue sera précisée dès qu’un score consolidé sera disponible.",
    market:
      lqiMarketCompetitiveness !== null
        ? lqiMarketCompetitiveness >= 75
          ? "Le positionnement marché est déjà solide face aux annonces comparables."
          : "Le positionnement marché peut encore gagner en compétitivité."
        : "La compétitivité marché sera précisée dès que la comparaison sera consolidée.",
    conversion:
      lqiConversionPotential !== null
        ? lqiConversionPotential >= 75
          ? "Le potentiel de conversion reste élevé si les priorités sont correctement exécutées."
          : "Le potentiel de conversion existe, mais dépend d’optimisations ciblées."
        : "Le potentiel de conversion sera précisé dès qu’il pourra être calculé proprement.",
  };
  const actionPlanIntro =
    localizedImprovements.length > 0
      ? `Cette vue regroupe les améliorations identifiées par niveau de priorité pour faciliter l’exécution.`
      : "Les actions seront structurées ici dès qu’un plan d’amélioration complet sera disponible.";
  const prioritizedActionsIntro =
    localizedImprovements.length > 0
      ? `Cette liste reprend les recommandations réellement générées et les ordonne selon l’ordre d’exécution conseillé.`
      : "Aucune action prioritaire n’a encore été remontée dans cet audit.";
  const strengthsFallbackText =
    resolvedStrengths[0] ||
    insights[0] ||
    localizedTargetVsMarketPosition ||
    "Aucun point fort structuré n’a encore été remonté dans cet audit.";
  const weaknessesFallbackText =
    resolvedWeaknesses[0] ||
    insights[0] ||
    impactSummary ||
    "Aucun point faible structuré n’a encore été remonté dans cet audit.";

  const handleCopyToClipboard = async (
    value: string,
    successMessage: string,
    emptyMessage: string
  ) => {
    if (!value.trim()) {
      setActionToast(emptyMessage);
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setActionToast(successMessage);
    } catch (error) {
      console.warn("Failed to copy content", error);
      setActionToast("Impossible de copier le contenu pour le moment.");
    }
  };

  const handleCopyAiDescription = async () => {
    if (!editableAiDescription.trim()) {
      setActionToast("Aucune description à copier pour le moment.");
      return;
    }

    try {
      await navigator.clipboard.writeText(
        [
          editableAiDescription,
          editableLogementText,
          editableAccessText,
          editableEchangesText,
          editableAutresInfosText,
        ]
          .filter((value) => value.trim().length > 0)
          .join("\n\n")
      );
      setCopyToastKey("main");
    } catch (error) {
      console.warn("Failed to copy content", error);
      setActionToast("Impossible de copier le contenu pour le moment.");
    }
  };

  const handleCopySuggestedOpening = async () => {
    await handleCopyToClipboard(
      localizedSuggestedOpening,
      "Texte suggéré copié dans le presse-papiers.",
      "Aucun texte suggéré à copier pour le moment."
    );
  };

  const handleNextAiVariant = () => {
    setGenerationSeed((current) => current + 1);
    setActionToast("Nouvelle variante prête.");
  };

  const shadowStandard =
    "shadow-[0_20px_44px_rgba(15,23,42,0.065),0_7px_20px_rgba(15,23,42,0.045),0_1px_0_rgba(255,255,255,0.58)_inset]";
  const shadowMini =
    "shadow-[0_16px_36px_rgba(15,23,42,0.06),0_5px_14px_rgba(15,23,42,0.04),0_1px_0_rgba(255,255,255,0.6)_inset]";
  const shadowEmphasis =
    "shadow-[0_26px_60px_rgba(15,23,42,0.082),0_8px_24px_rgba(15,23,42,0.05),0_1px_0_rgba(255,255,255,0.64)_inset]";
  const shadowExecutive =
    "shadow-[0_32px_76px_rgba(15,23,42,0.098),0_10px_30px_rgba(15,23,42,0.06),0_1px_0_rgba(255,255,255,0.66)_inset]";
  const radiusContainer = "rounded-[28px]";
  const radiusCard = "rounded-[24px]";
  const radiusPill = "rounded-full";
  const borderStandard = "border border-slate-200/70";
  const borderSoft = "border border-slate-200/65";
  const cardGlow =
    "bg-clip-padding ring-1 ring-white/50 before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:bg-[linear-gradient(180deg,rgba(255,255,255,0.66),rgba(255,255,255,0.12)_30%,transparent_58%)] after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-[linear-gradient(90deg,transparent,rgba(148,163,184,0.24),transparent)]";
      const surfacePositive =
    "bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.10),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(220,252,231,0.18),transparent_28%),linear-gradient(180deg,#ffffff_0%,#f3fbf7_52%,#ecfdf3_100%)]";
  const surfaceWarning =
    "bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.10),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(254,243,199,0.18),transparent_28%),linear-gradient(180deg,#ffffff_0%,#fffaf2_52%,#fff7e8_100%)]";
  const surfaceCriticalSoft =
    "bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.08),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(255,228,230,0.18),transparent_26%),linear-gradient(180deg,#ffffff_0%,#fff7f8_50%,#fff1f3_100%)]";
  const surfaceNeutral =
    "bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.82),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(203,213,225,0.2),transparent_30%),linear-gradient(180deg,#ffffff_0%,#f5f8fc_50%,#eef3f8_100%)]";
  const surfaceCool =
    "bg-[radial-gradient(circle_at_top_left,rgba(191,219,254,0.1),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(203,213,225,0.18),transparent_28%),linear-gradient(180deg,#ffffff_0%,#f4f8fc_52%,#edf3fa_100%)]";
  const surfaceGreen =
    "bg-[radial-gradient(circle_at_top_left,rgba(148,163,184,0.08),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(220,252,231,0.12),transparent_28%),linear-gradient(180deg,#ffffff_0%,#f7fafd_54%,#f2f7f4_100%)]";
  const surfaceSlate =
    "bg-[radial-gradient(circle_at_top_left,rgba(191,219,254,0.08),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(226,232,240,0.2),transparent_30%),linear-gradient(180deg,#ffffff_0%,#f7fafd_54%,#f2f6fb_100%)]";
  const surfaceBusiness =
    "bg-[radial-gradient(circle_at_top_right,rgba(148,163,184,0.1),transparent_34%),radial-gradient(circle_at_top_left,rgba(255,255,255,0.84),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(203,213,225,0.18),transparent_26%),linear-gradient(180deg,#ffffff_0%,#f4f8fb_48%,#eaf1f7_100%)]";
  const surfaceEditorial =
    "bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.05),transparent_34%),radial-gradient(circle_at_top_left,rgba(255,255,255,0.84),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.07),transparent_24%),linear-gradient(180deg,#ffffff_0%,#f8f7f3_48%,#f1f5fa_100%)]";
  const surfaceDiagnostic =
    "bg-[radial-gradient(circle_at_top_left,rgba(191,219,254,0.09),transparent_36%),radial-gradient(circle_at_top_left,rgba(255,255,255,0.84),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(203,213,225,0.18),transparent_28%),linear-gradient(180deg,#ffffff_0%,#f4f8fc_48%,#eef4fa_100%)]";
  const surfaceCritical =
    "bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.045),transparent_32%),radial-gradient(circle_at_top_left,rgba(255,255,255,0.84),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(251,207,232,0.09),transparent_26%),linear-gradient(180deg,#ffffff_0%,#f8f6f8_48%,#f1f3f8_100%)]";
  const surfaceExecution =
    "bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.045),transparent_32%),radial-gradient(circle_at_top_left,rgba(255,255,255,0.84),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.07),transparent_26%),linear-gradient(180deg,#ffffff_0%,#f8f7f3_48%,#f0f4f9_100%)]";

  const metricSurfaceClass = (score: number | null): string => {
    if (score === null) return surfaceWarning;
    if (score >= 70) return surfacePositive;
    if (score >= 40) return surfaceWarning;
    return surfaceCriticalSoft;
  };

  const pageRootClass = "w-full space-y-6 text-[15px] text-slate-900";
  const sectionShell = "";
  const sectionBody = "space-y-6";
  const cardSoft = `relative overflow-hidden ${radiusCard} ${borderSoft} ${surfaceNeutral} ${cardGlow} ${shadowMini}`;
  const cardPadCompact = "p-4";
  const cardTitle =
    "text-[8px] font-semibold uppercase tracking-[0.16em] text-slate-700 [letter-spacing:0.02em]";
  const detailCard =
    `nk-card nk-card-hover relative flex h-full min-w-0 overflow-hidden flex-col ${radiusCard} ${borderStandard} ${surfaceNeutral} ${cardGlow} p-4 ${shadowMini}`;
  const detailInnerCard = `relative overflow-hidden ${radiusCard} border border-slate-200/65 ${surfaceNeutral} ${cardGlow} p-4 shadow-[0_12px_28px_rgba(15,23,42,0.045),0_1px_0_rgba(255,255,255,0.62)_inset]`;
  const detailCardLabel =
    "text-[8px] font-semibold uppercase tracking-[0.18em] text-slate-700 [letter-spacing:0.02em]";
  const detailCardTitle =
    "text-[12px] font-semibold tracking-[-0.01em] text-slate-950";
  const detailCardBody = "text-[11px] leading-5 text-slate-700";
  const detailCardList = "space-y-4 text-[11px] leading-5 text-slate-800";
  const pillBaseClass =
    "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium";
  const kpiCard =
    `relative overflow-hidden ${radiusCard} ${borderStandard} ${surfaceNeutral} ${cardGlow} ${shadowMini} p-4`;
  const kpiCardEmphasis =
    `relative overflow-hidden ${radiusCard} border border-slate-200/65 ${surfaceBusiness} ${cardGlow} ${shadowEmphasis} p-4`;
  const kpiCardMini =
    `relative overflow-hidden ${radiusCard} border border-slate-200/65 ${surfaceNeutral} ${cardGlow} ${shadowMini} p-3.5`;
  const kpiLabel =
    "text-[8px] font-semibold uppercase tracking-[0.16em] text-slate-700 [letter-spacing:0.02em]";
  const kpiValue =
    "mt-6 text-[17px] font-semibold tracking-tight text-slate-950 md:text-[19px]";
  const kpiValueMini =
    "mt-6 text-[15px] font-semibold tracking-tight text-slate-950 md:text-[16px]";
  const kpiBody = "mt-6 text-[11px] leading-5 text-slate-700";
  const sectionTitle =
    "mt-6 text-[16px] font-semibold tracking-[-0.02em] text-slate-950 md:text-[18px]";
  const sectionIntro = "mt-6 max-w-3xl text-[11px] leading-5 text-slate-700";
  const grid2 = "grid gap-5 md:grid-cols-2";
  const grid4 = "grid gap-5 md:grid-cols-2 xl:grid-cols-4";

  if (loading) {
    return (
      <div className="space-y-4 text-base text-neutral-300">
        <h1 className="text-2xl font-semibold text-white">Chargement de l’audit…</h1>
        <p className="max-w-2xl text-neutral-400">
          Merci de patienter pendant le chargement du rapport.
        </p>
      </div>
    );
  }

  if (!audit) {
    return (
      <div className="space-y-4 text-base text-neutral-300">
        <h1 className="text-2xl font-semibold text-white">Audit indisponible</h1>
        <p className="max-w-2xl text-neutral-400">
          Cet audit est introuvable. Lancez une nouvelle analyse depuis la page des annonces.
        </p>
      </div>
    );
  }

  return (
    <div className={pageRootClass}>
      {showToast && (
        <div className="fixed right-6 top-[88px] z-30">
          <div className={`relative overflow-hidden ${radiusCard} ${borderStandard} ${surfaceBusiness} ${cardGlow} px-4 py-3 text-[12px] text-emerald-900 ${shadowEmphasis}`}>
            <p className="font-semibold">Audit terminé avec succès</p>
            <p className="mt-6 text-[10px] text-emerald-800">
              Votre annonce a été analysée et peut maintenant être optimisée.
            </p>
          </div>
        </div>
      )}

      {actionToast && (
        <div className="sr-only" aria-live="polite">
          {actionToast}
        </div>
      )}

      <div className={`nk-card nk-card-hover nk-page-header-card relative overflow-hidden ${radiusContainer} ${borderStandard} ${surfaceBusiness} ${cardGlow} py-6 ${shadowExecutive} md:grid md:grid-cols-12 md:items-start md:gap-5 md:py-7 xl:gap-5`}>
        <div className="space-y-4 md:col-span-7 xl:col-span-8 xl:max-w-4xl">
          <p className="nk-kicker-muted text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-700">
            LECTURE BUSINESS
          </p>
          <h1 className="nk-heading-xl max-w-3xl text-[15px] font-semibold leading-tight tracking-[-0.035em] text-slate-950 md:text-[19px]">
            Où votre annonce perd des réservations et ce que vous pouvez gagner
          </h1>
          <p className="max-w-3xl text-[11px] leading-5 text-slate-700">
            {heroImpactSupport}
          </p>
          <div className="grid items-stretch gap-5 sm:grid-cols-3">
            <div className={`min-w-0 overflow-hidden ${kpiCard} h-full`}>
              <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-slate-700">
                Position sur le marché
              </p>
              <p
                className={`mt-6 break-words text-[13px] font-semibold tracking-tight md:text-[14px] ${marketLabelClass(
                  market.label
                )}`}
              >
                {marketLabelText(market.label)}
              </p>
              <p className="mt-6 text-[11px] leading-5 text-slate-700">
                {localizedTargetVsMarketPosition || benchmarkSupportText}
              </p>
            </div>
            <div className={`min-w-0 overflow-hidden ${kpiCardEmphasis} h-full`}>
              <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-slate-700">
                Impact business
              </p>
              <p className="mt-6 break-words text-[13px] font-semibold tracking-tight text-emerald-700 md:text-[14px]">
                {heroImpactLabel}
              </p>
              <p className="mt-6 text-[11px] leading-5 text-slate-700">
                {bookingLiftSummary || impactSummary || "Une première lecture d’impact est disponible à partir du rapport."}
              </p>
            </div>
            <div className={`min-w-0 overflow-hidden ${kpiCard} h-full`}>
              <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-slate-700">
                Repère revenu
              </p>
              <p className={`mt-6 text-[13px] font-semibold tracking-tight md:text-[14px] ${
                revenueImpactHigh > 0
                  ? "text-emerald-700"
                  : revenueImpactSummary
                  ? "text-amber-700"
                  : "text-amber-700"
              }`}>
                {revenueImpactHigh > 0 ? `${revenueFormatter.format(revenueImpactHigh)}/mois` : revenueImpactDisplay}
              </p>
              <p className="mt-6 text-[11px] leading-5 text-slate-700">{heroRevenueSupport}</p>
            </div>
          </div>
          <div className="mt-6 space-y-4">
            <div className="flex flex-wrap items-center gap-5 text-[8px]">
              <span
                className={`${pillBaseClass} shadow-[0_6px_14px_rgba(15,23,42,0.05)] ${scoreLevelBadgeClass}`}
              >
                Score {scoreLevelLabel === "Low" ? "faible" : scoreLevelLabel === "Medium" ? "moyen" : "élevé"}
              </span>
              <span className={`inline-flex items-baseline gap-5 ${radiusPill} border border-slate-800 bg-slate-950 px-3 py-1.5 text-[8px] font-semibold text-white ${shadowMini}`}>
                <span className="text-[8px] uppercase tracking-[0.08em] text-slate-300">
                  Impact potentiel
                </span>
                <span className="font-semibold">
                  {heroImpactLabel}
                </span>
                {revenueImpactHigh > 0 && (
                  <span className="hidden text-slate-300 sm:inline">
                    · {revenueFormatter.format(revenueImpactHigh)}/mois
                  </span>
                )}
              </span>
            </div>

            <div>
              <div className="flex flex-wrap gap-5">
                <Link
                  href="/dashboard/listings/new"
                  className={`nk-ghost-btn ${radiusPill} border border-slate-300/90 bg-white/95 px-3.5 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-900 ${shadowMini} transition hover:border-slate-400 hover:bg-slate-50`}
                >
                  Analyser une autre annonce
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex w-full flex-col items-stretch gap-5 md:col-span-5 md:mt-0 md:max-w-none md:pl-0 xl:col-span-4 xl:pl-1">
          <div className={`relative min-w-0 overflow-hidden ${radiusCard} ${borderStandard} ${surfaceBusiness} ${cardGlow} px-4 py-4 text-right ${shadowEmphasis}`}>
            <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-slate-700">
              Niveau de conversion
            </p>
            <p className={`mt-6 text-[15px] font-semibold tracking-tight md:text-[16px] ${scoreValueClass(
              overallScore
            )}`}>
              {overallScore.toFixed(1)}
              <span className="text-[13px] text-slate-700 md:text-[14px]"> / 10</span>
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-5 text-[8px]">
              <span className={`inline-flex items-center ${radiusPill} border border-slate-300/90 bg-white/95 px-2.5 py-1 font-semibold text-slate-800 ${shadowMini}`}>
                {scoreLiftDisplay}
              </span>
              <span className={`inline-flex items-center ${radiusPill} border border-slate-300/90 bg-slate-100/95 px-2.5 py-1 font-semibold text-slate-700 ${shadowMini}`}>
                {revenueImpactHigh > 0 ? `${revenueImpactDisplay}/mois` : revenueImpactDisplay}
              </span>
            </div>
            <p className="mt-6 text-[11px] leading-5 text-slate-700">
              {localizedTargetVsMarketPosition || marketSummaryText}
            </p>
            <div className="mt-6 text-left text-[8px] font-medium uppercase tracking-[0.08em] text-slate-700">
              Score de conversion
            </div>
            <div className="mt-6 w-full rounded-full bg-slate-200/80">
              <div
                className={`h-2 rounded-full ${scoreBarColor}`}
                style={{ width: `${scorePercent}%` }}
              />
            </div>
          </div>

          <div className={`relative min-w-0 overflow-hidden ${radiusCard} ${borderStandard} ${surfaceSlate} ${cardGlow} px-4 py-4 text-right ${shadowMini}`}>
            <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-slate-700">
              Impact estimé
            </p>
            <p className={`mt-6 text-[15px] font-semibold tracking-tight md:text-[16px] ${
              bookingLiftHigh > 0 ? "text-emerald-700" : "text-amber-700"
            }`}>
              {bookingLiftHigh > 0 ? (
                <>
                  +{bookingLiftLow.toFixed(0)}
                  <span className="text-slate-700"> à </span>
                  <span className="text-emerald-700">+{bookingLiftHigh.toFixed(0)}%</span>
                </>
              ) : (
                bookingLiftLabel || (bookingLiftSummary || impactSummary ? "Estimation disponible" : "—")
              )}
            </p>
            <p className="mt-6 text-[11px] leading-5 text-slate-700">
              {heroRevenueSupport}
            </p>
            <div className="mt-6 text-left text-[8px] font-medium uppercase tracking-[0.08em] text-slate-700">
              Réservations estimées après optimisation
            </div>
            <div className="mt-6 w-full rounded-full bg-slate-200/80">
              <div
                className={`h-2 rounded-full ${potentialBarColor}`}
                style={{ width: `${Math.max(0, Math.min(100, bookingLiftHigh))}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <section className={sectionShell}>
        <div className={sectionBody}>
          <div className="grid gap-5 xl:grid-cols-12">
            <div className={`nk-card nk-card-hover relative overflow-hidden ${radiusContainer} ${borderStandard} ${surfaceDiagnostic} ${cardGlow} p-4 ${shadowStandard} xl:col-span-7`}>
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-slate-700">
                    Niveau de conversion global
                  </p>
                  <h2 className={sectionTitle}>
                    {scoreOverviewTitle}
                  </h2>
                  <p className={sectionIntro}>
                    {scoreOverviewText}
                  </p>
                </div>
                <div className={`relative overflow-hidden ${radiusCard} ${borderStandard} ${surfaceNeutral} ${cardGlow} px-5 py-4 text-right ${shadowMini}`}>
                  <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-slate-700">
                    Niveau de conversion
                  </p>
                  <p className={`mt-6 text-[15px] font-semibold tracking-tight md:text-[16px] ${scoreValueClass(
                    overallScore
                  )}`}>
                    {overallScore.toFixed(1)}
                    <span className="text-[12px] text-slate-700 md:text-[13px]"> / 10</span>
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {subScoreCards.map((item) => (
                 <div
  key={item.label}
  className={`relative overflow-hidden ${radiusCard} border border-slate-200/65 ${metricSurfaceClass(
    item.value
  )} ${cardGlow} ${shadowMini} p-3.5`}
>
                    <div className="flex items-start justify-between gap-5">
                      <p className={kpiLabel}>{item.label}</p>
                      <span className={`${pillBaseClass} ${scoreBadgeClass(item.value)}`}>
                        {item.value !== null ? `${item.value}/10` : "À confirmer"}
                      </span>
                    </div>
                    <p className={`mt-6 text-[13px] font-semibold tracking-tight md:text-[14px] ${scoreValueClass(
                      item.value
                    )}`}>
                      {item.value !== null ? `${item.value}/10` : "À confirmer"}
                    </p>
                    <p className="mt-6 line-clamp-2 text-[11px] leading-5 text-slate-700">
                      {item.value !== null ? item.note : item.fallback}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className={`nk-card nk-card-hover relative overflow-hidden ${radiusContainer} ${borderStandard} ${surfaceSlate} ${cardGlow} p-4 ${shadowStandard} xl:col-span-5`}>
              <p className={cardTitle}>
                Positionnement sur le marché
              </p>
              <h2 className="mt-6 text-[16px] font-semibold tracking-[-0.02em] text-slate-900 md:text-[18px]">
                Comment votre annonce se situe
              </h2>
              <p className="mt-6 max-w-2xl text-[11px] leading-5 text-slate-800">
                Une lecture rapide pour situer l’annonce face aux offres comparables et décider si le
                positionnement actuel soutient réellement vos objectifs de conversion.
              </p>
              <div className="mt-6 grid gap-5">
                <div className={`min-w-0 overflow-hidden ${kpiCardMini}`}>
                  <p className={kpiLabel}>
                    Positionnement
                  </p>
                  <p
                    className={`mt-6 break-words text-[13px] font-semibold tracking-tight md:text-[14px] ${marketLabelClass(
                      market.label
                    )}`}
                  >
                    {marketLabelText(market.label)}
                  </p>
                  <p className="mt-6 text-[11px] leading-5 text-slate-700">
                    {localizedTargetVsMarketPosition || marketSummaryText}
                  </p>
                  <p className="mt-6 text-[11px] leading-5 text-slate-700 line-clamp-2">
                    {benchmarkSupportText}
                  </p>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className={`min-w-0 overflow-hidden ${kpiCardMini}`}>
                    <p className={kpiLabel}>
                      Niveau moyen du marché
                    </p>
                    <p className={`mt-6 text-[13px] font-semibold tracking-tight md:text-[14px] ${
                      marketAverageScore !== null ? scoreValueClass(marketAverageScore) : "text-amber-700"
                    }`}>
                      {scoreMarketValueDisplay}
                    </p>
                    <p className="mt-6 line-clamp-2 text-[11px] leading-5 text-slate-700">{marketScoreContext}</p>
                  </div>
                  <div className={`min-w-0 overflow-hidden ${kpiCardMini}`}>
                    <p className={kpiLabel}>
                      Comparables analysés
                    </p>
                    <p className={`mt-6 text-[13px] font-semibold tracking-tight md:text-[14px] ${competitorCountValueClass(
                      marketCompetitorCount 
                    )}`}>
                      {competitorCountDisplay}
                    </p>
                    <p className="mt-6 line-clamp-2 text-[11px] leading-5 text-slate-700">{competitorCountSupport}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={`nk-card nk-card-hover relative overflow-hidden ${radiusContainer} ${borderStandard} ${surfaceBusiness} ${cardGlow} p-4 ${shadowExecutive}`}>
            <div className="grid gap-5 md:grid-cols-12 md:items-start">
              <div className="space-y-4 md:col-span-5 xl:col-span-5 xl:max-w-xl">
                <p className="nk-kicker-muted text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-700">
                  INDICATEUR BUSINESS
                </p>
                <div className="flex flex-wrap items-baseline gap-5">
                  <h2 className="text-[14px] font-semibold tracking-tight text-slate-950 md:text-[16px]">
                    Qualité perçue de l’annonce
                  </h2>
                  {listingQualityIndex?.label ? (
                    <span className={`inline-flex items-center ${radiusPill} border border-slate-300/90 bg-white/95 px-3 py-1 text-[8px] font-semibold uppercase tracking-[0.1em] text-slate-700 ${shadowMini}`}>
                      {lqiLabelText(listingQualityIndex.label)}
                    </span>
                  ) : (
                    <span className={`inline-flex items-center ${radiusPill} border border-amber-200/85 bg-amber-50/60 px-3 py-1 text-[8px] font-semibold uppercase tracking-[0.1em] text-amber-700 ${shadowMini}`}>
                      {lqiLabelDisplay}
                    </span>
                  )}
                </div>
                <p className="text-[11px] leading-5 text-slate-700">
                  {lqiSummaryText}
                </p>
              </div>

              <div className="mt-6 flex min-w-0 flex-col gap-5 md:col-span-7 md:mt-0 md:max-w-none xl:col-span-7">
                <div className={`relative min-w-0 overflow-hidden ${radiusCard} border border-slate-700/70 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(148,163,184,0.16),transparent_28%),linear-gradient(180deg,#111827_0%,#1f2937_56%,#273449_100%)] bg-clip-padding ring-1 ring-white/10 before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:bg-[linear-gradient(180deg,rgba(255,255,255,0.16),transparent)] after:pointer-events-none after:absolute after:inset-x-6 after:top-0 after:h-px after:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)] px-4 py-3 text-right text-slate-50 ${shadowExecutive}`}>
                  <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-slate-200">
                    Lecture IQA
                  </p>
                  <p className="mt-6 break-words text-[16px] font-semibold md:text-[18px]">
                    {lqiScore !== null ? (
                      <>
                        <span className={lqiScore >= 75 ? "text-emerald-300" : lqiScore >= 55 ? "text-amber-300" : "text-rose-300"}>
                          {lqiScore}
                        </span>
                        <span className="text-[14px] text-slate-300"> / 100</span>
                      </>
                    ) : (
                      <span className="text-[14px] text-amber-300">{lqiScoreDisplay}</span>
                    )}
                  </p>
                </div>

                <div className="grid gap-5 md:grid-cols-3">
                  <div className={`min-w-0 overflow-hidden ${kpiCardMini} text-left`}>
                    <p className={kpiLabel}>
                      Qualité de l’annonce
                    </p>
                    <p className={`${kpiValueMini} ${indexValueClass(lqiListingQuality)}`}>
                      {lqiListingQuality !== null ? (
                        <>
                          {lqiListingQuality}
                          <span className="text-slate-700"> / 100</span>
                        </>
                      ) : (
                        <span className="text-amber-700">Lecture partielle</span>
                      )}
                    </p>
                    <p className={kpiBody}>{lqiComponentNotes.listing}</p>
                  </div>

                  <div className={`min-w-0 overflow-hidden ${kpiCardMini} text-left`}>
                    <p className={kpiLabel}>
                      Compétitivité marché
                    </p>
                    <p className={`${kpiValueMini} ${indexValueClass(lqiMarketCompetitiveness)}`}>
                      {lqiMarketCompetitiveness !== null ? (
                        <>
                          {lqiMarketCompetitiveness}
                          <span className="text-slate-700"> / 100</span>
                        </>
                      ) : (
                        <span className="text-amber-700">Lecture partielle</span>
                      )}
                    </p>
                    <p className={kpiBody}>{lqiComponentNotes.market}</p>
                  </div>

                  <div className={`min-w-0 overflow-hidden ${kpiCardMini} text-left`}>
                    <p className={kpiLabel}>
                      Potentiel de conversion
                    </p>
                    <p className={`${kpiValueMini} ${indexValueClass(lqiConversionPotential)}`}>
                      {lqiConversionPotential !== null ? (
                        <>
                          {lqiConversionPotential}
                          <span className="text-slate-700"> / 100</span>
                        </>
                      ) : (
                        <span className="text-amber-700">Lecture partielle</span>
                      )}
                    </p>
                    <p className={kpiBody}>{lqiComponentNotes.conversion}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={sectionShell}>
        <div className={sectionBody}>
          <div className={`nk-card nk-card-hover relative overflow-hidden ${radiusContainer} ${borderStandard} ${surfaceDiagnostic} ${cardGlow} p-4 ${shadowStandard}`}>
            <div className="flex items-center justify-between gap-5">
              <div>
                <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-slate-700">
                  Lecture marché
                </p>
                <p className="mt-6 text-[15px] font-semibold tracking-[-0.02em] text-slate-900 md:text-[17px]">
                  Comment votre annonce se situe face à la concurrence
                </p>
                <p className="mt-6 max-w-2xl text-[11px] leading-5 text-slate-800">
                  Les repères concurrentiels qui aident à arbitrer le niveau de prix, la compétitivité
                  perçue et les écarts à corriger en priorité.
                </p>
              </div>
            </div>

            <div className={`${grid4} items-stretch`}>
              <div className={`${kpiCard} ${surfaceCool}`}>
                <p className={kpiLabel}>
                  Position marché
                </p>
                <p
                  className={`${kpiValue} break-words ${marketLabelClass(
                    market.label
                  )}`}
                >
                  {marketLabelText(market.label)}
                </p>
                <p className={kpiBody}>
                  {localizedTargetVsMarketPosition || marketSummaryText}
                </p>
              </div>

              <div className={`${kpiCard} ${surfaceNeutral}`}>
                <p className={kpiLabel}>
                  Concurrents analysés
                </p>
                <p className={`${kpiValue} ${competitorCountValueClass(marketCompetitorCount)}`}>
                  {competitorCountDisplay}
                </p>
                <p className={kpiBody}>
                  {marketCompetitorCount !== null
                    ? "Base concurrentielle retenue pour cette lecture."
                    : competitorCountSupport}
                </p>
              </div>
              <div className={`${kpiCard} ${surfaceNeutral}`}>
                <p className={kpiLabel}>
                  Prix moyen concurrent
                </p>
                <p className={`${kpiValue} text-amber-700`}>
                  {avgCompetitorPriceDisplay}
                </p>
                <p className={kpiBody}>{avgCompetitorPriceSupport}</p>
              </div>
              <div className={`${kpiCard} border border-slate-200/60 ${
  priceDeltaPercent === null
    ? surfaceWarning
    : priceDeltaPercent > 0
    ? surfacePositive
    : priceDeltaPercent < 0
    ? surfaceCriticalSoft
    : surfaceWarning
}`}>
                <p className={kpiLabel}>
                  Écart de prix vs marché
                </p>
                <p
                  className={`${kpiValue} ${
                    (priceDeltaPercent ?? 0) > 0
                      ? "text-emerald-700"
                      : (priceDeltaPercent ?? 0) < 0
                      ? "text-rose-700"
                      : "text-amber-700"
                  }`}
                >
                  {priceDeltaPercent !== null ? (
                    <>
                      {priceDeltaPercent > 0 ? "+" : ""}
                      {priceDeltaPercent.toFixed(0)}%
                    </>
                  ) : (
                    priceDeltaDisplay
                  )}
                </p>
                <p className={kpiBody}>
                  {priceDeltaPercent !== null ? marketPricePositionText : marketRatingContext}
                </p>
              </div>
            </div>

            {(localizedCompetitorGaps.length > 0 || localizedCompetitorAdvantages.length > 0) && (
              <div className={`mt-6 ${grid2}`}>
                <div className={`${cardSoft} ${cardPadCompact} border-slate-200/65 ${surfaceNeutral}`}>
                  <p className={cardTitle}>
                    Écarts observés
                  </p>
                  <ul className="mt-6 space-y-4 text-[12px] leading-5 text-slate-800">
                    {localizedCompetitorGaps.length > 0 ? (
                      localizedCompetitorGaps.slice(0, 3).map((item) => <li key={item}>• {item}</li>)
                    ) : (
                      <li className="text-slate-700">
                        Aucun écart marché structuré n’est disponible pour le moment.
                      </li>
                    )}
                  </ul>
                </div>

                <div className={`${cardSoft} ${cardPadCompact} border-emerald-200/60 ${surfaceGreen}`}>
                  <p className={cardTitle}>
                    Avantages déjà identifiés
                  </p>
                  <ul className="mt-6 space-y-4 text-[12px] leading-5 text-slate-800">
                    {localizedCompetitorAdvantages.length > 0 ? (
                      localizedCompetitorAdvantages
                        .slice(0, 3)
                        .map((item) => <li key={item}>• {item}</li>)
                    ) : (
                      <li className="text-slate-700">
                        Aucun avantage marché structuré n’est encore disponible.
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            )}
          </div>

          <div className={`nk-card nk-card-hover relative overflow-hidden ${radiusContainer} ${borderStandard} ${surfaceBusiness} ${cardGlow} p-4 ${shadowExecutive}`}>
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="max-w-2xl">
                <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-slate-700">
                  Impact estimé sur les réservations
                </p>
                <h2 className="mt-6 text-[14px] font-semibold tracking-tight text-slate-900 md:text-[16px]">
                  Potentiel business après optimisation
                </h2>
                <p className="mt-6 text-[11px] leading-5 text-slate-800">
                  {estimatedImpactHeadline}
                </p>
              </div>
              <div className={`relative mt-6 overflow-hidden ${radiusCard} ${borderStandard} ${surfaceNeutral} ${cardGlow} px-5 py-4 text-right ${shadowEmphasis} md:mt-0 md:min-w-[260px]`}>
                <p className="text-[8px] font-semibold uppercase tracking-[0.1em] text-slate-700">
                  Gain potentiel
                </p>
                <p className={`mt-6 text-[16px] font-semibold tracking-tight md:text-[18px] ${
                  bookingLiftHigh > 0 ? "text-emerald-700" : "text-amber-700"
                }`}>
                  {estimatedImpactValueDisplay}
                </p>
                <p className="mt-6 text-[11px] leading-5 text-slate-700">
                  {bookingLiftLabel || estimatedImpactDetail}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-4">
              <div className={`nk-card nk-card-hover relative overflow-hidden ${radiusCard} ${borderStandard} ${
  currentListingPrice !== null ? surfacePositive : surfaceWarning
} ${cardGlow} ${shadowMini} p-4 flex h-full flex-col justify-between`}>
                <p className={kpiLabel}>
                  Prix actuel
                </p>
                <p className={kpiValue}>{currentPriceDisplay}</p>
                <p className={kpiBody}>
                  {currentPriceContext}
                </p>
              </div>

              <div className={`nk-card nk-card-hover relative overflow-hidden ${radiusCard} ${borderStandard} ${
  marketAverageScore !== null ? metricSurfaceClass(marketAverageScore) : surfaceWarning
} ${cardGlow} ${shadowMini} p-4 flex h-full flex-col justify-between`}>
                <p className={kpiLabel}>
                  Niveau moyen du marché
                </p>
                <p className={kpiValue}>{marketScoreDisplay}</p>
                <p className={kpiBody}>{marketScoreContext}</p>
              </div>

              <div className={`nk-card nk-card-hover relative overflow-hidden ${radiusCard} border border-slate-200/65 ${
  bookingLiftHigh > 0 ? surfacePositive : surfaceWarning
} ${cardGlow} ${shadowEmphasis} p-4 flex h-full flex-col justify-between`}>
                <p className={kpiLabel}>
                  Potentiel de réservations
                </p>
                <p className={kpiValue}>{bookingLiftRangeDisplay}</p>
                <p className={kpiBody}>
                  {bookingLiftSummary || "Projection issue des signaux actuellement disponibles dans l’audit"}
                </p>
              </div>

              <div className={`nk-card nk-card-hover ${kpiCardEmphasis} flex h-full flex-col justify-between`}>
                <p className={kpiLabel}>
                  Impact revenu estimé
                </p>
                <p className={`${kpiValue} ${revenueImpactHigh > 0 ? "text-emerald-700" : "text-amber-700"}`}>
                  {revenueImpactRangeDisplay}
                </p>
                <p className={kpiBody}>
                  {revenueImpactSummary || "Lecture revenu dérivée des hypothèses actuellement disponibles"}
                </p>
              </div>
            </div>
<div className={`nk-card nk-card-hover relative overflow-hidden ${radiusCard} border border-slate-200/65 ${
  revenueImpactHigh > 0 ? surfacePositive : revenueImpactSummary ? surfaceWarning : surfaceWarning
} ${cardGlow} ${shadowEmphasis} p-4 flex h-full flex-col justify-between`}>
              <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-slate-700">
                Recommandations tarifaires
              </p>
              <p className="mt-6 text-[11px] leading-5 text-slate-700">{revenuePricingLead}</p>
              {pricingRecommendationsUnique.length > 0 ? (
                <ul className="mt-6 space-y-4 text-[11px] leading-5 text-slate-800">
                  {pricingRecommendationsUnique.slice(0, 4).map((item) => (
                    <li key={item} className="ml-4 list-disc">
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-6 text-[11px] leading-5 text-slate-700">
                  Les recommandations tarifaires seront affichées ici dès que des estimations fiables seront disponibles.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className={sectionShell}>
        <div className={sectionBody}>
          <div className="space-y-8">
            <div className={`nk-card relative min-w-0 overflow-hidden ${radiusContainer} ${borderStandard} ${surfaceEditorial} ${cardGlow} p-3 ${shadowEmphasis}`}>
              <div className="grid gap-5 md:gap-5 lg:grid-cols-12 lg:items-start">
                <div className="min-w-0 lg:col-span-7 xl:col-span-8">
                  <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-slate-700">
                    Base de texte proposée (IA)
                  </p>
                  <p className="mt-6 text-[11px] leading-5 text-slate-800">
                    Une base exploitable immédiatement, à ajuster ensuite selon votre marque.
                  </p>
                  <p className="mt-4 text-[10px] font-medium tracking-[0.04em] text-slate-500">
                    Variante {currentAiVariantIndex} / {aiDescriptionVariants.length}
                  </p>
                </div>

                <div className="relative flex flex-nowrap items-center gap-3 sm:gap-5 lg:col-span-5 lg:justify-end xl:col-span-4">
                  <button
                    type="button"
                    onClick={handleCopyAiDescription}
                    className={`inline-flex min-h-[28px] min-w-[132px] sm:min-w-[152px] shrink-0 items-center justify-center whitespace-nowrap appearance-none outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ${radiusPill} border border-slate-700 bg-[linear-gradient(180deg,#0f172a_0%,#1e293b_100%)] px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] leading-none text-white shadow-[0_12px_26px_rgba(15,23,42,0.14),0_1px_0_rgba(255,255,255,0.1)_inset]`}
                  >
                    Copier la description
                  </button>
                  <button
                    type="button"
                    onClick={handleNextAiVariant}
                    className={`inline-flex min-h-[28px] min-w-[96px] sm:min-w-[108px] shrink-0 items-center justify-center whitespace-nowrap appearance-none outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ${radiusPill} border border-amber-200/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,251,235,0.96))] px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] leading-none text-slate-800 shadow-[0_10px_22px_rgba(180,83,9,0.06),0_1px_0_rgba(255,255,255,0.62)_inset]`}
                  >
                    Nouvelle variante
                  </button>
                  {copyToastKey === "main" && (
                    <div className="pointer-events-none absolute right-0 top-full z-10 mt-2">
                      <div className={`inline-flex items-center ${radiusPill} border border-slate-200/80 bg-white/95 px-3 py-1.5 text-[10px] font-medium tracking-[0.04em] text-slate-700 shadow-[0_12px_26px_rgba(15,23,42,0.08)] backdrop-blur-sm`}>
                        Description copiée
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className={`relative mt-6 min-w-0 overflow-hidden ${radiusCard} ${borderStandard} ${surfaceExecution} ${cardGlow} px-3.5 py-3.5 ${shadowMini}`}>
                <textarea
                  value={editableAiDescription}
                  onChange={(event) => setEditableAiDescription(event.target.value)}
                  rows={8}
                  spellCheck={false}
                  placeholder="La description IA apparaîtra ici dès que les données d’audit seront disponibles."
                  className="min-h-[188px] w-full resize-none bg-transparent text-[11px] leading-5 text-slate-900 outline-none placeholder:text-slate-500"
                />
              </div>

              <div className="mt-6 grid gap-5 md:grid-cols-3">
                <div className={`relative min-w-0 overflow-hidden ${radiusCard} ${borderStandard} ${surfaceExecution} ${cardGlow} px-3.5 py-3 ${shadowMini}`}>
                  <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-slate-700">
                    Mon logement
                  </p>
                  <div className="mt-4 whitespace-pre-line text-[11px] leading-5 text-slate-800">
                    {currentAiVariant.logement || "• Les informations logement seront proposées ici."}
                  </div>
                </div>

                <div className={`relative min-w-0 overflow-hidden ${radiusCard} ${borderStandard} ${surfaceExecution} ${cardGlow} px-3.5 py-3 ${shadowMini}`}>
                  <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-slate-700">
                    Accès des voyageurs
                  </p>
                  <p className="mt-4 text-[11px] leading-5 text-slate-800">
                    {currentAiVariant.acces || "Les conditions d’accès seront proposées ici."}
                  </p>
                </div>

                <div className={`relative min-w-0 overflow-hidden ${radiusCard} ${borderStandard} ${surfaceExecution} ${cardGlow} px-3.5 py-3 ${shadowMini}`}>
                  <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-slate-700">
                    Échanges avec les voyageurs
                  </p>
                  <p className="mt-4 text-[11px] leading-5 text-slate-800">
                    {currentAiVariant.echanges || "Les modalités d’échange seront proposées ici."}
                  </p>
                </div>
              </div>

              {aiKeywords.length > 0 && (
                <div className="mt-6">
                  <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-slate-700">
                    Mots-clés à tester
                  </p>
                  <div className="mt-6 flex flex-wrap gap-5 text-sm">
                    {aiKeywords.map((keyword) => (
                      <span
                        key={keyword}
                        className="inline-flex items-center rounded-full border border-amber-200/65 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,251,235,0.96))] px-3 py-1 text-slate-800 shadow-[0_10px_22px_rgba(180,83,9,0.06),0_1px_0_rgba(255,255,255,0.6)_inset]"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid items-stretch gap-5 md:gap-5 xl:grid-cols-12">
            <div className={`nk-card nk-card-hover relative overflow-hidden ${radiusContainer} ${borderStandard} ${surfaceExecution} ${cardGlow} p-4 xl:col-span-7 ${shadowStandard}`}>
              <div className="flex items-center justify-between gap-5">
                <div>
                  <p className="text-[15px] font-semibold tracking-[-0.02em] text-slate-900 md:text-[17px]">
                    Plan d’action
                  </p>
                  <p className="mt-6 text-[11px] leading-5 text-slate-800">
                    Les chantiers à lancer maintenant, classés par impact business.
                  </p>
                </div>
              </div>
              <p className="mt-6 max-w-3xl text-[11px] leading-5 text-slate-800 line-clamp-2">{actionPlanIntro}</p>

              <div className="mt-6 space-y-4">
                <div className={`relative overflow-hidden ${radiusCard} border border-rose-200/60 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.86),transparent_40%),linear-gradient(180deg,#fffdfd_0%,#f9f1f4_100%)] p-4 ${shadowMini}`}>
                  <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-rose-700">
                    Critique
                  </p>
                  <ul className="mt-6 space-y-4 text-[11px] leading-5 text-slate-700">
                    {groupedImprovements.high.length > 0 ? (
                      groupedImprovements.high.map((item, index) => (
                        <li key={item.id ?? `${item.title}-${index}`} className={`relative overflow-hidden ${radiusCard} border border-rose-200/65 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.86),transparent_40%),linear-gradient(180deg,#ffffff_0%,#fdf6f8_100%)] ${shadowMini} transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_18px_40px_rgba(127,29,29,0.07),0_1px_0_rgba(255,255,255,0.6)_inset]`}>
                          <label className="flex items-start gap-5 p-3">
                            <div className="flex-1 space-y-4 peer-checked:line-through">
                              <div className="flex items-center justify-between gap-5">
                                <div>
                                  <p className="text-[12px] font-semibold text-slate-900">{item.title ?? "Amélioration prioritaire"}</p>
                                </div>
                                <span
                                  className={`${pillBaseClass} ${impactClass(
                                    item.impact
                                  )}`}
                                >
                                  {(item.impact ?? "medium") === "high"
                                    ? "impact élevé"
                                    : (item.impact ?? "medium") === "low"
                                    ? "impact faible"
                                    : "impact moyen"}
                                </span>
                              </div>
                              <p className="mt-6 text-[11px] leading-5 text-slate-700 line-clamp-3">
                                {item.description ?? "Détail non communiqué."}
                              </p>
                            </div>
                          </label>
                        </li>
                      ))
                    ) : (
                      <li className="text-amber-700">Aucune action critique disponible.</li>
                    )}
                  </ul>
                </div>

                <div className={`relative overflow-hidden ${radiusCard} border border-amber-200/60 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.86),transparent_40%),linear-gradient(180deg,#fffdf9_0%,#fffaf1_100%)] p-4 ${shadowMini}`}>
                  <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                    Impact élevé
                  </p>
                  <ul className="mt-6 space-y-4 text-[11px] leading-5 text-slate-700">
                    {groupedImprovements.medium.length > 0 ? (
                      groupedImprovements.medium.map((item, index) => (
                        <li key={item.id ?? `${item.title}-${index}`} className={`relative overflow-hidden ${radiusCard} border border-amber-200/65 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.86),transparent_40%),linear-gradient(180deg,#ffffff_0%,#fff9f3_100%)] ${shadowMini} transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_18px_40px_rgba(146,64,14,0.07),0_1px_0_rgba(255,255,255,0.6)_inset]`}>
                          <label className="flex items-start gap-5 p-3">
                            <div className="flex-1 space-y-4 peer-checked:line-through">
                              <div className="flex items-center justify-between gap-5">
                                <div>
                                  <p className="text-[12px] font-semibold text-slate-900">{item.title ?? "Amélioration"}</p>
                                </div>
                                <span
                                  className={`${pillBaseClass} ${impactClass(
                                    item.impact
                                  )}`}
                                >
                                  {(item.impact ?? "medium") === "high"
                                    ? "impact élevé"
                                    : (item.impact ?? "medium") === "low"
                                    ? "impact faible"
                                    : "impact moyen"}
                                </span>
                              </div>
                              <p className="mt-6 text-[11px] leading-5 text-slate-700 line-clamp-3">
                                {item.description ?? "Détail non communiqué."}
                              </p>
                            </div>
                          </label>
                        </li>
                      ))
                    ) : (
                      <li className="text-amber-700">Aucune action à impact moyen disponible.</li>
                    )}
                  </ul>
                </div>

                <div className={`relative overflow-hidden ${radiusCard} border border-slate-200/60 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.88),transparent_40%),linear-gradient(180deg,#fbfcfd_0%,#ffffff_100%)] p-4 ${shadowMini}`}>
                  <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-700">
                    À envisager
                  </p>
                  <ul className="mt-6 space-y-4 text-[11px] leading-5 text-slate-700">
                    {groupedImprovements.low.length > 0 ? (
                      groupedImprovements.low.map((item, index) => (
                        <li key={item.id ?? `${item.title}-${index}`} className={`relative overflow-hidden ${radiusCard} border border-slate-200/65 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.86),transparent_40%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] ${shadowMini} transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_18px_40px_rgba(15,23,42,0.06),0_1px_0_rgba(255,255,255,0.6)_inset]`}>
                          <label className="flex items-start gap-5 p-3">
                            <div className="flex-1 space-y-4 peer-checked:line-through">
                              <div className="flex items-center justify-between gap-5">
                                <div>
                                  <p className="text-[12px] font-semibold text-slate-900">{item.title ?? "Amélioration complémentaire"}</p>
                                </div>
                                <span
                                  className={`${pillBaseClass} ${impactClass(
                                    item.impact
                                  )}`}
                                >
                                  {(item.impact ?? "medium") === "high"
                                    ? "impact élevé"
                                    : (item.impact ?? "medium") === "low"
                                    ? "impact faible"
                                    : "impact moyen"}
                                </span>
                              </div>
                              <p className="mt-6 text-[11px] leading-5 text-slate-700 line-clamp-3">
                                {item.description ?? "Détail non communiqué."}
                              </p>
                            </div>
                          </label>
                        </li>
                      ))
                    ) : (
                      <li className="text-amber-700">Aucune action complémentaire disponible.</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>

            <div className={`nk-card nk-card-hover relative overflow-hidden ${radiusContainer} ${borderStandard} ${surfaceExecution} ${cardGlow} p-4 xl:col-span-5 ${shadowEmphasis}`}>
              <div className="flex items-center justify-between gap-5">
                <div>
                  <p className="text-[15px] font-semibold tracking-[-0.02em] text-slate-900 md:text-[17px]">
                    Actions prioritaires
                  </p>
                  <p className="mt-6 text-[11px] leading-5 text-slate-800">
                    La séquence recommandée pour passer à l’action sans dispersion.
                  </p>
                </div>
              </div>
              <p className="mt-6 max-w-2xl text-[11px] leading-5 text-slate-800 line-clamp-2">{prioritizedActionsIntro}</p>
              <ol className="mt-6 space-y-4 text-[11px] text-slate-800">
                {improvements.length > 0 ? (
                  localizedImprovements
                    .slice()
                    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
                    .map((imp, index) => (
                      <li
                        key={imp.id ?? index}
                        className={`relative overflow-hidden ${radiusCard} border border-amber-200/65 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.88),transparent_40%),linear-gradient(180deg,#ffffff_0%,#fff9f2_100%)] ${shadowMini} transition hover:-translate-y-0.5 hover:border-amber-300/75 hover:bg-white hover:shadow-[0_18px_40px_rgba(180,83,9,0.08),0_1px_0_rgba(255,255,255,0.6)_inset]`}
                      >
                        <label className="flex items-start gap-5 p-3">
                          <input
                            type="checkbox"
                            className="mt-6 h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500 peer"
                          />
                          <div className="flex-1 space-y-4 peer-checked:line-through">
                            <div className="flex items-center justify-between gap-5">
                              <div>
                                <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-slate-700">
                                  Priorité {index + 1}
                                </p>
                                <p className="mt-6 text-[13px] font-semibold tracking-[-0.01em] text-slate-950">
                                  {imp.title ?? "Amélioration"}
                                </p>
                              </div>
                              <span
                                className={`${pillBaseClass} ${impactClass(
                                  imp.impact
                                )}`}
                              >
                                {(imp.impact ?? "medium") === "high"
                                  ? "impact élevé"
                                  : (imp.impact ?? "medium") === "low"
                                  ? "impact faible"
                                  : "impact moyen"}
                              </span>
                            </div>
                            <p className="mt-6 text-[11px] leading-5 text-slate-700 line-clamp-3">
                              {imp.description}
                            </p>
                          </div>
                        </label>
                      </li>
                    ))
                ) : (
                  <li className="text-[11px] leading-5 text-amber-700">
                    Aucune amélioration prioritaire disponible pour le moment.
                  </li>
                )}
              </ol>
            </div>

            <div className={`nk-card nk-card-hover relative overflow-hidden ${radiusContainer} ${borderStandard} ${surfaceCritical} ${cardGlow} p-4 xl:col-span-12 ${shadowEmphasis}`}>
              <div className="flex items-center justify-between gap-5">
                <p className="text-[16px] font-semibold tracking-[-0.02em] text-slate-900 md:text-[18px]">
                  Ce qui vous fait perdre des réservations
                </p>
              </div>
              <p className="mt-6 text-[12px] leading-5 text-slate-800">
                Les freins visibles qui pèsent le plus sur vos réservations aujourd’hui.
              </p>
              <div className="mt-6 grid items-stretch gap-5 md:gap-5 md:grid-cols-2">
                {priorityLossSignals.length > 0 ? (
                  priorityLossSignals.map((item, index) => (
                    <div
                      key={`${item}-${index}`}
                      className={`relative overflow-hidden ${radiusCard} border border-rose-200/60 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.86),transparent_40%),linear-gradient(180deg,#fffdfd_0%,#f8f0f3_100%)] p-3 ${shadowMini}`}
                    >
                      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-rose-700">
                        Frein {index + 1}
                      </p>
                      <p className="mt-6 text-[12px] leading-5 text-slate-800">{item}</p>
                    </div>
                  ))
                ) : (
                  <div className={`${cardSoft} ${cardPadCompact} text-[12px] leading-5 text-slate-700 md:col-span-2`}>
                    Aucun frein majeur n’a été identifié pour le moment.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={sectionShell}>
        <div className={sectionBody}>
          <div className="space-y-6">
            <div className="grid items-stretch gap-5 md:gap-5 xl:grid-cols-3">
              <div className={detailCard}>
                <div className={`mb-2 ${detailCardLabel}`}>
                  Détail des leviers
                </div>
                <dl className="space-y-4 text-[12px] leading-5">
                  <div className={`relative overflow-hidden flex items-center justify-between gap-5 ${radiusCard} border border-slate-200/65 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.88),transparent_42%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-3.5 py-3 shadow-[0_10px_22px_rgba(15,23,42,0.04),0_1px_0_rgba(255,255,255,0.58)_inset]`}>
                    <dt className="text-slate-900">Qualité des photos</dt>
                    <dd>
                      <span className={`${pillBaseClass} ${scoreBadgeClass(photoQuality)}`}>
                        {photoQuality !== null ? `${photoQuality}/10` : "À confirmer"}
                      </span>
                    </dd>
                  </div>
                  <div className={`relative overflow-hidden flex items-center justify-between gap-5 ${radiusCard} border border-slate-200/65 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.88),transparent_42%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-3.5 py-3 shadow-[0_10px_22px_rgba(15,23,42,0.04),0_1px_0_rgba(255,255,255,0.58)_inset]`}>
                    <dt className="text-slate-900">Ordre des photos</dt>
                    <dd>
                      <span className={`${pillBaseClass} ${scoreBadgeClass(photoOrder)}`}>
                        {photoOrder !== null ? `${photoOrder}/10` : "À confirmer"}
                      </span>
                    </dd>
                  </div>
                  <div className={`relative overflow-hidden flex items-center justify-between gap-5 ${radiusCard} border border-slate-200/65 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.88),transparent_42%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-3.5 py-3 shadow-[0_10px_22px_rgba(15,23,42,0.04),0_1px_0_rgba(255,255,255,0.58)_inset]`}>
                    <dt className="text-slate-900">Qualité de la description</dt>
                    <dd>
                      <span className={`${pillBaseClass} ${scoreBadgeClass(descriptionQuality)}`}>
                        {descriptionQuality !== null ? `${descriptionQuality}/10` : "À confirmer"}
                      </span>
                    </dd>
                  </div>
                  <div className={`relative overflow-hidden flex items-center justify-between gap-5 ${radiusCard} border border-slate-200/65 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.88),transparent_42%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-3.5 py-3 shadow-[0_10px_22px_rgba(15,23,42,0.04),0_1px_0_rgba(255,255,255,0.58)_inset]`}>
                    <dt className="text-slate-900">Complétude des équipements</dt>
                    <dd>
                      <span className={`${pillBaseClass} ${scoreBadgeClass(amenitiesCompleteness)}`}>
                        {amenitiesCompleteness !== null ? `${amenitiesCompleteness}/10` : "À confirmer"}
                      </span>
                    </dd>
                  </div>
                  <div className={`relative overflow-hidden flex items-center justify-between gap-5 ${radiusCard} border border-slate-200/65 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.88),transparent_42%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-3.5 py-3 shadow-[0_10px_22px_rgba(15,23,42,0.04),0_1px_0_rgba(255,255,255,0.58)_inset]`}>
                    <dt className="text-slate-900">Performance SEO</dt>
                    <dd>
                      <span className={`${pillBaseClass} ${scoreBadgeClass(seoStrength)}`}>
                        {seoStrength !== null ? `${seoStrength}/10` : "À confirmer"}
                      </span>
                    </dd>
                  </div>
                  <div className={`relative overflow-hidden flex items-center justify-between gap-5 ${radiusCard} border border-slate-200/65 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.88),transparent_42%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-3.5 py-3 shadow-[0_10px_22px_rgba(15,23,42,0.04),0_1px_0_rgba(255,255,255,0.58)_inset]`}>
                    <dt className="text-slate-900">Performance de conversion</dt>
                    <dd>
                      <span className={`${pillBaseClass} ${scoreBadgeClass(conversionStrength)}`}>
                        {conversionStrength !== null ? `${conversionStrength}/10` : "À confirmer"}
                      </span>
                    </dd>
                  </div>
                </dl>
              </div>

              <div className={detailCard}>
                <div className={`mb-2 ${detailCardLabel}`}>
                  Points forts
                </div>
                <ul className={`${detailCardList} list-disc pl-4`}>
                  {resolvedStrengths.length > 0 ? (
                    localizedStrengths.slice(0, 5).map((item, index) => <li key={index}>{item}</li>)
                  ) : (
                    <li className={detailCardBody}>{strengthsFallbackText}</li>
                  )}
                </ul>
              </div>

              <div className={detailCard}>
                <div className={`mb-2 ${detailCardLabel}`}>
                  Points faibles
                </div>
                <ul className={`${detailCardList} list-disc pl-4`}>
                  {resolvedWeaknesses.length > 0 ? (
                    localizedWeaknesses.slice(0, 5).map((item, index) => <li key={index}>{item}</li>)
                  ) : (
                    <li className={detailCardBody}>{weaknessesFallbackText}</li>
                  )}
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid items-stretch gap-5 md:gap-5 md:grid-cols-2">
              <div className={detailCard}>
                <p className={detailCardLabel}>
                  Principaux écarts vs marché
                </p>
                <ul className={`mt-6 ${detailCardList}`}>
                  {localizedCompetitorGaps.length > 0 ? (
                    localizedCompetitorGaps.slice(0, 5).map((gap, index) => (
                      <li key={`${gap}-${index}`} className="ml-4 list-disc">
                        {gap}
                      </li>
                    ))
                  ) : (
                    <li className={detailCardBody}>Aucun écart majeur identifié pour le moment.</li>
                  )}
                </ul>
              </div>

              <div className={detailCard}>
                <p className={detailCardLabel}>
                  Principaux avantages vs marché
                </p>
                <ul className={`mt-6 ${detailCardList}`}>
                  {localizedCompetitorAdvantages.length > 0 ? (
                    localizedCompetitorAdvantages.slice(0, 5).map((advantage, index) => (
                      <li key={`${advantage}-${index}`} className="ml-4 list-disc">
                        {advantage}
                      </li>
                    ))
                  ) : (
                    <li className={detailCardBody}>
                      Aucun avantage clair identifié pour le moment.
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid items-stretch gap-5 md:gap-5 md:grid-cols-2">
              <div className={`relative ${detailCard}`}>
                <p className={detailCardLabel}>
                  Paragraphe d’ouverture suggéré
                </p>
                <button
                  type="button"
                  onClick={handleCopySuggestedOpening}
                  className={`absolute right-4 top-4 ${radiusPill} border border-amber-200/80 bg-amber-50/60 px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-amber-700 ${shadowMini} transition hover:bg-amber-50`}
                >
                  Copier le texte
                </button>
                <p className={`mt-6 ${detailCardBody} line-clamp-5 text-slate-900`}>
                  {localizedSuggestedOpening || "Aucun paragraphe d’ouverture suggéré pour le moment."}
                </p>
              </div>

              <div className={detailCard}>
                <p className={detailCardLabel}>
                  Ordre de photos suggéré
                </p>
                {localizedPhotoOrderSuggestions.length === 0 ? (
                  <p className={`mt-6 ${detailCardBody} text-slate-900`}>
                    Aucun ordre de photos suggéré pour le moment.
                  </p>
                ) : (
                  <ol className={`mt-6 list-decimal pl-5 ${detailCardList} text-slate-900`}>
                    {localizedPhotoOrderSuggestions.slice(0, 6).map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className={`nk-card nk-card-hover relative flex h-full min-w-0 overflow-hidden flex-col ${radiusCard} ${borderStandard} ${surfaceExecution} ${cardGlow} p-4 ${shadowEmphasis}`}>
              <p className={detailCardLabel}>
                Checklist des équipements manquants
              </p>
              {localizedMissingAmenities.length === 0 ? (
                <p className={`mt-6 ${detailCardBody} text-slate-900`}>
                  Aucun manque évident n’a été détecté dans votre liste d’équipements.
                </p>
              ) : (
                <ul className={`mt-6 list-disc pl-5 ${detailCardList} text-slate-900`}>
                  {localizedMissingAmenities.slice(0, 8).map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className={`nk-card nk-card-hover relative overflow-hidden ${radiusContainer} ${borderStandard} ${surfaceExecution} ${cardGlow} p-3 ${shadowEmphasis}`}>
              <div className="grid items-stretch gap-5 md:gap-5 md:grid-cols-2">
                <div className={`flex h-full min-w-0 overflow-hidden flex-col ${detailInnerCard}`}>
                  <p className={detailCardLabel}>
                    Titre actuel
                  </p>
                  <p className={`mt-6 break-words ${detailCardTitle}`}>
                    {listing?.title || "Aucun titre n’est disponible pour cette annonce."}
                  </p>
                </div>

                <div className={`flex h-full min-w-0 overflow-hidden flex-col ${detailInnerCard}`}>
                  <p className={detailCardLabel}>
                    Exemple de titre optimisé
                  </p>
                  <p className={`mt-6 break-words ${detailCardTitle}`}>
                    {textSuggestions.suggestedTitle || "Suggestion non disponible pour le moment."}
                  </p>
                  <p className={`mt-6 ${detailCardBody}`}>
                    Suggestion générée à partir des informations de l’annonce et de la localisation.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className={`relative flex flex-col gap-5 overflow-hidden ${radiusContainer} ${borderStandard} ${surfaceBusiness} ${cardGlow} p-4 ${shadowExecutive} md:flex-row md:items-center md:justify-between`}>
                        <div className="max-w-lg">
              <h2 className="text-[16px] font-semibold tracking-tight text-slate-950 md:text-[18px]">
                Prochaine étape recommandée
              </h2>
              <p className="mt-6 text-[12px] leading-5 text-slate-700">
                Corrigez d’abord les leviers les plus rentables, puis relancez un audit pour mesurer le gain obtenu.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-5 md:max-w-[360px] md:justify-end">
              <Link
                href="/dashboard/listings/new"
                className="rounded-lg border border-amber-500/20 bg-[linear-gradient(180deg,#f59e0b_0%,#ea580c_100%)] px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white shadow-[0_12px_26px_rgba(234,88,12,0.16),0_1px_0_rgba(255,255,255,0.12)_inset] transition hover:brightness-105"
              >
                Relancer un audit
              </Link>
              <Link
                href="/dashboard/audits"
                className="text-[11px] font-semibold uppercase tracking-[0.12em] text-orange-700 underline-offset-4 hover:underline"
              >
                Retour aux audits
              </Link>
              <Link
                href="/dashboard/listings"
                className="text-[11px] font-semibold uppercase tracking-[0.12em] text-orange-700 underline-offset-4 hover:underline"
              >
                Analyser une autre annonce
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
