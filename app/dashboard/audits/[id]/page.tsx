"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
    priority?: string;
    category?: string;
    reason?: string | null;
    source?: string;
    orderIndex?: number;
  }[];
  actions?: {
    id?: string;
    title?: string;
    description?: string;
    impact?: string;
    priority?: string;
    category?: string;
    reason?: string | null;
    source?: string;
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
  ;

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
  mainAirbnb: string;
  mainBooking: string;
  logement: string;
  logementDetaille: string;
  acces: string;
  echanges: string;
  autresInfos: string;
};

type AiVariant = AiTextSections;
type AiTextSectionKey = "main" | "logement" | "logementDetaille" | "acces" | "echanges" | "autresInfos";

type AuditActionImpact = "high" | "medium" | "low";

type AuditActionItem = {
  id?: string;
  title: string;
  description: string;
  impact: AuditActionImpact;
  priority?: AuditActionImpact;
  category?: string;
  reason?: string | null;
  source?: string;
  orderIndex?: number;
};

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

function limitText(text: string, max: number) {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

function normalizeSentence(value?: string | null) {
  if (!value) return "";
  return value.replace(/\s+/g, " ").trim();
}

function detectAiDescriptionBookingStyleSourceLabel(
  sourceRaw: string | null | undefined
): "Expedia" | "Agoda" | "Vrbo" | null {
  const s = normalizeSentence(sourceRaw).toLowerCase();
  if (!s) return null;
  if (s.includes("airbnb")) return null;
  if (s.includes("expedia")) return "Expedia";
  if (s.includes("agoda")) return "Agoda";
  if (s.includes("vrbo") || s.includes("abritel")) return "Vrbo";
  if (s.includes("booking")) return null;
  return null;
}

type AiGenerationStyle = "airbnb" | "booking_style";

function deduceAiGenerationStyle(sourceRaw: string | null | undefined): AiGenerationStyle {
  const s = normalizeSentence(sourceRaw).toLowerCase();
  if (s.includes("airbnb")) return "airbnb";
  if (
    s.includes("booking") ||
    s.includes("expedia") ||
    s.includes("agoda") ||
    s.includes("vrbo") ||
    s.includes("abritel")
  ) {
    return "booking_style";
  }
  return "booking_style";
}

const AI_TIP_STYLE_TAG_AIRBNB = " — Accent : narration, désir de séjour, singularité.";
const AI_TIP_STYLE_TAG_BOOKING = " — Accent : faits clairs, réassurance, décision rapide.";

function appendAiStyleToTextLines(lines: string[], style: AiGenerationStyle): string[] {
  const tag = style === "airbnb" ? AI_TIP_STYLE_TAG_AIRBNB : AI_TIP_STYLE_TAG_BOOKING;
  return lines.map((line) => (line.includes("— Accent :") ? line : `${line}${tag}`));
}

function flavorTextSuggestionsForAiStyle(
  base: ReturnType<typeof buildTextSuggestions>,
  style: AiGenerationStyle
): ReturnType<typeof buildTextSuggestions> {
  const opening =
    style === "airbnb"
      ? `${base.suggestedOpeningParagraph} Pensez hospitalité : faites imaginer le séjour et ce qui rend votre lieu unique.`
      : `${base.suggestedOpeningParagraph} Pensez conversion : informations utiles et vérifiables dès les premières lignes.`;
  return {
    ...base,
    suggestedOpeningParagraph: opening,
    improvementTips: appendAiStyleToTextLines(base.improvementTips, style),
  };
}

function flavorPhotoSuggestionsForAiStyle(
  base: ReturnType<typeof buildPhotoSuggestions>,
  style: AiGenerationStyle
): ReturnType<typeof buildPhotoSuggestions> {
  return {
    ...base,
    improvementTips: appendAiStyleToTextLines(base.improvementTips, style),
    coverageWarnings: appendAiStyleToTextLines(base.coverageWarnings, style),
  };
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
  generationStyle?: AiGenerationStyle;
}): AiVariant[] {
  const generationStyle = options.generationStyle ?? deduceAiGenerationStyle(options.sourcePlatform);
  const title = normalizeSentence(options.title) || "ce logement";
  const location = normalizeSentence(options.location);
  const description = normalizeSentence(options.description);
  const amenities = Array.isArray(options.amenities)
    ? options.amenities
        .map((item) => normalizeSentence(item))
        .filter(Boolean)
        .filter((item, index, array) => array.indexOf(item) === index)
    : [];
  const sourceText = `${sentenceCase(title)} ${description} ${amenities.join(" ")}`;

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
  const serviceGroups = [
    { label: "linge de maison", pattern: /linge|drap|serviette|towel/i },
    { label: "arrivée autonome", pattern: /autonome|boîte à clés|key ?box|self check/i },
    { label: "ménage", pattern: /ménage|clean/i },
    { label: "chauffage", pattern: /chauffage|heating/i },
  ];

  const readFirstNumber = (pattern: RegExp) => {
    const match = pattern.exec(sourceText);
    return match?.[1] ? Number.parseInt(match[1], 10) : null;
  };
  const guests = readFirstNumber(/(\d+)\s*(?:voyageurs?|personnes?|guests?)/i);
  const rooms = readFirstNumber(/(\d+)\s*(?:chambres?|bedrooms?|rooms?)/i);
  const beds = readFirstNumber(/(\d+)\s*(?:lits?|beds?)/i);
  const bathrooms = readFirstNumber(/(\d+)\s*(?:salles? de bain|bathrooms?|bains?)/i);
  const descriptionSentences = splitIntoSentences(description);
  const forbiddenGeneratedCopy = /description|annonce|texte|formulation|version|contenu|listing|met en avant|valorise|ton recommandé|informations visibles|équipements confirmés|présentés dans un ordre clair|posture soutient/i;
  const locationSignalPattern = /près|proche|centre|gare|métro|metro|tram|plage|mer|port|commerce|restaurant|quartier|aéroport|aeroport|station|lac|parc|musée|musee|vue/i;
  const ruleSignalPattern = /non[- ]?fumeur|animaux|animal|fête|soirée|silence|piscine|parking|caution|check[- ]?in|check[- ]?out|arrivée|départ|règlement|reglement|interdit|autorisé|autorise/i;
  const interiorSignalPattern = /salon|séjour|chambre|lit|couchage|salle de bain|cuisine|wifi|tv|clim|terrasse|balcon|parking|piscine|lave|linge|bureau|douche|baignoire|canapé|espace/i;
  const publishableSentences = descriptionSentences.filter(
    (sentence) => !forbiddenGeneratedCopy.test(sentence)
  );
  const sourceHighlights = publishableSentences
    .filter((sentence) => !locationSignalPattern.test(sentence) && !ruleSignalPattern.test(sentence))
    .slice(0, 4);
  const nearbyHighlights = publishableSentences
    .filter((sentence) => locationSignalPattern.test(sentence))
    .slice(0, 3);
  const interiorHighlights = publishableSentences
    .filter(
      (sentence) =>
        interiorSignalPattern.test(sentence) &&
        !locationSignalPattern.test(sentence) &&
        !ruleSignalPattern.test(sentence)
    )
    .slice(0, 3);
  const ruleHighlights = publishableSentences
    .filter((sentence) => ruleSignalPattern.test(sentence))
    .slice(0, 3);
  const verifiedAmenityLabels = amenityGroups
    .filter(({ pattern }) => amenities.some((item) => pattern.test(item)))
    .map(({ label }) => label);
  const serviceLabels = serviceGroups
    .filter(({ pattern }) => amenities.some((item) => pattern.test(item)))
    .map(({ label }) => label);
  const additionalAmenityLabels = amenities
    .filter((item) => !amenityGroups.some(({ pattern }) => pattern.test(item)))
    .slice(0, 6)
    .map((item) => item.toLowerCase());
  const guestFacingAmenities = [
    ...verifiedAmenityLabels,
    ...additionalAmenityLabels,
  ].slice(0, 9);
  const amenitiesForCopy = guestFacingAmenities.length > 0
    ? guestFacingAmenities
    : ["un espace confortable", "une organisation simple", "des équipements utiles au quotidien"];
  const servicesForCopy = serviceLabels.length > 0
    ? serviceLabels
    : ["une arrivée claire", "des échanges fluides", "un séjour facile à organiser"];
  const capacitySignals = [
    guests ? `${guests} voyageur${guests > 1 ? "s" : ""}` : "",
    rooms ? `${rooms} chambre${rooms > 1 ? "s" : ""}` : "",
    beds ? `${beds} lit${beds > 1 ? "s" : ""}` : "",
    bathrooms ? `${bathrooms} salle${bathrooms > 1 ? "s" : ""} de bain` : "",
  ].filter(Boolean);
  const capacityCopy = capacitySignals.length > 0
    ? joinFrenchList(capacitySignals)
    : "un espace confortable, facile à vivre et agréable à retrouver après une journée dehors";
  const capacityForInterior = capacitySignals.length > 0
    ? `de ${joinFrenchList(capacitySignals)}`
    : "d’un espace confortable, facile à vivre et agréable à retrouver après une journée dehors";
  const locationText = location ? ` à ${location}` : "";
  const localCopy =
    generationStyle === "booking_style"
      ? nearbyHighlights.length > 0
        ? nearbyHighlights.join(" ")
        : location
          ? `À retenir — proximité : ${location}. Accès et déplacements : repères simples pour organiser les sorties.`
          : "À retenir — cadre pratique pour organiser le séjour, avec des repères clairs dès l’installation."
      : nearbyHighlights.length > 0
        ? nearbyHighlights.join(" ")
        : location
          ? `Vous profitez d’un point de départ pratique pour découvrir ${location}, rejoindre les adresses du secteur et organiser vos déplacements simplement.`
          : "Vous profitez d’un cadre pratique pour organiser vos journées facilement, avec des repères simples pour vous installer et profiter du séjour.";
  const amenitiesSentence = joinFrenchList(amenitiesForCopy.slice(0, 6));
  const servicesSentence = joinFrenchList(servicesForCopy.slice(0, 4));
  const gs = generationStyle;
  const variantAngles = [
    {
      hook:
        gs === "airbnb"
          ? `Profitez d’un séjour confortable${locationText}, dans un logement pensé pour se sentir rapidement à l’aise.`
          : `Séjour${locationText} : logement clair, confort immédiat, informations utiles pour décider et réserver sereinement.`,
      mood: "chaleureuse et reposante",
      intro:
        gs === "airbnb"
          ? "Dès l’arrivée, l’ambiance invite à ralentir : un espace agréable, des repères simples et tout ce qu’il faut pour savourer le séjour sans complication."
          : "Dès l’entrée dans les lieux : repères lisibles, équipements identifiés, organisation pensée pour une installation rapide et une lecture simple du logement.",
      guest: "les voyageurs qui recherchent du confort, de la simplicité et une expérience fluide",
      mainFocus: "la détente, le confort quotidien et la sensation de se sentir chez soi",
    },
    {
      hook:
        gs === "airbnb"
          ? `Posez vos valises dans un pied-à-terre pratique${locationText}, idéal pour profiter du secteur en toute simplicité.`
          : `Pied-à-terre fonctionnel${locationText} : espaces structurés, autonomie au quotidien, idéal pour enchaîner visites et déplacements.`,
      mood: "fonctionnelle et fluide",
      intro:
        gs === "airbnb"
          ? "Tout est organisé pour faciliter le séjour : des espaces faciles à comprendre, des équipements utiles et une expérience pensée pour gagner du temps dès l’arrivée."
          : "Parcours du séjour optimisé : pièces et équipements identifiables en un coup d’œil, pour gagner du temps dès l’arrivée.",
      guest: "les couples, familles ou voyageurs en déplacement qui veulent un séjour facile à organiser",
      mainFocus: "la praticité, l’autonomie et la clarté des espaces",
    },
    {
      hook:
        gs === "airbnb"
          ? `Séjournez dans un lieu agréable${locationText}, avec une vraie sensation de repère dès les premières minutes.`
          : `Adresse pratique${locationText} : confort essentiel, lecture rapide du quartier et des accès.`,
      mood: "locale et rassurante",
      intro:
        gs === "airbnb"
          ? "Le séjour se vit autour d’un logement confortable, d’un environnement pratique et de petites attentions qui rendent chaque journée plus simple."
          : "Infos clés sur le logement et le secteur : vous cadrer vite sur les déplacements, les commerces et les points d’intérêt utiles.",
      guest: "les voyageurs qui veulent profiter du lieu, du quartier et d’un cadre facile à vivre",
      mainFocus: "l’expérience locale, les repères du secteur et le confort de retour au logement",
    },
    {
      hook:
        gs === "airbnb"
          ? `Choisissez un logement clair, confortable et facile à vivre, conçu pour rendre le séjour simple du début à la fin.`
          : `Logement clair et confortable : essentiels regroupés, séjour prévisible du check-in au départ.`,
      mood: "claire et soignée",
      intro:
        gs === "airbnb"
          ? "Le lieu réunit les essentiels d’un séjour réussi : confort, autonomie, équipements pratiques et accompagnement simple lorsque vous en avez besoin."
          : "Synthèse utile pour comparer et valider : confort, autonomie, équipements et modalités d’accès présentés de façon directe.",
      guest: "les voyageurs qui comparent plusieurs hébergements et veulent réserver avec confiance",
      mainFocus: "la réassurance, la facilité d’usage et le confort sans mauvaise surprise",
    },
    {
      hook:
        gs === "airbnb"
          ? `Offrez-vous une parenthèse agréable${locationText}, dans un espace pensé pour conjuguer confort, autonomie et sérénité.`
          : `Confort et sérénité${locationText} : espace structuré, équipements utiles, séjour orienté tranquillité et efficacité.`,
      mood: "naturelle et soignée",
      intro:
        gs === "airbnb"
          ? "Le séjour commence avec des repères simples : un espace accueillant, des équipements utiles et une organisation qui laisse plus de place au plaisir du voyage."
          : "Priorité aux repères concrets : installation simple, équipements listés, organisation qui facilite le quotidien sur place.",
      guest: "les voyageurs attentifs aux détails, au confort quotidien et à la qualité de l’accueil",
      mainFocus: "une expérience plus douce, plus premium et plus agréable à vivre",
    },
  ];

  const buildSections = (angle: (typeof variantAngles)[number]) => {
    const logement = [
      "🏡 Le logement",
      `À l’intérieur, vous disposez ${capacityForInterior}. Les espaces sont pensés pour s’installer facilement, poser ses affaires, se reposer et profiter d’un cadre confortable au quotidien.`,
      `Équipements dans le logement : ${amenitiesSentence}.`,
      interiorHighlights.length > 0
        ? interiorHighlights.join(" ")
        : "Le séjour s’organise autour d’un espace simple à vivre, avec des zones utiles pour dormir, se détendre, préparer ses repas et garder ses affaires à portée de main.",
    ].join("\n\n");

    const logementDetaille = [
      "✨ Logement détaillé",
      `Les espaces intérieurs permettent de garder un rythme naturel pendant le séjour : dormir confortablement, se préparer, cuisiner, ranger ses effets personnels et profiter de moments calmes entre deux sorties.`,
      `La configuration autour de ${capacityCopy} aide à comprendre rapidement l’organisation du bien. Chaque zone garde une fonction concrète, sans détour inutile, pour faciliter l’installation et l’usage quotidien.`,
      `Le confort repose notamment sur ${amenitiesSentence}. Ces éléments rendent le logement plus pratique à vivre et apportent des repères clairs dès les premières minutes sur place.`,
    ].join("\n\n");

    const acces = [
      "🔑 Accès des voyageurs",
      `Les voyageurs ont accès aux espaces prévus pour leur séjour ainsi qu’aux équipements utiles du logement : ${amenitiesSentence}. L’installation reste simple, avec une organisation pensée pour prendre possession des lieux rapidement et sereinement.`,
      `Les pièces principales, les couchages, les espaces de rangement et les équipements du quotidien restent disponibles pendant le séjour selon la configuration indiquée.`,
      serviceLabels.some((item) => /arrivée autonome/i.test(item))
        ? "L’arrivée autonome facilite l’accès au logement et permet de s’organiser avec plus de souplesse."
        : `Les services comme ${servicesSentence} accompagnent l’arrivée et rendent l’expérience plus fluide.`,
    ].join("\n\n");

    const echanges = [
      "💬 Échanges avec les voyageurs",
      "Je reste disponible avant votre arrivée pour répondre aux questions importantes, partager les indications utiles et vous aider à préparer votre séjour dans de bonnes conditions.",
      "Pendant votre séjour, vous pouvez me contacter simplement si vous avez besoin d’une précision, d’un conseil pratique ou d’un accompagnement ponctuel.",
      "Vous profitez du logement en autonomie, avec la tranquillité de pouvoir obtenir une réponse claire lorsque c’est nécessaire.",
    ].join("\n\n");

    const autresInfos = [
      "ℹ️ Autres informations à noter",
      ruleHighlights.length > 0
        ? ruleHighlights.join(" ")
        : "Les indications pratiques sont partagées avant l’arrivée pour faciliter l’installation et organiser le séjour sereinement.",
      `Services pratiques disponibles : ${servicesSentence}.`,
      "Pensez à consulter les consignes transmises avant votre venue afin de préparer l’arrivée, le départ et les besoins courants du séjour.",
    ].join("\n\n");

    const bookingMain = [
      ...(generationStyle === "booking_style"
        ? [
            "Pour votre réservation : repères rapides — équipement, localisation et organisation du séjour.",
            "",
          ]
        : []),
      angle.hook,
      "",
      angle.intro,
      "",
      generationStyle === "booking_style"
        ? `En pratique : ambiance ${angle.mood}, profil idéal ${angle.guest}. Priorité — ${angle.mainFocus}.`
        : `Entre confort, autonomie et repères faciles, le séjour se déroule dans une atmosphère ${angle.mood}. Le lieu convient particulièrement à ${angle.guest}, avec une expérience centrée sur ${angle.mainFocus}.`,
      "",
      generationStyle === "booking_style"
        ? `Point de chute pour organiser les journées, se reposer, puis repartir avec des repères clairs sur place.`
        : `Vous profitez d’un point de chute agréable pour organiser vos journées, faire une pause au calme et retrouver un vrai confort en rentrant.`,
      "",
      generationStyle === "booking_style"
        ? `Équipements : ${amenitiesSentence}. Confort concret pour séjours courts ou déplacements — détente, escapade ou voyage professionnel.`
        : `${amenitiesSentence} apportent un confort concret au quotidien et rendent le séjour plus fluide, que vous voyagiez pour quelques jours de détente, une escapade locale ou un déplacement pratique.`,
      "",
      sourceHighlights.length > 0
        ? sourceHighlights.join(" ")
        : "L’espace se prête aussi bien à un court séjour qu’à quelques jours de pause, avec une atmosphère agréable et facile à vivre.",
      "",
      `${localCopy}`,
      "",
      `Les voyageurs disposent des espaces prévus pour leur séjour et peuvent utiliser les équipements mis à disposition. L’arrivée reste fluide, les repères sont simples, et les services comme ${servicesSentence} accompagnent l’organisation avant et pendant la venue.`,
      "",
      "Je reste disponible pour partager les indications utiles, répondre aux questions importantes et vous aider à profiter du séjour sereinement. Vous gardez votre autonomie sur place, avec un contact simple si vous avez besoin d’un conseil ou d’une précision.",
    ].join("\n");

    return { bookingMain, logement, logementDetaille, acces, echanges, autresInfos };
  };

  return variantAngles.map((angle) => {
    const sections = buildSections(angle);
    const sourceBase = sourceHighlights.length > 0 ? `${sourceHighlights[0]} ` : "";
    const airbnbMain = limitText(
      generationStyle === "airbnb"
        ? `${angle.hook} ${sourceBase}${capacitySignals.length > 0 ? `${joinFrenchList(capacitySignals)}. ` : ""}Équipements clés : ${amenitiesSentence}. ${location ? `Secteur : ${location}. ` : ""}${angle.intro}`
        : `${angle.hook} ${sourceBase}${capacitySignals.length > 0 ? `${joinFrenchList(capacitySignals)} · ` : ""}Confort & équipements : ${amenitiesSentence}. ${location ? `Lieu · ${location} · ` : ""}${angle.intro}`,
      500
    );
    const bookingMain = limitText(sections.bookingMain, 1500);

    return {
      main: bookingMain,
      mainAirbnb: airbnbMain,
      mainBooking: bookingMain,
      logement: sections.logement,
      logementDetaille: sections.logementDetaille,
      acces: sections.acces,
      echanges: sections.echanges,
      autresInfos: sections.autresInfos,
    };
  });
}

function pickVerifiedAmenityLabelsForOptimizedTitle(
  amenities: string[] | null | undefined
): string[] {
  const list = Array.isArray(amenities) ? amenities : [];
  const amenityGroups = [
    { label: "Wi‑Fi", pattern: /wi[\s-]?fi|internet/i },
    { label: "climatisation", pattern: /clim|air ?condition/i },
    { label: "piscine", pattern: /piscine|pool/i },
    { label: "parking", pattern: /parking|garage/i },
    { label: "cuisine équipée", pattern: /cuisine|kitchen|four|micro-ondes|microondes|plaques|cafetière|coffee/i },
    { label: "TV", pattern: /\btv\b|télé|television/i },
    { label: "terrasse ou balcon", pattern: /terrasse|balcon|patio|outdoor/i },
    { label: "lave-linge", pattern: /lave[- ]linge|washer|washing/i },
    { label: "espace de travail", pattern: /bureau|workspace|desk/i },
  ];
  return amenityGroups
    .filter(({ pattern }) => list.some((item) => pattern.test(item)))
    .map(({ label }) => label);
}

function frenchPropertyKindForTitle(title: string, description: string) {
  const source = `${normalizeSentence(title)} ${normalizeSentence(description)}`.toLowerCase();
  if (/studio|studette/.test(source)) return "Studio";
  if (/\b(appart|apartment|flat|f\d|t\d)\b/.test(source)) return "Appartement";
  if (/(villa|maison|house|cottage|gîte|gite)/.test(source)) return "Maison";
  if (/\bloft\b/.test(source)) return "Loft";
  if (/(chambre|private room|\broom\b)/.test(source)) return "Chambre";
  return "Logement";
}

function readGuestCapacityHint(title: string, description: string): string | null {
  const sourceText = `${normalizeSentence(title)} ${normalizeSentence(description)}`;
  const match = /(\d+)\s*(?:voyageurs?|personnes?|guests?)/i.exec(sourceText);
  if (!match?.[1]) return null;
  const n = Number.parseInt(match[1], 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `${n} voyageur${n > 1 ? "s" : ""}`;
}

const OPTIMIZED_TITLE_AIRBNB_MAX = 50;
const OPTIMIZED_TITLE_BOOKING_MAX = 95;
const OPTIMIZED_TITLE_AIRBNB_FILL_MIN = 30;

function shortenLocationForOptimizedTitle(value: string, maxLen: number) {
  const s = normalizeSentence(value);
  if (!s) return "";
  const first = s.split(/[,·]/)[0]?.trim() ?? s;
  if (first.length <= maxLen) return first;
  return `${first.slice(0, Math.max(0, maxLen - 1))}…`;
}

function shortPropertyKindLabel(kind: string) {
  if (kind === "Appartement") return "Appart";
  if (kind === "Logement") return "Lieu";
  return kind;
}

function amenityCompactLabel(label: string) {
  const l = label.toLowerCase();
  if (l.includes("terrasse") || l.includes("balcon")) return "balcon";
  if (l.includes("cuisine")) return "cuisine";
  if (l.includes("wi")) return "Wi‑Fi";
  if (l.includes("piscine")) return "piscine";
  if (l.includes("parking")) return "parking";
  if (l.includes("climat")) return "clim";
  if (l.includes("lave")) return "lave-linge";
  if (l.includes("travail") || l.includes("bureau")) return "bureau";
  if (/\btv\b|télé/i.test(label)) return "TV";
  return limitText(label.replace(/\s+/g, " ").trim(), 11);
}

function limitAirbnbTitle(value: string) {
  const t = normalizeSentence(value).replace(/\s+/g, " ").trim();
  if (t.length <= OPTIMIZED_TITLE_AIRBNB_MAX) return t;
  const cut = t.slice(0, OPTIMIZED_TITLE_AIRBNB_MAX);
  const sp = cut.lastIndexOf(" ");
  const base = sp > 18 ? cut.slice(0, sp) : cut;
  return base.replace(/[·,\s]+$/g, "").trim();
}

function limitBookingTitle(value: string) {
  return limitText(normalizeSentence(value).replace(/\s+/g, " ").trim(), OPTIMIZED_TITLE_BOOKING_MAX);
}

function enrichAirbnbTitleDensity(value: string, extraTokens: string[]) {
  let out = limitAirbnbTitle(value);
  for (const tok of extraTokens) {
    if (!tok || out.includes(tok)) continue;
    const cand = `${out} · ${tok}`;
    if (cand.length <= OPTIMIZED_TITLE_AIRBNB_MAX) {
      out = cand;
    }
    if (out.length >= OPTIMIZED_TITLE_AIRBNB_FILL_MIN) break;
  }
  return out;
}

/**
 * Titre d’exemple aligné sur la plateforme affichée (`aiPlatform`) et l’index de variante
 * (même modulo que `currentAiVariant` dans `buildAirbnbDescriptionVariants`).
 */
function buildOptimizedTitleExample(options: {
  title?: string | null;
  location?: string | null;
  amenities?: string[] | null;
  description?: string | null;
  displayPlatform: "airbnb" | "booking";
  variantIndex: number;
  variantCount: number;
  fallbackSuggestedTitle: string;
}): string {
  const title = normalizeSentence(options.title);
  const location = normalizeSentence(options.location);
  const description = normalizeSentence(options.description);
  const verified = pickVerifiedAmenityLabelsForOptimizedTitle(options.amenities);
  const a1 = verified[0] ?? null;
  const a2 = verified[1] ?? null;
  const c1 = a1 ? amenityCompactLabel(a1) : null;
  const c2 = a2 ? amenityCompactLabel(a2) : null;
  const propertyKind = frenchPropertyKindForTitle(title, description);
  const spk = shortPropertyKindLabel(propertyKind);
  const cap = readGuestCapacityHint(title, description);
  const count = Math.max(1, options.variantCount);
  const idx = ((options.variantIndex % count) + count) % count;

  const locAir = shortenLocationForOptimizedTitle(location, 16);
  const locBook = shortenLocationForOptimizedTitle(location, 44);
  const locPhraseAir = locAir ? ` · ${locAir}` : "";
  const locPhraseBook = locBook ? ` à ${locBook}` : "";

  const extraPool = [c1, c2, cap ? (cap.length > 16 ? cap.replace(/voyageurs?/i, "pers.") : cap) : null].filter(
    (x): x is string => Boolean(x)
  );

  if (options.displayPlatform === "airbnb") {
    const angleTokens: string[][] = [
      [c1 || "cosy", c2 || cap || "lumineux"],
      [cap || c1 || "fluide", c2 || "autonome"],
      [c1 || "bien placé", locAir || c2 || "quartier"],
      [c1 || "clair", c2 || cap || "rassurant"],
      [c1 || "doux", c2 || cap || "zen"],
    ];
    const pool = [...new Set([...extraPool, ...(angleTokens[idx] ?? []).filter(Boolean)])] as string[];

    let raw = "";
    switch (idx) {
      case 0:
        raw = `${spk} cosy${locPhraseAir}${pool[0] ? ` · ${pool[0]}` : ""}${pool[1] ? ` · ${pool[1]}` : ""}`;
        break;
      case 1:
        raw = `Pied-à-terre net${locPhraseAir}${pool[0] ? ` · ${pool[0]}` : ""}${pool[1] ? ` · ${pool[1]}` : ""}`;
        break;
      case 2:
        raw = `${spk} top emplacement${locPhraseAir}${pool[0] ? ` · ${pool[0]}` : ""}`;
        break;
      case 3:
        raw = `${spk} tout confort${locPhraseAir}${pool[0] ? ` · ${pool[0]}` : ""}${pool[1] ? ` · ${pool[1]}` : ""}`;
        break;
      case 4:
      default:
        raw = `Halte douce${locPhraseAir}${pool[0] ? ` · ${pool[0]}` : ""}${pool[1] ? ` · ${pool[1]}` : ""}`;
        break;
    }

    raw = normalizeSentence(raw).replace(/\s+/g, " ").trim();
    let out = limitAirbnbTitle(raw);
    out = enrichAirbnbTitleDensity(out, pool.filter((t) => !out.includes(t)));

    if (out.length < OPTIMIZED_TITLE_AIRBNB_FILL_MIN) {
      out = enrichAirbnbTitleDensity(out, ["séjour fluide", "calme", "bien équipé"]);
    }
    out = limitAirbnbTitle(out);

    if (out.length >= 24) {
      return out;
    }

    const fb = limitAirbnbTitle(options.fallbackSuggestedTitle);
    if (fb.length >= 12) {
      return limitAirbnbTitle(enrichAirbnbTitleDensity(fb, extraPool));
    }

    const seed = title ? sentenceCase(title.split(/\s+/).slice(0, 3).join(" ")) : spk;
    const angleWord = idx === 0 ? "cosy" : idx === 1 ? "pratique" : idx === 2 ? "central" : idx === 3 ? "clair" : "serein";
    return limitAirbnbTitle(`${seed} · ${angleWord}${locPhraseAir} · accueil`);
  }

  let raw = "";
  switch (idx) {
    case 0:
      raw = `Séjour chaleureux${locPhraseBook} — ${propertyKind.toLowerCase()} soigné${c1 ? `, ${c1}` : ""}${c2 ? ` et ${c2}` : ""}${cap ? `, ${cap}` : ""}`;
      break;
    case 1:
      raw = `Pied-à-terre pratique${locPhraseBook} pour voyageurs actifs : ${propertyKind.toLowerCase()}${c1 ? ` avec ${c1}` : " bien équipé"}${c2 ? `, ${c2}` : ""}${cap ? `, jusqu’à ${cap}` : ""}`;
      break;
    case 2:
      raw = `Adresse centrale${locPhraseBook} — ${propertyKind.toLowerCase()} lumineux${c1 ? `, ${c1}` : ""}${c2 ? `, ${c2}` : ""}, idéal pour explorer le quartier`;
      break;
    case 3:
      raw = `Hébergement clair et fiable${locPhraseBook} : ${propertyKind.toLowerCase()} rangé${c1 ? `, ${c1}` : ""}${c2 ? `, ${c2}` : ""}${cap ? ` (${cap})` : ""}, informations utiles dès l’annonce`;
      break;
    case 4:
    default:
      raw = `Expérience sereine${locPhraseBook} — ${propertyKind.toLowerCase()} pensé pour le confort${c1 ? ` (${c1})` : ""}${c2 ? `, ${c2}` : ""}${cap ? `, capacité ${cap}` : ""}`;
      break;
  }

  raw = normalizeSentence(raw).replace(/\s+/g, " ").trim();
  let out = limitBookingTitle(raw);

  if (out.length >= 28) {
    return out;
  }

  const fb = normalizeSentence(options.fallbackSuggestedTitle);
  if (fb.length >= 12) {
    return limitBookingTitle(fb);
  }

  const angleHint =
    idx === 0
      ? "confort et accueil"
      : idx === 1
        ? "autonomie et clarté"
        : idx === 2
          ? "emplacement et découverte"
          : idx === 3
            ? "transparence et équipements"
            : "sérénité et confort";
  return limitBookingTitle(
    `Hébergement${locPhraseBook} — ${angleHint} pour vos voyageurs · ${propertyKind.toLowerCase()}`
  );
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
      return "Signal favorable";
    default:
      return "Dans la moyenne du marché";
  }
}

function lqiLabelText(label?: string) {
  switch (label) {
    case "market_leader":
      return "Signal haut";
    case "strong_performer":
      return "Signal favorable";
    case "competitive":
      return "Signal favorable";
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
  [/add a clear and descriptive title/gi, "ajoutez un titre précis et descriptif"],
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
  const [aiPlatform, setAiPlatform] = useState<"airbnb" | "booking">("booking");
  const [editableAiDescription, setEditableAiDescription] = useState("");
  const aiDescriptionTextareaRef = useRef<HTMLTextAreaElement | null>(null);

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

  const aiGenerationStyle = useMemo(
    () => deduceAiGenerationStyle(listing?.source_platform),
    [listing?.source_platform]
  );

  const payload: Partial<AuditResult> = audit?.result_payload ?? {};
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
    impact: AuditActionImpact,
    orderIndex: number
  ): AuditActionItem => {
    const [rawTitle, ...rawDescriptionParts] = text.split(":");
    const parsedDescription = rawDescriptionParts.join(":").trim();
    const hasStructuredLegacyText = Boolean(rawTitle.trim() && parsedDescription);

    return {
      id: `${impact}-${orderIndex}`,
      title: hasStructuredLegacyText
        ? rawTitle.trim()
        : impact === "high"
          ? aiGenerationStyle === "airbnb"
            ? `Levier critique ${orderIndex} · différenciation & émotion`
            : `Action critique ${orderIndex} · impact & clarté`
          : impact === "medium"
            ? aiGenerationStyle === "airbnb"
              ? `Priorité ${orderIndex} · narration & attractivité`
              : `Action prioritaire ${orderIndex} · réassurance & décision`
            : aiGenerationStyle === "airbnb"
              ? `Amélioration ${orderIndex} · confort d’accueil`
              : `Amélioration ${orderIndex} · lisibilité & preuves`,
      description: hasStructuredLegacyText ? parsedDescription : text,
      impact,
      priority: impact,
      source: "legacy_recommendations",
      orderIndex,
    };
  };

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
  const isAuditActionItem = (item: AuditActionItem | null): item is AuditActionItem =>
    Boolean(item);
  const normalizeActionImpact = (value: unknown): AuditActionImpact =>
    value === "high" || value === "medium" || value === "low" ? value : "medium";
  const normalizeActionObject = (
    item: unknown,
    index: number,
    fallbackSource: string
  ): AuditActionItem | null => {
    if (!item || typeof item !== "object") return null;
    const action = item as {
      id?: unknown;
      title?: unknown;
      description?: unknown;
      impact?: unknown;
      priority?: unknown;
      category?: unknown;
      reason?: unknown;
      source?: unknown;
      orderIndex?: unknown;
    };
    const title = typeof action.title === "string" ? action.title.trim() : "";
    const description =
      typeof action.description === "string" ? action.description.trim() : "";

    if (!title && !description) return null;

    return {
      id: typeof action.id === "string" ? action.id : `${fallbackSource}-${index + 1}`,
      title: title || `Amélioration ${index + 1}`,
      description,
      impact: normalizeActionImpact(action.impact),
      priority: normalizeActionImpact(action.priority),
      category: typeof action.category === "string" ? action.category : undefined,
      reason:
        typeof action.reason === "string" && action.reason.trim()
          ? action.reason.trim()
          : null,
      source:
        typeof action.source === "string" && action.source.trim()
          ? action.source.trim()
          : fallbackSource,
      orderIndex:
        typeof action.orderIndex === "number" ? action.orderIndex : index + 1,
    };
  };
  const structuredActionObjects = Array.isArray(payload.actions)
    ? payload.actions
        .map((item, index) => normalizeActionObject(item, index, "action_plan"))
        .filter(isAuditActionItem)
    : [];
  const legacyImprovementObjects = Array.isArray(payload.improvements)
    ? payload.improvements
        .map((item, index) => normalizeActionObject(item, index, "legacy_improvements"))
        .filter(isAuditActionItem)
    : [];
  const improvementStrings = pickStringArray(
    structuredRecommendations?.improvements,
    legacyRecommendationList
  );
  const improvements =
    structuredActionObjects.length > 0
      ? structuredActionObjects
      : legacyImprovementObjects.length > 0
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
      ? "Cet indice propose une lecture estimative de la qualité perçue, du positionnement local et du potentiel de conversion."
      : "Cet indicateur s’affichera dès que les signaux de qualité et de marché seront suffisamment renseignés.");
  const estimatedImpactHeadline =
    impactSummary ||
    bookingLiftSummary ||
    revenueImpactSummary ||
    "Les estimations seront affinées dès que le rapport disposera de signaux suffisamment fiables.";
  const estimatedImpactDetail =
    revenueImpactSummary ||
    bookingLiftSummary ||
    (bookingLiftHigh > 0
      ? `Le scénario central suggère un potentiel estimé de +${bookingLiftLow.toFixed(
          0
        )}% à +${bookingLiftHigh.toFixed(0)}% de réservations après optimisation.`
      : "Aucune projection exploitable n’est disponible à ce stade.");
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
      ? "Le positionnement reste une indication à consolider, faute de volume exact de comparables."
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
        )}), mais le repère marché reste partiel.`
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
        generationStyle: aiGenerationStyle,
        missingAmenities: localizedMissingAmenities,
      }),
    [
      aiGenerationStyle,
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
      mainAirbnb: "",
      mainBooking: "",
      logement: "",
      logementDetaille: "",
      acces: "",
      echanges: "",
      autresInfos: "",
    };
  const aiDescription =
    (aiPlatform === "airbnb" ? currentAiVariant.mainAirbnb : currentAiVariant.mainBooking) ||
    currentAiVariant.main;
  const currentAiVariantIndex =
    aiDescriptionVariants.length > 0
      ? (generationSeed % aiDescriptionVariants.length) + 1
      : 0;

  const aiBookingStyleSourceLabel = useMemo(
    () => detectAiDescriptionBookingStyleSourceLabel(listing?.source_platform),
    [listing?.source_platform]
  );

  useEffect(() => {
    const sourcePlatform = normalizeSentence(listing?.source_platform).toLowerCase();

    if (sourcePlatform.includes("airbnb")) {
      setAiPlatform("airbnb");
    } else if (
      sourcePlatform.includes("booking") ||
      sourcePlatform.includes("expedia") ||
      sourcePlatform.includes("agoda") ||
      sourcePlatform.includes("vrbo") ||
      sourcePlatform.includes("abritel")
    ) {
      setAiPlatform("booking");
    }
  }, [listing?.source_platform]);

  useEffect(() => {
    setEditableAiDescription(aiDescription);
  }, [aiDescription]);

  useEffect(() => {
    const textarea = aiDescriptionTextareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [editableAiDescription]);

  const textSuggestions = useMemo(() => {
    const raw = buildTextSuggestions({
      title: listing?.title ?? undefined,
      city: locationLabel ?? null,
    });
    return flavorTextSuggestionsForAiStyle(raw, aiGenerationStyle);
  }, [aiGenerationStyle, listing?.title, locationLabel]);

  const optimizedTitleExample = useMemo(
    () =>
      buildOptimizedTitleExample({
        title: listing?.title ?? null,
        location: locationLabel ?? null,
        amenities: listing?.amenities ?? null,
        description: listing?.description ?? null,
        displayPlatform: aiPlatform,
        variantIndex:
          aiDescriptionVariants.length > 0 ? generationSeed % aiDescriptionVariants.length : 0,
        variantCount: aiDescriptionVariants.length,
        fallbackSuggestedTitle: textSuggestions.suggestedTitle,
      }),
    [
      aiPlatform,
      aiDescriptionVariants.length,
      generationSeed,
      listing?.amenities,
      listing?.description,
      listing?.title,
      locationLabel,
      textSuggestions.suggestedTitle,
    ]
  );

  const photoSuggestions = useMemo(() => {
    const raw = buildPhotoSuggestions({
      title: listing?.title ?? undefined,
      description: suggestedOpening,
    });
    return flavorPhotoSuggestionsForAiStyle(raw, aiGenerationStyle);
  }, [aiGenerationStyle, listing?.title, suggestedOpening]);

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
    reason:
      typeof item.reason === "string" ? localizeGeneratedText(item.reason) : item.reason,
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
      note: "Les visuels semblent contribuer à la qualité perçue de l’annonce.",
      fallback: "Lecture visuelle à confirmer avec davantage de signaux exploitables.",
    },
    {
      label: "Ordre des photos",
      value: photoOrder,
      note: "L’ordre actuel des visuels semble offrir une lecture lisible.",
      fallback: "Lecture de séquence à préciser avec davantage de signaux visuels.",
    },
    {
      label: "Description",
      value: descriptionQuality,
      note: "Le message apparaît globalement clair sur la base du contenu visible.",
      fallback: "La clarté du message reste à préciser avec un contenu mieux qualifié.",
    },
    {
      label: "Équipements",
      value: amenitiesCompleteness,
      note: "Les équipements détectés suggèrent une base d’information assez fournie.",
      fallback: "Lecture des équipements à consolider avec les données visibles de l’annonce.",
    },
    {
      label: "SEO",
      value: seoStrength,
      note: "Les signaux SEO visibles suggèrent une base d’optimisation exploitable.",
      fallback: "Lecture SEO à préciser avec davantage de signaux extraits.",
    },
    {
      label: "Conversion",
      value: conversionStrength,
      note: "Les signaux disponibles suggèrent un potentiel de progression de la conversion.",
      fallback: "Potentiel de conversion à préciser avec des signaux plus renseignés.",
    },
  ];
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
    aiGenerationStyle === "airbnb"
      ? "Lecture basée sur les signaux visibles : la base invite à renforcer l’émotion, l’hospitalité et la singularité de l’annonce."
      : "Lecture basée sur les signaux visibles : la base permet d’optimiser clarté, réassurance et conversion.";
  const lqiComponentNotes = {
    listing:
      lqiListingQuality !== null
        ? lqiListingQuality >= 75
          ? "Les signaux visibles suggèrent une qualité perçue plutôt favorable."
          : "Les éléments visibles suggèrent une qualité perçue encore perfectible."
        : "La qualité perçue sera précisée dès qu’un score consolidé sera disponible.",
    market:
      lqiMarketCompetitiveness !== null
        ? lqiMarketCompetitiveness >= 75
          ? "Les comparables disponibles suggèrent un positionnement plutôt favorable."
          : "La lecture marché suggère un positionnement encore perfectible."
        : "La lecture marché sera précisée dès que la comparaison sera consolidée.",
    conversion:
      lqiConversionPotential !== null
        ? lqiConversionPotential >= 75
          ? "Les signaux actuels suggèrent un potentiel de conversion favorable."
          : "Les signaux actuels indiquent un potentiel dépendant d’optimisations ciblées."
        : "Le potentiel de conversion sera précisé dès qu’il pourra être calculé proprement.",
  };
  const actionPlanIntro =
    localizedImprovements.length > 0
      ? aiGenerationStyle === "airbnb"
        ? `Cette vue regroupe les leviers par priorité pour renforcer l’attractivité, l’hospitalité et la mise en scène de votre annonce.`
        : `Cette vue regroupe les améliorations par priorité pour clarifier l’offre, rassurer le voyageur et accélérer la décision.`
      : aiGenerationStyle === "airbnb"
        ? "Les actions seront structurées ici pour soutenir narration, différenciation et envie de séjour."
        : "Les actions seront structurées ici dès qu’un plan d’amélioration détaillé sera disponible.";
  const prioritizedActionsIntro =
    localizedImprovements.length > 0
      ? aiGenerationStyle === "airbnb"
        ? `Liste des recommandations générées, ordonnée pour progresser du plus différenciant au plus structurant.`
        : `Liste des recommandations générées, ordonnée pour maximiser clarté, réassurance et conversion.`
      : "Aucune action prioritaire n’a encore été remontée dans cet audit.";
  const prioritizedActionsSubline =
    aiGenerationStyle === "airbnb"
      ? "Une séquence pour renforcer l’émotion, l’unicité et l’envie de réserver."
      : "Une séquence pour livrer vite des infos utiles, rassurantes et actionnables.";
  const strengthsFallbackText =
    resolvedStrengths[0] ||
    insights[0] ||
    localizedTargetVsMarketPosition ||
    (aiGenerationStyle === "airbnb"
      ? "Aucun point fort structuré n’a encore été remonté — pensez storytelling, accueil et ce qui vous distingue."
      : "Aucun point fort structuré n’a encore été remonté — pensez preuves, clarté et réassurance.");
  const weaknessesFallbackText =
    resolvedWeaknesses[0] ||
    insights[0] ||
    impactSummary ||
    (aiGenerationStyle === "airbnb"
      ? "Aucun point faible structuré n’a encore été remonté — identifiez ce qui freine l’envie de séjour."
      : "Aucun point faible structuré n’a encore été remonté — identifiez ce qui bloque la décision ou la confiance.");

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
      await navigator.clipboard.writeText(editableAiDescription);
      setCopyToastKey("main");
    } catch (error) {
      console.warn("Failed to copy content", error);
      setActionToast("Impossible de copier le contenu pour le moment.");
    }
  };

  const handleCopyAiSection = async (key: AiTextSectionKey, value: string) => {
    if (!value.trim()) {
      setActionToast("Aucun texte à copier pour le moment.");
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopyToastKey(key);
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
  const aiCardCopyButtonClass =
    "inline-flex h-6 shrink-0 items-center gap-1 rounded-full border border-slate-200/80 bg-white/75 px-2 text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.08)] transition hover:bg-white";
  const aiScrollBase =
    "mt-4 max-h-[220px] overflow-y-auto whitespace-pre-line pr-2 text-[11px] leading-5 text-slate-800 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full";
  const aiScrollAmber =
    `${aiScrollBase} [scrollbar-color:rgba(245,158,11,0.72)_rgba(254,243,199,0.78)] [&::-webkit-scrollbar-track]:bg-amber-100/70 [&::-webkit-scrollbar-thumb]:bg-amber-400/70 hover:[&::-webkit-scrollbar-thumb]:bg-amber-500/80`;
  const aiScrollIndigo =
    `${aiScrollBase} [scrollbar-color:rgba(99,102,241,0.72)_rgba(224,231,255,0.78)] [&::-webkit-scrollbar-track]:bg-indigo-100/70 [&::-webkit-scrollbar-thumb]:bg-indigo-400/70 hover:[&::-webkit-scrollbar-thumb]:bg-indigo-500/80`;
  const aiScrollSky =
    `${aiScrollBase} [scrollbar-color:rgba(14,165,233,0.72)_rgba(224,242,254,0.78)] [&::-webkit-scrollbar-track]:bg-sky-100/70 [&::-webkit-scrollbar-thumb]:bg-sky-400/70 hover:[&::-webkit-scrollbar-thumb]:bg-sky-500/80`;
  const aiScrollEmerald =
    `${aiScrollBase} [scrollbar-color:rgba(16,185,129,0.72)_rgba(209,250,229,0.78)] [&::-webkit-scrollbar-track]:bg-emerald-100/70 [&::-webkit-scrollbar-thumb]:bg-emerald-400/70 hover:[&::-webkit-scrollbar-thumb]:bg-emerald-500/80`;
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
  const sectionBody = "space-y-5 md:space-y-6";
  const cardSoft = `relative overflow-hidden ${radiusCard} ${borderSoft} ${surfaceNeutral} ${cardGlow} ${shadowMini} ring-1 ring-white/60`;
  const cardPadCompact = "p-4";
  const cardTitle =
    "text-[8px] font-semibold uppercase tracking-[0.16em] text-slate-700 [letter-spacing:0.02em]";
  const detailCard =
    `nk-card nk-card-hover relative flex h-full min-w-0 overflow-hidden flex-col ${radiusCard} border border-l-4 border-slate-200/75 border-l-sky-300/80 ${surfaceSlate} ${cardGlow} p-4 ${shadowEmphasis}`;
  const detailInnerCard = `relative overflow-hidden ${radiusCard} border border-slate-200/70 ${surfaceCool} ${cardGlow} p-4 shadow-[0_14px_32px_rgba(15,23,42,0.06),0_1px_0_rgba(255,255,255,0.66)_inset] ring-1 ring-white/60`;
  const detailCardLabel =
    "text-[8px] font-semibold uppercase tracking-[0.18em] text-slate-800 [letter-spacing:0.02em]";
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

      <div className={`nk-card nk-card-hover nk-page-header-card relative overflow-hidden ${radiusContainer} border border-slate-300/75 bg-[radial-gradient(circle_at_0_0,rgba(16,185,129,0.14),transparent_34%),radial-gradient(circle_at_88%_10%,rgba(251,146,60,0.12),transparent_30%),linear-gradient(135deg,#ffffff_0%,#f8fafc_46%,#eef6f3_100%)] ${cardGlow} py-8 ${shadowExecutive} md:grid md:grid-cols-12 md:items-start md:gap-7 md:py-10 xl:gap-7 transition-shadow hover:shadow-[0_32px_80px_rgba(16,185,129,0.12),0_10px_30px_rgba(15,23,42,0.08)]`}>
        <div className="space-y-3 md:col-span-7 xl:col-span-8 xl:max-w-4xl">
          <p className="nk-kicker-muted inline-flex rounded-full border border-slate-200/80 bg-white/75 px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.06),0_1px_0_rgba(255,255,255,0.65)_inset]">
            LECTURE BUSINESS
          </p>
          <h1 className="nk-page-title max-w-4xl bg-gradient-to-r from-amber-500 via-orange-400 to-yellow-400 bg-clip-text text-transparent !text-transparent [-webkit-text-fill-color:transparent] drop-shadow-[0_1px_0_rgba(255,255,255,0.9)]">
            Où votre annonce perd des réservations et ce que vous pouvez gagner
          </h1>
          <p className="nk-page-subtitle max-w-3xl text-[13px] leading-6 text-slate-700">
            {heroImpactSupport}
          </p>
          <div className="grid items-stretch gap-6 sm:grid-cols-3">
            <div className={`min-w-0 overflow-hidden ${kpiCard} h-full border border-l-4 border-slate-200/80 border-l-sky-500/75 !bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(239,246,255,0.92)_100%)] shadow-[0_14px_38px_rgba(30,64,175,0.09),0_1px_0_rgba(255,255,255,0.70)_inset] transition-shadow hover:shadow-[0_20px_52px_rgba(30,64,175,0.13),0_1px_0_rgba(255,255,255,0.74)_inset]`}>
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
            <div className={`min-w-0 overflow-hidden ${kpiCardEmphasis} h-full border border-l-4 border-emerald-200/80 border-l-emerald-500/85 !bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(220,252,231,0.94)_100%)] shadow-[0_16px_44px_rgba(16,185,129,0.14),0_1px_0_rgba(255,255,255,0.70)_inset] transition-shadow hover:shadow-[0_24px_64px_rgba(16,185,129,0.19),0_1px_0_rgba(255,255,255,0.74)_inset]`}>
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
            <div className={`min-w-0 overflow-hidden ${kpiCard} h-full border border-l-4 border-amber-200/75 border-l-amber-500/85 !bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.16),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,247,237,0.93)_100%)] shadow-[0_14px_38px_rgba(180,83,9,0.10),0_1px_0_rgba(255,255,255,0.70)_inset] transition-shadow hover:shadow-[0_20px_52px_rgba(180,83,9,0.14),0_1px_0_rgba(255,255,255,0.74)_inset]`}>
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
                  className={`nk-primary-btn ${radiusPill} border border-blue-500/30 bg-[linear-gradient(135deg,#3b82f6_0%,#06b6d4_52%,#7c3aed_100%)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white shadow-[0_14px_30px_rgba(59,130,246,0.30),0_1px_0_rgba(255,255,255,0.16)_inset] transition hover:brightness-110`}
                >
                  Analyser une autre annonce
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex w-full flex-col items-stretch gap-6 md:col-span-5 md:mt-0 md:max-w-none md:pl-0 xl:col-span-4 xl:pl-1">
          <div className={`relative min-w-0 overflow-hidden ${radiusCard} border border-l-4 border-emerald-200/80 border-l-emerald-500/75 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.08),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(236,253,245,0.95)_100%)] ${cardGlow} px-5 py-5 text-right ${shadowExecutive} shadow-[0_22px_60px_rgba(16,185,129,0.16),0_1px_0_rgba(255,255,255,0.7)_inset]`}>
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
              <span className={`inline-flex items-center ${radiusPill} border border-slate-300/85 bg-slate-50/90 px-2.5 py-1 font-semibold text-slate-700 ${shadowMini}`}>
                {revenueImpactHigh > 0 ? `${revenueImpactDisplay}/mois` : revenueImpactDisplay}
              </span>
            </div>
            <div className="mt-6 text-left text-[8px] font-medium uppercase tracking-[0.08em] text-slate-700">
              Score de conversion
            </div>
            <div className="mt-6 w-full rounded-full bg-slate-200/80">
              <div
                className={`h-2 rounded-full ${scoreBarColor}`}
                style={{ width: `${scorePercent}%` }}
              />
            </div>
            <div className="mt-2 text-sm text-muted-foreground leading-relaxed space-y-2">
              <p>
                Les signaux visibles suggèrent une base favorable, avec des marges sur clarté et confiance.
              </p>
              <ul className="space-y-1">
                <li>• Positionnement à surveiller</li>
                <li>• Offre potentiellement favorable</li>
              </ul>
            </div>
          </div>

          <div className={`relative min-w-0 overflow-hidden ${radiusCard} border border-l-4 border-slate-200/80 border-l-teal-400/75 bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.10),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(241,245,249,0.94)_100%)] ${cardGlow} px-5 py-5 text-right ${shadowMini} shadow-[0_14px_40px_rgba(30,64,175,0.10),0_1px_0_rgba(255,255,255,0.66)_inset]`}>
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
            <div className="mt-6 text-left text-[8px] font-medium uppercase tracking-[0.08em] text-slate-700">
              Réservations estimées après optimisation
            </div>
            <div className="mt-6 w-full rounded-full bg-slate-200/80">
              <div
                className={`h-2 rounded-full ${potentialBarColor}`}
                style={{ width: `${Math.max(0, Math.min(100, bookingLiftHigh))}%` }}
              />
            </div>
            <div className="mt-2 text-sm text-muted-foreground leading-relaxed space-y-2">
              <p>
                Les signaux disponibles suggèrent un potentiel d’amélioration via le contenu et les signaux de confiance.
              </p>
              <ul className="space-y-1">
                <li>• Impact marché dépendant</li>
                <li>• Peut être amplifié par les visuels</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <section className={sectionShell}>
        <div className={sectionBody}>
          <div className="grid gap-7 xl:grid-cols-12">
            <div className={`nk-card nk-card-hover relative overflow-hidden ${radiusContainer} border border-l-4 border-slate-300/80 border-l-emerald-400/80 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_34%),linear-gradient(135deg,#ffffff_0%,#f8fafc_50%,#eef7f2_100%)] ${cardGlow} p-6 ${shadowStandard} xl:col-span-7 transition-shadow hover:shadow-[0_24px_64px_rgba(16,185,129,0.10)]`}>
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-slate-700">
                    Niveau de conversion global
                  </p>
                  <h2 className={sectionTitle}>
                    {scoreOverviewTitle}
                  </h2>
                  <p className={`${sectionIntro} whitespace-pre-line`}>
                    {scoreOverviewText}
                  </p>
                </div>
                <div className={`relative overflow-hidden ${radiusCard} border border-emerald-200/80 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.13),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(236,253,245,0.92)_100%)] ${cardGlow} px-5 py-4 text-right ${shadowMini}`}>
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
  className={`relative overflow-hidden ${radiusCard} border border-slate-200/65 ${metricSurfaceClass(item.value)} ${item.label === "Photos" ? "!bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(239,246,255,0.92)_100%)]" : item.label === "Ordre des photos" ? "!bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.14),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(238,242,255,0.92)_100%)]" : item.label === "Description" ? "!bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.14),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(245,243,255,0.92)_100%)]" : item.label === "Équipements" ? "!bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(236,253,245,0.92)_100%)]" : item.label === "SEO" ? "!bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.14),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(236,254,255,0.92)_100%)]" : "!bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.14),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,247,237,0.92)_100%)]"} ${cardGlow} ${shadowMini} border-l-4 ${item.label === "Photos" ? "border-l-blue-500/75" : item.label === "Ordre des photos" ? "border-l-indigo-500/75" : item.label === "Description" ? "border-l-violet-500/75" : item.label === "Équipements" ? "border-l-emerald-500/75" : item.label === "SEO" ? "border-l-cyan-500/75" : "border-l-orange-500/75"} p-3.5 ring-1 ring-white/70 transition-shadow hover:shadow-[0_20px_48px_rgba(15,23,42,0.10),0_1px_0_rgba(255,255,255,0.72)_inset]`}
>
                    <div className="flex items-start justify-between gap-5">
                      <p className={kpiLabel}>{item.label}</p>
                      <span className={`${pillBaseClass} shadow-[0_8px_18px_rgba(15,23,42,0.06)] ring-1 ring-white/55 ${scoreBadgeClass(item.value)}`}>
                        {item.value !== null ? `${item.value}/10` : "À confirmer"}
                      </span>
                    </div>
                    <p className={`mt-6 hidden text-[12px] font-medium tracking-tight opacity-85 md:text-[13px] ${scoreValueClass(
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

            <div className={`nk-card nk-card-hover relative overflow-hidden ${radiusContainer} border border-l-4 border-slate-200/80 border-l-sky-400/80 ${surfaceSlate} !bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.16),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(240,249,255,0.92)_100%)] ${cardGlow} p-6 ${shadowStandard} xl:col-span-5 transition-shadow hover:shadow-[0_24px_64px_rgba(30,64,175,0.12)]`}>
              <p className={cardTitle}>
                Positionnement sur le marché
              </p>
              <h2 className="mt-6 text-[16px] font-semibold tracking-[-0.02em] text-slate-900 md:text-[18px]">
                Comment votre annonce se situe
              </h2>
              <p className="mt-6 max-w-2xl text-[11px] leading-5 text-slate-800">
                Une lecture issue des signaux disponibles pour situer l’annonce face aux offres comparables
                et éclairer les arbitrages de conversion.
              </p>
              <div className="mt-6 grid gap-5">
                <div className={`min-w-0 overflow-hidden ${kpiCardMini} border border-l-4 border-slate-200/75 border-l-slate-400/75 !bg-[radial-gradient(circle_at_top_left,rgba(148,163,184,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(241,245,249,0.92)_100%)] shadow-[0_14px_34px_rgba(15,23,42,0.08),0_1px_0_rgba(255,255,255,0.68)_inset]`}>
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
                  <div className={`min-w-0 overflow-hidden ${kpiCardMini} border border-l-4 border-sky-200/75 border-l-sky-500/75 !bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.16),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(239,246,255,0.92)_100%)] shadow-[0_14px_34px_rgba(30,64,175,0.09),0_1px_0_rgba(255,255,255,0.68)_inset]`}>
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
                  <div className={`min-w-0 overflow-hidden ${kpiCardMini} border border-l-4 border-emerald-200/75 border-l-emerald-500/75 !bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.15),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(236,253,245,0.9)_100%)] shadow-[0_14px_34px_rgba(16,185,129,0.10),0_1px_0_rgba(255,255,255,0.68)_inset]`}>
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

          <div className={`nk-card nk-card-hover relative overflow-hidden ${radiusContainer} border border-l-4 border-slate-300/80 border-l-slate-800/85 bg-[radial-gradient(circle_at_top_left,rgba(15,23,42,0.12),transparent_34%),radial-gradient(circle_at_92%_18%,rgba(99,102,241,0.12),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.13),transparent_28%),linear-gradient(135deg,#ffffff_0%,#f8fafc_42%,#eef4f3_100%)] ${cardGlow} p-6 ${shadowExecutive}`}>
            <div className="grid gap-5 md:grid-cols-12 md:items-start">
              <div className={`flex min-h-[230px] flex-col justify-between space-y-4 ${radiusCard} border border-l-4 border-slate-200/75 border-l-slate-700/75 bg-[radial-gradient(circle_at_top_left,rgba(15,23,42,0.08),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.08),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.86)_0%,rgba(248,250,252,0.66)_100%)] p-4 shadow-[0_16px_40px_rgba(15,23,42,0.07),0_1px_0_rgba(255,255,255,0.70)_inset] md:col-span-5 xl:col-span-5 xl:max-w-xl`}>
                <p className="nk-kicker-muted inline-flex w-fit rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.06),0_1px_0_rgba(255,255,255,0.65)_inset]">
                  INDICATEUR BUSINESS
                </p>
                <div className="flex flex-wrap items-baseline gap-5">
                  <h2 className="text-[14px] font-semibold tracking-tight text-slate-950 md:text-[16px]">
                    Qualité perçue de l’annonce
                  </h2>
                  {listingQualityIndex?.label ? (
                    <span className={`inline-flex items-center ${radiusPill} border border-slate-300/85 bg-white/85 px-3 py-1 text-[8px] font-semibold uppercase tracking-[0.1em] text-slate-700 ${shadowMini}`}>
                      {lqiLabelText(listingQualityIndex.label)}
                    </span>
                  ) : (
                    <span className={`inline-flex items-center ${radiusPill} border border-amber-200/85 bg-amber-50/80 px-3 py-1 text-[8px] font-semibold uppercase tracking-[0.1em] text-amber-700 ${shadowMini}`}>
                      {lqiLabelDisplay}
                    </span>
                  )}
                </div>
                <p className={`rounded-2xl border border-slate-200/75 bg-white/70 p-3 text-[11px] leading-5 text-slate-700 shadow-[0_12px_28px_rgba(15,23,42,0.055),0_1px_0_rgba(255,255,255,0.68)_inset]`}>
                  {lqiSummaryText}
                </p>
              </div>

              <div className="mt-6 flex min-w-0 flex-col gap-5 md:col-span-7 md:mt-0 md:max-w-none xl:col-span-7">
                <div className={`relative min-w-0 overflow-hidden ${radiusCard} border border-slate-700/70 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(148,163,184,0.18),transparent_28%),linear-gradient(180deg,#0f172a_0%,#1e293b_54%,#263449_100%)] bg-clip-padding ring-1 ring-white/10 before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:bg-[linear-gradient(180deg,rgba(255,255,255,0.18),transparent)] after:pointer-events-none after:absolute after:inset-x-6 after:top-0 after:h-px after:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.34),transparent)] px-5 py-4 text-right text-slate-50 ${shadowExecutive}`}>
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
                  <div className={`min-w-0 overflow-hidden ${kpiCardMini} border border-l-4 border-indigo-200/75 border-l-indigo-500/75 !bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.13),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(238,242,255,0.92)_100%)] text-left shadow-[0_14px_34px_rgba(79,70,229,0.09),0_1px_0_rgba(255,255,255,0.68)_inset]`}>
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

                  <div className={`min-w-0 overflow-hidden ${kpiCardMini} border border-l-4 border-emerald-200/75 border-l-emerald-500/75 !bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(236,253,245,0.92)_100%)] text-left shadow-[0_14px_34px_rgba(16,185,129,0.09),0_1px_0_rgba(255,255,255,0.68)_inset]`}>
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

                  <div className={`min-w-0 overflow-hidden ${kpiCardMini} border border-l-4 border-amber-200/75 border-l-amber-500/80 !bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.15),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,247,237,0.92)_100%)] text-left shadow-[0_14px_34px_rgba(180,83,9,0.09),0_1px_0_rgba(255,255,255,0.68)_inset]`}>
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
          <div className={`nk-card nk-card-hover relative overflow-hidden ${radiusContainer} border border-l-4 border-slate-300/80 border-l-sky-500/80 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.11),transparent_34%),radial-gradient(circle_at_90%_12%,rgba(16,185,129,0.10),transparent_28%),linear-gradient(135deg,#ffffff_0%,#f8fafc_48%,#eef6ff_100%)] ${cardGlow} p-5 ${shadowStandard} transition-shadow hover:shadow-[0_24px_64px_rgba(30,64,175,0.10)]`}>
            <div className="flex items-center justify-between gap-5">
              <div>
                <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-slate-700">
                  Lecture marché
                </p>
                <p className="mt-6 text-[15px] font-semibold tracking-[-0.02em] text-slate-900 md:text-[17px]">
                  Comment votre annonce se situe face à la concurrence
                </p>
                <p className="mt-6 max-w-2xl text-[11px] leading-5 text-slate-800">
                  Repères issus des comparables disponibles pour éclairer le prix, la perception de valeur
                  et les écarts à prioriser.
                </p>
              </div>
            </div>

            <div className={`${grid4} items-stretch`}>
              <div className={`${kpiCard} border border-l-4 border-emerald-200/75 border-l-emerald-500/75 !bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.13),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(236,253,245,0.92)_100%)] shadow-[0_14px_34px_rgba(16,185,129,0.09),0_1px_0_rgba(255,255,255,0.68)_inset]`}>
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

              <div className={`${kpiCard} border border-l-4 border-indigo-200/75 border-l-indigo-500/75 !bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(238,242,255,0.92)_100%)] shadow-[0_14px_34px_rgba(79,70,229,0.09),0_1px_0_rgba(255,255,255,0.68)_inset]`}>
                <p className={kpiLabel}>
                  Concurrents analysés
                </p>
                <p className={`${kpiValue} ${competitorCountValueClass(marketCompetitorCount)}`}>
                  {competitorCountDisplay}
                </p>
                <p className={kpiBody}>
                  {marketCompetitorCount !== null
                    ? "Base concurrentielle utilisée pour cette estimation."
                    : competitorCountSupport}
                </p>
              </div>
              <div className={`${kpiCard} border border-l-4 border-amber-200/75 border-l-amber-500/75 !bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.14),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,251,235,0.92)_100%)] shadow-[0_14px_34px_rgba(180,83,9,0.09),0_1px_0_rgba(255,255,255,0.68)_inset]`}>
                <p className={kpiLabel}>
                  Prix moyen concurrent
                </p>
                <p className={`${kpiValue} text-amber-700`}>
                  {avgCompetitorPriceDisplay}
                </p>
                <p className={kpiBody}>{avgCompetitorPriceSupport}</p>
              </div>
              <div className={`${kpiCard} border border-l-4 border-orange-200/75 border-l-rose-400/75 !bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.14),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,241,242,0.92)_100%)] shadow-[0_14px_34px_rgba(244,63,94,0.08),0_1px_0_rgba(255,255,255,0.68)_inset] ${
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
                <div className={`${cardSoft} ${cardPadCompact} border-l-4 border-rose-200/70 border-l-rose-400/80 !bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.10),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,241,242,0.92)_100%)] shadow-[0_12px_30px_rgba(15,23,42,0.06),0_1px_0_rgba(255,255,255,0.65)_inset]`}>
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

                <div className={`${cardSoft} ${cardPadCompact} border-l-4 border-emerald-200/70 border-l-emerald-500/75 !bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(236,253,245,0.92)_100%)] shadow-[0_12px_30px_rgba(16,185,129,0.07),0_1px_0_rgba(255,255,255,0.65)_inset]`}>
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

          <div className={`nk-card nk-card-hover relative overflow-hidden ${radiusContainer} border !border-l-[5px] border-emerald-200/85 !border-l-emerald-600 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.24),transparent_38%),radial-gradient(circle_at_90%_12%,rgba(14,165,233,0.16),transparent_30%),linear-gradient(135deg,#ecfdf5_0%,#f0f9ff_52%,#dffbea_100%)] ${cardGlow} p-5 ${shadowExecutive}`}>
            <div className="flex flex-col gap-5">
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
            </div>

            <div className="mt-6 grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-4">
              <div className={`nk-card nk-card-hover relative overflow-hidden ${radiusCard} border !border-l-[5px] border-amber-200/85 !border-l-amber-600 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.42),transparent_42%),linear-gradient(180deg,#fde68a_0%,#fcd34d_100%)] ${cardGlow} ${shadowMini} p-4 flex h-full flex-col justify-between ring-1 ring-white/60 transition-shadow hover:shadow-[0_18px_44px_rgba(180,83,9,0.10),0_1px_0_rgba(255,255,255,0.68)_inset]`}>
                <p className={kpiLabel}>
                  Prix actuel
                </p>
                <p className={kpiValue}>{currentPriceDisplay}</p>
                <p className={kpiBody}>
                  {currentPriceContext}
                </p>
              </div>

              <div className={`nk-card nk-card-hover relative overflow-hidden ${radiusCard} border !border-l-[5px] border-sky-200/85 !border-l-sky-600 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.34),transparent_42%),linear-gradient(180deg,#e0f2fe_0%,#bae6fd_100%)] ${cardGlow} ${shadowMini} p-4 flex h-full flex-col justify-between ring-1 ring-white/60 transition-shadow hover:shadow-[0_18px_44px_rgba(14,165,233,0.10),0_1px_0_rgba(255,255,255,0.68)_inset]`}>
                <p className={kpiLabel}>
                  Niveau moyen du marché
                </p>
                <p className={kpiValue}>{marketScoreDisplay}</p>
                <p className={kpiBody}>{marketScoreContext}</p>
              </div>

              <div className={`nk-card nk-card-hover relative overflow-hidden ${radiusCard} border !border-l-[5px] border-emerald-200/85 !border-l-emerald-600 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.34),transparent_42%),linear-gradient(180deg,#d1fae5_0%,#a7f3d0_100%)] ${cardGlow} ${shadowEmphasis} p-4 flex h-full flex-col justify-between ring-1 ring-white/60 transition-shadow hover:shadow-[0_20px_48px_rgba(16,185,129,0.12),0_1px_0_rgba(255,255,255,0.68)_inset]`}>
                <p className={kpiLabel}>
                  Potentiel de réservations
                </p>
                <p className={kpiValue}>{estimatedImpactValueDisplay || bookingLiftRangeDisplay}</p>
                <p className={kpiBody}>
                  {bookingLiftLabel || estimatedImpactDetail}
                </p>
              </div>

              <div className={`nk-card nk-card-hover relative overflow-hidden ${radiusCard} border !border-l-[5px] border-indigo-200/85 !border-l-indigo-600 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.34),transparent_42%),linear-gradient(180deg,#e0e7ff_0%,#c7d2fe_100%)] ${cardGlow} ${shadowMini} p-4 flex h-full flex-col justify-between ring-1 ring-white/60 transition-shadow hover:shadow-[0_18px_44px_rgba(79,70,229,0.10),0_1px_0_rgba(255,255,255,0.68)_inset]`}>
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
          </div>
        </div>
      </section>

      <section className={sectionShell}>
        <div className={sectionBody}>
          <div className="space-y-8">
            <div className={`nk-card relative min-w-0 overflow-hidden ${radiusContainer} border border-l-4 border-amber-200/80 border-l-amber-400/80 ${surfaceEditorial} !bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.16),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,247,237,0.92)_100%)] ${cardGlow} p-4 ${shadowEmphasis}`}>
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

                <div className="relative flex flex-wrap items-center gap-2 sm:gap-3 lg:col-span-5 lg:justify-end xl:col-span-4">
                  <div className={`inline-flex shrink-0 items-center gap-1 ${radiusPill} border border-amber-200/85 bg-white/75 p-1 shadow-[0_10px_22px_rgba(180,83,9,0.06),0_1px_0_rgba(255,255,255,0.62)_inset]`}>
                    {(["airbnb", "booking"] as const).map((platform) => (
                      <button
                        key={platform}
                        type="button"
                        onClick={() => setAiPlatform(platform)}
                        className={`inline-flex min-h-[22px] items-center justify-center ${radiusPill} px-2.5 text-[9px] font-semibold uppercase tracking-[0.08em] transition ${
                          aiPlatform === platform
                            ? "bg-slate-900 text-white shadow-[0_8px_18px_rgba(15,23,42,0.12)]"
                            : "text-slate-600 hover:bg-amber-50/80 hover:text-slate-900"
                        }`}
                      >
                        {platform === "airbnb" ? "Airbnb" : "Booking"}
                      </button>
                    ))}
                  </div>
                  {aiBookingStyleSourceLabel != null ? (
                    <span
                      className="inline-flex max-w-[min(100%,240px)] shrink-0 items-center rounded-full border border-amber-200/70 bg-white/65 px-2 py-0.5 text-[8px] font-medium leading-tight tracking-[0.03em] text-slate-600 shadow-[0_6px_14px_rgba(180,83,9,0.05)]"
                      title={`Source détectée : ${aiBookingStyleSourceLabel}`}
                    >
                      {aiBookingStyleSourceLabel} · variante Booking
                    </span>
                  ) : null}
                  <button
                    type="button"
                    aria-label="Copier la description principale"
                    onClick={handleCopyAiDescription}
                    className={aiCardCopyButtonClass}
                  >
                    <svg aria-hidden="true" className="h-3 w-3" viewBox="0 0 16 16" fill="none">
                      <path d="M5.5 5.5H4.25A1.25 1.25 0 0 0 3 6.75v5A1.25 1.25 0 0 0 4.25 13h5A1.25 1.25 0 0 0 10.5 11.75V10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      <path d="M6.25 3h5.5C12.44 3 13 3.56 13 4.25v5.5C13 10.44 12.44 11 11.75 11h-5.5C5.56 11 5 10.44 5 9.75v-5.5C5 3.56 5.56 3 6.25 3Z" stroke="currentColor" strokeWidth="1.4" />
                    </svg>
                    {copyToastKey === "main" ? "Copié" : "Copier"}
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

              <div className="space-y-6 mt-6">
                <div className={`nk-card nk-card-hover relative overflow-hidden ${radiusContainer} border border-l-4 border-sky-200/80 border-l-sky-400/80 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.14),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(240,249,255,0.92)_100%)] ${cardGlow} p-4 ${shadowEmphasis}`}>
                  <div className="grid items-stretch gap-5 md:gap-5 md:grid-cols-2">
                    <div className={`flex h-full min-w-0 overflow-hidden flex-col ${detailInnerCard} border-l-4 !border-amber-200/75 !border-l-amber-500/75 !bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.14),transparent_40%),linear-gradient(180deg,#fffbeb_0%,#fef0c3_100%)]`}>
                      <p className={detailCardLabel}>
                        Titre actuel
                      </p>
                      <p className={`mt-6 break-words ${detailCardTitle}`}>
                        {listing?.title || "Aucun titre n’est disponible pour cette annonce."}
                      </p>
                    </div>

                    <div className={`flex h-full min-w-0 overflow-hidden flex-col ${detailInnerCard} border-l-4 !border-emerald-200/75 !border-l-emerald-500/75 !bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_40%),linear-gradient(180deg,#ecfdf5_0%,#d1fae5_100%)]`}>
                      <p className={detailCardLabel}>
                        Exemple de titre optimisé
                      </p>
                      <p className={`mt-6 break-words ${detailCardTitle}`}>
                        {optimizedTitleExample}
                      </p>
                      <p className={`mt-6 ${detailCardBody}`}>
                        Alignée sur la même variante de description que le texte ci‑dessous, à partir du titre, des infos clés et de la localisation.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className={`relative mt-6 min-w-0 overflow-hidden ${radiusCard} border border-amber-200/70 ${surfaceExecution} ${cardGlow} px-3.5 py-3.5 ${shadowMini} ring-1 ring-white/60`}>
                <textarea
                  ref={aiDescriptionTextareaRef}
                  value={editableAiDescription}
                  onChange={(event) => setEditableAiDescription(event.target.value)}
                  rows={1}
                  spellCheck={false}
                  placeholder="La description IA apparaîtra ici dès que les données d’audit seront disponibles."
                  className="h-auto max-h-[260px] w-full resize-none overflow-y-auto bg-transparent pr-2 text-[11px] leading-5 text-slate-900 outline-none placeholder:text-slate-500 [scrollbar-color:rgba(245,158,11,0.72)_rgba(254,243,199,0.78)] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-amber-100/70 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-amber-400/70 hover:[&::-webkit-scrollbar-thumb]:bg-amber-500/80"
                />
              </div>

              <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-5">
                <div className={`relative h-[280px] min-w-0 overflow-hidden ${radiusCard} border border-l-4 border-amber-200/70 border-l-amber-500/75 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.14),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,247,237,0.92)_100%)] ${cardGlow} px-3.5 py-3 ${shadowMini} ring-1 ring-white/60`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-slate-700">
                      Mon logement
                    </p>
                    <button
                      type="button"
                      aria-label="Copier Mon logement"
                      onClick={() => handleCopyAiSection("logement", currentAiVariant.logement)}
                      className={aiCardCopyButtonClass}
                    >
                      <svg aria-hidden="true" className="h-3 w-3" viewBox="0 0 16 16" fill="none">
                      <path d="M5.5 5.5H4.25A1.25 1.25 0 0 0 3 6.75v5A1.25 1.25 0 0 0 4.25 13h5A1.25 1.25 0 0 0 10.5 11.75V10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      <path d="M6.25 3h5.5C12.44 3 13 3.56 13 4.25v5.5C13 10.44 12.44 11 11.75 11h-5.5C5.56 11 5 10.44 5 9.75v-5.5C5 3.56 5.56 3 6.25 3Z" stroke="currentColor" strokeWidth="1.4" />
                    </svg>
                      {copyToastKey === "logement" ? "Copié" : "Copier"}
                    </button>
                  </div>
                  <div className={aiScrollAmber}>
                    {currentAiVariant.logement || "Installez-vous dans un logement confortable, facile à vivre et pensé pour rendre chaque moment du séjour plus simple."}
                  </div>
                </div>

                <div className={`relative h-[280px] min-w-0 overflow-hidden ${radiusCard} border border-l-4 border-indigo-200/70 border-l-indigo-500/75 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.14),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(238,242,255,0.92)_100%)] ${cardGlow} px-3.5 py-3 ${shadowMini} ring-1 ring-white/60`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-slate-700">
                      Logement (version détaillée)
                    </p>
                    <button
                      type="button"
                      aria-label="Copier Logement version détaillée"
                      onClick={() => handleCopyAiSection("logementDetaille", currentAiVariant.logementDetaille)}
                      className={aiCardCopyButtonClass}
                    >
                      <svg aria-hidden="true" className="h-3 w-3" viewBox="0 0 16 16" fill="none">
                      <path d="M5.5 5.5H4.25A1.25 1.25 0 0 0 3 6.75v5A1.25 1.25 0 0 0 4.25 13h5A1.25 1.25 0 0 0 10.5 11.75V10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      <path d="M6.25 3h5.5C12.44 3 13 3.56 13 4.25v5.5C13 10.44 12.44 11 11.75 11h-5.5C5.56 11 5 10.44 5 9.75v-5.5C5 3.56 5.56 3 6.25 3Z" stroke="currentColor" strokeWidth="1.4" />
                    </svg>
                      {copyToastKey === "logementDetaille" ? "Copié" : "Copier"}
                    </button>
                  </div>
                  <div className={aiScrollIndigo}>
                    {currentAiVariant.logementDetaille || "Le logement offre une expérience complète, avec des espaces lisibles, des équipements utiles et une atmosphère agréable pour profiter du séjour."}
                  </div>
                </div>

                <div className={`relative h-[280px] min-w-0 overflow-hidden ${radiusCard} border border-l-4 border-sky-200/70 border-l-sky-500/75 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.14),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(240,249,255,0.92)_100%)] ${cardGlow} px-3.5 py-3 ${shadowMini} ring-1 ring-white/60`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-slate-700">
                      Accès des voyageurs
                    </p>
                    <button
                      type="button"
                      aria-label="Copier Accès des voyageurs"
                      onClick={() => handleCopyAiSection("acces", currentAiVariant.acces)}
                      className={aiCardCopyButtonClass}
                    >
                      <svg aria-hidden="true" className="h-3 w-3" viewBox="0 0 16 16" fill="none">
                      <path d="M5.5 5.5H4.25A1.25 1.25 0 0 0 3 6.75v5A1.25 1.25 0 0 0 4.25 13h5A1.25 1.25 0 0 0 10.5 11.75V10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      <path d="M6.25 3h5.5C12.44 3 13 3.56 13 4.25v5.5C13 10.44 12.44 11 11.75 11h-5.5C5.56 11 5 10.44 5 9.75v-5.5C5 3.56 5.56 3 6.25 3Z" stroke="currentColor" strokeWidth="1.4" />
                    </svg>
                      {copyToastKey === "acces" ? "Copié" : "Copier"}
                    </button>
                  </div>
                  <div className={aiScrollSky}>
                    {currentAiVariant.acces || "Les voyageurs profitent d’un accès simple au logement, aux espaces prévus pour le séjour et aux équipements utiles au quotidien."}
                  </div>
                </div>

                <div className={`relative h-[280px] min-w-0 overflow-hidden ${radiusCard} border border-l-4 border-emerald-200/70 border-l-emerald-500/75 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(236,253,245,0.92)_100%)] ${cardGlow} px-3.5 py-3 ${shadowMini} ring-1 ring-white/60`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-slate-700">
                      Échanges avec les voyageurs
                    </p>
                    <button
                      type="button"
                      aria-label="Copier Échanges avec les voyageurs"
                      onClick={() => handleCopyAiSection("echanges", currentAiVariant.echanges)}
                      className={aiCardCopyButtonClass}
                    >
                      <svg aria-hidden="true" className="h-3 w-3" viewBox="0 0 16 16" fill="none">
                      <path d="M5.5 5.5H4.25A1.25 1.25 0 0 0 3 6.75v5A1.25 1.25 0 0 0 4.25 13h5A1.25 1.25 0 0 0 10.5 11.75V10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      <path d="M6.25 3h5.5C12.44 3 13 3.56 13 4.25v5.5C13 10.44 12.44 11 11.75 11h-5.5C5.56 11 5 10.44 5 9.75v-5.5C5 3.56 5.56 3 6.25 3Z" stroke="currentColor" strokeWidth="1.4" />
                    </svg>
                      {copyToastKey === "echanges" ? "Copié" : "Copier"}
                    </button>
                  </div>
                  <div className={aiScrollEmerald}>
                    {currentAiVariant.echanges || "Je reste disponible avant et pendant le séjour pour partager les indications utiles et répondre simplement aux questions pratiques."}
                  </div>
                </div>

                <div className={`relative h-[280px] min-w-0 overflow-hidden ${radiusCard} border border-l-4 border-amber-200/70 border-l-amber-500/75 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.14),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,247,237,0.92)_100%)] ${cardGlow} px-3.5 py-3 ${shadowMini} ring-1 ring-white/60`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-slate-700">
                      Autres informations à noter
                    </p>
                    <button
                      type="button"
                      aria-label="Copier Autres informations à noter"
                      onClick={() => handleCopyAiSection("autresInfos", currentAiVariant.autresInfos)}
                      className={aiCardCopyButtonClass}
                    >
                      <svg aria-hidden="true" className="h-3 w-3" viewBox="0 0 16 16" fill="none">
                      <path d="M5.5 5.5H4.25A1.25 1.25 0 0 0 3 6.75v5A1.25 1.25 0 0 0 4.25 13h5A1.25 1.25 0 0 0 10.5 11.75V10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      <path d="M6.25 3h5.5C12.44 3 13 3.56 13 4.25v5.5C13 10.44 12.44 11 11.75 11h-5.5C5.56 11 5 10.44 5 9.75v-5.5C5 3.56 5.56 3 6.25 3Z" stroke="currentColor" strokeWidth="1.4" />
                    </svg>
                      {copyToastKey === "autresInfos" ? "Copié" : "Copier"}
                    </button>
                  </div>
                  <div className={aiScrollAmber}>
                    {currentAiVariant.autresInfos || "Les informations pratiques facilitent l’arrivée, clarifient l’organisation du séjour et aident les voyageurs à profiter du logement sereinement."}
                  </div>
                </div>
              </div>

            </div>
          </div>

          <div className="grid items-stretch gap-5 md:gap-5 xl:grid-cols-12">
            <div className={`nk-card nk-card-hover relative overflow-hidden ${radiusContainer} border border-l-4 border-slate-200/80 border-l-amber-500/80 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.10),transparent_34%),linear-gradient(135deg,#ffffff_0%,#f8fafc_52%,#fff7ed_100%)] ${cardGlow} p-5 xl:col-span-7 ${shadowStandard}`}>
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
                <div className={`relative overflow-hidden ${radiusCard} border border-l-4 border-rose-200/70 border-l-rose-500/75 bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.10),transparent_34%),linear-gradient(180deg,#fffdfd_0%,#fbf0f3_100%)] p-4 ${shadowMini} ring-1 ring-white/60`}>
                  <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-rose-700">
                    Critique
                  </p>
                  <ul className="mt-6 space-y-4 text-[11px] leading-5 text-slate-700">
                    {groupedImprovements.high.length > 0 ? (
                      groupedImprovements.high.map((item, index) => (
                        <li key={item.id ?? `${item.title}-${index}`} className={`relative overflow-hidden ${radiusCard} border border-l-4 border-rose-200/70 border-l-rose-500/75 bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.10),transparent_34%),linear-gradient(180deg,#ffffff_0%,#fff4f6_100%)] ${shadowMini} transition hover:-translate-y-0.5 hover:border-rose-300/75 hover:shadow-[0_18px_40px_rgba(127,29,29,0.08),0_1px_0_rgba(255,255,255,0.64)_inset]`}>
                          <label className="flex items-start gap-5 p-3">
                            <div className="flex-1 space-y-4 peer-checked:line-through">
                              <div className="flex items-center justify-between gap-5">
                                <div>
                                  <p className="text-[12px] font-semibold text-slate-900">{item.title ?? "Amélioration prioritaire"}</p>
                                  {item.reason && (
                                    <p className="mt-2 line-clamp-1 text-[10px] font-medium text-slate-500">
                                      Signal : {item.reason}
                                    </p>
                                  )}
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

                <div className={`relative overflow-hidden ${radiusCard} border border-l-4 border-amber-200/70 border-l-amber-500/75 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.12),transparent_34%),linear-gradient(180deg,#fffdf9_0%,#fff7ed_100%)] p-4 ${shadowMini} ring-1 ring-white/60`}>
                  <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                    Impact moyen
                  </p>
                  <ul className="mt-6 space-y-4 text-[11px] leading-5 text-slate-700">
                    {groupedImprovements.medium.length > 0 ? (
                      groupedImprovements.medium.map((item, index) => (
                        <li key={item.id ?? `${item.title}-${index}`} className={`relative overflow-hidden ${radiusCard} border border-l-4 border-amber-200/70 border-l-amber-500/75 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.11),transparent_34%),linear-gradient(180deg,#ffffff_0%,#fff8ed_100%)] ${shadowMini} transition hover:-translate-y-0.5 hover:border-amber-300/75 hover:shadow-[0_18px_40px_rgba(146,64,14,0.08),0_1px_0_rgba(255,255,255,0.64)_inset]`}>
                          <label className="flex items-start gap-5 p-3">
                            <div className="flex-1 space-y-4 peer-checked:line-through">
                              <div className="flex items-center justify-between gap-5">
                                <div>
                                  <p className="text-[12px] font-semibold text-slate-900">{item.title ?? "Amélioration"}</p>
                                  {item.reason && (
                                    <p className="mt-2 line-clamp-1 text-[10px] font-medium text-slate-500">
                                      Signal : {item.reason}
                                    </p>
                                  )}
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

                <div className={`relative overflow-hidden ${radiusCard} border border-l-4 border-indigo-200/70 border-l-indigo-400/75 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.10),transparent_34%),linear-gradient(180deg,#ffffff_0%,#eef2ff_100%)] p-4 ${shadowMini} ring-1 ring-white/60`}>
                  <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-700">
                    À envisager
                  </p>
                  <ul className="mt-6 space-y-4 text-[11px] leading-5 text-slate-700">
                    {groupedImprovements.low.length > 0 ? (
                      groupedImprovements.low.map((item, index) => (
                        <li key={item.id ?? `${item.title}-${index}`} className={`relative overflow-hidden ${radiusCard} border border-l-4 border-indigo-200/70 border-l-indigo-400/75 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.09),transparent_34%),linear-gradient(180deg,#ffffff_0%,#f1f5ff_100%)] ${shadowMini} transition hover:-translate-y-0.5 hover:border-indigo-300/80 hover:shadow-[0_18px_40px_rgba(15,23,42,0.07),0_1px_0_rgba(255,255,255,0.64)_inset]`}>
                          <label className="flex items-start gap-5 p-3">
                            <div className="flex-1 space-y-4 peer-checked:line-through">
                              <div className="flex items-center justify-between gap-5">
                                <div>
                                  <p className="text-[12px] font-semibold text-slate-900">{item.title ?? "Amélioration complémentaire"}</p>
                                  {item.reason && (
                                    <p className="mt-2 line-clamp-1 text-[10px] font-medium text-slate-500">
                                      Signal : {item.reason}
                                    </p>
                                  )}
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

            <div className={`nk-card nk-card-hover relative overflow-hidden ${radiusContainer} border border-l-4 border-slate-200/80 border-l-orange-500/80 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.15),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,247,237,0.92)_100%)] ${cardGlow} p-5 xl:col-span-5 ${shadowEmphasis}`}>
              <div className="flex items-center justify-between gap-5">
                <div>
                  <p className="text-[15px] font-semibold tracking-[-0.02em] text-slate-900 md:text-[17px]">
                    Actions prioritaires
                  </p>
                  <p className="mt-6 text-[11px] leading-5 text-slate-800">
                    {prioritizedActionsSubline}
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
                        className={`relative overflow-hidden ${radiusCard} border border-l-4 border-amber-200/70 border-l-amber-500/75 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.12),transparent_34%),linear-gradient(180deg,#ffffff_0%,#fff7ed_100%)] ${shadowMini} transition hover:-translate-y-0.5 hover:border-amber-300/80 hover:shadow-[0_18px_40px_rgba(180,83,9,0.10),0_1px_0_rgba(255,255,255,0.66)_inset]`}
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
                                {imp.reason && (
                                  <p className="mt-2 line-clamp-1 text-[10px] font-medium text-slate-500">
                                    Signal : {imp.reason}
                                  </p>
                                )}
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

            <div className={`nk-card nk-card-hover relative overflow-hidden ${radiusContainer} border border-l-4 border-rose-200/80 border-l-rose-500/75 ${surfaceCritical} !bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.14),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,241,242,0.92)_100%)] ${cardGlow} p-5 xl:col-span-12 ${shadowEmphasis}`}>
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
                      className={`relative overflow-hidden ${radiusCard} border border-l-4 border-rose-200/70 border-l-rose-500/75 bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.10),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(244,63,94,0.08),transparent_28%),linear-gradient(180deg,#ffffff_0%,#fff3f5_100%)] p-3 ${shadowMini} ring-1 ring-white/60`}
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
              <div className={`nk-card nk-card-hover relative flex h-full min-w-0 overflow-hidden flex-col ${radiusCard} border border-l-4 border-slate-200/75 border-l-sky-400/80 ${surfaceDiagnostic} !bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.16),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(240,249,255,0.92)_100%)] ${cardGlow} p-4 ${shadowEmphasis}`}>
                <div className={`mb-2 ${detailCardLabel}`}>
                  Détail des leviers
                </div>
                <dl className="space-y-4 text-[12px] leading-5">
                  <div className={`relative overflow-hidden flex items-center justify-between gap-5 ${radiusCard} border border-l-4 border-blue-200/70 border-l-blue-500/75 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(239,246,255,0.92)_100%)] px-3.5 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.055),0_1px_0_rgba(255,255,255,0.64)_inset] ring-1 ring-white/60`}>
                    <dt className="text-slate-900">Qualité des photos</dt>
                    <dd>
                      <span className={`${pillBaseClass} ${scoreBadgeClass(photoQuality)}`}>
                        {photoQuality !== null ? `${photoQuality}/10` : "À confirmer"}
                      </span>
                    </dd>
                  </div>
                  <div className={`relative overflow-hidden flex items-center justify-between gap-5 ${radiusCard} border border-l-4 border-indigo-200/70 border-l-indigo-500/75 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(238,242,255,0.92)_100%)] px-3.5 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.055),0_1px_0_rgba(255,255,255,0.64)_inset] ring-1 ring-white/60`}>
                    <dt className="text-slate-900">Ordre des photos</dt>
                    <dd>
                      <span className={`${pillBaseClass} ${scoreBadgeClass(photoOrder)}`}>
                        {photoOrder !== null ? `${photoOrder}/10` : "À confirmer"}
                      </span>
                    </dd>
                  </div>
                  <div className={`relative overflow-hidden flex items-center justify-between gap-5 ${radiusCard} border border-l-4 border-violet-200/70 border-l-violet-500/75 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(245,243,255,0.92)_100%)] px-3.5 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.055),0_1px_0_rgba(255,255,255,0.64)_inset] ring-1 ring-white/60`}>
                    <dt className="text-slate-900">Qualité de la description</dt>
                    <dd>
                      <span className={`${pillBaseClass} ${scoreBadgeClass(descriptionQuality)}`}>
                        {descriptionQuality !== null ? `${descriptionQuality}/10` : "À confirmer"}
                      </span>
                    </dd>
                  </div>
                  <div className={`relative overflow-hidden flex items-center justify-between gap-5 ${radiusCard} border border-l-4 border-emerald-200/70 border-l-emerald-500/75 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(236,253,245,0.92)_100%)] px-3.5 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.055),0_1px_0_rgba(255,255,255,0.64)_inset] ring-1 ring-white/60`}>
                    <dt className="text-slate-900">Complétude des équipements</dt>
                    <dd>
                      <span className={`${pillBaseClass} ${scoreBadgeClass(amenitiesCompleteness)}`}>
                        {amenitiesCompleteness !== null ? `${amenitiesCompleteness}/10` : "À confirmer"}
                      </span>
                    </dd>
                  </div>
                  <div className={`relative overflow-hidden flex items-center justify-between gap-5 ${radiusCard} border border-l-4 border-cyan-200/70 border-l-cyan-500/75 bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(236,254,255,0.92)_100%)] px-3.5 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.055),0_1px_0_rgba(255,255,255,0.64)_inset] ring-1 ring-white/60`}>
                    <dt className="text-slate-900">Performance SEO</dt>
                    <dd>
                      <span className={`${pillBaseClass} ${scoreBadgeClass(seoStrength)}`}>
                        {seoStrength !== null ? `${seoStrength}/10` : "À confirmer"}
                      </span>
                    </dd>
                  </div>
                  <div className={`relative overflow-hidden flex items-center justify-between gap-5 ${radiusCard} border border-l-4 border-orange-200/70 border-l-orange-500/75 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,247,237,0.92)_100%)] px-3.5 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.055),0_1px_0_rgba(255,255,255,0.64)_inset] ring-1 ring-white/60`}>
                    <dt className="text-slate-900">Performance de conversion</dt>
                    <dd>
                      <span className={`${pillBaseClass} ${scoreBadgeClass(conversionStrength)}`}>
                        {conversionStrength !== null ? `${conversionStrength}/10` : "À confirmer"}
                      </span>
                    </dd>
                  </div>
                </dl>
              </div>

              <div className={`nk-card nk-card-hover relative flex h-full min-w-0 overflow-hidden flex-col ${radiusCard} border !border-l-[5px] border-emerald-200/80 !border-l-emerald-600 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.36),transparent_42%),linear-gradient(180deg,#d1fae5_0%,#a7f3d0_100%)] ${cardGlow} p-4 ${shadowEmphasis}`}>
                <div className={`mb-2 ${detailCardLabel}`}>
                  Points forts
                </div>
                <ul className={`${detailCardList} list-disc pl-4 text-slate-800 marker:text-emerald-500 marker:font-semibold`}>
                  {resolvedStrengths.length > 0 ? (
                    localizedStrengths.slice(0, 5).map((item, index) => <li key={index}>{item}</li>)
                  ) : (
                    <li className={detailCardBody}>{strengthsFallbackText}</li>
                  )}
                </ul>
              </div>

              <div className={`nk-card nk-card-hover relative flex h-full min-w-0 overflow-hidden flex-col ${radiusCard} border !border-l-[5px] border-rose-200/80 !border-l-rose-500 bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.36),transparent_42%),linear-gradient(180deg,#ffe4e6_0%,#fda4af_100%)] ${cardGlow} p-4 ${shadowEmphasis}`}>
                <div className={`mb-2 ${detailCardLabel}`}>
                  Points faibles
                </div>
                <ul className={`${detailCardList} list-disc pl-4 text-slate-800 marker:text-amber-500 marker:font-semibold`}>
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
              <div className={`nk-card nk-card-hover relative flex h-full min-w-0 overflow-hidden flex-col ${radiusCard} border !border-l-[5px] border-rose-200/75 !border-l-rose-500 bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.34),transparent_42%),linear-gradient(180deg,#ffe4e6_0%,#fecdd3_100%)] ${cardGlow} p-4 ${shadowEmphasis}`}>
                <p className={detailCardLabel}>
                  Principaux écarts vs marché
                </p>
                <ul className={`mt-6 ${detailCardList} marker:text-rose-500 marker:font-semibold`}>
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

              <div className={`nk-card nk-card-hover relative flex h-full min-w-0 overflow-hidden flex-col ${radiusCard} border !border-l-[5px] border-emerald-200/75 !border-l-emerald-600 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.34),transparent_42%),linear-gradient(180deg,#d1fae5_0%,#a7f3d0_100%)] ${cardGlow} p-4 ${shadowEmphasis}`}>
                <p className={detailCardLabel}>
                  Principaux avantages vs marché
                </p>
                <ul className={`mt-6 ${detailCardList} marker:text-emerald-500 marker:font-semibold`}>
                  {localizedCompetitorAdvantages.length > 0 ? (
                    localizedCompetitorAdvantages.slice(0, 5).map((advantage, index) => (
                      <li key={`${advantage}-${index}`} className="ml-4 list-disc">
                        {advantage}
                      </li>
                    ))
                  ) : (
                    <li className={detailCardBody}>
                      Aucun avantage net identifié pour le moment.
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid items-stretch gap-5 md:gap-5 md:grid-cols-2">
              <div className={`relative ${detailCard} !border-l-[5px] !border-amber-200/75 !border-l-amber-600 !bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.12),transparent_40%),linear-gradient(180deg,#fffef9_0%,#fef6e4_100%)]`}>
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

              <div className={`${detailCard} !border-l-[5px] !border-indigo-200/75 !border-l-indigo-600 !bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.23),transparent_40%),linear-gradient(180deg,#eef2ff_0%,#e0e7ff_100%)]`}>
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
            <div className={`nk-card nk-card-hover relative flex h-full min-w-0 overflow-hidden flex-col ${radiusCard} border !border-l-[5px] border-amber-200/80 !border-l-amber-600 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.32),transparent_42%),linear-gradient(180deg,#fef3c7_0%,#fde68a_100%)] ${cardGlow} p-4 ${shadowEmphasis}`}>
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

          <div className={`relative flex flex-col gap-5 overflow-hidden ${radiusContainer} border border-l-4 border-slate-200/80 border-l-blue-500/80 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.10),transparent_28%),linear-gradient(135deg,#ffffff_0%,#f8fafc_52%,#eff6ff_100%)] ${cardGlow} p-5 ${shadowExecutive} md:flex-row md:items-center md:justify-between`}>
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
                className="rounded-lg border border-blue-500/30 bg-[linear-gradient(135deg,#3b82f6_0%,#06b6d4_52%,#7c3aed_100%)] px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white shadow-[0_14px_32px_rgba(59,130,246,0.30),0_1px_0_rgba(255,255,255,0.16)_inset] transition hover:brightness-110"
              >
                Relancer un audit
              </Link>
              <Link
                href="/dashboard/audits"
                className="text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-700 underline-offset-4 hover:underline"
              >
                Retour aux audits
              </Link>
              <Link
                href="/dashboard/listings"
                className="text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-700 underline-offset-4 hover:underline"
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
