"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildMarketPositionSummary } from "@/ai/marketPosition";
import { buildPhotoSuggestions } from "@/lib/recommendations/buildPhotoSuggestions";
import { buildTextSuggestions } from "@/lib/recommendations/buildTextSuggestions";
import { buildActionPlan } from "@/lib/recommendations/buildActionPlan";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getOrCreateWorkspaceForUser } from "@/lib/workspaces/ensureWorkspaceForUser";
import { getWorkspacePlan } from "@/lib/billing/getWorkspacePlan";
import type { PricingBusinessInsight } from "@/lib/audits/businessInsights";
import { deriveMarketReliabilityFromComparableCount } from "@/lib/audits/marketReliability";
import { useTranslation } from "@/components/i18n/useTranslation";


const auditDetailCopy = {
  en: {
    loading: "Loading audit report...",
    loadingWait: "Please wait while the report loads.",
    notFound: "This audit could not be found. Launch a new analysis from the listings page.",
    copied: "Copied",
    copyAction: "Copy",
    copyUnavailable: "Unable to copy the content right now.",
    copyMainDescription: "Copy main description",
    copyOptimizedTitle: "Copy optimized title",
    copyHousing: "Copy My place",
    copyDetailedHousing: "Copy Detailed place version",
    copyGuestAccess: "Copy Guest access",
    copyGuestInteraction: "Copy Guest interaction",
    copyOtherInfo: "Copy Other information to note",
    copyBookingSummary: "Copy Booking summary",
    bookingSummaryCopied: "Summary copied to clipboard.",
    noBookingSummary: "No summary to copy right now.",
    auditUnavailable: "Audit unavailable",
    auditCompleted: "Audit completed successfully",
    auditCompletedText: "Your listing has been analyzed and can now be optimized.",
    businessReading: "Business reading",
    heroTitle: "Where your listing loses bookings and what you can gain",
    host: "Host",
    hostUnavailableAgoda: "Host unavailable on Agoda",
    listingRating: "Listing rating",
    ratingUnavailable: "Rating unavailable",
    guestReviews: "guest reviews",
    reviewsUnavailable: "Reviews unavailable",
    marketPosition: "Market position",
    businessImpact: "Business impact",
    monthlyGainBenchmark: "Monthly gain benchmark",
    propertyProfile: "Property profile",
    propertyType: "Property type",
    notSpecified: "Not specified",
    bedrooms: "Bedrooms",
    bathrooms: "Bathrooms",
    guests: "Guests",
    beds: "Beds",
    minimumStay: "Minimum stay (nights)",
    marketPositioning: "Market positioning",
    differentiatingAttributes: "Differentiating attributes",
    minimumStay1: "1 night",
    minimumStay2: "2 nights",
    minimumStay3: "3 nights",
    minimumStay5: "5 nights",
    minimumStay7: "7 nights",
    minimumStay14: "14 nights",
    marketTierStandard: "Standard",
    marketTierHighEnd: "High-end",
    marketTierPremium: "Premium",
    marketTierExperientialLuxury: "Experiential luxury",
    marketTierUltraLuxury: "Ultra-luxury",
    attributePrivatePool: "Private pool",
    attributeSeaView: "Sea view",
    attributeBeachfront: "Beachfront",
    attributeJacuzzi: "Jacuzzi",
    attributeParking: "Parking",
    attributeAirConditioning: "Air conditioning",
    attributeWifi: "Wifi",
    attributeGym: "Gym",
    attributeTerrace: "Terrace",
    attributeConcierge: "Concierge",
    comparableWeightingHint: "Comparable weighting — not a strict filter.",
    marketRecalculationOnly: "Market recalculation only — AI analysis and scores unchanged.",
    diagnostic: "Diagnostic…",
    recalibrateMarket: "Recalibrate market",
    premiumMarketInsufficient: "Insufficient premium market",
    marketRecalibrated: "Market recalibrated",
    premiumMarketText: "We analyzed the available comparables, but none are close enough to the selected premium segment. Estimates therefore remain intentionally conservative.",
    recalibratedMarketText: "The competitive segment has been refined using the closest comparable listings.",
    comparablesAnalyzed: "Comparables analyzed",
    premiumComparables: "Premium comparables retained",
    comparablesKept: "Comparables kept",
    recalibratedMedian: "Recalibrated median",
    recalibratedAverage: "Recalibrated average",
    reliability: "Reliability",
    conversionLevel: "Conversion level",
    conversionFragile: "Conversion benchmark: fragile",
    conversionModerate: "Conversion benchmark: moderate",
    conversionStrong: "Conversion benchmark: strong",
    conversionScore: "Conversion score",
    estimatedImpact: "Estimated impact",
    ceiling: "Ceiling",
    impactToConfirm: "Impact to confirm",
    readingWithoutRange: "Reading without % range",
    listingAnalysis: "Listing analysis",
    listingQuality: "Listing quality",
    listingQualityDescription: "Internal analysis of your listing: photos, visual order, description, amenities, SEO and conversion potential.",
    globalConversionLevel: "Overall conversion level",
    realMarket: "Real market",
    observedMarket: "Observed market",
    observedMarketDescription: "Based on retained comparables, observed competitor pricing, market reliability and calculated pricing gap.",
    listingCompetitivePosition: "How your listing compares",
    competitiveSummary: "Synthetic reading of your competitive position based on retained comparable listings.",
    marketPositioningLabel: "Market positioning",
    positioning: "Positioning",
    listingScore: "Listing score",
    market: "Market",
    base: "Base",
    averageCompetitiveQuality: "Average competitive quality",
    localSegment: "Local segment",
    comparedPrices: "Compared prices",
    consolidatedScore: "Consolidated score",
    marketReliability: "Market reliability",
    prioritySummary: "Priority summary",
    topThreeLevers: "Top 3 highest-impact levers",
    actionable: "Actionable",
    strengthenDescription: "Strengthen the description",
    improveSeo: "Improve SEO",
    preserveStrengths: "Preserve current strengths",
    marketPriorityDescriptionOne: "Description score: {score}. Priority: make the promise more concrete and more differentiating.",
    marketPriorityDescriptionTwo: "SEO score: {score}. Add local keywords, strong amenities and sought-after elements.",
    marketPriorityDescriptionThree: "Photos: {photoScore} · Amenities: {amenitiesScore}. These signals already support trust.",
    marketLabelAbove: "Above the competitive level",
    marketLabelBelow: "Below the competitive level",
    marketLabelCompetitive: "In the competitive average",
    marketPositionToConfirm: "Position to confirm",
    marketBenchmarkAbove: "Your listing currently stands {value} points above the observed average score.",
    marketBenchmarkBelow: "Your listing currently stands {value} points below the observed average score.",
    marketBenchmarkAligned: "Your listing is at the average level of the observed comparable listings.",
    marketBenchmarkNone: "No comparable listings were retained for this reading in the observed area.",
    marketBenchmarkOne: "Reading based on 1 comparable listing in your area.",
    marketBenchmarkMany: "Reading based on {count} comparable listings in your area.",
    marketBenchmarkPending: "A local reading will become available once a sufficient volume of comparable listings is observed.",
    marketScoreContextAbove: "Your score clearly exceeds the current market average.",
    marketScoreContextBelow: "Your score remains below the level observed on the market.",
    marketScoreContextAligned: "Your score is perfectly aligned with the market average level.",
    marketScoreContextObserved: "Reading based on observed comparable listings.",
    marketScoreContextMarketBelow: "The market average remains below your current listing level.",
    marketScoreContextMarketAbove: "The market average remains above your current listing level.",
    marketScoreContextMarketAligned: "Your listing and the market stand at a similar level.",
    marketScoreContextUnavailable: "The market average score will be displayed once enough observed listings are available.",
    marketPositionNarrativeCompetitive: "This listing is broadly in line with nearby competitors.",
    heroMarketPositionSupport: "Detailed reference (comparables, relative score, text signals): see the “Market positioning” block.",
    heroImpactSupportOutOfSegment: "Comparables retained outside the pricing segment — business estimates are not reliable for this listing. Only quality and content levers remain usable.",
    heroImpactSupportDefault: "Numerical markers: % for lift and €/month for revenue in “Estimated impact on bookings”; /10 score in the right column.",
    heroImpactSupportCompetitive: "The listing is already competitive. The remaining gains will mainly come from finer adjustments to pricing positioning and value clarity, in order to capture a marginal but real share of additional bookings.",
    heroBusinessLiftHintPrudent: "Prudent projection based on the current price and conversion potential, without a sufficient market pricing base.",
    heroBusinessLiftHintInsufficient: "Market data is insufficient to estimate a reliable quantified impact.",
    heroBusinessLiftHintDefault: "An optimized listing can improve your monthly revenue, depending on the quality of the observed market and the real conversion level.",
    heroRevenueSupportUnavailable: "Estimate unavailable — insufficient market data for this aggregated reading.",
    heroRevenueSupportIndicative: "Indicative estimate based on the recommended price, the observed market level and a realistic target occupancy.",
    heroRevenueSupportPrudent: "Prudent marker: verify booking volume and comparables before making durable pricing decisions.",
    heroRevenueSupportFallback: "Consolidate the listed price and a market benchmark (comparables) to enable a quantified reading.",
    photoBadgeMedium: "{count} photos • fair gallery",
    heroImpactRevenueRange: "+{low} to +{high} / month",
    impactSideCardNarrativeCondensed: "Condensed view: the full % range is in the “{label}” card below.",
    heroScoreNarrativeStrong: "Reading /10: strong level — refine with the report recommendations.",
    marketReliabilityBadgeHigh: "High reliability",
    marketReliabilityBadgeMedium: "Moderate reliability",
    marketReliabilityBadgeLow: "Low reliability",
    marketReliabilityBadgeWeakFallback: "Weak fallback",
    marketReliabilityMessageHigh: "Usable market base with several consistent comparable listings.",
    marketReliabilityMessageMedium: "Indicative market base, still to be consolidated.",
    marketReliabilityMessageLow: "Limited market base: interpret with caution.",
    marketReliabilityMessageWeakFallback: "Fallback market base only: interpret with extra caution.",
    marketComparablesBodyStrong: "Usable competitive base to position your listing within its segment.",
    marketComparablesBodyNone: "No reliable comparable listings were retained for this market reading.",
    marketComparablesBodyLimited: "{base} Reduced sample: useful reading, but still to be consolidated.",
    toConfirm: "to confirm",
    pricingPositioning: "Pricing positioning",
    pricingOpportunity: "Pricing opportunity detected",
    pricingAligned: "Price aligned with the market",
    pricingAboveMedian: "Price above the median",
    observedMedian: "Observed median",
    recommendedPrice: "Recommended price",
    belowMedian: "Below median",
    marketAligned: "Market aligned",
    aboveMedian: "Above median",
    potentialMonthlyGain: "Potential monthly gain",
    estimatedMonthlyRisk: "Estimated monthly risk",
    estimatedMonthlyImpact: "Estimated monthly impact",
    pricingAssumption: "Pricing assumption: 20 nights / month",
    insufficientComparablePricing: "Insufficient data: no reliable comparable to estimate median or pricing impact.",
    insufficientPricingData: "Insufficient market data to estimate reliable pricing impact.",
    pricingBenchmarks: "Pricing benchmarks",
    pricingBenchmarksTitle: "How your price compares with competitors",
    pricingBenchmarksDescription: "Pricing benchmarks based on observed average prices and the estimated gap with the comparable market.",
    averageCompetitorPrice: "Average competitor price",
    priceGapVsMarket: "Price gap vs market",
    notReliable: "Not reliable",
    marketAnalysisPending: "Analysis pending until a sufficient market sample is available.",
    businessProjection: "Business projection",
    projectionsPotential: "Projections & potential",
    projectionsDescription: "Indicative estimates based on market signals, competitive positioning and observed conversion potential.",
    nightlyPrice: "Nightly price",
    premiumPosition: "Premium position",
    aggressivePosition: "Aggressive position",
    balancedPosition: "Balanced position",
    qualitativeAnalysisOnly: "Qualitative analysis only",
    businessPotentialAfterOptimization: "Business potential after optimization",
    projectionBase: "Projection basis",
    crossPlatformReading: "Cross-platform reading",
    readableMarket: "Readable market",
    cautiousReading: "Cautious reading",
    lowVisibility: "Low visibility",
    conversionGainPotential: "Potential conversion gain",
    actionableProjection: "Actionable projection",
    limitedProjection: "Limited projection",
    cautiousProjection: "Cautious projection",
    indicativeProjection: "Indicative projection",
    estimatedMonthlyGainTitle: "Estimated monthly gain",
    optimizedTexts: "Optimized listing texts",
    variant: "Variant",
    changeVariant: "Change variant",
    descriptionCopied: "Description copied",
    currentTitle: "Current title",
    optimizedTitleExample: "Optimized title example",
    myPlace: "My place",
    detailedPlace: "Place — detailed version",
    guestAccess: "Guest access",
    guestInteraction: "Guest interaction",
    otherInfo: "Other information to note",
    bookingDescriptionSummary: "Description summary (Booking)",
    bookingSummaryReady: "Ready-to-paste summary aligned with the displayed variant.",
    actionPlan: "Action plan",
    actionPlanSubtitle: "Projects to launch now, ranked by business impact.",
    businessPriority: "Business priority",
    quickOptimization: "Quick optimization",
    visibility: "Visibility",
    reassurance: "Reassurance",
    improvement: "Improvement",
    photoQuality: "Photo quality",
    photoOrderQuality: "Photo order",
    descriptionQualityLabel: "Description quality",
    amenitiesCompletenessLabel: "Amenities completeness",
    seoPerformance: "SEO performance",
    scoreOverviewTitle: "Detailed reading of your conversion performance",
    scoreOverviewTextAirbnb: "Reading based on visible signals: the foundation invites you to strengthen emotion, hospitality and the uniqueness of the listing.",
    scoreOverviewTextDefault: "Reading based on visible signals: the foundation helps optimize clarity, reassurance and conversion.",
    scoreStatusConfirm: "To confirm",
    scoreStatusPartialData: "Data still partial",
    scoreStatusExcellent: "Excellent",
    scoreStatusExcellentDetail: "Clear competitive advantage",
    scoreStatusStrong: "Strong",
    scoreStatusStrongDetail: "Positive signal to maintain",
    scoreStatusCorrect: "Fair",
    scoreStatusCorrectDetail: "Further optimization possible",
    scoreStatusNeedsWork: "Needs work",
    scoreStatusNeedsWorkDetail: "Visible impact on conversion",
    scoreStatusWeak: "Weak",
    scoreStatusWeakDetail: "Improvement priority",
    subScorePhotosNote: "The visuals create a strong and reassuring first impression. They help travelers quickly understand the quality of the property and reduce hesitation before booking.",
    subScorePhotosFallback: "Not enough photo data to refine this area.",
    subScorePhotosImpact: "Impact: strong on click-through and trust.",
    subScorePhotosPriority: "Priority: maintain this level.",
    subScorePhotoOrderNote: "The photo order highlights the most attractive elements well. The first images should immediately confirm comfort, space and the perceived value of the property.",
    subScorePhotoOrderFallback: "The visual order should be confirmed once the signals are more complete.",
    subScorePhotoOrderImpact: "Impact: improves the first impression.",
    subScorePhotoOrderPriority: "Priority: keep the best spaces first.",
    subScoreDescriptionNote: "The text is solid, but it can do more to sell the real experience: atmosphere, comfort, concrete advantages, access, neighborhood and reasons to choose this property over another.",
    subScoreDescriptionFallback: "Text too limited or not usable enough for a reliable reading here.",
    subScoreDescriptionImpact: "Impact: strengthens traveler projection.",
    subScoreDescriptionPriority: "Priority: make the promise more concrete.",
    subScoreAmenitiesNote: "Visible amenities reinforce the perception of comfort. The more precise and well presented they are, the more they reassure travelers about the quality of the stay.",
    subScoreAmenitiesFallback: "Amenities are not visible enough or not provided: reading to be completed.",
    subScoreAmenitiesImpact: "Impact: reassures on stay comfort.",
    subScoreAmenitiesPriority: "Priority: better present the key amenities.",
    subScoreSeoNote: "SEO is usable, but it can gain precision. The title, local keywords and sought-after amenities should help the platform better understand the listing.",
    subScoreSeoFallback: "Signals are too partial to conclude on this area.",
    subScoreSeoImpact: "Impact: helps the platform rank the listing better.",
    subScoreSeoPriority: "Priority: strengthen the title and useful keywords.",
    subScoreConversionNote: "Conversion potential is good, but there are still levers to activate. Gains will mainly come from a clearer promise, stronger reassurance and more concrete content.",
    subScoreConversionFallback: "Reading to consolidate with additional data.",
    subScoreConversionImpact: "Impact: acts directly on the booking decision.",
    subScoreConversionPriority: "Priority: improve reassurance and clarity.",
    iqaBusinessIndicator: "Business indicator",
    iqaPerceivedListingQuality: "Perceived listing quality",
    iqaReading: "IQA reading",
    iqaNarrativePremium: "Premium reading: the perceived overall level stands strong against the analyzed market.",
    iqaNarrativeCompetitive: "Competitive base is sound with several levers still available.",
    iqaNarrativeFragile: "Quality positioning remains fragile versus the observed competing listings.",
    iqaNarrativeRebuilt: "Reading rebuilt from visible signals and the audit’s overall score.",
    lqiLabelHighSignal: "High signal",
    lqiLabelFavorable: "Favorable signal",
    lqiLabelImproving: "Improving",
    lqiLabelNeedsWork: "Needs strengthening",
    lqiSummaryNoObject: "No LQI object is present in the report: the /100 values are a local synthesis built from the same /10 signals as the rest of the page — an aggregated reading, not a second independent set of measurements.",
    lqiSummaryIndicativeScore: "The main /100 score is indicative: derived from the overall /10 score because no native numeric IQA index is available in the report.",
    lqiSummaryOverview: "Quality / market / conversion overview: under each card — “Report component” = structured field provided; “Local synthesis” = aggregate of the /10 values already on the page; “Report complement” = another field from the report (for example booking potential), not an isolated conversion measure.",
    lqiSummaryPending: "This indicator will appear once the useful signals are available.",
    lqiSummaryCompetitiveButOptimizable: "The listing is competitive, but some visible levers can still improve conversion and positioning, notably by making the value promise more explicit from the first screen.",
    listingConversion: "Listing conversion",
  },
  fr: {
    loading: "Chargement de l’audit…",
    loadingWait: "Merci de patienter pendant le chargement du rapport.",
    notFound: "Cet audit est introuvable. Lancez une nouvelle analyse depuis la page des annonces.",
    copied: "Copié",
    copyAction: "Copier",
    copyUnavailable: "Impossible de copier le contenu pour le moment.",
    copyMainDescription: "Copier la description principale",
    copyOptimizedTitle: "Copier le titre optimisé",
    copyHousing: "Copier Mon logement",
    copyDetailedHousing: "Copier Logement version détaillée",
    copyGuestAccess: "Copier Accès des voyageurs",
    copyGuestInteraction: "Copier Échanges avec les voyageurs",
    copyOtherInfo: "Copier Autres informations à noter",
    copyBookingSummary: "Copier le résumé Booking",
    bookingSummaryCopied: "Résumé copié dans le presse-papiers.",
    noBookingSummary: "Aucun résumé à copier pour le moment.",
    auditUnavailable: "Audit indisponible",
    auditCompleted: "Audit terminé avec succès",
    auditCompletedText: "Votre annonce a été analysée et peut maintenant être optimisée.",
    businessReading: "Lecture business",
    heroTitle: "Où votre annonce perd des réservations et ce que vous pouvez gagner",
    host: "Hôte",
    hostUnavailableAgoda: "Hôte non disponible sur Agoda",
    listingRating: "Note annonce",
    ratingUnavailable: "Note indisponible",
    guestReviews: "avis voyageurs",
    reviewsUnavailable: "Avis indisponibles",
    marketPosition: "Position sur le marché",
    businessImpact: "Impact business",
    monthlyGainBenchmark: "Repère gain mensuel",
    propertyProfile: "Profil du bien",
    propertyType: "Type de bien",
    notSpecified: "Non spécifié",
    bedrooms: "Chambres",
    bathrooms: "Sdb",
    guests: "Voyageurs",
    beds: "Lits",
    minimumStay: "Durée min (nuits)",
    marketPositioning: "Positionnement marché",
    differentiatingAttributes: "Attributs différenciants",
    minimumStay1: "1 nuit",
    minimumStay2: "2 nuits",
    minimumStay3: "3 nuits",
    minimumStay5: "5 nuits",
    minimumStay7: "7 nuits",
    minimumStay14: "14 nuits",
    marketTierStandard: "Standard",
    marketTierHighEnd: "Haut standing",
    marketTierPremium: "Premium",
    marketTierExperientialLuxury: "Luxe expérientiel",
    marketTierUltraLuxury: "Ultra-luxe",
    attributePrivatePool: "Piscine privée",
    attributeSeaView: "Vue mer",
    attributeBeachfront: "Beachfront",
    attributeJacuzzi: "Jacuzzi",
    attributeParking: "Parking",
    attributeAirConditioning: "Climatisation",
    attributeWifi: "Wifi",
    attributeGym: "Gym",
    attributeTerrace: "Terrasse",
    attributeConcierge: "Conciergerie",
    comparableWeightingHint: "Pondération des comparables — pas un filtre strict.",
    marketRecalculationOnly: "Recalcul marché uniquement — analyse IA et scores inchangés.",
    diagnostic: "Diagnostic…",
    recalibrateMarket: "Recalibrer le marché",
    premiumMarketInsufficient: "Marché premium insuffisant",
    marketRecalibrated: "Marché recalibré",
    premiumMarketText: "Nous avons analysé les comparables disponibles, mais aucun n'est suffisamment proche du segment premium sélectionné. Les estimations restent volontairement prudentes.",
    recalibratedMarketText: "Le segment concurrentiel a été affiné à partir des comparables les plus proches.",
    comparablesAnalyzed: "Comparables analysés",
    premiumComparables: "Comparables premium retenus",
    comparablesKept: "Comparables retenus",
    recalibratedMedian: "Médiane recalibrée",
    recalibratedAverage: "Moyenne recalibrée",
    reliability: "Fiabilité",
    conversionLevel: "Niveau de conversion",
    conversionFragile: "Repère conversion : fragile",
    conversionModerate: "Repère conversion : modéré",
    conversionStrong: "Repère conversion : solide",
    conversionScore: "Score de conversion",
    estimatedImpact: "Impact estimé",
    ceiling: "Plafond",
    impactToConfirm: "Impact à confirmer",
    readingWithoutRange: "Lecture sans fourchette %",
    listingAnalysis: "Analyse annonce",
    listingQuality: "Qualité de l’annonce",
    listingQualityDescription: "Lecture des signaux internes de votre fiche : photos, ordre visuel, description, équipements, SEO et capacité de conversion.",
    globalConversionLevel: "Niveau de conversion global",
    realMarket: "Marché réel",
    observedMarket: "Marché observé",
    observedMarketDescription: "Lecture basée sur les comparables retenus, le prix concurrent observé, la fiabilité du marché et l’écart tarifaire calculé.",
    listingCompetitivePosition: "Comment se situe votre annonce",
    competitiveSummary: "Lecture synthétique de votre position concurrentielle à partir des annonces comparables retenues.",
    marketPositioningLabel: "Positionnement sur le marché",
    positioning: "Positionnement",
    listingScore: "Score annonce",
    market: "Marché",
    base: "Base",
    averageCompetitiveQuality: "Qualité concurrentielle moyenne",
    localSegment: "Segment local",
    comparedPrices: "Prix comparés",
    consolidatedScore: "Score consolidé",
    marketReliability: "Fiabilité marché",
    prioritySummary: "Synthèse prioritaire",
    topThreeLevers: "Les 3 leviers à plus fort potentiel",
    actionable: "Actionnable",
    strengthenDescription: "Renforcer la description",
    improveSeo: "Améliorer le référencement",
    preserveStrengths: "Conserver les forces actuelles",
    marketPriorityDescriptionOne: "Score description : {score}. Priorité : rendre la promesse plus concrète et plus différenciante.",
    marketPriorityDescriptionTwo: "Score SEO : {score}. Ajouter des mots-clés locaux, équipements forts et éléments recherchés.",
    marketPriorityDescriptionThree: "Photos : {photoScore} · Équipements : {amenitiesScore}. Ces signaux soutiennent déjà la confiance.",
    marketLabelAbove: "Au-dessus du niveau concurrentiel",
    marketLabelBelow: "En dessous du niveau concurrentiel",
    marketLabelCompetitive: "Dans la moyenne concurrentielle",
    marketPositionToConfirm: "Position à confirmer",
    marketBenchmarkAbove: "Votre annonce se situe actuellement à {value} points au-dessus du score moyen observé.",
    marketBenchmarkBelow: "Votre annonce se situe actuellement à {value} points en dessous du score moyen observé.",
    marketBenchmarkAligned: "Votre annonce se situe au niveau moyen des annonces comparables observées.",
    marketBenchmarkNone: "Aucun comparable n’a été retenu pour cette lecture dans la zone observée.",
    marketBenchmarkOne: "Lecture établie à partir de 1 annonce comparable dans votre zone.",
    marketBenchmarkMany: "Lecture établie à partir de {count} annonces comparables dans votre zone.",
    marketBenchmarkPending: "Lecture locale disponible dès qu’un volume suffisant d’annonces comparables sera observé.",
    marketScoreContextAbove: "Votre score dépasse nettement la moyenne actuelle du marché.",
    marketScoreContextBelow: "Votre score reste sous le niveau observé sur le marché.",
    marketScoreContextAligned: "Votre score est parfaitement aligné avec le niveau moyen du marché.",
    marketScoreContextObserved: "Lecture fondée sur les annonces comparables observées.",
    marketScoreContextMarketBelow: "La moyenne du marché reste inférieure au niveau actuel de votre annonce.",
    marketScoreContextMarketAbove: "La moyenne du marché reste supérieure au niveau actuel de votre annonce.",
    marketScoreContextMarketAligned: "Votre annonce et le marché se situent à un niveau comparable.",
    marketScoreContextUnavailable: "Le score moyen du marché s’affichera dès que suffisamment d’annonces observées seront disponibles.",
    marketPositionNarrativeCompetitive: "Cette annonce se situe globalement dans la moyenne des concurrents proches.",
    heroMarketPositionSupport: "Référence détaillée (comparables, score relatif, textes) : bloc « Positionnement sur le marché ».",
    heroImpactSupportOutOfSegment: "Comparables retenus hors segment tarifaire — estimations business non fiables pour cette annonce. Seuls les axes qualité et contenu sont exploitables.",
    heroImpactSupportDefault: "Repères chiffrés : % pour le lift et €/mois pour le revenu dans « Impact estimé sur les réservations » ; score /10 dans la colonne de droite.",
    heroImpactSupportCompetitive: "L’annonce est déjà compétitive. Les gains restants viendront surtout d’ajustements plus fins sur le positionnement tarifaire et la clarté de la valeur, afin de capter une part marginale mais réelle de réservations supplémentaires.",
    heroBusinessLiftHintPrudent: "Projection prudente basée sur le prix actuel et le potentiel de conversion, sans base tarifaire marché suffisante.",
    heroBusinessLiftHintInsufficient: "Données marché insuffisantes pour estimer un impact chiffré fiable.",
    heroBusinessLiftHintDefault: "Une annonce optimisée peut améliorer vos revenus mensuels, selon la qualité du marché observé et le niveau de conversion réel.",
    heroRevenueSupportUnavailable: "Estimation indisponible — données marché insuffisantes pour cette lecture agrégée.",
    heroRevenueSupportIndicative: "Estimation indicative basée sur le prix conseillé, le niveau du marché observé et une occupation cible réaliste.",
    heroRevenueSupportPrudent: "Repère prudent : vérifiez volumétrie de réservations et comparables avant d’investir durablement sur le prix.",
    heroRevenueSupportFallback: "Consolidez le prix annoncé et un repère marché (comparables) pour activer une lecture chiffrée.",
    photoBadgeMedium: "{count} photos • galerie correcte",
    heroImpactRevenueRange: "+{low} à +{high} / mois",
    impactSideCardNarrativeCondensed: "Vue condensée : la fourchette complète en % est dans la carte « {label} » ci-dessous.",
    heroScoreNarrativeStrong: "Lecture /10 : niveau solide — affiner avec les recommandations du rapport.",
    marketReliabilityBadgeHigh: "Bonne fiabilité",
    marketReliabilityBadgeMedium: "Fiabilité moyenne",
    marketReliabilityBadgeLow: "Faible fiabilité",
    marketReliabilityBadgeWeakFallback: "Fallback fragile",
    marketReliabilityMessageHigh: "Base marché exploitable avec plusieurs comparables cohérents.",
    marketReliabilityMessageMedium: "Base marché indicative, encore à consolider.",
    marketReliabilityMessageLow: "Base marché limitée : lecture à interpréter avec prudence.",
    marketReliabilityMessageWeakFallback: "Base marché de secours uniquement : lecture à interpréter avec une prudence renforcée.",
    marketComparablesBodyStrong: "Base concurrentielle exploitable pour situer votre annonce sur son segment.",
    marketComparablesBodyNone: "Aucun comparable fiable retenu pour cette lecture marché.",
    marketComparablesBodyLimited: "{base} Échantillon réduit : lecture utile, mais à consolider.",
    toConfirm: "à confirmer",
    pricingPositioning: "Positionnement tarifaire",
    pricingOpportunity: "Marge tarifaire détectée",
    pricingAligned: "Tarif aligné avec le marché",
    pricingAboveMedian: "Tarif au-dessus de la médiane",
    observedMedian: "Médiane observée",
    recommendedPrice: "Prix conseillé",
    belowMedian: "Sous médiane",
    marketAligned: "Aligné marché",
    aboveMedian: "Au-dessus médiane",
    potentialMonthlyGain: "Gain mensuel potentiel",
    estimatedMonthlyRisk: "Risque mensuel estimé",
    estimatedMonthlyImpact: "Impact mensuel estimé",
    pricingAssumption: "Hypothèse pricing : 20 nuits / mois",
    insufficientComparablePricing: "Données insuffisantes : aucun comparable fiable pour estimer médiane ou impact tarifaire.",
    insufficientPricingData: "Données marché insuffisantes pour estimer un impact tarifaire fiable.",
    pricingBenchmarks: "Références de prix",
    pricingBenchmarksTitle: "Comment votre prix se compare-t-il au marché ?",
    pricingBenchmarksDescription: "Repères issus du prix moyen observé et de l’écart estimé avec le marché comparable.",
    averageCompetitorPrice: "Prix moyen des concurrents",
    priceGapVsMarket: "Écart de prix vs marché",
    notReliable: "Non fiable",
    marketAnalysisPending: "Analyse en attente d’un échantillon marché suffisant.",
    businessProjection: "Projection business",
    projectionsPotential: "Projections & potentiel",
    projectionsDescription: "Estimations indicatives basées sur les signaux marché, le positionnement concurrentiel et le potentiel de conversion observé.",
    nightlyPrice: "Prix par nuit",
    premiumPosition: "Position premium",
    aggressivePosition: "Position agressive",
    balancedPosition: "Position équilibrée",
    qualitativeAnalysisOnly: "Analyse qualitative uniquement",
    businessPotentialAfterOptimization: "Potentiel business après optimisation",
    projectionBase: "Base de projection",
    crossPlatformReading: "Lecture cross-platform",
    readableMarket: "Marché lisible",
    cautiousReading: "Lecture prudente",
    lowVisibility: "Faible visibilité",
    conversionGainPotential: "Gain potentiel de conversion",
    actionableProjection: "Projection exploitable",
    limitedProjection: "Projection limitée",
    cautiousProjection: "Projection prudente",
    indicativeProjection: "Projection indicative",
    estimatedMonthlyGainTitle: "Gain mensuel estimé",
    optimizedTexts: "Textes optimisés pour l’annonce",
    variant: "Variante",
    changeVariant: "Changer de variante",
    descriptionCopied: "Description copiée",
    currentTitle: "Titre actuel",
    optimizedTitleExample: "Exemple de titre optimisé",
    myPlace: "Mon logement",
    detailedPlace: "Logement — version détaillée",
    guestAccess: "Accès des voyageurs",
    guestInteraction: "Communication avec les voyageurs",
    otherInfo: "Autres informations à garder à l’esprit",
    bookingDescriptionSummary: "Résumé de description (Booking)",
    bookingSummaryReady: "Synthèse prête à coller, alignée sur la variante affichée.",
    actionPlan: "Plan d’action",
    actionPlanSubtitle: "Les chantiers à lancer maintenant, classés par impact business.",
    businessPriority: "Priorité business",
    quickOptimization: "Optimisation rapide",
    visibility: "Visibilité",
    reassurance: "Réassurance",
    improvement: "Amélioration",
    photoQuality: "Qualité des photos",
    photoOrderQuality: "Ordre des photos",
    descriptionQualityLabel: "Qualité de la description",
    amenitiesCompletenessLabel: "Complétude des équipements",
    seoPerformance: "Performance SEO",
    scoreOverviewTitle: "Lecture détaillée de votre performance de conversion",
    scoreOverviewTextAirbnb: "Lecture basée sur les signaux visibles : la base invite à renforcer l’émotion, l’hospitalité et la singularité de l’annonce.",
    scoreOverviewTextDefault: "Lecture basée sur les signaux visibles : la base permet d’optimiser clarté, réassurance et conversion.",
    scoreStatusConfirm: "À confirmer",
    scoreStatusPartialData: "Données encore partielles",
    scoreStatusExcellent: "Excellent",
    scoreStatusExcellentDetail: "Avantage concurrentiel clair",
    scoreStatusStrong: "Solide",
    scoreStatusStrongDetail: "Signal positif à maintenir",
    scoreStatusCorrect: "Correct",
    scoreStatusCorrectDetail: "Optimisation encore possible",
    scoreStatusNeedsWork: "À renforcer",
    scoreStatusNeedsWorkDetail: "Impact visible sur la conversion",
    scoreStatusWeak: "Faible",
    scoreStatusWeakDetail: "Priorité d’amélioration",
    subScorePhotosNote: "Les visuels créent une première impression solide et rassurante. Ils aident le voyageur à comprendre rapidement la qualité du logement et réduisent les hésitations avant réservation.",
    subScorePhotosFallback: "Données photo insuffisantes pour affiner ce volet.",
    subScorePhotosImpact: "Impact : fort sur le clic et la confiance.",
    subScorePhotosPriority: "Priorité : maintenir ce niveau.",
    subScorePhotoOrderNote: "L’ordre des photos met bien en avant les éléments les plus attractifs. Les premières images doivent confirmer immédiatement le confort, l’espace et la valeur perçue du logement.",
    subScorePhotoOrderFallback: "Ordre des visuels à confirmer lorsque les signaux seront plus complets.",
    subScorePhotoOrderImpact: "Impact : améliore la première impression.",
    subScorePhotoOrderPriority: "Priorité : garder les meilleurs espaces en premier.",
    subScoreDescriptionNote: "Le texte reste correct, mais il peut mieux vendre l’expérience réelle : ambiance, confort, avantages concrets, accès, quartier et raisons de choisir ce logement plutôt qu’un autre.",
    subScoreDescriptionFallback: "Texte trop limité ou peu exploitable pour une lecture fiable ici.",
    subScoreDescriptionImpact: "Impact : renforce la projection voyageur.",
    subScoreDescriptionPriority: "Priorité : rendre la promesse plus concrète.",
    subScoreAmenitiesNote: "Les équipements visibles renforcent la perception de confort. Plus ils sont précis et bien présentés, plus ils rassurent le voyageur sur la qualité du séjour.",
    subScoreAmenitiesFallback: "Équipements peu visibles ou non renseignés : lecture à compléter.",
    subScoreAmenitiesImpact: "Impact : rassure sur le confort du séjour.",
    subScoreAmenitiesPriority: "Priorité : mieux présenter les équipements clés.",
    subScoreSeoNote: "Le référencement est exploitable, mais peut gagner en précision. Le titre, les mots-clés locaux et les équipements recherchés doivent aider la plateforme à mieux comprendre l’annonce.",
    subScoreSeoFallback: "Signaux trop partiels pour conclure sur ce volet.",
    subScoreSeoImpact: "Impact : aide la plateforme à mieux classer l’annonce.",
    subScoreSeoPriority: "Priorité : renforcer titre et mots-clés utiles.",
    subScoreConversionNote: "Le potentiel de conversion est bon, mais il reste des leviers activables. Les gains viendront surtout d’une promesse plus claire, d’une meilleure réassurance et d’un contenu plus concret.",
    subScoreConversionFallback: "Lecture à consolider avec des données additionnelles.",
    subScoreConversionImpact: "Impact : agit directement sur la décision de réserver.",
    subScoreConversionPriority: "Priorité : améliorer réassurance et clarté.",
    iqaBusinessIndicator: "Indicateur business",
    iqaPerceivedListingQuality: "Qualité perçue de l’annonce",
    iqaReading: "Lecture IQA",
    iqaNarrativePremium: "Lecture premium : le niveau global perçu ressort solide face au marché analysé.",
    iqaNarrativeCompetitive: "Base compétitive correcte avec plusieurs leviers encore activables.",
    iqaNarrativeFragile: "Le positionnement qualité reste fragile face aux annonces concurrentes observées.",
    iqaNarrativeRebuilt: "Lecture reconstituée à partir des signaux visibles et du score global de l’audit.",
    lqiLabelHighSignal: "Signal haut",
    lqiLabelFavorable: "Signal favorable",
    lqiLabelImproving: "En progression",
    lqiLabelNeedsWork: "À renforcer",
    lqiSummaryNoObject: "Pas d’objet LQI dans le rapport : les valeurs /100 sont une synthèse locale à partir des mêmes signaux /10 que le reste de la page — lecture agrégée, pas un second jeu de mesures indépendant.",
    lqiSummaryIndicativeScore: "Le score /100 principal est indicatif : dérivé du score global /10 faute d’indice IQA numérique natif dans le rapport.",
    lqiSummaryOverview: "Vue d’ensemble qualité / marché / conversion : sous chaque carte — « Composante rapport » = champ structuré fourni ; « Synthèse locale » = agrégat des /10 déjà sur la page ; « Complément rapport » = autre champ du rapport (ex. potentiel réservation), pas une mesure conversion isolée.",
    lqiSummaryPending: "Cet indicateur s’affichera lorsque les signaux utiles seront disponibles.",
    lqiSummaryCompetitiveButOptimizable: "L’annonce est compétitive, mais certains leviers visibles peuvent encore améliorer la conversion et le positionnement, notamment en rendant la promesse plus explicite dès le premier écran.",
    listingConversion: "Conversion de l’annonce",
  },
  es: {
    loading: "Cargando la auditoría…",
    loadingWait: "Espera un momento mientras se carga el informe.",
    notFound: "No se encontró esta auditoría. Lanza un nuevo análisis desde la página de anuncios.",
    copied: "Copiado",
    copyAction: "Copiar",
    copyUnavailable: "No se puede copiar el contenido en este momento.",
    copyMainDescription: "Copiar la descripción principal",
    copyOptimizedTitle: "Copiar el título optimizado",
    copyHousing: "Copiar Mi alojamiento",
    copyDetailedHousing: "Copiar versión detallada del alojamiento",
    copyGuestAccess: "Copiar Acceso de los huéspedes",
    copyGuestInteraction: "Copiar Interacción con los huéspedes",
    copyOtherInfo: "Copiar Otra información a tener en cuenta",
    copyBookingSummary: "Copiar el resumen Booking",
    bookingSummaryCopied: "Resumen copiado al portapapeles.",
    noBookingSummary: "No hay resumen para copiar por ahora.",
    auditUnavailable: "Auditoría no disponible",
    auditCompleted: "Auditoría completada con éxito",
    auditCompletedText: "Tu anuncio ha sido analizado y ahora puede optimizarse.",
    businessReading: "Lectura business",
    heroTitle: "Dónde tu anuncio pierde reservas y lo que puedes ganar",
    host: "Anfitrión",
    hostUnavailableAgoda: "Anfitrión no disponible en Agoda",
    listingRating: "Nota del anuncio",
    ratingUnavailable: "Nota no disponible",
    guestReviews: "reseñas de viajeros",
    reviewsUnavailable: "Reseñas no disponibles",
    marketPosition: "Posición en el mercado",
    businessImpact: "Impacto business",
    monthlyGainBenchmark: "Referencia de ganancia mensual",
    propertyProfile: "Perfil del alojamiento",
    propertyType: "Tipo de alojamiento",
    notSpecified: "No especificado",
    bedrooms: "Dormitorios",
    bathrooms: "Baños",
    guests: "Viajeros",
    beds: "Camas",
    minimumStay: "Estancia mínima (noches)",
    marketPositioning: "Posicionamiento de mercado",
    differentiatingAttributes: "Atributos diferenciadores",
    minimumStay1: "1 noche",
    minimumStay2: "2 noches",
    minimumStay3: "3 noches",
    minimumStay5: "5 noches",
    minimumStay7: "7 noches",
    minimumStay14: "14 noches",
    marketTierStandard: "Estándar",
    marketTierHighEnd: "Alta gama",
    marketTierPremium: "Premium",
    marketTierExperientialLuxury: "Lujo experiencial",
    marketTierUltraLuxury: "Ultra lujo",
    attributePrivatePool: "Piscina privada",
    attributeSeaView: "Vista al mar",
    attributeBeachfront: "Frente al mar",
    attributeJacuzzi: "Jacuzzi",
    attributeParking: "Aparcamiento",
    attributeAirConditioning: "Aire acondicionado",
    attributeWifi: "Wifi",
    attributeGym: "Gimnasio",
    attributeTerrace: "Terraza",
    attributeConcierge: "Conserjería",
    comparableWeightingHint: "Ponderación de comparables — no es un filtro estricto.",
    marketRecalculationOnly: "Solo recalcular el mercado — el análisis IA y las puntuaciones no cambian.",
    diagnostic: "Diagnóstico…",
    recalibrateMarket: "Recalibrar mercado",
    premiumMarketInsufficient: "Mercado premium insuficiente",
    marketRecalibrated: "Mercado recalibrado",
    premiumMarketText: "Analizamos los comparables disponibles, pero ninguno está suficientemente cerca del segmento premium seleccionado.",
    recalibratedMarketText: "El segmento competitivo se refinó utilizando los comparables más cercanos.",
    comparablesAnalyzed: "Comparables analizados",
    premiumComparables: "Comparables premium retenidos",
    comparablesKept: "Comparables retenidos",
    recalibratedMedian: "Mediana recalibrada",
    recalibratedAverage: "Media recalibrada",
    reliability: "Fiabilidad",
    conversionLevel: "Nivel de conversión",
    conversionFragile: "Referencia de conversión: frágil",
    conversionModerate: "Referencia de conversión: moderada",
    conversionStrong: "Referencia de conversión: sólida",
    conversionScore: "Puntuación de conversión",
    estimatedImpact: "Impacto estimado",
    ceiling: "Límite",
    impactToConfirm: "Impacto por confirmar",
    readingWithoutRange: "Lectura sin rango %",
    listingAnalysis: "Análisis del anuncio",
    listingQuality: "Calidad del anuncio",
    listingQualityDescription: "Lectura de las señales internas: fotos, orden visual, descripción, equipamientos, SEO y capacidad de conversión.",
    globalConversionLevel: "Nivel global de conversión",
    realMarket: "Mercado real",
    observedMarket: "Mercado observado",
    observedMarketDescription: "Lectura basada en comparables retenidos, precios observados, fiabilidad del mercado y diferencia tarifaria.",
    listingCompetitivePosition: "Cómo se sitúa tu anuncio",
    competitiveSummary: "Resumen competitivo basado en los anuncios comparables retenidos.",
    marketPositioningLabel: "Posicionamiento en el mercado",
    positioning: "Posicionamiento",
    listingScore: "Puntuación del anuncio",
    market: "Mercado",
    base: "Base",
    averageCompetitiveQuality: "Calidad competitiva media",
    localSegment: "Segmento local",
    comparedPrices: "Precios comparados",
    consolidatedScore: "Puntuación consolidada",
    marketReliability: "Fiabilidad mercado",
    prioritySummary: "Resumen prioritario",
    topThreeLevers: "Los 3 principales palancas",
    actionable: "Accionable",
    strengthenDescription: "Reforzar la descripción",
    improveSeo: "Mejorar el SEO",
    preserveStrengths: "Conservar los puntos fuertes",
    marketPriorityDescriptionOne: "Puntuación de la descripción: {score}. Prioridad: hacer la promesa más concreta y más diferenciadora.",
    marketPriorityDescriptionTwo: "Puntuación SEO: {score}. Añadir palabras clave locales, equipamientos fuertes y elementos buscados.",
    marketPriorityDescriptionThree: "Fotos: {photoScore} · Equipamientos: {amenitiesScore}. Estas señales ya refuerzan la confianza.",
    marketLabelAbove: "Por encima del nivel competitivo",
    marketLabelBelow: "Por debajo del nivel competitivo",
    marketLabelCompetitive: "En la media competitiva",
    marketPositionToConfirm: "Posición por confirmar",
    marketBenchmarkAbove: "Tu anuncio se sitúa actualmente {value} puntos por encima de la puntuación media observada.",
    marketBenchmarkBelow: "Tu anuncio se sitúa actualmente {value} puntos por debajo de la puntuación media observada.",
    marketBenchmarkAligned: "Tu anuncio se sitúa al nivel medio de los anuncios comparables observados.",
    marketBenchmarkNone: "No se ha retenido ningún comparable para esta lectura en la zona observada.",
    marketBenchmarkOne: "Lectura establecida a partir de 1 anuncio comparable en tu zona.",
    marketBenchmarkMany: "Lectura establecida a partir de {count} anuncios comparables en tu zona.",
    marketBenchmarkPending: "La lectura local estará disponible en cuanto se observe un volumen suficiente de anuncios comparables.",
    marketScoreContextAbove: "Tu puntuación supera claramente la media actual del mercado.",
    marketScoreContextBelow: "Tu puntuación se mantiene por debajo del nivel observado en el mercado.",
    marketScoreContextAligned: "Tu puntuación está perfectamente alineada con el nivel medio del mercado.",
    marketScoreContextObserved: "Lectura basada en los anuncios comparables observados.",
    marketScoreContextMarketBelow: "La media del mercado sigue estando por debajo del nivel actual de tu anuncio.",
    marketScoreContextMarketAbove: "La media del mercado sigue estando por encima del nivel actual de tu anuncio.",
    marketScoreContextMarketAligned: "Tu anuncio y el mercado se sitúan en un nivel similar.",
    marketScoreContextUnavailable: "La puntuación media del mercado se mostrará en cuanto haya suficientes anuncios observados disponibles.",
    marketPositionNarrativeCompetitive: "Este anuncio se sitúa globalmente en la media de los competidores cercanos.",
    heroMarketPositionSupport: "Referencia detallada (comparables, puntuación relativa, textos): bloque « Posicionamiento de mercado ».",
    heroImpactSupportOutOfSegment: "Comparables retenidos fuera del segmento de precio: las estimaciones de negocio no son fiables para este anuncio. Solo siguen siendo utilizables los ejes de calidad y contenido.",
    heroImpactSupportDefault: "Referencias numéricas: % para el lift y €/mes para los ingresos en « Impacto estimado en las reservas »; puntuación /10 en la columna derecha.",
    heroImpactSupportCompetitive: "El anuncio ya es competitivo. Las ganancias restantes vendrán sobre todo de ajustes más finos en el posicionamiento tarifario y la claridad del valor, para captar una parte marginal pero real de reservas adicionales.",
    heroBusinessLiftHintPrudent: "Proyección prudente basada en el precio actual y el potencial de conversión, sin una base tarifaria de mercado suficiente.",
    heroBusinessLiftHintInsufficient: "Los datos de mercado son insuficientes para estimar un impacto cuantificado fiable.",
    heroBusinessLiftHintDefault: "Un anuncio optimizado puede mejorar sus ingresos mensuales, según la calidad del mercado observado y el nivel real de conversión.",
    heroRevenueSupportUnavailable: "Estimación no disponible: datos de mercado insuficientes para esta lectura agregada.",
    heroRevenueSupportIndicative: "Estimación indicativa basada en el precio recomendado, el nivel del mercado observado y una ocupación objetivo realista.",
    heroRevenueSupportPrudent: "Referencia prudente: verifique el volumen de reservas y los comparables antes de invertir de forma duradera en el precio.",
    heroRevenueSupportFallback: "Consolide el precio anunciado y una referencia de mercado (comparables) para activar una lectura cuantificada.",
    photoBadgeMedium: "{count} fotos • galería correcta",
    heroImpactRevenueRange: "+{low} a +{high} / mes",
    impactSideCardNarrativeCondensed: "Vista condensada: el rango completo en % está en la tarjeta « {label} » de abajo.",
    heroScoreNarrativeStrong: "Lectura /10: nivel sólido — afinar con las recomendaciones del informe.",
    marketReliabilityBadgeHigh: "Buena fiabilidad",
    marketReliabilityBadgeMedium: "Fiabilidad media",
    marketReliabilityBadgeLow: "Fiabilidad baja",
    marketReliabilityBadgeWeakFallback: "Fallback débil",
    marketReliabilityMessageHigh: "Base de mercado utilizable con varios comparables coherentes.",
    marketReliabilityMessageMedium: "Base de mercado indicativa, todavía por consolidar.",
    marketReliabilityMessageLow: "Base de mercado limitada: lectura a interpretar con prudencia.",
    marketReliabilityMessageWeakFallback: "Base de mercado de respaldo únicamente: lectura a interpretar con mayor prudencia.",
    marketComparablesBodyStrong: "Base competitiva utilizable para situar tu anuncio en su segmento.",
    marketComparablesBodyNone: "No se ha retenido ningún comparable fiable para esta lectura de mercado.",
    marketComparablesBodyLimited: "{base} Muestra reducida: lectura útil, pero todavía por consolidar.",
    toConfirm: "por confirmar",
    pricingPositioning: "Posicionamiento de precios",
    pricingOpportunity: "Oportunidad tarifaria detectada",
    pricingAligned: "Precio alineado con el mercado",
    pricingAboveMedian: "Precio por encima de la mediana",
    observedMedian: "Mediana observada",
    recommendedPrice: "Precio recomendado",
    belowMedian: "Por debajo de la mediana",
    marketAligned: "Alineado al mercado",
    aboveMedian: "Por encima de la mediana",
    potentialMonthlyGain: "Ganancia mensual potencial",
    estimatedMonthlyRisk: "Riesgo mensual estimado",
    estimatedMonthlyImpact: "Impacto mensual estimado",
    pricingAssumption: "Hipótesis: 20 noches / mes",
    insufficientComparablePricing: "Datos insuficientes: no hay comparables fiables para estimar la mediana o el impacto.",
    insufficientPricingData: "Datos de mercado insuficientes para estimar un impacto fiable.",
    pricingBenchmarks: "Referencias de precios",
    pricingBenchmarksTitle: "Cómo se sitúa tu precio frente al mercado",
    pricingBenchmarksDescription: "Referencias basadas en el precio medio observado y la diferencia con el mercado.",
    averageCompetitorPrice: "Precio medio competidor",
    priceGapVsMarket: "Diferencia de precio vs mercado",
    notReliable: "No fiable",
    marketAnalysisPending: "Análisis pendiente de una muestra suficiente.",
    businessProjection: "Proyección de negocio",
    projectionsPotential: "Proyecciones y potencial",
    projectionsDescription: "Estimaciones indicativas basadas en el mercado y el potencial de conversión.",
    nightlyPrice: "Precio por noche",
    premiumPosition: "Posición premium",
    aggressivePosition: "Posición agresiva",
    balancedPosition: "Posición equilibrada",
    qualitativeAnalysisOnly: "Solo análisis cualitativo",
    businessPotentialAfterOptimization: "Potencial tras la optimización",
    projectionBase: "Base de proyección",
    crossPlatformReading: "Lectura multiplataforma",
    readableMarket: "Mercado legible",
    cautiousReading: "Lectura prudente",
    lowVisibility: "Baja visibilidad",
    conversionGainPotential: "Potencial de conversión",
    actionableProjection: "Proyección utilizable",
    limitedProjection: "Proyección limitada",
    cautiousProjection: "Proyección prudente",
    indicativeProjection: "Proyección indicativa",
    estimatedMonthlyGainTitle: "Ganancia mensual estimada",
    optimizedTexts: "Textos optimizados para el anuncio",
    variant: "Variante",
    changeVariant: "Cambiar variante",
    descriptionCopied: "Descripción copiada",
    currentTitle: "Título actual",
    optimizedTitleExample: "Ejemplo de título optimizado",
    myPlace: "Mi alojamiento",
    detailedPlace: "Alojamiento (versión detallada)",
    guestAccess: "Acceso de los huéspedes",
    guestInteraction: "Comunicación con los huéspedes",
    otherInfo: "Otra información a tener en cuenta",
    bookingDescriptionSummary: "Resumen para la descripción (Booking)",
    bookingSummaryReady: "Resumen listo para pegar, alineado con la variante mostrada.",
    actionPlan: "Plan de acción",
    actionPlanSubtitle: "Acciones a lanzar ahora, ordenadas por impacto business.",
    businessPriority: "Prioridad business",
    quickOptimization: "Optimización rápida",
    visibility: "Visibilidad",
    reassurance: "Confianza",
    improvement: "Mejora",
    photoQuality: "Calidad de las fotos",
    photoOrderQuality: "Orden de las fotos",
    descriptionQualityLabel: "Calidad de la descripción",
    amenitiesCompletenessLabel: "Completitud de equipamientos",
    seoPerformance: "Rendimiento SEO",
    scoreOverviewTitle: "Lectura detallada de tu rendimiento de conversión",
    scoreOverviewTextAirbnb: "Lectura basada en señales visibles: la base invita a reforzar la emoción, la hospitalidad y la singularidad del anuncio.",
    scoreOverviewTextDefault: "Lectura basada en señales visibles: la base permite optimizar claridad, confianza y conversión.",
    scoreStatusConfirm: "Por confirmar",
    scoreStatusPartialData: "Datos aún parciales",
    scoreStatusExcellent: "Excelente",
    scoreStatusExcellentDetail: "Ventaja competitiva clara",
    scoreStatusStrong: "Sólido",
    scoreStatusStrongDetail: "Señal positiva que mantener",
    scoreStatusCorrect: "Correcto",
    scoreStatusCorrectDetail: "Aún se puede optimizar",
    scoreStatusNeedsWork: "A reforzar",
    scoreStatusNeedsWorkDetail: "Impacto visible en la conversión",
    scoreStatusWeak: "Débil",
    scoreStatusWeakDetail: "Prioridad de mejora",
    subScorePhotosNote: "Las imágenes crean una primera impresión sólida y tranquilizadora. Ayudan al viajero a entender rápidamente la calidad del alojamiento y reducen las dudas antes de reservar.",
    subScorePhotosFallback: "Datos fotográficos insuficientes para afinar este aspecto.",
    subScorePhotosImpact: "Impacto: fuerte en el clic y la confianza.",
    subScorePhotosPriority: "Prioridad: mantener este nivel.",
    subScorePhotoOrderNote: "El orden de las fotos destaca bien los elementos más atractivos. Las primeras imágenes deben confirmar inmediatamente el confort, el espacio y el valor percibido del alojamiento.",
    subScorePhotoOrderFallback: "El orden visual debe confirmarse cuando las señales sean más completas.",
    subScorePhotoOrderImpact: "Impacto: mejora la primera impresión.",
    subScorePhotoOrderPriority: "Prioridad: mantener primero los mejores espacios.",
    subScoreDescriptionNote: "El texto es correcto, pero puede vender mejor la experiencia real: ambiente, confort, ventajas concretas, acceso, barrio y motivos para elegir este alojamiento frente a otro.",
    subScoreDescriptionFallback: "Texto demasiado limitado o poco aprovechable para una lectura fiable aquí.",
    subScoreDescriptionImpact: "Impacto: refuerza la proyección del viajero.",
    subScoreDescriptionPriority: "Prioridad: hacer la promesa más concreta.",
    subScoreAmenitiesNote: "Los equipamientos visibles refuerzan la percepción de confort. Cuanto más precisos y mejor presentados estén, más tranquilizan al viajero sobre la calidad de la estancia.",
    subScoreAmenitiesFallback: "Equipamientos poco visibles o no indicados: lectura por completar.",
    subScoreAmenitiesImpact: "Impacto: tranquiliza sobre el confort de la estancia.",
    subScoreAmenitiesPriority: "Prioridad: presentar mejor los equipamientos clave.",
    subScoreSeoNote: "El SEO es aprovechable, pero puede ganar precisión. El título, las palabras clave locales y los equipamientos buscados deben ayudar a la plataforma a entender mejor el anuncio.",
    subScoreSeoFallback: "Las señales son demasiado parciales para concluir sobre este aspecto.",
    subScoreSeoImpact: "Impacto: ayuda a la plataforma a clasificar mejor el anuncio.",
    subScoreSeoPriority: "Prioridad: reforzar el título y las palabras clave útiles.",
    subScoreConversionNote: "El potencial de conversión es bueno, pero aún hay palancas por activar. Las mejoras vendrán sobre todo de una promesa más clara, más confianza y un contenido más concreto.",
    subScoreConversionFallback: "Lectura por consolidar con datos adicionales.",
    subScoreConversionImpact: "Impacto: actúa directamente sobre la decisión de reservar.",
    subScoreConversionPriority: "Prioridad: mejorar la confianza y la claridad.",
    iqaBusinessIndicator: "Indicador business",
    iqaPerceivedListingQuality: "Calidad percibida del anuncio",
    iqaReading: "Lectura IQA",
    iqaNarrativePremium: "Lectura premium: el nivel global percibido se mantiene sólido frente al mercado analizado.",
    iqaNarrativeCompetitive: "Base competitiva correcta con varias palancas aún activables.",
    iqaNarrativeFragile: "El posicionamiento de calidad sigue siendo frágil frente a los anuncios competidores observados.",
    iqaNarrativeRebuilt: "Lectura reconstruida a partir de las señales visibles y de la puntuación global de la auditoría.",
    lqiLabelHighSignal: "Señal alta",
    lqiLabelFavorable: "Señal favorable",
    lqiLabelImproving: "En progreso",
    lqiLabelNeedsWork: "Por reforzar",
    lqiSummaryNoObject: "No hay ningún objeto LQI en el informe: los valores /100 son una síntesis local construida a partir de las mismas señales /10 que el resto de la página; una lectura agregada, no un segundo conjunto independiente de mediciones.",
    lqiSummaryIndicativeScore: "La puntuación principal /100 es indicativa: se deriva de la puntuación global /10 porque el informe no incluye un índice IQA numérico nativo.",
    lqiSummaryOverview: "Vista general de calidad / mercado / conversión: bajo cada tarjeta — «Componente del informe» = campo estructurado proporcionado; «Síntesis local» = agregado de los /10 ya presentes en la página; «Complemento del informe» = otro campo del informe (por ejemplo, potencial de reservas), no una medida de conversión aislada.",
    lqiSummaryPending: "Este indicador se mostrará cuando las señales útiles estén disponibles.",
    lqiSummaryCompetitiveButOptimizable: "El anuncio es competitivo, pero algunas palancas visibles todavía pueden mejorar la conversión y el posicionamiento, especialmente haciendo que la promesa de valor sea más explícita desde la primera pantalla.",
    listingConversion: "Conversión del anuncio",
  },
  de: {
    loading: "Auditbericht wird geladen…",
    loadingWait: "Bitte warten, während der Bericht geladen wird.",
    notFound: "Dieses Audit wurde nicht gefunden. Starten Sie eine neue Analyse auf der Anzeigenseite.",
    copied: "Kopiert",
    copyAction: "Kopieren",
    copyUnavailable: "Der Inhalt kann derzeit nicht kopiert werden.",
    copyMainDescription: "Hauptbeschreibung kopieren",
    copyOptimizedTitle: "Optimierten Titel kopieren",
    copyHousing: "Mein Zuhause kopieren",
    copyDetailedHousing: "Detaillierte Unterkunftsversion kopieren",
    copyGuestAccess: "Gastzugang kopieren",
    copyGuestInteraction: "Gastinteraktion kopieren",
    copyOtherInfo: "Weitere Hinweise kopieren",
    copyBookingSummary: "Booking-Zusammenfassung kopieren",
    bookingSummaryCopied: "Zusammenfassung in die Zwischenablage kopiert.",
    noBookingSummary: "Derzeit keine Zusammenfassung zum Kopieren verfügbar.",
    auditUnavailable: "Audit nicht verfügbar",
    auditCompleted: "Audit erfolgreich abgeschlossen",
    auditCompletedText: "Ihre Anzeige wurde analysiert und kann jetzt optimiert werden.",
    businessReading: "Business-Auswertung",
    heroTitle: "Wo Ihre Anzeige Buchungen verliert und was Sie gewinnen können",
    host: "Gastgeber",
    hostUnavailableAgoda: "Gastgeber auf Agoda nicht verfügbar",
    listingRating: "Bewertung der Anzeige",
    ratingUnavailable: "Bewertung nicht verfügbar",
    guestReviews: "Gästebewertungen",
    reviewsUnavailable: "Bewertungen nicht verfügbar",
    marketPosition: "Marktposition",
    businessImpact: "Geschäftsauswirkung",
    monthlyGainBenchmark: "Monatlicher Gewinnwert",
    propertyProfile: "Objektprofil",
    propertyType: "Objekttyp",
    notSpecified: "Nicht angegeben",
    bedrooms: "Schlafzimmer",
    bathrooms: "Badezimmer",
    guests: "Gäste",
    beds: "Betten",
    minimumStay: "Mindestaufenthalt (Nächte)",
    marketPositioning: "Marktpositionierung",
    differentiatingAttributes: "Unterscheidende Merkmale",
    minimumStay1: "1 Nacht",
    minimumStay2: "2 Nächte",
    minimumStay3: "3 Nächte",
    minimumStay5: "5 Nächte",
    minimumStay7: "7 Nächte",
    minimumStay14: "14 Nächte",
    marketTierStandard: "Standard",
    marketTierHighEnd: "Gehobenes Segment",
    marketTierPremium: "Premium",
    marketTierExperientialLuxury: "Erlebnisluxus",
    marketTierUltraLuxury: "Ultra-Luxus",
    attributePrivatePool: "Privater Pool",
    attributeSeaView: "Meerblick",
    attributeBeachfront: "Direkt am Strand",
    attributeJacuzzi: "Jacuzzi",
    attributeParking: "Parkplatz",
    attributeAirConditioning: "Klimaanlage",
    attributeWifi: "WLAN",
    attributeGym: "Fitnessraum",
    attributeTerrace: "Terrasse",
    attributeConcierge: "Concierge",
    comparableWeightingHint: "Gewichtung vergleichbarer Angebote — kein strenger Filter.",
    marketRecalculationOnly: "Nur Marktneuberechnung — KI-Analyse und Scores bleiben unverändert.",
    diagnostic: "Diagnose…",
    recalibrateMarket: "Markt neu kalibrieren",
    premiumMarketInsufficient: "Premium-Markt unzureichend",
    marketRecalibrated: "Markt neu kalibriert",
    premiumMarketText: "Wir haben die verfügbaren Vergleichsobjekte analysiert, aber keines liegt nah genug am gewählten Premium-Segment. Die Schätzungen bleiben daher bewusst vorsichtig.",
    recalibratedMarketText: "Das Wettbewerbssegment wurde anhand der nächstliegenden Vergleichsobjekte verfeinert.",
    comparablesAnalyzed: "Vergleichsobjekte analysiert",
    premiumComparables: "Übernommene Premium-Vergleichsobjekte",
    comparablesKept: "Berücksichtigte Vergleichsobjekte",
    recalibratedMedian: "Neu kalibrierter Median",
    recalibratedAverage: "Neu kalibrierter Durchschnitt",
    reliability: "Zuverlässigkeit",
    conversionLevel: "Konversionsniveau",
    conversionFragile: "Konversionsrichtwert: fragil",
    conversionModerate: "Konversionsrichtwert: mittel",
    conversionStrong: "Konversionsrichtwert: stark",
    conversionScore: "Konversionsscore",
    estimatedImpact: "Geschätzte Auswirkung",
    ceiling: "Obergrenze",
    impactToConfirm: "Auswirkung zu bestätigen",
    readingWithoutRange: "Auswertung ohne %-Spanne",
    listingAnalysis: "Anzeigenanalyse",
    listingQuality: "Qualität der Anzeige",
    listingQualityDescription: "Interne Analyse Ihrer Anzeige: Fotos, visuelle Reihenfolge, Beschreibung, Ausstattung, SEO und Konversionspotenzial.",
    globalConversionLevel: "Gesamtes Konversionsniveau",
    realMarket: "Realer Markt",
    observedMarket: "Beobachteter Markt",
    observedMarketDescription: "Basierend auf berücksichtigten Vergleichsobjekten, beobachteten Konkurrenzpreisen, Marktzverlässigkeit und berechnetem Preisabstand.",
    listingCompetitivePosition: "Wie Ihre Anzeige im Vergleich steht",
    competitiveSummary: "Zusammenfassende Auswertung Ihrer Wettbewerbsposition auf Basis der berücksichtigten Vergleichsanzeigen.",
    marketPositioningLabel: "Marktpositionierung",
    positioning: "Positionierung",
    listingScore: "Anzeigenscore",
    market: "Markt",
    base: "Basis",
    averageCompetitiveQuality: "Durchschnittliche Wettbewerbsqualität",
    localSegment: "Lokales Segment",
    comparedPrices: "Verglichene Preise",
    consolidatedScore: "Konsolidierter Score",
    marketReliability: "Marktzuverlässigkeit",
    prioritySummary: "Prioritätenübersicht",
    topThreeLevers: "Die 3 Hebel mit dem größten Potenzial",
    actionable: "Umsetzbar",
    strengthenDescription: "Beschreibung stärken",
    improveSeo: "SEO verbessern",
    preserveStrengths: "Aktuelle Stärken bewahren",
    marketPriorityDescriptionOne: "Beschreibungswert: {score}. Priorität: Das Versprechen konkreter und differenzierender machen.",
    marketPriorityDescriptionTwo: "SEO-Wert: {score}. Lokale Schlüsselwörter, starke Ausstattungen und gefragte Elemente ergänzen.",
    marketPriorityDescriptionThree: "Fotos: {photoScore} · Ausstattung: {amenitiesScore}. Diese Signale stützen bereits das Vertrauen.",
    marketLabelAbove: "Über dem Wettbewerbsniveau",
    marketLabelBelow: "Unter dem Wettbewerbsniveau",
    marketLabelCompetitive: "Im Wettbewerbsdurchschnitt",
    marketPositionToConfirm: "Position zu bestätigen",
    marketBenchmarkAbove: "Ihr Inserat liegt derzeit {value} Punkte über dem beobachteten Durchschnittswert.",
    marketBenchmarkBelow: "Ihr Inserat liegt derzeit {value} Punkte unter dem beobachteten Durchschnittswert.",
    marketBenchmarkAligned: "Ihr Inserat liegt auf dem Durchschnittsniveau der beobachteten vergleichbaren Anzeigen.",
    marketBenchmarkNone: "Für diese Auswertung in der beobachteten Zone wurde kein Vergleichsobjekt berücksichtigt.",
    marketBenchmarkOne: "Auswertung auf Basis von 1 vergleichbaren Anzeige in Ihrer Zone.",
    marketBenchmarkMany: "Auswertung auf Basis von {count} vergleichbaren Anzeigen in Ihrer Zone.",
    marketBenchmarkPending: "Eine lokale Auswertung wird verfügbar, sobald ein ausreichendes Volumen vergleichbarer Anzeigen beobachtet wurde.",
    marketScoreContextAbove: "Ihr Score liegt klar über dem aktuellen Marktdurchschnitt.",
    marketScoreContextBelow: "Ihr Score bleibt unter dem auf dem Markt beobachteten Niveau.",
    marketScoreContextAligned: "Ihr Score ist perfekt auf das durchschnittliche Marktniveau abgestimmt.",
    marketScoreContextObserved: "Auswertung auf Basis der beobachteten vergleichbaren Anzeigen.",
    marketScoreContextMarketBelow: "Der Marktdurchschnitt liegt weiterhin unter dem aktuellen Niveau Ihres Inserats.",
    marketScoreContextMarketAbove: "Der Marktdurchschnitt liegt weiterhin über dem aktuellen Niveau Ihres Inserats.",
    marketScoreContextMarketAligned: "Ihr Inserat und der Markt liegen auf einem ähnlichen Niveau.",
    marketScoreContextUnavailable: "Der durchschnittliche Markt-Score wird angezeigt, sobald genügend beobachtete Anzeigen verfügbar sind.",
    marketPositionNarrativeCompetitive: "Dieses Inserat liegt insgesamt im Durchschnitt der nahen Wettbewerber.",
    heroMarketPositionSupport: "Detaillierte Referenz (Vergleichsobjekte, relativer Score, Textsignale): Block „Marktpositionierung“.",
    heroImpactSupportOutOfSegment: "Vergleichsobjekte außerhalb des Preissegments berücksichtigt — geschäftliche Schätzungen sind für dieses Inserat nicht verlässlich. Nutzbar bleiben nur Qualitäts- und Inhaltshebel.",
    heroImpactSupportDefault: "Zahlenmarker: % für den Lift und €/Monat für den Umsatz in „Geschätzte Auswirkungen auf Buchungen“; /10-Score in der rechten Spalte.",
    heroImpactSupportCompetitive: "Das Inserat ist bereits wettbewerbsfähig. Die verbleibenden Gewinne kommen vor allem aus feineren Anpassungen bei Preispositionierung und Werteklarheit, um einen kleinen, aber realen Anteil zusätzlicher Buchungen zu gewinnen.",
    heroBusinessLiftHintPrudent: "Vorsichtige Projektion auf Basis des aktuellen Preises und des Konversionspotenzials, ohne ausreichende Marktpreisgrundlage.",
    heroBusinessLiftHintInsufficient: "Die Marktdaten reichen nicht aus, um eine verlässliche quantifizierte Auswirkung zu schätzen.",
    heroBusinessLiftHintDefault: "Ein optimiertes Inserat kann Ihren monatlichen Umsatz verbessern, abhängig von der Qualität des beobachteten Marktes und dem tatsächlichen Konversionsniveau.",
    heroRevenueSupportUnavailable: "Schätzung nicht verfügbar — unzureichende Marktdaten für diese aggregierte Auswertung.",
    heroRevenueSupportIndicative: "Indikative Schätzung auf Basis des empfohlenen Preises, des beobachteten Marktniveaus und einer realistischen Zielauslastung.",
    heroRevenueSupportPrudent: "Vorsichtiger Richtwert: Prüfen Sie Buchungsvolumen und Vergleichsobjekte, bevor Sie den Preis dauerhaft anpassen.",
    heroRevenueSupportFallback: "Konsolidieren Sie den ausgeschriebenen Preis und einen Marktvergleich (Vergleichsobjekte), um eine bezifferte Auswertung zu aktivieren.",
    photoBadgeMedium: "{count} Fotos • ordentliche Galerie",
    heroImpactRevenueRange: "+{low} bis +{high} / Monat",
    impactSideCardNarrativeCondensed: "Kurzansicht: Die vollständige %-Spanne steht unten in der Karte „{label}“.",
    heroScoreNarrativeStrong: "Auswertung /10: starkes Niveau — mit den Empfehlungen des Berichts weiter verfeinern.",
    marketReliabilityBadgeHigh: "Gute Zuverlässigkeit",
    marketReliabilityBadgeMedium: "Mittlere Zuverlässigkeit",
    marketReliabilityBadgeLow: "Geringe Zuverlässigkeit",
    marketReliabilityBadgeWeakFallback: "Schwacher Fallback",
    marketReliabilityMessageHigh: "Nutzbare Marktbasis mit mehreren konsistenten Vergleichsobjekten.",
    marketReliabilityMessageMedium: "Indikative Marktbasis, noch zu konsolidieren.",
    marketReliabilityMessageLow: "Begrenzte Marktbasis: Auswertung mit Vorsicht interpretieren.",
    marketReliabilityMessageWeakFallback: "Nur Ersatz-Marktbasis: Auswertung mit zusätzlicher Vorsicht interpretieren.",
    marketComparablesBodyStrong: "Nutzbare Wettbewerbsbasis, um Ihr Inserat in seinem Segment einzuordnen.",
    marketComparablesBodyNone: "Für diese Marktauswertung wurde kein verlässliches Vergleichsobjekt berücksichtigt.",
    marketComparablesBodyLimited: "{base} Kleine Stichprobe: nützliche Auswertung, aber noch zu konsolidieren.",
    toConfirm: "zu bestätigen",
    pricingPositioning: "Preispositionierung",
    pricingOpportunity: "Preisliche Chance erkannt",
    pricingAligned: "Preis am Markt ausgerichtet",
    pricingAboveMedian: "Preis über dem Median",
    observedMedian: "Beobachteter Median",
    recommendedPrice: "Empfohlener Preis",
    belowMedian: "Unter dem Median",
    marketAligned: "Am Markt ausgerichtet",
    aboveMedian: "Über dem Median",
    potentialMonthlyGain: "Potenzieller monatlicher Gewinn",
    estimatedMonthlyRisk: "Geschätztes monatliches Risiko",
    estimatedMonthlyImpact: "Geschätzte monatliche Auswirkung",
    pricingAssumption: "Preisannahme: 20 Nächte / Monat",
    insufficientComparablePricing: "Unzureichende Daten: kein verlässliches Vergleichsobjekt zur Schätzung von Median oder Preiseffekt.",
    insufficientPricingData: "Unzureichende Marktdaten für eine verlässliche Preisschätzung.",
    pricingBenchmarks: "Preis-Benchmarks",
    pricingBenchmarksTitle: "Wie Ihr Preis im Vergleich zum Wettbewerb steht",
    pricingBenchmarksDescription: "Preis-Benchmarks auf Basis der beobachteten Durchschnittspreise und der geschätzten Lücke zum vergleichbaren Markt.",
    averageCompetitorPrice: "Durchschnittlicher Wettbewerbspreis",
    priceGapVsMarket: "Preisabstand zum Markt",
    notReliable: "Nicht verlässlich",
    marketAnalysisPending: "Analyse ausstehend, bis eine ausreichende Marktstichprobe verfügbar ist.",
    businessProjection: "Geschäftsprojektion",
    projectionsPotential: "Projektionen & Potenzial",
    projectionsDescription: "Indikative Schätzungen auf Basis von Marktsignalen, Wettbewerbspositionierung und beobachtetem Konversionspotenzial.",
    nightlyPrice: "Preis pro Nacht",
    premiumPosition: "Premium-Position",
    aggressivePosition: "Aggressive Position",
    balancedPosition: "Ausgewogene Position",
    qualitativeAnalysisOnly: "Nur qualitative Analyse",
    businessPotentialAfterOptimization: "Geschäftspotenzial nach Optimierung",
    projectionBase: "Projektionsgrundlage",
    crossPlatformReading: "Plattformübergreifende Auswertung",
    readableMarket: "Lesbarer Markt",
    cautiousReading: "Vorsichtige Auswertung",
    lowVisibility: "Geringe Sichtbarkeit",
    conversionGainPotential: "Potenzieller Konversionsgewinn",
    actionableProjection: "Umsetzbare Projektion",
    limitedProjection: "Begrenzte Projektion",
    cautiousProjection: "Vorsichtige Projektion",
    indicativeProjection: "Indikative Projektion",
    estimatedMonthlyGainTitle: "Geschätzter monatlicher Gewinn",
    optimizedTexts: "Optimierte Anzeigentexte",
    variant: "Variante",
    changeVariant: "Variante wechseln",
    descriptionCopied: "Beschreibung kopiert",
    currentTitle: "Aktueller Titel",
    optimizedTitleExample: "Beispiel für optimierten Titel",
    myPlace: "Mein Zuhause",
    detailedPlace: "Unterkunft — detaillierte Version",
    guestAccess: "Gastzugang",
    guestInteraction: "Gastinteraktion",
    otherInfo: "Weitere Hinweise",
    bookingDescriptionSummary: "Beschreibungszusammenfassung (Booking)",
    bookingSummaryReady: "Einfügebereite Zusammenfassung, abgestimmt auf die angezeigte Variante.",
    actionPlan: "Aktionsplan",
    actionPlanSubtitle: "Projekte, die jetzt gestartet werden sollten, geordnet nach Geschäftsauswirkung.",
    businessPriority: "Geschäftspriorität",
    quickOptimization: "Schnelle Optimierung",
    visibility: "Sichtbarkeit",
    reassurance: "Vertrauen",
    improvement: "Verbesserung",
    photoQuality: "Fotoqualität",
    photoOrderQuality: "Reihenfolge der Fotos",
    descriptionQualityLabel: "Qualität der Beschreibung",
    amenitiesCompletenessLabel: "Vollständigkeit der Ausstattung",
    seoPerformance: "SEO-Leistung",
    scoreOverviewTitle: "Detaillierte Auswertung Ihrer Konversionsleistung",
    scoreOverviewTextAirbnb: "Auswertung auf Basis sichtbarer Signale: Die Grundlage lädt dazu ein, Emotion, Gastfreundschaft und Einzigartigkeit der Anzeige zu stärken.",
    scoreOverviewTextDefault: "Auswertung auf Basis sichtbarer Signale: Die Grundlage hilft dabei, Klarheit, Vertrauen und Konversion zu optimieren.",
    scoreStatusConfirm: "Zu bestätigen",
    scoreStatusPartialData: "Daten noch unvollständig",
    scoreStatusExcellent: "Ausgezeichnet",
    scoreStatusExcellentDetail: "Klarer Wettbewerbsvorteil",
    scoreStatusStrong: "Stark",
    scoreStatusStrongDetail: "Positives Signal, das erhalten werden sollte",
    scoreStatusCorrect: "Solide",
    scoreStatusCorrectDetail: "Weitere Optimierung möglich",
    scoreStatusNeedsWork: "Zu stärken",
    scoreStatusNeedsWorkDetail: "Sichtbare Auswirkung auf die Konversion",
    scoreStatusWeak: "Schwach",
    scoreStatusWeakDetail: "Verbesserungspriorität",
    subScorePhotosNote: "Die Bilder erzeugen einen starken und beruhigenden ersten Eindruck. Sie helfen Reisenden, die Qualität der Unterkunft schnell zu erfassen, und verringern das Zögern vor der Buchung.",
    subScorePhotosFallback: "Nicht genügend Fotodaten, um diesen Bereich zu verfeinern.",
    subScorePhotosImpact: "Auswirkung: stark auf Klickrate und Vertrauen.",
    subScorePhotosPriority: "Priorität: dieses Niveau halten.",
    subScorePhotoOrderNote: "Die Reihenfolge der Fotos stellt die attraktivsten Elemente gut heraus. Die ersten Bilder sollten Komfort, Raum und den wahrgenommenen Wert der Unterkunft sofort bestätigen.",
    subScorePhotoOrderFallback: "Die visuelle Reihenfolge sollte bestätigt werden, sobald mehr Signale verfügbar sind.",
    subScorePhotoOrderImpact: "Auswirkung: verbessert den ersten Eindruck.",
    subScorePhotoOrderPriority: "Priorität: die besten Bereiche zuerst zeigen.",
    subScoreDescriptionNote: "Der Text ist solide, könnte aber das echte Erlebnis noch besser verkaufen: Atmosphäre, Komfort, konkrete Vorteile, Zugang, Lage und Gründe, diese Unterkunft statt einer anderen zu wählen.",
    subScoreDescriptionFallback: "Der Text ist zu begrenzt oder hier nicht aussagekräftig genug für eine verlässliche Auswertung.",
    subScoreDescriptionImpact: "Auswirkung: stärkt die Projektion des Reisenden.",
    subScoreDescriptionPriority: "Priorität: das Versprechen greifbarer machen.",
    subScoreAmenitiesNote: "Sichtbare Ausstattungen stärken den Komforteindruck. Je präziser und besser sie präsentiert werden, desto mehr Vertrauen geben sie Reisenden in die Qualität des Aufenthalts.",
    subScoreAmenitiesFallback: "Ausstattungen sind wenig sichtbar oder nicht angegeben: Auswertung unvollständig.",
    subScoreAmenitiesImpact: "Auswirkung: beruhigt hinsichtlich des Komforts des Aufenthalts.",
    subScoreAmenitiesPriority: "Priorität: wichtige Ausstattungen besser hervorheben.",
    subScoreSeoNote: "SEO ist nutzbar, kann aber präziser werden. Titel, lokale Schlüsselwörter und gesuchte Ausstattungen sollten der Plattform helfen, die Anzeige besser zu verstehen.",
    subScoreSeoFallback: "Die Signale sind zu unvollständig, um diesen Bereich zu bewerten.",
    subScoreSeoImpact: "Auswirkung: hilft der Plattform, die Anzeige besser zu ranken.",
    subScoreSeoPriority: "Priorität: Titel und nützliche Schlüsselwörter stärken.",
    subScoreConversionNote: "Das Konversionspotenzial ist gut, aber es bleiben noch Hebel offen. Verbesserungen kommen vor allem durch ein klareres Versprechen, mehr Vertrauen und konkreteren Inhalt.",
    subScoreConversionFallback: "Auswertung mit zusätzlichen Daten zu konsolidieren.",
    subScoreConversionImpact: "Auswirkung: wirkt direkt auf die Buchungsentscheidung.",
    subScoreConversionPriority: "Priorität: Vertrauen und Klarheit verbessern.",
    iqaBusinessIndicator: "Business-Indikator",
    iqaPerceivedListingQuality: "Wahrgenommene Qualität der Anzeige",
    iqaReading: "IQA-Auswertung",
    iqaNarrativePremium: "Premium-Auswertung: Das wahrgenommene Gesamtniveau wirkt im analysierten Markt stark.",
    iqaNarrativeCompetitive: "Die Wettbewerbsbasis ist solide, mit mehreren noch aktivierbaren Hebeln.",
    iqaNarrativeFragile: "Die Qualitätspositionierung bleibt gegenüber den beobachteten Konkurrenzanzeigen fragil.",
    iqaNarrativeRebuilt: "Auswertung, rekonstruiert aus sichtbaren Signalen und dem Gesamtscore des Audits.",
    lqiLabelHighSignal: "Starkes Signal",
    lqiLabelFavorable: "Günstiges Signal",
    lqiLabelImproving: "Im Aufschwung",
    lqiLabelNeedsWork: "Zu stärken",
    lqiSummaryNoObject: "Im Bericht ist kein LQI-Objekt vorhanden: Die /100-Werte sind eine lokale Synthese auf Basis derselben /10-Signale wie auf dem Rest der Seite — eine aggregierte Auswertung, kein zweiter unabhängiger Messsatz.",
    lqiSummaryIndicativeScore: "Der Hauptwert /100 ist indikativ: Er wird aus dem Gesamtscore /10 abgeleitet, da im Bericht kein nativer numerischer IQA-Index vorhanden ist.",
    lqiSummaryOverview: "Übersicht Qualität / Markt / Konversion: unter jeder Karte — „Berichtskomponente“ = bereitgestelltes strukturiertes Feld; „Lokale Synthese“ = Aggregat der bereits auf der Seite vorhandenen /10-Werte; „Berichtsergänzung“ = weiteres Feld aus dem Bericht (z. B. Buchungspotenzial), keine isolierte Konversionsmessung.",
    lqiSummaryPending: "Dieser Indikator wird angezeigt, sobald die nützlichen Signale verfügbar sind.",
    lqiSummaryCompetitiveButOptimizable: "Die Anzeige ist wettbewerbsfähig, aber einige sichtbare Hebel können die Konversion und Positionierung noch verbessern, insbesondere wenn das Wertversprechen bereits im ersten Bildschirm klarer formuliert wird.",
    listingConversion: "Konversion der Anzeige",
  },
  it: {
    loading: "Caricamento dell’audit…",
    loadingWait: "Attendi mentre il report viene caricato.",
    notFound: "Questo audit non è stato trovato. Avvia una nuova analisi dalla pagina degli annunci.",
    copied: "Copiato",
    copyAction: "Copia",
    copyUnavailable: "Impossibile copiare il contenuto in questo momento.",
    copyMainDescription: "Copia descrizione principale",
    copyOptimizedTitle: "Copia titolo ottimizzato",
    copyHousing: "Copia Il mio alloggio",
    copyDetailedHousing: "Copia versione dettagliata dell’alloggio",
    copyGuestAccess: "Copia Accesso ospiti",
    copyGuestInteraction: "Copia Interazione con gli ospiti",
    copyOtherInfo: "Copia Altre informazioni da sapere",
    copyBookingSummary: "Copia riepilogo Booking",
    bookingSummaryCopied: "Riepilogo copiato negli appunti.",
    noBookingSummary: "Nessun riepilogo da copiare al momento.",
    auditUnavailable: "Audit non disponibile",
    auditCompleted: "Audit completato con successo",
    auditCompletedText: "Il tuo annuncio è stato analizzato e ora può essere ottimizzato.",
    businessReading: "Lettura business",
    heroTitle: "Dove il tuo annuncio perde prenotazioni e cosa puoi guadagnare",
    host: "Host",
    hostUnavailableAgoda: "Host non disponibile su Agoda",
    listingRating: "Valutazione dell’annuncio",
    ratingUnavailable: "Valutazione non disponibile",
    guestReviews: "recensioni ospiti",
    reviewsUnavailable: "Recensioni non disponibili",
    marketPosition: "Posizione sul mercato",
    businessImpact: "Impatto business",
    monthlyGainBenchmark: "Riferimento guadagno mensile",
    propertyProfile: "Profilo dell’alloggio",
    propertyType: "Tipologia di alloggio",
    notSpecified: "Non specificato",
    bedrooms: "Camere da letto",
    bathrooms: "Bagni",
    guests: "Ospiti",
    beds: "Letti",
    minimumStay: "Soggiorno minimo (notti)",
    marketPositioning: "Posizionamento di mercato",
    differentiatingAttributes: "Attributi distintivi",
    minimumStay1: "1 notte",
    minimumStay2: "2 notti",
    minimumStay3: "3 notti",
    minimumStay5: "5 notti",
    minimumStay7: "7 notti",
    minimumStay14: "14 notti",
    marketTierStandard: "Standard",
    marketTierHighEnd: "Fascia alta",
    marketTierPremium: "Premium",
    marketTierExperientialLuxury: "Lusso esperienziale",
    marketTierUltraLuxury: "Ultra lusso",
    attributePrivatePool: "Piscina privata",
    attributeSeaView: "Vista mare",
    attributeBeachfront: "Fronte mare",
    attributeJacuzzi: "Jacuzzi",
    attributeParking: "Parcheggio",
    attributeAirConditioning: "Aria condizionata",
    attributeWifi: "Wifi",
    attributeGym: "Palestra",
    attributeTerrace: "Terrazza",
    attributeConcierge: "Concierge",
    comparableWeightingHint: "Ponderazione dei comparabili — non è un filtro rigido.",
    marketRecalculationOnly: "Solo ricalcolo del mercato — analisi IA e punteggi invariati.",
    diagnostic: "Diagnostica…",
    recalibrateMarket: "Ricalibra il mercato",
    premiumMarketInsufficient: "Mercato premium insufficiente",
    marketRecalibrated: "Mercato ricalibrato",
    premiumMarketText: "Abbiamo analizzato i comparabili disponibili, ma nessuno è abbastanza vicino al segmento premium selezionato. Le stime restano volutamente prudenti.",
    recalibratedMarketText: "Il segmento competitivo è stato affinato usando gli annunci comparabili più vicini.",
    comparablesAnalyzed: "Comparabili analizzati",
    premiumComparables: "Comparabili premium mantenuti",
    comparablesKept: "Comparabili mantenuti",
    recalibratedMedian: "Mediana ricalibrata",
    recalibratedAverage: "Media ricalibrata",
    reliability: "Affidabilità",
    conversionLevel: "Livello di conversione",
    conversionFragile: "Riferimento conversione: fragile",
    conversionModerate: "Riferimento conversione: moderato",
    conversionStrong: "Riferimento conversione: solido",
    conversionScore: "Punteggio di conversione",
    estimatedImpact: "Impatto stimato",
    ceiling: "Tetto massimo",
    impactToConfirm: "Impatto da confermare",
    readingWithoutRange: "Lettura senza intervallo %",
    listingAnalysis: "Analisi dell’annuncio",
    listingQuality: "Qualità dell’annuncio",
    listingQualityDescription: "Analisi interna del tuo annuncio: foto, ordine visivo, descrizione, dotazioni, SEO e capacità di conversione.",
    globalConversionLevel: "Livello globale di conversione",
    realMarket: "Mercato reale",
    observedMarket: "Mercato osservato",
    observedMarketDescription: "Lettura basata sui comparabili mantenuti, sui prezzi osservati dei concorrenti, sull’affidabilità del mercato e sul gap tariffario calcolato.",
    listingCompetitivePosition: "Come si posiziona il tuo annuncio",
    competitiveSummary: "Lettura sintetica della tua posizione competitiva basata sugli annunci comparabili mantenuti.",
    marketPositioningLabel: "Posizionamento sul mercato",
    positioning: "Posizionamento",
    listingScore: "Punteggio annuncio",
    market: "Mercato",
    base: "Base",
    averageCompetitiveQuality: "Qualità competitiva media",
    localSegment: "Segmento locale",
    comparedPrices: "Prezzi confrontati",
    consolidatedScore: "Punteggio consolidato",
    marketReliability: "Affidabilità del mercato",
    prioritySummary: "Sintesi prioritaria",
    topThreeLevers: "Le 3 leve a maggior impatto",
    actionable: "Azionabile",
    strengthenDescription: "Rafforzare la descrizione",
    improveSeo: "Migliorare la SEO",
    preserveStrengths: "Preservare i punti di forza attuali",
    marketPriorityDescriptionOne: "Punteggio descrizione: {score}. Priorità: rendere la promessa più concreta e più differenziante.",
    marketPriorityDescriptionTwo: "Punteggio SEO: {score}. Aggiungere parole chiave locali, dotazioni forti ed elementi ricercati.",
    marketPriorityDescriptionThree: "Foto: {photoScore} · Dotazioni: {amenitiesScore}. Questi segnali sostengono già la fiducia.",
    marketLabelAbove: "Al di sopra del livello competitivo",
    marketLabelBelow: "Al di sotto del livello competitivo",
    marketLabelCompetitive: "Nella media competitiva",
    marketPositionToConfirm: "Posizione da confermare",
    marketBenchmarkAbove: "Il tuo annuncio si colloca attualmente a {value} punti sopra il punteggio medio osservato.",
    marketBenchmarkBelow: "Il tuo annuncio si colloca attualmente a {value} punti sotto il punteggio medio osservato.",
    marketBenchmarkAligned: "Il tuo annuncio si colloca al livello medio degli annunci comparabili osservati.",
    marketBenchmarkNone: "Nessun comparabile è stato trattenuto per questa lettura nell’area osservata.",
    marketBenchmarkOne: "Lettura costruita a partire da 1 annuncio comparabile nella tua zona.",
    marketBenchmarkMany: "Lettura costruita a partire da {count} annunci comparabili nella tua zona.",
    marketBenchmarkPending: "La lettura locale sarà disponibile non appena verrà osservato un volume sufficiente di annunci comparabili.",
    marketScoreContextAbove: "Il tuo punteggio supera nettamente la media attuale del mercato.",
    marketScoreContextBelow: "Il tuo punteggio resta sotto il livello osservato sul mercato.",
    marketScoreContextAligned: "Il tuo punteggio è perfettamente allineato al livello medio del mercato.",
    marketScoreContextObserved: "Lettura basata sugli annunci comparabili osservati.",
    marketScoreContextMarketBelow: "La media del mercato resta inferiore al livello attuale del tuo annuncio.",
    marketScoreContextMarketAbove: "La media del mercato resta superiore al livello attuale del tuo annuncio.",
    marketScoreContextMarketAligned: "Il tuo annuncio e il mercato si collocano su un livello simile.",
    marketScoreContextUnavailable: "Il punteggio medio del mercato verrà mostrato non appena saranno disponibili abbastanza annunci osservati.",
    marketPositionNarrativeCompetitive: "Questo annuncio si colloca complessivamente nella media dei concorrenti vicini.",
    heroMarketPositionSupport: "Riferimento dettagliato (comparabili, punteggio relativo, segnali testuali): blocco « Posizionamento di mercato ».",
    heroImpactSupportOutOfSegment: "Comparabili trattenuti fuori dal segmento di prezzo: le stime business non sono affidabili per questo annuncio. Restano sfruttabili solo le leve di qualità e contenuto.",
    heroImpactSupportDefault: "Indicatori numerici: % per il lift e €/mese per i ricavi in « Impatto stimato sulle prenotazioni »; punteggio /10 nella colonna di destra.",
    heroImpactSupportCompetitive: "L’annuncio è già competitivo. I guadagni residui deriveranno soprattutto da aggiustamenti più fini sul posizionamento di prezzo e sulla chiarezza del valore, per catturare una quota marginale ma reale di prenotazioni aggiuntive.",
    heroBusinessLiftHintPrudent: "Proiezione prudente basata sul prezzo attuale e sul potenziale di conversione, senza una base tariffaria di mercato sufficiente.",
    heroBusinessLiftHintInsufficient: "I dati di mercato sono insufficienti per stimare un impatto quantificato affidabile.",
    heroBusinessLiftHintDefault: "Un annuncio ottimizzato può migliorare i ricavi mensili, a seconda della qualità del mercato osservato e del reale livello di conversione.",
    heroRevenueSupportUnavailable: "Stima non disponibile — dati di mercato insufficienti per questa lettura aggregata.",
    heroRevenueSupportIndicative: "Stima indicativa basata sul prezzo consigliato, sul livello del mercato osservato e su un tasso di occupazione obiettivo realistico.",
    heroRevenueSupportPrudent: "Indicatore prudente: verifica il volume di prenotazioni e i comparabili prima di investire in modo duraturo sul prezzo.",
    heroRevenueSupportFallback: "Consolida il prezzo mostrato e un riferimento di mercato (comparabili) per attivare una lettura quantificata.",
    photoBadgeMedium: "{count} foto • galleria corretta",
    heroImpactRevenueRange: "+{low} a +{high} / mese",
    impactSideCardNarrativeCondensed: "Vista sintetica: l’intera fascia % è nella scheda « {label} » qui sotto.",
    heroScoreNarrativeStrong: "Lettura /10: livello solido — affinare con le raccomandazioni del report.",
    marketReliabilityBadgeHigh: "Buona affidabilità",
    marketReliabilityBadgeMedium: "Affidabilità media",
    marketReliabilityBadgeLow: "Affidabilità bassa",
    marketReliabilityBadgeWeakFallback: "Fallback debole",
    marketReliabilityMessageHigh: "Base di mercato utilizzabile con diversi comparabili coerenti.",
    marketReliabilityMessageMedium: "Base di mercato indicativa, ancora da consolidare.",
    marketReliabilityMessageLow: "Base di mercato limitata: lettura da interpretare con prudenza.",
    marketReliabilityMessageWeakFallback: "Solo base di mercato di fallback: lettura da interpretare con prudenza rafforzata.",
    marketComparablesBodyStrong: "Base competitiva utilizzabile per collocare il tuo annuncio nel suo segmento.",
    marketComparablesBodyNone: "Nessun comparabile affidabile è stato trattenuto per questa lettura di mercato.",
    marketComparablesBodyLimited: "{base} Campione ridotto: lettura utile, ma ancora da consolidare.",
    toConfirm: "da confermare",
    pricingPositioning: "Posizionamento prezzo",
    pricingOpportunity: "Opportunità di prezzo rilevata",
    pricingAligned: "Prezzo allineato al mercato",
    pricingAboveMedian: "Prezzo sopra la mediana",
    observedMedian: "Mediana osservata",
    recommendedPrice: "Prezzo consigliato",
    belowMedian: "Sotto la mediana",
    marketAligned: "Allineato al mercato",
    aboveMedian: "Sopra la mediana",
    potentialMonthlyGain: "Guadagno mensile potenziale",
    estimatedMonthlyRisk: "Rischio mensile stimato",
    estimatedMonthlyImpact: "Impatto mensile stimato",
    pricingAssumption: "Ipotesi pricing: 20 notti / mese",
    insufficientComparablePricing: "Dati insufficienti: nessun comparabile affidabile per stimare mediana o impatto di prezzo.",
    insufficientPricingData: "Dati di mercato insufficienti per stimare un impatto prezzo affidabile.",
    pricingBenchmarks: "Benchmark di prezzo",
    pricingBenchmarksTitle: "Come si colloca il tuo prezzo rispetto ai concorrenti",
    pricingBenchmarksDescription: "Benchmark di prezzo basati sui prezzi medi osservati e sul gap stimato rispetto al mercato comparabile.",
    averageCompetitorPrice: "Prezzo medio dei concorrenti",
    priceGapVsMarket: "Gap di prezzo vs mercato",
    notReliable: "Non affidabile",
    marketAnalysisPending: "Analisi in attesa di un campione di mercato sufficiente.",
    businessProjection: "Proiezione business",
    projectionsPotential: "Proiezioni e potenziale",
    projectionsDescription: "Stime indicative basate su segnali di mercato, posizionamento competitivo e potenziale di conversione osservato.",
    nightlyPrice: "Prezzo per notte",
    premiumPosition: "Posizione premium",
    aggressivePosition: "Posizione aggressiva",
    balancedPosition: "Posizione equilibrata",
    qualitativeAnalysisOnly: "Solo analisi qualitativa",
    businessPotentialAfterOptimization: "Potenziale business dopo l’ottimizzazione",
    projectionBase: "Base di proiezione",
    crossPlatformReading: "Lettura cross-platform",
    readableMarket: "Mercato leggibile",
    cautiousReading: "Lettura prudente",
    lowVisibility: "Bassa visibilità",
    conversionGainPotential: "Potenziale guadagno di conversione",
    actionableProjection: "Proiezione sfruttabile",
    limitedProjection: "Proiezione limitata",
    cautiousProjection: "Proiezione prudente",
    indicativeProjection: "Proiezione indicativa",
    estimatedMonthlyGainTitle: "Guadagno mensile stimato",
    optimizedTexts: "Testi dell’annuncio ottimizzati",
    variant: "Variante",
    changeVariant: "Cambia variante",
    descriptionCopied: "Descrizione copiata",
    currentTitle: "Titolo attuale",
    optimizedTitleExample: "Esempio di titolo ottimizzato",
    myPlace: "Il mio alloggio",
    detailedPlace: "Alloggio — versione dettagliata",
    guestAccess: "Accesso ospiti",
    guestInteraction: "Interazione con gli ospiti",
    otherInfo: "Altre informazioni da sapere",
    bookingDescriptionSummary: "Riepilogo descrizione (Booking)",
    bookingSummaryReady: "Riepilogo pronto da incollare, allineato alla variante visualizzata.",
    actionPlan: "Piano d’azione",
    actionPlanSubtitle: "Progetti da avviare subito, ordinati per impatto business.",
    businessPriority: "Priorità business",
    quickOptimization: "Ottimizzazione rapida",
    visibility: "Visibilità",
    reassurance: "Rassicurazione",
    improvement: "Miglioramento",
    photoQuality: "Qualità delle foto",
    photoOrderQuality: "Ordine delle foto",
    descriptionQualityLabel: "Qualità della descrizione",
    amenitiesCompletenessLabel: "Completezza dei servizi",
    seoPerformance: "Performance SEO",
    scoreOverviewTitle: "Lettura dettagliata della tua performance di conversione",
    scoreOverviewTextAirbnb: "Lettura basata sui segnali visibili: la base invita a rafforzare emozione, ospitalità e unicità dell’annuncio.",
    scoreOverviewTextDefault: "Lettura basata sui segnali visibili: la base permette di ottimizzare chiarezza, rassicurazione e conversione.",
    scoreStatusConfirm: "Da confermare",
    scoreStatusPartialData: "Dati ancora parziali",
    scoreStatusExcellent: "Eccellente",
    scoreStatusExcellentDetail: "Chiaro vantaggio competitivo",
    scoreStatusStrong: "Solido",
    scoreStatusStrongDetail: "Segnale positivo da mantenere",
    scoreStatusCorrect: "Corretto",
    scoreStatusCorrectDetail: "Ulteriore ottimizzazione possibile",
    scoreStatusNeedsWork: "Da rafforzare",
    scoreStatusNeedsWorkDetail: "Impatto visibile sulla conversione",
    scoreStatusWeak: "Debole",
    scoreStatusWeakDetail: "Priorità di miglioramento",
    subScorePhotosNote: "Le immagini creano una prima impressione solida e rassicurante. Aiutano il viaggiatore a capire rapidamente la qualità dell’alloggio e riducono le esitazioni prima della prenotazione.",
    subScorePhotosFallback: "Dati fotografici insufficienti per affinare questo aspetto.",
    subScorePhotosImpact: "Impatto: forte su clic e fiducia.",
    subScorePhotosPriority: "Priorità: mantenere questo livello.",
    subScorePhotoOrderNote: "L’ordine delle foto valorizza bene gli elementi più attrattivi. Le prime immagini devono confermare immediatamente comfort, spazio e valore percepito dell’alloggio.",
    subScorePhotoOrderFallback: "L’ordine visivo andrà confermato quando i segnali saranno più completi.",
    subScorePhotoOrderImpact: "Impatto: migliora la prima impressione.",
    subScorePhotoOrderPriority: "Priorità: mantenere per primi gli spazi migliori.",
    subScoreDescriptionNote: "Il testo è corretto, ma può vendere meglio l’esperienza reale: atmosfera, comfort, vantaggi concreti, accesso, quartiere e motivi per scegliere questo alloggio rispetto a un altro.",
    subScoreDescriptionFallback: "Testo troppo limitato o poco sfruttabile per una lettura affidabile in questa vista.",
    subScoreDescriptionImpact: "Impatto: rafforza la proiezione del viaggiatore.",
    subScoreDescriptionPriority: "Priorità: rendere la promessa più concreta.",
    subScoreAmenitiesNote: "I servizi visibili rafforzano la percezione di comfort. Più sono precisi e ben presentati, più rassicurano il viaggiatore sulla qualità del soggiorno.",
    subScoreAmenitiesFallback: "Servizi poco visibili o non indicati: lettura da completare.",
    subScoreAmenitiesImpact: "Impatto: rassicura sul comfort del soggiorno.",
    subScoreAmenitiesPriority: "Priorità: presentare meglio i servizi chiave.",
    subScoreSeoNote: "La SEO è utilizzabile, ma può guadagnare in precisione. Titolo, parole chiave locali e servizi ricercati devono aiutare la piattaforma a comprendere meglio l’annuncio.",
    subScoreSeoFallback: "I segnali sono troppo parziali per concludere su questo aspetto.",
    subScoreSeoImpact: "Impatto: aiuta la piattaforma a classificare meglio l’annuncio.",
    subScoreSeoPriority: "Priorità: rafforzare titolo e parole chiave utili.",
    subScoreConversionNote: "Il potenziale di conversione è buono, ma restano leve da attivare. I guadagni arriveranno soprattutto da una promessa più chiara, maggiore rassicurazione e contenuti più concreti.",
    subScoreConversionFallback: "Lettura da consolidare con dati aggiuntivi.",
    subScoreConversionImpact: "Impatto: agisce direttamente sulla decisione di prenotare.",
    subScoreConversionPriority: "Priorità: migliorare rassicurazione e chiarezza.",
    iqaBusinessIndicator: "Indicatore business",
    iqaPerceivedListingQuality: "Qualità percepita dell’annuncio",
    iqaReading: "Lettura IQA",
    iqaNarrativePremium: "Lettura premium: il livello complessivo percepito risulta solido rispetto al mercato analizzato.",
    iqaNarrativeCompetitive: "Base competitiva corretta con diverse leve ancora attivabili.",
    iqaNarrativeFragile: "Il posizionamento qualitativo resta fragile rispetto agli annunci concorrenti osservati.",
    iqaNarrativeRebuilt: "Lettura ricostruita a partire dai segnali visibili e dal punteggio complessivo dell’audit.",
    lqiLabelHighSignal: "Segnale alto",
    lqiLabelFavorable: "Segnale favorevole",
    lqiLabelImproving: "In miglioramento",
    lqiLabelNeedsWork: "Da rafforzare",
    lqiSummaryNoObject: "Nel report non è presente alcun oggetto LQI: i valori /100 sono una sintesi locale costruita a partire dagli stessi segnali /10 del resto della pagina — una lettura aggregata, non un secondo insieme indipendente di misurazioni.",
    lqiSummaryIndicativeScore: "Il punteggio principale /100 è indicativo: deriva dal punteggio globale /10 poiché nel report non è disponibile un indice IQA numerico nativo.",
    lqiSummaryOverview: "Panoramica qualità / mercato / conversione: sotto ogni scheda — «Componente del report» = campo strutturato fornito; «Sintesi locale» = aggregato dei /10 già presenti nella pagina; «Complemento del report» = altro campo del report (ad es. potenziale di prenotazione), non una misura di conversione isolata.",
    lqiSummaryPending: "Questo indicatore verrà visualizzato quando i segnali utili saranno disponibili.",
    lqiSummaryCompetitiveButOptimizable: "L’annuncio è competitivo, ma alcune leve visibili possono ancora migliorare la conversione e il posizionamento, soprattutto rendendo la promessa di valore più esplicita fin dal primo schermo.",
    listingConversion: "Conversione dell’annuncio",
  },
  pt: {
    loading: "A carregar a auditoria…",
    loadingWait: "Aguarde enquanto o relatório é carregado.",
    notFound: "Esta auditoria não foi encontrada. Inicie uma nova análise a partir da página de anúncios.",
    copied: "Copiado",
    copyAction: "Copiar",
    copyUnavailable: "Não é possível copiar o conteúdo neste momento.",
    copyMainDescription: "Copiar descrição principal",
    copyOptimizedTitle: "Copiar título otimizado",
    copyHousing: "Copiar O meu alojamento",
    copyDetailedHousing: "Copiar versão detalhada do alojamento",
    copyGuestAccess: "Copiar Acesso dos hóspedes",
    copyGuestInteraction: "Copiar Interação com os hóspedes",
    copyOtherInfo: "Copiar Outras informações a ter em conta",
    copyBookingSummary: "Copiar resumo Booking",
    bookingSummaryCopied: "Resumo copiado para a área de transferência.",
    noBookingSummary: "Não há resumo para copiar neste momento.",
    auditUnavailable: "Auditoria indisponível",
    auditCompleted: "Auditoria concluída com sucesso",
    auditCompletedText: "O seu anúncio foi analisado e já pode ser otimizado.",
    businessReading: "Leitura business",
    heroTitle: "Onde o seu anúncio perde reservas e o que pode ganhar",
    host: "Anfitrião",
    hostUnavailableAgoda: "Anfitrião indisponível na Agoda",
    listingRating: "Avaliação do anúncio",
    ratingUnavailable: "Avaliação indisponível",
    guestReviews: "avaliações de hóspedes",
    reviewsUnavailable: "Avaliações indisponíveis",
    marketPosition: "Posição no mercado",
    businessImpact: "Impacto business",
    monthlyGainBenchmark: "Referência de ganho mensal",
    propertyProfile: "Perfil do alojamento",
    propertyType: "Tipo de alojamento",
    notSpecified: "Não especificado",
    bedrooms: "Quartos",
    bathrooms: "Casas de banho",
    guests: "Hóspedes",
    beds: "Camas",
    minimumStay: "Estadia mínima (noites)",
    marketPositioning: "Posicionamento de mercado",
    differentiatingAttributes: "Atributos diferenciadores",
    minimumStay1: "1 noite",
    minimumStay2: "2 noites",
    minimumStay3: "3 noites",
    minimumStay5: "5 noites",
    minimumStay7: "7 noites",
    minimumStay14: "14 noites",
    marketTierStandard: "Standard",
    marketTierHighEnd: "Alta gama",
    marketTierPremium: "Premium",
    marketTierExperientialLuxury: "Luxo experiencial",
    marketTierUltraLuxury: "Ultra luxo",
    attributePrivatePool: "Piscina privada",
    attributeSeaView: "Vista mar",
    attributeBeachfront: "Frente à praia",
    attributeJacuzzi: "Jacuzzi",
    attributeParking: "Estacionamento",
    attributeAirConditioning: "Ar condicionado",
    attributeWifi: "Wifi",
    attributeGym: "Ginásio",
    attributeTerrace: "Terraço",
    attributeConcierge: "Concierge",
    comparableWeightingHint: "Ponderação de comparáveis — não é um filtro rígido.",
    marketRecalculationOnly: "Apenas recálculo do mercado — análise IA e pontuações inalteradas.",
    diagnostic: "Diagnóstico…",
    recalibrateMarket: "Recalibrar mercado",
    premiumMarketInsufficient: "Mercado premium insuficiente",
    marketRecalibrated: "Mercado recalibrado",
    premiumMarketText: "Analisámos os comparáveis disponíveis, mas nenhum está suficientemente próximo do segmento premium selecionado. As estimativas mantêm-se deliberadamente prudentes.",
    recalibratedMarketText: "O segmento competitivo foi refinado com base nos comparáveis mais próximos.",
    comparablesAnalyzed: "Comparáveis analisados",
    premiumComparables: "Comparáveis premium retidos",
    comparablesKept: "Comparáveis mantidos",
    recalibratedMedian: "Mediana recalibrada",
    recalibratedAverage: "Média recalibrada",
    reliability: "Fiabilidade",
    conversionLevel: "Nível de conversão",
    conversionFragile: "Referência de conversão: frágil",
    conversionModerate: "Referência de conversão: moderada",
    conversionStrong: "Referência de conversão: sólida",
    conversionScore: "Pontuação de conversão",
    estimatedImpact: "Impacto estimado",
    ceiling: "Teto",
    impactToConfirm: "Impacto por confirmar",
    readingWithoutRange: "Leitura sem intervalo %",
    listingAnalysis: "Análise do anúncio",
    listingQuality: "Qualidade do anúncio",
    listingQualityDescription: "Análise interna do seu anúncio: fotos, ordem visual, descrição, comodidades, SEO e capacidade de conversão.",
    globalConversionLevel: "Nível global de conversão",
    realMarket: "Mercado real",
    observedMarket: "Mercado observado",
    observedMarketDescription: "Leitura baseada nos comparáveis retidos, nos preços concorrentes observados, na fiabilidade do mercado e na diferença tarifária calculada.",
    listingCompetitivePosition: "Como o seu anúncio se posiciona",
    competitiveSummary: "Leitura sintética da sua posição competitiva com base nos anúncios comparáveis retidos.",
    marketPositioningLabel: "Posicionamento no mercado",
    positioning: "Posicionamento",
    listingScore: "Pontuação do anúncio",
    market: "Mercado",
    base: "Base",
    averageCompetitiveQuality: "Qualidade competitiva média",
    localSegment: "Segmento local",
    comparedPrices: "Preços comparados",
    consolidatedScore: "Pontuação consolidada",
    marketReliability: "Fiabilidade do mercado",
    prioritySummary: "Resumo prioritário",
    topThreeLevers: "As 3 alavancas de maior impacto",
    actionable: "Acionável",
    strengthenDescription: "Reforçar a descrição",
    improveSeo: "Melhorar o SEO",
    preserveStrengths: "Preservar os pontos fortes atuais",
    marketPriorityDescriptionOne: "Pontuação da descrição: {score}. Prioridade: tornar a promessa mais concreta e mais diferenciadora.",
    marketPriorityDescriptionTwo: "Pontuação SEO: {score}. Adicionar palavras-chave locais, comodidades fortes e elementos procurados.",
    marketPriorityDescriptionThree: "Fotos: {photoScore} · Comodidades: {amenitiesScore}. Estes sinais já reforçam a confiança.",
    marketLabelAbove: "Acima do nível concorrencial",
    marketLabelBelow: "Abaixo do nível concorrencial",
    marketLabelCompetitive: "Na média concorrencial",
    marketPositionToConfirm: "Posição por confirmar",
    marketBenchmarkAbove: "O seu anúncio posiciona-se atualmente {value} pontos acima da pontuação média observada.",
    marketBenchmarkBelow: "O seu anúncio posiciona-se atualmente {value} pontos abaixo da pontuação média observada.",
    marketBenchmarkAligned: "O seu anúncio situa-se ao nível médio dos anúncios comparáveis observados.",
    marketBenchmarkNone: "Nenhum comparável foi retido para esta leitura na zona observada.",
    marketBenchmarkOne: "Leitura estabelecida a partir de 1 anúncio comparável na sua zona.",
    marketBenchmarkMany: "Leitura estabelecida a partir de {count} anúncios comparáveis na sua zona.",
    marketBenchmarkPending: "A leitura local ficará disponível assim que for observado um volume suficiente de anúncios comparáveis.",
    marketScoreContextAbove: "A sua pontuação ultrapassa claramente a média atual do mercado.",
    marketScoreContextBelow: "A sua pontuação mantém-se abaixo do nível observado no mercado.",
    marketScoreContextAligned: "A sua pontuação está perfeitamente alinhada com o nível médio do mercado.",
    marketScoreContextObserved: "Leitura baseada nos anúncios comparáveis observados.",
    marketScoreContextMarketBelow: "A média do mercado continua abaixo do nível atual do seu anúncio.",
    marketScoreContextMarketAbove: "A média do mercado continua acima do nível atual do seu anúncio.",
    marketScoreContextMarketAligned: "O seu anúncio e o mercado situam-se num nível semelhante.",
    marketScoreContextUnavailable: "A pontuação média do mercado será exibida assim que houver anúncios observados suficientes disponíveis.",
    marketPositionNarrativeCompetitive: "Este anúncio situa-se globalmente na média dos concorrentes próximos.",
    heroMarketPositionSupport: "Referência detalhada (comparáveis, pontuação relativa, textos): bloco « Posicionamento no mercado ».",
    heroImpactSupportOutOfSegment: "Comparáveis retidos fora do segmento de preço — estimativas de negócio não fiáveis para este anúncio. Apenas os eixos de qualidade e conteúdo continuam exploráveis.",
    heroImpactSupportDefault: "Referências numéricas: % para o lift e €/mês para a receita em « Impacto estimado nas reservas »; pontuação /10 na coluna da direita.",
    heroImpactSupportCompetitive: "O anúncio já é competitivo. Os ganhos restantes virão sobretudo de ajustes mais finos no posicionamento de preço e na clareza do valor, para captar uma parcela marginal mas real de reservas adicionais.",
    heroBusinessLiftHintPrudent: "Projeção prudente baseada no preço atual e no potencial de conversão, sem base tarifária de mercado suficiente.",
    heroBusinessLiftHintInsufficient: "Dados de mercado insuficientes para estimar um impacto quantificado fiável.",
    heroBusinessLiftHintDefault: "Um anúncio otimizado pode melhorar a sua receita mensal, dependendo da qualidade do mercado observado e do nível real de conversão.",
    heroRevenueSupportUnavailable: "Estimativa indisponível — dados de mercado insuficientes para esta leitura agregada.",
    heroRevenueSupportIndicative: "Estimativa indicativa baseada no preço recomendado, no nível do mercado observado e numa ocupação-alvo realista.",
    heroRevenueSupportPrudent: "Referência prudente: verifique o volume de reservas e os comparáveis antes de investir de forma duradoura no preço.",
    heroRevenueSupportFallback: "Consolide o preço anunciado e uma referência de mercado (comparáveis) para ativar uma leitura quantificada.",
    photoBadgeMedium: "{count} fotos • galeria correta",
    heroImpactRevenueRange: "+{low} a +{high} / mês",
    impactSideCardNarrativeCondensed: "Vista condensada: a faixa completa em % está no cartão « {label} » abaixo.",
    heroScoreNarrativeStrong: "Leitura /10: nível sólido — afinar com as recomendações do relatório.",
    marketReliabilityBadgeHigh: "Boa fiabilidade",
    marketReliabilityBadgeMedium: "Fiabilidade média",
    marketReliabilityBadgeLow: "Fiabilidade baixa",
    marketReliabilityBadgeWeakFallback: "Fallback frágil",
    marketReliabilityMessageHigh: "Base de mercado utilizável com vários comparáveis coerentes.",
    marketReliabilityMessageMedium: "Base de mercado indicativa, ainda por consolidar.",
    marketReliabilityMessageLow: "Base de mercado limitada: leitura a interpretar com prudência.",
    marketReliabilityMessageWeakFallback: "Base de mercado de recurso apenas: leitura a interpretar com prudência reforçada.",
    marketComparablesBodyStrong: "Base concorrencial utilizável para situar o seu anúncio no seu segmento.",
    marketComparablesBodyNone: "Nenhum comparável fiável foi retido para esta leitura de mercado.",
    marketComparablesBodyLimited: "{base} Amostra reduzida: leitura útil, mas ainda por consolidar.",
    toConfirm: "por confirmar",
    pricingPositioning: "Posicionamento de preço",
    pricingOpportunity: "Oportunidade de preço detetada",
    pricingAligned: "Preço alinhado com o mercado",
    pricingAboveMedian: "Preço acima da mediana",
    observedMedian: "Mediana observada",
    recommendedPrice: "Preço recomendado",
    belowMedian: "Abaixo da mediana",
    marketAligned: "Alinhado com o mercado",
    aboveMedian: "Acima da mediana",
    potentialMonthlyGain: "Ganho mensal potencial",
    estimatedMonthlyRisk: "Risco mensal estimado",
    estimatedMonthlyImpact: "Impacto mensal estimado",
    pricingAssumption: "Hipótese de preço: 20 noites / mês",
    insufficientComparablePricing: "Dados insuficientes: nenhum comparável fiável para estimar a mediana ou o impacto tarifário.",
    insufficientPricingData: "Dados de mercado insuficientes para estimar um impacto tarifário fiável.",
    pricingBenchmarks: "Referências de preço",
    pricingBenchmarksTitle: "Como o seu preço se posiciona face aos concorrentes",
    pricingBenchmarksDescription: "Referências de preço baseadas nos preços médios observados e na diferença estimada face ao mercado comparável.",
    averageCompetitorPrice: "Preço médio dos concorrentes",
    priceGapVsMarket: "Diferença de preço vs mercado",
    notReliable: "Não fiável",
    marketAnalysisPending: "Análise pendente até existir uma amostra de mercado suficiente.",
    businessProjection: "Projeção business",
    projectionsPotential: "Projeções e potencial",
    projectionsDescription: "Estimativas indicativas baseadas em sinais de mercado, posicionamento competitivo e potencial de conversão observado.",
    nightlyPrice: "Preço por noite",
    premiumPosition: "Posição premium",
    aggressivePosition: "Posição agressiva",
    balancedPosition: "Posição equilibrada",
    qualitativeAnalysisOnly: "Apenas análise qualitativa",
    businessPotentialAfterOptimization: "Potencial business após otimização",
    projectionBase: "Base de projeção",
    crossPlatformReading: "Leitura cross-platform",
    readableMarket: "Mercado legível",
    cautiousReading: "Leitura prudente",
    lowVisibility: "Baixa visibilidade",
    conversionGainPotential: "Potencial de ganho de conversão",
    actionableProjection: "Projeção acionável",
    limitedProjection: "Projeção limitada",
    cautiousProjection: "Projeção prudente",
    indicativeProjection: "Projeção indicativa",
    estimatedMonthlyGainTitle: "Ganho mensal estimado",
    optimizedTexts: "Textos otimizados do anúncio",
    variant: "Variante",
    changeVariant: "Mudar variante",
    descriptionCopied: "Descrição copiada",
    currentTitle: "Título atual",
    optimizedTitleExample: "Exemplo de título otimizado",
    myPlace: "O meu alojamento",
    detailedPlace: "Alojamento — versão detalhada",
    guestAccess: "Acesso dos hóspedes",
    guestInteraction: "Interação com os hóspedes",
    otherInfo: "Outras informações a ter em conta",
    bookingDescriptionSummary: "Resumo da descrição (Booking)",
    bookingSummaryReady: "Resumo pronto a colar, alinhado com a variante apresentada.",
    actionPlan: "Plano de ação",
    actionPlanSubtitle: "Projetos a lançar agora, ordenados por impacto business.",
    businessPriority: "Prioridade business",
    quickOptimization: "Otimização rápida",
    visibility: "Visibilidade",
    reassurance: "Reforço de confiança",
    improvement: "Melhoria",
    photoQuality: "Qualidade das fotos",
    photoOrderQuality: "Ordem das fotos",
    descriptionQualityLabel: "Qualidade da descrição",
    amenitiesCompletenessLabel: "Completude das comodidades",
    seoPerformance: "Desempenho SEO",
    scoreOverviewTitle: "Leitura detalhada da sua performance de conversão",
    scoreOverviewTextAirbnb: "Leitura baseada nos sinais visíveis: a base convida a reforçar a emoção, a hospitalidade e a singularidade do anúncio.",
    scoreOverviewTextDefault: "Leitura baseada nos sinais visíveis: a base permite otimizar clareza, confiança e conversão.",
    scoreStatusConfirm: "A confirmar",
    scoreStatusPartialData: "Dados ainda parciais",
    scoreStatusExcellent: "Excelente",
    scoreStatusExcellentDetail: "Vantagem competitiva clara",
    scoreStatusStrong: "Sólido",
    scoreStatusStrongDetail: "Sinal positivo a manter",
    scoreStatusCorrect: "Correto",
    scoreStatusCorrectDetail: "Ainda é possível otimizar",
    scoreStatusNeedsWork: "A reforçar",
    scoreStatusNeedsWorkDetail: "Impacto visível na conversão",
    scoreStatusWeak: "Fraco",
    scoreStatusWeakDetail: "Prioridade de melhoria",
    subScorePhotosNote: "Os visuais criam uma primeira impressão sólida e tranquilizadora. Ajudam o viajante a perceber rapidamente a qualidade do alojamento e reduzem as hesitações antes da reserva.",
    subScorePhotosFallback: "Dados fotográficos insuficientes para afinar este aspeto.",
    subScorePhotosImpact: "Impacto: forte no clique e na confiança.",
    subScorePhotosPriority: "Prioridade: manter este nível.",
    subScorePhotoOrderNote: "A ordem das fotos destaca bem os elementos mais atrativos. As primeiras imagens devem confirmar imediatamente o conforto, o espaço e o valor percebido do alojamento.",
    subScorePhotoOrderFallback: "A ordem visual deverá ser confirmada quando os sinais forem mais completos.",
    subScorePhotoOrderImpact: "Impacto: melhora a primeira impressão.",
    subScorePhotoOrderPriority: "Prioridade: manter os melhores espaços em primeiro lugar.",
    subScoreDescriptionNote: "O texto é correto, mas pode vender melhor a experiência real: ambiente, conforto, vantagens concretas, acesso, bairro e razões para escolher este alojamento em vez de outro.",
    subScoreDescriptionFallback: "Texto demasiado limitado ou pouco aproveitável para uma leitura fiável aqui.",
    subScoreDescriptionImpact: "Impacto: reforça a projeção do viajante.",
    subScoreDescriptionPriority: "Prioridade: tornar a promessa mais concreta.",
    subScoreAmenitiesNote: "As comodidades visíveis reforçam a perceção de conforto. Quanto mais precisas e bem apresentadas estiverem, mais tranquilizam o viajante quanto à qualidade da estadia.",
    subScoreAmenitiesFallback: "Comodidades pouco visíveis ou não indicadas: leitura a completar.",
    subScoreAmenitiesImpact: "Impacto: tranquiliza sobre o conforto da estadia.",
    subScoreAmenitiesPriority: "Prioridade: apresentar melhor as comodidades-chave.",
    subScoreSeoNote: "O SEO é aproveitável, mas pode ganhar precisão. O título, as palavras-chave locais e as comodidades procuradas devem ajudar a plataforma a compreender melhor o anúncio.",
    subScoreSeoFallback: "Os sinais são demasiado parciais para concluir sobre este aspeto.",
    subScoreSeoImpact: "Impacto: ajuda a plataforma a classificar melhor o anúncio.",
    subScoreSeoPriority: "Prioridade: reforçar o título e as palavras-chave úteis.",
    subScoreConversionNote: "O potencial de conversão é bom, mas ainda há alavancas a ativar. Os ganhos virão sobretudo de uma promessa mais clara, mais confiança e conteúdo mais concreto.",
    subScoreConversionFallback: "Leitura a consolidar com dados adicionais.",
    subScoreConversionImpact: "Impacto: atua diretamente na decisão de reservar.",
    subScoreConversionPriority: "Prioridade: melhorar confiança e clareza.",
    iqaBusinessIndicator: "Indicador business",
    iqaPerceivedListingQuality: "Qualidade percebida do anúncio",
    iqaReading: "Leitura IQA",
    iqaNarrativePremium: "Leitura premium: o nível global percebido mostra-se sólido face ao mercado analisado.",
    iqaNarrativeCompetitive: "Base competitiva correta com várias alavancas ainda ativáveis.",
    iqaNarrativeFragile: "O posicionamento de qualidade continua frágil face aos anúncios concorrentes observados.",
    iqaNarrativeRebuilt: "Leitura reconstruída a partir dos sinais visíveis e da pontuação global da auditoria.",
    lqiLabelHighSignal: "Sinal alto",
    lqiLabelFavorable: "Sinal favorável",
    lqiLabelImproving: "Em progressão",
    lqiLabelNeedsWork: "A reforçar",
    lqiSummaryNoObject: "Não existe objeto LQI no relatório: os valores /100 são uma síntese local construída a partir dos mesmos sinais /10 do restante da página — uma leitura agregada, não um segundo conjunto independente de medições.",
    lqiSummaryIndicativeScore: "A pontuação principal /100 é indicativa: deriva da pontuação global /10 porque não existe um índice IQA numérico nativo no relatório.",
    lqiSummaryOverview: "Visão geral qualidade / mercado / conversão: sob cada cartão — «Componente do relatório» = campo estruturado fornecido; «Síntese local» = agregado dos /10 já presentes na página; «Complemento do relatório» = outro campo do relatório (por exemplo, potencial de reservas), não uma medida de conversão isolada.",
    lqiSummaryPending: "Este indicador será apresentado quando os sinais úteis estiverem disponíveis.",
    lqiSummaryCompetitiveButOptimizable: "O anúncio é competitivo, mas algumas alavancas visíveis ainda podem melhorar a conversão e o posicionamento, nomeadamente ao tornar a proposta de valor mais explícita desde o primeiro ecrã.",
    listingConversion: "Conversão do anúncio",
  },
  nl: {
    loading: "Audit wordt geladen…",
    loadingWait: "Even geduld terwijl het rapport wordt geladen.",
    notFound: "Deze audit kon niet worden gevonden. Start een nieuwe analyse vanaf de pagina met advertenties.",
    copied: "Gekopieerd",
    copyAction: "Kopiëren",
    copyUnavailable: "De inhoud kan momenteel niet worden gekopieerd.",
    copyMainDescription: "Hoofdbeschrijving kopiëren",
    copyOptimizedTitle: "Geoptimaliseerde titel kopiëren",
    copyHousing: "Mijn verblijf kopiëren",
    copyDetailedHousing: "Gedetailleerde verblijfsversie kopiëren",
    copyGuestAccess: "Toegang voor gasten kopiëren",
    copyGuestInteraction: "Gastinteractie kopiëren",
    copyOtherInfo: "Andere nuttige informatie kopiëren",
    copyBookingSummary: "Booking-samenvatting kopiëren",
    bookingSummaryCopied: "Samenvatting naar het klembord gekopieerd.",
    noBookingSummary: "Er is momenteel geen samenvatting om te kopiëren.",
    auditUnavailable: "Audit niet beschikbaar",
    auditCompleted: "Audit succesvol voltooid",
    auditCompletedText: "Uw advertentie is geanalyseerd en kan nu worden geoptimaliseerd.",
    businessReading: "Business-inzicht",
    heroTitle: "Waar uw advertentie boekingen verliest en wat u kunt winnen",
    host: "Host",
    hostUnavailableAgoda: "Host niet beschikbaar op Agoda",
    listingRating: "Beoordeling van de advertentie",
    ratingUnavailable: "Beoordeling niet beschikbaar",
    guestReviews: "gastbeoordelingen",
    reviewsUnavailable: "Beoordelingen niet beschikbaar",
    marketPosition: "Marktpositie",
    businessImpact: "Business-impact",
    monthlyGainBenchmark: "Referentie maandelijkse winst",
    propertyProfile: "Profiel van het verblijf",
    propertyType: "Type verblijf",
    notSpecified: "Niet gespecificeerd",
    bedrooms: "Slaapkamers",
    bathrooms: "Badkamers",
    guests: "Gasten",
    beds: "Bedden",
    minimumStay: "Minimumverblijf (nachten)",
    marketPositioning: "Marktpositionering",
    differentiatingAttributes: "Onderscheidende kenmerken",
    minimumStay1: "1 nacht",
    minimumStay2: "2 nachten",
    minimumStay3: "3 nachten",
    minimumStay5: "5 nachten",
    minimumStay7: "7 nachten",
    minimumStay14: "14 nachten",
    marketTierStandard: "Standaard",
    marketTierHighEnd: "Hoog segment",
    marketTierPremium: "Premium",
    marketTierExperientialLuxury: "Belevingsluxe",
    marketTierUltraLuxury: "Ultra-luxe",
    attributePrivatePool: "Privézwembad",
    attributeSeaView: "Zeezicht",
    attributeBeachfront: "Aan het strand",
    attributeJacuzzi: "Jacuzzi",
    attributeParking: "Parkeren",
    attributeAirConditioning: "Airconditioning",
    attributeWifi: "Wifi",
    attributeGym: "Fitnessruimte",
    attributeTerrace: "Terras",
    attributeConcierge: "Conciërge",
    comparableWeightingHint: "Weging van vergelijkbare aanbiedingen — geen strikte filter.",
    marketRecalculationOnly: "Alleen marktherberekening — AI-analyse en scores blijven ongewijzigd.",
    diagnostic: "Diagnose…",
    recalibrateMarket: "Markt herkalibreren",
    premiumMarketInsufficient: "Premiummarkt onvoldoende",
    marketRecalibrated: "Markt herkalibreerd",
    premiumMarketText: "We hebben de beschikbare vergelijkbare aanbiedingen geanalyseerd, maar geen ervan ligt dicht genoeg bij het geselecteerde premiumsegment. De schattingen blijven daarom bewust voorzichtig.",
    recalibratedMarketText: "Het concurrentiesegment is verfijnd met behulp van de dichtstbijzijnde vergelijkbare aanbiedingen.",
    comparablesAnalyzed: "Vergelijkbare aanbiedingen geanalyseerd",
    premiumComparables: "Premium-vergelijkingen behouden",
    comparablesKept: "Vergelijkingen behouden",
    recalibratedMedian: "Herkalibreerde mediaan",
    recalibratedAverage: "Herkalibreerd gemiddelde",
    reliability: "Betrouwbaarheid",
    conversionLevel: "Conversieniveau",
    conversionFragile: "Conversiereferentie: fragiel",
    conversionModerate: "Conversiereferentie: gemiddeld",
    conversionStrong: "Conversiereferentie: sterk",
    conversionScore: "Conversiescore",
    estimatedImpact: "Geschatte impact",
    ceiling: "Plafond",
    impactToConfirm: "Impact te bevestigen",
    readingWithoutRange: "Interpretatie zonder %-bereik",
    listingAnalysis: "Advertentieanalyse",
    listingQuality: "Kwaliteit van de advertentie",
    listingQualityDescription: "Interne analyse van uw advertentie: foto’s, visuele volgorde, beschrijving, voorzieningen, SEO en conversiepotentieel.",
    globalConversionLevel: "Algemeen conversieniveau",
    realMarket: "Werkelijke markt",
    observedMarket: "Geobserveerde markt",
    observedMarketDescription: "Gebaseerd op behouden vergelijkbare aanbiedingen, geobserveerde concurrentieprijzen, marktbetrouwbaarheid en berekende prijsafwijking.",
    listingCompetitivePosition: "Hoe uw advertentie zich verhoudt",
    competitiveSummary: "Samenvattende lezing van uw concurrentiepositie op basis van de behouden vergelijkbare advertenties.",
    marketPositioningLabel: "Positionering op de markt",
    positioning: "Positionering",
    listingScore: "Advertentiescore",
    market: "Markt",
    base: "Basis",
    averageCompetitiveQuality: "Gemiddelde concurrentiekwaliteit",
    localSegment: "Lokaal segment",
    comparedPrices: "Vergeleken prijzen",
    consolidatedScore: "Geconsolideerde score",
    marketReliability: "Marktbetrouwbaarheid",
    prioritySummary: "Prioriteitsoverzicht",
    topThreeLevers: "De 3 hefbomen met de grootste impact",
    actionable: "Actiegericht",
    strengthenDescription: "Beschrijving versterken",
    improveSeo: "SEO verbeteren",
    preserveStrengths: "Huidige sterke punten behouden",
    marketPriorityDescriptionOne: "Beschrijvingsscore: {score}. Prioriteit: de belofte concreter en onderscheidender maken.",
    marketPriorityDescriptionTwo: "SEO-score: {score}. Lokale zoekwoorden, sterke voorzieningen en gezochte elementen toevoegen.",
    marketPriorityDescriptionThree: "Foto’s: {photoScore} · Voorzieningen: {amenitiesScore}. Deze signalen ondersteunen het vertrouwen al.",
    marketLabelAbove: "Boven het concurrentieniveau",
    marketLabelBelow: "Onder het concurrentieniveau",
    marketLabelCompetitive: "In het concurrentiegemiddelde",
    marketPositionToConfirm: "Positie te bevestigen",
    marketBenchmarkAbove: "Uw advertentie ligt momenteel {value} punten boven de waargenomen gemiddelde score.",
    marketBenchmarkBelow: "Uw advertentie ligt momenteel {value} punten onder de waargenomen gemiddelde score.",
    marketBenchmarkAligned: "Uw advertentie bevindt zich op het gemiddelde niveau van de waargenomen vergelijkbare advertenties.",
    marketBenchmarkNone: "Voor deze lezing in het geobserveerde gebied zijn geen vergelijkbare advertenties behouden.",
    marketBenchmarkOne: "Lezing opgesteld op basis van 1 vergelijkbare advertentie in uw zone.",
    marketBenchmarkMany: "Lezing opgesteld op basis van {count} vergelijkbare advertenties in uw zone.",
    marketBenchmarkPending: "De lokale lezing wordt beschikbaar zodra er voldoende vergelijkbare advertenties zijn waargenomen.",
    marketScoreContextAbove: "Uw score ligt duidelijk boven het huidige marktgemiddelde.",
    marketScoreContextBelow: "Uw score blijft onder het niveau dat op de markt is waargenomen.",
    marketScoreContextAligned: "Uw score is perfect afgestemd op het gemiddelde marktniveau.",
    marketScoreContextObserved: "Lezing gebaseerd op de waargenomen vergelijkbare advertenties.",
    marketScoreContextMarketBelow: "Het marktgemiddelde blijft onder het huidige niveau van uw advertentie.",
    marketScoreContextMarketAbove: "Het marktgemiddelde blijft boven het huidige niveau van uw advertentie.",
    marketScoreContextMarketAligned: "Uw advertentie en de markt bevinden zich op een vergelijkbaar niveau.",
    marketScoreContextUnavailable: "De gemiddelde marktscore wordt weergegeven zodra er voldoende waargenomen advertenties beschikbaar zijn.",
    marketPositionNarrativeCompetitive: "Deze advertentie bevindt zich globaal op het gemiddelde niveau van nabije concurrenten.",
    heroMarketPositionSupport: "Gedetailleerde referentie (vergelijkbare advertenties, relatieve score, tekstsignalen): blok ‘Marktpositionering’.",
    heroImpactSupportOutOfSegment: "Vergelijkbare advertenties buiten het prijssegment behouden — businessschattingen zijn voor deze advertentie niet betrouwbaar. Alleen kwaliteits- en inhoudshefbomen blijven bruikbaar.",
    heroImpactSupportDefault: "Cijfermatige referenties: % voor de lift en €/maand voor de omzet in ‘Geschatte impact op boekingen’; /10-score in de rechterkolom.",
    heroImpactSupportCompetitive: "De advertentie is al competitief. De resterende winst zal vooral komen uit fijnere aanpassingen in prijspositionering en waardehelderheid, om een marginal maar reëel aandeel extra boekingen te winnen.",
    heroBusinessLiftHintPrudent: "Voorzichtige projectie op basis van de huidige prijs en het conversiepotentieel, zonder voldoende marktprijsbasis.",
    heroBusinessLiftHintInsufficient: "Marktgegevens zijn onvoldoende om een betrouwbare gekwantificeerde impact te schatten.",
    heroBusinessLiftHintDefault: "Een geoptimaliseerde advertentie kan uw maandelijkse omzet verbeteren, afhankelijk van de kwaliteit van de waargenomen markt en het werkelijke conversieniveau.",
    heroRevenueSupportUnavailable: "Schatting niet beschikbaar — onvoldoende marktgegevens voor deze geaggregeerde lezing.",
    heroRevenueSupportIndicative: "Indicatieve schatting op basis van de aanbevolen prijs, het waargenomen marktniveau en een realistische doelbezetting.",
    heroRevenueSupportPrudent: "Voorzichtige referentie: controleer boekingsvolume en vergelijkbare advertenties voordat u duurzaam op prijs investeert.",
    heroRevenueSupportFallback: "Consolideer de getoonde prijs en een marktreferentie (vergelijkbare advertenties) om een gekwantificeerde lezing te activeren.",
    photoBadgeMedium: "{count} foto’s • degelijke galerij",
    heroImpactRevenueRange: "+{low} tot +{high} / maand",
    impactSideCardNarrativeCondensed: "Beknopte weergave: de volledige %-range staat in de kaart ‘{label}’ hieronder.",
    heroScoreNarrativeStrong: "Lezing /10: sterk niveau — verder verfijnen met de aanbevelingen uit het rapport.",
    marketReliabilityBadgeHigh: "Goede betrouwbaarheid",
    marketReliabilityBadgeMedium: "Gemiddelde betrouwbaarheid",
    marketReliabilityBadgeLow: "Lage betrouwbaarheid",
    marketReliabilityBadgeWeakFallback: "Zwakke fallback",
    marketReliabilityMessageHigh: "Bruikbare marktbasis met meerdere consistente vergelijkbare advertenties.",
    marketReliabilityMessageMedium: "Indicatieve marktbasis, nog te consolideren.",
    marketReliabilityMessageLow: "Beperkte marktbasis: lezing met voorzichtigheid interpreteren.",
    marketReliabilityMessageWeakFallback: "Alleen fallback-marktbasis: lezing met extra voorzichtigheid interpreteren.",
    marketComparablesBodyStrong: "Bruikbare concurrentiebasis om uw advertentie binnen zijn segment te positioneren.",
    marketComparablesBodyNone: "Er zijn geen betrouwbare vergelijkbare advertenties behouden voor deze marktanalyse.",
    marketComparablesBodyLimited: "{base} Beperkte steekproef: nuttige lezing, maar nog te consolideren.",
    toConfirm: "te bevestigen",
    pricingPositioning: "Prijspositionering",
    pricingOpportunity: "Prijsopportuniteit gedetecteerd",
    pricingAligned: "Prijs afgestemd op de markt",
    pricingAboveMedian: "Prijs boven de mediaan",
    observedMedian: "Geobserveerde mediaan",
    recommendedPrice: "Aanbevolen prijs",
    belowMedian: "Onder de mediaan",
    marketAligned: "Marktconform",
    aboveMedian: "Boven de mediaan",
    potentialMonthlyGain: "Potentiële maandelijkse winst",
    estimatedMonthlyRisk: "Geschat maandelijks risico",
    estimatedMonthlyImpact: "Geschatte maandelijkse impact",
    pricingAssumption: "Prijsaanname: 20 nachten / maand",
    insufficientComparablePricing: "Onvoldoende gegevens: geen betrouwbare vergelijkbare aanbieding om mediaan of prijseffect te schatten.",
    insufficientPricingData: "Onvoldoende marktgegevens om een betrouwbare prijsimpact te schatten.",
    pricingBenchmarks: "Prijsbenchmarks",
    pricingBenchmarksTitle: "Hoe uw prijs zich verhoudt tot de concurrentie",
    pricingBenchmarksDescription: "Prijsbenchmarks op basis van geobserveerde gemiddelde prijzen en de geschatte kloof met de vergelijkbare markt.",
    averageCompetitorPrice: "Gemiddelde prijs van concurrenten",
    priceGapVsMarket: "Prijsverschil vs markt",
    notReliable: "Niet betrouwbaar",
    marketAnalysisPending: "Analyse in afwachting van een voldoende grote marktsteekproef.",
    businessProjection: "Businessprojectie",
    projectionsPotential: "Projecties en potentieel",
    projectionsDescription: "Indicatieve schattingen op basis van marktsignalen, concurrentiepositionering en geobserveerd conversiepotentieel.",
    nightlyPrice: "Prijs per nacht",
    premiumPosition: "Premiumpositie",
    aggressivePosition: "Agressieve positie",
    balancedPosition: "Evenwichtige positie",
    qualitativeAnalysisOnly: "Alleen kwalitatieve analyse",
    businessPotentialAfterOptimization: "Businesspotentieel na optimalisatie",
    projectionBase: "Projectiebasis",
    crossPlatformReading: "Cross-platform lezing",
    readableMarket: "Leesbare markt",
    cautiousReading: "Voorzichtige lezing",
    lowVisibility: "Lage zichtbaarheid",
    conversionGainPotential: "Potentiële conversiewinst",
    actionableProjection: "Bruikbare projectie",
    limitedProjection: "Beperkte projectie",
    cautiousProjection: "Voorzichtige projectie",
    indicativeProjection: "Indicatieve projectie",
    estimatedMonthlyGainTitle: "Geschatte maandelijkse winst",
    optimizedTexts: "Geoptimaliseerde advertentieteksten",
    variant: "Variant",
    changeVariant: "Variant wijzigen",
    descriptionCopied: "Beschrijving gekopieerd",
    currentTitle: "Huidige titel",
    optimizedTitleExample: "Voorbeeld van geoptimaliseerde titel",
    myPlace: "Mijn verblijf",
    detailedPlace: "Verblijf — gedetailleerde versie",
    guestAccess: "Toegang voor gasten",
    guestInteraction: "Interactie met gasten",
    otherInfo: "Andere nuttige informatie",
    bookingDescriptionSummary: "Samenvatting van beschrijving (Booking)",
    bookingSummaryReady: "Klaar om te plakken, afgestemd op de weergegeven variant.",
    actionPlan: "Actieplan",
    actionPlanSubtitle: "Projecten die nu moeten worden gestart, gerangschikt op business-impact.",
    businessPriority: "Business-prioriteit",
    quickOptimization: "Snelle optimalisatie",
    visibility: "Zichtbaarheid",
    reassurance: "Geruststelling",
    improvement: "Verbetering",
    photoQuality: "Fotokwaliteit",
    photoOrderQuality: "Volgorde van foto’s",
    descriptionQualityLabel: "Kwaliteit van de beschrijving",
    amenitiesCompletenessLabel: "Volledigheid van voorzieningen",
    seoPerformance: "SEO-prestaties",
    scoreOverviewTitle: "Gedetailleerde lezing van uw conversieprestaties",
    scoreOverviewTextAirbnb: "Lezing op basis van zichtbare signalen: de basis nodigt uit om emotie, gastvrijheid en de eigenheid van de advertentie te versterken.",
    scoreOverviewTextDefault: "Lezing op basis van zichtbare signalen: de basis helpt duidelijkheid, vertrouwen en conversie te optimaliseren.",
    scoreStatusConfirm: "Te bevestigen",
    scoreStatusPartialData: "Gegevens nog gedeeltelijk",
    scoreStatusExcellent: "Uitstekend",
    scoreStatusExcellentDetail: "Duidelijk concurrentievoordeel",
    scoreStatusStrong: "Sterk",
    scoreStatusStrongDetail: "Positief signaal om te behouden",
    scoreStatusCorrect: "Correct",
    scoreStatusCorrectDetail: "Verdere optimalisatie mogelijk",
    scoreStatusNeedsWork: "Te versterken",
    scoreStatusNeedsWorkDetail: "Zichtbare impact op de conversie",
    scoreStatusWeak: "Zwak",
    scoreStatusWeakDetail: "Verbeteringsprioriteit",
    subScorePhotosNote: "De beelden creëren een sterke en geruststellende eerste indruk. Ze helpen reizigers snel de kwaliteit van het verblijf te begrijpen en verminderen aarzeling vóór het boeken.",
    subScorePhotosFallback: "Onvoldoende fotogegevens om dit onderdeel te verfijnen.",
    subScorePhotosImpact: "Impact: sterk op klik en vertrouwen.",
    subScorePhotosPriority: "Prioriteit: dit niveau behouden.",
    subScorePhotoOrderNote: "De volgorde van de foto’s zet de aantrekkelijkste elementen goed in de kijker. De eerste beelden moeten comfort, ruimte en de waargenomen waarde van het verblijf meteen bevestigen.",
    subScorePhotoOrderFallback: "De visuele volgorde moet worden bevestigd zodra de signalen vollediger zijn.",
    subScorePhotoOrderImpact: "Impact: verbetert de eerste indruk.",
    subScorePhotoOrderPriority: "Prioriteit: de beste ruimtes eerst tonen.",
    subScoreDescriptionNote: "De tekst is degelijk, maar kan de echte ervaring beter verkopen: sfeer, comfort, concrete voordelen, toegang, buurt en redenen om voor dit verblijf te kiezen in plaats van een ander.",
    subScoreDescriptionFallback: "Tekst te beperkt of te weinig bruikbaar voor een betrouwbare lezing hier.",
    subScoreDescriptionImpact: "Impact: versterkt de projectie van de reiziger.",
    subScoreDescriptionPriority: "Prioriteit: de belofte concreter maken.",
    subScoreAmenitiesNote: "Zichtbare voorzieningen versterken het comfortgevoel. Hoe nauwkeuriger en beter gepresenteerd ze zijn, hoe meer ze reizigers geruststellen over de kwaliteit van het verblijf.",
    subScoreAmenitiesFallback: "Voorzieningen zijn weinig zichtbaar of niet ingevuld: lezing moet worden aangevuld.",
    subScoreAmenitiesImpact: "Impact: stelt gerust over het comfort van het verblijf.",
    subScoreAmenitiesPriority: "Prioriteit: de belangrijkste voorzieningen beter presenteren.",
    subScoreSeoNote: "SEO is bruikbaar, maar kan nog nauwkeuriger. De titel, lokale zoekwoorden en gezochte voorzieningen moeten het platform helpen de advertentie beter te begrijpen.",
    subScoreSeoFallback: "De signalen zijn te beperkt om hierover een conclusie te trekken.",
    subScoreSeoImpact: "Impact: helpt het platform de advertentie beter te rangschikken.",
    subScoreSeoPriority: "Prioriteit: titel en nuttige zoekwoorden versterken.",
    subScoreConversionNote: "Het conversiepotentieel is goed, maar er zijn nog hefbomen te activeren. Winst zal vooral komen van een duidelijkere belofte, meer geruststelling en concretere inhoud.",
    subScoreConversionFallback: "Lezing te consolideren met extra gegevens.",
    subScoreConversionImpact: "Impact: werkt rechtstreeks op de boekingsbeslissing.",
    subScoreConversionPriority: "Prioriteit: vertrouwen en duidelijkheid verbeteren.",
    iqaBusinessIndicator: "Business-indicator",
    iqaPerceivedListingQuality: "Waargenomen kwaliteit van de advertentie",
    iqaReading: "IQA-lezing",
    iqaNarrativePremium: "Premiumlezing: het waargenomen algemene niveau oogt sterk tegenover de geanalyseerde markt.",
    iqaNarrativeCompetitive: "Degelijke concurrentiebasis met nog meerdere activeerbare hefbomen.",
    iqaNarrativeFragile: "De kwaliteitspositionering blijft fragiel tegenover de waargenomen concurrerende advertenties.",
    iqaNarrativeRebuilt: "Lezing gereconstrueerd op basis van zichtbare signalen en de totaalscore van de audit.",
    lqiLabelHighSignal: "Sterk signaal",
    lqiLabelFavorable: "Gunstig signaal",
    lqiLabelImproving: "In opmars",
    lqiLabelNeedsWork: "Te versterken",
    lqiSummaryNoObject: "Er staat geen LQI-object in het rapport: de /100-waarden zijn een lokale synthese op basis van dezelfde /10-signalen als op de rest van de pagina — een geaggregeerde lezing, geen tweede onafhankelijke meetset.",
    lqiSummaryIndicativeScore: "De hoofdscore /100 is indicatief: afgeleid van de algemene /10-score omdat er in het rapport geen native numerieke IQA-index beschikbaar is.",
    lqiSummaryOverview: "Overzicht kwaliteit / markt / conversie: onder elke kaart — ‘Rapportcomponent’ = geleverd gestructureerd veld; ‘Lokale synthese’ = aggregaat van de /10-waarden die al op de pagina staan; ‘Rapportaanvulling’ = ander veld uit het rapport (bijvoorbeeld boekingspotentieel), geen op zichzelf staande conversiemeting.",
    lqiSummaryPending: "Deze indicator wordt weergegeven zodra de nuttige signalen beschikbaar zijn.",
    lqiSummaryCompetitiveButOptimizable: "De advertentie is competitief, maar sommige zichtbare hefbomen kunnen de conversie en positionering nog verbeteren, met name door de waardepropositie al op het eerste scherm explicieter te maken.",
    listingConversion: "Conversie van de advertentie",
  },
} as const;

const DEBUG_AUDIT_UI = process.env.NEXT_PUBLIC_DEBUG_AUDIT_UI === "true";
const DEBUG_AUDIT_PRICE_CARD =
  DEBUG_AUDIT_UI ||
  process.env.NEXT_PUBLIC_DEBUG_BOOKING_PIPELINE === "true" ||
  process.env.NEXT_PUBLIC_DEBUG_MARKET_PIPELINE === "true";

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
    pricedComparableCount?: number | null;
    avgCompetitorPrice?: number | null;
    priceDelta?: number | null;
    marketSourceQuality?: "native" | "cross_platform_fallback" | null;
    marketSourceLabel?: string | null;
    marketConfidence?: "high" | "medium" | "low";
    fallbackLevel?: "local" | "limited_local" | "insufficient" | "target_unavailable";
    reliabilityTitle?: string;
    reliabilityBadge?: string;
    reliabilityMessage?: string;
    weakBookingFallbackComparableCount?: number | null;
  };
  business?: {
    bookingPotential?: number | null;
    estimatedRevenueLow?: number | null;
    estimatedRevenueHigh?: number | null;
    revenueBaselineNightlyPrice?: number | null;
    revenueBaselineBookedNightsPerMonth?: number | null;
    revenueBaselinePriceSource?: "listing" | "market_median" | null;
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
  /** Potentiel réservations (%) — peut surcharger la fourchette persistée lorsqu’elle est fournie dans le rapport. */
  reservationPotentialLow?: number | null;
  reservationPotentialHigh?: number | null;
  estimatedRevenueImpact?: {
    lowMonthly?: number;
    highMonthly?: number;
    summary?: string;
    baselineNightlyPrice?: number | null;
    baselineBookedNightsPerMonth?: number | null;
    baselinePriceSource?: "listing" | "market_median";
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
  businessInsights?: {
    pricing?: PricingBusinessInsight | null;
  } | null;
};

type ListingJoin =
  | {
      raw_payload?: Record<string, unknown> | null;
      id: string;
      title: string | null;
      source_platform: string | null;
      source_url: string | null;
      price?: number | null;
      currency?: string | null;
      priceDetails?: {
        source?: string | null;
        confidence?: "high" | "medium" | "low" | "none" | null;
        cacheStatus?: "hit" | "miss" | null;
        totalPrice?: number | null;
        nightlyPrice?: number | null;
        originalTotalPrice?: number | null;
        cleaningFee?: number | null;
        serviceFee?: number | null;
        taxes?: number | null;
        stayNights?: number | null;
      } | null;
      city?: string | null;
      description?: string | null;
      amenities?: string[] | null;
      hostName?: string | null;
      rating?: number | null;
      reviewCount?: number | null;
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
type AiTextSectionKey = "main" | "optimized-title" | "logement" | "logementDetaille" | "acces" | "echanges" | "autresInfos";

const AI_VARIANT_LABELS = [
  "Confort & détente",
  "Pratique & fluide",
  "Quartier & emplacement",
  "Premium & confiance",
  "Court séjour / business",
] as const;


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
  workspace_id?: string | null;
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

/** Ligne `listings` : conserve les champs utiles, enrichit `description` / `amenities` depuis `raw_payload` si besoin. */
function normalizeAuditListingRow(row: unknown): ListingJoin {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  if (typeof r.id !== "string") return null;

  const asString = (v: unknown) => (typeof v === "string" ? v : null);
  const rawPayload = r.raw_payload;
  const raw =
    rawPayload && typeof rawPayload === "object"
      ? (rawPayload as Record<string, unknown>)
      : null;

  const titleFromRow = asString(r.title)?.trim() ?? "";
  const titleFromRaw = raw ? asString(raw.title)?.trim() ?? "" : "";
  const rawTitleMeta =
    raw && raw.titleMeta && typeof raw.titleMeta === "object"
      ? (raw.titleMeta as { source?: unknown })
      : null;
  const extractedTitleSource =
    typeof rawTitleMeta?.source === "string" ? rawTitleMeta.source : null;

  const isPlaceholderListingTitle = (t: string) => {
    if (!t) return true;
    if (/^annonce sans titre$/i.test(t)) return true;
    if (/^untitled\b/i.test(t)) return true;
    if (/untitled booking listing/i.test(t)) return true;
    return false;
  };

  let resolvedTitle: string | null = titleFromRow || null;
  if (titleFromRaw && !isPlaceholderListingTitle(titleFromRaw)) {
    const fromReliableExtractor =
      Boolean(extractedTitleSource) && extractedTitleSource !== "fallback_default";
    const manualLooksShortcut =
      !titleFromRow ||
      isPlaceholderListingTitle(titleFromRow) ||
      (titleFromRow.length < 18 && titleFromRaw.length >= titleFromRow.length + 6);
    if (fromReliableExtractor || manualLooksShortcut) {
      resolvedTitle = titleFromRaw;
    }
  }

  const descriptionFromRow = asString(r.description);
  const descriptionFromRaw = raw ? asString(raw.description) : null;
  const description = descriptionFromRow?.trim()
    ? descriptionFromRow
    : descriptionFromRaw?.trim()
      ? descriptionFromRaw
      : null;

  let amenities: string[] | null = null;
  if (Array.isArray(r.amenities)) {
    const list = r.amenities.filter((x): x is string => typeof x === "string");
    if (list.length > 0) amenities = list;
  }
  if (!amenities?.length && raw && Array.isArray(raw.amenities)) {
    const list = raw.amenities.filter((x): x is string => typeof x === "string");
    if (list.length > 0) amenities = list;
  }

  const asNumber = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) ? v : null;

  const rawHost =
    raw && raw.host && typeof raw.host === "object"
      ? (raw.host as Record<string, unknown>)
      : null;

  const rawResolvedHostName =
    asString(r.hostName) ??
    asString(r.host_name) ??
    (raw ? asString(raw.hostName) ?? asString(raw.host_name) ?? asString(raw.hostInfo) : null) ??
    (rawHost ? asString(rawHost.name) : null);

  const listingPlatformForHost =
    asString(r.source_platform) ?? asString(raw?.platform) ?? null;
  const listingTitleForHost = asString(r.title) ?? asString(raw?.title) ?? null;
  const hostLooksLikeListingTitle =
    listingPlatformForHost?.toLowerCase() === "agoda" &&
    rawResolvedHostName?.trim() === listingTitleForHost?.trim();

  const hostName =
    rawResolvedHostName &&
    !hostLooksLikeListingTitle &&
    !/^(contextualuser|airbnb user|unknown host|host|hôte)$/i.test(rawResolvedHostName.trim())
      ? rawResolvedHostName
      : null;

  const rating =
    asNumber(r.rating) ??
    (raw ? asNumber(raw.rating) ?? asNumber(raw.starRating) ?? asNumber(raw.guestRating) : null);

  const reviewCount =
    asNumber(r.reviewCount) ??
    asNumber(r.reviewsCount) ??
    asNumber(r.review_count) ??
    (raw ? asNumber(raw.reviewCount) ?? asNumber(raw.reviewsCount) ?? asNumber(raw.review_count) : null);

  const { raw_payload: _rp, description: _d, amenities: _a, title: _listingTitle, ...base } = r;
  return {
    ...base,
    raw_payload: raw,
    title: resolvedTitle ?? (typeof _listingTitle === "string" ? _listingTitle : null),
    description,
    amenities,
    hostName,
    rating,
    reviewCount,
    priceDetails:
      raw && raw.priceDetails && typeof raw.priceDetails === "object"
        ? raw.priceDetails
        : (base as Record<string, unknown>).priceDetails ?? null,
  } as ListingJoin;
}

function limitText(text: string, max: number) {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

function normalizeSentence(value?: string | null) {
  if (!value) return "";
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>|<\/div>|<\/li>/gi, ". ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

function parseStayDatesFromAuditListingUrl(url: string | null | undefined): {
  checkin: string | null;
  checkout: string | null;
  nights: number | null;
} {
  const raw = typeof url === "string" ? url.trim() : "";
  if (!raw) return { checkin: null, checkout: null, nights: null };
  try {
    const sp = new URL(raw).searchParams;
    const checkin = sp.get("checkin")?.trim() ?? "";
    const checkout = sp.get("checkout")?.trim() ?? "";
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    if (!iso.test(checkin) || !iso.test(checkout)) {
      return { checkin: null, checkout: null, nights: null };
    }
    const [y0, mo0, d0] = checkin.split("-").map(Number);
    const [y1, mo1, d1] = checkout.split("-").map(Number);
    const t0 = Date.UTC(y0, (mo0 ?? 1) - 1, d0 ?? 1);
    const t1 = Date.UTC(y1, (mo1 ?? 1) - 1, d1 ?? 1);
    const nights = Math.round((t1 - t0) / 86400000);
    return {
      checkin,
      checkout,
      nights: Number.isFinite(nights) && nights > 0 ? nights : null,
    };
  } catch {
    return { checkin: null, checkout: null, nights: null };
  }
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

/** Plateforme de sortie des textes proposés : alignée sur `listing.source_platform`, sans bascule manuelle. */
function resolveAiOutputPlatformFromListingSource(
  sourceRaw: string | null | undefined
): "airbnb" | "booking" {
  const s = normalizeSentence(sourceRaw).toLowerCase();
  if (s.includes("airbnb")) return "airbnb";
  if (
    s.includes("booking") ||
    s.includes("expedia") ||
    s.includes("agoda") ||
    s.includes("vrbo") ||
    s.includes("abritel")
  ) {
    return "booking";
  }
  return "booking";
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

function conservativeImpactFallbackTitle(impact: AuditActionImpact): string {
  switch (impact) {
    case "high":
      return "Point à renforcer";
    case "medium":
      return "Amélioration recommandée";
    default:
      return "Élément à clarifier";
  }
}

/** Titre prudent pour recommandations legacy sans structure « titre : description ». */
function buildConservativeLegacyRecommendationTitle(
  fullText: string,
  impact: AuditActionImpact
): string {
  const cleaned = normalizeSentence(fullText).replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return conservativeImpactFallbackTitle(impact);
  }
  const sentences = splitIntoSentences(cleaned);
  const first = sentences[0] ?? cleaned;
  const maxTitle = 88;
  if (first.length >= 12) {
    return first.length <= maxTitle ? first : limitText(first, maxTitle);
  }
  if (cleaned.length >= 12) {
    return cleaned.length <= maxTitle ? cleaned : limitText(cleaned, maxTitle);
  }
  return conservativeImpactFallbackTitle(impact);
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

function trimToWordBoundary(value: string, max: number) {
  const normalized = normalizeSentence(value).replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  const cut = normalized.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  const compact = (lastSpace > 18 ? cut.slice(0, lastSpace) : cut).replace(/[·,\s-]+$/g, "").trim();
  return compact || normalized.slice(0, max).replace(/[·,\s-]+$/g, "").trim();
}

function cleanBookingGeneratedDescriptionSource(value: string): string {
  let text = normalizeSentence(value);
  if (!text) return "";

  const hardStopPatterns = [
    /consulta la opción/i,
    /no hay camas supletorias/i,
    /todas las cunas/i,
    /más info/i,
    /ver traducción/i,
    /leer todos los comentarios/i,
    /preguntas y respuestas/i,
    /envía una pregunta/i,
    /alrededores del alojamiento/i,
    /ver disponibilidad/i,
    /ubicación excelente/i,
    /ver mapa/i,
    /atracciones turísticas/i,
    /booking\.com forma parte/i,
  ];

  let cutIndex = -1;
  for (const pattern of hardStopPatterns) {
    const match = text.match(pattern);
    if (match?.index != null) {
      cutIndex = cutIndex === -1 ? match.index : Math.min(cutIndex, match.index);
    }
  }

  if (cutIndex > 80) {
    text = text.slice(0, cutIndex).trim();
  }

  const noisyFragments = [
    /Ir al contenido principal/gi,
    /Accéder au contenu principal/gi,
    /EUR Elegir tu moneda/gi,
    /Tu moneda actual es Euro/gi,
    /Elegir el idioma que prefieres/gi,
    /Tu idioma actual.*?Franc[eé]s/gi,
    /Obt[eé]n de l'aide concernant votre réservation/gi,
    /Ajoutez votre établissement/gi,
    /S'inscrire/gi,
    /Se connecter/gi,
    /Séjours\s+Vols\s+Vol \+ hôtel\s+Voitures de location\s+Attractions\s+Taxis aéroport/gi,
    /habitaciones sin humo/gi,
    /spa y centro de bienestar/gi,
    /traslado aeropuerto/gi,
    /servicio de recogida en el aeropuerto/gi,
  ];

  for (const fragment of noisyFragments) {
    text = text.replace(fragment, " ");
  }

  return text.replace(/\s{2,}/g, " ").trim();
}

function buildAirbnbDescriptionVariants(options: {
  title?: string | null;
  location?: string | null;
  amenities?: string[] | null;
  description?: string | null;
  sourcePlatform?: string | null;
  missingAmenities?: string[];
  visualSignals?: string[];
  generationStyle?: AiGenerationStyle;
}): AiVariant[] {
  const generationStyle = options.generationStyle ?? deduceAiGenerationStyle(options.sourcePlatform);
  const title = normalizeSentence(options.title) || "ce logement";
  const location = normalizeSentence(options.location);
  const description = cleanBookingGeneratedDescriptionSource(options.description ?? "");
  const amenities = Array.isArray(options.amenities)
    ? options.amenities
        .map((item) => normalizeSentence(item))
        .filter(Boolean)
        .filter((item, index, array) => array.indexOf(item) === index)
    : [];
  const visualSignals = Array.isArray(options.visualSignals)
    ? options.visualSignals.map((item) => normalizeSentence(item)).filter(Boolean).slice(0, 6)
    : [];
  const visualSignalText = visualSignals.join(" ");
  const sourceText = `${sentenceCase(title)} ${description} ${amenities.join(" ")} ${visualSignalText}`;

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

  console.info("[COPY_CAPACITY_DEBUG]", {
    title,
    location,
    guests,
    rooms,
    beds,
    bathrooms,
  });

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
    .filter(
      (item) =>
        !amenityGroups.some(({ pattern }) => pattern.test(item)) &&
        !/stayspdp|amenitiesdetails|pdp|__typename|airbnb|booking/i.test(item)
    )
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

  const locationLower = (location ?? "").toLowerCase();

  const coastalGeoAllowed =
    /agadir|essaouira|taghazout|imsouane|tanger|casablanca|rabat|sal[ée]|nice|cannes|marseille|bordeaux|biarritz|miami|dubai|ibiza|mallorca|bali|phuket|hurghada/i.test(
      locationLower
    );

  const mountainGeoAllowed =
    /montagne|alp|chamonix|megeve|courchevel|ski|atlas|ifrane/i.test(
      locationLower
    );

  const marinaGeoAllowed =
    coastalGeoAllowed ||
    /marina|port/i.test(locationLower);

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
  const geoLifestyleSignals = [
    /croisette/i.test(sourceText)
      ? "à proximité de la Croisette"
      : null,

    /palais des festivals|festival/i.test(sourceText)
      ? "proche du Palais des Festivals"
      : null,

    coastalGeoAllowed &&
    /plage|mer|bord(\s|-)?de(\s|-)?mer|ocean/i.test(sourceText)
      ? "accès rapide aux plages et au littoral"
      : null,

    /rue d.?antibes|shopping|boutiques|commerce/i.test(sourceText)
      ? "à proximité des commerces et adresses shopping"
      : null,

    /gare|sncf|train/i.test(sourceText)
      ? "accès pratique depuis la gare"
      : null,

    /congr[eè]s|business/i.test(sourceText)
      ? "adapté aux séjours professionnels et congrès"
      : null,

    /centre-ville|hypercentre|downtown/i.test(sourceText)
      ? "emplacement pratique pour découvrir le centre-ville"
      : null,

    /quartier calme|calme|paisible/i.test(sourceText)
      ? "environnement agréable pour un séjour plus serein"
      : null,
  ].filter((x): x is string => Boolean(x));

  const nearbyNarrativePool = [
    ...geoLifestyleSignals,
  ]
    .map((item) => normalizeSentence(item))
    .filter(Boolean)
    .filter((item, index, array) => array.indexOf(item) === index);

  const nearbyBlock =
    nearbyNarrativePool.length > 0
      ? nearbyNarrativePool.join(" ")
      : "";
  const interiorBlock =
    interiorHighlights.length > 0
      ? interiorHighlights.join(" ")
      : "";
  const rulesBlock =
    ruleHighlights.length > 0 ? ruleHighlights.join(" ") : "";
  const sourceTextLower = sourceText.toLowerCase();

  const isVillaLike =
    /villa|riad|maison|house|dar/i.test(sourceTextLower);

  const hasPoolSignal =
    verifiedAmenityLabels.includes("piscine") || /piscine|pool/i.test(sourceTextLower);

  const hasPrivatePoolSignal =
    hasPoolSignal &&
    isVillaLike &&
    /privée|privee|private pool|piscine privée|exclusive/i.test(sourceTextLower);

  const hasSharedPoolSignal =
    hasPoolSignal &&
    !hasPrivatePoolSignal;

  const hasTerraceSignal =
    verifiedAmenityLabels.some((l) => /terrasse|balcon/i.test(l)) ||
    /terrasse|balcon|patio|rooftop/i.test(sourceTextLower);

  const hasParkingSignal =
    verifiedAmenityLabels.includes("parking") || /parking|garage/i.test(sourceTextLower);

  const hasJacuzziSignal =
    /jacuzzi|hot tub/i.test(sourceTextLower);

  const hasGardenSignal =
    /jardin|garden/i.test(sourceTextLower);

  const hasSpaSignal =
    /spa|hammam|sauna/i.test(sourceTextLower);

  const landscapeSignals = [
    coastalGeoAllowed &&
    /mer|plage|bord(\s|-)?de(\s|-)?mer|ocean/i.test(sourceText)
      ? "proximité mer ou littoral"
      : null,

    mountainGeoAllowed &&
    /montagne|ski\b|station(\s|-)?de(\s|-)?ski|randonnée|randonnee/i.test(sourceText)
      ? "environnement montagne ou nature"
      : null,

    /\blac\b|plan d’eau/i.test(sourceText)
      ? "proximité lac ou plan d’eau"
      : null,

    /médina|medina|vieille ville|historique/i.test(sourceText)
      ? "quartier historique ou médina"
      : null,

    marinaGeoAllowed &&
    /marina|port/i.test(sourceText)
      ? "marina ou port à proximité"
      : null,

    /golf/i.test(sourceText)
      ? "golf à proximité"
      : null,

    /centre-ville|hypercentre|downtown/i.test(sourceText)
      ? "proximité centre-ville"
      : null,

    /surf|vagues/i.test(sourceText)
      ? "spot orienté surf ou activités nautiques"
      : null,

    /parc|jardin public/i.test(sourceText)
      ? "espaces verts ou parc à proximité"
      : null,
  ].filter((x): x is string => Boolean(x));

  const landscapeBrief =
    [...landscapeSignals, ...geoLifestyleSignals].length > 0
      ? joinFrenchList([...landscapeSignals, ...geoLifestyleSignals].slice(0, 4))
      : "";

  const standoutAmenityBits = [
    hasPrivatePoolSignal
      ? "piscine privée"
      : hasSharedPoolSignal
        ? (isVillaLike ? "piscine" : "piscine de résidence")
        : null,

    hasTerraceSignal ? "terrasse ou balcon" : null,

    hasParkingSignal ? "stationnement" : null,

    hasJacuzziSignal ? "jacuzzi" : null,

    hasGardenSignal ? "jardin" : null,

    hasSpaSignal ? "espace bien-être" : null,
  ].filter((x): x is string => Boolean(x));
  const standoutAmenityPhrase =
    standoutAmenityBits.length > 0 ? joinFrenchList(standoutAmenityBits) : "";

  const visualNarrativeSignals = visualSignals
    .filter((item) => /photo|image|galerie|couverture|terrasse|balcon|piscine|extérieur|exterieur|jardin|vue|cuisine|chambre|salon|bureau|lumineux|lumière|lumiere/i.test(item))
    .slice(0, 3);

  const premiumNarrativeHighlights = [
    landscapeBrief,
    ...visualNarrativeSignals,
    standoutAmenityPhrase,
  ]
    .map((item) => normalizeSentence(item))
    .filter(Boolean)
    .filter((item, index, array) => array.indexOf(item) === index)
    .slice(0, 4);

  const premiumHookDetail =
    premiumNarrativeHighlights.length > 0
      ? ` — ${premiumNarrativeHighlights[0]}`
      : "";

  const premiumContextSentence =
    premiumNarrativeHighlights.length > 0
      ? `À valoriser dans le texte : ${joinFrenchList(premiumNarrativeHighlights.slice(0, 3))}.`
      : "";

  const propertyLabel = (() => {
    const base = sentenceCase(title)
      .replace(/,\s*(Marrakech|Marrakesh|F[eè]s|Fez|Maroc|Morocco|Marruecos).*$/i, "")
      .replace(/\s+à\s+Gu[eé]liz.*$/i, " à Guéliz")
      .replace(/\s+-\s+Quiet Desire.*$/i, "")
      .trim();

    if (/\briad\b/i.test(base)) {
      const match = base.match(/\bRiad\s+[A-ZÀ-Ÿ0-9][A-Za-zÀ-ÿ0-9-]*/i);
      return match?.[0] ? sentenceCase(match[0]) : "Riad";
    }

    if (/\bstudio\b/i.test(base) && /gu[eé]liz/i.test(`${base} ${location}`)) {
      return "Studio Guéliz";
    }

    if (/\bappartement\b|\bapartment\b/i.test(base) && /gu[eé]liz/i.test(`${base} ${location}`)) {
      return "Appartement Guéliz";
    }

    return base || "Ce logement";
  })();
  const lodgingLabel =
    /riad|dar/i.test(sourceTextLower)
      ? "le riad"
      : /\bvilla\b|\bmaison\b|\bhouse\b/i.test(sourceTextLower)
        ? "la maison"
        : /studio/i.test(sourceTextLower)
          ? "le studio"
          : /appartement|apartment|flat/i.test(sourceTextLower)
            ? "l’appartement"
            : "le logement";
  const propertyKindLabel =
    lodgingLabel === "le riad"
      ? "riad"
      : lodgingLabel === "la maison"
        ? "maison"
        : lodgingLabel === "le studio"
          ? "studio"
          : lodgingLabel === "l’appartement"
            ? "appartement"
            : "hébergement";
  const housingBase =
    `${propertyLabel} propose un ${propertyKindLabel} ${capacitySignals.length > 0 ? `pour ${capacityCopy}` : "pensé pour un séjour confortable"}, avec ${amenitiesSentence}.`;
  const layoutBase =
    interiorBlock ||
    `La configuration s’organise autour de ${capacityCopy}, avec des espaces simples à utiliser pour dormir, se détendre et profiter du séjour.`;
  const comfortBase = standoutAmenityPhrase
    ? `Côté confort, vous profitez de ${amenitiesSentence}, avec en plus ${standoutAmenityPhrase}.`
    : `Côté confort, ${amenitiesSentence} accompagnent le séjour au quotidien.`;
  const locationBase =
    nearbyBlock ||
    (location
      ? `${propertyLabel} se situe à ${location}, avec des repères pratiques pour profiter du secteur sans compliquer l’organisation du séjour.`
      : "Le logement sert de point de départ simple pour organiser les journées et revenir au calme.");
  const serviceBase =
    serviceLabels.some((item) => /arrivée autonome/i.test(item))
      ? `L’arrivée se prépare facilement grâce à une organisation claire et à une arrivée autonome lorsqu’elle est proposée. ${servicesSentence} complètent le séjour.`
      : `Le séjour se prépare simplement, avec ${servicesSentence} pour faciliter l’arrivée et le quotidien.`;
  const rulesBase =
    rulesBlock ||
    "Les informations pratiques et les consignes du logement sont annoncées à l’avance pour permettre une arrivée sereine.";
  const locationTag =
    landscapeBrief || (location ? `à ${location}` : "");
  const structuredLocationSignals = [...geoLifestyleSignals, ...landscapeSignals]
    .map((item) => normalizeSentence(item))
    .filter(Boolean)
    .filter((item, index, array) => array.indexOf(item) === index);
  const structuredLocationSentence = structuredLocationSignals.length > 0
    ? joinFrenchList(structuredLocationSignals.slice(0, 3))
    : "";
  const bookingStructuredHousingBase =
    `${propertyLabel} propose un ${propertyKindLabel} ${capacitySignals.length > 0 ? `pour ${capacityCopy}` : "conçu pour un séjour confortable"}, avec ${amenitiesSentence}.`;
  const bookingStructuredInteriorBlock =
    standoutAmenityPhrase
      ? `${sentenceCase(standoutAmenityPhrase)} renforcent le confort sur place, avec une ambiance adaptée autant aux pauses qu’aux retours en fin de journée.`
      : `Le logement mise sur des équipements utiles au quotidien pour rendre le séjour plus confortable et plus fluide.`;
  const bookingStructuredNearbyBlock =
    structuredLocationSentence
      ? `${propertyLabel} bénéficie d’un emplacement marqué par ${structuredLocationSentence}.`
      : location
        ? `${propertyLabel} se situe à ${location}, dans un secteur pratique pour circuler et découvrir la ville.`
        : `${propertyLabel} s’inscrit dans un environnement qui facilite les déplacements et le rythme du séjour.`;
  const bookingStructuredServiceBase = serviceLabels.some((item) => /arrivée autonome/i.test(item))
    ? `L’arrivée peut se faire avec souplesse, et ${servicesSentence} complètent l’expérience avant comme pendant le séjour.`
    : `L’arrivée et le séjour s’appuient sur ${servicesSentence}, avec des informations claires communiquées en amont.`;
  const bookingStructuredRulesBase =
    "Les informations utiles avant l’arrivée et les consignes du logement sont précisées à l’avance.";
  const bookingBusinessLocationHint =
    /gare|sncf|train|aéroport|aeroport|palais|congr[eè]s|business|festival/i.test(
      `${structuredLocationSentence} ${location ?? ""}`
    )
      ? "La localisation convient bien à des rendez-vous, déplacements ou séjours courts."
      : "La localisation reste pratique pour un passage rapide avec des trajets faciles à organiser.";

  const bookingCopyLabel =
    location
      ? `${lodgingLabel.charAt(0).toUpperCase()}${lodgingLabel.slice(1)} situé à ${location}`
      : `${lodgingLabel.charAt(0).toUpperCase()}${lodgingLabel.slice(1)}`;

  const variantAngles = [
    {
      label: "Confort & détente",
      bookingPresentation: `${bookingCopyLabel} ouvre sur une parenthèse plus paisible au cœur du voyage.`,
      bookingHousing: `${bookingCopyLabel} met l’accent sur le confort et la détente, avec ${amenitiesSentence}. ${standoutAmenityPhrase ? `${sentenceCase(standoutAmenityPhrase)} apportent une vraie valeur au séjour.` : "L’ensemble crée une base agréable pour se poser après les sorties."}`,
      bookingComfort: `${bookingStructuredInteriorBlock} ${hasSpaSignal || hasJacuzziSignal ? "L’espace bien-être apporte une vraie dimension détente à l’adresse." : hasTerraceSignal ? "La terrasse prolonge naturellement les temps calmes et les moments de pause." : "L’ensemble convient très bien à un séjour où l’on cherche surtout à ralentir le rythme."}`,
      bookingLocation: `${bookingStructuredNearbyBlock} ${landscapeBrief ? `Le secteur ajoute aussi ${landscapeBrief}.` : "L’environnement convient bien à celles et ceux qui aiment alterner sorties et retours au calme."}`.trim(),
      bookingServices: `${bookingStructuredServiceBase} ${bookingStructuredRulesBase}`,
      airbnbIntro: `${propertyLabel} invite à ralentir le rythme et à profiter d’un séjour confortable${locationText}.`,
      airbnbHousing: `${housingBase} ${layoutBase}`,
      airbnbServices: `${serviceBase} ${rulesBase}`,
      airbnbLocation: `${locationBase}`,
      airbnbCta: "👉 Appel à réserver\n\nSi vous cherchez une adresse agréable pour vous reposer, vous installer facilement et profiter du séjour sans friction, cette variante met clairement le confort au premier plan.",
      accessCopy: "L’accès est pensé pour une installation simple et sans stress, avec les repères utiles communiqués avant l’arrivée.",
      exchangeCopy: "Les échanges restent disponibles et rassurants pour préparer un séjour fluide, puis profiter du logement en toute autonomie.",
      extraCopy: `${landscapeBrief ? `Le cadre ajoute ${landscapeBrief}. ` : ""}${rulesBase}`.trim(),
    },
    {
      label: "Pratique & fluide",
      bookingPresentation: `${bookingCopyLabel} met l’accent sur la praticité, avec un format facile à prendre en main pour voyager sans perte de temps.`,
      bookingHousing: `${bookingCopyLabel} convient aux voyageurs qui veulent un séjour simple à organiser. ${sentenceCase(amenitiesSentence)} facilitent le quotidien, avec une lecture claire du logement dès la réservation.`,
      bookingComfort: `${sentenceCase(amenitiesSentence)} répondent aux besoins du quotidien. ${hasParkingSignal ? "Le parking simplifie les arrivées en voiture et les déplacements sur place." : ""} ${/wi[\s-]?fi|internet/i.test(sourceTextLower) ? "Le Wi‑Fi aide aussi à garder un séjour fluide entre organisation, trajets et temps sur place." : "L’ensemble convient très bien à un séjour où l’on veut aller à l’essentiel."}`.trim(),
      bookingLocation: `${bookingStructuredNearbyBlock} ${location ? "Le quartier se prête bien aux allers-retours du quotidien et aux déplacements courts." : "L’emplacement reste facile à intégrer dans un programme chargé."}`.trim(),
      bookingServices: `${bookingStructuredServiceBase} ${hasParkingSignal ? "Le stationnement identifié dans l’annonce constitue un avantage concret pour les voyageurs motorisés." : bookingStructuredRulesBase}`,
      airbnbIntro: `${propertyLabel} fonctionne très bien pour un séjour fluide, avec des repères clairs, des équipements utiles et une installation sans perte de temps.`,
      airbnbHousing: `${layoutBase} ${comfortBase}`,
      airbnbServices: `${serviceBase} ${hasParkingSignal ? "Le stationnement, lorsqu’il est proposé, rend aussi les arrivées plus simples." : ""}`.trim(),
      airbnbLocation: `${locationBase}`,
      airbnbCta: "👉 Appel à réserver\n\nParfait si vous voulez une annonce claire, un séjour facile à organiser et un logement qui répond rapidement aux besoins concrets du voyage.",
      accessCopy: "Les modalités d’arrivée restent lisibles, avec une prise en main rapide du logement et de ses équipements.",
      exchangeCopy: "Les échanges sont pensés pour aller à l’essentiel : horaires, accès, organisation et réponses rapides aux questions utiles.",
      extraCopy: `${rulesBase} ${location ? `La localisation à ${location} ajoute une dimension pratique au quotidien.` : ""}`.trim(),
    },
    {
      label: "Quartier & emplacement",
      bookingPresentation: `${bookingCopyLabel} se choisit d’abord pour son emplacement, avec une vraie connexion au quartier et aux lieux utiles autour de vous.`,
      bookingHousing: `${bookingCopyLabel} sert surtout de base pratique pour profiter du secteur. ${hasTerraceSignal ? "La terrasse ajoute un vrai plus pour prolonger les retours au logement." : "Le logement reste pensé comme un point d’appui confortable entre deux sorties."}`,
      bookingComfort: `${bookingStructuredInteriorBlock} ${structuredLocationSentence ? `Le vrai atout reste cependant la proximité de ${structuredLocationSentence}.` : "Le confort sur place accompagne naturellement un séjour centré sur la découverte du quartier."}`,
      bookingLocation: `${bookingStructuredNearbyBlock} ${location ? `Depuis ${location}, il devient plus facile d’alterner visites, sorties et retours au logement.` : "L’emplacement garde un rôle central dans cette variante."}`.trim(),
      bookingServices: `${bookingStructuredServiceBase} ${location ? `Le quartier apporte un vrai supplément d’intérêt pour celles et ceux qui choisissent d’abord une ambiance ou une zone précise.` : bookingStructuredRulesBase}`,
      airbnbIntro: `${propertyLabel} donne envie de vivre le secteur autant que le logement, avec une vraie sensation d’adresse bien placée${locationText}.`,
      airbnbHousing: `${housingBase} ${layoutBase}`,
      airbnbServices: `${serviceBase}`,
      airbnbLocation: `${locationBase} ${landscapeBrief ? `Le cadre autour du logement apporte ${landscapeBrief}.` : ""}`.trim(),
      airbnbCta: "👉 Appel à réserver\n\nIdéal si vous choisissez d’abord un quartier, une ambiance ou une proximité utile avant même de regarder le reste.",
      accessCopy: "L’arrivée et les déplacements se préparent facilement, avec des repères simples pour rayonner dans le secteur.",
      exchangeCopy: "Les échanges peuvent aussi aider à clarifier les repères du quartier, les accès utiles et l’organisation sur place.",
      extraCopy: `${nearbyBlock || locationBase} ${rulesBase}`.trim(),
    },
    {
      label: "Premium & confiance",
      bookingPresentation: `${bookingCopyLabel} s’adresse aux voyageurs qui recherchent une expérience plus soignée, avec un vrai souci de confort et d’atmosphère.`,
      bookingHousing: `${bookingCopyLabel} cherche à créer une expérience plus soignée. ${premiumNarrativeHighlights.length > 0 ? `Les atouts à valoriser sont ${joinFrenchList(premiumNarrativeHighlights.slice(0, 3))}.` : "Le confort, la présentation et les équipements donnent une impression plus qualitative."}`,
      bookingComfort: `${hasSpaSignal ? "Le spa ou l’espace bien-être donne immédiatement un ton plus exclusif au séjour." : ""} ${hasTerraceSignal ? "La terrasse ajoute une vraie dimension d’expérience, au-delà de la simple fonctionnalité." : ""} ${standoutAmenityPhrase ? `${sentenceCase(standoutAmenityPhrase)} renforcent la qualité perçue de l’ensemble.` : premiumContextSentence || "Le confort se lit dans les détails visibles et dans la cohérence générale du logement."}`.trim(),
      bookingLocation: `${bookingStructuredNearbyBlock} ${landscapeBrief ? `Le contexte local participe aussi à cette sensation d’expérience plus aboutie avec ${landscapeBrief}.` : "Le lieu conserve un supplément de caractère qui compte dans le choix final."}`.trim(),
      bookingServices: `${bookingStructuredServiceBase} ${bookingStructuredRulesBase}`,
      airbnbIntro: `${propertyLabel} mise sur une impression plus soignée, avec un confort crédible et des détails qui renforcent la confiance dès la lecture.`,
      airbnbHousing: `${housingBase} ${comfortBase}`,
      airbnbServices: `${serviceBase} ${rulesBase}`,
      airbnbLocation: `${locationBase}`,
      airbnbCta: "👉 Appel à réserver\n\nUne bonne variante si vous voulez un texte plus haut de gamme, tout en restant fidèle aux éléments réellement visibles dans l’annonce.",
      accessCopy: "L’arrivée et l’installation sont décrites avec clarté pour renforcer la confiance avant la réservation.",
      exchangeCopy: "Les échanges gardent un ton posé, précis et rassurant pour répondre aux attentes d’un séjour plus soigné.",
      extraCopy: `${premiumNarrativeHighlights.length > 0 ? `Points à valoriser : ${joinFrenchList(premiumNarrativeHighlights.slice(0, 3))}. ` : ""}${rulesBase}`.trim(),
    },
    {
      label: "Court séjour / business",
      bookingPresentation: `${bookingCopyLabel} convient bien à un passage rapide, un déplacement professionnel ou quelques nuits où l’on attend avant tout de l’efficacité.`,
      bookingHousing: `${bookingCopyLabel} répond bien aux séjours courts et aux déplacements rapides. ${/workspace|desk|bureau/i.test(sourceTextLower) ? "L’espace de travail identifié ajoute un vrai plus pour télétravailler ponctuellement." : "Les équipements utiles permettent de garder un séjour efficace, sans perdre de temps sur l’organisation."}`,
      bookingComfort: `${sentenceCase(amenitiesSentence)} soutiennent un séjour court bien mené. ${hasParkingSignal ? "Le parking évite de perdre du temps à l’arrivée." : ""} ${/wi[\s-]?fi|internet/i.test(sourceTextLower) ? "Le Wi‑Fi répond aussi bien aux usages personnels qu’aux besoins professionnels." : ""}`.trim(),
      bookingLocation: `${bookingStructuredNearbyBlock} ${bookingBusinessLocationHint}`.trim(),
      bookingServices: `${bookingStructuredServiceBase} ${bookingStructuredRulesBase}`,
      airbnbIntro: `${propertyLabel} fonctionne très bien pour quelques nuits, un voyage pro ou un séjour court où chaque détail doit rester simple et fiable.`,
      airbnbHousing: `${layoutBase} ${comfortBase}`,
      airbnbServices: `${serviceBase} ${/workspace|desk|bureau/i.test(sourceTextLower) ? "Le logement garde aussi une dimension pratique pour travailler ponctuellement sur place." : ""}`.trim(),
      airbnbLocation: `${locationBase}`,
      airbnbCta: "👉 Appel à réserver\n\nÀ privilégier si vous cherchez une adresse efficace, facile à rejoindre et assez confortable pour un court séjour bien mené.",
      accessCopy: "L’accès, les horaires et l’installation sont pensés pour limiter les frictions sur un séjour court.",
      exchangeCopy: "Les échanges restent rapides, précis et orientés vers les informations vraiment utiles avant l’arrivée.",
      extraCopy: `${rulesBase} ${/workspace|desk|bureau/i.test(sourceTextLower) ? "Le logement conserve aussi un bon niveau de praticité pour travailler ponctuellement." : ""}`.trim(),
    },
  ] as const;

  const buildBookingDescription = (angle: (typeof variantAngles)[number]) =>
    [
      angle.bookingPresentation,
      angle.bookingHousing,
      angle.bookingComfort,
      angle.bookingLocation,
      angle.bookingServices,
    ].filter(Boolean).join("\n\n");

  const buildAirbnbDescription = (angle: (typeof variantAngles)[number]) =>
    [
      "✨ Introduction accrocheuse",
      angle.airbnbIntro,
      "",
      "🏡 Le logement",
      angle.airbnbHousing,
      "",
      "🛎️ Services",
      angle.airbnbServices,
      "",
      "📍 Emplacement",
      angle.airbnbLocation,
      "",
      angle.airbnbCta,
    ].join("\n\n");

  return variantAngles.map((angle) => {
    const bookingMain = limitBookingDescriptionText(buildBookingDescription(angle));
    const airbnbMain = trimToWordBoundary(
      normalizeSentence(buildAirbnbDescription(angle)).replace(/\n+/g, " ").replace(/\s+/g, " ").trim(),
      500
    );

    const airbnbSectionLogement = [
      angle.airbnbHousing,
      angle.airbnbIntro,
      standoutAmenityPhrase ? `Atouts visibles : ${standoutAmenityPhrase}.` : "",
      amenitiesSentence ? `Équipements utiles : ${amenitiesSentence}.` : "",
    ].filter(Boolean).join("\n\n");

    const airbnbSectionLogementDetaille = [
      layoutBase,
      comfortBase,
      interiorBlock,
      sourceHighlights.slice(0, 2).join(" "),
    ].filter(Boolean).join("\n\n");

    const airbnbSectionAcces = [
      angle.accessCopy,
      serviceLabels.some((item) => /arrivée autonome/i.test(item))
        ? "Une arrivée autonome peut faciliter l’installation lorsque cette option est disponible."
        : "",
      locationBase,
    ].filter(Boolean).join("\n\n");

    const airbnbSectionEchanges = [
      angle.exchangeCopy,
      "Les échanges doivent rester simples, utiles et rassurants : horaires, accès, consignes et informations pratiques avant l’arrivée.",
    ].filter(Boolean).join("\n\n");

    const airbnbSectionAutresInfos = [
      angle.extraCopy,
      rulesBase,
      ruleHighlights.slice(0, 2).join(" "),
    ].filter(Boolean).join("\n\n");

    return {
      main: bookingMain,
      mainAirbnb: airbnbMain,
      mainBooking: bookingMain,
      logement: airbnbSectionLogement,
      logementDetaille: airbnbSectionLogementDetaille,
      acces: airbnbSectionAcces,
      echanges: airbnbSectionEchanges,
      autresInfos: airbnbSectionAutresInfos,
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

  // Important : ne pas confondre “2 chambres” avec une chambre privée.
  const hasWholeApartmentSignal =
    /logement entier\s*:\s*appartement|appartement entier|entire apartment|\bappart\b|apartment|flat|f\d|t\d/i.test(source);

  if (/studio|studette/.test(source)) return "Studio";
  if (hasWholeApartmentSignal) return "Appartement";
  if (/(villa|maison|house|cottage|gîte|gite)/.test(source)) return "Maison";
  if (/\bloft\b/.test(source)) return "Loft";

  const hasPrivateRoomSignal =
    /chambre privée|private room|room in|chambre chez l.habitant/i.test(source);

  if (hasPrivateRoomSignal) return "Chambre";
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
  return trimToWordBoundary(first, maxLen);
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
  return trimToWordBoundary(
    normalizeSentence(value).replace(/\s+/g, " ").trim(),
    OPTIMIZED_TITLE_BOOKING_MAX
  );
}

function limitBookingDescriptionText(value: string) {
  const normalized = value.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (normalized.length <= 2200) return normalized;

  const sentences = splitIntoSentences(normalized.replace(/\n+/g, " "));
  let acc = "";
  for (const sentence of sentences) {
    const next = acc ? `${acc} ${sentence}` : sentence;
    if (next.length > 2200) break;
    acc = next;
  }

  return acc || trimToWordBoundary(normalized, 2200);
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

function extractBookingPropertyName(rawTitle: string, location: string) {
  const title = normalizeSentence(rawTitle).replace(/\s+/g, " ").trim();
  if (!title) return "";

  let cleaned = title
    .replace(/\s*[|·•]\s*booking\.com.*$/i, "")
    .replace(/\s*[|·•]\s*official.*$/i, "")
    .trim();

  const locationTokens = new Set(
    [
      ...normalizeSentence(location)
        .toLowerCase()
        .split(/[,\-–—/]/)
        .map((item) => item.trim())
        .filter(Boolean),
      "morocco",
      "maroc",
      "marruecos",
      "morocco.",
    ].filter(Boolean)
  );

  const commaParts = cleaned
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  while (commaParts.length > 1) {
    const last = commaParts[commaParts.length - 1]?.toLowerCase() ?? "";
    if (locationTokens.has(last)) {
      commaParts.pop();
      continue;
    }
    break;
  }

  cleaned = commaParts.join(", ").trim();

  if (/\s-\s/.test(cleaned)) {
    const [left, right] = cleaned.split(/\s-\s/, 2).map((part) => part.trim());
    if (
      left &&
      right &&
      /\b(riad|dar|villa|maison|studio|suite|appartement|apartment|hotel|hôtel)\b/i.test(left) &&
      right.split(/\s+/).length <= 4
    ) {
      cleaned = left;
    }
  }

  if (
    !cleaned ||
    /^(booking\.com|annonce sans titre|untitled booking listing|hébergement|logement|appartement|studio)$/i.test(
      cleaned
    )
  ) {
    return "";
  }

  return cleaned.trim();
}

function buildBookingTitleFeaturePool(source: string, verifiedLabels: string[], location: string) {
  const features = [
    /terrasse|balcon|patio|rooftop/i.test(source) ? "terrasse" : null,
    /spa|hammam|sauna/i.test(source) ? "spa" : null,
    /wi[\s-]?fi|internet/i.test(source) || verifiedLabels.some((item) => /wi/i.test(item)) ? "Wi‑Fi" : null,
    /parking|garage/i.test(source) || verifiedLabels.some((item) => /parking/i.test(item)) ? "parking" : null,
    /clim|air ?condition/i.test(source) || verifiedLabels.some((item) => /clim/i.test(item)) ? "climatisation" : null,
    /piscine|pool/i.test(source) || verifiedLabels.some((item) => /piscine/i.test(item)) ? "piscine" : null,
    /médina|medina/i.test(`${source} ${location}`) ? "médina" : null,
    /palais royal/i.test(source) ? "proche Palais Royal" : null,
    /centre-ville|hypercentre|historique/i.test(`${source} ${location}`) ? "centre historique" : null,
    /bureau|workspace|desk/i.test(source) ? "espace de travail" : null,
    /charme marocain|riad|patio/i.test(source) ? "charme marocain" : null,
  ].filter((item): item is string => Boolean(item));

  return features.filter((item, index, array) => array.indexOf(item) === index);
}

/**
 * Titre d’exemple aligné sur la plateforme de sortie (Airbnb vs Booking) et l’index de variante
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
  visualSignals?: string[];
}): string {
  const title = normalizeSentence(options.title);
  const location = normalizeSentence(options.location);
  const description = normalizeSentence(options.description);
  const visualSignals = Array.isArray(options.visualSignals)
    ? options.visualSignals.map((item) => normalizeSentence(item)).filter(Boolean).slice(0, 6)
    : [];
  const visualSignalText = visualSignals.join(" ");
  const verified = pickVerifiedAmenityLabelsForOptimizedTitle(options.amenities);
  const a1 = verified[0] ?? null;
  const a2 = verified[1] ?? null;
  const c1 = a1 ? amenityCompactLabel(a1) : null;
  const c2 = a2 ? amenityCompactLabel(a2) : null;
  const amenitySignalText = Array.isArray(options.amenities)
    ? options.amenities.map((item) => normalizeSentence(item)).filter(Boolean).slice(0, 80).join(" ")
    : "";
  const propertyKind = frenchPropertyKindForTitle(
    title,
    `${description} ${visualSignalText} ${amenitySignalText}`
  );
  const spk = shortPropertyKindLabel(propertyKind);
  const cap = readGuestCapacityHint(title, description);
  const count = Math.max(1, options.variantCount);
  const idx = ((options.variantIndex % count) + count) % count;

  const locAir = shortenLocationForOptimizedTitle(location, 16);
  const locBook = shortenLocationForOptimizedTitle(location, 44);
  const locPhraseAir = locAir ? ` · ${locAir}` : "";
  const locPhraseBook = locBook ? ` à ${locBook}` : "";

  const richTitleSource = `${description} ${visualSignalText}`;
  const titleVisualTokens = [
    /croisette/i.test(richTitleSource) ? "Croisette" : null,
    /palais des festivals|festival/i.test(richTitleSource) ? "Palais" : null,
    /(?:cannes|nice|antibes|agadir|taghazout|essaouira|tanger|casablanca|rabat|dakhla|marseille|barcelone|barcelona|valencia|malaga|lisbonne|porto)/i.test(richTitleSource) && /plage|mer|littoral/i.test(richTitleSource) ? "plages" : null,
    /rue d.?antibes|shopping|boutiques/i.test(richTitleSource) ? "shopping" : null,
    /gare|sncf/i.test(richTitleSource) ? "gare" : null,
    /congr[eè]s|business/i.test(richTitleSource) ? "congrès" : null,
    /piscine|pool/i.test(richTitleSource) ? "piscine" : null,
    /terrasse|balcon|rooftop/i.test(richTitleSource) ? "terrasse" : null,
    null,
    /médina|medina|historique/i.test(richTitleSource) ? "médina" : null,
    /golf/i.test(richTitleSource) ? "golf" : null,
  ].filter((x): x is string => Boolean(x));

  const extraPool = [c1, c2, ...titleVisualTokens, cap ? (cap.length > 16 ? cap.replace(/voyageurs?/i, "pers.") : cap) : null].filter(
    (x): x is string => Boolean(x)
  );

  if (options.displayPlatform === "airbnb") {
    const titleKind = propertyKind === "Appartement" ? "Appart" : spk;
    const angleTokens: string[][] = [
      [titleVisualTokens[0] || c1 || "cosy", titleVisualTokens[1] || c2 || cap || "lumineux"],
      [titleVisualTokens[0] || cap || c1 || "fluide", titleVisualTokens[1] || c2 || "autonome"],
      [titleVisualTokens[0] || c1 || "bien placé", titleVisualTokens[1] || locAir || c2 || "quartier"],
      [titleVisualTokens[0] || c1 || "clair", titleVisualTokens[1] || c2 || cap || "rassurant"],
      [titleVisualTokens[0] || c1 || "doux", titleVisualTokens[1] || c2 || cap || "zen"],
    ];
    const pool = [...new Set([...extraPool, ...(angleTokens[idx] ?? []).filter(Boolean)])] as string[];

    let raw = "";
    switch (idx) {
      case 0:
        raw = `${titleKind} cosy${locPhraseAir}${pool[0] ? ` · ${pool[0]}` : ""}${pool[1] ? ` · ${pool[1]}` : ""}`;
        break;
      case 1:
        raw = `Pied-à-terre net${locPhraseAir}${pool[0] ? ` · ${pool[0]}` : ""}${pool[1] ? ` · ${pool[1]}` : ""}`;
        break;
      case 2:
        raw = `${titleKind} top emplacement${locPhraseAir}${pool[0] ? ` · ${pool[0]}` : ""}`;
        break;
      case 3:
        raw = `${titleKind} tout confort${locPhraseAir}${pool[0] ? ` · ${pool[0]}` : ""}${pool[1] ? ` · ${pool[1]}` : ""}`;
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

  const bookingKindSource = `${title} ${description} ${visualSignalText} ${amenitySignalText}`;
  const isRiadTitle = /\briad\b|\bryad\b|médina|medina|patio/i.test(bookingKindSource);
  const bookingPropertyName = extractBookingPropertyName(title, location);
  const bookingBaseName = (() => {
    const source = bookingPropertyName || title;
    const compact = normalizeSentence(source)
      .replace(/,\s*(Marrakech|Marrakesh|F[eè]s|Fez|Maroc|Morocco|Marruecos).*$/i, "")
      .replace(/\s+-\s+Quiet Desire.*$/i, "")
      .replace(/\s+avec\s+.*$/i, "")
      .replace(/\s+à\s+Gu[eé]liz.*$/i, " à Guéliz")
      .trim();

    if (/\briad\b/i.test(compact)) {
      const match = compact.match(/\bRiad\s+[A-ZÀ-Ÿ0-9][A-Za-zÀ-ÿ0-9-]*/i);
      return match?.[0] ? sentenceCase(match[0]) : "Riad";
    }

    if (/\bstudio\b/i.test(`${compact} ${location}`) && /gu[eé]liz/i.test(`${compact} ${location}`)) {
      return "Studio Guéliz";
    }

    if (/\bappartement\b|\bapartment\b/i.test(`${compact} ${location}`) && /gu[eé]liz/i.test(`${compact} ${location}`)) {
      return "Appartement Guéliz";
    }

    return compact || (isRiadTitle ? "Riad" : locBook ? `${propertyKind}${locPhraseBook}` : propertyKind);
  })();
  const bookingMarketingBaseName = (() => {
    const baseKind =
      propertyKind === "Appartement"
        ? "Appartement"
        : propertyKind === "Studio"
          ? "Studio"
          : propertyKind;

    if (isRiadTitle) return "Riad de charme";
    if (/gu[eé]liz/i.test(`${location} ${description} ${visualSignalText}`)) return `${baseKind} à Guéliz`;
    if (/barcelona|barcelone/i.test(`${location} ${description} ${visualSignalText}`)) return `${baseKind} à Barcelone`;
    if (/marrakech|marrakesh/i.test(`${location} ${description} ${visualSignalText}`)) return `${baseKind} à Marrakech`;
    if (locBook) return `${baseKind} à ${locBook}`;
    return baseKind;
  })();

  const bookingFeaturePool = buildBookingTitleFeaturePool(
    bookingKindSource,
    verified,
    location
  );
  const bookingFeatureA = bookingFeaturePool[0] ?? "confort";
  const bookingFeatureB =
    bookingFeaturePool.find((item) => item.toLowerCase() !== bookingFeatureA.toLowerCase()) ??
    (isRiadTitle ? "charme marocain" : "séjour fluide");
  const bookingFeatureLocation =
    bookingFeaturePool.find((item) => /médina|palais|centre historique/i.test(item)) ?? null;
  const bookingLocationSuffix =
    bookingPropertyName && locBook && !bookingPropertyName.toLowerCase().includes(locBook.toLowerCase())
      ? ` à ${locBook}`
      : "";
  const bookingCoreLocation = trimToWordBoundary(locBook || location, 28);
  const bookingHasSpa = bookingFeaturePool.includes("spa");
  const bookingHasTerrace = bookingFeaturePool.includes("terrasse");
  const bookingHasPool = bookingFeaturePool.includes("piscine");
  const bookingHasParking = bookingFeaturePool.includes("parking");
  const bookingHasMedina = bookingFeaturePool.includes("médina");
  const bookingHasCenter = bookingFeaturePool.includes("centre historique") || /gu[eé]liz|centre/i.test(bookingCoreLocation);
  const bookingTitleLocationSource = `${bookingBaseName} ${bookingCoreLocation} ${location} ${title} ${description}`;
  const bookingTitleLocation = /gu[eé]liz/i.test(bookingTitleLocationSource)
    ? "Guéliz"
    : /marrakech|marrakesh/i.test(bookingTitleLocationSource)
      ? "Marrakech"
      : bookingCoreLocation;

  const bookingTitleValuePool = [
    `${bookingMarketingBaseName} avec ${bookingFeatureA.toLowerCase()} et ${bookingFeatureB.toLowerCase()}`,
    `${bookingMarketingBaseName} confortable pour un séjour pratique`,
    `${bookingMarketingBaseName} bien placé avec équipements utiles`,
    `${bookingMarketingBaseName} pour séjour détente et déplacements faciles`,
    `${bookingMarketingBaseName} avec confort, Wi-Fi et accès pratique`,
    bookingHasPool && bookingHasParking && bookingHasTerrace
      ? `${bookingMarketingBaseName} avec terrasse, piscine et parking`
      : null,
    bookingHasPool && bookingHasParking
      ? `${bookingMarketingBaseName} avec piscine, parking et accès pratique`
      : null,
    bookingHasTerrace && bookingHasPool
      ? `${bookingMarketingBaseName} confortable avec terrasse et piscine`
      : null,
    bookingHasTerrace && bookingTitleLocation
      ? `${bookingMarketingBaseName} lumineux avec terrasse`
      : null,
    bookingHasParking && bookingTitleLocation
      ? `${bookingMarketingBaseName} pratique avec parking et Wi-Fi`
      : null,
    bookingHasSpa && bookingHasTerrace
      ? `${bookingMarketingBaseName} avec spa, terrasse et ambiance détente`
      : null,
    bookingHasMedina
      ? `${bookingMarketingBaseName} au cœur de la médina`
      : null,
    bookingHasCenter && bookingTitleLocation
      ? `${bookingMarketingBaseName} bien placé près du centre`
      : null,
    bookingTitleLocation
      ? `${bookingMarketingBaseName} idéal pour séjour court ou déplacement`
      : null,
    bookingFeatureA && bookingFeatureB
      ? `${bookingMarketingBaseName} avec ${bookingFeatureA.toLowerCase()}, ${bookingFeatureB.toLowerCase()} et séjour confortable`
      : null,
  ]
    .map((item) => normalizeSentence(item ?? ""))
    .filter(Boolean)
    .filter((item, index, array) => array.indexOf(item) === index);

  let raw = bookingTitleValuePool[idx] ?? bookingTitleValuePool[0] ?? `${bookingMarketingBaseName} avec confort et bon emplacement`;

  raw = normalizeSentence(raw)
    .replace(/\s+(?:&|et)$/i, "")
    .replace(/(?:&|et)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  const out = limitBookingTitle(raw)
    .replace(/\s+(?:&|et)$/i, "")
    .replace(/(?:&|et)\s*$/i, "")
    .trim();

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

function stripAiSectionLeadTitle(block: string) {
  const t = normalizeSentence(block);
  if (!t) return "";
  const lines = t.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return t;
  const head = lines[0];
  if (/^[🏡✨🔑💬ℹ️]/.test(head) && head.length < 72) {
    return lines.slice(1).join(" ");
  }
  return t;
}

function firstSentencesUpTo(text: string, maxLen: number, maxSentences: number) {
  const body = stripAiSectionLeadTitle(text).replace(/\n+/g, " ").trim();
  if (!body) return "";
  const sents = splitIntoSentences(body);
  let acc = "";
  let count = 0;

  for (const s of sents) {
    if (count >= maxSentences) break;
    const next = acc ? `${acc} ${s}` : s;

    if (next.length > maxLen) {
      break;
    }

    acc = next;
    count++;
  }

  if (acc) return acc;

  const trimmed = body.slice(0, maxLen).replace(/\s+\S*$/, "").trim();
  return trimmed || body;
}

/**
 * Paragraphe unique « prêt à coller » pour Booking : condense les 5 blocs sans les recopier tels quels.
 */
function buildBookingSectionsReadySummary(variant: AiTextSections): string {
  const cleaned = normalizeSentence(
    variant.mainBooking
      .replace(/\bPrésentation courte\b/gi, " ")
      .replace(/\bLe logement\b/gi, " ")
      .replace(/\bÉquipements et confort\b/gi, " ")
      .replace(/\bEmplacement\b/gi, " ")
      .replace(/\bServices \/ échanges\b/gi, " ")
      .replace(/\n+/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return "À intégrer dans votre description : le confort des espaces, l’accès au logement, la disponibilité pour les voyageurs et les informations pratiques utiles à l’arrivée.";
  }

  const sentences = splitIntoSentences(cleaned);
  let merged = "";
  for (const sentence of sentences) {
    const next = merged ? `${merged} ${sentence}` : sentence;
    if (next.length > 680) break;
    merged = next;
  }

  return merged || cleaned.slice(0, 680).trim();
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
      return "text-amber-700";
    default:
      return "text-amber-700";
  }
}

function marketLabelText(label: string | undefined, copy: (typeof auditDetailCopy)["en"]) {
  switch (label) {
    case "above_market":
    case "top_performer":
      return copy.marketLabelAbove;
    case "below_market":
    case "underperforming":
      return copy.marketLabelBelow;
    case "competitive":
      return copy.marketLabelCompetitive;
    default:
      return copy.marketLabelCompetitive;
  }
}

function lqiLabelText(label: string | null | undefined, copy: typeof auditDetailCopy.en) {
  switch (label) {
    case "market_leader":
      return copy.lqiLabelHighSignal;
    case "strong_performer":
      return copy.lqiLabelFavorable;
    case "competitive":
      return copy.lqiLabelFavorable;
    case "improving":
      return copy.lqiLabelImproving;
    case "needs_work":
      return copy.lqiLabelNeedsWork;
    default:
      return copy.iqaPerceivedListingQuality;
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

function isUsablePricingInsight(value: unknown): value is PricingBusinessInsight {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  const st = o.status;
  if (st !== "UNDERPRICED" && st !== "OPTIMAL" && st !== "OVERPRICED") return false;
  for (const key of ["medianPrice", "recommendedPrice", "priceDeltaPercent", "monthlyImpactEstimate"] as const) {
    const n = o[key];
    if (typeof n !== "number" || !Number.isFinite(n)) return false;
  }
  if (typeof o.message !== "string" || !o.message.trim()) return false;
  if (typeof o.currency !== "string" || !o.currency.trim()) return false;
  return true;
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

type RefineDiagnosticData = {
  auditId?: string;
  listingId?: string;
  comparableScoring?: {
    status: string;
    premiumMode?: boolean;
    snapshotId?: string;
    matchedBy?: string;
    count?: number;
    reason?: string;
    checkedFields?: string[];
    topScores?: Array<{
      url: string | null;
      score: number;
      breakdown?: {
        typeCompatibility?: number;
        capacityMatch?: number;
        bedroomMatch?: number;
        priceSegment?: number;
        amenitiesMatch?: number;
      };
    }>;
    notes?: string[];
  };
  refinedMarketPreview?: {
    status: string;
    selectedComparableCount: number;
    medianNightlyPrice: number | null;
    avgNightlyPrice: number | null;
    confidencePreview: string;
    reason: string | null;
  };
  premiumDiscoverySignals?: {
    premiumMode: boolean;
    queryKeywords: string[];
    softMinPrice: number | null;
    minGuests: number | null;
    minBedrooms: number | null;
    requiredSignals: string[];
    boostSignals: string[];
  } | null;
  airbnbUrlPreview?: string | null;
  bookingQueriesPreview?: string[];
  premiumDiscoveryResult?: {
    status: string;
    candidateCount: number;
    candidateUrls: string[];
    source: string;
    elapsedMs: number;
    fallbackUsed: boolean;
  } | null;
  premiumExtractedComparables?: {
    status: string;
    extractedCount: number;
    failedCount: number;
    attemptedCount?: number;
    cap?: number;
    timeoutMs?: number;
    mode?: string;
    comparables: Array<{
      url: string;
      title: string | null;
      propertyType: string | null;
      price: number | null;
      bedrooms: number | null;
      capacity: number | null;
      score: number;
      breakdown?: {
        typeCompatibility?: number;
        capacityMatch?: number;
        bedroomMatch?: number;
        priceSegment?: number;
        amenitiesMatch?: number;
      };
    }>;
  } | null;
};

export default function AuditDetailPage() {
  const { locale, copy } = useTranslation(auditDetailCopy);
  const params = useParams();
  const auditId = typeof params?.id === "string" ? params.id : "";

  const [audit, setAudit] = useState<AuditRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiBookingDescriptions, setAiBookingDescriptions] = useState<Array<{ label: string; description: string }>>([]);
  const [showToast, setShowToast] = useState(true);
  const [, setIsPro] = useState(false);
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [copyToastKey, setCopyToastKey] = useState<AiTextSectionKey | null>(null);
  const [generationSeed, setGenerationSeed] = useState(0);
  const [editableAiDescription, setEditableAiDescription] = useState("");
  const aiDescriptionTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [refineOpen, setRefineOpen] = useState(false);
  const [refinePropType, setRefinePropType] = useState("");
  const [refineBedrooms, setRefineBedrooms] = useState("");
  const [refineBathrooms, setRefineBathrooms] = useState("");
  const [refineGuests, setRefineGuests] = useState("");
  const [refineBeds, setRefineBeds] = useState("");
  const [refineMinStay, setRefineMinStay] = useState("");
  const [refineMarketTier, setRefineMarketTier] = useState("");
  const [refineAttributes, setRefineAttributes] = useState<string[]>([]);
  const [isRefiningMarket, setIsRefiningMarket] = useState(false);
  const [refineError, setRefineError] = useState<string | null>(null);
  const [refineDiagnosticResult, setRefineDiagnosticResult] = useState<RefineDiagnosticData | null>(null);
  const [showRefineDiagnosticDebug, setShowRefineDiagnosticDebug] = useState(false);
  const [runPremiumDiscovery, setRunPremiumDiscovery] = useState(false);

  const handleRefineMarket = async () => {
    if (!auditId) return;
    setIsRefiningMarket(true);
    setRefineError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(`/api/audits/${auditId}/refine-market`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          ...(runPremiumDiscovery ? { mode: "active" } : {}),
          ...(refinePropType ? { propType: refinePropType } : {}),
          ...(refineBedrooms ? { bedrooms: refineBedrooms } : {}),
          ...(refineBathrooms ? { bathrooms: refineBathrooms } : {}),
          ...(refineGuests ? { guests: refineGuests } : {}),
          ...(refineBeds ? { beds: refineBeds } : {}),
          ...(refineMinStay ? { minStay: refineMinStay } : {}),
          ...(refineMarketTier ? { marketTier: refineMarketTier } : {}),
          ...(refineAttributes.length > 0 ? { attributes: refineAttributes } : {}),
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({})) as { error?: string };
        setRefineError(errJson.error ?? `Erreur ${res.status}`);
        return;
      }
      const data = await res.json() as RefineDiagnosticData & {
        mergedTargetPreview: unknown;
        market: unknown;
        refinementInput: unknown;
        message: string;
      };
      console.log("[refine-market][diagnostic-response]", {
        auditId: data.auditId,
        listingId: data.listingId,
        comparableScoring: data.comparableScoring,
      });
      setRefineDiagnosticResult(data);
    } catch (err) {
      setRefineError(err instanceof Error ? err.message : "Erreur réseau");
    } finally {
      setIsRefiningMarket(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function loadAudit() {
      const auditSelect = `
            id,
            workspace_id,
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
              city,
              raw_payload
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

        console.info("[AUDIT LOAD QUERY]", {
          auditTable: "audits",
          auditSelect,
          auditFilters: { id: auditId },
          listingTable: "listings",
          listingSelect,
        });

        const auditResponse = await supabase
          .from("audits")
          .select(auditSelect)
          .eq("id", auditId)
          .maybeSingle();

        const data = auditResponse.data as AuditRecord | null;
        const error = auditResponse.error;
        const found = Boolean(data);
        let fetchReason = "ok";
        if (error) {
          fetchReason = "query_error";
        } else if (!data) {
          fetchReason = "not_visible_or_missing";
        }
        const auditWorkspaceId =
          typeof data?.workspace_id === "string" && data.workspace_id.trim()
            ? data.workspace_id.trim()
            : null;

        console.info("[audit-detail] audit-by-id response", {
          auditId,
          resolvedWorkspaceId: workspace.id,
          auditWorkspaceId,
          error: auditResponse.error,
          hasData: found,
          resultPayloadType: data?.result_payload ? typeof data.result_payload : null,
        });

        console.log(
          "[audit][fetch][by-id]",
          JSON.stringify({
            auditId,
            resolvedWorkspaceId: workspace.id,
            auditWorkspaceId: auditWorkspaceId ?? null,
            found,
            reason: fetchReason,
          })
        );

        if (error) {
          console.error("Failed to load audit:", {
            error,
            message: error?.message,
            details: error?.details,
            hint: error?.hint,
            code: error?.code,
          });
        }

        const listingWorkspaceId = auditWorkspaceId ?? workspace.id;

        try {
          const planWorkspaceId = listingWorkspaceId;
          const plan = await getWorkspacePlan(planWorkspaceId, supabase);
          if (isMounted) {
            setIsPro(plan.planCode === "pro");
          }
        } catch (planError) {
          console.warn("Failed to load workspace plan for audit detail", planError);
          if (isMounted) {
            setIsPro(false);
          }
        }

        let listingData: ListingJoin = null;

        if (data?.listing_id) {
          console.info("[AUDIT LISTING QUERY]", {
            listingTable: "listings",
            listingSelect,
            listingFilters: {
              id: data.listing_id,
              workspace_id: listingWorkspaceId,
            },
          });

          const listingResponse = await supabase
            .from("listings")
            .select(listingSelect)
            .eq("id", data.listing_id)
            .eq("workspace_id", listingWorkspaceId)
            .maybeSingle();

          if (listingResponse.error) {
            const le = listingResponse.error;
            console.error("Failed to load audit listing:", {
              code: le.code,
              message: le.message,
              details: le.details,
              hint: le.hint,
            });
          } else {
            listingData = normalizeAuditListingRow(listingResponse.data);
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
          const actionCount = Array.isArray(payload.actions) ? payload.actions.length : 0;
          const legacyImprovementCount = Array.isArray(payload.improvements)
            ? payload.improvements.length
            : 0;
          const contentStrengthsCount = Array.isArray(payload.content?.strengths)
            ? payload.content.strengths.length
            : 0;
          const contentWeaknessesCount = Array.isArray(payload.content?.weaknesses)
            ? payload.content.weaknesses.length
            : 0;
          const legacyStrengthsCount = Array.isArray(payload.strengths) ? payload.strengths.length : 0;
          const legacyWeaknessesCount = Array.isArray(payload.weaknesses)
            ? payload.weaknesses.length
            : 0;
          const resolvedComparableCount =
            coerceFiniteNumber(payload.market?.comparableCount) ??
            coerceFiniteNumber(payload.marketPositioning?.comparableCount) ??
            (Array.isArray(payload.marketPositioning?.comparables)
              ? payload.marketPositioning.comparables.length
              : null) ??
            coerceFiniteNumber(payload.competitorSummary?.competitorCount);
          const resolvedPricedComparableCount =
            coerceFiniteNumber(payload.market?.pricedComparableCount) ?? null;
          const resolvedBookingPotential =
            coerceFiniteNumber(payload.business?.bookingPotential) ??
            coerceFiniteNumber(payload.bookingPotential) ??
            coerceFiniteNumber(payload.estimatedBookingLift?.high) ??
            coerceFiniteNumber(payload.estimatedBookingLift?.low);
          const resolvedEstimatedRevenueLow =
            coerceFiniteNumber(payload.business?.estimatedRevenueLow) ??
            coerceFiniteNumber(payload.estimatedRevenue?.low) ??
            coerceFiniteNumber(payload.estimatedRevenueImpact?.lowMonthly);
          const resolvedEstimatedRevenueHigh =
            coerceFiniteNumber(payload.business?.estimatedRevenueHigh) ??
            coerceFiniteNumber(payload.estimatedRevenue?.high) ??
            coerceFiniteNumber(payload.estimatedRevenueImpact?.highMonthly);

          console.info("[audit-detail] payload diagnostics", {
            auditId: normalizedAudit.id,
            payloadKeys: Object.keys(payload),
            legacyMarketPosition: payload.marketPosition ?? null,
            legacyEstimatedBookingLift: payload.estimatedBookingLift ?? null,
            legacyEstimatedRevenueImpact: payload.estimatedRevenueImpact ?? null,
            impactSummary: payload.impactSummary ?? null,
            listingQualityIndex: payload.listingQualityIndex ?? null,
            legacyCompetitorSummary: payload.competitorSummary ?? null,
            market: payload.market ?? null,
            business: payload.business ?? null,
            actionsCount: actionCount,
            actionsPreview: Array.isArray(payload.actions) ? payload.actions.slice(0, 3) : [],
            improvementsCount: actionCount || legacyImprovementCount,
            improvementsPreview: Array.isArray(payload.improvements)
              ? payload.improvements.slice(0, 3)
              : [],
            contentStrengthsCount,
            contentWeaknessesCount,
            strengthsCount: contentStrengthsCount || legacyStrengthsCount,
            strengths: payload.content?.strengths ?? payload.strengths ?? [],
            weaknessesCount: contentWeaknessesCount || legacyWeaknessesCount,
            weaknesses: payload.content?.weaknesses ?? payload.weaknesses ?? [],
            missingAmenitiesCount: Array.isArray(payload.missingAmenities)
              ? payload.missingAmenities.length
              : 0,
            missingAmenities: payload.missingAmenities ?? [],
            suggestedOpening: payload.suggestedOpening ?? null,
            resolvedPreview: {
              marketPosition:
                payload.market?.position ??
                payload.marketPosition?.label ??
                payload.marketPositioning?.status ??
                null,
              comparableCount: resolvedComparableCount,
              pricedComparableCount: resolvedPricedComparableCount,
              bookingPotential: resolvedBookingPotential,
              estimatedRevenueLow: resolvedEstimatedRevenueLow,
              estimatedRevenueHigh: resolvedEstimatedRevenueHigh,
            },
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

  const listingPayload =
    listing?.raw_payload && typeof listing.raw_payload === "object"
      ? (listing.raw_payload as Record<string, unknown>)
      : null;

  const listingRecord = listing as Record<string, unknown> | null;

  const aiGenerationStyle = useMemo(
    () => deduceAiGenerationStyle(listing?.source_platform),
    [listing?.source_platform]
  );

  const aiOutputPlatform = useMemo(
    () => resolveAiOutputPlatformFromListingSource(listing?.source_platform),
    [listing?.source_platform]
  );

  const payload: Partial<AuditResult> = audit?.result_payload ?? {};
  const rawPricingInsight = payload.businessInsights?.pricing;
  const pricingInsight = isUsablePricingInsight(rawPricingInsight) ? rawPricingInsight : null;
  const pricingSym =
    pricingInsight == null ? "" : pricingInsight.currency === "EUR" ? "€" : pricingInsight.currency;
  const formatAuditPricingAmount = (n: number) =>
    `${n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${pricingSym}`;
  const pricingMonthlyImpactRounded = pricingInsight ? Math.round(pricingInsight.monthlyImpactEstimate) : 0;
  const pricingMonthlyImpactLabel = pricingInsight
    ? `${pricingMonthlyImpactRounded > 0 ? "+" : ""}${pricingMonthlyImpactRounded.toLocaleString("fr-FR")} ${pricingSym}`
    : "";
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
        : buildConservativeLegacyRecommendationTitle(text, impact),
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
  const normalizeSubScoreForDisplay = (value: number | null): number | null =>
    value !== null && value > 0 ? value : null;

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
  const targetQualityScoresUnavailable =
    payload.market?.marketSourceQuality === "cross_platform_fallback";

  const photoQuality = targetQualityScoresUnavailable
    ? null
    : normalizeSubScoreForDisplay(
        coerceFiniteNumber(payload.scoreBreakdown?.photos) ??
          coerceFiniteNumber(payload.metrics?.photoQuality) ??
          readLegacySubScore("photo", "photos", "visual") ??
          coerceFiniteNumber(payload.photoQuality)
      );
  const photoOrder = targetQualityScoresUnavailable
    ? null
    : normalizeSubScoreForDisplay(
        coerceFiniteNumber(payload.scoreBreakdown?.photoOrder) ??
          coerceFiniteNumber(payload.metrics?.photoOrder) ??
          readLegacySubScore("photo_order", "ordre", "order", "gallery", "galerie") ??
          (typeof payload.photoOrder === "number" ? coerceFiniteNumber(payload.photoOrder) : null) ??
          readExplicitScoreFromTextSources(photoOrderTextSignals)
      );
  const descriptionQuality = targetQualityScoresUnavailable
    ? null
    : normalizeSubScoreForDisplay(
        coerceFiniteNumber(payload.scoreBreakdown?.description) ??
          coerceFiniteNumber(payload.metrics?.descriptionQuality) ??
          readLegacySubScore("description", "desc", "text") ??
          coerceFiniteNumber(payload.descriptionQuality)
      );
  const amenitiesCompleteness = targetQualityScoresUnavailable
    ? null
    : normalizeSubScoreForDisplay(
        coerceFiniteNumber(payload.scoreBreakdown?.amenities) ??
          coerceFiniteNumber(payload.metrics?.amenitiesCompleteness) ??
          readLegacySubScore("amenit", "equip") ??
          coerceFiniteNumber(payload.amenitiesCompleteness)
      );
  const seoStrength = targetQualityScoresUnavailable
    ? null
    : normalizeSubScoreForDisplay(
        coerceFiniteNumber(payload.scoreBreakdown?.seo) ??
          coerceFiniteNumber(payload.scoreBreakdown?.visibility) ??
          coerceFiniteNumber(payload.metrics?.seoStrength) ??
          readLegacySubScore("seo", "visib", "visibility") ??
          coerceFiniteNumber(payload.seoStrength)
      );
  const conversionStrength = targetQualityScoresUnavailable
    ? null
    : normalizeSubScoreForDisplay(
        coerceFiniteNumber(payload.scoreBreakdown?.conversion) ??
          coerceFiniteNumber(payload.metrics?.conversionStrength) ??
          coerceFiniteNumber(payload.conversionStrength) ??
          readLegacySubScore("conversion")
      );

  const avgPrice = coerceFiniteNumber(payload.metrics?.avgPrice);

  const marketPosition =
    payload.market != null
      ? payload.market.position ?? null
      : deriveLegacyMarketPosition();
  const comparableCount =
    payload.market != null
      ? coerceFiniteNumber(payload.market.comparableCount)
      : coerceFiniteNumber(payload.marketPositioning?.comparableCount) ??
        (Array.isArray(payload.marketPositioning?.comparables)
          ? payload.marketPositioning.comparables.length
          : null) ??
        coerceFiniteNumber(payload.competitorSummary?.competitorCount);
  const marketScore =
    payload.market != null
      ? coerceFiniteNumber(payload.market.score)
      : coerceFiniteNumber(legacyMarketComparison?.averageScore) ??
        coerceFiniteNumber(payload.marketPositioning?.averageScore) ??
        coerceFiniteNumber(payload.marketPosition?.avgCompetitorScore);
  const pricedComparableCount =
    coerceFiniteNumber(payload.market?.pricedComparableCount) ?? null;
  /** null = champ absent (ancien audit) → comportement inchangé ; 0-1 = lecture très limitée → supprime projections montants. */
  const hasSufficientPricedComparables = pricedComparableCount == null || pricedComparableCount >= 2;
  const hasStrongPricedComparables = pricedComparableCount == null || pricedComparableCount >= 3;
  const avgCompetitorPrice =
    payload.market != null
      ? coerceFiniteNumber(payload.market.avgCompetitorPrice)
      : coerceFiniteNumber(legacyMarketComparison?.avgCompetitorPrice) ??
        coerceFiniteNumber(payload.marketPositioning?.avgPrice) ??
        coerceFiniteNumber(payload.marketPosition?.avgCompetitorPrice);
  const priceDelta =
    payload.market != null
      ? coerceFiniteNumber(payload.market.priceDelta)
      : coerceFiniteNumber(legacyMarketComparison?.priceDelta) ??
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
  const revenueBaselineNightlyPriceStored =
    coerceFiniteNumber(payload.business?.revenueBaselineNightlyPrice) ??
    coerceFiniteNumber(legacyEstimatedRevenueImpact?.baselineNightlyPrice);
  const revenueBaselineBookedNightsStored =
    coerceFiniteNumber(payload.business?.revenueBaselineBookedNightsPerMonth) ??
    coerceFiniteNumber(legacyEstimatedRevenueImpact?.baselineBookedNightsPerMonth);
  const revenueBaselinePriceSource =
    payload.business?.revenueBaselinePriceSource === "market_median" ||
    payload.business?.revenueBaselinePriceSource === "listing"
      ? payload.business.revenueBaselinePriceSource
      : legacyEstimatedRevenueImpact?.baselinePriceSource === "market_median" ||
          legacyEstimatedRevenueImpact?.baselinePriceSource === "listing"
        ? legacyEstimatedRevenueImpact.baselinePriceSource
        : null;
  const payloadMetricsRating = coerceFiniteNumber(payload.metrics?.rating);
  const payloadMetricsReviewCount = coerceFiniteNumber(payload.metrics?.reviewCount);
  const payloadMetricsPhotoCount = coerceFiniteNumber(payload.metrics?.photoCount);
  const payloadMetricsAvgPrice = coerceFiniteNumber(payload.metrics?.avgPrice);
  const payloadMetricsCurrency =
    typeof payload.metrics?.currency === "string" && payload.metrics.currency.trim()
      ? payload.metrics.currency.trim()
      : null;
  const payloadBusinessRevenueBaselineNightlyPrice = coerceFiniteNumber(
    payload.business?.revenueBaselineNightlyPrice
  );
  const payloadBusinessRevenueBaselinePriceSource =
    payload.business?.revenueBaselinePriceSource === "market_median" ||
    payload.business?.revenueBaselinePriceSource === "listing"
      ? payload.business.revenueBaselinePriceSource
      : null;
  const legacyRevenueBaselineNightlyPrice = coerceFiniteNumber(
    legacyEstimatedRevenueImpact?.baselineNightlyPrice
  );
  const legacyRevenueBaselinePriceSource =
    legacyEstimatedRevenueImpact?.baselinePriceSource === "market_median" ||
    legacyEstimatedRevenueImpact?.baselinePriceSource === "listing"
      ? legacyEstimatedRevenueImpact.baselinePriceSource
      : null;

  const listingPlatform = String(listing?.source_platform ?? "").toLowerCase();
  const rawVisibleRating = payloadMetricsRating ?? coerceFiniteNumber(listing?.rating);
  const visibleRatingSource =
    payloadMetricsRating != null
      ? "payload.metrics.rating"
      : coerceFiniteNumber(listing?.rating) != null
        ? "listing.rating"
        : "unavailable";
  const visibleRatingScale =
    listingPlatform === "booking" || listingPlatform === "agoda" ? 10 : 5;
  const visibleRating =
    rawVisibleRating == null
      ? null
      : listingPlatform === "booking" || listingPlatform === "agoda"
        ? rawVisibleRating
        : rawVisibleRating > 5 && rawVisibleRating <= 10
          ? Number((rawVisibleRating / 2).toFixed(1))
          : Number(rawVisibleRating.toFixed(1));

  const visibleReviewCount = payloadMetricsReviewCount ?? coerceFiniteNumber(listing?.reviewCount);
  const visibleReviewCountSource =
    payloadMetricsReviewCount != null
      ? "payload.metrics.reviewCount"
      : coerceFiniteNumber(listing?.reviewCount) != null
        ? "listing.reviewCount"
        : "unavailable";

  const visiblePhotoCount =
    payloadMetricsPhotoCount ??
    coerceFiniteNumber(listingRecord?.photoCount) ??
    coerceFiniteNumber(listingPayload?.photoCount) ??
    (Array.isArray(listingPayload?.photos) ? listingPayload.photos.length : null) ??
    (Array.isArray(listingPayload?.images) ? listingPayload.images.length : null) ??
    null;
  const visiblePhotoCountSource =
    payloadMetricsPhotoCount != null
      ? "payload.metrics.photoCount"
      : coerceFiniteNumber(listingRecord?.photoCount) != null
        ? "listing.photoCount"
        : coerceFiniteNumber(listingPayload?.photoCount) != null
          ? "listing.raw_payload.photoCount"
          : Array.isArray(listingPayload?.photos)
            ? "listing.raw_payload.photos.length"
            : Array.isArray(listingPayload?.images)
              ? "listing.raw_payload.images.length"
              : "unavailable";

  const photoBadge = (() => {
    if (visiblePhotoCount == null) return null;

    if (visiblePhotoCount < 15) {
      return {
        label: `${visiblePhotoCount} photos • ajoutez plus de visuels`,
        className: "border-red-300 bg-red-50 text-red-700",
      };
    }

    if (visiblePhotoCount < 30) {
      return {
        label: copy.photoBadgeMedium.replace("{count}", String(visiblePhotoCount)),
        className: "border-orange-300 bg-orange-50 text-orange-700",
      };
    }

    if (visiblePhotoCount <= 45) {
      return {
        label: `${visiblePhotoCount} photos • galerie solide`,
        className: "border-emerald-300 bg-emerald-50 text-emerald-700",
      };
    }

    return {
      label: `${visiblePhotoCount} photos • très bon score`,
      className: "border-emerald-400 bg-emerald-100 text-emerald-800",
    };
  })();

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
  const normalizeActionImpact = (value: unknown): AuditActionImpact => {
    if (value === "high" || value === "medium" || value === "low") return value;
    if (typeof value === "string") {
      const v = value.trim().toLowerCase();
      if (v === "high" || v === "medium" || v === "low") return v;
    }
    return "low";
  };
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

  const pricingSignals = [
    comparableCount != null ? `${comparableCount} annonce(s) comparable(s) utilisée(s) pour lire le marché.` : null,
    avgCompetitorPrice != null ? `{copy.averageCompetitorPrice} observé : ${formatAuditPricingAmount(avgCompetitorPrice)}.` : null,
    priceDelta != null ? `Écart tarifaire estimé : ${priceDelta > 0 ? "+" : ""}${priceDelta.toFixed(1)}%.` : null,
    marketPosition ? `Position marché détectée : ${marketPosition}.` : null,
  ].filter((item): item is string => typeof item === "string" && item.trim().length > 0);

  const seoSignals = insightSignals.filter((item) =>
    /titre|seo|mot.?clé|recherch|localisation|croisette|emplacement|visibilité|positionnement/i.test(item)
  );

  const generatedActionPlan = buildActionPlan({
    scores: {
      photos: photoQuality ?? overallScore,
      description: descriptionQuality ?? overallScore,
      amenities: amenitiesCompleteness ?? overallScore,
      seo: seoStrength ?? overallScore,
      trust: conversionStrength ?? overallScore,
      pricing: marketScore ?? overallScore,
    },
    reasons: {
      photos: photoOrderTextSignals,
      description: weaknesses,
      amenities: missingAmenities,
      seo: seoSignals.length > 0 ? seoSignals : insightSignals,
      trust: [...critical, ...highImpact, ...weaknesses],
      pricing: pricingSignals,
    },
  });

  const improvements =
    generatedActionPlan.length > 0
      ? generatedActionPlan
      : structuredActionObjects.length > 0
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
  const improvementsCountResolved = improvements.length;

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
  let weaknessListInsightDerived = false;

  if (resolvedStrengths.length === 0 && resolvedWeaknesses.length === 0 && insightSignals.length > 0) {
    const split = deriveStrengthsAndWeaknessesFromInsights(insightSignals);
    resolvedStrengths = split.strengths;
    resolvedWeaknesses = split.weaknesses;
    weaknessListInsightDerived = true;
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

  if (DEBUG_AUDIT_UI) {
    console.log("[REMAINING MARKET RAW]", {
      market: payload.market,
      legacyMarketComparison,
      legacyMarketPositioning: payload.marketPositioning,
      overallScore,
    });
  }

  console.log("[REMAINING BUSINESS RAW]", {
    business: payload.business,
    auditRevenueLow: audit?.revenue_impact_low,
    auditRevenueHigh: audit?.revenue_impact_high,
    legacyEstimatedRevenue: payload.estimatedRevenue,
    legacyEstimatedRevenueImpact,
    legacyEstimatedBookingLift,
  });

  console.log("[STRENGTHS VS WEAKNESSES]", {
    strengthsCount: resolvedStrengths.length,
    strengths: resolvedStrengths,
    weaknessesCount: resolvedWeaknesses.length,
    weaknesses: resolvedWeaknesses,
    insights: insightSignals,
  });

  console.log("[ACTION SOURCES RAW]", {
    recommendations: payload.recommendations,
    legacyRecommendations: legacyRecommendationList,
    improvements: payload.improvements,
    actionCountResolved: improvementsCountResolved,
    actionPlan: improvements,
  });

  console.log("[ORDER PHOTO RAW]", {
    photoOrder,
    scoreBreakdown: payload.scoreBreakdown,
    subScores,
    photoOrderSuggestions,
    legacyPhotoOrder: payload.photoOrder,
  });

  if (DEBUG_AUDIT_UI) {
    console.log("[IQA RAW]", {
      quality: payload.scoreBreakdown,
      market: payload.market,
      business: payload.business,
      content: payload.content,
      listingQualityIndex: payload.listingQualityIndex,
    });
  }

  const scorePercent = Math.max(0, Math.min(100, (overallScore / 10) * 100));
  const bookingLiftLow =
    coerceFiniteNumber(legacyEstimatedBookingLift?.low) ??
    coerceFiniteNumber(audit?.booking_lift_low) ??
    0;
  const bookingLiftHigh =
    coerceFiniteNumber(legacyEstimatedBookingLift?.high) ??
    coerceFiniteNumber(audit?.booking_lift_high) ??
    0;
  const reservationPotentialLow =
    coerceFiniteNumber(payload.reservationPotentialLow) ??
    coerceFiniteNumber(legacyEstimatedBookingLift?.low) ??
    coerceFiniteNumber(audit?.booking_lift_low) ??
    null;
  const reservationPotentialHigh =
    coerceFiniteNumber(payload.reservationPotentialHigh) ??
    coerceFiniteNumber(legacyEstimatedBookingLift?.high) ??
    coerceFiniteNumber(audit?.booking_lift_high) ??
    null;
  const revenueEstimateIncomplete =
    estimatedRevenueLow == null || estimatedRevenueHigh == null;
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
  const lqiConversionPotentialNativeRaw = toRoundedMetric(
    listingQualityIndex?.components?.conversionPotential
  );
  const lqiConversionPotentialRaw =
    lqiConversionPotentialNativeRaw ??
    (bookingPotential !== null ? Math.round(bookingPotential * 10) : null);

  const lqiScore =
    lqiScoreRaw !== null
      ? lqiScoreRaw
      : overallScore > 0
      ? Math.round(Math.max(0, Math.min(10, overallScore)) * 10)
      : null;
  const lqiScoreIsNativeIqa = lqiScoreRaw !== null;

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
  const lqiListingQualityIsNative = lqiListingQualityRaw !== null;
  const lqiMarketCompetitivenessIsNative = lqiMarketCompetitivenessRaw !== null;
  const lqiConversionIsNative = lqiConversionPotentialNativeRaw !== null;
  const currentListingPrice =
    payloadMetricsAvgPrice ??
    (payloadBusinessRevenueBaselinePriceSource !== "market_median"
      ? payloadBusinessRevenueBaselineNightlyPrice
      : null) ??
    coerceFiniteNumber(listing?.price) ??
    (legacyRevenueBaselinePriceSource !== "market_median"
      ? legacyRevenueBaselineNightlyPrice
      : null);
  const currentListingPriceSource =
    payloadMetricsAvgPrice != null
      ? "payload.metrics.avgPrice"
      : payloadBusinessRevenueBaselinePriceSource !== "market_median" &&
          payloadBusinessRevenueBaselineNightlyPrice != null
        ? "payload.business.revenueBaselineNightlyPrice"
        : coerceFiniteNumber(listing?.price) != null
          ? "listing.price"
          : legacyRevenueBaselinePriceSource !== "market_median" &&
              legacyRevenueBaselineNightlyPrice != null
            ? "legacyEstimatedRevenueImpact.baselineNightlyPrice"
            : "unavailable";
  const marketReferenceNightlyPrice =
    payloadBusinessRevenueBaselinePriceSource === "market_median"
      ? payloadBusinessRevenueBaselineNightlyPrice
      : revenueBaselinePriceSource === "market_median"
        ? revenueBaselineNightlyPriceStored
        : null;
  const marketReferenceNightlyPriceSource =
    payloadBusinessRevenueBaselinePriceSource === "market_median" &&
    payloadBusinessRevenueBaselineNightlyPrice != null
      ? "payload.business.revenueBaselineNightlyPrice"
      : revenueBaselinePriceSource === "market_median" &&
          revenueBaselineNightlyPriceStored != null
        ? "legacyEstimatedRevenueImpact.baselineNightlyPrice"
        : "unavailable";
  const displayCurrency = payloadMetricsCurrency || listing?.currency || "EUR";
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
      title: imp.title ?? copy.improvement,
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
    competitorCount:
      comparableCount ??
      competitorSummary.competitorCount ??
      marketFallback.competitorCount,
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
  const marketCompetitorCount =
    typeof market.competitorCount === "number" && Number.isFinite(market.competitorCount)
      ? Math.max(0, Math.trunc(market.competitorCount))
      : null;
  /** Décompte affiché (libellés KPI / cartes marché) : priorise `comparableCount` sérialisé si l’agrégat concurrent est décalé. */
  const marketComparableDisplayCount =
    coerceFiniteNumber(comparableCount) ?? marketCompetitorCount;
  const suppressZeroComparableMarketUi =
    marketComparableDisplayCount !== null && marketComparableDisplayCount === 0;

  const weakBookingFallbackComparableCountForReliability =
    typeof payload.market?.weakBookingFallbackComparableCount === "number" &&
    Number.isFinite(payload.market.weakBookingFallbackComparableCount)
      ? Math.max(0, Math.floor(payload.market.weakBookingFallbackComparableCount))
      : 0;
  const marketReliabilityDerived = deriveMarketReliabilityFromComparableCount(
    marketComparableDisplayCount,
    weakBookingFallbackComparableCountForReliability
  );
  const rawMarketConfidenceLevel =
    payload.market?.marketConfidence === "high" ||
    payload.market?.marketConfidence === "medium" ||
    payload.market?.marketConfidence === "low"
      ? payload.market.marketConfidence
      : marketReliabilityDerived.marketConfidence;

  const marketConfidenceLevel =
    rawMarketConfidenceLevel === "high" &&
    marketComparableDisplayCount !== null &&
    marketComparableDisplayCount < 5
      ? "medium"
      : rawMarketConfidenceLevel;
  const pricingInsightForUi =
    suppressZeroComparableMarketUi || marketConfidenceLevel === "low" ? null : pricingInsight;
  const marketReliabilityTitle =
    typeof payload.market?.reliabilityTitle === "string" && payload.market.reliabilityTitle.trim()
      ? payload.market.reliabilityTitle.trim()
      : marketReliabilityDerived.reliabilityTitle;
  const marketReliabilityBadge =
    typeof payload.market?.reliabilityBadge === "string" && payload.market.reliabilityBadge.trim()
      ? payload.market.reliabilityBadge.trim()
      : marketReliabilityDerived.reliabilityBadge;
  const marketReliabilityMessage =
    typeof payload.market?.reliabilityMessage === "string" && payload.market.reliabilityMessage.trim()
      ? payload.market.reliabilityMessage.trim()
      : marketReliabilityDerived.reliabilityMessage;
  const marketSourceQuality =
    payload.market?.marketSourceQuality === "cross_platform_fallback"
      ? "cross_platform_fallback"
      : "native";
  const marketSourceLabel =
    typeof payload.market?.marketSourceLabel === "string" && payload.market.marketSourceLabel.trim()
      ? payload.market.marketSourceLabel.trim()
      : marketSourceQuality === "cross_platform_fallback"
        ? "Benchmark cross-platform"
        : null;
  const marketSourceMessage =
    marketSourceQuality === "cross_platform_fallback"
      ? "Comparables non-Booking utilisés faute de comparables Booking suffisants."
      : null;
  const robustCrossPlatformMarket =
    marketSourceQuality === "cross_platform_fallback" &&
    comparableCount !== null &&
    comparableCount >= 3 &&
    pricedComparableCount !== null &&
    pricedComparableCount >= 3;

  /** Conservé (seuil historique ≥3 + score marché) — ne sert plus de verrou global d’affichage. */
  const isMarketReliable =
    marketCompetitorCount !== null &&
    marketCompetitorCount >= 3 &&
    marketScore !== null &&
    Number.isFinite(marketScore);
  const hasMarketData = marketCompetitorCount !== null && marketCompetitorCount > 0;
  const isMarketWeak = hasMarketData && marketCompetitorCount < 3;
  const isMarketStrong = marketCompetitorCount !== null && marketCompetitorCount >= 3;
  const marketIndicativeLabel = "Lecture indicative (base limitée)";
  const marketTierBadgeLabel =
    weakBookingFallbackComparableCountForReliability > 0 && marketConfidenceLevel === "medium"
      ? copy.marketReliabilityBadgeWeakFallback
      : marketConfidenceLevel === "high"
        ? copy.marketReliabilityBadgeHigh
        : marketConfidenceLevel === "medium"
          ? copy.marketReliabilityBadgeMedium
          : copy.marketReliabilityBadgeLow;
  const marketTierBadgeClass =
    marketConfidenceLevel === "high"
      ? "inline-flex w-fit max-w-full items-center rounded-full border border-emerald-200/90 bg-emerald-50/95 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.1em] text-emerald-900 shadow-[0_6px_14px_rgba(16,185,129,0.06)]"
      : marketConfidenceLevel === "medium"
        ? "inline-flex w-fit max-w-full items-center rounded-full border border-amber-200/90 bg-amber-50/95 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.1em] text-amber-900 shadow-[0_6px_14px_rgba(180,83,9,0.06)]"
        : "inline-flex w-fit max-w-full items-center rounded-full border border-rose-200/90 bg-rose-50/95 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.1em] text-rose-900 shadow-[0_6px_14px_rgba(244,63,94,0.06)]";
  const avgCompetitorPriceResolved = suppressZeroComparableMarketUi
    ? null
    : marketAvgCompetitorPrice != null && Number.isFinite(marketAvgCompetitorPrice)
      ? marketAvgCompetitorPrice
      : pricingInsight != null
        ? pricingInsight.medianPrice
        : null;
  console.log(
    "[audit-page][market-data-source-debug]",
    JSON.stringify({
      payloadCandidates: {
        marketComparableCount: coerceFiniteNumber(payload.market?.comparableCount),
        marketPositioningComparableCount: coerceFiniteNumber(payload.marketPositioning?.comparableCount),
        marketPositioningComparablesLength: Array.isArray(payload.marketPositioning?.comparables)
          ? payload.marketPositioning.comparables.length
          : null,
        competitorSummaryCompetitorCount: coerceFiniteNumber(payload.competitorSummary?.competitorCount),
        marketPricedComparableCount: coerceFiniteNumber(payload.market?.pricedComparableCount),
        marketAvgCompetitorPrice: coerceFiniteNumber(payload.market?.avgCompetitorPrice),
        legacyMarketComparisonAvgCompetitorPrice: coerceFiniteNumber(
          legacyMarketComparison?.avgCompetitorPrice
        ),
        marketPositioningAvgPrice: coerceFiniteNumber(payload.marketPositioning?.avgPrice),
        marketPositionAvgCompetitorPrice: coerceFiniteNumber(payload.marketPosition?.avgCompetitorPrice),
        pricingInsightMedianPrice:
          pricingInsight != null && typeof pricingInsight.medianPrice === "number"
            ? pricingInsight.medianPrice
            : null,
      },
      resolved: {
        comparableCount,
        comparableCountSource:
          coerceFiniteNumber(payload.market?.comparableCount) != null
            ? "payload.market.comparableCount"
            : coerceFiniteNumber(payload.marketPositioning?.comparableCount) != null
              ? "payload.marketPositioning.comparableCount"
              : Array.isArray(payload.marketPositioning?.comparables)
                ? "payload.marketPositioning.comparables.length"
                : coerceFiniteNumber(payload.competitorSummary?.competitorCount) != null
                  ? "payload.competitorSummary.competitorCount"
                  : "null",
        pricedComparableCount,
        pricedComparableCountSource:
          coerceFiniteNumber(payload.market?.pricedComparableCount) != null
            ? "payload.market.pricedComparableCount"
            : "null",
        marketCompetitorCount,
        marketCompetitorCountSource:
          typeof market.competitorCount === "number" && Number.isFinite(market.competitorCount)
            ? "market.competitorCount"
            : "null",
        marketComparableDisplayCount,
        marketComparableDisplayCountSource:
          coerceFiniteNumber(comparableCount) != null ? "comparableCount" : "marketCompetitorCount",
        avgCompetitorPriceResolved,
        avgCompetitorPriceResolvedSource: suppressZeroComparableMarketUi
          ? "suppressed_zero_comparable_ui"
          : marketAvgCompetitorPrice != null && Number.isFinite(marketAvgCompetitorPrice)
            ? "market.avgCompetitorPrice"
            : pricingInsight != null && typeof pricingInsight.medianPrice === "number"
              ? "pricingInsight.medianPrice"
              : "null",
      },
      guards: {
        suppressZeroComparableMarketUi,
        hasMarketData,
        isMarketWeak,
        marketConfidenceLevel,
        robustCrossPlatformMarket,
      },
    })
  );

  /** Nuits réservées / mois pour estimer le CA mensuel de référence : persisté → payload business → défaut prudent. */
  const baselineBookedNightsStoredOrPayload =
    revenueBaselineBookedNightsStored ??
    coerceFiniteNumber(payload.business?.revenueBaselineBookedNightsPerMonth);
  const baselineBookedNightsForCurrentMonthly =
    baselineBookedNightsStoredOrPayload != null &&
    Number.isFinite(baselineBookedNightsStoredOrPayload) &&
    baselineBookedNightsStoredOrPayload > 0
      ? Math.floor(baselineBookedNightsStoredOrPayload)
      : 15;

  const MONTHLY_REVENUE_DISPLAY_NIGHTS_CAP = 15;
  const monthlyRevenueDisplayNights = Math.min(
    baselineBookedNightsForCurrentMonthly,
    MONTHLY_REVENUE_DISPLAY_NIGHTS_CAP,
  );

  /** Repère carte « Gain mensuel » : prix nuit conseillé (reco pricing ou prudent actuel / marché) puis fourchette mois sans afficher les taux internes. */
  const prixActuelNuitPourGainEstimation =
    (revenueBaselinePriceSource !== "market_median"
      ? revenueBaselineNightlyPriceStored
      : null) ?? currentListingPrice;
  const prixMarchéNuitPourGainEstimation = avgCompetitorPriceResolved;
  const prixRecoNuitBrutArrondi =
    pricingInsight != null &&
    typeof pricingInsight.recommendedPrice === "number" &&
    Number.isFinite(pricingInsight.recommendedPrice)
      ? Math.round(pricingInsight.recommendedPrice)
      : null;
  let prixConseilleNuitEuro: number | null = null;
  if (prixRecoNuitBrutArrondi != null) {
    prixConseilleNuitEuro = prixRecoNuitBrutArrondi;
  } else if (
    prixActuelNuitPourGainEstimation != null &&
    prixMarchéNuitPourGainEstimation != null
  ) {
    const cur = prixActuelNuitPourGainEstimation;
    const mc = prixMarchéNuitPourGainEstimation;
    const midpoint = Math.round((cur + mc) / 2);
    prixConseilleNuitEuro = cur > mc ? Math.min(cur, midpoint) : midpoint;
  }

  /** Repère gain mensuel uniquement : ne pas rester sous le prix moyen concurrent si le marché est assez peuplé. */
  const monthlyGainFloorsWithMarketMedian =
    avgCompetitorPriceResolved != null &&
    Number.isFinite(avgCompetitorPriceResolved) &&
    comparableCount !== null &&
    comparableCount >= 3;
  const monthlyGainRecommendedNightlyPrice: number | null =
    prixConseilleNuitEuro == null
      ? null
      : monthlyGainFloorsWithMarketMedian
        ? Math.max(prixConseilleNuitEuro, avgCompetitorPriceResolved)
        : prixConseilleNuitEuro;

  const currentNightlyPriceForGain = prixActuelNuitPourGainEstimation;
  const currentMonthlyRevenueBase =
    currentNightlyPriceForGain != null && Number.isFinite(currentNightlyPriceForGain)
      ? currentNightlyPriceForGain * baselineBookedNightsForCurrentMonthly
      : null;
  const robustCrossPlatformBusinessData =
    robustCrossPlatformMarket &&
    (bookingPotential != null ||
      (estimatedRevenueLow != null && estimatedRevenueHigh != null) ||
      (currentListingPrice != null && avgCompetitorPriceResolved != null));
  const businessUiLowConfidenceGuardActive =
    marketConfidenceLevel === "low" && !robustCrossPlatformBusinessData;

  // Projection de revenu basée sur le moteur business backend.
  const futureRevenueLowInternal =
    currentMonthlyRevenueBase != null &&
    estimatedRevenueLow != null &&
    Number.isFinite(estimatedRevenueLow)
      ? currentMonthlyRevenueBase + estimatedRevenueLow
      : null;

  const futureRevenueHighInternal =
    currentMonthlyRevenueBase != null &&
    estimatedRevenueHigh != null &&
    Number.isFinite(estimatedRevenueHigh)
      ? currentMonthlyRevenueBase + estimatedRevenueHigh
      : null;

  const gainLowRaw =
    futureRevenueLowInternal != null && currentMonthlyRevenueBase != null
      ? futureRevenueLowInternal - currentMonthlyRevenueBase
      : null;
  const gainHighRaw =
    futureRevenueHighInternal != null && currentMonthlyRevenueBase != null
      ? futureRevenueHighInternal - currentMonthlyRevenueBase
      : null;

  const monthlyGainDisplayLowRounded =
    gainLowRaw != null && Number.isFinite(gainLowRaw)
      ? Math.round(Math.max(0, gainLowRaw))
      : null;
  const monthlyGainDisplayHighRounded =
    gainHighRaw != null && Number.isFinite(gainHighRaw) ? Math.round(gainHighRaw) : null;

  const monthlyOptimizedRevenueLowRounded =
    futureRevenueLowInternal != null && Number.isFinite(futureRevenueLowInternal)
      ? Math.round(futureRevenueLowInternal)
      : null;
  const monthlyOptimizedRevenueHighRounded =
    futureRevenueHighInternal != null && Number.isFinite(futureRevenueHighInternal)
      ? Math.round(futureRevenueHighInternal)
      : null;

  /** Fourchette revenu optimisé (affichage) — sans borne basse à 0 liée au gain net. */
  const monthlyOptimizedRevenueBandDisplayable =
    !businessUiLowConfidenceGuardActive &&
    hasMarketData &&
    hasSufficientPricedComparables &&
    monthlyGainRecommendedNightlyPrice !== null &&
    monthlyGainRecommendedNightlyPrice > 0 &&
    monthlyOptimizedRevenueLowRounded !== null &&
    monthlyOptimizedRevenueHighRounded !== null;

  const monthlyGainBusinessModelReady =
    hasMarketData &&
    prixActuelNuitPourGainEstimation !== null &&
    prixConseilleNuitEuro !== null &&
    currentMonthlyRevenueBase !== null;

  console.log(
    "[audit-page][monthly-gain-debug]",
    JSON.stringify({
      currentNightlyPriceForGain,
      recommendedNightlyPrice: monthlyGainRecommendedNightlyPrice,
      baselineBookedNightsForCurrentMonthly,
      currentMonthlyRevenueBase,
      futureRevenueLowInternal,
      futureRevenueHighInternal,
      gainLowRaw,
      gainHighRaw,
      monthlyGainDisplayLowRounded,
      monthlyGainDisplayHighRounded,
      monthlyOptimizedRevenueLowRounded,
      monthlyOptimizedRevenueHighRounded,
      monthlyGainRangeIsDisplayable: monthlyOptimizedRevenueBandDisplayable,
    }),
  );
  console.log(
    "[audit-page][cross-platform-business-guard-debug]",
    JSON.stringify({
      marketConfidenceLevel,
      marketSourceQuality,
      comparableCount,
      pricedComparableCount,
      robustCrossPlatformMarket,
      robustCrossPlatformBusinessData,
      businessUiLowConfidenceGuardActive,
      hasMarketData,
      bookingPotential,
      estimatedRevenueLow,
      estimatedRevenueHigh,
      avgCompetitorPriceResolved,
      currentListingPrice,
    }),
  );

  const priceDeltaPercent = market.priceDeltaPercent;
  const hasReliablePriceDeltaSample =
    marketComparableDisplayCount !== null && marketComparableDisplayCount >= 3;
  const hasIndicativePriceDeltaSample =
    marketConfidenceLevel === "medium" &&
    marketComparableDisplayCount !== null &&
    marketComparableDisplayCount >= 2 &&
    pricedComparableCount !== null &&
    pricedComparableCount >= 1 &&
    avgCompetitorPriceResolved != null;
  const canResolvePriceDeltaSample =
    hasReliablePriceDeltaSample || hasIndicativePriceDeltaSample;
  const pricingUiLowConfidenceGuardActive =
    marketConfidenceLevel === "low" && !robustCrossPlatformMarket;
  /** Écart tarifaire cohérent avec « Prix actuel » × « {copy.averageCompetitorPrice} » ; sinon insights / agrégat marché. */
  const priceDeltaPercentResolved =
    suppressZeroComparableMarketUi || !canResolvePriceDeltaSample || pricingUiLowConfidenceGuardActive
    ? null
    : (() => {
        const cur = currentListingPrice;
        const avg = avgCompetitorPriceResolved;
        if (
          cur != null &&
          avg != null &&
          Number.isFinite(cur) &&
          Number.isFinite(avg) &&
          avg > 0
        ) {
          return ((cur - avg) / avg) * 100;
        }
        if (
          pricingInsight != null &&
          typeof pricingInsight.priceDeltaPercent === "number" &&
          Number.isFinite(pricingInsight.priceDeltaPercent)
        ) {
          return pricingInsight.priceDeltaPercent;
        }
        return priceDeltaPercent;
      })();
  const showMonthlyGainKpi = monthlyGainBusinessModelReady;
  /** Même lisibilité que les autres KPI : vert si fourchette positive + marché jugé robuste ; sinon tonalité prudent. */
  const heroMonthlyGainToneStrong =
    monthlyOptimizedRevenueBandDisplayable &&
    hasStrongPricedComparables &&
    isMarketReliable &&
    marketComparableDisplayCount !== null &&
    marketComparableDisplayCount >= 3;

  const marketConfidenceCount = marketCompetitorCount ?? 0;
  const marketConfidenceBase =
    marketConfidenceCount === 0
      ? 0
      : marketConfidenceCount === 1
        ? 35
        : marketConfidenceCount === 2
          ? 55
          : marketConfidenceCount === 3
            ? 75
            : 85;
  let marketConfidenceDispersionRatio: number | null = null;
  let marketConfidenceDispersionAdjust = 0;
  if (pricingInsight != null) {
    const med = pricingInsight.medianPrice;
    const minP = pricingInsight.minPrice;
    const maxP = pricingInsight.maxPrice;
    if (
      typeof med === "number" &&
      med > 0 &&
      Number.isFinite(med) &&
      typeof minP === "number" &&
      Number.isFinite(minP) &&
      typeof maxP === "number" &&
      Number.isFinite(maxP)
    ) {
      marketConfidenceDispersionRatio = (maxP - minP) / med;
      if (marketConfidenceDispersionRatio <= 0.25) {
        marketConfidenceDispersionAdjust = 10;
      } else if (marketConfidenceDispersionRatio <= 0.5) {
        marketConfidenceDispersionAdjust = 5;
      } else if (marketConfidenceDispersionRatio > 1) {
        marketConfidenceDispersionAdjust = -15;
      }
    }
  }
  const marketConfidenceScore = Math.round(
    Math.min(95, Math.max(0, marketConfidenceBase + marketConfidenceDispersionAdjust)),
  );
  const marketConfidenceBadgeLabel =
    marketSourceQuality === "cross_platform_fallback" &&
    weakBookingFallbackComparableCountForReliability > 0
      ? copy.marketReliabilityBadgeWeakFallback
      : marketConfidenceLevel === "high"
        ? copy.marketReliabilityBadgeHigh
        : marketConfidenceLevel === "medium"
          ? copy.marketReliabilityBadgeMedium
          : copy.marketReliabilityBadgeLow;
  const marketConfidenceBadgeClass =
    marketConfidenceScore <= 39
      ? "border-rose-200/90 bg-rose-50/95 text-rose-900"
      : marketConfidenceScore <= 69
        ? "border-amber-200/90 bg-amber-50/95 text-amber-950"
        : "border-emerald-200/90 bg-emerald-50/95 text-emerald-900";
  const marketConfidenceBaseWording =
    marketSourceQuality === "cross_platform_fallback" &&
    weakBookingFallbackComparableCountForReliability > 0
      ? copy.marketReliabilityMessageWeakFallback
      : marketConfidenceLevel === "high"
        ? copy.marketReliabilityMessageHigh
        : marketConfidenceLevel === "medium"
          ? copy.marketReliabilityMessageMedium
          : copy.marketReliabilityMessageLow;
  const marketConfidenceDispersionWording =
    marketConfidenceDispersionRatio != null && marketConfidenceDispersionRatio > 1
      ? "Prix concurrents dispersés"
      : null;

  const rawMarketSummaryText = market.message?.trim() || "";
  const marketSummaryText =
    /annonce se situe globalement dans la moyenne des concurrents proches/i.test(rawMarketSummaryText) ||
    /broadly in line with nearby competitors/i.test(rawMarketSummaryText) ||
    /se sitúa globalmente en la media de los competidores cercanos/i.test(rawMarketSummaryText)
      ? copy.marketPositionNarrativeCompetitive
      : rawMarketSummaryText || copy.marketSummaryPending;
  const benchmarkSupportText =
    marketScoreDelta !== null
      ? marketScoreDelta > 0
        ? copy.marketBenchmarkAbove.replace("{value}", marketScoreDelta.toFixed(1))
        : marketScoreDelta < 0
          ? copy.marketBenchmarkBelow.replace("{value}", Math.abs(marketScoreDelta).toFixed(1))
          : copy.marketBenchmarkAligned
      : marketComparableDisplayCount !== null
      ? marketComparableDisplayCount === 0
        ? copy.marketBenchmarkNone
        : marketComparableDisplayCount === 1
          ? copy.marketBenchmarkOne
          : copy.marketBenchmarkMany.replace("{count}", String(marketComparableDisplayCount))
        : copy.marketBenchmarkPending;
  const benchmarkSupportTextUi = !hasMarketData
    ? copy.marketAnalysisPending
    : benchmarkSupportText;
  const marketPricePositionText =
    priceDeltaPercentResolved !== null
      ? priceDeltaPercentResolved > 8
        ? "Votre tarif est nettement au-dessus du marché observé : à justifier par des signaux qualité très forts."
        : priceDeltaPercentResolved > 0
          ? "Votre tarif est légèrement au-dessus du marché : position premium possible si la promesse est claire."
          : priceDeltaPercentResolved < -8
            ? "Votre tarif est sous le marché observé : une marge d’optimisation tarifaire semble disponible."
            : priceDeltaPercentResolved < 0
              ? "Votre tarif est légèrement sous le marché : position attractive avec potentiel de hausse mesurée."
              : "Votre tarif est aligné avec le niveau moyen observé sur ce marché."
      : "Le positionnement tarifaire sera précisé dès qu’un prix moyen concurrent fiable sera disponible.";
  const priceDeltaIndicativeText = hasIndicativePriceDeltaSample
    ? "Écart indicatif basé sur un échantillon local limité."
    : null;
  const marketRatingScale =
    String(listing?.source_platform ?? "").toLowerCase() === "booking"
      ? 10
      : 5;

  const marketRatingContext =
    market.avgCompetitorRating !== null
      ? `Note moyenne des concurrents observés : ${market.avgCompetitorRating.toFixed(1)}/${marketRatingScale}.`
      : "La note moyenne des concurrents n’est pas encore exploitable.";
  const lqiAvailableComponents = [
    lqiScore,
    lqiListingQuality,
    lqiMarketCompetitiveness,
    lqiConversionPotential,
  ].filter((value) => value !== null).length;
  const lqiSummaryText =
    (listingQualityIndex?.summary?.trim() === auditDetailCopy.fr.lqiSummaryCompetitiveButOptimizable
      ? copy.lqiSummaryCompetitiveButOptimizable
      : listingQualityIndex?.summary?.trim()) ||
    (!listingQualityIndex && lqiAvailableComponents > 0
      ? copy.lqiSummaryNoObject
      : listingQualityIndex && !lqiScoreIsNativeIqa && lqiScore !== null
      ? copy.lqiSummaryIndicativeScore
      : lqiAvailableComponents > 0
      ? copy.lqiSummaryOverview
      : copy.lqiSummaryPending);
  const allowConversionOnlyRevenueProjection =
    businessUiLowConfidenceGuardActive &&
    !hasSufficientPricedComparables &&
    payload.business?.revenueBaselinePriceSource === "listing" &&
    estimatedRevenueLow != null &&
    estimatedRevenueHigh != null;

  const impactBusinessBlockIntro =
    businessUiLowConfidenceGuardActive
      ? "Comparables retenus hors segment tarifaire — seules les recommandations qualité, contenu et conversion visuelle sont interprétables de manière fiable."
      : impactSummary?.trim() ||
        "Chaque carte ci-dessous porte une unité fixe : € le prix, /10 le marché relatif, % le lift réservations, €/mois le gain mensuel estimé (additionnel, pas le chiffre d’affaires total).";
  const bookingLiftPercentValueDisplay =
    businessUiLowConfidenceGuardActive && !allowConversionOnlyRevenueProjection
      ? "—"
      : bookingLiftHigh > 0
        ? `+${bookingLiftLow.toFixed(0)}% à +${bookingLiftHigh.toFixed(0)}%`
        : bookingLiftHigh > 0
          ? "Potentiel à confirmer"
          : "—";
  const bookingLiftCardBody =
    allowConversionOnlyRevenueProjection
      ? "Projection basée sur le score de conversion et le prix actuel, sans benchmark tarifaire concurrentiel fiable."
      : businessUiLowConfidenceGuardActive
        ? "Comparables hors segment détectés — potentiel de réservations non estimable avec fiabilité pour cette annonce."
      : !hasMarketData && bookingLiftHigh > 0
        ? "La fourchette en % sera affichée lorsque la base marché sera suffisamment fiable (comparables et score consolidés), comme pour le gain mensuel estimé."
        : bookingLiftSummary?.trim() ||
          (bookingLiftHigh > 0
            ? "Estimation basée sur votre positionnement actuel et les annonces concurrentes analysées."
            : "Pas de fourchette en pourcentage pour le lift réservations dans les données actuelles du rapport.");
  const currentPriceContext =
    currentListingPrice !== null
      ? hasMarketData && avgCompetitorPriceResolved !== null
        ? `À comparer au prix moyen du marché estimé à ${revenueFormatter.format(
            avgCompetitorPriceResolved
          )}.`
        : "Tarif actuel détecté sur l’annonce."
      : marketReferenceNightlyPrice != null
        ? `Prix actuel indisponible. Référence marché observée : ~${revenueFormatter.format(
            marketReferenceNightlyPrice
          )}/nuit.`
        : "Le tarif actuel n’est pas remonté pour cette annonce.";
  const marketScoreContext =
    marketAverageScore !== null
      ? marketScoreDelta !== null
        ? marketScoreDelta > 0
          ? copy.marketScoreContextAbove
          : marketScoreDelta < 0
            ? copy.marketScoreContextBelow
            : copy.marketScoreContextAligned
        : copy.marketScoreContextObserved
      : marketScoreDelta !== null
      ? marketScoreDelta > 0
        ? copy.marketScoreContextMarketBelow
        : marketScoreDelta < 0
          ? copy.marketScoreContextMarketAbove
          : copy.marketScoreContextMarketAligned
        : copy.marketScoreContextUnavailable;
  const marketScoreContextUi = !hasMarketData
    ? copy.marketAnalysisPending
    : marketScoreContext;
  const rawMarketPositionNarrative = competitorSummary.targetVsMarketPosition?.trim() || "";
  const marketPositionNarrative =
    rawMarketPositionNarrative === auditDetailCopy.fr.marketPositionNarrativeCompetitive ||
    rawMarketPositionNarrative === auditDetailCopy.en.marketPositionNarrativeCompetitive ||
    rawMarketPositionNarrative === auditDetailCopy.es.marketPositionNarrativeCompetitive
      ? copy.marketPositionNarrativeCompetitive
      : rawMarketPositionNarrative || marketSummaryText;
  const heroMarketPositionSupport =
    copy.heroMarketPositionSupport;
  const marketPositionUiLabel =
    marketScoreDelta !== null
      ? marketScoreDelta > 0.2
        ? "above_market"
        : marketScoreDelta < -0.2
          ? "below_market"
          : "competitive"
      : market.label;
  const marketPositionHeadlineText = !hasMarketData
    ? copy.marketPositionToConfirm
    : marketLabelText(marketPositionUiLabel, copy);
  const marketPositionHeadlineClass = !hasMarketData
    ? "text-slate-600"
    : marketLabelClass(marketPositionUiLabel);
  const heroMarketPositionSupportUi = !hasMarketData
    ? copy.marketAnalysisPending
    : heroMarketPositionSupport;
  const scoreMarketValueDisplay = !hasMarketData
    ? copy.scoreStatusConfirm
    : marketAverageScore !== null
      ? `${marketAverageScore.toFixed(1)}/10`
      : marketScoreDelta !== null
        ? `${marketScoreDelta > 0 ? "-" : "+"}${Math.abs(marketScoreDelta).toFixed(1)} pt`
        : marketIndicativeLabel;
  const competitorCountSupport =
    marketCompetitorCount !== null
      ? marketCompetitorCount > 0
        ? "Comparables retenus pour évaluer votre positionnement concurrentiel."
        : "Aucun comparable n’a été retenu pour cette lecture ; le positionnement reste indicatif."
      : marketPositionNarrative
      ? "Le positionnement reste une indication à consolider, faute de volume exact de comparables."
      : "La lecture marché reste partielle tant que le volume de comparables n’est pas consolidé.";
  const comparablesKpiMainDisplay =
    marketComparableDisplayCount === null
      ? "Lecture limitée"
      : marketComparableDisplayCount === 0
        ? "Aucun comparable fiable"
        : marketComparableDisplayCount === 1
          ? "Lecture limitée — 1 comparable exploitable"
          : marketComparableDisplayCount === 2
            ? "Lecture limitée — 2 comparables exploitables"
          : String(Math.max(0, Math.trunc(marketComparableDisplayCount)));
  const comparablesKpiBodyText =
    marketComparableDisplayCount === null
      ? competitorCountSupport
      : marketComparableDisplayCount === 0
        ? copy.marketComparablesBodyNone
        : marketComparableDisplayCount === 1 || marketComparableDisplayCount === 2
          ? copy.marketComparablesBodyLimited.replace("{base}", marketConfidenceBaseWording)
          : copy.marketComparablesBodyStrong;
  const comparablesKpiValueClass =
    marketComparableDisplayCount !== null && marketComparableDisplayCount > 0
      ? competitorCountValueClass(marketComparableDisplayCount)
      : "text-amber-700";
  const lqiLabelDisplay = listingQualityIndex?.label
    ? lqiLabelText(listingQualityIndex.label, copy)
    : lqiAvailableComponents > 0
    ? "Indice partiel"
    : "À consolider";
  const lqiScoreDisplay =
    lqiScore !== null
      ? `${lqiScore} / 100`
      : lqiAvailableComponents > 0
      ? `${lqiAvailableComponents}/4 signaux`
      : "À consolider";
  const avgCompetitorPriceDisplay = !hasMarketData
    ? "Données insuffisantes"
    : avgCompetitorPriceResolved !== null
      ? revenueFormatter.format(avgCompetitorPriceResolved)
      : marketIndicativeLabel;

  const avgCompetitorPriceSupport = !hasMarketData
    ? "Échantillon marché insuffisant pour établir un repère prix fiable."
    : avgCompetitorPriceResolved !== null
      ? isMarketWeak
        ? "Repère indicatif : base locale encore limitée, à consolider avec plus de comparables."
        : "Repère concurrentiel observé sur les annonces retenues pour ce segment."
      : "Le repère prix sera plus utile dès qu’un tarif concurrent fiable pourra être consolidé.";
  const priceDeltaDisplay =
    priceDeltaPercentResolved !== null
      ? `${priceDeltaPercentResolved > 0 ? "+" : ""}${priceDeltaPercentResolved.toFixed(0)}%`
      : !canResolvePriceDeltaSample
        ? "Échantillon insuffisant"
        : "Écart prix non calculable ici : tarif annoncé ou repère marché insuffisant pour un pourcentage fiable.";
  console.log(
    "[audit-page][market-cards-guards-debug]",
    JSON.stringify({
      runtime: {
        marketConfidenceLevel,
        robustCrossPlatformMarket,
        hasMarketData,
        isMarketWeak,
        suppressZeroComparableMarketUi,
        marketComparableDisplayCount,
        marketCompetitorCount,
        comparableCount,
        pricedComparableCount,
        avgCompetitorPriceResolved,
        currentListingPrice,
        canResolvePriceDeltaSample,
        pricingUiLowConfidenceGuardActive,
        priceDeltaPercentResolved,
      },
      concurrentsAnalyses: {
        mainDisplay: comparablesKpiMainDisplay,
        bodyText: comparablesKpiBodyText,
        valueClass: comparablesKpiValueClass,
        guards: {
          marketComparableDisplayCountIsNull: marketComparableDisplayCount === null,
          marketComparableDisplayCountIsZero: marketComparableDisplayCount === 0,
          marketComparableDisplayCountIsOne: marketComparableDisplayCount === 1,
          marketComparableDisplayCountIsTwo: marketComparableDisplayCount === 2,
        },
      },
      prixMoyenConcurrent: {
        display: avgCompetitorPriceDisplay,
        support: avgCompetitorPriceSupport,
        guards: {
          hasMarketData,
          avgCompetitorPriceResolvedIsNull: avgCompetitorPriceResolved === null,
          suppressZeroComparableMarketUi,
        },
      },
      ecartPrixVsMarche: {
        mainDisplay: !hasMarketData
          ? copy.notReliable
          : priceDeltaPercentResolved !== null
            ? `${priceDeltaPercentResolved > 0 ? "+" : ""}${priceDeltaPercentResolved.toFixed(0)}%`
            : isMarketWeak
              ? marketIndicativeLabel
              : priceDeltaDisplay,
        bodyText: !hasMarketData
          ? copy.marketAnalysisPending
          : priceDeltaPercentResolved !== null
            ? `${marketPricePositionText}${priceDeltaIndicativeText ? ` ${priceDeltaIndicativeText}` : ""}`
            : isMarketWeak
              ? marketIndicativeLabel
              : "Dès qu’un tarif annoncé et un repère marché fiable sont consolidés, un pourcentage d’écart pourra être affiché ici.",
        guards: {
          hasMarketData,
          isMarketWeak,
          canResolvePriceDeltaSample,
          suppressZeroComparableMarketUi,
          pricingUiLowConfidenceGuardActive,
          priceDeltaPercentResolvedIsNull: priceDeltaPercentResolved === null,
        },
      },
    })
  );
  const listingPriceDetails =
    listing?.priceDetails && typeof listing.priceDetails === "object" ? listing.priceDetails : null;
  const originalTotalDisplay =
    coerceFiniteNumber(listingPriceDetails?.originalTotalPrice) !== null
      ? revenueFormatter.format(coerceFiniteNumber(listingPriceDetails?.originalTotalPrice)!)
      : null;
  const totalPriceDisplay =
    coerceFiniteNumber(listingPriceDetails?.totalPrice) !== null
      ? revenueFormatter.format(coerceFiniteNumber(listingPriceDetails?.totalPrice)!)
      : null;
  const taxesDisplay =
    coerceFiniteNumber(listingPriceDetails?.taxes) !== null
      ? revenueFormatter.format(coerceFiniteNumber(listingPriceDetails?.taxes)!)
      : null;
  const cleaningFeeDisplay =
    coerceFiniteNumber(listingPriceDetails?.cleaningFee) !== null
      ? revenueFormatter.format(coerceFiniteNumber(listingPriceDetails?.cleaningFee)!)
      : null;
  const serviceFeeDisplay =
    coerceFiniteNumber(listingPriceDetails?.serviceFee) !== null
      ? revenueFormatter.format(coerceFiniteNumber(listingPriceDetails?.serviceFee)!)
      : null;
  const runtimeConfidenceDisplay = listingPriceDetails?.confidence ?? null;
  const isAirbnbListing = listing?.source_platform === "airbnb";
  const currentPriceDisplay =
    currentListingPrice !== null
      ? revenueFormatter.format(currentListingPrice)
      : "Prix actuel indisponible";
  console.log(
    "[audit-page][visible-signals-source-debug]",
    JSON.stringify({
      rating: {
        payloadMetricsRating,
        listingRating: coerceFiniteNumber(listing?.rating),
        final: visibleRating,
        source: visibleRatingSource,
        scale: visibleRatingScale,
      },
      reviewCount: {
        payloadMetricsReviewCount,
        listingReviewCount: coerceFiniteNumber(listing?.reviewCount),
        final: visibleReviewCount,
        source: visibleReviewCountSource,
      },
      photoCount: {
        payloadMetricsPhotoCount,
        listingPhotoCount: coerceFiniteNumber(listingRecord?.photoCount),
        listingPayloadPhotoCount: coerceFiniteNumber(listingPayload?.photoCount),
        listingPayloadPhotosLength: Array.isArray(listingPayload?.photos) ? listingPayload.photos.length : null,
        listingPayloadImagesLength: Array.isArray(listingPayload?.images) ? listingPayload.images.length : null,
        final: visiblePhotoCount,
        source: visiblePhotoCountSource,
      },
      currentListingPrice: {
        payloadMetricsAvgPrice,
        payloadBusinessRevenueBaselineNightlyPrice,
        payloadBusinessRevenueBaselinePriceSource,
        listingPrice: coerceFiniteNumber(listing?.price),
        legacyRevenueBaselineNightlyPrice,
        legacyRevenueBaselinePriceSource,
        marketReferenceNightlyPrice,
        marketReferenceNightlyPriceSource,
        final: currentListingPrice,
        source: currentListingPriceSource,
      },
    })
  );
  if (DEBUG_AUDIT_PRICE_CARD) {
    const targetUrl = listing?.source_url ?? null;
    const stayDates = parseStayDatesFromAuditListingUrl(targetUrl);
    console.log(
      "[audit][business-price-card-debug]",
      JSON.stringify({
        auditId: audit?.id ?? null,
        targetUrl,
        checkin: stayDates.checkin,
        checkout: stayDates.checkout,
        nights: stayDates.nights,
        listingPriceFromDb: listing?.price ?? null,
        payloadBusinessRevenueBaselineNightlyPrice: revenueBaselineNightlyPriceStored,
        payloadMetricsAvgPrice: avgPrice,
        payloadMarketAvgCompetitorPrice: avgCompetitorPriceResolved,
        currentListingPrice,
        revenueBaselineNightlyPrice: revenueBaselineNightlyPriceStored,
        revenueBaselinePriceSource,
        currentPriceDisplay,
        currentPriceContext,
        avgCompetitorPriceResolved,
        priceDeltaPercentResolved,
      })
    );
  }
  const revenueImpactRangeDisplay =
    allowConversionOnlyRevenueProjection &&
    currentMonthlyRevenueBase !== null &&
    monthlyOptimizedRevenueLowRounded !== null &&
    monthlyOptimizedRevenueHighRounded !== null
      ? `Actuel estimé : ${revenueFormatter.format(Math.round(currentMonthlyRevenueBase))} / mois · Après optimisation : ${revenueFormatter.format(monthlyOptimizedRevenueLowRounded)} à ${revenueFormatter.format(monthlyOptimizedRevenueHighRounded)} / mois`
      : marketComparableDisplayCount !== null && marketComparableDisplayCount === 0
        ? copy.scoreStatusConfirm
        : !hasMarketData
          ? copy.scoreStatusConfirm
        : currentMonthlyRevenueBase !== null &&
            monthlyOptimizedRevenueLowRounded !== null &&
            monthlyOptimizedRevenueHighRounded !== null &&
            Number.isFinite(currentMonthlyRevenueBase) &&
            Number.isFinite(monthlyOptimizedRevenueLowRounded) &&
            Number.isFinite(monthlyOptimizedRevenueHighRounded) &&
            monthlyOptimizedRevenueLowRounded > 0 &&
            monthlyOptimizedRevenueHighRounded > 0
          ? `Actuel estimé : ${revenueFormatter.format(Math.round(currentMonthlyRevenueBase))} / mois · Après optimisation : ${revenueFormatter.format(monthlyOptimizedRevenueLowRounded)} à ${revenueFormatter.format(monthlyOptimizedRevenueHighRounded)} / mois`
          : copy.scoreStatusConfirm;

  /** Nuits / mois affichées : valeur persistée (nouveaux audits) ou 10 (moteur historique). */
  const LEGACY_REVENUE_ENGINE_BASELINE_NIGHTS = 10;
  const revenueModelBaselineNights =
    revenueBaselineBookedNightsStored != null
      ? Math.floor(revenueBaselineBookedNightsStored)
      : LEGACY_REVENUE_ENGINE_BASELINE_NIGHTS;
  const revenueBaselineMetaPersisted =
    revenueBaselineBookedNightsStored != null || revenueBaselineNightlyPriceStored != null;
  /** Prix nocturne réellement utilisé dans le moteur quand l’audit l’a sérialisé ; sinon repli annonce. */
  const revenueModelUnitPrice =
    revenueBaselineNightlyPriceStored ?? avgPrice ?? currentListingPrice ?? null;
  const revenueMarketDataFragile =
    revenueModelUnitPrice === null ||
    marketCompetitorCount === null ||
    marketCompetitorCount < 2 ||
    avgCompetitorPriceResolved === null ||
    Math.abs(avgCompetitorPriceResolved - revenueModelUnitPrice) < 0.01 ||
    revenueBaselinePriceSource === "market_median";
  const monthlyGainHypothesisLine: string | null = null;

  const monthlyGainQualifierLine = [
    isMarketWeak && hasMarketData && showMonthlyGainKpi
      ? `${marketIndicativeLabel} — croiser avec davantage de comparables pour stabiliser le repère.`
      : null,
    hasMarketData &&
      monthlyGainBusinessModelReady &&
      revenueMarketDataFragile
      ? "Hypothèse indicative à confirmer (prix et/ou comparables insuffisamment fiables pour un repère marché net)."
      : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join(" ");

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
        visualSignals: [...photoOrderTextSignals, ...photoOrderSuggestions],
      }),
    [
      aiGenerationStyle,
      listing?.amenities,
      listing?.description,
      listing?.source_platform,
      listing?.title,
      locationLabel,
      localizedMissingAmenities,
      photoOrderSuggestions,
      photoOrderTextSignals,
    ]
  );

  useEffect(() => {
    if (!auditId || aiOutputPlatform !== "booking" || loading || !audit) {
      setAiBookingDescriptions([]);
      return;
    }

    let mounted = true;
    const timer = window.setTimeout(() => {
      void loadAiBookingDescriptions();
    }, 800);

    async function loadAiBookingDescriptions() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) return;

        const response = await fetch(`/api/audits/${auditId}/booking-description`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          cache: "no-store",
          body: JSON.stringify({
            currentTitle: listing?.title ?? null,
            location: locationLabel ?? null,
            amenities: listing?.amenities ?? [],
            visualSignals: [...photoOrderTextSignals, ...photoOrderSuggestions],
            platform: listing?.source_platform ?? null,
          }),
        });

        if (!response.ok) return;

        const data = (await response.json().catch(() => null)) as {
          variants?: Array<{ label?: string; description?: string }>;
        } | null;

        const variants = Array.isArray(data?.variants)
          ? data.variants
              .map((variant) => ({
                label: typeof variant.label === "string" ? variant.label : "",
                description: typeof variant.description === "string" ? variant.description : "",
              }))
              .filter((variant) => variant.description.trim().length >= 300)
              .slice(0, 5)
          : [];

        if (mounted) {
          setAiBookingDescriptions(variants);
        }
      } catch (error) {
        console.warn("[audit-page][booking-description-ai] fallback_to_local", error);
      }
    }

    return () => {
      mounted = false;
      window.clearTimeout(timer);
    };
  }, [
    auditId,
    aiOutputPlatform,
    audit,
    loading,
    listing?.amenities,
    listing?.source_platform,
    listing?.title,
    locationLabel,
  ]);

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
  const aiBookingDescription =
    aiBookingDescriptions.length > 0
      ? aiBookingDescriptions[generationSeed % aiBookingDescriptions.length]?.description?.trim() || ""
      : "";

  const aiDescription =
    (aiOutputPlatform === "airbnb"
      ? currentAiVariant.mainAirbnb
      : aiBookingDescription || currentAiVariant.mainBooking) ||
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
    const nextDescription =
      aiOutputPlatform === "booking" && aiBookingDescription
        ? aiBookingDescription
        : aiDescription;

    setEditableAiDescription(nextDescription);
  }, [aiDescription, aiBookingDescription, aiOutputPlatform]);

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
        displayPlatform: aiOutputPlatform,
        variantIndex:
          aiDescriptionVariants.length > 0 ? generationSeed % aiDescriptionVariants.length : 0,
        variantCount: aiDescriptionVariants.length,
        fallbackSuggestedTitle: textSuggestions.suggestedTitle,
        visualSignals: [...photoOrderTextSignals, ...photoOrderSuggestions],
      }),
    [
      aiOutputPlatform,
      aiDescriptionVariants.length,
      generationSeed,
      listing?.amenities,
      listing?.description,
      listing?.title,
      locationLabel,
      textSuggestions.suggestedTitle,
      photoOrderSuggestions,
      photoOrderTextSignals,
    ]
  );

  const bookingSectionsReadySummary = useMemo(
    () => buildBookingSectionsReadySummary(currentAiVariant),
    [
      currentAiVariant.logement,
      currentAiVariant.logementDetaille,
      currentAiVariant.acces,
      currentAiVariant.echanges,
      currentAiVariant.autresInfos,
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
  const localizedPayloadWeaknessLines =
    weaknesses.length > 0 ? localizeGeneratedList(weaknesses) : localizedWeaknesses;
  const localizedCompetitorGaps = localizeGeneratedList(competitorSummary.keyGaps);
  const competitorGapsUsesContentFallback = false;
  /** Complément hors fenêtres des cartes « Points faibles » (5 premiers) et « Principaux écarts » (5 premiers) ; dédup simple. */
  const lossBlockFrictionItems: Array<{ text: string; source: "annonce" | "marché" }> = (() => {
    const annonceBase = weaknesses.length > 0 ? weaknesses : resolvedWeaknesses;
    const primaryWeaknessLabels = new Set(
      localizeGeneratedList(annonceBase)
        .slice(0, 5)
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
    );
    const primaryGapLabels = new Set(
      localizedCompetitorGaps
        .slice(0, 5)
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
    );
    const fromAnn =
      annonceBase.length > 5 ? localizeGeneratedList(annonceBase).slice(5, 8) : [];
    const fromMarket = localizedCompetitorGaps.slice(5, 7);
    const seen = new Set<string>();
    const out: Array<{ text: string; source: "annonce" | "marché" }> = [];
    for (const text of fromAnn) {
      const k = text.trim().toLowerCase();
      if (!k || seen.has(k) || primaryWeaknessLabels.has(k)) continue;
      seen.add(k);
      out.push({ text, source: "annonce" });
    }
    for (const text of fromMarket) {
      const k = text.trim().toLowerCase();
      if (!k || seen.has(k) || primaryGapLabels.has(k)) continue;
      seen.add(k);
      out.push({ text, source: "marché" });
    }
    return out;
  })();
  const localizedCompetitorAdvantages = localizeGeneratedList(competitorSummary.keyAdvantages);
  const competitorAdvantagesUsesContentFallback = false;
  const localizedTargetVsMarketPosition =
    localizeGeneratedText(competitorSummary.targetVsMarketPosition) || "";
  const normalizedTargetVsMarketPosition =
    /annonce se situe globalement dans la moyenne des concurrents proches/i.test(localizedTargetVsMarketPosition) ||
    /broadly in line with nearby competitors/i.test(localizedTargetVsMarketPosition) ||
    /se sitúa globalmente en la media de los competidores cercanos/i.test(localizedTargetVsMarketPosition)
      ? copy.marketPositionNarrativeCompetitive
      : localizedTargetVsMarketPosition;
  const positionnementNarrativeUi = !hasMarketData
    ? copy.marketAnalysisPending
    : normalizedTargetVsMarketPosition || marketSummaryText;
  const positionMarcheKpiBody = !hasMarketData
    ? copy.marketAnalysisPending
    : marketScoreDelta !== null
      ? marketScoreDelta > 0
        ? `Votre annonce ressort ${marketScoreDelta.toFixed(1)} point au-dessus du niveau moyen observé.`
        : marketScoreDelta < 0
          ? `Votre annonce reste ${Math.abs(marketScoreDelta).toFixed(1)} point sous le niveau moyen observé.`
          : "Votre annonce est alignée avec le score moyen des comparables."
      : "Lecture issue du positionnement marché et des comparables retenus.";
  const localizedSuggestedOpening =
    localizeGeneratedText(suggestedOpening) || textSuggestions.suggestedOpeningParagraph;
  const localizedPhotoOrderSuggestions = (() => {
    const localized = localizeGeneratedList(photoOrderSuggestions);
    if (localized.length > 0) {
      return localized;
    }
    return photoSuggestions.suggestedPhotoOrder;
  })();
  const scoreLine = (label: string, value: number | null) =>
    value !== null ? `${label} : ${value}/10.` : `${label} : à confirmer.`;

  const enrichImprovementNarrative = (item: AuditActionItem) => {
    const text = `${item.title ?? ""} ${item.description ?? ""} ${item.reason ?? ""}`.toLowerCase();

    if (/description|texte|contenu|rédaction|redaction|storytelling|promesse/.test(text)) {
      return {
        description: `${scoreLine("Description", descriptionQuality)} Le texte doit mieux transformer les informations de l’annonce en bénéfices concrets pour le voyageur : confort, expérience, emplacement et raisons de réserver.`,
        reason: "Score description + qualité de projection voyageur.",
      };
    }

    if (/seo|titre|mot.?clé|recherche|visibilité|visibilite|référencement|referencement/.test(text)) {
      return {
        description: `${scoreLine("SEO", seoStrength)} Le titre et les premières lignes doivent mieux intégrer les mots-clés utiles : localisation, équipements recherchés et atouts différenciants.`,
        reason: "Score SEO + visibilité plateforme.",
      };
    }

    if (/photo|visuel|image|galerie|ordre|couverture/.test(text)) {
      return {
        description: `${scoreLine("Photos", photoQuality)} Les visuels doivent continuer à rassurer dès les premières secondes : meilleurs espaces en premier, lumière, confort et valeur perçue.`,
        reason: "Score photos + ordre de galerie.",
      };
    }

    if (/équipement|equipement|amenit|confort|wifi|piscine|parking|clim/.test(text)) {
      return {
        description: `${scoreLine("Équipements", amenitiesCompleteness)} Les équipements clés doivent être plus visibles pour réduire les doutes avant réservation et augmenter la perception de confort.`,
        reason: "Score équipements + réassurance séjour.",
      };
    }

    if (/conversion|réservation|reservation|confiance|rassur|frein|friction/.test(text)) {
      return {
        description: `${scoreLine("Conversion", conversionStrength)} La priorité est de réduire les hésitations : promesse claire, preuves visibles, informations concrètes et cohérence entre titre, photos et description.`,
        reason: "Score conversion + friction décisionnelle.",
      };
    }

    return {
      description:
        localizeGeneratedText(item.description) ||
        "Action issue du rapport : à prioriser selon l’impact business et les signaux disponibles.",
      reason:
        typeof item.reason === "string"
          ? localizeGeneratedText(item.reason)
          : item.reason,
    };
  };

  const factualStrengthSignals = [
    photoQuality !== null && photoQuality >= 8
      ? `Photos solides : ${photoQuality}/10.`
      : null,
    photoOrder !== null && photoOrder >= 8
      ? `Ordre des photos solide : ${photoOrder}/10.`
      : null,
    descriptionQuality !== null && descriptionQuality >= 8
      ? `Description performante : ${descriptionQuality}/10.`
      : null,
    amenitiesCompleteness !== null && amenitiesCompleteness >= 8
      ? `Équipements bien couverts : ${amenitiesCompleteness}/10.`
      : null,
    seoStrength !== null && seoStrength >= 8
      ? `SEO solide : ${seoStrength}/10.`
      : null,
    conversionStrength !== null && conversionStrength >= 8
      ? `Conversion solide : ${conversionStrength}/10.`
      : null,
  ].filter((item): item is string => typeof item === "string" && item.trim().length > 0);

  const factualWeakSignals = [
    descriptionQuality !== null && descriptionQuality < 7
      ? `Description perfectible : ${descriptionQuality}/10.`
      : null,
    seoStrength !== null && seoStrength < 7
      ? `SEO à renforcer : ${seoStrength}/10.`
      : null,
    conversionStrength !== null && conversionStrength < 7
      ? `Conversion à renforcer : ${conversionStrength}/10.`
      : null,
    amenitiesCompleteness !== null && amenitiesCompleteness < 7
      ? `Équipements à compléter : ${amenitiesCompleteness}/10.`
      : null,
    photoQuality !== null && photoQuality < 7
      ? `Qualité photo à améliorer : ${photoQuality}/10.`
      : null,
    photoOrder !== null && photoOrder < 7
      ? `Ordre des photos à revoir : ${photoOrder}/10.`
      : null,
  ].filter((item): item is string => typeof item === "string" && item.trim().length > 0);

  const localizedImprovements = improvements.map((item, index) => {
    const enriched = enrichImprovementNarrative(item);

    return {
      ...item,
      title: localizeGeneratedText(item.title) || `Amélioration ${index + 1}`,
      description: enriched.description,
      reason: enriched.reason,
    };
  });

  const compareLocalizedImprovementOrder = (
    a: (typeof localizedImprovements)[number],
    b: (typeof localizedImprovements)[number]
  ) => {
    const byIndex = (a.orderIndex ?? 0) - (b.orderIndex ?? 0);
    if (byIndex !== 0) return byIndex;
    return String(a.id ?? "").localeCompare(String(b.id ?? ""));
  };

  const orderedLocalizedImprovements = localizedImprovements
    .slice()
    .sort(compareLocalizedImprovementOrder)
    .map((item, index) => ({
      ...item,
      orderIndex: item.orderIndex ?? index + 1,
    }));

  const groupedImprovements = {
    high: orderedLocalizedImprovements.filter((item) => item.impact === "high"),
    medium: orderedLocalizedImprovements.filter((item) => item.impact === "medium"),
    low: orderedLocalizedImprovements.filter((item) => item.impact === "low"),
  };

  const scoreStatusForCard = (value: number | null) => {
    if (value === null) {
      return {
        label: copy.scoreStatusConfirm,
        detail: copy.scoreStatusPartialData,
        className: "border-slate-200 bg-slate-50 text-slate-600",
      };
    }

    if (value >= 9) {
      return {
        label: copy.scoreStatusExcellent,
        detail: copy.scoreStatusExcellentDetail,
        className: "border-emerald-300 bg-emerald-50 text-emerald-700",
      };
    }

    if (value >= 8) {
      return {
        label: copy.scoreStatusStrong,
        detail: copy.scoreStatusStrongDetail,
        className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      };
    }

    if (value >= 7) {
      return {
        label: copy.scoreStatusCorrect,
        detail: copy.scoreStatusCorrectDetail,
        className: "border-amber-200 bg-amber-50 text-amber-700",
      };
    }

    if (value >= 6) {
      return {
        label: copy.scoreStatusNeedsWork,
        detail: copy.scoreStatusNeedsWorkDetail,
        className: "border-orange-200 bg-orange-50 text-orange-700",
      };
    }

    return {
      label: copy.scoreStatusWeak,
      detail: copy.scoreStatusWeakDetail,
      className: "border-rose-200 bg-rose-50 text-rose-700",
    };
  };

  const subScoreCards = [
    {
      label: "Photos",
      displayLabel: copy.photoQuality,
      value: photoQuality,
      status: scoreStatusForCard(photoQuality),
      note: copy.subScorePhotosNote,
      fallback: copy.subScorePhotosFallback,
      impact: copy.subScorePhotosImpact,
      priority: copy.subScorePhotosPriority,
    },
    {
      label: "Ordre des photos",
      displayLabel: copy.photoOrderQuality,
      value: photoOrder,
      status: scoreStatusForCard(photoOrder),
      note: copy.subScorePhotoOrderNote,
      fallback: copy.subScorePhotoOrderFallback,
      impact: copy.subScorePhotoOrderImpact,
      priority: copy.subScorePhotoOrderPriority,
    },
    {
      label: "Description",
      displayLabel: copy.descriptionQualityLabel,
      value: descriptionQuality,
      status: scoreStatusForCard(descriptionQuality),
      note: copy.subScoreDescriptionNote,
      fallback: copy.subScoreDescriptionFallback,
      impact: copy.subScoreDescriptionImpact,
      priority: copy.subScoreDescriptionPriority,
    },
    {
      label: "Équipements",
      displayLabel: copy.amenitiesCompletenessLabel,
      value: amenitiesCompleteness,
      status: scoreStatusForCard(amenitiesCompleteness),
      note: copy.subScoreAmenitiesNote,
      fallback: copy.subScoreAmenitiesFallback,
      impact: copy.subScoreAmenitiesImpact,
      priority: copy.subScoreAmenitiesPriority,
    },
    {
      label: "SEO",
      displayLabel: copy.seoPerformance,
      value: seoStrength,
      status: scoreStatusForCard(seoStrength),
      note: copy.subScoreSeoNote,
      fallback: copy.subScoreSeoFallback,
      impact: copy.subScoreSeoImpact,
      priority: copy.subScoreSeoPriority,
    },
    {
      label: "Conversion",
      displayLabel: copy.listingConversion,
      value: conversionStrength,
      status: scoreStatusForCard(conversionStrength),
      note: copy.subScoreConversionNote,
      fallback: copy.subScoreConversionFallback,
      impact: copy.subScoreConversionImpact,
      priority: copy.subScoreConversionPriority,
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
  const heroBookingLiftPctFromPotential = ((): number | null => {
    if (bookingPotential == null || !Number.isFinite(bookingPotential)) return null;
    if (bookingPotential <= 0) return null;
    const rounded =
      bookingPotential > 0 && bookingPotential <= 2 ? bookingPotential * 100 : bookingPotential;
    const n = Math.round(rounded);
    return n > 0 ? n : null;
  })();
  const heroBusinessImpactLiftDisplay = ((): string => {
    const fmt = (pct: number) => `+${Math.round(pct)}%`;

    const lo = reservationPotentialLow;
    const hi = reservationPotentialHigh;
    if (
      lo !== null &&
      hi !== null &&
      Number.isFinite(lo) &&
      Number.isFinite(hi) &&
      hi > 0 &&
      lo <= hi
    ) {
      if (lo > 0) {
        return `${fmt(lo)} à ${fmt(hi)}`;
      }
      return `Jusqu'à ${fmt(hi)}`;
    }

    if (heroBookingLiftPctFromPotential !== null) {
      return `Jusqu'à ${fmt(heroBookingLiftPctFromPotential)}`;
    }

    const ceilingLift = bookingLiftHigh > 0 ? bookingLiftHigh : null;
    if (ceilingLift !== null && ceilingLift > 0) {
      return `Jusqu'à ${fmt(ceilingLift)}`;
    }

    return copy.scoreStatusConfirm;
  })();
  /** Carte « Impact business » : 18% / 28% des revenus optimisés (mêmes bornes que « Repère gain mensuel »), puis estimated, sinon %. */
  const heroBusinessImpactLiftDisplayResolved =
    (() => {
      if (businessUiLowConfidenceGuardActive && !allowConversionOnlyRevenueProjection) return "—";

      const fmtBand = (lo: number, hi: number) =>
        copy.heroImpactRevenueRange
          .replace("{low}", revenueFormatter.format(lo))
          .replace("{high}", revenueFormatter.format(hi));

      const optLo = monthlyOptimizedRevenueLowRounded;
      const optHi = monthlyOptimizedRevenueHighRounded;
      if (
        optLo != null &&
        optHi != null &&
        Number.isFinite(optLo) &&
        Number.isFinite(optHi) &&
        optLo > 0 &&
        optHi > 0 &&
        optLo <= optHi
      ) {
        const impactLow = Math.round(optLo * 0.18);
        const impactHigh = Math.round(optHi * 0.28);
        if (impactLow > 0 && impactHigh > 0 && impactLow <= impactHigh) {
          return fmtBand(impactLow, impactHigh);
        }
      }

      // estimatedRevenueLow/High from payload :
      // - marché fiable : affichage normal
      // - marché non pricé mais prix annonce connu : projection prudente conversion-only
      const loRev =
        hasSufficientPricedComparables || allowConversionOnlyRevenueProjection
          ? estimatedRevenueLow
          : null;
      const hiRev =
        hasSufficientPricedComparables || allowConversionOnlyRevenueProjection
          ? estimatedRevenueHigh
          : null;
      if (
        loRev != null &&
        hiRev != null &&
        Number.isFinite(loRev) &&
        Number.isFinite(hiRev) &&
        loRev > 0 &&
        hiRev > 0 &&
        loRev <= hiRev
      ) {
        return fmtBand(Math.round(loRev), Math.round(hiRev));
      }

      return null;
    })() ?? (businessUiLowConfidenceGuardActive ? "—" : heroBusinessImpactLiftDisplay);
  const heroImpactSupport =
    businessUiLowConfidenceGuardActive
      ? copy.heroImpactSupportOutOfSegment
      : impactSummary?.trim() === auditDetailCopy.fr.heroImpactSupportCompetitive ||
          impactSummary?.trim() === auditDetailCopy.en.heroImpactSupportCompetitive ||
          impactSummary?.trim() === auditDetailCopy.es.heroImpactSupportCompetitive
        ? copy.heroImpactSupportCompetitive
        : impactSummary?.trim() ||
        copy.heroImpactSupportDefault;
  const heroBusinessLiftHint =
    businessUiLowConfidenceGuardActive &&
    payload.business?.revenueBaselinePriceSource === "listing" &&
    estimatedRevenueLow != null &&
    estimatedRevenueHigh != null
      ? copy.heroBusinessLiftHintPrudent
      : businessUiLowConfidenceGuardActive
        ? copy.heroBusinessLiftHintInsufficient
        : copy.heroBusinessLiftHintDefault;
  const scoreSideCardNarrative =
    overallScore < 4
      ? "Lecture /10 : niveau fragile — détail par pilier dans « Niveau de conversion global »."
      : overallScore < 7
        ? "Lecture /10 : niveau modéré — voir les sous-scores du bloc principal."
        : copy.heroScoreNarrativeStrong;
  /** Carte latérale « Impact estimé » : % dès qu’au moins un comparable alimente la lecture marché. */
  const impactEstimatedSideShowPercent =
    (!businessUiLowConfidenceGuardActive || allowConversionOnlyRevenueProjection) &&
    bookingLiftHigh > 0;
  const impactSideCardNarrative =
    allowConversionOnlyRevenueProjection
      ? "Projection prudente basée sur le prix actuel et le potentiel de conversion, sans base tarifaire marché suffisante."
      : businessUiLowConfidenceGuardActive
        ? "Segment hors marché — données business non exploitables pour cette annonce."
      : !hasMarketData && bookingLiftHigh > 0
        ? "Un potentiel d’optimisation peut exister sur votre annonce, mais le pourcentage chiffré sera affiché lorsque la base marché sera solide (au moins trois comparables fiables et un score marché consolidé), sur le même principe que l’estimation en euros."
      : bookingLiftHigh > 0
          ? copy.impactSideCardNarrativeCondensed.replace(
              "{label}",
              copy.conversionGainPotential
            )
        : bookingLiftSummary?.trim() ||
          impactSummary?.trim() ||
          "Aucune fourchette % exploitable pour le lift dans le rapport.";
  const impactEstimatedSideBarWidthPct = impactEstimatedSideShowPercent
    ? Math.max(0, Math.min(100, bookingLiftHigh))
    : 0;
  const heroRevenueSupport = !hasMarketData
    ? copy.heroRevenueSupportUnavailable
    : monthlyOptimizedRevenueBandDisplayable
      ? copy.heroRevenueSupportIndicative
      : monthlyGainBusinessModelReady
        ? copy.heroRevenueSupportPrudent
        : copy.heroRevenueSupportFallback;
  const scoreOverviewTitle = copy.scoreOverviewTitle;
  const scoreOverviewText =
    aiGenerationStyle === "airbnb"
      ? copy.scoreOverviewTextAirbnb
      : copy.scoreOverviewTextDefault;
  const lqiComponentNotes = {
    listing:
      lqiListingQuality === null
        ? "Donnée non disponible pour cet axe dans cette vue."
        : lqiListingQualityIsNative
        ? lqiListingQuality >= 75
          ? "Composante fournie par le rapport : niveau élevé sur cet axe — à valider sur le contenu réel de l’annonce."
          : "Composante fournie par le rapport : niveau modéré — un signal parmi d’autres, pas un verdict isolé."
        : lqiListingQuality >= 75
        ? "Synthèse locale /100 à partir des volets /10 déjà détaillés plus haut : même famille de signaux, vue condensée."
        : "Synthèse locale /100 à partir des sous-scores /10 de l’audit — indicatif, déjà exploré ailleurs sur la page.",
    market:
      lqiMarketCompetitiveness === null
        ? "Donnée non disponible pour cet axe dans cette vue."
        : lqiMarketCompetitivenessIsNative
        ? lqiMarketCompetitiveness >= 80
          ? "Votre annonce reste compétitive face aux annonces proches analysées."
          : lqiMarketCompetitiveness >= 60
            ? "Le positionnement marché est correct, mais encore améliorable."
            : "Les concurrents observés semblent actuellement mieux positionnés."
        : lqiMarketCompetitiveness >= 75
        ? "Synthèse locale (scores marché + global /10) : repère condensé, non indépendant des blocs marché."
        : "Synthèse locale (scores marché + global /10) : lecture indicative, croiser avec « Positionnement sur le marché ».",
    conversion:
      lqiConversionPotential === null
        ? "Pas de valeur /100 pour ce volet : voir score conversion et recommandations ailleurs."
        : lqiConversionIsNative
        ? lqiConversionPotential >= 75
          ? "Le potentiel de conversion est déjà solide sur cette annonce."
          : lqiConversionPotential >= 55
            ? "Plusieurs optimisations peuvent encore améliorer la conversion."
            : "Des freins visibles limitent encore le potentiel de réservation."
        : "Indicatif : valeur complétée à partir d’un autre champ du rapport (potentiel réservation), pas une mesure conversion autonome.",
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
  const hasStructuredWeaknessLines =
    (weaknesses.length > 0 ? weaknesses : resolvedWeaknesses).length > 0;
  const weaknessesFallbackText = !hasStructuredWeaknessLines
    ? insightSignals.length > 0 && weaknesses.length === 0
      ? weaknessListInsightDerived
        ? "Aucun point faible distinct n’a pu être isolé à partir des « insights » avec la méthode actuelle."
        : "Pas de liste « weaknesses » structurée dans le rapport : les « insights » ne sont pas recopiés ici comme faiblesses formelles — voir actions prioritaires et écarts marché."
      : aiGenerationStyle === "airbnb"
      ? "Aucune faiblesse dans les champs structurés du rapport pour l’instant — lecture incomplète, pas absence avérée de points à améliorer."
      : "Aucune faiblesse dans les champs structurés du rapport pour l’instant — lecture incomplète, pas absence avérée de points à améliorer."
    : "";

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
      setActionToast(copy.copyUnavailable);
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
      setActionToast(copy.copyUnavailable);
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
      setActionToast(copy.copyUnavailable);
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
    if (score >= 7) return surfacePositive;
    if (score >= 4) return surfaceWarning;
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
  const SectionDivider = ({
    eyebrow,
    title,
    description,
  }: {
    eyebrow: string;
    title: string;
    description: string;
  }) => (
    <div className="rounded-3xl border border-slate-200/80 bg-white/75 px-5 py-4 shadow-[0_14px_34px_rgba(15,23,42,0.05),0_1px_0_rgba(255,255,255,0.7)_inset]">
      <p className="text-[8px] font-semibold uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p>
      <h2 className="mt-3 text-[16px] font-semibold tracking-[-0.02em] text-slate-950 md:text-[18px]">{title}</h2>
      <p className="mt-2 max-w-3xl text-[11px] leading-5 text-slate-700">{description}</p>
    </div>
  );
  const grid2 = "grid gap-5 md:grid-cols-2";
  const grid4 = "grid gap-5 md:grid-cols-2 xl:grid-cols-4";

  if (loading) {
    return (
      <div className="space-y-4 text-base text-neutral-300">
        <h1 className="text-2xl font-semibold text-white">{copy.loading}</h1>
        <p className="max-w-2xl text-neutral-400">
          {copy.loadingWait}
        </p>
      </div>
    );
  }

  if (!audit) {
    return (
      <div className="space-y-4 text-base text-neutral-300">
        <h1 className="text-2xl font-semibold text-white">{copy.auditUnavailable}</h1>
        <p className="max-w-2xl text-neutral-400">
          {copy.notFound}
        </p>
      </div>
    );
  }

  return (
    <div className={pageRootClass}>
      {showToast && (
        <div className="fixed right-6 top-[88px] z-30">
          <div className={`relative overflow-hidden ${radiusCard} ${borderStandard} ${surfaceBusiness} ${cardGlow} px-4 py-3 text-[12px] text-emerald-900 ${shadowEmphasis}`}>
            <p className="font-semibold">{copy.auditCompleted}</p>
            <p className="mt-6 text-[10px] text-emerald-800">
              {copy.auditCompletedText}
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
            {copy.businessReading}
          </p>
          <h1 className="nk-page-title max-w-4xl bg-gradient-to-r from-amber-500 via-orange-400 to-yellow-400 bg-clip-text text-transparent !text-transparent [-webkit-text-fill-color:transparent] drop-shadow-[0_1px_0_rgba(255,255,255,0.9)]">
            {copy.heroTitle}
          </h1>
          <p className="nk-page-subtitle max-w-3xl text-[13px] leading-6 text-slate-700">
            {heroImpactSupport}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3 text-[12px] font-semibold">
            {listing?.hostName ? (
              <span className="rounded-full border border-slate-300 bg-white px-4 py-2 text-slate-800 shadow-sm">
                {copy.host}: {listing.hostName}
              </span>
            ) : listingPlatform === "agoda" ? (
              <span className="rounded-full border border-slate-300 bg-slate-50 px-4 py-2 text-slate-600 shadow-sm">
                {copy.hostUnavailableAgoda}
              </span>
            ) : null}

            <span
              className={`rounded-full border px-4 py-2 shadow-sm ${
                visibleRating !== null
                  ? "border-amber-300 bg-amber-50 text-amber-800"
                  : "border-amber-200 bg-amber-50/70 text-amber-700"
              }`}
            >
              {visibleRating !== null
                ? `★ ${copy.listingRating} : ${visibleRating}/${visibleRatingScale}`
                : `★ ${copy.ratingUnavailable}`}
            </span>

            <span
              className={`rounded-full border px-4 py-2 shadow-sm ${
                visibleReviewCount !== null
                  ? "border-sky-300 bg-sky-50 text-sky-800"
                  : "border-slate-200 bg-slate-50 text-slate-600"
              }`}
            >
              {visibleReviewCount !== null
                ? `${visibleReviewCount} ${copy.guestReviews}`
                : copy.reviewsUnavailable}
            </span>

            {photoBadge ? (
              <span className={`rounded-full border px-4 py-2 shadow-sm ${photoBadge.className}`}>
                {photoBadge.label}
              </span>
            ) : null}
          </div>
          <div className="grid items-stretch gap-5 sm:grid-cols-3">
            <div className={`min-w-0 overflow-hidden ${kpiCard} flex h-full flex-col border border-l-4 border-slate-200/80 border-l-sky-500/75 !bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(239,246,255,0.92)_100%)] shadow-[0_14px_38px_rgba(30,64,175,0.09),0_1px_0_rgba(255,255,255,0.70)_inset] transition-shadow hover:shadow-[0_20px_52px_rgba(30,64,175,0.13),0_1px_0_rgba(255,255,255,0.74)_inset]`}>
              <div className="flex min-h-0 flex-1 flex-col justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-slate-700">
                      {copy.marketPosition}
                    </p>
                    {marketTierBadgeLabel ? (
                      <span className={marketTierBadgeClass}>{marketTierBadgeLabel}</span>
                    ) : null}
                  </div>
                  <p
                    className={`mt-3 break-words text-[13px] font-semibold tracking-tight md:text-[14px] ${marketPositionHeadlineClass}`}
                  >
                    {marketPositionHeadlineText}
                  </p>
                </div>
                <p className="mt-3 text-[11px] leading-5 text-slate-700 md:mt-4">
                  {heroMarketPositionSupportUi}
                </p>
              </div>
            </div>
            <div className={`min-w-0 overflow-hidden ${kpiCardEmphasis} flex h-full flex-col border border-l-4 border-emerald-200/80 border-l-emerald-500/85 !bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(220,252,231,0.94)_100%)] shadow-[0_16px_44px_rgba(16,185,129,0.14),0_1px_0_rgba(255,255,255,0.70)_inset] transition-shadow hover:shadow-[0_24px_64px_rgba(16,185,129,0.19),0_1px_0_rgba(255,255,255,0.74)_inset]`}>
              <div className="flex min-h-0 flex-1 flex-col justify-between gap-3">
                <div>
                  <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-slate-700">
                    {copy.businessImpact}
                  </p>
                  <p className="mt-3 break-words text-[13px] font-semibold tracking-tight text-emerald-700 md:text-[14px]">
                    {heroBusinessImpactLiftDisplayResolved}
                  </p>
                </div>
                <p className="mt-3 text-[11px] leading-5 text-slate-700 md:mt-4">
                  {heroBusinessLiftHint}
                </p>
              </div>
            </div>
            <div className={`min-w-0 overflow-hidden ${kpiCard} flex h-full flex-col border border-l-4 border-amber-200/75 border-l-amber-500/85 !bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.16),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,247,237,0.93)_100%)] shadow-[0_14px_38px_rgba(180,83,9,0.10),0_1px_0_rgba(255,255,255,0.70)_inset] transition-shadow hover:shadow-[0_20px_52px_rgba(180,83,9,0.14),0_1px_0_rgba(255,255,255,0.74)_inset]`}>
              <div className="flex min-h-0 flex-1 flex-col justify-between gap-3">
                <div>
                  <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-slate-700">
                    {copy.monthlyGainBenchmark}
                  </p>
                  <p className={`mt-3 text-[13px] font-semibold tracking-tight md:text-[14px] ${
                    heroMonthlyGainToneStrong ? "text-emerald-700" : "text-amber-700"
                  }`}>
                    {revenueImpactRangeDisplay}
                  </p>
                </div>
                <p className="mt-3 text-[11px] leading-5 text-slate-700 md:mt-4">{heroRevenueSupport}</p>
              </div>
            </div>
          </div>
          <div className="mt-5">
            <div>
              {/* CTA déplacé dans la carte finale en bas de page. */}

              {refineOpen && (
                <div className={`mt-4 overflow-hidden ${radiusCard} border border-slate-200/70 bg-white/90 p-5 shadow-[0_8px_24px_rgba(15,23,42,0.07),0_1px_0_rgba(255,255,255,0.70)_inset]`}>

                  {/* Profil du bien */}
                  <p className="text-[9px] font-semibold uppercase tracking-[0.10em] text-slate-400">
                    {copy.propertyProfile}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                    {[
                      {
                        label: copy.propertyType, value: refinePropType, setter: setRefinePropType,
                        options: [
                          { v: "villa", l: "Villa" }, { v: "apartment", l: "Appartement" },
                          { v: "house", l: "Maison" }, { v: "riad", l: "Riad" },
                          { v: "studio", l: "Studio" },
                        ],
                      },
                    ].map(({ label, value, setter, options }) => (
                      <div key={label}>
                        <label className="mb-1 block text-[9px] font-medium text-slate-500">{label}</label>
                        <select
                          value={value}
                          onChange={(e) => setter(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] text-slate-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400/60"
                        >
                          <option value="">— {copy.notSpecified}</option>
                          {options.map(({ v, l }) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </div>
                    ))}
                    {[
                      { label: copy.bedrooms, value: refineBedrooms, setter: setRefineBedrooms, opts: [1,2,3,4,5,6,7,8,9,10], extra: "10+" },
                      { label: copy.bathrooms, value: refineBathrooms, setter: setRefineBathrooms, opts: [1,2,3,4,5,6,7,8], extra: "8+" },
                      { label: copy.guests, value: refineGuests, setter: setRefineGuests, opts: [2,4,6,8,10,12,14,16,18,20], extra: "20+" },
                      { label: copy.beds, value: refineBeds, setter: setRefineBeds, opts: [1,2,3,4,5,6,7,8,9,10], extra: "10+" },
                    ].map(({ label, value, setter, opts, extra }) => (
                      <div key={label}>
                        <label className="mb-1 block text-[9px] font-medium text-slate-500">{label}</label>
                        <select
                          value={value}
                          onChange={(e) => setter(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] text-slate-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400/60"
                        >
                          <option value="">—</option>
                          {opts.map((n) => <option key={n} value={String(n)}>{n}</option>)}
                          <option value={extra}>{extra}</option>
                        </select>
                      </div>
                    ))}
                    <div>
                      <label className="mb-1 block text-[9px] font-medium text-slate-500">{copy.minimumStay}</label>
                      <select
                        value={refineMinStay}
                        onChange={(e) => setRefineMinStay(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] text-slate-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400/60"
                      >
                        <option value="">—</option>
                        {[
                          ["1", copy.minimumStay1],
                          ["2", copy.minimumStay2],
                          ["3", copy.minimumStay3],
                          ["5", copy.minimumStay5],
                          ["7", copy.minimumStay7],
                          ["14", copy.minimumStay14],
                        ].map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Positionnement marché */}
                  <div className="mt-5">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.10em] text-slate-400">
                      {copy.marketPositioningLabel}
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {[
                        { value: "standard", label: copy.marketTierStandard },
                        { value: "haut_standing", label: copy.marketTierHighEnd },
                        { value: "premium", label: copy.marketTierPremium },
                        { value: "luxe_experientiel", label: copy.marketTierExperientialLuxury },
                        { value: "ultra_luxe", label: copy.marketTierUltraLuxury },
                      ].map(({ value, label }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setRefineMarketTier((t) => (t === value ? "" : value))}
                          className={`${radiusPill} border px-3 py-1.5 text-[10px] font-semibold tracking-[0.06em] transition ${
                            refineMarketTier === value
                              ? "border-blue-500/60 bg-blue-50 text-blue-700 shadow-sm"
                              : "border-slate-200/80 bg-white/70 text-slate-600 hover:border-slate-300 hover:bg-white"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Attributs différenciants */}
                  <div className="mt-5">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.10em] text-slate-400">
                      {copy.differentiatingAttributes}
                    </p>
                    <p className="mt-1 text-[9px] text-slate-400">
                      {copy.comparableWeightingHint}
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-2">
                      {[
                        { value: "private_pool", label: copy.attributePrivatePool },
                        { value: "sea_view", label: copy.attributeSeaView },
                        { value: "beachfront", label: copy.attributeBeachfront },
                        { value: "jacuzzi", label: copy.attributeJacuzzi },
                        { value: "parking", label: copy.attributeParking },
                        { value: "ac", label: copy.attributeAirConditioning },
                        { value: "wifi", label: copy.attributeWifi },
                        { value: "gym", label: copy.attributeGym },
                        { value: "terrace", label: copy.attributeTerrace },
                        { value: "concierge", label: copy.attributeConcierge },
                      ].map(({ value, label }) => (
                        <label key={value} className="flex cursor-pointer items-center gap-1.5 text-[11px] text-slate-600">
                          <input
                            type="checkbox"
                            checked={refineAttributes.includes(value)}
                            onChange={(e) => {
                              setRefineAttributes((prev) =>
                                e.target.checked ? [...prev, value] : prev.filter((a) => a !== value)
                              );
                            }}
                            className="h-3 w-3 rounded border-slate-300 text-blue-600 focus:ring-blue-400/50"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[9px] text-slate-400">
                        {copy.marketRecalculationOnly}
                      </p>
                      <button
                        type="button"
                        disabled={isRefiningMarket}
                        onClick={handleRefineMarket}
                        className={`${radiusPill} border px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.10em] transition ${
                          isRefiningMarket
                            ? "cursor-wait border-slate-200 bg-slate-100 text-slate-400"
                            : "border-slate-300 bg-slate-800 text-white hover:bg-slate-700"
                        }`}
                      >
                        {isRefiningMarket ? copy.diagnostic : copy.recalibrateMarket}
                      </button>
                    </div>
                    {refineError && (
                      <p className="mt-2 text-[9px] font-medium text-red-600">{refineError}</p>
                    )}

                    {/* ── Product result card ── */}
                    {refineDiagnosticResult?.refinedMarketPreview && (() => {
                      const preview = refineDiagnosticResult.refinedMarketPreview;
                      const totalAnalyzed = refineDiagnosticResult.comparableScoring?.count ?? 0;
                      const isInsufficient = preview.status === "insufficient_refined_comparables";
                      const confidenceLabel =
                        preview.confidencePreview === "high" ? "élevée"
                        : preview.confidencePreview === "medium" ? "modérée"
                        : "faible";
                      const confidenceColor =
                        preview.confidencePreview === "high" ? "text-emerald-700"
                        : preview.confidencePreview === "medium" ? "text-amber-600"
                        : "text-rose-500";

                      return (
                        <div className="mt-4 rounded-xl border border-slate-200/80 bg-white/90 p-4 shadow-sm">
                          <p className="text-[11px] font-semibold tracking-tight text-slate-800">
                            {isInsufficient ? copy.premiumMarketInsufficient : copy.marketRecalibrated}
                          </p>
                          <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">
                            {isInsufficient
                              ? copy.premiumMarketText
                              : copy.recalibratedMarketText}
                          </p>
                          <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-[10px] text-slate-600">
                            {isInsufficient ? (
                              <>
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-400">{copy.comparablesAnalyzed}</span>
                                  <span className="font-semibold text-slate-800">{totalAnalyzed}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-400">{copy.premiumComparables}</span>
                                  <span className="font-semibold text-slate-800">{preview.selectedComparableCount}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-400">{copy.reliability}</span>
                                  <span className={`font-semibold ${confidenceColor}`}>{confidenceLabel}</span>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-400">{copy.comparablesKept}</span>
                                  <span className="font-semibold text-slate-800">{preview.selectedComparableCount}</span>
                                </div>
                                {preview.medianNightlyPrice !== null && (
                                  <div className="flex items-center justify-between">
                                    <span className="text-slate-400">{copy.recalibratedMedian}</span>
                                    <span className="font-semibold text-slate-800">{preview.medianNightlyPrice} €</span>
                                  </div>
                                )}
                                {preview.avgNightlyPrice !== null && (
                                  <div className="flex items-center justify-between">
                                    <span className="text-slate-400">{copy.recalibratedAverage}</span>
                                    <span className="font-semibold text-slate-800">{preview.avgNightlyPrice} €</span>
                                  </div>
                                )}
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-400">{copy.reliability}</span>
                                  <span className={`font-semibold ${confidenceColor}`}>{confidenceLabel}</span>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* ── Dev-only diagnostic toggle ── */}
                    {DEBUG_AUDIT_UI && (
                      <div className="mt-3 space-y-1.5">
                        {/* Premium discovery toggle */}
                        <label className="flex cursor-pointer items-center gap-2 text-[9px] text-slate-500">
                          <input
                            type="checkbox"
                            checked={runPremiumDiscovery}
                            onChange={(e) => setRunPremiumDiscovery(e.target.checked)}
                            className="h-3 w-3 rounded border-slate-300 text-amber-600 focus:ring-amber-400/50"
                          />
                          <span className={runPremiumDiscovery ? "font-semibold text-amber-600" : ""}>
                            Tester discovery premium
                          </span>
                          {runPremiumDiscovery && (
                            <span className="text-slate-400">(mode: active — Booking Playwright)</span>
                          )}
                        </label>

                        {/* Discovery result summary */}
                        {refineDiagnosticResult?.premiumDiscoveryResult && (
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-md border border-slate-200/60 bg-slate-50/60 px-2.5 py-1.5 font-mono text-[9px] text-slate-600">
                            <span className={`font-semibold ${
                              refineDiagnosticResult.premiumDiscoveryResult.status === "success"
                                ? "text-emerald-700"
                                : refineDiagnosticResult.premiumDiscoveryResult.status === "skipped"
                                  ? "text-slate-400"
                                  : "text-rose-500"
                            }`}>
                              {refineDiagnosticResult.premiumDiscoveryResult.status}
                            </span>
                            <span>candidates: <span className="font-semibold text-slate-800">{refineDiagnosticResult.premiumDiscoveryResult.candidateCount}</span></span>
                            <span className={refineDiagnosticResult.premiumDiscoveryResult.fallbackUsed ? "text-amber-600" : "text-emerald-600"}>
                              fallback: {refineDiagnosticResult.premiumDiscoveryResult.fallbackUsed ? "true" : "false"}
                            </span>
                            <span className="text-slate-400">{refineDiagnosticResult.premiumDiscoveryResult.elapsedMs}ms</span>
                          </div>
                        )}
                      </div>
                    )}

                    {DEBUG_AUDIT_UI && refineDiagnosticResult && (
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() => setShowRefineDiagnosticDebug((v) => !v)}
                          className="text-[9px] text-slate-400 underline decoration-dotted hover:text-slate-600"
                        >
                          {showRefineDiagnosticDebug ? "Masquer diagnostic technique" : "Afficher diagnostic technique"}
                        </button>

                        {showRefineDiagnosticDebug && (
                          <div className="mt-2 space-y-2">
                            {/* Scoring debug */}
                            {refineDiagnosticResult.comparableScoring && (
                              <div className="overflow-x-auto rounded-lg border border-slate-200/70 bg-slate-50/80 p-3 font-mono text-[10px] text-slate-600">
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                  <span className={`font-semibold ${
                                    refineDiagnosticResult.comparableScoring.status === "scored_from_market_memory"
                                      ? "text-emerald-700"
                                      : refineDiagnosticResult.comparableScoring.status.startsWith("skipped")
                                        ? "text-amber-600"
                                        : "text-slate-800"
                                  }`}>
                                    {refineDiagnosticResult.comparableScoring.status}
                                  </span>
                                  <span>
                                    premium:{" "}
                                    <span className={refineDiagnosticResult.comparableScoring.premiumMode ? "font-semibold text-amber-600" : "text-slate-400"}>
                                      {refineDiagnosticResult.comparableScoring.premiumMode ? "true" : "false"}
                                    </span>
                                  </span>
                                  {refineDiagnosticResult.comparableScoring.count !== undefined && (
                                    <span>count: <span className="font-semibold text-slate-800">{refineDiagnosticResult.comparableScoring.count}</span></span>
                                  )}
                                  {refineDiagnosticResult.comparableScoring.matchedBy && (
                                    <span>matched_by: <span className="text-sky-600">{refineDiagnosticResult.comparableScoring.matchedBy}</span></span>
                                  )}
                                  {refineDiagnosticResult.comparableScoring.snapshotId && (
                                    <span className="text-slate-400">snap:{refineDiagnosticResult.comparableScoring.snapshotId.slice(0, 8)}…</span>
                                  )}
                                  {refineDiagnosticResult.comparableScoring.reason && (
                                    <span className="text-rose-500">{refineDiagnosticResult.comparableScoring.reason}</span>
                                  )}
                                </div>
                                {(refineDiagnosticResult.comparableScoring.topScores?.length ?? 0) > 0 && (
                                  <div className="mt-2 space-y-2 border-t border-slate-200/60 pt-2">
                                    {refineDiagnosticResult.comparableScoring.topScores!.slice(0, 3).map((s, i) => (
                                      <div key={i}>
                                        <div className="flex items-center gap-2">
                                          <span className="text-slate-400">#{i + 1}</span>
                                          <span className="font-semibold text-slate-800">+{s.score}</span>
                                          <span className="max-w-[200px] truncate text-slate-500">
                                            {(s.url ?? "—").replace(/^https?:\/\//, "").slice(0, 55)}
                                          </span>
                                        </div>
                                        {s.breakdown && (
                                          <div className="ml-5 mt-0.5 flex flex-wrap gap-x-3 text-[9px] text-slate-500">
                                            <span>type:<span className={(s.breakdown.typeCompatibility ?? 0) === 0 ? "font-medium text-rose-500" : "text-slate-700"}>{s.breakdown.typeCompatibility ?? "—"}</span></span>
                                            <span>cap:{s.breakdown.capacityMatch ?? "—"}</span>
                                            <span>bed:{s.breakdown.bedroomMatch ?? "—"}</span>
                                            <span>price:<span className={(s.breakdown.priceSegment ?? 0) < 0 ? "font-medium text-rose-500" : "text-slate-700"}>{s.breakdown.priceSegment ?? "—"}</span></span>
                                            <span>amenity:{s.breakdown.amenitiesMatch ?? "—"}</span>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {(refineDiagnosticResult.comparableScoring.notes?.length ?? 0) > 0 && (
                                  <div className="mt-2 space-y-0.5 border-t border-slate-200/60 pt-2 text-[9px] text-slate-400">
                                    {refineDiagnosticResult.comparableScoring.notes!.slice(0, 5).map((note, i) => (
                                      <div key={i}>{note}</div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                            {/* Preview debug */}
                            {refineDiagnosticResult.refinedMarketPreview && (
                              <div className="overflow-x-auto rounded-lg border border-slate-200/70 bg-slate-50/80 p-3 font-mono text-[10px] text-slate-600">
                                <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-slate-400">preview raw</div>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                  <span className={`font-semibold ${refineDiagnosticResult.refinedMarketPreview.status === "ok" ? "text-emerald-700" : "text-amber-600"}`}>
                                    {refineDiagnosticResult.refinedMarketPreview.status}
                                  </span>
                                  <span>n: <span className="font-semibold text-slate-800">{refineDiagnosticResult.refinedMarketPreview.selectedComparableCount}</span></span>
                                  {refineDiagnosticResult.refinedMarketPreview.medianNightlyPrice !== null && (
                                    <span>median: <span className="font-semibold text-slate-800">{refineDiagnosticResult.refinedMarketPreview.medianNightlyPrice}</span></span>
                                  )}
                                  {refineDiagnosticResult.refinedMarketPreview.avgNightlyPrice !== null && (
                                    <span>avg: <span className="font-semibold text-slate-800">{refineDiagnosticResult.refinedMarketPreview.avgNightlyPrice}</span></span>
                                  )}
                                  <span className={refineDiagnosticResult.refinedMarketPreview.confidencePreview === "high" ? "text-emerald-600" : refineDiagnosticResult.refinedMarketPreview.confidencePreview === "medium" ? "text-amber-600" : "text-rose-500"}>
                                    conf:{refineDiagnosticResult.refinedMarketPreview.confidencePreview}
                                  </span>
                                  {refineDiagnosticResult.refinedMarketPreview.reason && (
                                    <span className="text-rose-500">{refineDiagnosticResult.refinedMarketPreview.reason}</span>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Premium discovery signals debug */}
                            {refineDiagnosticResult.premiumDiscoverySignals && (
                              <div className="overflow-x-auto rounded-lg border border-slate-200/70 bg-slate-50/80 p-3 font-mono text-[10px] text-slate-600">
                                <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-wide text-slate-400">premium discovery signals</div>

                                {/* Core fields row */}
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                  <span>
                                    premiumMode:{" "}
                                    <span className={refineDiagnosticResult.premiumDiscoverySignals.premiumMode ? "font-semibold text-amber-600" : "text-slate-400"}>
                                      {refineDiagnosticResult.premiumDiscoverySignals.premiumMode ? "true" : "false"}
                                    </span>
                                  </span>
                                  {refineDiagnosticResult.premiumDiscoverySignals.softMinPrice !== null && (
                                    <span>
                                      softMinPrice:{" "}
                                      <span className="font-semibold text-slate-800">{refineDiagnosticResult.premiumDiscoverySignals.softMinPrice}</span>
                                      <span className="ml-1 text-slate-400">(hint)</span>
                                    </span>
                                  )}
                                  {refineDiagnosticResult.premiumDiscoverySignals.minGuests !== null && (
                                    <span>minGuests: <span className="font-semibold text-slate-800">{refineDiagnosticResult.premiumDiscoverySignals.minGuests}</span></span>
                                  )}
                                  {refineDiagnosticResult.premiumDiscoverySignals.minBedrooms !== null && (
                                    <span>minBedrooms: <span className="font-semibold text-slate-800">{refineDiagnosticResult.premiumDiscoverySignals.minBedrooms}</span></span>
                                  )}
                                </div>

                                {/* Keywords + signals rows */}
                                {refineDiagnosticResult.premiumDiscoverySignals.queryKeywords.length > 0 && (
                                  <div className="mt-1.5 text-[9px]">
                                    <span className="text-slate-400">keywords: </span>
                                    <span className="text-sky-600">{refineDiagnosticResult.premiumDiscoverySignals.queryKeywords.join(", ")}</span>
                                  </div>
                                )}
                                {refineDiagnosticResult.premiumDiscoverySignals.requiredSignals.length > 0 && (
                                  <div className="mt-1 text-[9px]">
                                    <span className="text-slate-400">required: </span>
                                    <span className="text-slate-700">{refineDiagnosticResult.premiumDiscoverySignals.requiredSignals.join(", ")}</span>
                                  </div>
                                )}
                                {refineDiagnosticResult.premiumDiscoverySignals.boostSignals.length > 0 && (
                                  <div className="mt-1 text-[9px]">
                                    <span className="text-slate-400">boost: </span>
                                    <span className="text-emerald-600">{refineDiagnosticResult.premiumDiscoverySignals.boostSignals.join(", ")}</span>
                                  </div>
                                )}

                                {/* Airbnb URL preview */}
                                {refineDiagnosticResult.airbnbUrlPreview && (
                                  <div className="mt-2 border-t border-slate-200/60 pt-2 text-[9px]">
                                    <div className="text-slate-400">airbnb_url_preview:</div>
                                    <div className="mt-0.5 break-all text-sky-700">{refineDiagnosticResult.airbnbUrlPreview}</div>
                                  </div>
                                )}

                                {/* Booking queries preview */}
                                {(refineDiagnosticResult.bookingQueriesPreview?.length ?? 0) > 0 && (
                                  <div className="mt-2 border-t border-slate-200/60 pt-2 text-[9px]">
                                    <div className="text-slate-400">booking_queries_preview:</div>
                                    <div className="mt-0.5 space-y-0.5">
                                      {refineDiagnosticResult.bookingQueriesPreview!.map((q, i) => (
                                        <div key={i} className={i < (refineDiagnosticResult.premiumDiscoverySignals?.queryKeywords.length ?? 0) ? "font-medium text-sky-700" : "text-slate-500"}>
                                          {i < (refineDiagnosticResult.premiumDiscoverySignals?.queryKeywords.length ?? 0) ? "↑ " : "  "}{q}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Premium discovery result + candidate URLs */}
                            {refineDiagnosticResult.premiumDiscoveryResult && (
                              <div className="overflow-x-auto rounded-lg border border-slate-200/70 bg-slate-50/80 p-3 font-mono text-[10px] text-slate-600">
                                <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-wide text-slate-400">premium discovery result</div>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                  <span className={`font-semibold ${
                                    refineDiagnosticResult.premiumDiscoveryResult.status === "success"
                                      ? "text-emerald-700"
                                      : refineDiagnosticResult.premiumDiscoveryResult.status === "skipped"
                                        ? "text-slate-400"
                                        : "text-rose-500"
                                  }`}>
                                    {refineDiagnosticResult.premiumDiscoveryResult.status}
                                  </span>
                                  <span>
                                    source:{" "}
                                    <span className={refineDiagnosticResult.premiumDiscoveryResult.source === "booking_premium_early_stop" ? "font-semibold text-amber-600" : "text-slate-600"}>
                                      {refineDiagnosticResult.premiumDiscoveryResult.source}
                                    </span>
                                  </span>
                                  <span>candidates: <span className="font-semibold text-slate-800">{refineDiagnosticResult.premiumDiscoveryResult.candidateCount}</span></span>
                                  <span className={refineDiagnosticResult.premiumDiscoveryResult.fallbackUsed ? "text-amber-600" : "text-emerald-600"}>
                                    fallback: {refineDiagnosticResult.premiumDiscoveryResult.fallbackUsed ? "true" : "false"}
                                  </span>
                                  <span className="text-slate-400">{refineDiagnosticResult.premiumDiscoveryResult.elapsedMs}ms</span>
                                </div>
                                {refineDiagnosticResult.premiumDiscoveryResult.candidateUrls.length > 0 && (
                                  <div className="mt-2 space-y-0.5 border-t border-slate-200/60 pt-2 text-[9px]">
                                    <div className="mb-0.5 text-slate-400">
                                      candidate_urls ({refineDiagnosticResult.premiumDiscoveryResult.candidateUrls.length}):
                                    </div>
                                    {refineDiagnosticResult.premiumDiscoveryResult.candidateUrls.slice(0, 8).map((url, i) => (
                                      <div key={i} className="flex items-start gap-1.5">
                                        <span className="shrink-0 text-slate-400">#{i + 1}</span>
                                        <a
                                          href={url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="break-all text-sky-700 underline decoration-dotted hover:text-sky-900"
                                        >
                                          {url.replace(/^https?:\/\/(?:www\.)?/, "").slice(0, 90)}
                                          {url.replace(/^https?:\/\/(?:www\.)?/, "").length > 90 ? "…" : ""}
                                        </a>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Premium extraction results */}
                            {refineDiagnosticResult.premiumExtractedComparables && (
                              <div className="overflow-x-auto rounded-lg border border-slate-200/70 bg-slate-50/80 p-3 font-mono text-[10px] text-slate-600">
                                <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-wide text-slate-400">premium extraction</div>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                  <span className={`font-semibold ${
                                    refineDiagnosticResult.premiumExtractedComparables.status === "ok"
                                      ? "text-emerald-700"
                                      : refineDiagnosticResult.premiumExtractedComparables.status === "all_failed"
                                        ? "text-rose-500"
                                        : "text-slate-400"
                                  }`}>
                                    {refineDiagnosticResult.premiumExtractedComparables.status}
                                  </span>
                                  <span>
                                    extracted: <span className="font-semibold text-slate-800">{refineDiagnosticResult.premiumExtractedComparables.extractedCount}</span>
                                  </span>
                                  {refineDiagnosticResult.premiumExtractedComparables.failedCount > 0 && (
                                    <span className="text-amber-600">
                                      failed: {refineDiagnosticResult.premiumExtractedComparables.failedCount}
                                    </span>
                                  )}
                                </div>

                                {refineDiagnosticResult.premiumExtractedComparables.comparables.length > 0 && (
                                  <div className="mt-2 space-y-1.5 border-t border-slate-200/60 pt-2">
                                    {refineDiagnosticResult.premiumExtractedComparables.comparables.map((c, i) => (
                                      <div key={i} className="rounded border border-slate-200/50 bg-white/60 px-2 py-1.5">
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[9px]">
                                          <span className="shrink-0 font-semibold text-slate-500">#{i + 1}</span>
                                          <span className={`font-semibold ${c.score >= 60 ? "text-emerald-700" : c.score >= 35 ? "text-amber-600" : "text-rose-500"}`}>
                                            score:{c.score}
                                          </span>
                                          {c.price !== null && (
                                            <span className="font-semibold text-slate-800">{c.price}€</span>
                                          )}
                                          {c.bedrooms !== null && (
                                            <span className="text-slate-500">{c.bedrooms}ch</span>
                                          )}
                                          {c.capacity !== null && (
                                            <span className="text-slate-500">{c.capacity}p</span>
                                          )}
                                          {c.propertyType && (
                                            <span className="text-slate-400">{c.propertyType.slice(0, 20)}</span>
                                          )}
                                        </div>
                                        {c.breakdown && (
                                          <div className="mt-0.5 flex flex-wrap gap-x-2 text-[9px] text-slate-400">
                                            <span>type:{c.breakdown.typeCompatibility ?? "—"}</span>
                                            <span>cap:{c.breakdown.capacityMatch ?? "—"}</span>
                                            <span>bed:{c.breakdown.bedroomMatch ?? "—"}</span>
                                            <span className={(c.breakdown.priceSegment ?? 0) < 0 ? "text-rose-500" : ""}>
                                              price:{c.breakdown.priceSegment ?? "—"}
                                            </span>
                                            <span>amenity:{c.breakdown.amenitiesMatch ?? "—"}</span>
                                          </div>
                                        )}
                                        <div className="mt-0.5 truncate text-[9px] text-slate-400">
                                          <a
                                            href={c.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sky-600 underline decoration-dotted hover:text-sky-800"
                                          >
                                            {c.url.replace(/^https?:\/\/(?:www\.)?/, "").slice(0, 80)}
                                          </a>
                                        </div>
                                        {c.title && (
                                          <div className="mt-0.5 truncate text-[9px] text-slate-500">{c.title.slice(0, 70)}</div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex w-full flex-col items-stretch gap-6 md:col-span-5 md:mt-0 md:max-w-none md:pl-0 xl:col-span-4 xl:pl-1">
          <div className={`relative min-w-0 overflow-hidden ${radiusCard} border border-l-4 border-emerald-200/80 border-l-emerald-500/75 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.08),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(236,253,245,0.95)_100%)] ${cardGlow} px-5 py-5 text-right ${shadowExecutive} shadow-[0_22px_60px_rgba(16,185,129,0.16),0_1px_0_rgba(255,255,255,0.7)_inset]`}>
            <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-slate-700">
              {copy.conversionLevel}
            </p>
            <p className={`mt-6 text-[15px] font-semibold tracking-tight md:text-[16px] ${scoreValueClass(
              overallScore
            )}`}>
              {overallScore.toFixed(1)}
              <span className="text-[13px] text-slate-700 md:text-[14px]"> / 10</span>
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-5 text-[8px]">
              <span
                className={`inline-flex items-center ${radiusPill} border px-2.5 py-1 font-semibold ${shadowMini} ${scoreLevelBadgeClass}`}
              >
                {overallScore < 4
                  ? copy.conversionFragile
                  : overallScore < 7
                  ? copy.conversionModerate
                  : copy.conversionStrong}
              </span>
            </div>
            <div className="mt-6 text-left text-[8px] font-medium uppercase tracking-[0.08em] text-slate-700">
              {copy.conversionScore}
            </div>
            <div className="mt-6 w-full rounded-full bg-slate-200/80">
              <div
                className={`h-2 rounded-full ${scoreBarColor}`}
                style={{ width: `${scorePercent}%` }}
              />
            </div>
            <div className="mt-2 text-sm text-muted-foreground leading-relaxed">
              <p className="whitespace-pre-line">{scoreSideCardNarrative}</p>
            </div>
          </div>

          <div className={`relative min-w-0 overflow-hidden ${radiusCard} border border-l-4 border-slate-200/80 border-l-teal-400/75 bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.10),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(241,245,249,0.94)_100%)] ${cardGlow} px-5 py-5 text-right ${shadowMini} shadow-[0_14px_40px_rgba(30,64,175,0.10),0_1px_0_rgba(255,255,255,0.66)_inset]`}>
            <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-slate-700">
              {copy.estimatedImpact}
            </p>
            <p
              className={`mt-6 text-[15px] font-semibold tracking-tight md:text-[16px] ${
                impactEstimatedSideShowPercent
                  ? "text-emerald-700"
                  : bookingLiftHigh > 0
                    ? "text-amber-800"
                    : "text-amber-700"
              }`}
            >
              {businessUiLowConfidenceGuardActive && !allowConversionOnlyRevenueProjection ? (
                "—"
              ) : impactEstimatedSideShowPercent ? (
                <>
                  {copy.ceiling}{" "}
                  <span className="text-emerald-700">+{bookingLiftHigh.toFixed(0)}%</span>
                </>
              ) : bookingLiftHigh > 0 ? (
                copy.impactToConfirm
              ) : bookingLiftSummary || impactSummary ? (
                copy.readingWithoutRange
              ) : (
                "—"
              )}
            </p>
            <div className="mt-6 text-left text-[8px] font-medium uppercase tracking-[0.08em] text-slate-700">
              {businessUiLowConfidenceGuardActive && !allowConversionOnlyRevenueProjection
                ? "Segment hors marché"
                : impactEstimatedSideShowPercent
                  ? "Réservations estimées après optimisation"
                  : bookingLiftHigh > 0
                    ? "Pourcentage chiffré après consolidation marché"
                    : "Réservations estimées après optimisation"}
            </div>
            <div className="mt-6 w-full rounded-full bg-slate-200/80">
              <div
                className={`h-2 rounded-full ${
                  impactEstimatedSideShowPercent ? potentialBarColor : "bg-slate-300/90"
                }`}
                style={{ width: `${impactEstimatedSideBarWidthPct}%` }}
              />
            </div>
            <div className="mt-2 text-sm text-muted-foreground leading-relaxed">
              <p className="whitespace-pre-line">{impactSideCardNarrative}</p>
            </div>
          </div>
        </div>
      </div>

      <section className={sectionShell}>
        <div className={sectionBody}>
          <div className="grid gap-7 xl:grid-cols-12">
            <div className={`nk-card nk-card-hover relative overflow-hidden ${radiusContainer} border border-l-4 border-slate-300/80 border-l-emerald-400/80 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_34%),linear-gradient(135deg,#ffffff_0%,#f8fafc_50%,#eef7f2_100%)] ${cardGlow} p-6 ${shadowStandard} xl:col-span-7 transition-shadow hover:shadow-[0_24px_64px_rgba(16,185,129,0.10)]`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <SectionDivider
                    eyebrow={copy.listingAnalysis}
                    title={copy.listingQuality}
                    description={copy.listingQualityDescription}
                  />

                  <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-slate-700">
                    {copy.globalConversionLevel}
                  </p>
                  <h2 className={sectionTitle}>
                    {scoreOverviewTitle}
                  </h2>
                  <p className={`${sectionIntro} whitespace-pre-line`}>
                    {scoreOverviewText}
                  </p>
                </div>
              </div>

              <div className="mt-7 grid gap-6 md:grid-cols-2 xl:grid-cols-3 auto-rows-fr">
                {subScoreCards.map((item) => (
                 <div
  key={item.label}
  className={`relative overflow-hidden ${radiusCard} border border-slate-200/65 ${metricSurfaceClass(item.value)} ${item.label === "Photos" ? "!bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(239,246,255,0.92)_100%)]" : item.label === "Ordre des photos" ? "!bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.14),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(238,242,255,0.92)_100%)]" : item.label === "Description" ? "!bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.14),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(245,243,255,0.92)_100%)]" : item.label === "Équipements" ? "!bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(236,253,245,0.92)_100%)]" : item.label === "SEO" ? "!bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.14),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(236,254,255,0.92)_100%)]" : "!bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.14),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,247,237,0.92)_100%)]"} ${cardGlow} ${shadowMini} border-l-4 ${item.label === "Photos" ? "border-l-blue-500/75" : item.label === "Ordre des photos" ? "border-l-indigo-500/75" : item.label === "Description" ? "border-l-violet-500/75" : item.label === "Équipements" ? "border-l-emerald-500/75" : item.label === "SEO" ? "border-l-cyan-500/75" : "border-l-orange-500/75"} p-5 min-h-[220px] flex flex-col justify-between ring-1 ring-white/70 transition-shadow hover:shadow-[0_20px_48px_rgba(15,23,42,0.10),0_1px_0_rgba(255,255,255,0.72)_inset]`}
>
                    <div className="flex items-start justify-between gap-4">
                      <p className={kpiLabel}>{item.displayLabel}</p>
                      <span className={`${pillBaseClass} shadow-[0_8px_18px_rgba(15,23,42,0.06)] ring-1 ring-white/55 ${scoreBadgeClass(item.value)}`}>
                        {item.value !== null ? `${item.value}/10` : copy.toConfirm}
                      </span>
                    </div>
                    <p className={`mt-6 hidden text-[12px] font-medium tracking-tight opacity-85 md:text-[13px] ${scoreValueClass(
                      item.value
                    )}`}>
                      {item.value !== null ? `${item.value}/10` : copy.toConfirm}
                    </p>
                    <div className={`mt-4 inline-flex w-fit items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${item.status.className}`}>
                      {item.status.label}
                      <span className="ml-1 normal-case tracking-normal opacity-80">• {item.status.detail}</span>
                    </div>

                    <p className="mt-4 text-[13px] leading-7 text-slate-700">
                      {item.value !== null ? item.note : item.fallback}
                    </p>

                    {"impact" in item && item.impact ? (
                      <div className="mt-4 rounded-2xl border border-white/70 bg-white/55 px-3 py-2 text-[11px] leading-5 text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
                        <p className="font-semibold text-slate-800">{item.impact}</p>
                        {"priority" in item && item.priority ? (
                          <p className="mt-1 text-slate-600">{item.priority}</p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className={`nk-card nk-card-hover relative overflow-hidden ${radiusContainer} border border-l-4 border-slate-200/80 border-l-sky-400/80 ${surfaceSlate} !bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.16),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(240,249,255,0.92)_100%)] ${cardGlow} p-6 ${shadowStandard} xl:col-span-5 self-start transition-shadow hover:shadow-[0_24px_64px_rgba(30,64,175,0.12)]`}>
              <SectionDivider
                eyebrow={copy.realMarket}
                title={copy.observedMarket}
                description={copy.observedMarketDescription}
              />

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <p className={cardTitle}>{copy.marketPositioningLabel}</p>
                {marketTierBadgeLabel ? (
                  <span className={marketTierBadgeClass}>{marketTierBadgeLabel}</span>
                ) : null}
              </div>
              <h2 className="mt-6 text-[16px] font-semibold tracking-[-0.02em] text-slate-900 md:text-[18px]">
                {copy.listingCompetitivePosition}
              </h2>
              <p className="mt-6 max-w-2xl text-[11px] leading-5 text-slate-800">
                {copy.competitiveSummary}
              </p>
              <div className="mt-6 grid gap-5">
                <div className={`min-w-0 overflow-hidden ${kpiCardMini} border border-l-4 border-slate-200/75 border-l-slate-400/75 !bg-[radial-gradient(circle_at_top_left,rgba(148,163,184,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(241,245,249,0.92)_100%)] shadow-[0_14px_34px_rgba(15,23,42,0.08),0_1px_0_rgba(255,255,255,0.68)_inset]`}>
                  <p className={kpiLabel}>
                    {copy.positioning}
                  </p>
                  <p
                    className={`mt-6 break-words text-[13px] font-semibold tracking-tight md:text-[14px] ${marketPositionHeadlineClass}`}
                  >
                    {marketPositionHeadlineText}
                  </p>
                  <p className="mt-6 text-[11px] leading-5 text-slate-700">
                    {positionnementNarrativeUi}
                  </p>
                  <p className="mt-6 text-[11px] leading-5 text-slate-700 line-clamp-2">
                    {benchmarkSupportTextUi}
                  </p>
                  <div className="mt-5 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2">
                      <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-500">{copy.listingScore}</p>
                      <p className="mt-1 text-[12px] font-semibold text-slate-900">{overallScore.toFixed(1)}/10</p>
                    </div>
                    <div className="rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2">
                      <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-500">{copy.market}</p>
                      <p className="mt-1 text-[12px] font-semibold text-slate-900">{scoreMarketValueDisplay}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2">
                      <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-500">{copy.base}</p>
                      <p className="mt-1 text-[12px] font-semibold text-slate-900">{comparablesKpiMainDisplay}</p>
                    </div>
                  </div>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className={`min-w-0 overflow-hidden ${kpiCardMini} border border-l-4 border-sky-200/75 border-l-sky-500/75 !bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.16),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(239,246,255,0.92)_100%)] shadow-[0_14px_34px_rgba(30,64,175,0.09),0_1px_0_rgba(255,255,255,0.68)_inset]`}>
                    <p className={kpiLabel}>
                      {copy.averageCompetitiveQuality}
                    </p>
                    <p className={`mt-6 text-[13px] font-semibold tracking-tight md:text-[14px] ${
                      !hasMarketData
                        ? "text-slate-600"
                        : marketAverageScore !== null
                          ? scoreValueClass(marketAverageScore)
                          : "text-amber-700"
                    }`}>
                      {scoreMarketValueDisplay}
                    </p>
                    <p className="mt-5 text-[13px] leading-7 text-slate-700">{marketScoreContextUi}</p>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200/70">
                      <div
                        className="h-full rounded-full bg-sky-500"
                        style={{ width: marketAverageScore !== null ? `${Math.max(0, Math.min(100, marketAverageScore * 10))}%` : "0%" }}
                      />
                    </div>
                  </div>
                  <div className={`min-w-0 overflow-hidden ${kpiCardMini} border border-l-4 border-emerald-200/75 border-l-emerald-500/75 !bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.15),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(236,253,245,0.9)_100%)] shadow-[0_14px_34px_rgba(16,185,129,0.10),0_1px_0_rgba(255,255,255,0.68)_inset]`}>
                    <p className={kpiLabel}>
                      {copy.comparablesAnalyzed}
                    </p>
                    <p
                      className={`mt-6 text-[13px] font-semibold tracking-tight md:text-[14px] ${comparablesKpiValueClass}`}
                    >
                      {comparablesKpiMainDisplay}
                    </p>
                    <p className="mt-6 line-clamp-3 text-[11px] leading-5 text-slate-700">
                      {comparablesKpiBodyText}
                    </p>
                    {hasMarketData ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="rounded-full border border-emerald-200 bg-white/70 px-2 py-1 text-[9px] font-semibold text-emerald-700">
                          {copy.localSegment}
                        </span>
                        <span className="rounded-full border border-emerald-200 bg-white/70 px-2 py-1 text-[9px] font-semibold text-emerald-700">
                          {copy.comparedPrices}
                        </span>
                        <span className="rounded-full border border-emerald-200 bg-white/70 px-2 py-1 text-[9px] font-semibold text-emerald-700">
                          {copy.consolidatedScore}
                        </span>
                      </div>
                    ) : null}
                    <div className="mt-6 border-t border-slate-200/80 pt-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                          {copy.marketReliability}:{" "}
                          <span className="tabular-nums text-slate-900">{marketConfidenceScore} %</span>
                        </p>
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.1em] shadow-[0_6px_14px_rgba(15,23,42,0.05)] ${marketConfidenceBadgeClass}`}
                        >
                          {marketConfidenceBadgeLabel}
                        </span>
                      </div>
                      {marketConfidenceBaseWording ? (
                        <p className="mt-2 text-[10px] leading-snug text-slate-600">
                      {marketConfidenceBaseWording}
                        </p>
                      ) : null}
                      {marketSourceLabel ? (
                        <p className="mt-1 text-[10px] leading-snug text-slate-700">
                          {marketSourceLabel}
                          {marketSourceMessage ? ` — ${marketSourceMessage}` : ""}
                        </p>
                      ) : null}
                      {marketConfidenceDispersionWording ? (
                        <p className="mt-1 text-[10px] leading-snug text-amber-900/90">
                          {marketConfidenceDispersionWording}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className={`mt-5 ${radiusCard} border border-l-4 border-slate-200/75 border-l-violet-500/75 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.10),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(245,243,255,0.92)_100%)] p-4 shadow-[0_16px_40px_rgba(15,23,42,0.06),0_1px_0_rgba(255,255,255,0.70)_inset]`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        {copy.prioritySummary}
                      </p>
                      <h3 className="mt-2 text-[14px] font-semibold tracking-[-0.02em] text-slate-900 md:text-[15px]">
                        {copy.topThreeLevers}
                      </h3>
                    </div>

                    <span className="inline-flex shrink-0 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.08em] text-violet-700">
                      {copy.actionable}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3">
                    <div className="rounded-2xl border border-white/70 bg-white/75 p-3">
                      <p className="text-[11px] font-semibold text-slate-900">
                        1. {copy.strengthenDescription}
                      </p>
                      <p className="mt-1 text-[10px] leading-5 text-slate-700">
                        {copy.marketPriorityDescriptionOne
                          .replace("{score}", descriptionQuality !== null ? `${descriptionQuality}/10` : copy.toConfirm)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/70 bg-white/75 p-3">
                      <p className="text-[11px] font-semibold text-slate-900">
                        2. {copy.improveSeo}
                      </p>
                      <p className="mt-1 text-[10px] leading-5 text-slate-700">
                        {copy.marketPriorityDescriptionTwo
                          .replace("{score}", seoStrength !== null ? `${seoStrength}/10` : copy.toConfirm)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/70 bg-white/75 p-3">
                      <p className="text-[11px] font-semibold text-slate-900">
                        3. {copy.preserveStrengths}
                      </p>
                      <p className="mt-1 text-[10px] leading-5 text-slate-700">
                        {copy.marketPriorityDescriptionThree
                          .replace("{photoScore}", photoQuality !== null ? `${photoQuality}/10` : copy.toConfirm)
                          .replace("{amenitiesScore}", amenitiesCompleteness !== null ? `${amenitiesCompleteness}/10` : copy.toConfirm)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            className={`nk-card nk-card-hover relative overflow-hidden ${radiusContainer} border border-l-4 border-slate-300/80 border-l-violet-500/75 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.11),transparent_34%),radial-gradient(circle_at_100%_0%,rgba(251,191,36,0.07),transparent_30%),linear-gradient(135deg,#ffffff_0%,#faf8ff_42%,#f4f2ff_100%)] ${cardGlow} p-6 ${shadowStandard} transition-shadow hover:shadow-[0_24px_64px_rgba(109,40,217,0.11)]`}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 space-y-1.5">
                <p className={cardTitle}>{copy.pricingPositioning}</p>
                <h2 className="text-[16px] font-semibold tracking-[-0.02em] text-slate-900 md:text-[18px]">
                  {pricingInsightForUi?.status === "UNDERPRICED"
                    ? copy.pricingOpportunity
                    : pricingInsightForUi?.status === "OPTIMAL"
                      ? copy.pricingAligned
                      : copy.pricingAboveMedian}
                </h2>
                {pricingInsightForUi ? (
                  <p className="text-[11px] font-medium tabular-nums text-slate-600">
                    {pricingInsightForUi.status === "UNDERPRICED"
                      ? "Tarif sous la médiane : "
                      : pricingInsightForUi.status === "OPTIMAL"
                        ? "Écart faible vs médiane : "
                        : "Tarif au-dessus de la médiane : "}
                    <span className="text-slate-900">
                      {pricingInsightForUi.priceDeltaPercent > 0 ? "+" : ""}
                      {(Math.round(pricingInsightForUi.priceDeltaPercent * 10) / 10).toLocaleString("fr-FR")} %
                    </span>
                  </p>
                ) : null}
              </div>
              {pricingInsightForUi ? (
                <span
                  className={`inline-flex shrink-0 items-center ${radiusPill} border px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] shadow-[0_8px_18px_rgba(15,23,42,0.07),0_1px_0_rgba(255,255,255,0.65)_inset] ${
                    pricingInsightForUi.status === "UNDERPRICED"
                      ? "border-emerald-200/90 bg-emerald-50/95 text-emerald-900"
                      : pricingInsightForUi.status === "OPTIMAL"
                        ? "border-slate-200/90 bg-white/90 text-slate-700"
                        : "border-amber-200/90 bg-amber-50/95 text-amber-950"
                  }`}
                >
                  {pricingInsightForUi.status === "UNDERPRICED"
                    ? copy.belowMedian
                    : pricingInsightForUi.status === "OPTIMAL"
                      ? copy.marketAligned
                      : copy.aboveMedian}
                </span>
              ) : null}
            </div>

            {pricingInsightForUi ? (
              <>
                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  <div
                    className={`min-w-0 overflow-hidden ${kpiCardMini} border border-l-4 border-violet-200/75 border-l-violet-500/75 !bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(245,243,255,0.92)_100%)] shadow-[0_14px_34px_rgba(109,40,217,0.09),0_1px_0_rgba(255,255,255,0.68)_inset]`}
                  >
                    <p className={kpiLabel}>{copy.observedMedian}</p>
                    <p className="mt-6 text-[13px] font-semibold tabular-nums tracking-tight text-slate-950 md:text-[14px]">
                      {formatAuditPricingAmount(pricingInsightForUi.medianPrice)}
                    </p>
                  </div>
                  <div
                    className={`min-w-0 overflow-hidden ${kpiCardMini} border border-l-4 border-indigo-200/75 border-l-indigo-500/75 !bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(238,242,255,0.92)_100%)] shadow-[0_14px_34px_rgba(79,70,229,0.09),0_1px_0_rgba(255,255,255,0.68)_inset]`}
                  >
                    <p className={kpiLabel}>{copy.recommendedPrice}</p>
                    <p className="mt-6 text-[13px] font-semibold tabular-nums tracking-tight text-slate-950 md:text-[14px]">
                      {formatAuditPricingAmount(pricingInsightForUi.recommendedPrice)}
                    </p>
                  </div>
                  <div
                    className={`min-w-0 overflow-hidden ${kpiCardMini} border border-l-4 border-emerald-200/75 border-l-emerald-500/75 !bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(236,253,245,0.92)_100%)] shadow-[0_14px_34px_rgba(16,185,129,0.09),0_1px_0_rgba(255,255,255,0.68)_inset]`}
                  >
                    <p className={kpiLabel}>
                      {pricingMonthlyImpactRounded > 0
                        ? copy.potentialMonthlyGain
                        : pricingMonthlyImpactRounded < 0
                          ? copy.estimatedMonthlyRisk
                          : copy.estimatedMonthlyImpact}
                    </p>
                    <p
                      className={`mt-6 text-[13px] font-semibold tabular-nums tracking-tight md:text-[14px] ${
                        pricingMonthlyImpactRounded > 0
                          ? "text-emerald-800"
                          : pricingMonthlyImpactRounded < 0
                            ? "text-rose-700"
                            : "text-slate-800"
                      }`}
                    >
                      {pricingMonthlyImpactLabel}
                    </p>
                    <p className="mt-2 text-[9px] font-medium uppercase tracking-[0.1em] text-slate-500">
                      {copy.pricingAssumption}
                    </p>
                  </div>
                </div>
                <p
                  className={`mt-5 rounded-2xl border border-slate-200/75 bg-white/75 p-3.5 text-[11px] leading-5 text-slate-800 shadow-[0_10px_24px_rgba(15,23,42,0.05),0_1px_0_rgba(255,255,255,0.68)_inset]`}
                >
                  {pricingInsightForUi.status === "UNDERPRICED"
                    ? `Votre tarif ressort ${Math.abs(Math.round(pricingInsightForUi.priceDeltaPercent * 10) / 10).toLocaleString("fr-FR")} % sous la médiane observée. Une hausse progressive vers le prix conseillé peut améliorer le revenu sans sortir brutalement du segment concurrentiel analysé.`
                    : pricingInsightForUi.status === "OPTIMAL"
                      ? `Votre tarif est proche de la médiane observée (${(Math.round(pricingInsightForUi.priceDeltaPercent * 10) / 10).toLocaleString("fr-FR")} %). Le levier principal n’est pas une forte hausse prix, mais plutôt l’amélioration de conversion et de présentation.`
                      : `Votre tarif ressort ${Math.abs(Math.round(pricingInsightForUi.priceDeltaPercent * 10) / 10).toLocaleString("fr-FR")} % au-dessus de la médiane observée. Le prix peut devenir un frein si les signaux de qualité ne justifient pas clairement cet écart.`}
                </p>
                {isMarketWeak ? (
                  <p className="mt-3 text-[10px] leading-snug text-slate-600">
                    {marketIndicativeLabel} — interpréter le positionnement tarifaire avec prudence tant que la base locale reste limitée.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="mt-5 text-[11px] leading-5 text-slate-500">
                {suppressZeroComparableMarketUi
                  ? copy.insufficientComparablePricing
                  : copy.insufficientPricingData}
              </p>
            )}
          </div>

          <div className={`nk-card nk-card-hover relative overflow-hidden ${radiusContainer} border border-l-4 border-slate-300/80 border-l-slate-800/85 bg-[radial-gradient(circle_at_top_left,rgba(15,23,42,0.12),transparent_34%),radial-gradient(circle_at_92%_18%,rgba(99,102,241,0.12),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.13),transparent_28%),linear-gradient(135deg,#ffffff_0%,#f8fafc_42%,#eef4f3_100%)] ${cardGlow} p-6 ${shadowExecutive}`}>
            <div className="grid gap-5 md:grid-cols-12 md:items-start">
              <div className={`flex min-h-[250px] flex-col justify-between space-y-5 ${radiusCard} border border-l-4 border-slate-200/75 border-l-slate-700/75 bg-[radial-gradient(circle_at_top_left,rgba(15,23,42,0.08),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.08),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.86)_0%,rgba(248,250,252,0.66)_100%)] p-4 shadow-[0_16px_40px_rgba(15,23,42,0.07),0_1px_0_rgba(255,255,255,0.70)_inset] md:col-span-5 xl:col-span-5 xl:max-w-xl`}>
                <p className="nk-kicker-muted inline-flex w-fit rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.06),0_1px_0_rgba(255,255,255,0.65)_inset]">
                  {copy.iqaBusinessIndicator}
                </p>
                <div className="flex flex-wrap items-baseline gap-5">
                  <h2 className="text-[14px] font-semibold tracking-tight text-slate-950 md:text-[16px]">
                    {copy.iqaPerceivedListingQuality}
                  </h2>
                  <span
                    className={`inline-flex items-center ${radiusPill} px-3 py-1 text-[8px] font-semibold uppercase tracking-[0.1em] ${shadowMini} ${
                      lqiScore !== null && lqiScore >= 75
                        ? "border border-emerald-200/85 bg-emerald-50/90 text-emerald-700"
                        : lqiScore !== null && lqiScore >= 55
                          ? "border border-emerald-300/90 bg-emerald-50/95 text-emerald-700"
                          : "border border-rose-200/85 bg-rose-50/90 text-rose-700"
                    }`}
                  >
                    {listingQualityIndex?.label ? lqiLabelText(listingQualityIndex.label, copy) : lqiLabelDisplay}
                  </span>
                </div>
                <p className={`rounded-2xl border border-slate-200/75 bg-white/70 p-3 text-[11px] leading-5 text-slate-700 shadow-[0_12px_28px_rgba(15,23,42,0.055),0_1px_0_rgba(255,255,255,0.68)_inset]`}>
                  {lqiSummaryText}
                </p>
              </div>

              <div className="mt-6 flex min-w-0 flex-col justify-center md:col-span-7 md:mt-0 md:max-w-none xl:col-span-7">
                <div className={`relative min-w-0 overflow-hidden ${radiusCard} border border-slate-700/70 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(148,163,184,0.18),transparent_28%),linear-gradient(180deg,#0f172a_0%,#1e293b_54%,#263449_100%)] bg-clip-padding ring-1 ring-white/10 before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:bg-[linear-gradient(180deg,rgba(255,255,255,0.18),transparent)] after:pointer-events-none after:absolute after:inset-x-6 after:top-0 after:h-px after:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.34),transparent)] px-7 py-8 text-right text-slate-50 ${shadowExecutive}`}>
                  <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-slate-200">
                    {copy.iqaReading}
                  </p>
                  <p className="mt-8 break-words text-[34px] font-semibold leading-none md:text-[44px]">
                    {lqiScore !== null ? (
                      <>
                        <span className={lqiScore >= 75 ? "text-emerald-300" : lqiScore >= 55 ? "text-amber-300" : "text-rose-300"}>
                          {lqiScore}
                        </span>
                        <span className="text-[18px] text-slate-300 md:text-[22px]"> / 100</span>
                      </>
                    ) : (
                      <span className="text-[14px] text-amber-300">{lqiScoreDisplay}</span>
                    )}
                  </p>
                  {lqiScore !== null && (
                    <p className="mt-6 max-w-[30rem] text-left text-[12px] leading-6 text-slate-300/95 md:text-right md:ml-auto">
                      {lqiScoreIsNativeIqa
                        ? lqiScore >= 80
                          ? copy.iqaNarrativePremium
                          : lqiScore >= 60
                            ? copy.iqaNarrativeCompetitive
                            : copy.iqaNarrativeFragile
                        : copy.iqaNarrativeRebuilt}
                    </p>
                  )}
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
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-slate-700">
                    {copy.pricingBenchmarks}
                  </p>
                  {marketTierBadgeLabel ? (
                    <span className={marketTierBadgeClass}>{marketTierBadgeLabel}</span>
                  ) : null}
                </div>
                <p className="mt-6 text-[15px] font-semibold tracking-[-0.02em] text-slate-900 md:text-[17px]">
                  {copy.pricingBenchmarksTitle}
                </p>
                <p className="mt-3 max-w-2xl text-[12px] font-semibold tracking-tight text-slate-900">
                  {marketReliabilityTitle}
                </p>
                <p className="mt-2 max-w-2xl text-[11px] leading-5 text-slate-700">
                  {marketReliabilityMessage}
                </p>
                <p className="mt-6 max-w-2xl text-[11px] leading-5 text-slate-800">
                  {copy.pricingBenchmarks} issus du prix moyen observé et de l’écart estimé avec le marché comparable.
                </p>
              </div>
            </div>

            <div className="mt-5 grid items-stretch gap-5 md:grid-cols-2">
              <div className={`${kpiCard} border border-l-4 border-amber-200/75 border-l-amber-500/75 !bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.14),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,251,235,0.92)_100%)] shadow-[0_14px_34px_rgba(180,83,9,0.09),0_1px_0_rgba(255,255,255,0.68)_inset]`}>
                <p className={kpiLabel}>
                  {copy.averageCompetitorPrice}
                </p>
                <p className={`${kpiValue} ${!hasMarketData ? "text-slate-600" : "text-amber-700"}`}>
                  {avgCompetitorPriceDisplay}
                </p>
                <p className={kpiBody}>{avgCompetitorPriceSupport}</p>
              </div>
              <div className={`${kpiCard} border border-l-4 border-orange-200/75 border-l-rose-400/75 !bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.14),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,241,242,0.92)_100%)] shadow-[0_14px_34px_rgba(244,63,94,0.08),0_1px_0_rgba(255,255,255,0.68)_inset] ${
  !hasMarketData
    ? surfaceWarning
    : priceDeltaPercentResolved === null
    ? surfaceWarning
    : priceDeltaPercentResolved > 0
    ? surfacePositive
    : priceDeltaPercentResolved < 0
    ? surfaceCriticalSoft
    : surfaceWarning
}`}>
                <p className={kpiLabel}>
                  {copy.priceGapVsMarket}
                </p>
                <p
                  className={`${
                    !hasMarketData || priceDeltaPercentResolved !== null
                      ? kpiValue
                      : "text-[11px] font-semibold leading-snug text-amber-800 md:text-[12px]"
                  } ${
                    !hasMarketData
                      ? "text-slate-600"
                      : priceDeltaPercentResolved !== null
                        ? (priceDeltaPercentResolved ?? 0) > 0
                          ? "text-emerald-700"
                          : (priceDeltaPercentResolved ?? 0) < 0
                            ? "text-rose-700"
                            : "text-amber-700"
                        : ""
                  }`}
                >
                  {!hasMarketData ? (
                    copy.notReliable
                  ) : priceDeltaPercentResolved !== null ? (
                    <>
                      {priceDeltaPercentResolved > 0 ? "+" : ""}
                      {priceDeltaPercentResolved.toFixed(0)}%
                    </>
                  ) : isMarketWeak ? (
                    marketIndicativeLabel
                  ) : (
                    priceDeltaDisplay
                  )}
                </p>
                <p className={kpiBody}>
                  {!hasMarketData
                    ? copy.marketAnalysisPending
                    : priceDeltaPercentResolved !== null
                      ? `${marketPricePositionText}${priceDeltaIndicativeText ? ` ${priceDeltaIndicativeText}` : ""}`
                      : isMarketWeak
                        ? marketIndicativeLabel
                        : "Dès qu’un tarif annoncé et un repère marché fiable sont consolidés, un pourcentage d’écart pourra être affiché ici."}
                </p>
              </div>
            </div>

          </div>

          <div className={`nk-card nk-card-hover relative overflow-hidden ${radiusContainer} border !border-l-[5px] border-emerald-200/85 !border-l-emerald-600 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.24),transparent_38%),radial-gradient(circle_at_90%_12%,rgba(14,165,233,0.16),transparent_30%),linear-gradient(135deg,#ecfdf5_0%,#f0f9ff_52%,#dffbea_100%)] ${cardGlow} p-5 ${shadowExecutive}`}>
            <div className="flex flex-col gap-5">
              <div className="max-w-2xl">
                <SectionDivider
                  eyebrow={copy.businessProjection}
                  title={copy.projectionsPotential}
                  description={copy.projectionsDescription}
                />

                <p className="mt-5 text-[8px] font-semibold uppercase tracking-[0.16em] text-slate-700">
                  {copy.estimatedImpact} sur les réservations
                </p>
                <h2 className="mt-6 text-[14px] font-semibold tracking-tight text-slate-900 md:text-[16px]">
                  {businessUiLowConfidenceGuardActive
                    ? copy.qualitativeAnalysisOnly
                    : copy.businessPotentialAfterOptimization}
                </h2>
                <p className="mt-6 text-[11px] leading-5 text-slate-800">
                  {impactBusinessBlockIntro}
                </p>
              </div>
            </div>

            <div className="mt-6 grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-4">
              <div className={`nk-card nk-card-hover relative overflow-hidden ${radiusCard} border !border-l-[5px] border-amber-200/85 !border-l-amber-600 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.42),transparent_42%),linear-gradient(180deg,#fde68a_0%,#fcd34d_100%)] ${cardGlow} ${shadowMini} p-4 flex h-full flex-col justify-between ring-1 ring-white/60 transition-shadow hover:shadow-[0_18px_44px_rgba(180,83,9,0.10),0_1px_0_rgba(255,255,255,0.68)_inset]`}>
                <p className={kpiLabel}>
                  {copy.nightlyPrice}
                </p>
                <div className="space-y-2">
                  <p className={kpiValue}>{currentPriceDisplay}</p>

                  
                  <div className="mt-3">

                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                      priceDeltaPercentResolved !== null && priceDeltaPercentResolved > 8
                        ? "border-rose-300 bg-rose-50 text-rose-700"
                        : priceDeltaPercentResolved !== null && priceDeltaPercentResolved < -8
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : "border-amber-300 bg-amber-50 text-amber-700"
                    }`}
                  >
                    {priceDeltaPercentResolved !== null && priceDeltaPercentResolved > 8
                      ? copy.premiumPosition
                      : priceDeltaPercentResolved !== null && priceDeltaPercentResolved < -8
                        ? copy.aggressivePosition
                        : copy.balancedPosition}
                  </span>
                </div>

                <p className={kpiBody}>
                  {currentPriceContext}
                </p>
                </div>
              </div>

              <div className={`nk-card nk-card-hover relative overflow-hidden ${radiusCard} border !border-l-[5px] border-sky-200/85 !border-l-sky-600 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.34),transparent_42%),linear-gradient(180deg,#e0f2fe_0%,#bae6fd_100%)] ${cardGlow} ${shadowMini} p-4 flex h-full flex-col justify-between ring-1 ring-white/60 transition-shadow hover:shadow-[0_18px_44px_rgba(14,165,233,0.10),0_1px_0_rgba(255,255,255,0.68)_inset]`}>
                <p className={kpiLabel}>
                  {copy.projectionBase}
                </p>
                <p className={`${kpiValue} ${!hasMarketData ? "text-slate-600" : ""}`}>
                  {scoreMarketValueDisplay}
                </p>
                <div className="mt-3">
                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                      robustCrossPlatformMarket
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700 shadow-[0_0_0_1px_rgba(16,185,129,0.08)_inset]"
                        : marketConfidenceLevel === "high"
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700 shadow-[0_0_0_1px_rgba(16,185,129,0.08)_inset]"
                        : marketConfidenceLevel === "medium"
                          ? "border-amber-300 bg-amber-50 text-amber-700 shadow-[0_0_0_1px_rgba(245,158,11,0.08)_inset]"
                          : "border-rose-300 bg-rose-50 text-rose-700 shadow-[0_0_0_1px_rgba(244,63,94,0.08)_inset]"
                    }`}
                  >
                    {robustCrossPlatformMarket
                      ? copy.crossPlatformReading
                      : marketConfidenceLevel === "high"
                        ? copy.readableMarket
                      : marketConfidenceLevel === "medium"
                        ? copy.cautiousReading
                        : copy.lowVisibility}
                  </span>
                </div>

                <p className={kpiBody}>
                  {!hasMarketData
                    ? "Aucun comparable suffisamment cohérent pour établir une moyenne concurrentielle exploitable."
                    : marketConfidenceLevel === "high"
                      ? `Base concurrentielle robuste construite sur ${marketComparableDisplayCount} annonces comparables.`
                      : marketConfidenceLevel === "medium"
                        ? `Benchmark partiel basé sur ${marketComparableDisplayCount} comparables utilisables.`
                        : "Le marché détecté reste trop instable pour fournir un benchmark concurrentiel fiable."}
                </p>
              </div>

              <div className={`nk-card nk-card-hover relative overflow-hidden ${radiusCard} border !border-l-[5px] border-emerald-200/85 !border-l-emerald-600 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.34),transparent_42%),linear-gradient(180deg,#d1fae5_0%,#a7f3d0_100%)] ${cardGlow} ${shadowEmphasis} p-4 flex h-full flex-col justify-between ring-1 ring-white/60 transition-shadow hover:shadow-[0_20px_48px_rgba(16,185,129,0.12),0_1px_0_rgba(255,255,255,0.68)_inset]`}>
                <p className={kpiLabel}>
                  {copy.conversionGainPotential}
                </p>
                <p className={kpiValue}>{bookingLiftPercentValueDisplay}</p>
                <div className="mt-3">
                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                      robustCrossPlatformMarket
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : marketConfidenceLevel === "high" && !robustCrossPlatformMarket
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : businessUiLowConfidenceGuardActive
                          ? "border-slate-300 bg-slate-100 text-slate-600"
                          : "border-amber-300 bg-amber-50 text-amber-700"
                    }`}
                  >
                    {robustCrossPlatformMarket
                      ? copy.crossPlatformReading
                      : marketConfidenceLevel === "high" && !robustCrossPlatformMarket
                      ? copy.actionableProjection
                      : businessUiLowConfidenceGuardActive && !allowConversionOnlyRevenueProjection
                        ? copy.limitedProjection
                        : allowConversionOnlyRevenueProjection
                          ? copy.cautiousProjection
                          : copy.indicativeProjection}
                  </span>
                </div>

                <p className={kpiBody}>
                  {businessUiLowConfidenceGuardActive && !allowConversionOnlyRevenueProjection
                    ? "Le niveau de confiance marché reste insuffisant pour projeter un gain de conversion crédible."
                    : allowConversionOnlyRevenueProjection
                      ? "Projection basée sur le score de conversion et le prix actuel, sans benchmark tarifaire concurrentiel fiable."
                      : bookingLiftCardBody}
                </p>
              </div>

              <div className={`nk-card nk-card-hover relative overflow-hidden ${radiusCard} border !border-l-[5px] border-indigo-200/85 !border-l-indigo-600 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.34),transparent_42%),linear-gradient(180deg,#e0e7ff_0%,#c7d2fe_100%)] ${cardGlow} ${shadowMini} p-4 flex h-full flex-col justify-between ring-1 ring-white/60 transition-shadow hover:shadow-[0_18px_44px_rgba(79,70,229,0.10),0_1px_0_rgba(255,255,255,0.68)_inset]`}>
                <p className={kpiLabel}>
                  {copy.estimatedMonthlyGainTitle}
                </p>
                <p
                  className={`${
                    heroMonthlyGainToneStrong
                      ? kpiValue
                      : showMonthlyGainKpi
                        ? kpiValue
                        : "text-[13px] font-semibold leading-snug text-amber-800 md:text-[14px]"
                  } ${
                    heroMonthlyGainToneStrong
                      ? "text-emerald-700"
                      : showMonthlyGainKpi
                        ? "text-amber-800"
                        : ""
                  }`}
                >
                  {revenueImpactRangeDisplay}
                </p>
                <p className={kpiBody}>
                  {businessUiLowConfidenceGuardActive && !allowConversionOnlyRevenueProjection
                    ? "Comparables hors segment — aucune projection de gain applicable pour ce marché."
                    : allowConversionOnlyRevenueProjection
                      ? copy.cautiousProjection
                      : !hasMarketData
                        ? "Estimation indisponible — données marché insuffisantes. Une fourchette chiffrée exploitable nécessite un prix annoncé fiable et un repère concurrent consolidé."
                        : monthlyOptimizedRevenueBandDisplayable
                        ? "Estimation indicative basée sur le prix conseillé, le niveau du marché observé et une occupation cible réaliste."
                        : monthlyGainBusinessModelReady
                          ? "Repère prudent : vérifiez volumétrie de réservations et comparables avant d’investir durablement sur le prix."
                          : "Une estimation chiffrée nécessite un prix annoncé cohérent et un niveau de marché observé consolidé."}
                </p>
                {monthlyGainHypothesisLine ? (
                  <p className="mt-2 text-[10px] leading-snug text-slate-600">{monthlyGainHypothesisLine}</p>
                ) : null}
                {monthlyGainQualifierLine ? (
                  <p className="mt-2 text-[10px] font-medium leading-snug text-amber-900/85">
                    {monthlyGainQualifierLine}
                  </p>
                ) : null}
                {hasMarketData && revenueImpactSummary && !businessUiLowConfidenceGuardActive ? (
                  <p className="mt-2 text-[11px] leading-5 text-slate-700">{revenueImpactSummary}</p>
                ) : null}
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
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-slate-700">
                      {copy.optimizedTexts}
                    </p>

                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-extrabold text-slate-950 shadow-sm">
                      {copy.variant} {currentAiVariantIndex} · {AI_VARIANT_LABELS[(((currentAiVariantIndex - 1) % AI_VARIANT_LABELS.length) + AI_VARIANT_LABELS.length) % AI_VARIANT_LABELS.length]}
                    </span>
                  </div>
                  <p className="mt-6 text-[11px] leading-5 text-slate-800">
                    Proposition assemblée à partir de votre annonce et des signaux du rapport via des modèles de texte locaux (pas d’appel à un modèle distant sur cet écran). À ajuster selon votre marque.
                  </p>
                  <p className="mt-4 text-[10px] font-medium tracking-[0.04em] text-slate-500">
                    {copy.variant} {currentAiVariantIndex} / {aiDescriptionVariants.length}
                  </p>
                </div>

                <div className="relative flex flex-wrap items-center gap-2 sm:gap-3 lg:col-span-5 lg:justify-end xl:col-span-4">
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
                    aria-label={copy.copyMainDescription}
                    onClick={handleCopyAiDescription}
                    className={aiCardCopyButtonClass}
                  >
                    <svg aria-hidden="true" className="h-3 w-3" viewBox="0 0 16 16" fill="none">
                      <path d="M5.5 5.5H4.25A1.25 1.25 0 0 0 3 6.75v5A1.25 1.25 0 0 0 4.25 13h5A1.25 1.25 0 0 0 10.5 11.75V10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      <path d="M6.25 3h5.5C12.44 3 13 3.56 13 4.25v5.5C13 10.44 12.44 11 11.75 11h-5.5C5.56 11 5 10.44 5 9.75v-5.5C5 3.56 5.56 3 6.25 3Z" stroke="currentColor" strokeWidth="1.4" />
                    </svg>
                    {copyToastKey === "main" ? copy.copied : copy.copyAction}
                  </button>
                  <button
                    type="button"
                    onClick={handleNextAiVariant}
                    className={`inline-flex min-h-[28px] min-w-[96px] sm:min-w-[108px] shrink-0 items-center justify-center whitespace-nowrap appearance-none outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ${radiusPill} border border-amber-200/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,251,235,0.96))] px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] leading-none text-slate-800 shadow-[0_10px_22px_rgba(180,83,9,0.06),0_1px_0_rgba(255,255,255,0.62)_inset]`}
                  >
                    {copy.changeVariant}
                  </button>
                  {copyToastKey === "main" && (
                    <div className="pointer-events-none absolute right-0 top-full z-10 mt-2">
                      <div className={`inline-flex items-center ${radiusPill} border border-slate-200/80 bg-white/95 px-3 py-1.5 text-[10px] font-medium tracking-[0.04em] text-slate-700 shadow-[0_12px_26px_rgba(15,23,42,0.08)] backdrop-blur-sm`}>
                        {copy.descriptionCopied}
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
                        {copy.currentTitle}
                      </p>
                      <p className={`mt-6 break-words ${detailCardTitle}`}>
                        {listing?.title || "Aucun titre n’est disponible pour cette annonce."}
                      </p>
                    </div>

                    <div className={`flex h-full min-w-0 overflow-hidden flex-col ${detailInnerCard} border-l-4 !border-emerald-200/75 !border-l-emerald-500/75 !bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_40%),linear-gradient(180deg,#ecfdf5_0%,#d1fae5_100%)]`}>
                      <div className="flex items-start justify-between gap-3">
                        <p className={detailCardLabel}>
                          {copy.optimizedTitleExample}
                        </p>

                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(optimizedTitleExample);
                            setCopyToastKey("optimized-title");
                            window.setTimeout(() => {
                              setCopyToastKey((current) =>
                                current === "optimized-title" ? null : current
                              );
                            }, 1600);
                          }}
                          className={aiCardCopyButtonClass}
                          aria-label={copy.copyOptimizedTitle}
                        >
                          <svg aria-hidden="true" className="h-3 w-3" viewBox="0 0 16 16" fill="none">
                            <path d="M5.5 5.5H4.25A1.25 1.25 0 0 0 3 6.75v5A1.25 1.25 0 0 0 4.25 13h5A1.25 1.25 0 0 0 10.5 11.75V10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                            <path d="M6.25 3h5.5C12.44 3 13 3.56 13 4.25v5.5C13 10.44 12.44 11 11.75 11h-5.5C5.56 11 5 10.44 5 9.75v-5.5C5 3.56 5.56 3 6.25 3Z" stroke="currentColor" strokeWidth="1.4" />
                          </svg>

                          {copyToastKey === "optimized-title" ? copy.copied : copy.copyAction}
                        </button>
                      </div>

                      <p className={`mt-6 break-words ${detailCardTitle}`}>
                        {optimizedTitleExample}
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
                  placeholder="La proposition de texte apparaîtra ici dès que les données d’annonce et d’audit seront disponibles."
                  className="h-auto max-h-[260px] w-full resize-none overflow-y-auto bg-transparent pr-2 text-[11px] leading-5 text-slate-900 outline-none placeholder:text-slate-500 [scrollbar-color:rgba(245,158,11,0.72)_rgba(254,243,199,0.78)] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-amber-100/70 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-amber-400/70 hover:[&::-webkit-scrollbar-thumb]:bg-amber-500/80"
                />
              </div>

              {aiOutputPlatform === "airbnb" ? (
              <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-5">
                <div className={`relative h-[280px] min-w-0 overflow-hidden ${radiusCard} border border-l-4 border-amber-200/70 border-l-amber-500/75 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.14),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,247,237,0.92)_100%)] ${cardGlow} px-3.5 py-3 ${shadowMini} ring-1 ring-white/60`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-slate-700">
                      {copy.myPlace}
                    </p>
                    <button
                      type="button"
                      aria-label={copy.copyHousing}
                      onClick={() => handleCopyAiSection("logement", currentAiVariant.logement)}
                      className={aiCardCopyButtonClass}
                    >
                      <svg aria-hidden="true" className="h-3 w-3" viewBox="0 0 16 16" fill="none">
                      <path d="M5.5 5.5H4.25A1.25 1.25 0 0 0 3 6.75v5A1.25 1.25 0 0 0 4.25 13h5A1.25 1.25 0 0 0 10.5 11.75V10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      <path d="M6.25 3h5.5C12.44 3 13 3.56 13 4.25v5.5C13 10.44 12.44 11 11.75 11h-5.5C5.56 11 5 10.44 5 9.75v-5.5C5 3.56 5.56 3 6.25 3Z" stroke="currentColor" strokeWidth="1.4" />
                    </svg>
                      {copyToastKey === "logement" ? copy.copied : copy.copyAction}
                    </button>
                  </div>
                  <div className={aiScrollAmber}>
                    {currentAiVariant.logement || "Installez-vous dans un logement confortable, facile à vivre et pensé pour rendre chaque moment du séjour plus simple."}
                  </div>
                </div>

                <div className={`relative h-[280px] min-w-0 overflow-hidden ${radiusCard} border border-l-4 border-indigo-200/70 border-l-indigo-500/75 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.14),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(238,242,255,0.92)_100%)] ${cardGlow} px-3.5 py-3 ${shadowMini} ring-1 ring-white/60`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-slate-700">
                      {copy.detailedPlace}
                    </p>
                    <button
                      type="button"
                      aria-label={copy.copyDetailedHousing}
                      onClick={() => handleCopyAiSection("logementDetaille", currentAiVariant.logementDetaille)}
                      className={aiCardCopyButtonClass}
                    >
                      <svg aria-hidden="true" className="h-3 w-3" viewBox="0 0 16 16" fill="none">
                      <path d="M5.5 5.5H4.25A1.25 1.25 0 0 0 3 6.75v5A1.25 1.25 0 0 0 4.25 13h5A1.25 1.25 0 0 0 10.5 11.75V10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      <path d="M6.25 3h5.5C12.44 3 13 3.56 13 4.25v5.5C13 10.44 12.44 11 11.75 11h-5.5C5.56 11 5 10.44 5 9.75v-5.5C5 3.56 5.56 3 6.25 3Z" stroke="currentColor" strokeWidth="1.4" />
                    </svg>
                      {copyToastKey === "logementDetaille" ? copy.copied : copy.copyAction}
                    </button>
                  </div>
                  <div className={aiScrollIndigo}>
                    {currentAiVariant.logementDetaille || "Le logement offre une expérience complète, avec des espaces lisibles, des équipements utiles et une atmosphère agréable pour profiter du séjour."}
                  </div>
                </div>

                <div className={`relative h-[280px] min-w-0 overflow-hidden ${radiusCard} border border-l-4 border-sky-200/70 border-l-sky-500/75 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.14),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(240,249,255,0.92)_100%)] ${cardGlow} px-3.5 py-3 ${shadowMini} ring-1 ring-white/60`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-slate-700">
                      {copy.guestAccess}
                    </p>
                    <button
                      type="button"
                      aria-label={copy.copyGuestAccess}
                      onClick={() => handleCopyAiSection("acces", currentAiVariant.acces)}
                      className={aiCardCopyButtonClass}
                    >
                      <svg aria-hidden="true" className="h-3 w-3" viewBox="0 0 16 16" fill="none">
                      <path d="M5.5 5.5H4.25A1.25 1.25 0 0 0 3 6.75v5A1.25 1.25 0 0 0 4.25 13h5A1.25 1.25 0 0 0 10.5 11.75V10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      <path d="M6.25 3h5.5C12.44 3 13 3.56 13 4.25v5.5C13 10.44 12.44 11 11.75 11h-5.5C5.56 11 5 10.44 5 9.75v-5.5C5 3.56 5.56 3 6.25 3Z" stroke="currentColor" strokeWidth="1.4" />
                    </svg>
                      {copyToastKey === "acces" ? copy.copied : copy.copyAction}
                    </button>
                  </div>
                  <div className={aiScrollSky}>
                    {currentAiVariant.acces || "Les voyageurs profitent d’un accès simple au logement, aux espaces prévus pour le séjour et aux équipements utiles au quotidien."}
                  </div>
                </div>

                <div className={`relative h-[280px] min-w-0 overflow-hidden ${radiusCard} border border-l-4 border-emerald-200/70 border-l-emerald-500/75 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(236,253,245,0.92)_100%)] ${cardGlow} px-3.5 py-3 ${shadowMini} ring-1 ring-white/60`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-slate-700">
                      {copy.guestInteraction}
                    </p>
                    <button
                      type="button"
                      aria-label={copy.copyGuestInteraction}
                      onClick={() => handleCopyAiSection("echanges", currentAiVariant.echanges)}
                      className={aiCardCopyButtonClass}
                    >
                      <svg aria-hidden="true" className="h-3 w-3" viewBox="0 0 16 16" fill="none">
                      <path d="M5.5 5.5H4.25A1.25 1.25 0 0 0 3 6.75v5A1.25 1.25 0 0 0 4.25 13h5A1.25 1.25 0 0 0 10.5 11.75V10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      <path d="M6.25 3h5.5C12.44 3 13 3.56 13 4.25v5.5C13 10.44 12.44 11 11.75 11h-5.5C5.56 11 5 10.44 5 9.75v-5.5C5 3.56 5.56 3 6.25 3Z" stroke="currentColor" strokeWidth="1.4" />
                    </svg>
                      {copyToastKey === "echanges" ? copy.copied : copy.copyAction}
                    </button>
                  </div>
                  <div className={aiScrollEmerald}>
                    {currentAiVariant.echanges || "Je reste disponible avant et pendant le séjour pour partager les indications utiles et répondre simplement aux questions pratiques."}
                  </div>
                </div>

                <div className={`relative h-[280px] min-w-0 overflow-hidden ${radiusCard} border border-l-4 border-amber-200/70 border-l-amber-500/75 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.14),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,247,237,0.92)_100%)] ${cardGlow} px-3.5 py-3 ${shadowMini} ring-1 ring-white/60`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-slate-700">
                      {copy.otherInfo}
                    </p>
                    <button
                      type="button"
                      aria-label={copy.copyOtherInfo}
                      onClick={() => handleCopyAiSection("autresInfos", currentAiVariant.autresInfos)}
                      className={aiCardCopyButtonClass}
                    >
                      <svg aria-hidden="true" className="h-3 w-3" viewBox="0 0 16 16" fill="none">
                      <path d="M5.5 5.5H4.25A1.25 1.25 0 0 0 3 6.75v5A1.25 1.25 0 0 0 4.25 13h5A1.25 1.25 0 0 0 10.5 11.75V10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      <path d="M6.25 3h5.5C12.44 3 13 3.56 13 4.25v5.5C13 10.44 12.44 11 11.75 11h-5.5C5.56 11 5 10.44 5 9.75v-5.5C5 3.56 5.56 3 6.25 3Z" stroke="currentColor" strokeWidth="1.4" />
                    </svg>
                      {copyToastKey === "autresInfos" ? copy.copied : copy.copyAction}
                    </button>
                  </div>
                  <div className={aiScrollAmber}>
                    {currentAiVariant.autresInfos || "Les informations pratiques facilitent l’arrivée, clarifient l’organisation du séjour et aident les voyageurs à profiter du logement sereinement."}
                  </div>
                </div>
              </div>
              ) : (
              <div className={`relative mt-6 min-w-0 overflow-hidden ${radiusCard} border border-l-4 border-sky-200/70 border-l-sky-500/75 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(240,249,255,0.92)_100%)] ${cardGlow} px-3.5 py-3 ${shadowMini} ring-1 ring-white/60`}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-slate-700">
                    {copy.bookingDescriptionSummary}
                  </p>
                  <button
                    type="button"
                    aria-label={copy.copyBookingSummary}
                    onClick={() =>
                      handleCopyToClipboard(
                        bookingSectionsReadySummary,
                        "Résumé copié dans le presse-papiers.",
                        "Aucun résumé à copier pour le moment."
                      )
                    }
                    className={aiCardCopyButtonClass}
                  >
                    <svg aria-hidden="true" className="h-3 w-3" viewBox="0 0 16 16" fill="none">
                      <path d="M5.5 5.5H4.25A1.25 1.25 0 0 0 3 6.75v5A1.25 1.25 0 0 0 4.25 13h5A1.25 1.25 0 0 0 10.5 11.75V10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      <path d="M6.25 3h5.5C12.44 3 13 3.56 13 4.25v5.5C13 10.44 12.44 11 11.75 11h-5.5C5.56 11 5 10.44 5 9.75v-5.5C5 3.56 5.56 3 6.25 3Z" stroke="currentColor" strokeWidth="1.4" />
                    </svg>
                    Copier
                  </button>
                </div>
                <p className="mt-3 text-[10px] leading-snug text-slate-600">
                  {copy.bookingSummaryReady}
                </p>
                <div className={`mt-3 max-h-[220px] overflow-y-auto whitespace-pre-line pr-2 text-[11px] leading-5 text-slate-800 ${aiScrollSky}`}>
                  {bookingSectionsReadySummary}
                </div>
              </div>
              )}

            </div>
          </div>

          <div className="grid items-stretch gap-5 md:gap-5 xl:grid-cols-12">
            <div className={`nk-card nk-card-hover relative overflow-hidden ${radiusContainer} border border-l-4 border-slate-200/80 border-l-amber-500/80 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.10),transparent_34%),linear-gradient(135deg,#ffffff_0%,#f8fafc_52%,#fff7ed_100%)] ${cardGlow} p-5 xl:col-span-12 ${shadowStandard}`}>
              <div className="flex items-center justify-between gap-5">
                <div>
                  <p className="text-[15px] font-semibold tracking-[-0.02em] text-slate-900 md:text-[17px]">
                    {copy.actionPlan}
                  </p>
                  <p className="mt-6 text-[11px] leading-5 text-slate-800">
                    {copy.actionPlanSubtitle}
                  </p>
                </div>
              </div>
              <p className="mt-6 max-w-3xl text-[11px] leading-5 text-slate-800 line-clamp-2">{actionPlanIntro}</p>

              <div className="mt-6">
                {orderedLocalizedImprovements.length > 0 ? (
                  <div className="grid items-stretch gap-4 md:grid-cols-2">
                    {orderedLocalizedImprovements.map((item, index) => {
                      const actionLabel =
                        index === 0
                          ? copy.businessPriority
                          : index === 1
                          ? copy.quickOptimization
                          : index === 2
                          ? copy.visibility
                          : copy.reassurance;

                      const [scorePart, ...objectiveParts] = String(item.description ?? "").split(". ");
                      const objectiveText = objectiveParts.join(". ").trim();

                      return (
                      <div
                        key={item.id ?? `${item.title}-${index}`}
                        className={`relative overflow-hidden ${radiusCard} border border-l-4 ${
                          (item.impact ?? "medium") === "high"
                            ? "border-rose-200/70 border-l-rose-500/75 bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.10),transparent_34%),linear-gradient(180deg,#ffffff_0%,#fff4f6_100%)] hover:border-rose-300/75 hover:shadow-[0_18px_40px_rgba(127,29,29,0.08),0_1px_0_rgba(255,255,255,0.64)_inset]"
                            : (item.impact ?? "medium") === "low"
                            ? "border-indigo-200/70 border-l-indigo-400/75 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.09),transparent_34%),linear-gradient(180deg,#ffffff_0%,#f1f5ff_100%)] hover:border-indigo-300/80 hover:shadow-[0_18px_40px_rgba(15,23,42,0.07),0_1px_0_rgba(255,255,255,0.64)_inset]"
                            : "border-amber-200/70 border-l-amber-500/75 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.11),transparent_34%),linear-gradient(180deg,#ffffff_0%,#fff8ed_100%)] hover:border-amber-300/75 hover:shadow-[0_18px_40px_rgba(146,64,14,0.08),0_1px_0_rgba(255,255,255,0.64)_inset]"
                        } ${shadowMini} p-4 transition hover:-translate-y-0.5`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                              {actionLabel}
                            </p>
                            <p className="mt-2 text-[12px] font-semibold text-slate-900">
                              {item.title ?? copy.improvement}
                            </p>
                            {item.reason && (
                              <p className="mt-2 line-clamp-1 text-[10px] font-medium text-slate-500">
                                Signal : {item.reason}
                              </p>
                            )}
                          </div>
                          <span className={`${pillBaseClass} ${impactClass(item.impact)}`}>
                            {(item.impact ?? "medium") === "high"
                              ? "impact élevé"
                              : (item.impact ?? "medium") === "low"
                              ? "impact faible"
                              : "impact moyen"}
                          </span>
                        </div>
                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          <div className="rounded-xl border border-white/70 bg-white/65 px-3 py-2">
                            <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                              Score concerné
                            </p>
                            <p className="mt-1 text-[11px] font-semibold leading-4 text-slate-900">
                              {scorePart || "Signal à confirmer."}
                            </p>
                          </div>

                          <div className="rounded-2xl border border-white/70 bg-white/70 p-3">
                            <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                              Objectif
                            </p>
                            <p className="mt-1 text-[11px] leading-4 text-slate-700">
                              {objectiveText || "Prioriser selon l’impact business détecté."}
                            </p>
                          </div>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className={`relative overflow-hidden ${radiusCard} border border-l-4 border-amber-200/70 border-l-amber-500/75 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.10),transparent_34%),linear-gradient(180deg,#ffffff_0%,#fff7ed_100%)] p-4 ${shadowMini}`}>
                    <p className="text-[11px] leading-5 text-amber-700">
                      Aucune action prioritaire disponible pour le moment.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {lossBlockFrictionItems.length > 0 ? (
              <div className={`nk-card nk-card-hover relative overflow-hidden ${radiusContainer} border border-l-4 border-rose-200/80 border-l-rose-500/75 ${surfaceCritical} !bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.14),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,241,242,0.92)_100%)] ${cardGlow} p-5 xl:col-span-12 ${shadowEmphasis}`}>
                <div className="flex items-center justify-between gap-5">
                  <p className="text-[16px] font-semibold tracking-[-0.02em] text-slate-900 md:text-[18px]">
                    Signaux de friction issus du rapport
                  </p>
                </div>
                <p className="mt-6 text-[12px] leading-5 text-slate-800">
                  Complément uniquement : extraits hors des listes principales « Points faibles » et « Principaux écarts vs marché ». Indicatif, sans lien direct avec une mesure de réservations perdues.
                </p>
                <div className="mt-6 grid items-stretch gap-5 md:gap-5 md:grid-cols-2">
                  {lossBlockFrictionItems.map((item, index) => (
                    <div
                      key={`${item.source}-${index}-${item.text.slice(0, 48)}`}
                      className={`relative overflow-hidden ${radiusCard} border border-l-4 border-rose-200/70 border-l-rose-500/75 bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.10),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(244,63,94,0.08),transparent_28%),linear-gradient(180deg,#ffffff_0%,#fff3f5_100%)] p-3 ${shadowMini} ring-1 ring-white/60`}
                    >
                      <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-rose-700">
                        {item.source === "annonce" ? "Annonce" : "Marché"}
                      </p>
                      <p className="mt-6 text-[12px] leading-5 text-slate-800">{item.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className={sectionShell}>
        <div className={sectionBody}>
          <div className="space-y-6">
            <div className="grid items-stretch gap-5 md:gap-5 xl:grid-cols-3">
              <div className={`nk-card nk-card-hover relative flex h-full min-w-0 overflow-hidden flex-col ${radiusCard} border border-l-4 border-slate-200/75 border-l-sky-400/80 ${surfaceDiagnostic} !bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.16),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(240,249,255,0.92)_100%)] ${cardGlow} p-4 ${shadowEmphasis}`}>
                <div className={`mb-2 ${detailCardLabel}`}>
                  Détail des leviers de l’annonce
                </div>
                <dl className="space-y-4 text-[12px] leading-5">
                  <div className={`relative overflow-hidden flex items-center justify-between gap-5 ${radiusCard} border border-l-4 border-blue-200/70 border-l-blue-500/75 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(239,246,255,0.92)_100%)] px-3.5 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.055),0_1px_0_rgba(255,255,255,0.64)_inset] ring-1 ring-white/60`}>
                    <dt className="text-slate-900">{copy.photoQuality}</dt>
                    <dd>
                      <span className={`${pillBaseClass} ${scoreBadgeClass(photoQuality)}`}>
                        {photoQuality !== null ? `${photoQuality}/10` : "À confirmer"}
                      </span>
                    </dd>
                  </div>
                  <div className={`relative overflow-hidden flex items-center justify-between gap-5 ${radiusCard} border border-l-4 border-indigo-200/70 border-l-indigo-500/75 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(238,242,255,0.92)_100%)] px-3.5 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.055),0_1px_0_rgba(255,255,255,0.64)_inset] ring-1 ring-white/60`}>
                    <dt className="text-slate-900">{copy.photoOrderQuality}</dt>
                    <dd>
                      <span className={`${pillBaseClass} ${scoreBadgeClass(photoOrder)}`}>
                        {photoOrder !== null ? `${photoOrder}/10` : "À confirmer"}
                      </span>
                    </dd>
                  </div>
                  <div className={`relative overflow-hidden flex items-center justify-between gap-5 ${radiusCard} border border-l-4 border-violet-200/70 border-l-violet-500/75 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(245,243,255,0.92)_100%)] px-3.5 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.055),0_1px_0_rgba(255,255,255,0.64)_inset] ring-1 ring-white/60`}>
                    <dt className="text-slate-900">{copy.descriptionQualityLabel}</dt>
                    <dd>
                      <span className={`${pillBaseClass} ${scoreBadgeClass(descriptionQuality)}`}>
                        {descriptionQuality !== null ? `${descriptionQuality}/10` : "À confirmer"}
                      </span>
                    </dd>
                  </div>
                  <div className={`relative overflow-hidden flex items-center justify-between gap-5 ${radiusCard} border border-l-4 border-emerald-200/70 border-l-emerald-500/75 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(236,253,245,0.92)_100%)] px-3.5 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.055),0_1px_0_rgba(255,255,255,0.64)_inset] ring-1 ring-white/60`}>
                    <dt className="text-slate-900">{copy.amenitiesCompletenessLabel}</dt>
                    <dd>
                      <span className={`${pillBaseClass} ${scoreBadgeClass(amenitiesCompleteness)}`}>
                        {amenitiesCompleteness !== null ? `${amenitiesCompleteness}/10` : "À confirmer"}
                      </span>
                    </dd>
                  </div>
                  <div className={`relative overflow-hidden flex items-center justify-between gap-5 ${radiusCard} border border-l-4 border-cyan-200/70 border-l-cyan-500/75 bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(236,254,255,0.92)_100%)] px-3.5 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.055),0_1px_0_rgba(255,255,255,0.64)_inset] ring-1 ring-white/60`}>
                    <dt className="text-slate-900">{copy.seoPerformance}</dt>
                    <dd>
                      <span className={`${pillBaseClass} ${scoreBadgeClass(seoStrength)}`}>
                        {seoStrength !== null ? `${seoStrength}/10` : "À confirmer"}
                      </span>
                    </dd>
                  </div>
                  <div className={`relative overflow-hidden flex items-center justify-between gap-5 ${radiusCard} border border-l-4 border-orange-200/70 border-l-orange-500/75 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,247,237,0.92)_100%)] px-3.5 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.055),0_1px_0_rgba(255,255,255,0.64)_inset] ring-1 ring-white/60`}>
                    <dt className="text-slate-900">{copy.listingConversion}</dt>
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
                <p className="mb-2 text-[10px] leading-snug text-slate-600">
                  Source : signaux forts mesurés par les sous-scores de l’audit.
                </p>
                <ul className={`${detailCardList} list-disc pl-4 text-slate-800 marker:text-emerald-500 marker:font-semibold`}>
                  {factualStrengthSignals.length > 0 ? (
                    factualStrengthSignals.slice(0, 5).map((item, index) => <li key={index}>{item}</li>)
                  ) : (
                    <li className={detailCardBody}>
                      Aucun signal fort mesurable à 8/10 ou plus n’a été détecté dans les sous-scores disponibles.
                    </li>
                  )}
                </ul>
              </div>

              <div className={`nk-card nk-card-hover relative flex h-full min-w-0 overflow-hidden flex-col ${radiusCard} border !border-l-[5px] border-rose-200/80 !border-l-rose-500 bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.36),transparent_42%),linear-gradient(180deg,#ffe4e6_0%,#fda4af_100%)] ${cardGlow} p-4 ${shadowEmphasis}`}>
                <div className={`mb-2 ${detailCardLabel}`}>
                  Points faibles
                </div>
                <p className="mb-2 text-[10px] leading-snug text-slate-600">
                  Source : signaux faibles mesurés par les sous-scores de l’audit.
                </p>
                <ul className={`${detailCardList} list-disc pl-4 text-slate-800 marker:text-amber-500 marker:font-semibold`}>
                  {factualWeakSignals.length > 0 ? (
                    factualWeakSignals.slice(0, 5).map((item, index) => <li key={index}>{item}</li>)
                  ) : (
                    <li className={detailCardBody}>
                      Aucun signal faible mesurable sous 7/10 n’a été détecté dans les sous-scores disponibles.
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>

          {(localizedCompetitorGaps.length > 0 || localizedCompetitorAdvantages.length > 0) ? (
          <div className="space-y-6">
            <div className="grid items-stretch gap-5 md:gap-5 md:grid-cols-2">
              <div className={`nk-card nk-card-hover relative flex h-full min-w-0 overflow-hidden flex-col ${radiusCard} border !border-l-[5px] border-rose-200/75 !border-l-rose-500 bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.34),transparent_42%),linear-gradient(180deg,#ffe4e6_0%,#fecdd3_100%)] ${cardGlow} p-4 ${shadowEmphasis}`}>
                <p className={detailCardLabel}>
                  Principaux écarts vs marché
                </p>
                {competitorGapsUsesContentFallback ? (
                  <p className="mt-2 text-[10px] leading-snug text-slate-600">
                    Fallback narratif depuis les points faibles du rapport. Lecture indicative, pas un benchmark marché strict.
                  </p>
                ) : null}
                <ul className={`mt-6 ${detailCardList} marker:text-rose-500 marker:font-semibold`}>
                  {localizedCompetitorGaps.length > 0 ? (
                    localizedCompetitorGaps.slice(0, 5).map((gap, index) => (
                      <li key={`${gap}-${index}`} className="ml-4 list-disc">
                        {gap}
                      </li>
                    ))
                  ) : (
                    <li className={detailCardBody}>
                      Aucun écart marché listé dans le rapport pour le moment — données manquantes ou non structurées sur ce volet, pas nécessairement absence d’écart réel.
                    </li>
                  )}
                </ul>
              </div>

              <div className={`nk-card nk-card-hover relative flex h-full min-w-0 overflow-hidden flex-col ${radiusCard} border !border-l-[5px] border-emerald-200/75 !border-l-emerald-600 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.34),transparent_42%),linear-gradient(180deg,#d1fae5_0%,#a7f3d0_100%)] ${cardGlow} p-4 ${shadowEmphasis}`}>
                <p className={detailCardLabel}>
                  Principaux avantages vs marché
                </p>
                {competitorAdvantagesUsesContentFallback ? (
                  <p className="mt-2 text-[10px] leading-snug text-slate-600">
                    Fallback narratif depuis les points forts du rapport. Lecture indicative, pas un benchmark marché strict.
                  </p>
                ) : null}
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
          ) : null}

          {localizedMissingAmenities.length > 0 ? (
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
          ) : null}

          <div className={`relative flex flex-col gap-5 overflow-hidden ${radiusContainer} border border-l-4 border-slate-200/80 border-l-blue-500/80 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.10),transparent_28%),linear-gradient(135deg,#ffffff_0%,#f8fafc_52%,#eff6ff_100%)] ${cardGlow} p-5 ${shadowExecutive} md:flex-row md:items-center md:justify-between`}>
                        <div className="max-w-lg">
              <h2 className="text-[16px] font-semibold tracking-tight text-slate-950 md:text-[18px]">
                Prochaine étape recommandée
              </h2>
              <p className="mt-6 text-[12px] leading-5 text-slate-700">
                Corrigez d’abord les leviers les plus rentables, puis relancez un audit pour mesurer le gain obtenu.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 md:shrink-0">
              <Link
                href="/dashboard/listings/new"
                className="inline-flex items-center justify-center rounded-lg border border-blue-500/30 bg-[linear-gradient(135deg,#3b82f6_0%,#06b6d4_52%,#7c3aed_100%)] px-6 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-white shadow-[0_14px_32px_rgba(59,130,246,0.30),0_1px_0_rgba(255,255,255,0.16)_inset] transition hover:brightness-110"
              >
                Relancer un audit
              </Link>
              <Link
                href="/dashboard/audits"
                className="inline-flex items-center justify-center rounded-lg border border-blue-500/30 bg-[linear-gradient(135deg,#3b82f6_0%,#06b6d4_52%,#7c3aed_100%)] px-6 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-white shadow-[0_14px_32px_rgba(59,130,246,0.30),0_1px_0_rgba(255,255,255,0.16)_inset] transition hover:brightness-110"
              >
                Retour aux audits
              </Link>
              <Link
                href="/dashboard/listings"
                className="inline-flex items-center justify-center rounded-lg border border-blue-500/30 bg-[linear-gradient(135deg,#3b82f6_0%,#06b6d4_52%,#7c3aed_100%)] px-6 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-white shadow-[0_14px_32px_rgba(59,130,246,0.30),0_1px_0_rgba(255,255,255,0.16)_inset] transition hover:brightness-110"
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
