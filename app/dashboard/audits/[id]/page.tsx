"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildMarketPositionSummary } from "@/ai/marketPosition";
import { buildPhotoSuggestions } from "@/lib/recommendations/buildPhotoSuggestions";
import { buildTextSuggestions } from "@/lib/recommendations/buildTextSuggestions";
import { buildActionPlan } from "@/lib/recommendations/buildActionPlan";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getSharedSession, getSharedUser } from "@/lib/supabase/sharedAuth";
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
    detectedSourceTitle: "Detected source: {value}",
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
    suggestedTextCopied: "Suggested text copied to clipboard.",
    noDescriptionToCopy: "No description to copy right now.",
    noTextToCopy: "No text to copy right now.",
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
    listingBadge: "Listing",
    bookingVariantBadge: "{value} · Booking variant",
    listingQuality: "Listing quality",
    listingQualityDescription: "Internal analysis of your listing: photos, visual order, description, amenities, SEO and conversion potential.",
    globalConversionLevel: "Overall conversion level",
    realMarket: "Real market",
    observedMarket: "Observed market",
    observedMarketDescription: "Based on retained comparables, observed competitor pricing, market reliability and calculated pricing gap.",
    listingCompetitivePosition: "How your listing compares",
    competitiveSummary: "Synthetic reading of your competitive position based on retained comparable listings.",
    outOfMarketSegmentShort: "Out-of-market segment",
    percentAfterMarketConsolidation: "Percentage shown after market consolidation",
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
    marketPositionNarrativeAbove: "This listing appears to perform above the nearby local average.",
    marketPositionNarrativeBelow: "This listing appears to perform below the nearby local average.",
    marketPositionNarrativeNoComparables: "No nearby competitors have yet been analyzed for this audit.",
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
    photoBadgeLow: "{count} photos • add more visuals",
    photoBadgeMedium: "{count} photos • fair gallery",
    photoBadgeGood: "{count} photos • solid gallery",
    photoBadgeExcellent: "{count} photos • very strong score",
    heroImpactRevenueRange: "+{low} to +{high} / month",
    marketIndicativeLabel: "Indicative reading (limited base)",
    bookingLiftRange: "{low} to {high}",
    bookingLiftUpTo: "Up to {value}",
    impactSideCardNarrativeCondensed: "Condensed view: the full % range is in the “{label}” card below.",
    scoreSideCardNarrativeLow: "Reading /10: fragile level — pillar-by-pillar detail in “Overall conversion level”.",
    scoreSideCardNarrativeMedium: "Reading /10: moderate level — see the sub-scores in the main block.",
    impactSideCardNarrativeOutOfMarket: "Out-of-market segment — business data cannot be used reliably for this listing.",
    impactSideCardNarrativeMarketPending: "There may be optimization potential on your listing, but the quantified percentage will be displayed once the market base is solid (at least three reliable comparables and a consolidated market score), following the same principle as the euro estimate.",
    impactSideCardNarrativeNoRange: "No usable % range for lift is available in the report.",
    heroScoreNarrativeStrong: "Reading /10: strong level — refine with the report recommendations.",
    marketReliabilityBadgeHigh: "High reliability",
    marketReliabilityBadgeMedium: "Moderate reliability",
    marketReliabilityBadgeLow: "Low reliability",
    marketReliabilityBadgeWeakFallback: "Weak fallback",
    marketReliabilityMessageHigh: "Usable market base with several consistent comparable listings.",
    marketReliabilityMessageMedium: "Indicative market base, still to be consolidated.",
    marketReliabilityMessageLow: "Limited market base: interpret with caution.",
    marketReliabilityMessageWeakFallback: "Fallback market base only: interpret with extra caution.",
    marketReliabilityTitleUsable: "Usable market",
    marketReliabilityTitleLimited: "Limited reading",
    marketReliabilityTitleLow: "Local market not very usable",
    marketReliabilityTitleWeakFallback: "Limited local base",
    marketSourceLabelCrossPlatform: "Cross-platform benchmark",
    marketSourceMessageCrossPlatform:
      "Non-Booking comparables were used because there were not enough Booking comparables.",
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
    pricingInsightUnderpriced:
      "Your price stands {value}% below the observed median. A progressive increase toward the recommended price could improve revenue without abruptly leaving the analyzed competitive segment.",
    pricingInsightOptimal:
      "Your price is close to the observed median ({value}%). The main lever is not a strong price increase, but rather improving conversion and presentation.",
    pricingInsightOverpriced:
      "Your price stands {value}% above the observed median. Price can become a friction point if quality signals do not clearly justify this gap.",
    pricingIndicativeCaution:
      "{value} — interpret the pricing positioning cautiously while the local base remains limited.",
    reportFrictionSignalsTitle: "Friction signals from the report",
    reportFrictionSignalsSubtitle:
      "Supplement only: excerpts outside the main “Weaknesses” and “Main market gaps” lists. Indicative, with no direct link to a lost-bookings measure.",
    mainMarketGapsTitle: "Main gaps vs market",
    mainMarketGapsEmpty:
      "No market gap is listed in the report for now — data is missing or unstructured on this dimension, not necessarily proof that no real gap exists.",
    mainMarketAdvantagesTitle: "Main advantages vs market",
    mainMarketAdvantagesEmpty: "No clear advantage identified for now.",
    missingAmenitiesChecklistTitle: "Missing amenities checklist",
    marketCompetitorPricesDispersed: "Competitor prices are dispersed",
    marketPricePositionWellAbove:
      "Your price is well above the observed market: this should be justified by very strong quality signals.",
    marketPricePositionSlightlyAbove:
      "Your price is slightly above the market: a premium position is possible if the promise is clear.",
    marketPricePositionBelow:
      "Your price is below the observed market: some pricing optimization margin seems available.",
    marketPricePositionSlightlyBelow:
      "Your price is slightly below the market: an attractive position with measured upside potential.",
    marketPricePositionAligned:
      "Your price is aligned with the average level observed on this market.",
    marketPricePositionPending:
      "The pricing position will be clarified once a reliable average competitor price becomes available.",
    priceDeltaIndicativeSample:
      "Indicative gap based on a limited local sample.",
    marketAverageRatingObserved:
      "Average rating of observed competitors: {value}/{scale}.",
    marketAverageRatingUnavailable:
      "The average rating of competitors is not usable yet.",
    competitorCountSupportAvailable:
      "Comparables were retained to assess your competitive positioning.",
    competitorCountSupportNone:
      "No comparables were retained for this reading; the positioning remains indicative.",
    competitorCountSupportPending:
      "The positioning remains an indication to be consolidated until an exact comparable volume is available.",
    competitorCountSupportPartial:
      "The market reading remains partial until the comparable volume is consolidated.",
    comparablesKpiLimited: "Limited reading",
    comparablesKpiNone: "No reliable comparable",
    comparablesKpiOne: "Limited reading — 1 usable comparable",
    comparablesKpiTwo: "Limited reading — 2 usable comparables",
    lqiPartialIndex: "Partial index",
    lqiToConsolidate: "To consolidate",
    insufficientData: "Insufficient data",
    revenueImpactRangeDisplay:
      "Estimated current: {current} / month · After optimization: {low} to {high} / month",
    monthlyGainQualifierLimited:
      "{value} — compare against more comparables to stabilize the benchmark.",
    monthlyGainQualifierFragile:
      "Indicative assumption to confirm (price and/or comparables are not reliable enough for a clear market benchmark).",
    insufficientComparablePricing: "Insufficient data: no reliable comparable to estimate median or pricing impact.",
    insufficientPricingData: "Insufficient market data to estimate reliable pricing impact.",
    pricingBenchmarks: "Pricing benchmarks",
    pricingBenchmarksTitle: "How your price compares with competitors",
    pricingBenchmarksDescription: "Pricing benchmarks based on observed average prices and the estimated gap with the comparable market.",
    avgCompetitorPriceSupportInsufficient: "Insufficient market sample to establish a reliable price benchmark.",
    avgCompetitorPriceSupportLimited: "Indicative benchmark: the local base is still limited and should be consolidated with more comparables.",
    avgCompetitorPriceSupportObserved: "Observed competitive benchmark on the listings retained for this segment.",
    avgCompetitorPriceSupportPending: "The price benchmark will become more useful once a reliable competitor price can be consolidated.",
    averageCompetitorPrice: "Average competitor price",
    priceGapVsMarket: "Price gap vs market",
    priceDeltaInsufficientSample: "Insufficient sample",
    priceDeltaUnavailable: "Price gap cannot be calculated here: listed price or market benchmark is insufficient for a reliable percentage.",
    priceDeltaPending: "As soon as a listed price and a reliable market benchmark are consolidated, a percentage gap can be displayed here.",
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
    estimatedBookingsAfterOptimization: "Estimated bookings after optimization",
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
    estimatedImpactOnBookings: "Estimated impact on bookings",
    impactBusinessBlockIntroOutOfSegment: "Comparables retained outside the pricing segment — only quality, content and visual conversion recommendations can be interpreted reliably.",
    impactBusinessBlockIntroDefault: "Each card below uses a fixed unit: € for price, /10 for relative market score, % for booking lift, €/month for estimated monthly gain (additional, not total revenue).",
    currentPriceContextCompareMarket: "To compare with the estimated average market price of {value}.",
    currentPriceContextDetected: "Current price detected on the listing.",
    currentPriceContextMarketReference: "Current price unavailable. Observed market reference: ~{value}/night.",
    currentPriceContextMissing: "The current price is not available for this listing.",
    currentPriceUnavailable: "Current price unavailable",
    projectionBaseNoComparable: "No sufficiently consistent comparables to establish a usable competitive average.",
    projectionBaseRobust: "Robust competitive base built from {count} comparable listings.",
    projectionBasePartial: "Partial benchmark based on {count} usable comparables.",
    projectionBaseUnstable: "The detected market remains too unstable to provide a reliable competitive benchmark.",
    potentialToConfirm: "Potential to confirm",
    conversionGainLowConfidence: "Market confidence remains insufficient to project a credible conversion gain.",
    conversionGainFromScoreAndPrice: "Projection based on the conversion score and the current price, without a reliable competitive pricing benchmark.",
    conversionGainOutOfSegment: "Out-of-segment comparables detected — booking potential cannot be estimated reliably for this listing.",
    conversionGainPendingRange: "The % range will be displayed once the market base is sufficiently reliable (comparables and consolidated score), as with the estimated monthly gain.",
    conversionGainEstimated: "Estimate based on your current positioning and the analyzed competitor listings.",
    conversionGainNoRange: "No percentage range is available for booking lift in the current report data.",
    monthlyGainOutOfSegment: "Out-of-segment comparables — no gain projection applies to this market.",
    monthlyGainUnavailable: "Estimate unavailable — insufficient market data. A usable quantified range requires a reliable listed price and a consolidated competitive benchmark.",
    monthlyGainNeedsStableMarket: "A quantified estimate requires a coherent listed price and a consolidated observed market level.",
    optimizedTexts: "Optimized listing texts",
    optimizedTextVariantLabel: "Variant {index} - {label}",
    optimizedTextIntro:
      "Proposal assembled from your listing and report signals using local text models (no remote model call on this screen). Adjust to match your brand.",
    optimizedTextVariantCounter: "Variant {index} / {total}",
    optimizedTextVariantNameComfort: "Comfort & relaxation",
    optimizedTextVariantNamePractical: "Practical & smooth",
    optimizedTextVariantNameNeighborhood: "Neighborhood & location",
    optimizedTextVariantNamePremium: "Premium & trust",
    optimizedTextVariantNameBusiness: "Short stay / business",
    variant: "Variant",
    changeVariant: "Change variant",
    descriptionCopied: "Description copied",
    newVariantReady: "New variant ready.",
    currentTitle: "Current title",
    optimizedTitleExample: "Optimized title example",
    aiGeneratingTitle: "Generating AI title…",
    missingListingTitle: "No title is available for this listing.",
    aiDescriptionPlaceholder: "The proposed text will appear here as soon as listing and audit data are available.",
    aiGeneratingDescription: "AI generation in progress…",
    aiProvenanceAi: "AI",
    aiProvenanceFallbackLocal: "Local fallback",
    aiDescriptionFailed: "AI generation failed for this locale. Please try again later.",
    aiDescriptionUnavailable: "No AI Airbnb description is available for this locale yet.",
    aiFallbackHousing: "Settle into a comfortable, easy-to-live-in home designed to make every moment of your stay feel simpler.",
    aiFallbackDetailedHousing: "The property offers a complete experience, with clear spaces, useful amenities and a pleasant atmosphere to enjoy the stay.",
    aiFallbackGuestAccess: "Guests enjoy simple access to the property, the spaces planned for the stay and the amenities useful for everyday comfort.",
    aiFallbackGuestInteraction: "I remain available before and during the stay to share useful guidance and answer practical questions simply.",
    aiFallbackOtherInfo: "Practical information makes arrival easier, clarifies the stay logistics and helps guests enjoy the property with peace of mind.",
    myPlace: "My place",
    detailedPlace: "Place — detailed version",
    guestAccess: "Guest access",
    guestInteraction: "Guest interaction",
    otherInfo: "Other information to note",
    bookingDescriptionSummary: "Description summary (Booking)",
    bookingSummaryFallback:
      "Include in your description: the comfort of the spaces, access to the property, availability for guests, and practical information useful on arrival.",
    bookingSummaryReady: "Ready-to-paste summary aligned with the displayed variant.",
    actionPlan: "Action plan",
    actionPlanSubtitle: "Projects to launch now, ranked by business impact.",
    fallbackNarrativeFromWeaknesses:
      "Narrative fallback based on the report weaknesses. Indicative reading, not a strict market benchmark.",
    fallbackNarrativeFromStrengths:
      "Narrative fallback based on the report strengths. Indicative reading, not a strict market benchmark.",
    actionPlanIntroAttractiveness:
      "This view groups the levers by priority to strengthen your listing’s attractiveness, hospitality and presentation.",
    actionPlanIntroConversion:
      "This view groups improvements by priority to clarify the offer, reassure the traveler and accelerate the decision.",
    actionPlanIntroStorytelling:
      "Actions will be structured here to support storytelling, differentiation and desire to stay.",
    actionPlanIntroDefault:
      "Actions will be structured here as soon as a detailed improvement plan is available.",
    prioritizedActionsIntroAirbnb:
      "Generated recommendations, ordered to move from the most differentiating to the most structuring improvements.",
    prioritizedActionsIntroDefault:
      "Generated recommendations, ordered to maximize clarity, reassurance and conversion.",
    prioritizedActionsIntroEmpty: "No priority action has yet been surfaced in this audit.",
    prioritizedActionsSublineAirbnb:
      "A sequence designed to strengthen emotion, uniqueness and the desire to book.",
    prioritizedActionsSublineDefault:
      "A sequence designed to quickly deliver useful, reassuring and actionable information.",
    actionSignalLabel: "Signal",
    actionImpactHigh: "high impact",
    actionImpactMedium: "medium impact",
    actionImpactLow: "low impact",
    actionScoreLabel: "Affected score",
    actionObjectiveLabel: "Objective",
    actionSignalFallback: "Signal to confirm.",
    actionObjectiveFallback: "Prioritize according to the detected business impact.",
    actionEmptyState: "No priority action is available right now.",
    actionImprovementFallback: "Improvement {index}",
    actionScoreLineWithValue: "{label}: {value}/10.",
    actionScoreLinePending: "{label}: to confirm.",
    actionLabelDescription: "Description",
    actionLabelSeo: "SEO",
    actionLabelPhotos: "Photos",
    actionLabelAmenities: "Amenities",
    actionLabelConversion: "Conversion",
    actionLabelPricing: "Pricing",
    actionNarrativeDescription:
      "The text must better turn listing information into concrete traveler benefits: comfort, experience, location and reasons to book.",
    actionReasonDescription: "Description score + traveler projection quality.",
    actionNarrativeSeo:
      "The title and opening lines should better integrate useful keywords: location, sought-after amenities and differentiating assets.",
    actionReasonSeo: "SEO score + platform visibility.",
    actionNarrativePhotos:
      "The visuals should keep reassuring from the first seconds: best spaces first, light, comfort and perceived value.",
    actionReasonPhotos: "Photo score + gallery order.",
    actionNarrativeAmenities:
      "Key amenities need to be more visible to reduce doubts before booking and increase the perception of comfort.",
    actionReasonAmenities: "Amenities score + stay reassurance.",
    actionNarrativeConversion:
      "The priority is to reduce hesitation: clear promise, visible proof, concrete information and consistency between title, photos and description.",
    actionReasonConversion: "Conversion score + decision friction.",
    actionReasonPricing: "Pricing positioning + comparable market validation.",
    actionReasonMarketComparables: "{count} comparable listing(s) used to read the market.",
    actionNarrativeFallback:
      "Action from the report: prioritize according to business impact and available signals.",
    actionNormalizedTitleClarify: "Clarify the information that triggers bookings",
    actionNormalizedTitleConcreteValue: "Make the value more concrete",
    actionNormalizedTitleAnalyzePricingGap: "Analyze the measured pricing gap",
    actionNormalizedTitleBuildTrust: "Strengthen trust before booking",
    actionNormalizedDescriptionPricingCompare:
      "To do: Compare the price only with listings that are truly similar in type, location and service level before any adjustment.",
    auditLeversDetailTitle: "Detailed listing levers",
    auditStrengthsTitle: "Strengths",
    auditStrengthsSource: "Source: strong signals measured by the audit sub-scores.",
    auditStrengthsEmpty:
      "No measurable strong signal at 8/10 or above was detected in the available sub-scores.",
    auditWeaknessesTitle: "Weaknesses",
    auditWeaknessesSource: "Source: weak signals measured by the audit sub-scores.",
    auditWeaknessesEmpty:
      "No measurable weak signal below 7/10 was detected in the available sub-scores.",
    strengthsFallbackAirbnb:
      "No structured strength has been surfaced yet — think storytelling, hospitality and what makes you stand out.",
    strengthsFallbackDefault:
      "No structured strength has been surfaced yet — think proof points, clarity and reassurance.",
    weaknessesFallbackInsightIsolated:
      "No distinct weakness could be isolated from the “insights” with the current method.",
    weaknessesFallbackInsightStructured:
      "No structured “weaknesses” list is present in the report: the “insights” are not duplicated here as formal weaknesses — see priority actions and market gaps.",
    weaknessesFallbackNoStructuredAirbnb:
      "No weakness is present in the structured report fields for now — the reading is incomplete, not proof that there is nothing to improve.",
    weaknessesFallbackNoStructuredDefault:
      "No weakness is present in the structured report fields for now — the reading is incomplete, not proof that there is nothing to improve.",
    auditStrengthPhotos: "Strong photos: {score}/10.",
    auditStrengthPhotoOrder: "Strong photo order: {score}/10.",
    auditStrengthDescription: "High-performing description: {score}/10.",
    auditStrengthAmenities: "Amenities well covered: {score}/10.",
    auditStrengthSeo: "Strong SEO: {score}/10.",
    auditStrengthConversion: "Strong conversion: {score}/10.",
    auditWeakDescription: "Description needs improvement: {score}/10.",
    auditWeakSeo: "SEO needs strengthening: {score}/10.",
    auditWeakConversion: "Conversion needs strengthening: {score}/10.",
    auditWeakAmenities: "Amenities to complete: {score}/10.",
    auditWeakPhotoQuality: "Photo quality to improve: {score}/10.",
    auditWeakPhotoOrder: "Photo order to review: {score}/10.",
    nextStepTitle: "Recommended next step",
    nextStepDescription:
      "Fix the most profitable levers first, then rerun an audit to measure the gain achieved.",
    nextStepRunAudit: "Rerun an audit",
    nextStepBackToAudits: "Back to audits",
    nextStepAnalyzeAnother: "Analyze another listing",
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
    lqiNoteUnavailable: "Data is unavailable for this axis in this view.",
    lqiNoteListingNativeHigh:
      "Component provided by the report: high level on this axis — to be checked against the real listing content.",
    lqiNoteListingNativeModerate:
      "Component provided by the report: moderate level — one signal among others, not an isolated verdict.",
    lqiNoteListingLocalHigh:
      "Local /100 synthesis from the /10 dimensions already detailed above: same signal family, condensed view.",
    lqiNoteListingLocalFallback:
      "Local /100 synthesis from the audit’s /10 sub-scores — indicative and already explored elsewhere on the page.",
    lqiNoteMarketNativeHigh:
      "Your listing remains competitive against the nearby analyzed listings.",
    lqiNoteMarketNativeModerate:
      "Your market positioning is correct, but still improvable.",
    lqiNoteMarketNativeLow:
      "Observed competitors currently seem better positioned.",
    lqiNoteMarketLocalHigh:
      "Local synthesis (market scores + overall /10): condensed marker, not independent from the market blocks.",
    lqiNoteMarketLocalFallback:
      "Local synthesis (market scores + overall /10): indicative reading, to compare with “Market positioning”.",
    lqiNoteConversionUnavailable:
      "No /100 value is available for this dimension: see the conversion score and recommendations elsewhere.",
    lqiNoteConversionNativeHigh:
      "The conversion potential is already strong on this listing.",
    lqiNoteConversionNativeModerate:
      "Several optimizations can still improve conversion.",
    lqiNoteConversionNativeLow:
      "Visible friction points still limit booking potential.",
    lqiNoteConversionLocalFallback:
      "Indicative: value completed from another report field (booking potential), not an autonomous conversion measure.",
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
    detectedSourceTitle: "Source détectée : {value}",
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
    suggestedTextCopied: "Texte suggéré copié dans le presse-papiers.",
    noDescriptionToCopy: "Aucune description à copier pour le moment.",
    noTextToCopy: "Aucun texte à copier pour le moment.",
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
    listingBadge: "Annonce",
    bookingVariantBadge: "{value} · variante Booking",
    listingQuality: "Qualité de l’annonce",
    listingQualityDescription: "Lecture des signaux internes de votre fiche : photos, ordre visuel, description, équipements, SEO et capacité de conversion.",
    globalConversionLevel: "Niveau de conversion global",
    realMarket: "Marché réel",
    observedMarket: "Marché observé",
    observedMarketDescription: "Lecture basée sur les comparables retenus, le prix concurrent observé, la fiabilité du marché et l’écart tarifaire calculé.",
    listingCompetitivePosition: "Comment se situe votre annonce",
    competitiveSummary: "Lecture synthétique de votre position concurrentielle à partir des annonces comparables retenues.",
    outOfMarketSegmentShort: "Segment hors marché",
    percentAfterMarketConsolidation: "Pourcentage chiffré après consolidation marché",
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
    marketPositionNarrativeAbove: "Cette annonce semble plus performante que la moyenne locale à proximité.",
    marketPositionNarrativeBelow: "Cette annonce semble plus faible que la moyenne locale à proximité.",
    marketPositionNarrativeNoComparables: "Aucun concurrent proche n’a encore été analysé pour cet audit.",
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
    photoBadgeLow: "{count} photos • ajoutez plus de visuels",
    photoBadgeMedium: "{count} photos • galerie correcte",
    photoBadgeGood: "{count} photos • galerie solide",
    photoBadgeExcellent: "{count} photos • très bon score",
    heroImpactRevenueRange: "+{low} à +{high} / mois",
    marketIndicativeLabel: "Lecture indicative (base limitée)",
    bookingLiftRange: "{low} à {high}",
    bookingLiftUpTo: "Jusqu'à {value}",
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
    marketReliabilityTitleUsable: "Marché exploitable",
    marketReliabilityTitleLimited: "Lecture limitée",
    marketReliabilityTitleLow: "Marché local peu exploitable",
    marketReliabilityTitleWeakFallback: "Base locale limitée",
    marketSourceLabelCrossPlatform: "Benchmark cross-platform",
    marketSourceMessageCrossPlatform:
      "Comparables non-Booking utilisés faute de comparables Booking suffisants.",
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
    pricingInsightUnderpriced:
      "Votre tarif ressort {value} % sous la médiane observée. Une hausse progressive vers le prix conseillé peut améliorer le revenu sans sortir brutalement du segment concurrentiel analysé.",
    pricingInsightOptimal:
      "Votre tarif est proche de la médiane observée ({value} %). Le levier principal n’est pas une forte hausse prix, mais plutôt l’amélioration de conversion et de présentation.",
    pricingInsightOverpriced:
      "Votre tarif ressort {value} % au-dessus de la médiane observée. Le prix peut devenir un frein si les signaux de qualité ne justifient pas clairement cet écart.",
    pricingIndicativeCaution:
      "{value} — interpréter le positionnement tarifaire avec prudence tant que la base locale reste limitée.",
    reportFrictionSignalsTitle: "Signaux de friction issus du rapport",
    reportFrictionSignalsSubtitle:
      "Complément uniquement : extraits hors des listes principales « Points faibles » et « Principaux écarts vs marché ». Indicatif, sans lien direct avec une mesure de réservations perdues.",
    mainMarketGapsTitle: "Principaux écarts vs marché",
    mainMarketGapsEmpty:
      "Aucun écart marché listé dans le rapport pour le moment — données manquantes ou non structurées sur ce volet, pas nécessairement absence d’écart réel.",
    mainMarketAdvantagesTitle: "Principaux avantages vs marché",
    mainMarketAdvantagesEmpty: "Aucun avantage net identifié pour le moment.",
    missingAmenitiesChecklistTitle: "Checklist des équipements manquants",
    marketCompetitorPricesDispersed: "Prix concurrents dispersés",
    marketPricePositionWellAbove:
      "Votre tarif est nettement au-dessus du marché observé : à justifier par des signaux qualité très forts.",
    marketPricePositionSlightlyAbove:
      "Votre tarif est légèrement au-dessus du marché : position premium possible si la promesse est claire.",
    marketPricePositionBelow:
      "Votre tarif est sous le marché observé : une marge d’optimisation tarifaire semble disponible.",
    marketPricePositionSlightlyBelow:
      "Votre tarif est légèrement sous le marché : position attractive avec potentiel de hausse mesurée.",
    marketPricePositionAligned:
      "Votre tarif est aligné avec le niveau moyen observé sur ce marché.",
    marketPricePositionPending:
      "Le positionnement tarifaire sera précisé dès qu’un prix moyen concurrent fiable sera disponible.",
    priceDeltaIndicativeSample:
      "Écart indicatif basé sur un échantillon local limité.",
    marketAverageRatingObserved:
      "Note moyenne des concurrents observés : {value}/{scale}.",
    marketAverageRatingUnavailable:
      "La note moyenne des concurrents n’est pas encore exploitable.",
    competitorCountSupportAvailable:
      "Comparables retenus pour évaluer votre positionnement concurrentiel.",
    competitorCountSupportNone:
      "Aucun comparable n’a été retenu pour cette lecture ; le positionnement reste indicatif.",
    competitorCountSupportPending:
      "Le positionnement reste une indication à consolider, faute de volume exact de comparables.",
    competitorCountSupportPartial:
      "La lecture marché reste partielle tant que le volume de comparables n’est pas consolidé.",
    comparablesKpiLimited: "Lecture limitée",
    comparablesKpiNone: "Aucun comparable fiable",
    comparablesKpiOne: "Lecture limitée — 1 comparable exploitable",
    comparablesKpiTwo: "Lecture limitée — 2 comparables exploitables",
    lqiPartialIndex: "Indice partiel",
    lqiToConsolidate: "À consolider",
    insufficientData: "Données insuffisantes",
    revenueImpactRangeDisplay:
      "Actuel estimé : {current} / mois · Après optimisation : {low} à {high} / mois",
    monthlyGainQualifierLimited:
      "{value} — croiser avec davantage de comparables pour stabiliser le repère.",
    monthlyGainQualifierFragile:
      "Hypothèse indicative à confirmer (prix et/ou comparables insuffisamment fiables pour un repère marché net).",
    insufficientComparablePricing: "Données insuffisantes : aucun comparable fiable pour estimer médiane ou impact tarifaire.",
    insufficientPricingData: "Données marché insuffisantes pour estimer un impact tarifaire fiable.",
    pricingBenchmarks: "Références de prix",
    pricingBenchmarksTitle: "Comment votre prix se compare-t-il au marché ?",
    pricingBenchmarksDescription: "Repères issus du prix moyen observé et de l’écart estimé avec le marché comparable.",
    avgCompetitorPriceSupportInsufficient: "Échantillon marché insuffisant pour établir un repère prix fiable.",
    avgCompetitorPriceSupportLimited: "Repère indicatif : base locale encore limitée, à consolider avec plus de comparables.",
    avgCompetitorPriceSupportObserved: "Repère concurrentiel observé sur les annonces retenues pour ce segment.",
    avgCompetitorPriceSupportPending: "Le repère prix sera plus utile dès qu’un tarif concurrent fiable pourra être consolidé.",
    averageCompetitorPrice: "Prix moyen des concurrents",
    priceGapVsMarket: "Écart de prix vs marché",
    priceDeltaInsufficientSample: "Échantillon insuffisant",
    priceDeltaUnavailable: "Écart prix non calculable ici : tarif annoncé ou repère marché insuffisant pour un pourcentage fiable.",
    priceDeltaPending: "Dès qu’un tarif annoncé et un repère marché fiable sont consolidés, un pourcentage d’écart pourra être affiché ici.",
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
    estimatedBookingsAfterOptimization: "Réservations estimées après optimisation",
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
    estimatedImpactOnBookings: "Impact estimé sur les réservations",
    impactBusinessBlockIntroOutOfSegment: "Comparables retenus hors segment tarifaire — seules les recommandations qualité, contenu et conversion visuelle sont interprétables de manière fiable.",
    impactBusinessBlockIntroDefault: "Chaque carte ci-dessous porte une unité fixe : € le prix, /10 le marché relatif, % le lift réservations, €/mois le gain mensuel estimé (additionnel, pas le chiffre d’affaires total).",
    currentPriceContextCompareMarket: "À comparer au prix moyen du marché estimé à {value}.",
    currentPriceContextDetected: "Tarif actuel détecté sur l’annonce.",
    currentPriceContextMarketReference: "Prix actuel indisponible. Référence marché observée : ~{value}/nuit.",
    currentPriceContextMissing: "Le tarif actuel n’est pas remonté pour cette annonce.",
    currentPriceUnavailable: "Prix actuel indisponible",
    projectionBaseNoComparable: "Aucun comparable suffisamment cohérent pour établir une moyenne concurrentielle exploitable.",
    projectionBaseRobust: "Base concurrentielle robuste construite sur {count} annonces comparables.",
    projectionBasePartial: "Benchmark partiel basé sur {count} comparables utilisables.",
    projectionBaseUnstable: "Le marché détecté reste trop instable pour fournir un benchmark concurrentiel fiable.",
    potentialToConfirm: "Potentiel à confirmer",
    conversionGainLowConfidence: "Le niveau de confiance marché reste insuffisant pour projeter un gain de conversion crédible.",
    conversionGainFromScoreAndPrice: "Projection basée sur le score de conversion et le prix actuel, sans benchmark tarifaire concurrentiel fiable.",
    conversionGainOutOfSegment: "Comparables hors segment détectés — potentiel de réservations non estimable avec fiabilité pour cette annonce.",
    conversionGainPendingRange: "La fourchette en % sera affichée lorsque la base marché sera suffisamment fiable (comparables et score consolidés), comme pour le gain mensuel estimé.",
    conversionGainEstimated: "Estimation basée sur votre positionnement actuel et les annonces concurrentes analysées.",
    conversionGainNoRange: "Pas de fourchette en pourcentage pour le lift réservations dans les données actuelles du rapport.",
    monthlyGainOutOfSegment: "Comparables hors segment — aucune projection de gain applicable pour ce marché.",
    monthlyGainUnavailable: "Estimation indisponible — données marché insuffisantes. Une fourchette chiffrée exploitable nécessite un prix annoncé fiable et un repère concurrent consolidé.",
    monthlyGainNeedsStableMarket: "Une estimation chiffrée nécessite un prix annoncé cohérent et un niveau de marché observé consolidé.",
    optimizedTexts: "Textes optimisés pour l’annonce",
    optimizedTextVariantLabel: "Variante {index} - {label}",
    optimizedTextIntro:
      "Proposition assemblée à partir de votre annonce et des signaux du rapport via des modèles de texte locaux (pas d’appel à un modèle distant sur cet écran). À ajuster selon votre marque.",
    optimizedTextVariantCounter: "Variante {index} / {total}",
    optimizedTextVariantNameComfort: "Confort & détente",
    optimizedTextVariantNamePractical: "Pratique & fluide",
    optimizedTextVariantNameNeighborhood: "Quartier & emplacement",
    optimizedTextVariantNamePremium: "Premium & confiance",
    optimizedTextVariantNameBusiness: "Court séjour / business",
    variant: "Variante",
    changeVariant: "Changer de variante",
    descriptionCopied: "Description copiée",
    newVariantReady: "Nouvelle variante prête.",
    currentTitle: "Titre actuel",
    optimizedTitleExample: "Exemple de titre optimisé",
    aiGeneratingTitle: "Génération du titre IA…",
    missingListingTitle: "Aucun titre n’est disponible pour cette annonce.",
    aiDescriptionPlaceholder: "La proposition de texte apparaîtra ici dès que les données d’annonce et d’audit seront disponibles.",
    aiGeneratingDescription: "Génération IA en cours…",
    aiProvenanceAi: "IA",
    aiProvenanceFallbackLocal: "Fallback local",
    aiDescriptionFailed: "La génération IA a échoué pour cette langue. Réessayez plus tard.",
    aiDescriptionUnavailable: "Aucune description Airbnb IA n’est encore disponible pour cette langue.",
    aiFallbackHousing: "Installez-vous dans un logement confortable, facile à vivre et pensé pour rendre chaque moment du séjour plus simple.",
    aiFallbackDetailedHousing: "Le logement offre une expérience complète, avec des espaces lisibles, des équipements utiles et une atmosphère agréable pour profiter du séjour.",
    aiFallbackGuestAccess: "Les voyageurs profitent d’un accès simple au logement, aux espaces prévus pour le séjour et aux équipements utiles au quotidien.",
    aiFallbackGuestInteraction: "Je reste disponible avant et pendant le séjour pour partager les indications utiles et répondre simplement aux questions pratiques.",
    aiFallbackOtherInfo: "Les informations pratiques facilitent l’arrivée, clarifient l’organisation du séjour et aident les voyageurs à profiter du logement sereinement.",
    myPlace: "Mon logement",
    detailedPlace: "Logement — version détaillée",
    guestAccess: "Accès des voyageurs",
    guestInteraction: "Communication avec les voyageurs",
    otherInfo: "Autres informations à garder à l’esprit",
    bookingDescriptionSummary: "Résumé de description (Booking)",
    bookingSummaryFallback:
      "À intégrer dans votre description : le confort des espaces, l’accès au logement, la disponibilité pour les voyageurs et les informations pratiques utiles à l’arrivée.",
    bookingSummaryReady: "Synthèse prête à coller, alignée sur la variante affichée.",
    actionPlan: "Plan d’action",
    actionPlanSubtitle: "Les chantiers à lancer maintenant, classés par impact business.",
    fallbackNarrativeFromWeaknesses:
      "Fallback narratif depuis les points faibles du rapport. Lecture indicative, pas un benchmark marché strict.",
    fallbackNarrativeFromStrengths:
      "Fallback narratif depuis les points forts du rapport. Lecture indicative, pas un benchmark marché strict.",
    actionPlanIntroAttractiveness:
      "Cette vue regroupe les leviers par priorité pour renforcer l’attractivité, l’hospitalité et la mise en scène de votre annonce.",
    actionPlanIntroConversion:
      "Cette vue regroupe les améliorations par priorité pour clarifier l’offre, rassurer le voyageur et accélérer la décision.",
    actionPlanIntroStorytelling:
      "Les actions seront structurées ici pour soutenir narration, différenciation et envie de séjour.",
    actionPlanIntroDefault:
      "Les actions seront structurées ici dès qu’un plan d’amélioration détaillé sera disponible.",
    actionSignalLabel: "Signal",
    actionImpactHigh: "impact élevé",
    actionImpactMedium: "impact moyen",
    actionImpactLow: "impact faible",
    actionScoreLabel: "Score concerné",
    actionObjectiveLabel: "Objectif",
    actionSignalFallback: "Signal à confirmer.",
    actionObjectiveFallback: "Prioriser selon l’impact business détecté.",
    actionEmptyState: "Aucune action prioritaire disponible pour le moment.",
    actionImprovementFallback: "Amélioration {index}",
    actionScoreLineWithValue: "{label} : {value}/10.",
    actionScoreLinePending: "{label} : à confirmer.",
    actionLabelDescription: "Description",
    actionLabelSeo: "SEO",
    actionLabelPhotos: "Photos",
    actionLabelAmenities: "Équipements",
    actionLabelConversion: "Conversion",
    actionNarrativeDescription:
      "Le texte doit mieux transformer les informations de l’annonce en bénéfices concrets pour le voyageur : confort, expérience, emplacement et raisons de réserver.",
    actionReasonDescription: "Score description + qualité de projection voyageur.",
    actionNarrativeSeo:
      "Le titre et les premières lignes doivent mieux intégrer les mots-clés utiles : localisation, équipements recherchés et atouts différenciants.",
    actionReasonSeo: "Score SEO + visibilité plateforme.",
    actionNarrativePhotos:
      "Les visuels doivent continuer à rassurer dès les premières secondes : meilleurs espaces en premier, lumière, confort et valeur perçue.",
    actionReasonPhotos: "Score photos + ordre de galerie.",
    actionNarrativeAmenities:
      "Les équipements clés doivent être plus visibles pour réduire les doutes avant réservation et augmenter la perception de confort.",
    actionReasonAmenities: "Score équipements + réassurance séjour.",
    actionLabelPricing: "Pricing",
    actionNarrativeConversion:
      "La priorité est de réduire les hésitations : promesse claire, preuves visibles, informations concrètes et cohérence entre titre, photos et description.",
    actionReasonConversion: "Score conversion + friction décisionnelle.",
    actionReasonPricing: "Positionnement tarifaire + validation du marché comparable.",
    actionReasonMarketComparables: "{count} annonce(s) comparable(s) utilisée(s) pour lire le marché.",
    actionNarrativeFallback:
      "Action issue du rapport : à prioriser selon l’impact business et les signaux disponibles.",
    actionNormalizedTitleClarify: "Clarifier les informations qui déclenchent la réservation",
    actionNormalizedTitleConcreteValue: "Rendre la valeur plus concrète",
    actionNormalizedTitleAnalyzePricingGap: "Analyser l’écart tarifaire mesuré",
    actionNormalizedTitleBuildTrust: "Renforcer la confiance avant réservation",
    actionNormalizedDescriptionPricingCompare:
      "À faire : Comparez le tarif uniquement avec des annonces réellement similaires en type, emplacement et niveau de prestation avant tout ajustement.",
    auditLeversDetailTitle: "Détail des leviers de l’annonce",
    auditStrengthsTitle: "Points forts",
    auditStrengthsSource: "Source : signaux forts mesurés par les sous-scores de l’audit.",
    auditStrengthsEmpty:
      "Aucun signal fort mesurable à 8/10 ou plus n’a été détecté dans les sous-scores disponibles.",
    auditWeaknessesTitle: "Points faibles",
    auditWeaknessesSource: "Source : signaux faibles mesurés par les sous-scores de l’audit.",
    auditWeaknessesEmpty:
      "Aucun signal faible mesurable sous 7/10 n’a été détecté dans les sous-scores disponibles.",
    auditStrengthPhotos: "Photos solides : {score}/10.",
    auditStrengthPhotoOrder: "Ordre des photos solide : {score}/10.",
    auditStrengthDescription: "Description performante : {score}/10.",
    auditStrengthAmenities: "Équipements bien couverts : {score}/10.",
    auditStrengthSeo: "SEO solide : {score}/10.",
    auditStrengthConversion: "Conversion solide : {score}/10.",
    auditWeakDescription: "Description perfectible : {score}/10.",
    auditWeakSeo: "SEO à renforcer : {score}/10.",
    auditWeakConversion: "Conversion à renforcer : {score}/10.",
    auditWeakAmenities: "Équipements à compléter : {score}/10.",
    auditWeakPhotoQuality: "Qualité photo à améliorer : {score}/10.",
    auditWeakPhotoOrder: "Ordre des photos à revoir : {score}/10.",
    nextStepTitle: "Prochaine étape recommandée",
    nextStepDescription:
      "Corrigez d’abord les leviers les plus rentables, puis relancez un audit pour mesurer le gain obtenu.",
    nextStepRunAudit: "Relancer un audit",
    nextStepBackToAudits: "Retour aux audits",
    nextStepAnalyzeAnother: "Analyser une autre annonce",
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
    scoreSideCardNarrativeLow:
      "Lecture /10 : niveau fragile — détail par pilier dans « Niveau de conversion global ».",
    scoreSideCardNarrativeMedium:
      "Lecture /10 : niveau modéré — voir les sous-scores du bloc principal.",
    impactSideCardNarrativeOutOfMarket:
      "Segment hors marché — données business non exploitables pour cette annonce.",
    impactSideCardNarrativeMarketPending:
      "Un potentiel d’optimisation peut exister sur votre annonce, mais le pourcentage chiffré sera affiché lorsque la base marché sera solide (au moins trois comparables fiables et un score marché consolidé), sur le même principe que l’estimation en euros.",
    impactSideCardNarrativeNoRange:
      "Aucune fourchette % exploitable pour le lift dans le rapport.",
    prioritizedActionsIntroAirbnb:
      "Liste des recommandations générées, ordonnée pour progresser du plus différenciant au plus structurant.",
    prioritizedActionsIntroDefault:
      "Liste des recommandations générées, ordonnée pour maximiser clarté, réassurance et conversion.",
    prioritizedActionsIntroEmpty:
      "Aucune action prioritaire n’a encore été remontée dans cet audit.",
    prioritizedActionsSublineAirbnb:
      "Une séquence pour renforcer l’émotion, l’unicité et l’envie de réserver.",
    prioritizedActionsSublineDefault:
      "Une séquence pour livrer vite des infos utiles, rassurantes et actionnables.",
    strengthsFallbackAirbnb:
      "Aucun point fort structuré n’a encore été remonté — pensez storytelling, accueil et ce qui vous distingue.",
    strengthsFallbackDefault:
      "Aucun point fort structuré n’a encore été remonté — pensez preuves, clarté et réassurance.",
    weaknessesFallbackInsightIsolated:
      "Aucun point faible distinct n’a pu être isolé à partir des « insights » avec la méthode actuelle.",
    weaknessesFallbackInsightStructured:
      "Pas de liste « weaknesses » structurée dans le rapport : les « insights » ne sont pas recopiés ici comme faiblesses formelles — voir actions prioritaires et écarts marché.",
    weaknessesFallbackNoStructuredAirbnb:
      "Aucune faiblesse dans les champs structurés du rapport pour l’instant — lecture incomplète, pas absence avérée de points à améliorer.",
    weaknessesFallbackNoStructuredDefault:
      "Aucune faiblesse dans les champs structurés du rapport pour l’instant — lecture incomplète, pas absence avérée de points à améliorer.",
    lqiNoteUnavailable: "Donnée non disponible pour cet axe dans cette vue.",
    lqiNoteListingNativeHigh:
      "Composante fournie par le rapport : niveau élevé sur cet axe — à valider sur le contenu réel de l’annonce.",
    lqiNoteListingNativeModerate:
      "Composante fournie par le rapport : niveau modéré — un signal parmi d’autres, pas un verdict isolé.",
    lqiNoteListingLocalHigh:
      "Synthèse locale /100 à partir des volets /10 déjà détaillés plus haut : même famille de signaux, vue condensée.",
    lqiNoteListingLocalFallback:
      "Synthèse locale /100 à partir des sous-scores /10 de l’audit — indicatif, déjà exploré ailleurs sur la page.",
    lqiNoteMarketNativeHigh:
      "Votre annonce reste compétitive face aux annonces proches analysées.",
    lqiNoteMarketNativeModerate:
      "Le positionnement marché est correct, mais encore améliorable.",
    lqiNoteMarketNativeLow:
      "Les concurrents observés semblent actuellement mieux positionnés.",
    lqiNoteMarketLocalHigh:
      "Synthèse locale (scores marché + global /10) : repère condensé, non indépendant des blocs marché.",
    lqiNoteMarketLocalFallback:
      "Synthèse locale (scores marché + global /10) : lecture indicative, croiser avec « Positionnement sur le marché ».",
    lqiNoteConversionUnavailable:
      "Pas de valeur /100 pour ce volet : voir score conversion et recommandations ailleurs.",
    lqiNoteConversionNativeHigh:
      "Le potentiel de conversion est déjà solide sur cette annonce.",
    lqiNoteConversionNativeModerate:
      "Plusieurs optimisations peuvent encore améliorer la conversion.",
    lqiNoteConversionNativeLow:
      "Des freins visibles limitent encore le potentiel de réservation.",
    lqiNoteConversionLocalFallback:
      "Indicatif : valeur complétée à partir d’un autre champ du rapport (potentiel réservation), pas une mesure conversion autonome.",
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
    detectedSourceTitle: "Fuente detectada: {value}",
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
    suggestedTextCopied: "Texto sugerido copiado al portapapeles.",
    noDescriptionToCopy: "No hay ninguna descripción para copiar por ahora.",
    noTextToCopy: "No hay ningún texto para copiar por ahora.",
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
    listingBadge: "Anuncio",
    bookingVariantBadge: "{value} · variante Booking",
    listingQuality: "Calidad del anuncio",
    listingQualityDescription: "Lectura de las señales internas: fotos, orden visual, descripción, equipamientos, SEO y capacidad de conversión.",
    globalConversionLevel: "Nivel global de conversión",
    realMarket: "Mercado real",
    observedMarket: "Mercado observado",
    observedMarketDescription: "Lectura basada en comparables retenidos, precios observados, fiabilidad del mercado y diferencia tarifaria.",
    listingCompetitivePosition: "Cómo se sitúa tu anuncio",
    competitiveSummary: "Resumen competitivo basado en los anuncios comparables retenidos.",
    outOfMarketSegmentShort: "Segmento fuera de mercado",
    percentAfterMarketConsolidation: "Porcentaje mostrado tras la consolidación del mercado",
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
    marketPositionNarrativeAbove: "Este anuncio parece rendir por encima de la media local cercana.",
    marketPositionNarrativeBelow: "Este anuncio parece rendir por debajo de la media local cercana.",
    marketPositionNarrativeNoComparables: "Todavía no se ha analizado ningún competidor cercano para esta auditoría.",
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
    photoBadgeLow: "{count} fotos • añade más elementos visuales",
    photoBadgeMedium: "{count} fotos • galería correcta",
    photoBadgeGood: "{count} fotos • galería sólida",
    photoBadgeExcellent: "{count} fotos • puntuación muy fuerte",
    heroImpactRevenueRange: "+{low} a +{high} / mes",
    marketIndicativeLabel: "Lectura indicativa (base limitada)",
    bookingLiftRange: "{low} a {high}",
    bookingLiftUpTo: "Hasta {value}",
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
    marketReliabilityTitleUsable: "Mercado utilizable",
    marketReliabilityTitleLimited: "Lectura limitada",
    marketReliabilityTitleLow: "Mercado local poco utilizable",
    marketReliabilityTitleWeakFallback: "Base local limitada",
    marketSourceLabelCrossPlatform: "Benchmark cross-platform",
    marketSourceMessageCrossPlatform:
      "Se utilizaron comparables ajenos a Booking por falta de comparables Booking suficientes.",
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
    pricingInsightUnderpriced:
      "Tu precio está {value}% por debajo de la mediana observada. Una subida progresiva hacia el precio recomendado podría mejorar los ingresos sin salir bruscamente del segmento competitivo analizado.",
    pricingInsightOptimal:
      "Tu precio está cerca de la mediana observada ({value}%). La palanca principal no es una fuerte subida de precio, sino mejorar la conversión y la presentación.",
    pricingInsightOverpriced:
      "Tu precio está {value}% por encima de la mediana observada. El precio puede convertirse en un freno si las señales de calidad no justifican claramente esa diferencia.",
    pricingIndicativeCaution:
      "{value} — interpreta el posicionamiento del precio con prudencia mientras la base local siga siendo limitada.",
    reportFrictionSignalsTitle: "Señales de fricción del informe",
    reportFrictionSignalsSubtitle:
      "Complemento únicamente: extractos fuera de las listas principales de «Debilidades» y «Principales brechas frente al mercado». Lectura indicativa, sin relación directa con una medida de reservas perdidas.",
    mainMarketGapsTitle: "Principales brechas frente al mercado",
    mainMarketGapsEmpty:
      "Por ahora no se enumera ninguna brecha de mercado en el informe: faltan datos o no están estructurados en este aspecto, lo que no significa necesariamente que no exista una brecha real.",
    mainMarketAdvantagesTitle: "Principales ventajas frente al mercado",
    mainMarketAdvantagesEmpty: "Por ahora no se ha identificado ninguna ventaja clara.",
    missingAmenitiesChecklistTitle: "Checklist de servicios faltantes",
    marketCompetitorPricesDispersed: "Precios de competidores dispersos",
    marketPricePositionWellAbove:
      "Tu precio está claramente por encima del mercado observado: debe justificarse con señales de calidad muy fuertes.",
    marketPricePositionSlightlyAbove:
      "Tu precio está ligeramente por encima del mercado: una posición premium es posible si la promesa es clara.",
    marketPricePositionBelow:
      "Tu precio está por debajo del mercado observado: parece haber margen para optimizar el precio.",
    marketPricePositionSlightlyBelow:
      "Tu precio está ligeramente por debajo del mercado: una posición atractiva con potencial de subida moderada.",
    marketPricePositionAligned:
      "Tu precio está alineado con el nivel medio observado en este mercado.",
    marketPricePositionPending:
      "El posicionamiento de precio se precisará en cuanto haya un precio medio competidor fiable.",
    priceDeltaIndicativeSample:
      "Diferencia indicativa basada en una muestra local limitada.",
    marketAverageRatingObserved:
      "Nota media de los competidores observados: {value}/{scale}.",
    marketAverageRatingUnavailable:
      "La nota media de los competidores todavía no es explotable.",
    competitorCountSupportAvailable:
      "Se retuvieron comparables para evaluar tu posicionamiento competitivo.",
    competitorCountSupportNone:
      "No se retuvo ningún comparable para esta lectura; el posicionamiento sigue siendo indicativo.",
    competitorCountSupportPending:
      "El posicionamiento sigue siendo una indicación que debe consolidarse mientras no haya un volumen exacto de comparables.",
    competitorCountSupportPartial:
      "La lectura del mercado sigue siendo parcial mientras no se consolide el volumen de comparables.",
    comparablesKpiLimited: "Lectura limitada",
    comparablesKpiNone: "Ningún comparable fiable",
    comparablesKpiOne: "Lectura limitada — 1 comparable utilizable",
    comparablesKpiTwo: "Lectura limitada — 2 comparables utilizables",
    lqiPartialIndex: "Índice parcial",
    lqiToConsolidate: "Por consolidar",
    insufficientData: "Datos insuficientes",
    revenueImpactRangeDisplay:
      "Actual estimado: {current} / mes · Tras la optimización: {low} a {high} / mes",
    monthlyGainQualifierLimited:
      "{value} — compáralo con más comparables para estabilizar la referencia.",
    monthlyGainQualifierFragile:
      "Hipótesis indicativa por confirmar (precio y/o comparables aún no son lo bastante fiables para una referencia de mercado clara).",
    insufficientComparablePricing: "Datos insuficientes: no hay comparables fiables para estimar la mediana o el impacto.",
    insufficientPricingData: "Datos de mercado insuficientes para estimar un impacto fiable.",
    pricingBenchmarks: "Referencias de precios",
    pricingBenchmarksTitle: "Cómo se sitúa tu precio frente al mercado",
    pricingBenchmarksDescription: "Referencias basadas en el precio medio observado y la diferencia con el mercado.",
    avgCompetitorPriceSupportInsufficient: "Muestra de mercado insuficiente para establecer una referencia de precio fiable.",
    avgCompetitorPriceSupportLimited: "Referencia indicativa: la base local todavía es limitada y debe consolidarse con más comparables.",
    avgCompetitorPriceSupportObserved: "Referencia competitiva observada en los anuncios retenidos para este segmento.",
    avgCompetitorPriceSupportPending: "La referencia de precio será más útil en cuanto pueda consolidarse un precio competidor fiable.",
    averageCompetitorPrice: "Precio medio competidor",
    priceGapVsMarket: "Diferencia de precio vs mercado",
    priceDeltaInsufficientSample: "Muestra insuficiente",
    priceDeltaUnavailable: "La diferencia de precio no puede calcularse aquí: el precio anunciado o la referencia de mercado son insuficientes para un porcentaje fiable.",
    priceDeltaPending: "En cuanto se consoliden un precio anunciado y una referencia de mercado fiable, aquí podrá mostrarse un porcentaje de diferencia.",
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
    estimatedBookingsAfterOptimization: "Reservas estimadas después de la optimización",
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
    estimatedImpactOnBookings: "Impacto estimado en las reservas",
    impactBusinessBlockIntroOutOfSegment: "Comparables retenidos fuera del segmento de precios: solo las recomendaciones de calidad, contenido y conversión visual pueden interpretarse de forma fiable.",
    impactBusinessBlockIntroDefault: "Cada tarjeta inferior utiliza una unidad fija: € para el precio, /10 para el mercado relativo, % para el aumento de reservas y €/mes para la ganancia mensual estimada (adicional, no los ingresos totales).",
    currentPriceContextCompareMarket: "Comparar con el precio medio de mercado estimado en {value}.",
    currentPriceContextDetected: "Precio actual detectado en el anuncio.",
    currentPriceContextMarketReference: "Precio actual no disponible. Referencia de mercado observada: ~{value}/noche.",
    currentPriceContextMissing: "El precio actual no aparece en este anuncio.",
    currentPriceUnavailable: "Precio actual no disponible",
    projectionBaseNoComparable: "No hay comparables suficientemente coherentes para establecer una media competitiva utilizable.",
    projectionBaseRobust: "Base competitiva robusta construida sobre {count} anuncios comparables.",
    projectionBasePartial: "Benchmark parcial basado en {count} comparables utilizables.",
    projectionBaseUnstable: "El mercado detectado sigue siendo demasiado inestable para ofrecer un benchmark competitivo fiable.",
    potentialToConfirm: "Potencial por confirmar",
    conversionGainLowConfidence: "El nivel de confianza del mercado sigue siendo insuficiente para proyectar una ganancia de conversión creíble.",
    conversionGainFromScoreAndPrice: "Proyección basada en la puntuación de conversión y el precio actual, sin un benchmark de precios competitivo fiable.",
    conversionGainOutOfSegment: "Comparables fuera de segmento detectados: el potencial de reservas no puede estimarse de forma fiable para este anuncio.",
    conversionGainPendingRange: "El rango en % se mostrará cuando la base de mercado sea lo bastante fiable (comparables y puntuación consolidada), igual que para la ganancia mensual estimada.",
    conversionGainEstimated: "Estimación basada en tu posicionamiento actual y en los anuncios competidores analizados.",
    conversionGainNoRange: "No hay rango porcentual disponible para el aumento de reservas en los datos actuales del informe.",
    monthlyGainOutOfSegment: "Comparables fuera de segmento: no se aplica ninguna proyección de ganancia a este mercado.",
    monthlyGainUnavailable: "Estimación no disponible: datos de mercado insuficientes. Un rango cuantificado utilizable requiere un precio anunciado fiable y una referencia competitiva consolidada.",
    monthlyGainNeedsStableMarket: "Una estimación cuantificada requiere un precio anunciado coherente y un nivel de mercado observado consolidado.",
    optimizedTexts: "Textos optimizados para el anuncio",
    optimizedTextVariantLabel: "Variante {index} - {label}",
    optimizedTextIntro:
      "Propuesta elaborada a partir de tu anuncio y de las señales del informe mediante modelos de texto locales (sin llamada a un modelo remoto en esta pantalla). Ajústala según tu marca.",
    optimizedTextVariantCounter: "Variante {index} / {total}",
    optimizedTextVariantNameComfort: "Confort y relax",
    optimizedTextVariantNamePractical: "Práctico y fluido",
    optimizedTextVariantNameNeighborhood: "Barrio y ubicación",
    optimizedTextVariantNamePremium: "Premium y confianza",
    optimizedTextVariantNameBusiness: "Estancia corta / business",
    variant: "Variante",
    changeVariant: "Cambiar variante",
    descriptionCopied: "Descripción copiada",
    newVariantReady: "Nueva variante lista.",
    currentTitle: "Título actual",
    optimizedTitleExample: "Ejemplo de título optimizado",
    aiGeneratingTitle: "Generando título IA…",
    missingListingTitle: "No hay ningún título disponible para este anuncio.",
    aiDescriptionPlaceholder: "La propuesta de texto aparecerá aquí en cuanto estén disponibles los datos del anuncio y de la auditoría.",
    aiGeneratingDescription: "Generación IA en curso…",
    aiProvenanceAi: "IA",
    aiProvenanceFallbackLocal: "Alternativa local",
    aiDescriptionFailed: "La generación de IA ha fallado para este idioma. Inténtalo de nuevo más tarde.",
    aiDescriptionUnavailable: "Todavía no hay una descripción Airbnb IA disponible para este idioma.",
    aiFallbackHousing: "Instálate en un alojamiento cómodo, práctico y pensado para que cada momento de la estancia resulte más sencillo.",
    aiFallbackDetailedHousing: "El alojamiento ofrece una experiencia completa, con espacios claros, equipamientos útiles y un ambiente agradable para disfrutar de la estancia.",
    aiFallbackGuestAccess: "Los viajeros disfrutan de un acceso sencillo al alojamiento, a los espacios previstos para la estancia y a los equipamientos útiles para el día a día.",
    aiFallbackGuestInteraction: "Sigo disponible antes y durante la estancia para compartir indicaciones útiles y responder de forma sencilla a las preguntas prácticas.",
    aiFallbackOtherInfo: "La información práctica facilita la llegada, aclara la organización de la estancia y ayuda a los viajeros a disfrutar del alojamiento con tranquilidad.",
    myPlace: "Mi alojamiento",
    detailedPlace: "Alojamiento (versión detallada)",
    guestAccess: "Acceso de los huéspedes",
    guestInteraction: "Comunicación con los huéspedes",
    otherInfo: "Otra información a tener en cuenta",
    bookingDescriptionSummary: "Resumen para la descripción (Booking)",
    bookingSummaryFallback:
      "Incluye en tu descripción: la comodidad de los espacios, el acceso al alojamiento, la disponibilidad para los viajeros y la información práctica útil a la llegada.",
    bookingSummaryReady: "Resumen listo para pegar, alineado con la variante mostrada.",
    actionPlan: "Plan de acción",
    actionPlanSubtitle: "Acciones a lanzar ahora, ordenadas por impacto business.",
    fallbackNarrativeFromWeaknesses:
      "Narrativa de respaldo basada en los puntos débiles del informe. Lectura indicativa, no un benchmark de mercado estricto.",
    fallbackNarrativeFromStrengths:
      "Narrativa de respaldo basada en los puntos fuertes del informe. Lectura indicativa, no un benchmark de mercado estricto.",
    actionPlanIntroAttractiveness:
      "Esta vista agrupa las palancas por prioridad para reforzar el atractivo, la hospitalidad y la puesta en escena de tu anuncio.",
    actionPlanIntroConversion:
      "Esta vista agrupa las mejoras por prioridad para aclarar la oferta, tranquilizar al viajero y acelerar la decisión.",
    actionPlanIntroStorytelling:
      "Las acciones se estructurarán aquí para reforzar la narrativa, la diferenciación y el deseo de estancia.",
    actionPlanIntroDefault:
      "Las acciones se estructurarán aquí en cuanto haya un plan de mejora detallado disponible.",
    actionSignalLabel: "Señal",
    actionImpactHigh: "impacto alto",
    actionImpactMedium: "impacto medio",
    actionImpactLow: "impacto bajo",
    actionScoreLabel: "Puntuación afectada",
    actionObjectiveLabel: "Objetivo",
    actionSignalFallback: "Señal por confirmar.",
    actionObjectiveFallback: "Priorizar según el impacto business detectado.",
    actionEmptyState: "No hay ninguna acción prioritaria disponible por el momento.",
    actionImprovementFallback: "Mejora {index}",
    actionScoreLineWithValue: "{label}: {value}/10.",
    actionScoreLinePending: "{label}: por confirmar.",
    actionLabelDescription: "Descripción",
    actionLabelSeo: "SEO",
    actionLabelPhotos: "Fotos",
    actionLabelAmenities: "Equipamientos",
    actionLabelConversion: "Conversión",
    actionNarrativeDescription:
      "El texto debe transformar mejor la información del anuncio en beneficios concretos para el viajero: confort, experiencia, ubicación y motivos para reservar.",
    actionReasonDescription: "Puntuación de descripción + calidad de proyección del viajero.",
    actionNarrativeSeo:
      "El título y las primeras líneas deben integrar mejor las palabras clave útiles: ubicación, equipamientos buscados y elementos diferenciadores.",
    actionReasonSeo: "Puntuación SEO + visibilidad en la plataforma.",
    actionNarrativePhotos:
      "Las imágenes deben seguir transmitiendo confianza desde los primeros segundos: mejores espacios primero, luz, confort y valor percibido.",
    actionReasonPhotos: "Puntuación de fotos + orden de galería.",
    actionNarrativeAmenities:
      "Los equipamientos clave deben ser más visibles para reducir dudas antes de reservar y aumentar la percepción de confort.",
    actionReasonAmenities: "Puntuación de equipamientos + confianza en la estancia.",
    actionLabelPricing: "Precio",
    actionNarrativeConversion:
      "La prioridad es reducir las dudas: promesa clara, pruebas visibles, información concreta y coherencia entre título, fotos y descripción.",
    actionReasonConversion: "Puntuación de conversión + fricción en la decisión.",
    actionReasonPricing: "Posicionamiento de precios + validación del mercado comparable.",
    actionReasonMarketComparables: "{count} anuncio(s) comparable(s) utilizado(s) para leer el mercado.",
    actionNarrativeFallback:
      "Acción del informe: priorizar según el impacto business y las señales disponibles.",
    actionNormalizedTitleClarify: "Aclarar la información que desencadena la reserva",
    actionNormalizedTitleConcreteValue: "Hacer el valor más concreto",
    actionNormalizedTitleAnalyzePricingGap: "Analizar la brecha tarifaria medida",
    actionNormalizedTitleBuildTrust: "Reforzar la confianza antes de reservar",
    actionNormalizedDescriptionPricingCompare:
      "Por hacer: compara la tarifa solo con anuncios realmente similares en tipo, ubicación y nivel de prestaciones antes de cualquier ajuste.",
    auditLeversDetailTitle: "Detalle de los palancas del anuncio",
    auditStrengthsTitle: "Puntos fuertes",
    auditStrengthsSource: "Fuente: señales fuertes medidas por los subindicadores de la auditoría.",
    auditStrengthsEmpty:
      "No se detectó ninguna señal fuerte medible de 8/10 o más en los subindicadores disponibles.",
    auditWeaknessesTitle: "Puntos débiles",
    auditWeaknessesSource: "Fuente: señales débiles medidas por los subindicadores de la auditoría.",
    auditWeaknessesEmpty:
      "No se detectó ninguna señal débil medible por debajo de 7/10 en los subindicadores disponibles.",
    auditStrengthPhotos: "Fotos sólidas: {score}/10.",
    auditStrengthPhotoOrder: "Orden de fotos sólido: {score}/10.",
    auditStrengthDescription: "Descripción sólida: {score}/10.",
    auditStrengthAmenities: "Equipamientos bien cubiertos: {score}/10.",
    auditStrengthSeo: "SEO sólido: {score}/10.",
    auditStrengthConversion: "Conversión sólida: {score}/10.",
    auditWeakDescription: "Descripción mejorable: {score}/10.",
    auditWeakSeo: "SEO a reforzar: {score}/10.",
    auditWeakConversion: "Conversión a reforzar: {score}/10.",
    auditWeakAmenities: "Equipamientos por completar: {score}/10.",
    auditWeakPhotoQuality: "Calidad de foto a mejorar: {score}/10.",
    auditWeakPhotoOrder: "Orden de fotos a revisar: {score}/10.",
    nextStepTitle: "Próximo paso recomendado",
    nextStepDescription:
      "Corrige primero las palancas más rentables y luego relanza una auditoría para medir la mejora obtenida.",
    nextStepRunAudit: "Relanzar una auditoría",
    nextStepBackToAudits: "Volver a las auditorías",
    nextStepAnalyzeAnother: "Analizar otro anuncio",
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
    scoreSideCardNarrativeLow:
      "Lectura /10: nivel frágil — detalle por pilar en «Nivel global de conversión».",
    scoreSideCardNarrativeMedium:
      "Lectura /10: nivel moderado — consulta las subpuntuaciones del bloque principal.",
    impactSideCardNarrativeOutOfMarket:
      "Segmento fuera de mercado: los datos de negocio no pueden utilizarse de forma fiable para este anuncio.",
    impactSideCardNarrativeMarketPending:
      "Puede existir un potencial de optimización en tu anuncio, pero el porcentaje cuantificado se mostrará cuando la base de mercado sea sólida (al menos tres comparables fiables y una puntuación de mercado consolidada), siguiendo el mismo principio que la estimación en euros.",
    impactSideCardNarrativeNoRange:
      "No hay un rango % utilizable para el lift en el informe.",
    prioritizedActionsIntroAirbnb:
      "Lista de recomendaciones generadas, ordenada para avanzar desde lo más diferenciador hasta lo más estructurante.",
    prioritizedActionsIntroDefault:
      "Lista de recomendaciones generadas, ordenada para maximizar claridad, confianza y conversión.",
    prioritizedActionsIntroEmpty:
      "Aún no se ha identificado ninguna acción prioritaria en esta auditoría.",
    prioritizedActionsSublineAirbnb:
      "Una secuencia para reforzar la emoción, la singularidad y las ganas de reservar.",
    prioritizedActionsSublineDefault:
      "Una secuencia para ofrecer rápidamente información útil, tranquilizadora y accionable.",
    strengthsFallbackAirbnb:
      "Aún no se ha identificado ningún punto fuerte estructurado: piensa en el storytelling, la acogida y lo que te diferencia.",
    strengthsFallbackDefault:
      "Aún no se ha identificado ningún punto fuerte estructurado: piensa en pruebas, claridad y confianza.",
    weaknessesFallbackInsightIsolated:
      "No se ha podido aislar ninguna debilidad distinta a partir de los «insights» con el método actual.",
    weaknessesFallbackInsightStructured:
      "No hay una lista estructurada de «weaknesses» en el informe: los «insights» no se copian aquí como debilidades formales; consulta las acciones prioritarias y las diferencias de mercado.",
    weaknessesFallbackNoStructuredAirbnb:
      "Por ahora no aparece ninguna debilidad en los campos estructurados del informe: la lectura es incompleta, no una prueba de que no haya nada que mejorar.",
    weaknessesFallbackNoStructuredDefault:
      "Por ahora no aparece ninguna debilidad en los campos estructurados del informe: la lectura es incompleta, no una prueba de que no haya nada que mejorar.",
    lqiNoteUnavailable: "No hay datos disponibles para este eje en esta vista.",
    lqiNoteListingNativeHigh:
      "Componente proporcionado por el informe: nivel alto en este eje, que debe validarse con el contenido real del anuncio.",
    lqiNoteListingNativeModerate:
      "Componente proporcionado por el informe: nivel moderado, una señal entre otras y no un veredicto aislado.",
    lqiNoteListingLocalHigh:
      "Síntesis local /100 a partir de las dimensiones /10 ya detalladas más arriba: misma familia de señales, vista condensada.",
    lqiNoteListingLocalFallback:
      "Síntesis local /100 a partir de las subpuntuaciones /10 de la auditoría: indicativa y ya explorada en otras partes de la página.",
    lqiNoteMarketNativeHigh:
      "Tu anuncio sigue siendo competitivo frente a los anuncios cercanos analizados.",
    lqiNoteMarketNativeModerate:
      "Tu posicionamiento de mercado es correcto, pero aún puede mejorarse.",
    lqiNoteMarketNativeLow:
      "Los competidores observados parecen estar mejor posicionados actualmente.",
    lqiNoteMarketLocalHigh:
      "Síntesis local (puntuaciones de mercado + global /10): marcador condensado, no independiente de los bloques de mercado.",
    lqiNoteMarketLocalFallback:
      "Síntesis local (puntuaciones de mercado + global /10): lectura indicativa, a cruzar con «Posicionamiento en el mercado».",
    lqiNoteConversionUnavailable:
      "No hay valor /100 para esta dimensión: consulta la puntuación de conversión y las recomendaciones en otras secciones.",
    lqiNoteConversionNativeHigh:
      "El potencial de conversión ya es sólido en este anuncio.",
    lqiNoteConversionNativeModerate:
      "Aún hay varias optimizaciones que pueden mejorar la conversión.",
    lqiNoteConversionNativeLow:
      "Todavía hay frenos visibles que limitan el potencial de reserva.",
    lqiNoteConversionLocalFallback:
      "Indicativo: valor completado a partir de otro campo del informe (potencial de reserva), no es una medida autónoma de conversión.",
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
    detectedSourceTitle: "Erkannte Quelle: {value}",
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
    suggestedTextCopied: "Vorgeschlagener Text in die Zwischenablage kopiert.",
    noDescriptionToCopy: "Derzeit gibt es keine Beschreibung zum Kopieren.",
    noTextToCopy: "Derzeit gibt es keinen Text zum Kopieren.",
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
    listingBadge: "Anzeige",
    bookingVariantBadge: "{value} · Booking-Variante",
    listingQuality: "Qualität der Anzeige",
    listingQualityDescription: "Interne Analyse Ihrer Anzeige: Fotos, visuelle Reihenfolge, Beschreibung, Ausstattung, SEO und Konversionspotenzial.",
    globalConversionLevel: "Gesamtes Konversionsniveau",
    realMarket: "Realer Markt",
    observedMarket: "Beobachteter Markt",
    observedMarketDescription: "Basierend auf berücksichtigten Vergleichsobjekten, beobachteten Konkurrenzpreisen, Marktzverlässigkeit und berechnetem Preisabstand.",
    listingCompetitivePosition: "Wie Ihre Anzeige im Vergleich steht",
    competitiveSummary: "Zusammenfassende Auswertung Ihrer Wettbewerbsposition auf Basis der berücksichtigten Vergleichsanzeigen.",
    outOfMarketSegmentShort: "Segment außerhalb des Marktes",
    percentAfterMarketConsolidation: "Prozentsatz wird nach Marktkonsolidierung angezeigt",
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
    marketPositionNarrativeAbove: "Dieses Inserat scheint über dem lokalen Durchschnitt in der Nähe zu liegen.",
    marketPositionNarrativeBelow: "Dieses Inserat scheint unter dem lokalen Durchschnitt in der Nähe zu liegen.",
    marketPositionNarrativeNoComparables: "Für dieses Audit wurden noch keine nahegelegenen Wettbewerber analysiert.",
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
    photoBadgeLow: "{count} Fotos • mehr Bildmaterial hinzufügen",
    photoBadgeMedium: "{count} Fotos • ordentliche Galerie",
    photoBadgeGood: "{count} Fotos • solide Galerie",
    photoBadgeExcellent: "{count} Fotos • sehr starke Bewertung",
    heroImpactRevenueRange: "+{low} bis +{high} / Monat",
    marketIndicativeLabel: "Indikative Lesart (begrenzte Basis)",
    bookingLiftRange: "{low} bis {high}",
    bookingLiftUpTo: "Bis zu {value}",
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
    marketReliabilityTitleUsable: "Nutzbarer Markt",
    marketReliabilityTitleLimited: "Begrenzte Auswertung",
    marketReliabilityTitleLow: "Lokaler Markt wenig nutzbar",
    marketReliabilityTitleWeakFallback: "Begrenzte lokale Basis",
    marketSourceLabelCrossPlatform: "Plattformübergreifender Benchmark",
    marketSourceMessageCrossPlatform:
      "Es wurden Nicht-Booking-Vergleichsobjekte verwendet, da nicht genügend Booking-Vergleichsobjekte vorhanden waren.",
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
    pricingInsightUnderpriced:
      "Ihr Preis liegt {value}% unter dem beobachteten Median. Eine schrittweise Erhöhung in Richtung des empfohlenen Preises könnte den Umsatz verbessern, ohne das analysierte Wettbewerbssegment abrupt zu verlassen.",
    pricingInsightOptimal:
      "Ihr Preis liegt nahe am beobachteten Median ({value}%). Der Haupthebel ist keine starke Preiserhöhung, sondern vielmehr eine bessere Conversion und Darstellung.",
    pricingInsightOverpriced:
      "Ihr Preis liegt {value}% über dem beobachteten Median. Der Preis kann zum Hemmnis werden, wenn die Qualitätssignale diesen Abstand nicht klar rechtfertigen.",
    pricingIndicativeCaution:
      "{value} — die Preispositionierung sollte vorsichtig interpretiert werden, solange die lokale Basis begrenzt bleibt.",
    reportFrictionSignalsTitle: "Reibungssignale aus dem Bericht",
    reportFrictionSignalsSubtitle:
      "Nur ergänzend: Auszüge außerhalb der Hauptlisten „Schwächen“ und „Wichtigste Marktunterschiede“. Indikativ, ohne direkten Bezug zu einer Messung verlorener Buchungen.",
    mainMarketGapsTitle: "Wichtigste Unterschiede zum Markt",
    mainMarketGapsEmpty:
      "Der Bericht listet derzeit keine Marktunterschiede auf — Daten fehlen oder sind in diesem Bereich nicht strukturiert, was nicht zwingend bedeutet, dass es keinen realen Unterschied gibt.",
    mainMarketAdvantagesTitle: "Wichtigste Vorteile gegenüber dem Markt",
    mainMarketAdvantagesEmpty: "Derzeit wurde kein klarer Vorteil identifiziert.",
    missingAmenitiesChecklistTitle: "Checkliste fehlender Ausstattungen",
    marketCompetitorPricesDispersed: "Stark gestreute Wettbewerberpreise",
    marketPricePositionWellAbove:
      "Ihr Preis liegt deutlich über dem beobachteten Markt: Das sollte durch sehr starke Qualitätssignale gerechtfertigt sein.",
    marketPricePositionSlightlyAbove:
      "Ihr Preis liegt leicht über dem Markt: Eine Premium-Positionierung ist möglich, wenn das Versprechen klar ist.",
    marketPricePositionBelow:
      "Ihr Preis liegt unter dem beobachteten Markt: Es scheint Preisspielraum für Optimierung zu geben.",
    marketPricePositionSlightlyBelow:
      "Ihr Preis liegt leicht unter dem Markt: eine attraktive Position mit moderatem Steigerungspotenzial.",
    marketPricePositionAligned:
      "Ihr Preis entspricht dem durchschnittlich beobachteten Niveau dieses Markts.",
    marketPricePositionPending:
      "Die Preisposition wird präzisiert, sobald ein verlässlicher durchschnittlicher Wettbewerbspreis verfügbar ist.",
    priceDeltaIndicativeSample:
      "Indikativer Abstand auf Basis einer begrenzten lokalen Stichprobe.",
    marketAverageRatingObserved:
      "Durchschnittliche Bewertung der beobachteten Wettbewerber: {value}/{scale}.",
    marketAverageRatingUnavailable:
      "Die durchschnittliche Bewertung der Wettbewerber ist noch nicht verwertbar.",
    competitorCountSupportAvailable:
      "Vergleichsobjekte wurden beibehalten, um Ihre Wettbewerbsposition zu bewerten.",
    competitorCountSupportNone:
      "Für diese Lesung wurde kein Vergleichsobjekt beibehalten; die Positionierung bleibt indikativ.",
    competitorCountSupportPending:
      "Die Positionierung bleibt ein Hinweis, der noch konsolidiert werden muss, solange kein exaktes Vergleichsvolumen vorliegt.",
    competitorCountSupportPartial:
      "Die Marktlesung bleibt teilweise, solange das Vergleichsvolumen nicht konsolidiert ist.",
    comparablesKpiLimited: "Begrenzte Lesung",
    comparablesKpiNone: "Kein verlässlicher Vergleich",
    comparablesKpiOne: "Begrenzte Lesung — 1 nutzbarer Vergleich",
    comparablesKpiTwo: "Begrenzte Lesung — 2 nutzbare Vergleiche",
    lqiPartialIndex: "Teilindex",
    lqiToConsolidate: "Zu konsolidieren",
    insufficientData: "Unzureichende Daten",
    revenueImpactRangeDisplay:
      "Aktuell geschätzt: {current} / Monat · Nach Optimierung: {low} bis {high} / Monat",
    monthlyGainQualifierLimited:
      "{value} — mit mehr Vergleichsobjekten abgleichen, um den Referenzwert zu stabilisieren.",
    monthlyGainQualifierFragile:
      "Indikative Annahme, die bestätigt werden muss (Preis und/oder Vergleichsobjekte sind noch nicht zuverlässig genug für einen klaren Marktreferenzwert).",
    insufficientComparablePricing: "Unzureichende Daten: kein verlässliches Vergleichsobjekt zur Schätzung von Median oder Preiseffekt.",
    insufficientPricingData: "Unzureichende Marktdaten für eine verlässliche Preisschätzung.",
    pricingBenchmarks: "Preis-Benchmarks",
    pricingBenchmarksTitle: "Wie Ihr Preis im Vergleich zum Wettbewerb steht",
    pricingBenchmarksDescription: "Preis-Benchmarks auf Basis der beobachteten Durchschnittspreise und der geschätzten Lücke zum vergleichbaren Markt.",
    avgCompetitorPriceSupportInsufficient: "Unzureichende Marktstichprobe, um einen verlässlichen Preisreferenzwert zu erstellen.",
    avgCompetitorPriceSupportLimited: "Indikativer Referenzwert: Die lokale Basis ist noch begrenzt und sollte mit mehr Vergleichsobjekten konsolidiert werden.",
    avgCompetitorPriceSupportObserved: "Beobachteter Wettbewerbsreferenzwert auf den für dieses Segment berücksichtigten Inseraten.",
    avgCompetitorPriceSupportPending: "Der Preisreferenzwert wird nützlicher, sobald ein verlässlicher Konkurrenzpreis konsolidiert werden kann.",
    averageCompetitorPrice: "Durchschnittlicher Wettbewerbspreis",
    priceGapVsMarket: "Preisabstand zum Markt",
    priceDeltaInsufficientSample: "Unzureichende Stichprobe",
    priceDeltaUnavailable: "Preisabstand kann hier nicht berechnet werden: Ausgeschriebener Preis oder Marktreferenz reichen nicht für einen verlässlichen Prozentsatz aus.",
    priceDeltaPending: "Sobald ein ausgeschriebener Preis und eine verlässliche Marktreferenz konsolidiert sind, kann hier ein prozentualer Abstand angezeigt werden.",
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
    estimatedBookingsAfterOptimization: "Geschätzte Buchungen nach der Optimierung",
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
    estimatedImpactOnBookings: "Geschätzte Auswirkung auf Buchungen",
    impactBusinessBlockIntroOutOfSegment: "Vergleichsobjekte außerhalb des Preissegments wurden berücksichtigt — nur Empfehlungen zu Qualität, Inhalt und visueller Konversion lassen sich verlässlich interpretieren.",
    impactBusinessBlockIntroDefault: "Jede Karte unten verwendet eine feste Einheit: € für den Preis, /10 für den relativen Marktwert, % für den Buchungsanstieg und €/Monat für den geschätzten monatlichen Gewinn (zusätzlich, nicht der Gesamtumsatz).",
    currentPriceContextCompareMarket: "Zu vergleichen mit dem geschätzten durchschnittlichen Marktpreis von {value}.",
    currentPriceContextDetected: "Aktueller Preis im Inserat erkannt.",
    currentPriceContextMarketReference: "Aktueller Preis nicht verfügbar. Beobachtete Marktreferenz: ~{value}/Nacht.",
    currentPriceContextMissing: "Der aktuelle Preis ist für dieses Inserat nicht verfügbar.",
    currentPriceUnavailable: "Aktueller Preis nicht verfügbar",
    projectionBaseNoComparable: "Keine ausreichend konsistenten Vergleichsobjekte, um einen nutzbaren Wettbewerbsdurchschnitt zu bilden.",
    projectionBaseRobust: "Robuste Wettbewerbsbasis auf Grundlage von {count} vergleichbaren Inseraten.",
    projectionBasePartial: "Teil-Benchmark auf Basis von {count} nutzbaren Vergleichsobjekten.",
    projectionBaseUnstable: "Der erkannte Markt bleibt zu instabil, um einen verlässlichen Wettbewerbs-Benchmark zu liefern.",
    potentialToConfirm: "Potenzial zu bestätigen",
    conversionGainLowConfidence: "Das Marktkonfidenzniveau bleibt unzureichend, um einen glaubwürdigen Konversionsgewinn zu projizieren.",
    conversionGainFromScoreAndPrice: "Projektion auf Basis des Konversionsscores und des aktuellen Preises, ohne verlässlichen wettbewerblichen Preis-Benchmark.",
    conversionGainOutOfSegment: "Vergleichsobjekte außerhalb des Segments erkannt — das Buchungspotenzial lässt sich für dieses Inserat nicht verlässlich schätzen.",
    conversionGainPendingRange: "Die %-Spanne wird angezeigt, sobald die Marktbasis hinreichend verlässlich ist (Vergleichsobjekte und konsolidierter Score), wie beim geschätzten monatlichen Gewinn.",
    conversionGainEstimated: "Schätzung auf Basis Ihrer aktuellen Positionierung und der analysierten Konkurrenzanzeigen.",
    conversionGainNoRange: "In den aktuellen Berichtsdaten ist keine prozentuale Spanne für den Buchungsanstieg verfügbar.",
    monthlyGainOutOfSegment: "Vergleichsobjekte außerhalb des Segments — für diesen Markt ist keine Gewinnprojektion anwendbar.",
    monthlyGainUnavailable: "Schätzung nicht verfügbar — unzureichende Marktdaten. Eine nutzbare bezifferte Spanne erfordert einen verlässlichen ausgeschriebenen Preis und eine konsolidierte Wettbewerbsreferenz.",
    monthlyGainNeedsStableMarket: "Eine bezifferte Schätzung erfordert einen stimmigen ausgeschriebenen Preis und ein konsolidiertes beobachtetes Marktniveau.",
    optimizedTexts: "Optimierte Anzeigentexte",
    optimizedTextVariantLabel: "Variante {index} - {label}",
    optimizedTextIntro:
      "Vorschlag, der aus Ihrer Anzeige und den Signalen des Berichts mit lokalen Textmodellen zusammengesetzt wurde (kein Aufruf eines Remote-Modells auf diesem Bildschirm). Passen Sie ihn an Ihre Marke an.",
    optimizedTextVariantCounter: "Variante {index} / {total}",
    optimizedTextVariantNameComfort: "Komfort & Entspannung",
    optimizedTextVariantNamePractical: "Praktisch & reibungslos",
    optimizedTextVariantNameNeighborhood: "Viertel & Lage",
    optimizedTextVariantNamePremium: "Premium & Vertrauen",
    optimizedTextVariantNameBusiness: "Kurzaufenthalt / Business",
    variant: "Variante",
    changeVariant: "Variante wechseln",
    descriptionCopied: "Beschreibung kopiert",
    newVariantReady: "Neue Variante bereit.",
    currentTitle: "Aktueller Titel",
    optimizedTitleExample: "Beispiel für optimierten Titel",
    aiGeneratingTitle: "KI-Titel wird generiert…",
    missingListingTitle: "Für diese Anzeige ist kein Titel verfügbar.",
    aiDescriptionPlaceholder: "Der Textvorschlag erscheint hier, sobald Angebots- und Auditdaten verfügbar sind.",
    aiGeneratingDescription: "KI-Generierung läuft…",
    aiProvenanceAi: "KI",
    aiProvenanceFallbackLocal: "Lokaler Fallback",
    aiDescriptionFailed: "Die KI-Generierung ist für diese Sprache fehlgeschlagen. Bitte später erneut versuchen.",
    aiDescriptionUnavailable: "Für diese Sprache ist noch keine KI-Airbnb-Beschreibung verfügbar.",
    aiFallbackHousing: "Richten Sie sich in einer komfortablen, alltagstauglichen Unterkunft ein, die jeden Moment des Aufenthalts einfacher macht.",
    aiFallbackDetailedHousing: "Die Unterkunft bietet ein rundes Erlebnis mit klaren Räumen, nützlicher Ausstattung und einer angenehmen Atmosphäre für den Aufenthalt.",
    aiFallbackGuestAccess: "Gäste profitieren von einem einfachen Zugang zur Unterkunft, zu den vorgesehenen Bereichen und zu den Ausstattungen für den Alltag.",
    aiFallbackGuestInteraction: "Ich bleibe vor und während des Aufenthalts erreichbar, um nützliche Hinweise zu teilen und praktische Fragen unkompliziert zu beantworten.",
    aiFallbackOtherInfo: "Praktische Informationen erleichtern die Anreise, klären die Organisation des Aufenthalts und helfen Gästen, die Unterkunft entspannt zu genießen.",
    myPlace: "Mein Zuhause",
    detailedPlace: "Unterkunft — detaillierte Version",
    guestAccess: "Gastzugang",
    guestInteraction: "Gastinteraktion",
    otherInfo: "Weitere Hinweise",
    bookingDescriptionSummary: "Beschreibungszusammenfassung (Booking)",
    bookingSummaryFallback:
      "In deine Beschreibung aufnehmen: den Komfort der Räume, den Zugang zur Unterkunft, die Verfügbarkeit für Gäste und praktische Informationen für die Anreise.",
    bookingSummaryReady: "Einfügebereite Zusammenfassung, abgestimmt auf die angezeigte Variante.",
    actionPlan: "Aktionsplan",
    actionPlanSubtitle: "Projekte, die jetzt gestartet werden sollten, geordnet nach Geschäftsauswirkung.",
    fallbackNarrativeFromWeaknesses:
      "Narrativer Fallback auf Basis der Schwächen im Bericht. Indikative Auswertung, kein strenger Marktbenchmark.",
    fallbackNarrativeFromStrengths:
      "Narrativer Fallback auf Basis der Stärken im Bericht. Indikative Auswertung, kein strenger Marktbenchmark.",
    actionPlanIntroAttractiveness:
      "Diese Ansicht gruppiert die Hebel nach Priorität, um Attraktivität, Gastfreundschaft und Präsentation Ihres Inserats zu stärken.",
    actionPlanIntroConversion:
      "Diese Ansicht gruppiert Verbesserungen nach Priorität, um das Angebot zu klären, Vertrauen zu schaffen und die Entscheidung zu beschleunigen.",
    actionPlanIntroStorytelling:
      "Die Maßnahmen werden hier strukturiert, um Storytelling, Differenzierung und Buchungswunsch zu unterstützen.",
    actionPlanIntroDefault:
      "Die Maßnahmen werden hier strukturiert, sobald ein detaillierter Verbesserungsplan verfügbar ist.",
    actionSignalLabel: "Signal",
    actionImpactHigh: "hohe Wirkung",
    actionImpactMedium: "mittlere Wirkung",
    actionImpactLow: "geringe Wirkung",
    actionScoreLabel: "Betroffener Score",
    actionObjectiveLabel: "Ziel",
    actionSignalFallback: "Signal zu bestätigen.",
    actionObjectiveFallback: "Nach der erkannten Business-Wirkung priorisieren.",
    actionEmptyState: "Derzeit ist keine prioritäre Maßnahme verfügbar.",
    actionImprovementFallback: "Verbesserung {index}",
    actionScoreLineWithValue: "{label}: {value}/10.",
    actionScoreLinePending: "{label}: zu bestätigen.",
    actionLabelDescription: "Beschreibung",
    actionLabelSeo: "SEO",
    actionLabelPhotos: "Fotos",
    actionLabelAmenities: "Ausstattung",
    actionLabelConversion: "Konversion",
    actionNarrativeDescription:
      "Der Text sollte die Informationen des Inserats besser in konkrete Vorteile für den Reisenden übersetzen: Komfort, Erlebnis, Lage und Gründe zu buchen.",
    actionReasonDescription: "Beschreibungs-Score + Qualität der Reisendenprojektion.",
    actionNarrativeSeo:
      "Titel und erste Zeilen sollten nützliche Keywords besser integrieren: Lage, gesuchte Ausstattungen und differenzierende Stärken.",
    actionReasonSeo: "SEO-Score + Plattform-Sichtbarkeit.",
    actionNarrativePhotos:
      "Die Bilder sollten von den ersten Sekunden an weiter Vertrauen schaffen: beste Räume zuerst, Licht, Komfort und wahrgenommener Wert.",
    actionReasonPhotos: "Foto-Score + Galeriereihenfolge.",
    actionNarrativeAmenities:
      "Wichtige Ausstattungen müssen sichtbarer werden, um Zweifel vor der Buchung zu reduzieren und den Komforteindruck zu erhöhen.",
    actionReasonAmenities: "Ausstattungs-Score + Aufenthaltsvertrauen.",
    actionLabelPricing: "Preis",
    actionNarrativeConversion:
      "Die Priorität ist, Zögern zu verringern: klares Versprechen, sichtbare Belege, konkrete Informationen und Konsistenz zwischen Titel, Fotos und Beschreibung.",
    actionReasonConversion: "Konversions-Score + Entscheidungsfriktion.",
    actionReasonPricing: "Preispositionierung + Validierung des Vergleichsmarkts.",
    actionReasonMarketComparables: "{count} Vergleichsanzeige(n) wurden zur Marktlesung verwendet.",
    actionNarrativeFallback:
      "Maßnahme aus dem Bericht: nach Business-Wirkung und verfügbaren Signalen priorisieren.",
    actionNormalizedTitleClarify: "Die Informationen klären, die Buchungen auslösen",
    actionNormalizedTitleConcreteValue: "Den Wert greifbarer machen",
    actionNormalizedTitleAnalyzePricingGap: "Die gemessene Preisabweichung analysieren",
    actionNormalizedTitleBuildTrust: "Vertrauen vor der Buchung stärken",
    actionNormalizedDescriptionPricingCompare:
      "Zu erledigen: Vergleichen Sie den Preis nur mit Inseraten, die in Typ, Lage und Leistungsniveau wirklich ähnlich sind, bevor Sie Anpassungen vornehmen.",
    auditLeversDetailTitle: "Details zu den Hebeln der Anzeige",
    auditStrengthsTitle: "Stärken",
    auditStrengthsSource: "Quelle: starke Signale, gemessen durch die Teil-Scores des Audits.",
    auditStrengthsEmpty:
      "Es wurde kein messbares starkes Signal von 8/10 oder mehr in den verfügbaren Teil-Scores erkannt.",
    auditWeaknessesTitle: "Schwächen",
    auditWeaknessesSource: "Quelle: schwache Signale, gemessen durch die Teil-Scores des Audits.",
    auditWeaknessesEmpty:
      "Es wurde kein messbares schwaches Signal unter 7/10 in den verfügbaren Teil-Scores erkannt.",
    auditStrengthPhotos: "Starke Fotos: {score}/10.",
    auditStrengthPhotoOrder: "Starke Reihenfolge der Fotos: {score}/10.",
    auditStrengthDescription: "Leistungsstarke Beschreibung: {score}/10.",
    auditStrengthAmenities: "Ausstattung gut abgedeckt: {score}/10.",
    auditStrengthSeo: "Starkes SEO: {score}/10.",
    auditStrengthConversion: "Starke Konversion: {score}/10.",
    auditWeakDescription: "Beschreibung verbesserbar: {score}/10.",
    auditWeakSeo: "SEO zu stärken: {score}/10.",
    auditWeakConversion: "Konversion zu stärken: {score}/10.",
    auditWeakAmenities: "Ausstattung zu ergänzen: {score}/10.",
    auditWeakPhotoQuality: "Fotoqualität zu verbessern: {score}/10.",
    auditWeakPhotoOrder: "Reihenfolge der Fotos zu überarbeiten: {score}/10.",
    nextStepTitle: "Empfohlener nächster Schritt",
    nextStepDescription:
      "Korrigieren Sie zuerst die profitabelsten Hebel und starten Sie anschließend erneut ein Audit, um den erzielten Gewinn zu messen.",
    nextStepRunAudit: "Audit erneut starten",
    nextStepBackToAudits: "Zurück zu den Audits",
    nextStepAnalyzeAnother: "Eine andere Anzeige analysieren",
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
    scoreSideCardNarrativeLow:
      "Lesart /10: fragiles Niveau — Details je Pfeiler im Block „Globales Konversionsniveau“.",
    scoreSideCardNarrativeMedium:
      "Lesart /10: mittleres Niveau — siehe die Teil-Scores im Hauptblock.",
    impactSideCardNarrativeOutOfMarket:
      "Marktsegment außerhalb des Vergleichs — Geschäftsdaten sind für dieses Inserat nicht zuverlässig nutzbar.",
    impactSideCardNarrativeMarketPending:
      "Es kann ein Optimierungspotenzial für Ihr Inserat bestehen, aber der bezifferte Prozentsatz wird erst angezeigt, wenn die Marktbasis solide ist (mindestens drei verlässliche Vergleichsobjekte und ein konsolidierter Marktscore) — nach demselben Prinzip wie die Euro-Schätzung.",
    impactSideCardNarrativeNoRange:
      "Im Bericht ist keine nutzbare %-Spanne für den Lift verfügbar.",
    prioritizedActionsIntroAirbnb:
      "Liste der generierten Empfehlungen, geordnet vom stärksten Differenzierungshebel bis zum strukturell wichtigsten Schritt.",
    prioritizedActionsIntroDefault:
      "Liste der generierten Empfehlungen, geordnet zur Maximierung von Klarheit, Vertrauen und Konversion.",
    prioritizedActionsIntroEmpty:
      "In diesem Audit wurde noch keine prioritäre Maßnahme hervorgehoben.",
    prioritizedActionsSublineAirbnb:
      "Eine Abfolge, die Emotion, Einzigartigkeit und den Wunsch zu buchen stärkt.",
    prioritizedActionsSublineDefault:
      "Eine Abfolge, um schnell nützliche, beruhigende und umsetzbare Informationen zu liefern.",
    strengthsFallbackAirbnb:
      "Es wurde noch keine strukturierte Stärke hervorgehoben — denken Sie an Storytelling, Gastfreundschaft und das, was Sie unterscheidet.",
    strengthsFallbackDefault:
      "Es wurde noch keine strukturierte Stärke hervorgehoben — denken Sie an Belege, Klarheit und Vertrauen.",
    weaknessesFallbackInsightIsolated:
      "Mit der aktuellen Methode konnte aus den „Insights“ keine klar abgegrenzte Schwäche isoliert werden.",
    weaknessesFallbackInsightStructured:
      "Im Bericht gibt es keine strukturierte „weaknesses“-Liste: Die „Insights“ werden hier nicht als formale Schwächen dupliziert — siehe priorisierte Maßnahmen und Marktunterschiede.",
    weaknessesFallbackNoStructuredAirbnb:
      "Derzeit ist keine Schwäche in den strukturierten Berichtsfeldern vorhanden — die Lesart ist unvollständig, aber kein Beweis dafür, dass es nichts zu verbessern gibt.",
    weaknessesFallbackNoStructuredDefault:
      "Derzeit ist keine Schwäche in den strukturierten Berichtsfeldern vorhanden — die Lesart ist unvollständig, aber kein Beweis dafür, dass es nichts zu verbessern gibt.",
    lqiNoteUnavailable: "Für diese Achse sind in dieser Ansicht keine Daten verfügbar.",
    lqiNoteListingNativeHigh:
      "Vom Bericht gelieferte Komponente: hohes Niveau auf dieser Achse — mit dem realen Inhalt des Inserats abzugleichen.",
    lqiNoteListingNativeModerate:
      "Vom Bericht gelieferte Komponente: mittleres Niveau — ein Signal unter mehreren, kein isoliertes Urteil.",
    lqiNoteListingLocalHigh:
      "Lokale /100-Synthese aus den oben bereits detaillierten /10-Dimensionen: gleiche Signalfamilie, verdichtete Ansicht.",
    lqiNoteListingLocalFallback:
      "Lokale /100-Synthese aus den /10-Teil-Scores des Audits — indikativ und bereits an anderer Stelle auf der Seite betrachtet.",
    lqiNoteMarketNativeHigh:
      "Ihr Inserat bleibt gegenüber den analysierten nahen Inseraten wettbewerbsfähig.",
    lqiNoteMarketNativeModerate:
      "Ihre Marktposition ist korrekt, aber noch verbesserbar.",
    lqiNoteMarketNativeLow:
      "Die beobachteten Wettbewerber scheinen derzeit besser positioniert zu sein.",
    lqiNoteMarketLocalHigh:
      "Lokale Synthese (Marktscores + Gesamtwert /10): verdichteter Marker, nicht unabhängig von den Marktblöcken.",
    lqiNoteMarketLocalFallback:
      "Lokale Synthese (Marktscores + Gesamtwert /10): indikative Lesart, mit „Marktpositionierung“ abzugleichen.",
    lqiNoteConversionUnavailable:
      "Für diese Dimension liegt kein /100-Wert vor: siehe Konversionsscore und Empfehlungen an anderer Stelle.",
    lqiNoteConversionNativeHigh:
      "Das Konversionspotenzial ist bei diesem Inserat bereits stark.",
    lqiNoteConversionNativeModerate:
      "Mehrere Optimierungen können die Konversion noch verbessern.",
    lqiNoteConversionNativeLow:
      "Sichtbare Reibungen begrenzen weiterhin das Buchungspotenzial.",
    lqiNoteConversionLocalFallback:
      "Indikativ: Wert aus einem anderen Berichtsfeld ergänzt (Buchungspotenzial), keine eigenständige Konversionsmessung.",
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
    detectedSourceTitle: "Fonte rilevata: {value}",
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
    suggestedTextCopied: "Testo suggerito copiato negli appunti.",
    noDescriptionToCopy: "Nessuna descrizione da copiare al momento.",
    noTextToCopy: "Nessun testo da copiare al momento.",
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
    listingBadge: "Annuncio",
    bookingVariantBadge: "{value} · variante Booking",
    listingQuality: "Qualità dell’annuncio",
    listingQualityDescription: "Analisi interna del tuo annuncio: foto, ordine visivo, descrizione, dotazioni, SEO e capacità di conversione.",
    globalConversionLevel: "Livello globale di conversione",
    realMarket: "Mercato reale",
    observedMarket: "Mercato osservato",
    observedMarketDescription: "Lettura basata sui comparabili mantenuti, sui prezzi osservati dei concorrenti, sull’affidabilità del mercato e sul gap tariffario calcolato.",
    listingCompetitivePosition: "Come si posiziona il tuo annuncio",
    competitiveSummary: "Lettura sintetica della tua posizione competitiva basata sugli annunci comparabili mantenuti.",
    outOfMarketSegmentShort: "Segmento fuori mercato",
    percentAfterMarketConsolidation: "Percentuale visualizzata dopo il consolidamento del mercato",
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
    marketPositionNarrativeAbove: "Questo annuncio sembra performare meglio della media locale nelle vicinanze.",
    marketPositionNarrativeBelow: "Questo annuncio sembra performare peggio della media locale nelle vicinanze.",
    marketPositionNarrativeNoComparables: "Nessun concorrente vicino è stato ancora analizzato per questo audit.",
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
    photoBadgeLow: "{count} foto • aggiungi più elementi visivi",
    photoBadgeMedium: "{count} foto • galleria corretta",
    photoBadgeGood: "{count} foto • galleria solida",
    photoBadgeExcellent: "{count} foto • punteggio molto forte",
    heroImpactRevenueRange: "+{low} a +{high} / mese",
    marketIndicativeLabel: "Lettura indicativa (base limitata)",
    bookingLiftRange: "{low} a {high}",
    bookingLiftUpTo: "Fino a {value}",
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
    marketReliabilityTitleUsable: "Mercato utilizzabile",
    marketReliabilityTitleLimited: "Lettura limitata",
    marketReliabilityTitleLow: "Mercato locale poco utilizzabile",
    marketReliabilityTitleWeakFallback: "Base locale limitata",
    marketSourceLabelCrossPlatform: "Benchmark multipiattaforma",
    marketSourceMessageCrossPlatform:
      "Sono stati utilizzati comparabili non Booking per mancanza di comparabili Booking sufficienti.",
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
    pricingInsightUnderpriced:
      "Il tuo prezzo è {value}% sotto la mediana osservata. Un aumento progressivo verso il prezzo consigliato potrebbe migliorare i ricavi senza uscire bruscamente dal segmento competitivo analizzato.",
    pricingInsightOptimal:
      "Il tuo prezzo è vicino alla mediana osservata ({value}%). La leva principale non è un forte aumento del prezzo, ma piuttosto il miglioramento della conversione e della presentazione.",
    pricingInsightOverpriced:
      "Il tuo prezzo è {value}% sopra la mediana osservata. Il prezzo può diventare un freno se i segnali di qualità non giustificano chiaramente questo divario.",
    pricingIndicativeCaution:
      "{value} — interpreta il posizionamento tariffario con prudenza finché la base locale resta limitata.",
    reportFrictionSignalsTitle: "Segnali di frizione dal report",
    reportFrictionSignalsSubtitle:
      "Solo complemento: estratti al di fuori delle liste principali «Punti deboli» e «Principali gap rispetto al mercato». Lettura indicativa, senza legame diretto con una misura delle prenotazioni perse.",
    mainMarketGapsTitle: "Principali scarti rispetto al mercato",
    mainMarketGapsEmpty:
      "Per ora nel report non è elencato alcun gap di mercato — mancano dati o non sono strutturati su questo punto, non significa necessariamente che non esista un gap reale.",
    mainMarketAdvantagesTitle: "Principali vantaggi rispetto al mercato",
    mainMarketAdvantagesEmpty: "Per ora non è stato identificato alcun vantaggio netto.",
    missingAmenitiesChecklistTitle: "Checklist dei servizi mancanti",
    marketCompetitorPricesDispersed: "Prezzi dei concorrenti dispersi",
    marketPricePositionWellAbove:
      "Il tuo prezzo è nettamente sopra il mercato osservato: deve essere giustificato da segnali di qualità molto forti.",
    marketPricePositionSlightlyAbove:
      "Il tuo prezzo è leggermente sopra il mercato: una posizione premium è possibile se la promessa è chiara.",
    marketPricePositionBelow:
      "Il tuo prezzo è sotto il mercato osservato: sembra esserci margine per un’ottimizzazione del prezzo.",
    marketPricePositionSlightlyBelow:
      "Il tuo prezzo è leggermente sotto il mercato: posizione attraente con potenziale di aumento misurato.",
    marketPricePositionAligned:
      "Il tuo prezzo è allineato al livello medio osservato su questo mercato.",
    marketPricePositionPending:
      "Il posizionamento tariffario sarà precisato non appena sarà disponibile un prezzo medio concorrente affidabile.",
    priceDeltaIndicativeSample:
      "Scarto indicativo basato su un campione locale limitato.",
    marketAverageRatingObserved:
      "Valutazione media dei concorrenti osservati: {value}/{scale}.",
    marketAverageRatingUnavailable:
      "La valutazione media dei concorrenti non è ancora utilizzabile.",
    competitorCountSupportAvailable:
      "Sono stati mantenuti comparabili per valutare il tuo posizionamento competitivo.",
    competitorCountSupportNone:
      "Nessun comparabile è stato mantenuto per questa lettura; il posizionamento resta indicativo.",
    competitorCountSupportPending:
      "Il posizionamento resta un’indicazione da consolidare finché non è disponibile un volume esatto di comparabili.",
    competitorCountSupportPartial:
      "La lettura del mercato resta parziale finché il volume di comparabili non viene consolidato.",
    comparablesKpiLimited: "Lettura limitata",
    comparablesKpiNone: "Nessun comparabile affidabile",
    comparablesKpiOne: "Lettura limitata — 1 comparabile utilizzabile",
    comparablesKpiTwo: "Lettura limitata — 2 comparabili utilizzabili",
    lqiPartialIndex: "Indice parziale",
    lqiToConsolidate: "Da consolidare",
    insufficientData: "Dati insufficienti",
    revenueImpactRangeDisplay:
      "Attuale stimato: {current} / mese · Dopo l’ottimizzazione: da {low} a {high} / mese",
    monthlyGainQualifierLimited:
      "{value} — confronta con più comparabili per stabilizzare il riferimento.",
    monthlyGainQualifierFragile:
      "Ipotesi indicativa da confermare (prezzo e/o comparabili non sono ancora abbastanza affidabili per un riferimento di mercato chiaro).",
    insufficientComparablePricing: "Dati insufficienti: nessun comparabile affidabile per stimare mediana o impatto di prezzo.",
    insufficientPricingData: "Dati di mercato insufficienti per stimare un impatto prezzo affidabile.",
    pricingBenchmarks: "Benchmark di prezzo",
    pricingBenchmarksTitle: "Come si colloca il tuo prezzo rispetto ai concorrenti",
    pricingBenchmarksDescription: "Benchmark di prezzo basati sui prezzi medi osservati e sul gap stimato rispetto al mercato comparabile.",
    avgCompetitorPriceSupportInsufficient: "Campione di mercato insufficiente per stabilire un riferimento di prezzo affidabile.",
    avgCompetitorPriceSupportLimited: "Riferimento indicativo: la base locale è ancora limitata e va consolidata con più comparabili.",
    avgCompetitorPriceSupportObserved: "Riferimento competitivo osservato sugli annunci selezionati per questo segmento.",
    avgCompetitorPriceSupportPending: "Il riferimento di prezzo sarà più utile non appena potrà essere consolidato un prezzo concorrente affidabile.",
    averageCompetitorPrice: "Prezzo medio dei concorrenti",
    priceGapVsMarket: "Gap di prezzo vs mercato",
    priceDeltaInsufficientSample: "Campione insufficiente",
    priceDeltaUnavailable: "Lo scarto di prezzo non può essere calcolato qui: prezzo annunciato o riferimento di mercato insufficienti per una percentuale affidabile.",
    priceDeltaPending: "Non appena un prezzo annunciato e un riferimento di mercato affidabile saranno consolidati, qui potrà essere mostrata una percentuale di scarto.",
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
    estimatedBookingsAfterOptimization: "Prenotazioni stimate dopo l’ottimizzazione",
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
    estimatedImpactOnBookings: "Impatto stimato sulle prenotazioni",
    impactBusinessBlockIntroOutOfSegment: "Comparabili trattenuti fuori dal segmento di prezzo: solo le raccomandazioni su qualità, contenuto e conversione visiva possono essere interpretate in modo affidabile.",
    impactBusinessBlockIntroDefault: "Ogni scheda qui sotto usa un’unità fissa: € per il prezzo, /10 per il mercato relativo, % per l’aumento delle prenotazioni e €/mese per il guadagno mensile stimato (aggiuntivo, non il fatturato totale).",
    currentPriceContextCompareMarket: "Da confrontare con il prezzo medio di mercato stimato a {value}.",
    currentPriceContextDetected: "Prezzo attuale rilevato nell’annuncio.",
    currentPriceContextMarketReference: "Prezzo attuale non disponibile. Riferimento di mercato osservato: ~{value}/notte.",
    currentPriceContextMissing: "Il prezzo attuale non è disponibile per questo annuncio.",
    currentPriceUnavailable: "Prezzo attuale non disponibile",
    projectionBaseNoComparable: "Nessun comparabile sufficientemente coerente per stabilire una media competitiva utilizzabile.",
    projectionBaseRobust: "Base competitiva solida costruita su {count} annunci comparabili.",
    projectionBasePartial: "Benchmark parziale basato su {count} comparabili utilizzabili.",
    projectionBaseUnstable: "Il mercato rilevato resta troppo instabile per fornire un benchmark competitivo affidabile.",
    potentialToConfirm: "Potenziale da confermare",
    conversionGainLowConfidence: "Il livello di fiducia del mercato resta insufficiente per proiettare un guadagno di conversione credibile.",
    conversionGainFromScoreAndPrice: "Proiezione basata sul punteggio di conversione e sul prezzo attuale, senza un benchmark tariffario competitivo affidabile.",
    conversionGainOutOfSegment: "Comparabili fuori segmento rilevati: il potenziale di prenotazione non può essere stimato con affidabilità per questo annuncio.",
    conversionGainPendingRange: "La fascia in % sarà mostrata quando la base di mercato sarà sufficientemente affidabile (comparabili e punteggio consolidato), come per il guadagno mensile stimato.",
    conversionGainEstimated: "Stima basata sul tuo posizionamento attuale e sugli annunci concorrenti analizzati.",
    conversionGainNoRange: "Nessuna fascia percentuale disponibile per l’aumento delle prenotazioni nei dati attuali del report.",
    monthlyGainOutOfSegment: "Comparabili fuori segmento — nessuna proiezione di guadagno applicabile a questo mercato.",
    monthlyGainUnavailable: "Stima non disponibile — dati di mercato insufficienti. Una fascia quantificata utilizzabile richiede un prezzo annunciato affidabile e un riferimento competitivo consolidato.",
    monthlyGainNeedsStableMarket: "Una stima quantificata richiede un prezzo annunciato coerente e un livello di mercato osservato consolidato.",
    optimizedTexts: "Testi dell’annuncio ottimizzati",
    optimizedTextVariantLabel: "Variante {index} - {label}",
    optimizedTextIntro:
      "Proposta assemblata a partire dal tuo annuncio e dai segnali del report tramite modelli di testo locali (nessuna chiamata a un modello remoto in questa schermata). Adattala al tuo brand.",
    optimizedTextVariantCounter: "Variante {index} / {total}",
    optimizedTextVariantNameComfort: "Comfort e relax",
    optimizedTextVariantNamePractical: "Pratico e fluido",
    optimizedTextVariantNameNeighborhood: "Quartiere e posizione",
    optimizedTextVariantNamePremium: "Premium e fiducia",
    optimizedTextVariantNameBusiness: "Soggiorno breve / business",
    variant: "Variante",
    changeVariant: "Cambia variante",
    descriptionCopied: "Descrizione copiata",
    newVariantReady: "Nuova variante pronta.",
    currentTitle: "Titolo attuale",
    optimizedTitleExample: "Esempio di titolo ottimizzato",
    aiGeneratingTitle: "Generazione titolo IA…",
    missingListingTitle: "Nessun titolo disponibile per questo annuncio.",
    aiDescriptionPlaceholder: "La proposta di testo apparirà qui non appena saranno disponibili i dati dell’annuncio e dell’audit.",
    aiGeneratingDescription: "Generazione IA in corso…",
    aiProvenanceAi: "IA",
    aiProvenanceFallbackLocal: "Fallback locale",
    aiDescriptionFailed: "La generazione IA non è riuscita per questa lingua. Riprova più tardi.",
    aiDescriptionUnavailable: "Non è ancora disponibile una descrizione Airbnb IA per questa lingua.",
    aiFallbackHousing: "Sistemati in un alloggio confortevole, facile da vivere e pensato per rendere più semplice ogni momento del soggiorno.",
    aiFallbackDetailedHousing: "L’alloggio offre un’esperienza completa, con spazi chiari, dotazioni utili e un’atmosfera piacevole per godersi il soggiorno.",
    aiFallbackGuestAccess: "Gli ospiti usufruiscono di un accesso semplice all’alloggio, agli spazi previsti per il soggiorno e alle dotazioni utili nella vita quotidiana.",
    aiFallbackGuestInteraction: "Resto disponibile prima e durante il soggiorno per condividere indicazioni utili e rispondere con semplicità alle domande pratiche.",
    aiFallbackOtherInfo: "Le informazioni pratiche facilitano l’arrivo, chiariscono l’organizzazione del soggiorno e aiutano gli ospiti a godersi l’alloggio con serenità.",
    myPlace: "Il mio alloggio",
    detailedPlace: "Alloggio — versione dettagliata",
    guestAccess: "Accesso ospiti",
    guestInteraction: "Interazione con gli ospiti",
    otherInfo: "Altre informazioni da sapere",
    bookingDescriptionSummary: "Riepilogo descrizione (Booking)",
    bookingSummaryFallback:
      "Da integrare nella descrizione: il comfort degli spazi, l’accesso all’alloggio, la disponibilità per gli ospiti e le informazioni pratiche utili all’arrivo.",
    bookingSummaryReady: "Riepilogo pronto da incollare, allineato alla variante visualizzata.",
    actionPlan: "Piano d’azione",
    actionPlanSubtitle: "Progetti da avviare subito, ordinati per impatto business.",
    fallbackNarrativeFromWeaknesses:
      "Narrativa di fallback basata sui punti deboli del report. Lettura indicativa, non un benchmark di mercato rigoroso.",
    fallbackNarrativeFromStrengths:
      "Narrativa di fallback basata sui punti di forza del report. Lettura indicativa, non un benchmark di mercato rigoroso.",
    actionPlanIntroAttractiveness:
      "Questa vista raggruppa le leve per priorità per rafforzare attrattività, ospitalità e presentazione del tuo annuncio.",
    actionPlanIntroConversion:
      "Questa vista raggruppa i miglioramenti per priorità per chiarire l’offerta, rassicurare il viaggiatore e accelerare la decisione.",
    actionPlanIntroStorytelling:
      "Le azioni saranno strutturate qui per sostenere narrazione, differenziazione e desiderio di soggiorno.",
    actionPlanIntroDefault:
      "Le azioni saranno strutturate qui non appena sarà disponibile un piano di miglioramento dettagliato.",
    actionSignalLabel: "Segnale",
    actionImpactHigh: "impatto alto",
    actionImpactMedium: "impatto medio",
    actionImpactLow: "impatto basso",
    actionScoreLabel: "Punteggio interessato",
    actionObjectiveLabel: "Obiettivo",
    actionSignalFallback: "Segnale da confermare.",
    actionObjectiveFallback: "Dare priorità in base all’impatto business rilevato.",
    actionEmptyState: "Nessuna azione prioritaria disponibile al momento.",
    actionImprovementFallback: "Miglioramento {index}",
    actionScoreLineWithValue: "{label}: {value}/10.",
    actionScoreLinePending: "{label}: da confermare.",
    actionLabelDescription: "Descrizione",
    actionLabelSeo: "SEO",
    actionLabelPhotos: "Foto",
    actionLabelAmenities: "Dotazioni",
    actionLabelConversion: "Conversione",
    actionNarrativeDescription:
      "Il testo deve trasformare meglio le informazioni dell’annuncio in benefici concreti per il viaggiatore: comfort, esperienza, posizione e motivi per prenotare.",
    actionReasonDescription: "Punteggio descrizione + qualità della proiezione viaggiatore.",
    actionNarrativeSeo:
      "Il titolo e le prime righe devono integrare meglio le parole chiave utili: posizione, dotazioni ricercate e punti di forza distintivi.",
    actionReasonSeo: "Punteggio SEO + visibilità sulla piattaforma.",
    actionNarrativePhotos:
      "Le immagini devono continuare a rassicurare fin dai primi secondi: spazi migliori per primi, luce, comfort e valore percepito.",
    actionReasonPhotos: "Punteggio foto + ordine della galleria.",
    actionNarrativeAmenities:
      "Le dotazioni chiave devono essere più visibili per ridurre i dubbi prima della prenotazione e aumentare la percezione di comfort.",
    actionReasonAmenities: "Punteggio dotazioni + rassicurazione sul soggiorno.",
    actionLabelPricing: "Prezzo",
    actionNarrativeConversion:
      "La priorità è ridurre le esitazioni: promessa chiara, prove visibili, informazioni concrete e coerenza tra titolo, foto e descrizione.",
    actionReasonConversion: "Punteggio conversione + frizione decisionale.",
    actionReasonPricing: "Posizionamento prezzo + validazione del mercato comparabile.",
    actionReasonMarketComparables: "{count} annuncio/i comparabile/i utilizzato/i per leggere il mercato.",
    actionNarrativeFallback:
      "Azione dal report: dare priorità in base all’impatto business e ai segnali disponibili.",
    actionNormalizedTitleClarify: "Chiarire le informazioni che fanno scattare la prenotazione",
    actionNormalizedTitleConcreteValue: "Rendere il valore più concreto",
    actionNormalizedTitleAnalyzePricingGap: "Analizzare il divario tariffario misurato",
    actionNormalizedTitleBuildTrust: "Rafforzare la fiducia prima della prenotazione",
    actionNormalizedDescriptionPricingCompare:
      "Da fare: confronta la tariffa solo con annunci davvero simili per tipologia, posizione e livello di servizio prima di qualsiasi modifica.",
    auditLeversDetailTitle: "Dettaglio delle leve dell’annuncio",
    auditStrengthsTitle: "Punti di forza",
    auditStrengthsSource: "Fonte: segnali forti misurati dai sotto-punteggi dell’audit.",
    auditStrengthsEmpty:
      "Nessun segnale forte misurabile a 8/10 o superiore è stato rilevato nei sotto-punteggi disponibili.",
    auditWeaknessesTitle: "Punti deboli",
    auditWeaknessesSource: "Fonte: segnali deboli misurati dai sotto-punteggi dell’audit.",
    auditWeaknessesEmpty:
      "Nessun segnale debole misurabile sotto 7/10 è stato rilevato nei sotto-punteggi disponibili.",
    auditStrengthPhotos: "Foto solide: {score}/10.",
    auditStrengthPhotoOrder: "Ordine delle foto solido: {score}/10.",
    auditStrengthDescription: "Descrizione performante: {score}/10.",
    auditStrengthAmenities: "Dotazioni ben coperte: {score}/10.",
    auditStrengthSeo: "SEO solido: {score}/10.",
    auditStrengthConversion: "Conversione solida: {score}/10.",
    auditWeakDescription: "Descrizione migliorabile: {score}/10.",
    auditWeakSeo: "SEO da rafforzare: {score}/10.",
    auditWeakConversion: "Conversione da rafforzare: {score}/10.",
    auditWeakAmenities: "Dotazioni da completare: {score}/10.",
    auditWeakPhotoQuality: "Qualità foto da migliorare: {score}/10.",
    auditWeakPhotoOrder: "Ordine delle foto da rivedere: {score}/10.",
    nextStepTitle: "Prossimo passaggio consigliato",
    nextStepDescription:
      "Correggi prima le leve più redditizie, poi rilancia un audit per misurare il guadagno ottenuto.",
    nextStepRunAudit: "Rilancia un audit",
    nextStepBackToAudits: "Torna agli audit",
    nextStepAnalyzeAnother: "Analizza un altro annuncio",
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
    scoreSideCardNarrativeLow:
      "Lettura /10: livello fragile — dettaglio per pilastro in «Livello globale di conversione».",
    scoreSideCardNarrativeMedium:
      "Lettura /10: livello moderato — vedi i sotto-punteggi del blocco principale.",
    impactSideCardNarrativeOutOfMarket:
      "Segmento fuori mercato — i dati business non sono utilizzabili in modo affidabile per questo annuncio.",
    impactSideCardNarrativeMarketPending:
      "Potrebbe esserci un potenziale di ottimizzazione sul tuo annuncio, ma la percentuale quantificata verrà mostrata quando la base di mercato sarà solida (almeno tre comparabili affidabili e un punteggio di mercato consolidato), seguendo lo stesso principio della stima in euro.",
    impactSideCardNarrativeNoRange:
      "Nel report non è disponibile una fascia % utilizzabile per il lift.",
    prioritizedActionsIntroAirbnb:
      "Elenco delle raccomandazioni generate, ordinato per passare da ciò che differenzia di più a ciò che struttura di più.",
    prioritizedActionsIntroDefault:
      "Elenco delle raccomandazioni generate, ordinato per massimizzare chiarezza, rassicurazione e conversione.",
    prioritizedActionsIntroEmpty:
      "Nessuna azione prioritaria è ancora emersa in questo audit.",
    prioritizedActionsSublineAirbnb:
      "Una sequenza per rafforzare emozione, unicità e desiderio di prenotare.",
    prioritizedActionsSublineDefault:
      "Una sequenza per offrire rapidamente informazioni utili, rassicuranti e azionabili.",
    strengthsFallbackAirbnb:
      "Non è ancora emerso alcun punto di forza strutturato: pensa a storytelling, accoglienza e a ciò che ti distingue.",
    strengthsFallbackDefault:
      "Non è ancora emerso alcun punto di forza strutturato: pensa a prove, chiarezza e rassicurazione.",
    weaknessesFallbackInsightIsolated:
      "Con il metodo attuale non è stato possibile isolare un punto debole distinto a partire dagli «insights».",
    weaknessesFallbackInsightStructured:
      "Nel report non è presente un elenco strutturato di «weaknesses»: gli «insights» non vengono duplicati qui come debolezze formali — vedi azioni prioritarie e scarti di mercato.",
    weaknessesFallbackNoStructuredAirbnb:
      "Per ora non compare alcuna debolezza nei campi strutturati del report: la lettura è incompleta, non la prova che non ci sia nulla da migliorare.",
    weaknessesFallbackNoStructuredDefault:
      "Per ora non compare alcuna debolezza nei campi strutturati del report: la lettura è incompleta, non la prova che non ci sia nulla da migliorare.",
    lqiNoteUnavailable: "I dati non sono disponibili per questo asse in questa vista.",
    lqiNoteListingNativeHigh:
      "Componente fornita dal report: livello alto su questo asse, da verificare rispetto al contenuto reale dell’annuncio.",
    lqiNoteListingNativeModerate:
      "Componente fornita dal report: livello moderato, un segnale tra gli altri e non un verdetto isolato.",
    lqiNoteListingLocalHigh:
      "Sintesi locale /100 a partire dalle dimensioni /10 già dettagliate sopra: stessa famiglia di segnali, vista condensata.",
    lqiNoteListingLocalFallback:
      "Sintesi locale /100 a partire dai sotto-punteggi /10 dell’audit: indicativa e già esplorata altrove nella pagina.",
    lqiNoteMarketNativeHigh:
      "Il tuo annuncio resta competitivo rispetto agli annunci vicini analizzati.",
    lqiNoteMarketNativeModerate:
      "Il tuo posizionamento di mercato è corretto, ma ancora migliorabile.",
    lqiNoteMarketNativeLow:
      "I concorrenti osservati sembrano attualmente meglio posizionati.",
    lqiNoteMarketLocalHigh:
      "Sintesi locale (punteggi di mercato + globale /10): indicatore condensato, non indipendente dai blocchi di mercato.",
    lqiNoteMarketLocalFallback:
      "Sintesi locale (punteggi di mercato + globale /10): lettura indicativa, da confrontare con «Posizionamento sul mercato».",
    lqiNoteConversionUnavailable:
      "Nessun valore /100 disponibile per questa dimensione: vedi il punteggio di conversione e le raccomandazioni altrove.",
    lqiNoteConversionNativeHigh:
      "Il potenziale di conversione è già solido su questo annuncio.",
    lqiNoteConversionNativeModerate:
      "Diverse ottimizzazioni possono ancora migliorare la conversione.",
    lqiNoteConversionNativeLow:
      "Sono ancora presenti frizioni visibili che limitano il potenziale di prenotazione.",
    lqiNoteConversionLocalFallback:
      "Indicativo: valore completato a partire da un altro campo del report (potenziale di prenotazione), non è una misura autonoma della conversione.",
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
    detectedSourceTitle: "Origem detectada: {value}",
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
    suggestedTextCopied: "Texto sugerido copiado para a área de transferência.",
    noDescriptionToCopy: "Nenhuma descrição para copiar neste momento.",
    noTextToCopy: "Nenhum texto para copiar neste momento.",
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
    listingBadge: "Anúncio",
    bookingVariantBadge: "{value} · variante Booking",
    listingQuality: "Qualidade do anúncio",
    listingQualityDescription: "Análise interna do seu anúncio: fotos, ordem visual, descrição, comodidades, SEO e capacidade de conversão.",
    globalConversionLevel: "Nível global de conversão",
    realMarket: "Mercado real",
    observedMarket: "Mercado observado",
    observedMarketDescription: "Leitura baseada nos comparáveis retidos, nos preços concorrentes observados, na fiabilidade do mercado e na diferença tarifária calculada.",
    listingCompetitivePosition: "Como o seu anúncio se posiciona",
    competitiveSummary: "Leitura sintética da sua posição competitiva com base nos anúncios comparáveis retidos.",
    outOfMarketSegmentShort: "Segmento fora de mercado",
    percentAfterMarketConsolidation: "Percentagem exibida após a consolidação do mercado",
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
    marketPositionNarrativeAbove: "Este anúncio parece ter um desempenho acima da média local próxima.",
    marketPositionNarrativeBelow: "Este anúncio parece ter um desempenho abaixo da média local próxima.",
    marketPositionNarrativeNoComparables: "Ainda não foi analisado nenhum concorrente próximo para esta auditoria.",
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
    photoBadgeLow: "{count} fotos • adicione mais visuais",
    photoBadgeMedium: "{count} fotos • galeria correta",
    photoBadgeGood: "{count} fotos • galeria sólida",
    photoBadgeExcellent: "{count} fotos • pontuação muito forte",
    heroImpactRevenueRange: "+{low} a +{high} / mês",
    marketIndicativeLabel: "Leitura indicativa (base limitada)",
    bookingLiftRange: "{low} a {high}",
    bookingLiftUpTo: "Até {value}",
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
    marketReliabilityTitleUsable: "Mercado utilizável",
    marketReliabilityTitleLimited: "Leitura limitada",
    marketReliabilityTitleLow: "Mercado local pouco utilizável",
    marketReliabilityTitleWeakFallback: "Base local limitada",
    marketSourceLabelCrossPlatform: "Benchmark multiplataforma",
    marketSourceMessageCrossPlatform:
      "Foram usados comparáveis não Booking por falta de comparáveis Booking suficientes.",
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
    pricingInsightUnderpriced:
      "O seu preço está {value}% abaixo da mediana observada. Um aumento progressivo até ao preço recomendado pode melhorar a receita sem sair abruptamente do segmento concorrencial analisado.",
    pricingInsightOptimal:
      "O seu preço está próximo da mediana observada ({value}%). A principal alavanca não é um aumento forte do preço, mas sim melhorar a conversão e a apresentação.",
    pricingInsightOverpriced:
      "O seu preço está {value}% acima da mediana observada. O preço pode tornar-se um ponto de fricção se os sinais de qualidade não justificarem claramente esta diferença.",
    pricingIndicativeCaution:
      "{value} — interprete o posicionamento de preço com prudência enquanto a base local continuar limitada.",
    insufficientComparablePricing: "Dados insuficientes: nenhum comparável fiável para estimar a mediana ou o impacto tarifário.",
    insufficientPricingData: "Dados de mercado insuficientes para estimar um impacto tarifário fiável.",
    pricingBenchmarks: "Referências de preço",
    pricingBenchmarksTitle: "Como o seu preço se posiciona face aos concorrentes",
    pricingBenchmarksDescription: "Referências de preço baseadas nos preços médios observados e na diferença estimada face ao mercado comparável.",
    reportFrictionSignalsTitle: "Sinais de fricção do relatório",
    reportFrictionSignalsSubtitle:
      "Complemento apenas: excertos fora das listas principais «Pontos fracos» e «Principais diferenças face ao mercado». Indicativo, sem ligação direta a uma medida de reservas perdidas.",
    mainMarketGapsTitle: "Principais diferenças face ao mercado",
    mainMarketGapsEmpty:
      "Nenhuma diferença de mercado está listada no relatório por agora — os dados estão em falta ou não estruturados nesta dimensão, o que não significa necessariamente ausência de diferença real.",
    mainMarketAdvantagesTitle: "Principais vantagens face ao mercado",
    mainMarketAdvantagesEmpty:
      "Nenhuma vantagem clara foi identificada por agora.",
    missingAmenitiesChecklistTitle: "Checklist de comodidades em falta",
    avgCompetitorPriceSupportInsufficient: "Amostra de mercado insuficiente para estabelecer uma referência de preço fiável.",
    avgCompetitorPriceSupportLimited: "Referência indicativa: a base local ainda é limitada e deve ser consolidada com mais comparáveis.",
    avgCompetitorPriceSupportObserved: "Referência concorrencial observada nos anúncios retidos para este segmento.",
    avgCompetitorPriceSupportPending: "A referência de preço será mais útil assim que puder ser consolidado um preço concorrente fiável.",
    averageCompetitorPrice: "Preço médio dos concorrentes",
    priceGapVsMarket: "Diferença de preço vs mercado",
    priceDeltaInsufficientSample: "Amostra insuficiente",
    marketCompetitorPricesDispersed: "Preços dos concorrentes dispersos",
    priceDeltaUnavailable: "A diferença de preço não pode ser calculada aqui: preço anunciado ou referência de mercado insuficientes para uma percentagem fiável.",
    priceDeltaPending: "Assim que um preço anunciado e uma referência de mercado fiável forem consolidados, uma percentagem de diferença poderá ser exibida aqui.",
    notReliable: "Não fiável",
    marketAnalysisPending: "Análise pendente até existir uma amostra de mercado suficiente.",
    businessProjection: "Projeção business",
    marketPricePositionWellAbove:
      "O seu preço está claramente acima do mercado observado: deve ser justificado por sinais de qualidade muito fortes.",
    marketPricePositionSlightlyAbove:
      "O seu preço está ligeiramente acima do mercado: uma posição premium é possível se a promessa for clara.",
    marketPricePositionBelow:
      "O seu preço está abaixo do mercado observado: parece existir margem para otimização tarifária.",
    marketPricePositionSlightlyBelow:
      "O seu preço está ligeiramente abaixo do mercado: posição atrativa com potencial de subida moderada.",
    marketPricePositionAligned:
      "O seu preço está alinhado com o nível médio observado neste mercado.",
    marketPricePositionPending:
      "O posicionamento do preço será clarificado assim que existir um preço médio concorrente fiável.",
    priceDeltaIndicativeSample:
      "Diferença indicativa baseada numa amostra local limitada.",
    marketAverageRatingObserved:
      "Classificação média dos concorrentes observados: {value}/{scale}.",
    marketAverageRatingUnavailable:
      "A classificação média dos concorrentes ainda não é utilizável.",
    competitorCountSupportAvailable:
      "Foram retidos comparáveis para avaliar o seu posicionamento concorrencial.",
    competitorCountSupportNone:
      "Nenhum comparável foi retido para esta leitura; o posicionamento permanece indicativo.",
    competitorCountSupportPending:
      "O posicionamento continua a ser uma indicação a consolidar enquanto o volume exato de comparáveis não estiver disponível.",
    competitorCountSupportPartial:
      "A leitura do mercado continua parcial enquanto o volume de comparáveis não for consolidado.",
    comparablesKpiLimited: "Leitura limitada",
    comparablesKpiNone: "Nenhum comparável fiável",
    comparablesKpiOne: "Leitura limitada — 1 comparável utilizável",
    comparablesKpiTwo: "Leitura limitada — 2 comparáveis utilizáveis",
    lqiPartialIndex: "Índice parcial",
    lqiToConsolidate: "A consolidar",
    insufficientData: "Dados insuficientes",
    revenueImpactRangeDisplay:
      "Atual estimado: {current} / mês · Após otimização: {low} a {high} / mês",
    monthlyGainQualifierLimited:
      "{value} — cruze com mais comparáveis para estabilizar a referência.",
    monthlyGainQualifierFragile:
      "Hipótese indicativa a confirmar (preço e/ou comparáveis ainda não são fiáveis o suficiente para uma referência de mercado clara).",
    projectionsPotential: "Projeções e potencial",
    projectionsDescription: "Estimativas indicativas baseadas em sinais de mercado, posicionamento competitivo e potencial de conversão observado.",
    nightlyPrice: "Preço por noite",
    premiumPosition: "Posição premium",
    aggressivePosition: "Posição agressiva",
    balancedPosition: "Posição equilibrada",
    qualitativeAnalysisOnly: "Apenas análise qualitativa",
    businessPotentialAfterOptimization: "Potencial business após otimização",
    estimatedBookingsAfterOptimization: "Reservas estimadas após a otimização",
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
    estimatedImpactOnBookings: "Impacto estimado nas reservas",
    impactBusinessBlockIntroOutOfSegment: "Comparáveis retidos fora do segmento de preço — apenas as recomendações de qualidade, conteúdo e conversão visual podem ser interpretadas com fiabilidade.",
    impactBusinessBlockIntroDefault: "Cada cartão abaixo usa uma unidade fixa: € para o preço, /10 para o mercado relativo, % para o aumento de reservas e €/mês para o ganho mensal estimado (adicional, não a receita total).",
    currentPriceContextCompareMarket: "A comparar com o preço médio de mercado estimado em {value}.",
    currentPriceContextDetected: "Preço atual detetado no anúncio.",
    currentPriceContextMarketReference: "Preço atual indisponível. Referência de mercado observada: ~{value}/noite.",
    currentPriceContextMissing: "O preço atual não está disponível para este anúncio.",
    currentPriceUnavailable: "Preço atual indisponível",
    projectionBaseNoComparable: "Não há comparáveis suficientemente coerentes para estabelecer uma média concorrencial utilizável.",
    projectionBaseRobust: "Base concorrencial robusta construída com {count} anúncios comparáveis.",
    projectionBasePartial: "Benchmark parcial baseado em {count} comparáveis utilizáveis.",
    projectionBaseUnstable: "O mercado detetado continua demasiado instável para fornecer um benchmark concorrencial fiável.",
    potentialToConfirm: "Potencial por confirmar",
    conversionGainLowConfidence: "O nível de confiança do mercado continua insuficiente para projetar um ganho de conversão credível.",
    conversionGainFromScoreAndPrice: "Projeção baseada na pontuação de conversão e no preço atual, sem benchmark tarifário concorrencial fiável.",
    conversionGainOutOfSegment: "Comparáveis fora de segmento detetados — o potencial de reservas não pode ser estimado com fiabilidade para este anúncio.",
    conversionGainPendingRange: "A faixa em % será apresentada quando a base de mercado for suficientemente fiável (comparáveis e score consolidado), tal como no ganho mensal estimado.",
    conversionGainEstimated: "Estimativa baseada no seu posicionamento atual e nos anúncios concorrentes analisados.",
    conversionGainNoRange: "Não há faixa percentual disponível para o aumento de reservas nos dados atuais do relatório.",
    monthlyGainOutOfSegment: "Comparáveis fora de segmento — nenhuma projeção de ganho aplicável a este mercado.",
    monthlyGainUnavailable: "Estimativa indisponível — dados de mercado insuficientes. Uma faixa quantificada utilizável exige um preço anunciado fiável e uma referência concorrencial consolidada.",
    monthlyGainNeedsStableMarket: "Uma estimativa quantificada exige um preço anunciado coerente e um nível de mercado observado consolidado.",
    optimizedTexts: "Textos otimizados do anúncio",
    optimizedTextVariantLabel: "Variante {index} - {label}",
    optimizedTextIntro:
      "Proposta montada a partir do seu anúncio e dos sinais do relatório com modelos de texto locais (sem chamada a um modelo remoto neste ecrã). Ajuste-a à sua marca.",
    optimizedTextVariantCounter: "Variante {index} / {total}",
    optimizedTextVariantNameComfort: "Conforto e relaxamento",
    optimizedTextVariantNamePractical: "Prático e fluido",
    optimizedTextVariantNameNeighborhood: "Bairro e localização",
    optimizedTextVariantNamePremium: "Premium e confiança",
    optimizedTextVariantNameBusiness: "Estadia curta / business",
    variant: "Variante",
    changeVariant: "Mudar variante",
    descriptionCopied: "Descrição copiada",
    newVariantReady: "Nova variante pronta.",
    currentTitle: "Título atual",
    optimizedTitleExample: "Exemplo de título otimizado",
    aiGeneratingTitle: "Gerando título de IA…",
    missingListingTitle: "Não existe título disponível para este anúncio.",
    aiDescriptionPlaceholder: "A proposta de texto aparecerá aqui assim que os dados do anúncio e da auditoria estiverem disponíveis.",
    aiGeneratingDescription: "Geração por IA em curso…",
    aiProvenanceAi: "IA",
    aiProvenanceFallbackLocal: "Fallback local",
    aiDescriptionFailed: "A geração por IA falhou para este idioma. Tente novamente mais tarde.",
    aiDescriptionUnavailable: "Ainda não existe uma descrição Airbnb por IA disponível para este idioma.",
    aiFallbackHousing: "Instale-se num alojamento confortável, fácil de viver e pensado para tornar cada momento da estadia mais simples.",
    aiFallbackDetailedHousing: "O alojamento oferece uma experiência completa, com espaços claros, comodidades úteis e uma atmosfera agradável para aproveitar a estadia.",
    aiFallbackGuestAccess: "Os viajantes desfrutam de um acesso simples ao alojamento, aos espaços previstos para a estadia e às comodidades úteis no dia a dia.",
    aiFallbackGuestInteraction: "Continuo disponível antes e durante a estadia para partilhar indicações úteis e responder de forma simples às questões práticas.",
    aiFallbackOtherInfo: "As informações práticas facilitam a chegada, esclarecem a organização da estadia e ajudam os viajantes a aproveitar o alojamento com tranquilidade.",
    myPlace: "O meu alojamento",
    detailedPlace: "Alojamento — versão detalhada",
    guestAccess: "Acesso dos hóspedes",
    guestInteraction: "Interação com os hóspedes",
    otherInfo: "Outras informações a ter em conta",
    bookingDescriptionSummary: "Resumo da descrição (Booking)",
    bookingSummaryFallback:
      "Inclua na descrição: o conforto dos espaços, o acesso ao alojamento, a disponibilidade para os hóspedes e as informações práticas úteis à chegada.",
    bookingSummaryReady: "Resumo pronto a colar, alinhado com a variante apresentada.",
    actionPlan: "Plano de ação",
    actionPlanSubtitle: "Projetos a lançar agora, ordenados por impacto business.",
    fallbackNarrativeFromWeaknesses:
      "Narrativa de fallback baseada nos pontos fracos do relatório. Leitura indicativa, não um benchmark de mercado rigoroso.",
    fallbackNarrativeFromStrengths:
      "Narrativa de fallback baseada nos pontos fortes do relatório. Leitura indicativa, não um benchmark de mercado rigoroso.",
    actionPlanIntroAttractiveness:
      "Esta vista agrupa as alavancas por prioridade para reforçar a atratividade, a hospitalidade e a apresentação do seu anúncio.",
    actionPlanIntroConversion:
      "Esta vista agrupa as melhorias por prioridade para clarificar a oferta, tranquilizar o viajante e acelerar a decisão.",
    actionPlanIntroStorytelling:
      "As ações serão estruturadas aqui para apoiar narrativa, diferenciação e vontade de reservar.",
    actionPlanIntroDefault:
      "As ações serão estruturadas aqui assim que estiver disponível um plano de melhoria detalhado.",
    actionSignalLabel: "Sinal",
    actionImpactHigh: "impacto elevado",
    actionImpactMedium: "impacto médio",
    actionImpactLow: "impacto baixo",
    actionScoreLabel: "Pontuação afetada",
    actionObjectiveLabel: "Objetivo",
    actionSignalFallback: "Sinal a confirmar.",
    actionObjectiveFallback: "Priorizar segundo o impacto business detetado.",
    actionEmptyState: "Nenhuma ação prioritária disponível de momento.",
    actionImprovementFallback: "Melhoria {index}",
    actionScoreLineWithValue: "{label}: {value}/10.",
    actionScoreLinePending: "{label}: a confirmar.",
    actionLabelDescription: "Descrição",
    actionLabelSeo: "SEO",
    actionLabelPhotos: "Fotos",
    actionLabelAmenities: "Comodidades",
    actionLabelConversion: "Conversão",
    actionNarrativeDescription:
      "O texto deve transformar melhor as informações do anúncio em benefícios concretos para o viajante: conforto, experiência, localização e razões para reservar.",
    actionReasonDescription: "Pontuação de descrição + qualidade de projeção do viajante.",
    actionNarrativeSeo:
      "O título e as primeiras linhas devem integrar melhor as palavras-chave úteis: localização, comodidades procuradas e vantagens diferenciadoras.",
    actionReasonSeo: "Pontuação SEO + visibilidade na plataforma.",
    actionNarrativePhotos:
      "Os visuais devem continuar a transmitir confiança desde os primeiros segundos: melhores espaços primeiro, luz, conforto e valor percebido.",
    actionReasonPhotos: "Pontuação das fotos + ordem da galeria.",
    actionNarrativeAmenities:
      "As comodidades-chave precisam de estar mais visíveis para reduzir dúvidas antes da reserva e aumentar a perceção de conforto.",
    actionReasonAmenities: "Pontuação de comodidades + confiança na estadia.",
    actionLabelPricing: "Preço",
    actionNarrativeConversion:
      "A prioridade é reduzir hesitações: promessa clara, provas visíveis, informações concretas e coerência entre título, fotos e descrição.",
    actionReasonConversion: "Pontuação de conversão + fricção na decisão.",
    actionReasonPricing: "Posicionamento de preço + validação do mercado comparável.",
    actionReasonMarketComparables: "{count} anúncio(s) comparável(eis) utilizado(s) para ler o mercado.",
    actionNarrativeFallback:
      "Ação do relatório: priorizar segundo o impacto business e os sinais disponíveis.",
    actionNormalizedTitleClarify: "Clarificar as informações que desencadeiam a reserva",
    actionNormalizedTitleConcreteValue: "Tornar o valor mais concreto",
    actionNormalizedTitleAnalyzePricingGap: "Analisar a diferença tarifária medida",
    actionNormalizedTitleBuildTrust: "Reforçar a confiança antes da reserva",
    actionNormalizedDescriptionPricingCompare:
      "A fazer: compare a tarifa apenas com anúncios realmente semelhantes em tipo, localização e nível de prestação antes de qualquer ajuste.",
    auditLeversDetailTitle: "Detalhe das alavancas do anúncio",
    auditStrengthsTitle: "Pontos fortes",
    auditStrengthsSource: "Fonte: sinais fortes medidos pelos sub-scores da auditoria.",
    auditStrengthsEmpty:
      "Não foi detetado nenhum sinal forte mensurável de 8/10 ou mais nos sub-scores disponíveis.",
    auditWeaknessesTitle: "Pontos fracos",
    auditWeaknessesSource: "Fonte: sinais fracos medidos pelos sub-scores da auditoria.",
    auditWeaknessesEmpty:
      "Não foi detetado nenhum sinal fraco mensurável abaixo de 7/10 nos sub-scores disponíveis.",
    auditStrengthPhotos: "Fotos sólidas: {score}/10.",
    auditStrengthPhotoOrder: "Ordem das fotos sólida: {score}/10.",
    auditStrengthDescription: "Descrição forte: {score}/10.",
    auditStrengthAmenities: "Comodidades bem cobertas: {score}/10.",
    auditStrengthSeo: "SEO sólido: {score}/10.",
    auditStrengthConversion: "Conversão sólida: {score}/10.",
    auditWeakDescription: "Descrição a melhorar: {score}/10.",
    auditWeakSeo: "SEO a reforçar: {score}/10.",
    auditWeakConversion: "Conversão a reforçar: {score}/10.",
    auditWeakAmenities: "Comodidades a completar: {score}/10.",
    auditWeakPhotoQuality: "Qualidade das fotos a melhorar: {score}/10.",
    auditWeakPhotoOrder: "Ordem das fotos a rever: {score}/10.",
    nextStepTitle: "Próximo passo recomendado",
    nextStepDescription:
      "Corrija primeiro as alavancas mais rentáveis e, em seguida, relance uma auditoria para medir o ganho obtido.",
    nextStepRunAudit: "Relançar uma auditoria",
    nextStepBackToAudits: "Voltar às auditorias",
    nextStepAnalyzeAnother: "Analisar outro anúncio",
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
    scoreSideCardNarrativeLow:
      "Leitura /10: nível frágil — detalhe por pilar em «Nível global de conversão».",
    scoreSideCardNarrativeMedium:
      "Leitura /10: nível moderado — veja as subpontuações do bloco principal.",
    impactSideCardNarrativeOutOfMarket:
      "Segmento fora do mercado — os dados de negócio não são utilizáveis de forma fiável para este anúncio.",
    impactSideCardNarrativeMarketPending:
      "Pode existir potencial de otimização no seu anúncio, mas a percentagem quantificada será apresentada quando a base de mercado for sólida (pelo menos três comparáveis fiáveis e uma pontuação de mercado consolidada), seguindo o mesmo princípio da estimativa em euros.",
    impactSideCardNarrativeNoRange:
      "Não existe uma faixa % utilizável para o lift no relatório.",
    prioritizedActionsIntroAirbnb:
      "Lista de recomendações geradas, ordenada para evoluir do mais diferenciador ao mais estruturante.",
    prioritizedActionsIntroDefault:
      "Lista de recomendações geradas, ordenada para maximizar clareza, confiança e conversão.",
    prioritizedActionsIntroEmpty:
      "Ainda não foi destacada nenhuma ação prioritária nesta auditoria.",
    prioritizedActionsSublineAirbnb:
      "Uma sequência para reforçar emoção, singularidade e vontade de reservar.",
    prioritizedActionsSublineDefault:
      "Uma sequência para entregar rapidamente informação útil, tranquilizadora e acionável.",
    strengthsFallbackAirbnb:
      "Ainda não foi identificado nenhum ponto forte estruturado — pense em storytelling, acolhimento e no que o diferencia.",
    strengthsFallbackDefault:
      "Ainda não foi identificado nenhum ponto forte estruturado — pense em provas, clareza e confiança.",
    weaknessesFallbackInsightIsolated:
      "Não foi possível isolar nenhum ponto fraco distinto a partir dos «insights» com o método atual.",
    weaknessesFallbackInsightStructured:
      "Não existe uma lista estruturada de «weaknesses» no relatório: os «insights» não são copiados aqui como fraquezas formais — veja as ações prioritárias e os desvios de mercado.",
    weaknessesFallbackNoStructuredAirbnb:
      "Por agora não surge nenhuma fraqueza nos campos estruturados do relatório — a leitura está incompleta, não é prova de que não haja nada a melhorar.",
    weaknessesFallbackNoStructuredDefault:
      "Por agora não surge nenhuma fraqueza nos campos estruturados do relatório — a leitura está incompleta, não é prova de que não haja nada a melhorar.",
    lqiNoteUnavailable: "Os dados não estão disponíveis para este eixo nesta vista.",
    lqiNoteListingNativeHigh:
      "Componente fornecida pelo relatório: nível elevado neste eixo — a validar com o conteúdo real do anúncio.",
    lqiNoteListingNativeModerate:
      "Componente fornecida pelo relatório: nível moderado — um sinal entre outros, não um veredito isolado.",
    lqiNoteListingLocalHigh:
      "Síntese local /100 a partir das dimensões /10 já detalhadas acima: mesma família de sinais, vista condensada.",
    lqiNoteListingLocalFallback:
      "Síntese local /100 a partir das subpontuações /10 da auditoria — indicativa e já explorada noutras zonas da página.",
    lqiNoteMarketNativeHigh:
      "O seu anúncio continua competitivo face aos anúncios próximos analisados.",
    lqiNoteMarketNativeModerate:
      "O seu posicionamento de mercado é correto, mas ainda pode ser melhorado.",
    lqiNoteMarketNativeLow:
      "Os concorrentes observados parecem atualmente melhor posicionados.",
    lqiNoteMarketLocalHigh:
      "Síntese local (pontuações de mercado + global /10): marcador condensado, não independente dos blocos de mercado.",
    lqiNoteMarketLocalFallback:
      "Síntese local (pontuações de mercado + global /10): leitura indicativa, a cruzar com «Posicionamento no mercado».",
    lqiNoteConversionUnavailable:
      "Não existe valor /100 para esta dimensão: veja a pontuação de conversão e as recomendações noutras secções.",
    lqiNoteConversionNativeHigh:
      "O potencial de conversão já é sólido neste anúncio.",
    lqiNoteConversionNativeModerate:
      "Ainda existem várias otimizações que podem melhorar a conversão.",
    lqiNoteConversionNativeLow:
      "Ainda há fricções visíveis a limitar o potencial de reserva.",
    lqiNoteConversionLocalFallback:
      "Indicativo: valor completado a partir de outro campo do relatório (potencial de reserva), não é uma medida autónoma de conversão.",
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
    detectedSourceTitle: "Gedetecteerde bron: {value}",
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
    suggestedTextCopied: "Voorgestelde tekst naar het klembord gekopieerd.",
    noDescriptionToCopy: "Er is momenteel geen beschrijving om te kopiëren.",
    noTextToCopy: "Er is momenteel geen tekst om te kopiëren.",
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
    listingBadge: "Advertentie",
    bookingVariantBadge: "{value} · Booking-variant",
    listingQuality: "Kwaliteit van de advertentie",
    listingQualityDescription: "Interne analyse van uw advertentie: foto’s, visuele volgorde, beschrijving, voorzieningen, SEO en conversiepotentieel.",
    globalConversionLevel: "Algemeen conversieniveau",
    realMarket: "Werkelijke markt",
    observedMarket: "Geobserveerde markt",
    observedMarketDescription: "Gebaseerd op behouden vergelijkbare aanbiedingen, geobserveerde concurrentieprijzen, marktbetrouwbaarheid en berekende prijsafwijking.",
    listingCompetitivePosition: "Hoe uw advertentie zich verhoudt",
    competitiveSummary: "Samenvattende lezing van uw concurrentiepositie op basis van de behouden vergelijkbare advertenties.",
    outOfMarketSegmentShort: "Segment buiten de markt",
    percentAfterMarketConsolidation: "Percentage weergegeven na marktconsolidatie",
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
    marketPositionNarrativeAbove: "Deze advertentie lijkt beter te presteren dan het lokale gemiddelde in de buurt.",
    marketPositionNarrativeBelow: "Deze advertentie lijkt zwakker te presteren dan het lokale gemiddelde in de buurt.",
    marketPositionNarrativeNoComparables: "Er zijn nog geen nabijgelegen concurrenten geanalyseerd voor deze audit.",
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
    photoBadgeLow: "{count} foto’s • voeg meer beelden toe",
    photoBadgeMedium: "{count} foto’s • degelijke galerij",
    photoBadgeGood: "{count} foto’s • sterke galerij",
    photoBadgeExcellent: "{count} foto’s • zeer sterke score",
    heroImpactRevenueRange: "+{low} tot +{high} / maand",
    marketIndicativeLabel: "Indicatieve lezing (beperkte basis)",
    bookingLiftRange: "{low} tot {high}",
    bookingLiftUpTo: "Tot {value}",
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
    marketReliabilityTitleUsable: "Bruikbare markt",
    marketReliabilityTitleLimited: "Beperkte analyse",
    marketReliabilityTitleLow: "Lokale markt beperkt bruikbaar",
    marketReliabilityTitleWeakFallback: "Beperkte lokale basis",
    marketSourceLabelCrossPlatform: "Cross-platform benchmark",
    marketSourceMessageCrossPlatform:
      "Er zijn niet-Booking-comparables gebruikt omdat er onvoldoende Booking-comparables beschikbaar waren.",
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
    pricingInsightUnderpriced:
      "Je prijs ligt {value}% onder de waargenomen mediaan. Een geleidelijke verhoging richting de aanbevolen prijs kan de omzet verbeteren zonder abrupt uit het geanalyseerde concurrentiesegment te vallen.",
    pricingInsightOptimal:
      "Je prijs ligt dicht bij de waargenomen mediaan ({value}%). De belangrijkste hefboom is geen sterke prijsverhoging, maar eerder een betere conversie en presentatie.",
    pricingInsightOverpriced:
      "Je prijs ligt {value}% boven de waargenomen mediaan. De prijs kan een rem worden als de kwaliteitssignalen dit verschil niet duidelijk rechtvaardigen.",
    pricingIndicativeCaution:
      "{value} — interpreteer de prijspositionering voorzichtig zolang de lokale basis beperkt blijft.",
    insufficientComparablePricing: "Onvoldoende gegevens: geen betrouwbare vergelijkbare aanbieding om mediaan of prijseffect te schatten.",
    insufficientPricingData: "Onvoldoende marktgegevens om een betrouwbare prijsimpact te schatten.",
    pricingBenchmarks: "Prijsbenchmarks",
    pricingBenchmarksTitle: "Hoe uw prijs zich verhoudt tot de concurrentie",
    pricingBenchmarksDescription: "Prijsbenchmarks op basis van geobserveerde gemiddelde prijzen en de geschatte kloof met de vergelijkbare markt.",
    reportFrictionSignalsTitle: "Frictiesignalen uit het rapport",
    reportFrictionSignalsSubtitle:
      "Alleen als aanvulling: fragmenten buiten de hoofd­lijsten ‘Zwaktes’ en ‘Belangrijkste marktverschillen’. Indicatief, zonder direct verband met een maat voor verloren boekingen.",
    mainMarketGapsTitle: "Belangrijkste verschillen t.o.v. de markt",
    mainMarketGapsEmpty:
      "Er staan momenteel geen marktverschillen in het rapport — gegevens ontbreken of zijn op dit punt niet gestructureerd, wat niet noodzakelijk betekent dat er geen echt verschil is.",
    mainMarketAdvantagesTitle: "Belangrijkste voordelen t.o.v. de markt",
    mainMarketAdvantagesEmpty:
      "Er is momenteel geen duidelijk voordeel vastgesteld.",
    missingAmenitiesChecklistTitle: "Checklist van ontbrekende voorzieningen",
    avgCompetitorPriceSupportInsufficient: "Onvoldoende marktsteekproef om een betrouwbare prijsreferentie vast te stellen.",
    avgCompetitorPriceSupportLimited: "Indicatieve referentie: de lokale basis is nog beperkt en moet met meer vergelijkbare advertenties worden geconsolideerd.",
    avgCompetitorPriceSupportObserved: "Geobserveerde concurrentiereferentie op de voor dit segment geselecteerde advertenties.",
    avgCompetitorPriceSupportPending: "De prijsreferentie wordt nuttiger zodra een betrouwbare concurrentieprijs kan worden geconsolideerd.",
    averageCompetitorPrice: "Gemiddelde prijs van concurrenten",
    priceGapVsMarket: "Prijsverschil vs markt",
    priceDeltaInsufficientSample: "Onvoldoende steekproef",
    marketCompetitorPricesDispersed: "Concurrerende prijzen zijn verspreid",
    priceDeltaUnavailable: "Het prijsverschil kan hier niet worden berekend: geadverteerde prijs of marktreferentie is onvoldoende voor een betrouwbaar percentage.",
    priceDeltaPending: "Zodra een geadverteerde prijs en een betrouwbare marktreferentie zijn geconsolideerd, kan hier een procentueel verschil worden weergegeven.",
    notReliable: "Niet betrouwbaar",
    marketAnalysisPending: "Analyse in afwachting van een voldoende grote marktsteekproef.",
    businessProjection: "Businessprojectie",
    marketPricePositionWellAbove:
      "Je prijs ligt duidelijk boven de waargenomen markt: dit moet worden gerechtvaardigd door zeer sterke kwaliteitssignalen.",
    marketPricePositionSlightlyAbove:
      "Je prijs ligt iets boven de markt: een premiumpositie is mogelijk als de belofte duidelijk is.",
    marketPricePositionBelow:
      "Je prijs ligt onder de waargenomen markt: er lijkt ruimte voor prijsoptimalisatie beschikbaar.",
    marketPricePositionSlightlyBelow:
      "Je prijs ligt iets onder de markt: een aantrekkelijke positie met gematigd opwaarts potentieel.",
    marketPricePositionAligned:
      "Je prijs ligt in lijn met het gemiddelde niveau dat in deze markt is waargenomen.",
    marketPricePositionPending:
      "De prijspositionering wordt verduidelijkt zodra een betrouwbare gemiddelde concurrentieprijs beschikbaar is.",
    priceDeltaIndicativeSample:
      "Indicatief verschil op basis van een beperkte lokale steekproef.",
    marketAverageRatingObserved:
      "Gemiddelde score van waargenomen concurrenten: {value}/{scale}.",
    marketAverageRatingUnavailable:
      "De gemiddelde score van concurrenten is nog niet bruikbaar.",
    competitorCountSupportAvailable:
      "Vergelijkbare aanbiedingen zijn behouden om je concurrentiepositie te beoordelen.",
    competitorCountSupportNone:
      "Er zijn geen vergelijkbare aanbiedingen behouden voor deze lezing; de positionering blijft indicatief.",
    competitorCountSupportPending:
      "De positionering blijft een indicatie die moet worden geconsolideerd totdat een exact volume vergelijkbare aanbiedingen beschikbaar is.",
    competitorCountSupportPartial:
      "De marktuitlezing blijft gedeeltelijk totdat het volume vergelijkbare aanbiedingen is geconsolideerd.",
    comparablesKpiLimited: "Beperkte lezing",
    comparablesKpiNone: "Geen betrouwbare vergelijkbare aanbieding",
    comparablesKpiOne: "Beperkte lezing — 1 bruikbare vergelijkbare aanbieding",
    comparablesKpiTwo: "Beperkte lezing — 2 bruikbare vergelijkbare aanbiedingen",
    lqiPartialIndex: "Gedeeltelijke index",
    lqiToConsolidate: "Te consolideren",
    insufficientData: "Onvoldoende gegevens",
    revenueImpactRangeDisplay:
      "Huidige schatting: {current} / maand · Na optimalisatie: {low} tot {high} / maand",
    monthlyGainQualifierLimited:
      "{value} — vergelijk met meer vergelijkbare aanbiedingen om de referentie te stabiliseren.",
    monthlyGainQualifierFragile:
      "Indicatieve hypothese die moet worden bevestigd (prijs en/of vergelijkbare aanbiedingen zijn nog niet betrouwbaar genoeg voor een duidelijke marktreferentie).",
    projectionsPotential: "Projecties en potentieel",
    projectionsDescription: "Indicatieve schattingen op basis van marktsignalen, concurrentiepositionering en geobserveerd conversiepotentieel.",
    nightlyPrice: "Prijs per nacht",
    premiumPosition: "Premiumpositie",
    aggressivePosition: "Agressieve positie",
    balancedPosition: "Evenwichtige positie",
    qualitativeAnalysisOnly: "Alleen kwalitatieve analyse",
    businessPotentialAfterOptimization: "Businesspotentieel na optimalisatie",
    estimatedBookingsAfterOptimization: "Geschatte boekingen na optimalisatie",
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
    estimatedImpactOnBookings: "Geschatte impact op boekingen",
    impactBusinessBlockIntroOutOfSegment: "Vergelijkbare advertenties buiten het prijssegment werden behouden — alleen aanbevelingen rond kwaliteit, content en visuele conversie kunnen betrouwbaar worden geïnterpreteerd.",
    impactBusinessBlockIntroDefault: "Elke kaart hieronder gebruikt een vaste eenheid: € voor de prijs, /10 voor de relatieve markt, % voor de boekingsstijging en €/maand voor de geschatte maandelijkse winst (extra, niet de totale omzet).",
    currentPriceContextCompareMarket: "Te vergelijken met de geschatte gemiddelde marktprijs van {value}.",
    currentPriceContextDetected: "Huidige prijs gedetecteerd in de advertentie.",
    currentPriceContextMarketReference: "Huidige prijs niet beschikbaar. Geobserveerde marktreferentie: ~{value}/nacht.",
    currentPriceContextMissing: "De huidige prijs is niet beschikbaar voor deze advertentie.",
    currentPriceUnavailable: "Huidige prijs niet beschikbaar",
    projectionBaseNoComparable: "Geen voldoende consistente vergelijkbare advertenties om een bruikbaar competitief gemiddelde vast te stellen.",
    projectionBaseRobust: "Robuuste concurrentiebasis opgebouwd uit {count} vergelijkbare advertenties.",
    projectionBasePartial: "Gedeeltelijke benchmark op basis van {count} bruikbare vergelijkbare advertenties.",
    projectionBaseUnstable: "De gedetecteerde markt blijft te instabiel om een betrouwbare concurrentiebenchmark te bieden.",
    potentialToConfirm: "Potentieel te bevestigen",
    conversionGainLowConfidence: "Het marktbrouwbaarheidsniveau blijft onvoldoende om een geloofwaardige conversiewinst te projecteren.",
    conversionGainFromScoreAndPrice: "Projectie op basis van de conversiescore en de huidige prijs, zonder betrouwbare concurrerende prijsbenchmark.",
    conversionGainOutOfSegment: "Vergelijkbare advertenties buiten het segment gedetecteerd — het boekingspotentieel kan voor deze advertentie niet betrouwbaar worden ingeschat.",
    conversionGainPendingRange: "De %-range wordt weergegeven zodra de marktbasis voldoende betrouwbaar is (vergelijkbare advertenties en geconsolideerde score), net als bij de geschatte maandelijkse winst.",
    conversionGainEstimated: "Schatting op basis van uw huidige positionering en de geanalyseerde concurrerende advertenties.",
    conversionGainNoRange: "Geen procentuele range beschikbaar voor de boekingsstijging in de huidige rapportgegevens.",
    monthlyGainOutOfSegment: "Vergelijkbare advertenties buiten het segment — geen winstprojectie toepasbaar op deze markt.",
    monthlyGainUnavailable: "Schatting niet beschikbaar — onvoldoende marktgegevens. Een bruikbare gekwantificeerde bandbreedte vereist een betrouwbare geadverteerde prijs en een geconsolideerde concurrentiereferentie.",
    monthlyGainNeedsStableMarket: "Een gekwantificeerde schatting vereist een coherente geadverteerde prijs en een geconsolideerd geobserveerd marktniveau.",
    optimizedTexts: "Geoptimaliseerde advertentieteksten",
    optimizedTextVariantLabel: "Variant {index} - {label}",
    optimizedTextIntro:
      "Voorstel samengesteld op basis van uw advertentie en de signalen uit het rapport met lokale tekstmodellen (geen aanroep van een extern model op dit scherm). Pas het aan uw merk aan.",
    optimizedTextVariantCounter: "Variant {index} / {total}",
    optimizedTextVariantNameComfort: "Comfort & ontspanning",
    optimizedTextVariantNamePractical: "Praktisch & soepel",
    optimizedTextVariantNameNeighborhood: "Buurt & locatie",
    optimizedTextVariantNamePremium: "Premium & vertrouwen",
    optimizedTextVariantNameBusiness: "Kort verblijf / business",
    variant: "Variant",
    changeVariant: "Variant wijzigen",
    descriptionCopied: "Beschrijving gekopieerd",
    newVariantReady: "Nieuwe variant klaar.",
    currentTitle: "Huidige titel",
    optimizedTitleExample: "Voorbeeld van geoptimaliseerde titel",
    aiGeneratingTitle: "AI-titel wordt gegenereerd…",
    missingListingTitle: "Er is geen titel beschikbaar voor deze advertentie.",
    aiDescriptionPlaceholder: "De voorgestelde tekst verschijnt hier zodra de advertentie- en auditgegevens beschikbaar zijn.",
    aiGeneratingDescription: "AI-generatie wordt uitgevoerd…",
    aiProvenanceAi: "AI",
    aiProvenanceFallbackLocal: "Lokale fallback",
    aiDescriptionFailed: "De AI-generatie is voor deze taal mislukt. Probeer het later opnieuw.",
    aiDescriptionUnavailable: "Er is nog geen AI-Airbnb-beschrijving beschikbaar voor deze taal.",
    aiFallbackHousing: "Voel je thuis in een comfortabele, praktische accommodatie die elk moment van je verblijf eenvoudiger maakt.",
    aiFallbackDetailedHousing: "De accommodatie biedt een complete ervaring, met duidelijke ruimtes, nuttige voorzieningen en een aangename sfeer om van het verblijf te genieten.",
    aiFallbackGuestAccess: "Gasten genieten van eenvoudige toegang tot de accommodatie, de ruimtes die voor het verblijf bedoeld zijn en de voorzieningen die dagelijks comfort bieden.",
    aiFallbackGuestInteraction: "Ik blijf voor en tijdens het verblijf beschikbaar om nuttige aanwijzingen te delen en praktische vragen eenvoudig te beantwoorden.",
    aiFallbackOtherInfo: "Praktische informatie vergemakkelijkt de aankomst, verduidelijkt de organisatie van het verblijf en helpt gasten zorgeloos van de accommodatie te genieten.",
    myPlace: "Mijn verblijf",
    detailedPlace: "Verblijf — gedetailleerde versie",
    guestAccess: "Toegang voor gasten",
    guestInteraction: "Interactie met gasten",
    otherInfo: "Andere nuttige informatie",
    bookingDescriptionSummary: "Samenvatting van beschrijving (Booking)",
    bookingSummaryFallback:
      "Neem in je beschrijving op: het comfort van de ruimtes, de toegang tot de accommodatie, de beschikbaarheid voor gasten en praktische informatie die nuttig is bij aankomst.",
    bookingSummaryReady: "Klaar om te plakken, afgestemd op de weergegeven variant.",
    actionPlan: "Actieplan",
    actionPlanSubtitle: "Projecten die nu moeten worden gestart, gerangschikt op business-impact.",
    fallbackNarrativeFromWeaknesses:
      "Narratieve fallback op basis van de zwakke punten uit het rapport. Indicatieve lezing, geen strikte marktbenchmark.",
    fallbackNarrativeFromStrengths:
      "Narratieve fallback op basis van de sterke punten uit het rapport. Indicatieve lezing, geen strikte marktbenchmark.",
    actionPlanIntroAttractiveness:
      "Deze weergave groepeert de hefbomen op prioriteit om de aantrekkelijkheid, gastvrijheid en presentatie van uw advertentie te versterken.",
    actionPlanIntroConversion:
      "Deze weergave groepeert verbeteringen op prioriteit om het aanbod te verduidelijken, de reiziger gerust te stellen en de beslissing te versnellen.",
    actionPlanIntroStorytelling:
      "Acties worden hier gestructureerd om storytelling, differentiatie en boekingszin te ondersteunen.",
    actionPlanIntroDefault:
      "Acties worden hier gestructureerd zodra een gedetailleerd verbeterplan beschikbaar is.",
    actionSignalLabel: "Signaal",
    actionImpactHigh: "hoge impact",
    actionImpactMedium: "gemiddelde impact",
    actionImpactLow: "lage impact",
    actionScoreLabel: "Betrokken score",
    actionObjectiveLabel: "Doel",
    actionSignalFallback: "Signaal te bevestigen.",
    actionObjectiveFallback: "Prioriteren volgens de gedetecteerde business-impact.",
    actionEmptyState: "Er is momenteel geen prioritaire actie beschikbaar.",
    actionImprovementFallback: "Verbetering {index}",
    actionScoreLineWithValue: "{label}: {value}/10.",
    actionScoreLinePending: "{label}: te bevestigen.",
    actionLabelDescription: "Beschrijving",
    actionLabelSeo: "SEO",
    actionLabelPhotos: "Foto’s",
    actionLabelAmenities: "Voorzieningen",
    actionLabelConversion: "Conversie",
    actionNarrativeDescription:
      "De tekst moet de informatie uit de advertentie beter omzetten in concrete voordelen voor de reiziger: comfort, ervaring, locatie en redenen om te boeken.",
    actionReasonDescription: "Beschrijving-score + kwaliteit van reizigersprojectie.",
    actionNarrativeSeo:
      "De titel en eerste regels moeten nuttige zoekwoorden beter integreren: locatie, gezochte voorzieningen en onderscheidende troeven.",
    actionReasonSeo: "SEO-score + zichtbaarheid op het platform.",
    actionNarrativePhotos:
      "De beelden moeten vanaf de eerste seconden vertrouwen blijven geven: beste ruimtes eerst, licht, comfort en waargenomen waarde.",
    actionReasonPhotos: "Fotoscore + galerijvolgorde.",
    actionNarrativeAmenities:
      "Belangrijke voorzieningen moeten zichtbaarder worden om twijfels vóór het boeken te verminderen en het comfortgevoel te verhogen.",
    actionReasonAmenities: "Voorzieningenscore + geruststelling over het verblijf.",
    actionLabelPricing: "Prijs",
    actionNarrativeConversion:
      "De prioriteit is om aarzeling te verminderen: duidelijke belofte, zichtbare bewijzen, concrete informatie en samenhang tussen titel, foto’s en beschrijving.",
    actionReasonConversion: "Conversiescore + beslissingsfrictie.",
    actionReasonPricing: "Prijspositionering + validatie van de vergelijkbare markt.",
    actionReasonMarketComparables: "{count} vergelijkbare advertentie(s) gebruikt om de markt te lezen.",
    actionNarrativeFallback:
      "Actie uit het rapport: prioriteren volgens business-impact en beschikbare signalen.",
    actionNormalizedTitleClarify: "De informatie verduidelijken die boekingen triggert",
    actionNormalizedTitleConcreteValue: "De waarde concreter maken",
    actionNormalizedTitleAnalyzePricingGap: "De gemeten prijsafwijking analyseren",
    actionNormalizedTitleBuildTrust: "Het vertrouwen vóór het boeken versterken",
    actionNormalizedDescriptionPricingCompare:
      "Te doen: vergelijk de prijs alleen met advertenties die echt vergelijkbaar zijn qua type, locatie en serviceniveau voordat u iets aanpast.",
    auditLeversDetailTitle: "Detail van de hefbomen van de advertentie",
    auditStrengthsTitle: "Sterke punten",
    auditStrengthsSource: "Bron: sterke signalen gemeten door de subscores van de audit.",
    auditStrengthsEmpty:
      "Er werd geen meetbaar sterk signaal van 8/10 of hoger gedetecteerd in de beschikbare subscores.",
    auditWeaknessesTitle: "Zwakke punten",
    auditWeaknessesSource: "Bron: zwakke signalen gemeten door de subscores van de audit.",
    auditWeaknessesEmpty:
      "Er werd geen meetbaar zwak signaal onder 7/10 gedetecteerd in de beschikbare subscores.",
    auditStrengthPhotos: "Sterke foto's: {score}/10.",
    auditStrengthPhotoOrder: "Sterke fotovolgorde: {score}/10.",
    auditStrengthDescription: "Sterke beschrijving: {score}/10.",
    auditStrengthAmenities: "Voorzieningen goed afgedekt: {score}/10.",
    auditStrengthSeo: "Sterke SEO: {score}/10.",
    auditStrengthConversion: "Sterke conversie: {score}/10.",
    auditWeakDescription: "Beschrijving te verbeteren: {score}/10.",
    auditWeakSeo: "SEO te versterken: {score}/10.",
    auditWeakConversion: "Conversie te versterken: {score}/10.",
    auditWeakAmenities: "Voorzieningen aan te vullen: {score}/10.",
    auditWeakPhotoQuality: "Fotokwaliteit te verbeteren: {score}/10.",
    auditWeakPhotoOrder: "Fotovolgorde te herzien: {score}/10.",
    nextStepTitle: "Aanbevolen volgende stap",
    nextStepDescription:
      "Corrigeer eerst de meest rendabele hefbomen en start daarna opnieuw een audit om de behaalde winst te meten.",
    nextStepRunAudit: "Audit opnieuw uitvoeren",
    nextStepBackToAudits: "Terug naar audits",
    nextStepAnalyzeAnother: "Een andere advertentie analyseren",
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
    scoreSideCardNarrativeLow:
      "Lezing /10: fragiel niveau — detail per pijler in ‘Algemeen conversieniveau’.",
    scoreSideCardNarrativeMedium:
      "Lezing /10: gemiddeld niveau — bekijk de subscores in het hoofdblok.",
    impactSideCardNarrativeOutOfMarket:
      "Segment buiten de markt — businessdata zijn voor deze advertentie niet betrouwbaar bruikbaar.",
    impactSideCardNarrativeMarketPending:
      "Er kan optimalisatiepotentieel bestaan voor je advertentie, maar het gekwantificeerde percentage wordt pas getoond wanneer de marktbasis solide is (minstens drie betrouwbare vergelijkbare listings en een geconsolideerde marktscore), volgens hetzelfde principe als de schatting in euro’s.",
    impactSideCardNarrativeNoRange:
      "Er is geen bruikbare %-range voor de uplift beschikbaar in het rapport.",
    prioritizedActionsIntroAirbnb:
      "Lijst van gegenereerde aanbevelingen, geordend van het meest onderscheidende naar het meest structurerende punt.",
    prioritizedActionsIntroDefault:
      "Lijst van gegenereerde aanbevelingen, geordend om duidelijkheid, vertrouwen en conversie te maximaliseren.",
    prioritizedActionsIntroEmpty:
      "Er is in deze audit nog geen prioritaire actie naar voren gekomen.",
    prioritizedActionsSublineAirbnb:
      "Een volgorde om emotie, uniciteit en boekingszin te versterken.",
    prioritizedActionsSublineDefault:
      "Een volgorde om snel nuttige, geruststellende en direct bruikbare informatie te leveren.",
    strengthsFallbackAirbnb:
      "Er is nog geen gestructureerd sterk punt naar voren gekomen — denk aan storytelling, gastvrijheid en wat jou onderscheidt.",
    strengthsFallbackDefault:
      "Er is nog geen gestructureerd sterk punt naar voren gekomen — denk aan bewijskracht, duidelijkheid en vertrouwen.",
    weaknessesFallbackInsightIsolated:
      "Met de huidige methode kon geen duidelijk afzonderlijk zwak punt uit de ‘insights’ worden geïsoleerd.",
    weaknessesFallbackInsightStructured:
      "Er is geen gestructureerde lijst met ‘weaknesses’ in het rapport: de ‘insights’ worden hier niet gekopieerd als formele zwakke punten — zie prioritaire acties en marktverschillen.",
    weaknessesFallbackNoStructuredAirbnb:
      "Er staat voorlopig geen zwakte in de gestructureerde rapportvelden — de lezing is onvolledig, niet het bewijs dat er niets te verbeteren valt.",
    weaknessesFallbackNoStructuredDefault:
      "Er staat voorlopig geen zwakte in de gestructureerde rapportvelden — de lezing is onvolledig, niet het bewijs dat er niets te verbeteren valt.",
    lqiNoteUnavailable: "Gegevens zijn niet beschikbaar voor deze as in deze weergave.",
    lqiNoteListingNativeHigh:
      "Component afkomstig uit het rapport: hoog niveau op deze as — te toetsen aan de echte advertentie-inhoud.",
    lqiNoteListingNativeModerate:
      "Component afkomstig uit het rapport: gemiddeld niveau — één signaal onder andere, geen op zichzelf staand oordeel.",
    lqiNoteListingLocalHigh:
      "Lokale /100-synthese op basis van de hierboven al uitgewerkte /10-dimensies: dezelfde signaalfamilie, compacte weergave.",
    lqiNoteListingLocalFallback:
      "Lokale /100-synthese op basis van de /10-subscores van de audit — indicatief en elders op de pagina al behandeld.",
    lqiNoteMarketNativeHigh:
      "Je advertentie blijft concurrerend tegenover de geanalyseerde nabijgelegen advertenties.",
    lqiNoteMarketNativeModerate:
      "Je marktpositionering is correct, maar nog verbeterbaar.",
    lqiNoteMarketNativeLow:
      "De waargenomen concurrenten lijken momenteel beter gepositioneerd.",
    lqiNoteMarketLocalHigh:
      "Lokale synthese (marktscores + algemeen /10): compacte indicatie, niet onafhankelijk van de marktblokken.",
    lqiNoteMarketLocalFallback:
      "Lokale synthese (marktscores + algemeen /10): indicatieve lezing, te combineren met ‘Marktpositionering’.",
    lqiNoteConversionUnavailable:
      "Er is geen /100-waarde beschikbaar voor deze dimensie: zie de conversiescore en aanbevelingen elders.",
    lqiNoteConversionNativeHigh:
      "Het conversiepotentieel is al sterk voor deze advertentie.",
    lqiNoteConversionNativeModerate:
      "Verschillende optimalisaties kunnen de conversie nog verbeteren.",
    lqiNoteConversionNativeLow:
      "Zichtbare fricties beperken nog steeds het boekingspotentieel.",
    lqiNoteConversionLocalFallback:
      "Indicatief: waarde aangevuld vanuit een ander rapportveld (boekingspotentieel), geen autonome conversiemeting.",
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
  ja: {
    loading: "監査レポートを読み込み中...",
    loadingWait: "レポートの読み込みが完了するまでお待ちください。",
    notFound: "この監査は見つかりませんでした。掲載ページから新しい分析を開始してください。",
    copied: "コピーしました",
    copyAction: "コピー",
    detectedSourceTitle: "検出されたソース: {value}",
    copyUnavailable: "現在この内容はコピーできません。",
    copyMainDescription: "メイン説明をコピー",
    copyOptimizedTitle: "最適化タイトルをコピー",
    copyHousing: "「My place」をコピー",
    copyDetailedHousing: "詳細な宿泊説明をコピー",
    copyGuestAccess: "ゲストアクセスをコピー",
    copyGuestInteraction: "ゲストとのやり取りをコピー",
    copyOtherInfo: "その他の案内をコピー",
    copyBookingSummary: "Booking 要約をコピー",
    bookingSummaryCopied: "要約をクリップボードにコピーしました。",
    noBookingSummary: "現在コピーできる要約はありません。",
    suggestedTextCopied: "提案テキストをクリップボードにコピーしました。",
    noDescriptionToCopy: "現在コピーできる説明はありません。",
    noTextToCopy: "現在コピーできるテキストはありません。",
    auditUnavailable: "監査を利用できません",
    auditCompleted: "監査が正常に完了しました",
    auditCompletedText: "掲載は分析済みで、最適化を開始できます。",
    businessReading: "ビジネス分析",
    heroTitle: "掲載が予約を逃している場所と、改善で得られるもの",
    host: "ホスト",
    hostUnavailableAgoda: "Agoda ではホスト情報を利用できません",
    listingRating: "掲載評価",
    ratingUnavailable: "評価を利用できません",
    guestReviews: "件のレビュー",
    reviewsUnavailable: "レビューを利用できません",
    marketPosition: "市場ポジション",
    businessImpact: "ビジネスへの影響",
    monthlyGainBenchmark: "月次収益ベンチマーク",
    propertyProfile: "物件プロフィール",
    propertyType: "宿泊施設タイプ",
    notSpecified: "未指定",
    bedrooms: "寝室",
    bathrooms: "バスルーム",
    guests: "宿泊人数",
    beds: "ベッド",
    minimumStay: "最低宿泊日数（泊）",
    marketPositioning: "市場ポジショニング",
    differentiatingAttributes: "差別化要素",
    minimumStay1: "1泊",
    minimumStay2: "2泊",
    minimumStay3: "3泊",
    minimumStay5: "5泊",
    minimumStay7: "7泊",
    minimumStay14: "14泊",
    marketTierStandard: "スタンダード",
    marketTierHighEnd: "ハイエンド",
    marketTierPremium: "プレミアム",
    marketTierExperientialLuxury: "体験型ラグジュアリー",
    marketTierUltraLuxury: "超高級",
    attributePrivatePool: "プライベートプール",
    attributeSeaView: "オーシャンビュー",
    attributeBeachfront: "ビーチフロント",
    attributeJacuzzi: "ジャグジー",
    attributeParking: "駐車場",
    attributeAirConditioning: "エアコン",
    attributeWifi: "Wi‑Fi",
    attributeGym: "ジム",
    attributeTerrace: "テラス",
    attributeConcierge: "コンシェルジュ",
    comparableWeightingHint: "比較対象の重み付けです。厳密なフィルターではありません。",
    marketRecalculationOnly: "市場の再計算のみ — AI 分析とスコアは変更されません。",
    diagnostic: "診断中…",
    recalibrateMarket: "市場を再調整",
    premiumMarketInsufficient: "プレミアム市場のサンプル不足",
    marketRecalibrated: "市場を再調整しました",
    premiumMarketText: "利用可能な比較物件を分析しましたが、選択されたプレミアムセグメントに十分近いものがありませんでした。そのため推定値は意図的に保守的なままです。",
    recalibratedMarketText: "競合セグメントは、最も近い比較物件を用いて絞り込まれました。",
    comparablesAnalyzed: "分析した比較物件",
    premiumComparables: "保持されたプレミアム比較物件",
    comparablesKept: "保持された比較物件",
    recalibratedMedian: "再調整後の中央値",
    recalibratedAverage: "再調整後の平均値",
    reliability: "信頼性",
    conversionLevel: "コンバージョン水準",
    conversionFragile: "コンバージョン基準: 弱い",
    conversionModerate: "コンバージョン基準: 中程度",
    conversionStrong: "コンバージョン基準: 強い",
    conversionScore: "コンバージョンスコア",
    estimatedImpact: "推定インパクト",
    ceiling: "上限",
    impactToConfirm: "要確認",
    readingWithoutRange: "％レンジなしの読み取り",
    listingAnalysis: "掲載分析",
    listingBadge: "掲載",
    bookingVariantBadge: "{value} ・Bookingバリアント",
    listingQuality: "掲載品質",
    listingQualityDescription: "掲載の内部分析: 写真、表示順、説明、設備、SEO、コンバージョン可能性。",
    globalConversionLevel: "総合コンバージョン水準",
    realMarket: "実市場",
    observedMarket: "観測市場",
    observedMarketDescription: "保持された比較物件、観測された競合価格、市場信頼性、算出された価格差に基づきます。",
    listingCompetitivePosition: "掲載の競争力比較",
    competitiveSummary: "保持された比較物件に基づく競争ポジションの要約です。",
    outOfMarketSegmentShort: "市場外セグメント",
    percentAfterMarketConsolidation: "市場の集計後に割合を表示",
    marketPositioningLabel: "市場ポジショニング",
    positioning: "ポジショニング",
    listingScore: "掲載スコア",
    market: "市場",
    base: "基盤",
    averageCompetitiveQuality: "競合の平均品質",
    localSegment: "ローカルセグメント",
    comparedPrices: "比較価格",
    consolidatedScore: "統合スコア",
    marketReliability: "市場信頼性",
    prioritySummary: "優先サマリー",
    topThreeLevers: "最も影響の大きい 3 つのレバー",
    actionable: "実行可能",
    strengthenDescription: "説明文を強化",
    improveSeo: "SEO を改善",
    preserveStrengths: "現在の強みを維持",
    marketPriorityDescriptionOne: "説明スコア: {score}。優先事項: 約束する価値をより具体的で差別化されたものにする。",
    marketPriorityDescriptionTwo: "SEO スコア: {score}。ローカルキーワード、強い設備、人気要素を追加する。",
    marketPriorityDescriptionThree: "写真: {photoScore} · 設備: {amenitiesScore}。これらのシグナルはすでに信頼を支えています。",
    marketLabelAbove: "競争水準より上",
    marketLabelBelow: "競争水準より下",
    marketLabelCompetitive: "競争平均内",
    marketPositionToConfirm: "ポジション要確認",
    marketBenchmarkAbove: "この掲載は現在、観測平均スコアより {value} ポイント上です。",
    marketBenchmarkBelow: "この掲載は現在、観測平均スコアより {value} ポイント下です。",
    marketBenchmarkAligned: "この掲載は観測された比較物件の平均水準にあります。",
    marketBenchmarkNone: "このエリアの読み取りに使える比較物件は保持されませんでした。",
    marketBenchmarkOne: "このエリアの 1 件の比較物件に基づく読み取りです。",
    marketBenchmarkMany: "このエリアの {count} 件の比較物件に基づく読み取りです。",
    marketBenchmarkPending: "十分な比較物件が観測されると、ローカル読み取りが利用可能になります。",
    marketScoreContextAbove: "あなたのスコアは現在の市場平均を明確に上回っています。",
    marketScoreContextBelow: "あなたのスコアは市場で観測された水準を下回っています。",
    marketScoreContextAligned: "あなたのスコアは市場平均水準とほぼ一致しています。",
    marketScoreContextObserved: "観測された比較物件に基づく読み取りです。",
    marketScoreContextMarketBelow: "市場平均は現在の掲載水準より下にあります。",
    marketScoreContextMarketAbove: "市場平均は現在の掲載水準より上にあります。",
    marketScoreContextMarketAligned: "掲載と市場は近い水準にあります。",
    marketScoreContextUnavailable: "十分な観測掲載が揃うと市場平均スコアが表示されます。",
    marketPositionNarrativeCompetitive: "この掲載は概ね近隣競合と同じ水準にあります。",
    marketPositionNarrativeAbove: "この掲載は近隣のローカル平均より高い水準にあるようです。",
    marketPositionNarrativeBelow: "この掲載は近隣のローカル平均より低い水準にあるようです。",
    marketPositionNarrativeNoComparables: "この監査では、近隣の競合掲載がまだ分析されていません。",
    heroMarketPositionSupport: "詳細な参照（比較物件、相対スコア、テキストシグナル）は「市場ポジショニング」ブロックを参照してください。",
    heroImpactSupportOutOfSegment: "価格セグメント外の比較物件が保持されています — この掲載ではビジネス推定は信頼できません。品質と内容のレバーのみが利用可能です。",
    heroImpactSupportDefault: "数値の目安: 伸び率は %、月次収益は「予約への推定影響」で €/月、右列のスコアは /10 です。",
    heroImpactSupportCompetitive: "掲載はすでに競争力があります。残る改善は主に価格ポジショニングと価値の明確化の微調整から生まれ、追加予約の小さいが現実的なシェアを取りに行く段階です。",
    heroBusinessLiftHintPrudent: "十分な市場価格基盤がないため、現在価格とコンバージョン可能性に基づく慎重な予測です。",
    heroBusinessLiftHintInsufficient: "信頼できる定量的インパクトを推定するには市場データが不足しています。",
    heroBusinessLiftHintDefault: "観測市場の品質と実際のコンバージョン水準に応じて、最適化された掲載は月次売上を改善できる可能性があります。",
    heroRevenueSupportUnavailable: "推定不可 — この集約読み取りには市場データが不足しています。",
    heroRevenueSupportIndicative: "推奨価格、観測市場水準、現実的な目標稼働率に基づく参考推定です。",
    heroRevenueSupportPrudent: "慎重な指標: 長期的な価格判断の前に予約量と比較物件を確認してください。",
    heroRevenueSupportFallback: "掲載価格と市場ベンチマーク（比較物件）を固めると定量読み取りが可能になります。",
    photoBadgeLow: "{count}枚の写真 • 画像を追加してください",
    photoBadgeMedium: "{count}枚の写真 • 良好なギャラリー",
    photoBadgeGood: "{count}枚の写真 • 充実したギャラリー",
    photoBadgeExcellent: "{count}枚の写真 • とても高い評価",
    heroImpactRevenueRange: "+{low} ～ +{high} / 月",
    marketIndicativeLabel: "参考値（基盤データ限定）",
    bookingLiftRange: "{low} ～ {high}",
    bookingLiftUpTo: "{value} まで",
    impactSideCardNarrativeCondensed: "簡易表示です。完全な % レンジは下の「{label}」カードにあります。",
    heroScoreNarrativeStrong: "/10 の読み取り: 強い水準 — レポートの提案でさらに磨き込みましょう。",
    marketReliabilityBadgeHigh: "高い信頼性",
    marketReliabilityBadgeMedium: "中程度の信頼性",
    marketReliabilityBadgeLow: "低い信頼性",
    marketReliabilityBadgeWeakFallback: "弱いフォールバック",
    marketReliabilityMessageHigh: "一貫した比較物件が複数あり、使える市場基盤があります。",
    marketReliabilityMessageMedium: "参考になる市場基盤ですが、さらに補強が必要です。",
    marketReliabilityMessageLow: "市場基盤が限定的です。慎重に解釈してください。",
    marketReliabilityMessageWeakFallback: "フォールバック市場基盤のみです。特に慎重に解釈してください。",
    marketReliabilityTitleUsable: "利用可能な市場",
    marketReliabilityTitleLimited: "限定的な評価",
    marketReliabilityTitleLow: "ローカル市場は十分に活用できません",
    marketReliabilityTitleWeakFallback: "限定的なローカル基盤",
    marketSourceLabelCrossPlatform: "クロスプラットフォーム・ベンチマーク",
    marketSourceMessageCrossPlatform:
      "Booking の比較対象が十分でないため、Booking 以外の比較対象を使用しました。",
    marketComparablesBodyStrong: "このセグメント内で掲載を位置付けるための使える競争基盤です。",
    marketComparablesBodyNone: "この市場読み取りでは信頼できる比較物件が保持されませんでした。",
    marketComparablesBodyLimited: "{base} サンプルは限定的ですが、参考にはなります。さらに補強が必要です。",
    toConfirm: "要確認",
    pricingPositioning: "価格ポジショニング",
    pricingOpportunity: "価格改善の機会を検出",
    pricingAligned: "価格は市場と整合",
    pricingAboveMedian: "価格は中央値より上",
    observedMedian: "観測中央値",
    recommendedPrice: "推奨価格",
    belowMedian: "中央値より下",
    marketAligned: "市場と整合",
    aboveMedian: "中央値より上",
    potentialMonthlyGain: "潜在的な月次増益",
    estimatedMonthlyRisk: "推定月次リスク",
    estimatedMonthlyImpact: "推定月次インパクト",
    pricingAssumption: "価格前提: 20泊 / 月",
    pricingInsightUnderpriced:
      "あなたの価格は観測中央値より {value}% 低くなっています。推奨価格に向けて段階的に引き上げることで、分析された競争セグメントから急に外れることなく収益改善が期待できます。",
    pricingInsightOptimal:
      "あなたの価格は観測中央値（{value}%）に近い水準です。主なレバーは大幅な値上げではなく、コンバージョンと見せ方の改善です。",
    pricingInsightOverpriced:
      "あなたの価格は観測中央値より {value}% 高くなっています。品質シグナルでこの差を明確に正当化できない場合、価格が摩擦要因になる可能性があります。",
    pricingIndicativeCaution:
      "{value} — ローカル基盤がまだ限定的なため、価格ポジションは慎重に解釈してください。",
    insufficientComparablePricing: "データ不足: 中央値や価格インパクトを推定する信頼できる比較物件がありません。",
    insufficientPricingData: "信頼できる価格影響を推定する市場データが不足しています。",
    pricingBenchmarks: "価格ベンチマーク",
    pricingBenchmarksTitle: "価格が競合と比べてどう見えるか",
    pricingBenchmarksDescription: "観測平均価格と比較市場との差に基づく価格ベンチマークです。",
    reportFrictionSignalsTitle: "レポート由来の摩擦シグナル",
    reportFrictionSignalsSubtitle:
      "補足のみ: 主な「弱み」や「市場との差の主要点」リスト外の抜粋です。示唆的な情報であり、失われた予約数の直接的な指標ではありません。",
    mainMarketGapsTitle: "市場との差の主要ポイント",
    mainMarketGapsEmpty:
      "現時点でレポートに市場差は記載されていません。この軸のデータが不足または非構造化であるだけで、実際の差がないことを意味するわけではありません。",
    mainMarketAdvantagesTitle: "市場に対する主な優位点",
    mainMarketAdvantagesEmpty:
      "現時点では明確な優位点は特定されていません。",
    missingAmenitiesChecklistTitle: "不足している設備チェックリスト",
    avgCompetitorPriceSupportInsufficient: "信頼できる価格基準を作るには市場サンプルが不足しています。",
    avgCompetitorPriceSupportLimited: "参考値です。ローカル基盤はまだ限定的で、より多くの比較物件で補強が必要です。",
    avgCompetitorPriceSupportObserved: "このセグメントで保持された掲載に基づく観測競合ベンチマークです。",
    avgCompetitorPriceSupportPending: "信頼できる競合価格が固まると、この価格ベンチマークはより有用になります。",
    averageCompetitorPrice: "競合の平均価格",
    priceGapVsMarket: "市場との差",
    priceDeltaInsufficientSample: "サンプル不足",
    marketCompetitorPricesDispersed: "競合価格が分散しています",
    priceDeltaUnavailable: "ここでは価格差を計算できません。掲載価格または市場ベンチマークが、信頼できる割合を出すのに不十分です。",
    priceDeltaPending: "掲載価格と信頼できる市場ベンチマークが固まれば、ここにパーセンテージ差が表示されます。",
    notReliable: "信頼不可",
    marketAnalysisPending: "十分な市場サンプルが得られるまで分析は保留です。",
    businessProjection: "ビジネス予測",
    marketPricePositionWellAbove:
      "あなたの価格は観測市場よりかなり高く、非常に強い品質シグナルで正当化する必要があります。",
    marketPricePositionSlightlyAbove:
      "あなたの価格は市場よりやや高めです。約束する価値が明確ならプレミアムポジションは可能です。",
    marketPricePositionBelow:
      "あなたの価格は観測市場より低く、料金最適化の余地がありそうです。",
    marketPricePositionSlightlyBelow:
      "あなたの価格は市場よりやや低めで、魅力的なポジションかつ緩やかな上昇余地があります。",
    marketPricePositionAligned:
      "あなたの価格はこの市場で観測された平均水準と一致しています。",
    marketPricePositionPending:
      "信頼できる競合平均価格が利用可能になり次第、価格ポジションを明確化します。",
    priceDeltaIndicativeSample:
      "限られたローカルサンプルに基づく参考差分です。",
    marketAverageRatingObserved:
      "観測された競合の平均評価: {value}/{scale}。",
    marketAverageRatingUnavailable:
      "競合の平均評価はまだ利用できません。",
    competitorCountSupportAvailable:
      "競争ポジションを評価するために比較対象が保持されました。",
    competitorCountSupportNone:
      "この読み取りに保持された比較対象はなく、ポジションは参考値のままです。",
    competitorCountSupportPending:
      "比較対象の正確な件数が利用可能になるまで、このポジションは確認待ちの参考値です。",
    competitorCountSupportPartial:
      "比較対象件数が十分に固まるまで、市場の読み取りは部分的なままです。",
    comparablesKpiLimited: "限定的な読み取り",
    comparablesKpiNone: "信頼できる比較対象なし",
    comparablesKpiOne: "限定的な読み取り — 利用可能な比較対象 1 件",
    comparablesKpiTwo: "限定的な読み取り — 利用可能な比較対象 2 件",
    lqiPartialIndex: "部分インデックス",
    lqiToConsolidate: "要補強",
    insufficientData: "データ不足",
    revenueImpactRangeDisplay:
      "現在の推定: 月 {current} · 最適化後: 月 {low}〜{high}",
    monthlyGainQualifierLimited:
      "{value} — ベンチマークを安定させるには、さらに多くの比較対象と照合してください。",
    monthlyGainQualifierFragile:
      "参考仮説のため要確認です（価格や比較対象の信頼性がまだ不十分で、明確な市場基準とは言えません）。",
    projectionsPotential: "予測とポテンシャル",
    projectionsDescription: "市場シグナル、競争ポジション、観測されたコンバージョン可能性に基づく参考推定です。",
    nightlyPrice: "1泊あたり価格",
    premiumPosition: "プレミアムポジション",
    aggressivePosition: "攻めのポジション",
    balancedPosition: "バランス型ポジション",
    qualitativeAnalysisOnly: "定性的分析のみ",
    businessPotentialAfterOptimization: "最適化後のビジネスポテンシャル",
    estimatedBookingsAfterOptimization: "最適化後の推定予約数",
    projectionBase: "予測基盤",
    crossPlatformReading: "クロスプラットフォーム読み取り",
    readableMarket: "読み取り可能な市場",
    cautiousReading: "慎重な読み取り",
    lowVisibility: "低い可視性",
    conversionGainPotential: "潜在的なコンバージョン増加",
    actionableProjection: "実行可能な予測",
    limitedProjection: "限定的な予測",
    cautiousProjection: "慎重な予測",
    indicativeProjection: "参考予測",
    estimatedMonthlyGainTitle: "推定月次増益",
    estimatedImpactOnBookings: "予約への推定影響",
    impactBusinessBlockIntroOutOfSegment: "価格セグメント外の比較物件が保持されました — 品質、内容、視覚コンバージョンに関する提案のみが信頼して解釈できます。",
    impactBusinessBlockIntroDefault: "以下の各カードは固定単位を使います: 価格は €、相対市場スコアは /10、予約増加は %、推定月次増益は €/月（総売上ではなく追加分）です。",
    currentPriceContextCompareMarket: "推定市場平均価格 {value} と比較してください。",
    currentPriceContextDetected: "現在価格は掲載内で検出されました。",
    currentPriceContextMarketReference: "現在価格は不明です。観測市場参考値: 約 {value}/泊。",
    currentPriceContextMissing: "この掲載では現在価格を利用できません。",
    currentPriceUnavailable: "現在価格を利用できません",
    projectionBaseNoComparable: "使える競争平均を出すのに十分一貫した比較物件がありません。",
    projectionBaseRobust: "{count} 件の比較物件から構築した強固な競争基盤です。",
    projectionBasePartial: "{count} 件の利用可能な比較物件に基づく部分ベンチマークです。",
    projectionBaseUnstable: "検出された市場はまだ不安定で、信頼できる競争ベンチマークを提供できません。",
    potentialToConfirm: "ポテンシャル要確認",
    conversionGainLowConfidence: "市場信頼性がまだ不足しており、説得力のあるコンバージョン増加を予測できません。",
    conversionGainFromScoreAndPrice: "信頼できる競合価格ベンチマークなしで、コンバージョンスコアと現在価格に基づく予測です。",
    conversionGainOutOfSegment: "セグメント外の比較物件を検出 — この掲載の予約ポテンシャルは信頼して見積もれません。",
    conversionGainPendingRange: "市場基盤（比較物件と統合スコア）が十分信頼できるようになると、推定月次増益と同様に % レンジが表示されます。",
    conversionGainEstimated: "現在のポジションと分析された競合掲載に基づく推定です。",
    conversionGainNoRange: "現在のレポートデータでは予約増加の % レンジは利用できません。",
    monthlyGainOutOfSegment: "セグメント外の比較物件 — この市場には増益予測を適用できません。",
    monthlyGainUnavailable: "推定不可 — 市場データ不足です。使える定量レンジには、信頼できる掲載価格と統合された競争ベンチマークが必要です。",
    monthlyGainNeedsStableMarket: "定量的な推定には、一貫した掲載価格と統合された観測市場水準が必要です。",
    optimizedTexts: "最適化された掲載テキスト",
    optimizedTextVariantLabel: "バリアント {index} - {label}",
    optimizedTextIntro: "掲載内容とレポートシグナルからローカルのテキストモデルで組み立てた提案です（この画面では外部モデル呼び出しなし）。ブランドに合わせて調整してください。",
    optimizedTextVariantCounter: "バリアント {index} / {total}",
    optimizedTextVariantNameComfort: "快適さとくつろぎ",
    optimizedTextVariantNamePractical: "実用性とスムーズさ",
    optimizedTextVariantNameNeighborhood: "周辺環境と立地",
    optimizedTextVariantNamePremium: "プレミアムと信頼",
    optimizedTextVariantNameBusiness: "短期滞在 / ビジネス",
    variant: "バリアント",
    changeVariant: "バリアントを変更",
    descriptionCopied: "説明をコピーしました",
    newVariantReady: "新しいバリアントの準備ができました。",
    currentTitle: "現在のタイトル",
    optimizedTitleExample: "最適化タイトル例",
    aiGeneratingTitle: "AIタイトルを生成中…",
    missingListingTitle: "この掲載には利用可能なタイトルがありません。",
    aiDescriptionPlaceholder: "掲載データと監査データが利用可能になり次第、提案テキストがここに表示されます。",
    aiGeneratingDescription: "AI生成を実行中…",
    aiProvenanceAi: "AI",
    aiProvenanceFallbackLocal: "ローカルフォールバック",
    aiDescriptionFailed: "この言語のAI生成に失敗しました。後でもう一度お試しください。",
    aiDescriptionUnavailable: "この言語ではまだAIによるAirbnb説明文を利用できません。",
    aiFallbackHousing: "快適で過ごしやすく、滞在のあらゆる瞬間をよりスムーズにしてくれる住まいでおくつろぎください。",
    aiFallbackDetailedHousing: "この宿泊施設は、分かりやすい空間、有用な設備、心地よい雰囲気を備え、滞在をしっかり楽しめる体験を提供します。",
    aiFallbackGuestAccess: "ゲストは、宿泊施設、滞在用スペース、日常に便利な設備へスムーズにアクセスできます。",
    aiFallbackGuestInteraction: "滞在前も滞在中も、役立つ案内を共有し、実務的な質問にシンプルにお答えできるよう対応します。",
    aiFallbackOtherInfo: "実用的な情報は到着をスムーズにし、滞在の流れを明確にし、ゲストが安心して宿泊施設を楽しめるようにします。",
    myPlace: "My place",
    detailedPlace: "宿泊施設 — 詳細版",
    guestAccess: "ゲストアクセス",
    guestInteraction: "ゲストとのやり取り",
    otherInfo: "その他の案内事項",
    bookingDescriptionSummary: "説明の要約（Booking）",
    bookingSummaryFallback:
      "説明に含める内容: 空間の快適さ、宿泊施設へのアクセス、ゲスト対応のしやすさ、到着時に役立つ実用的な情報。",
    bookingSummaryReady: "表示中のバリアントに合わせた貼り付け用の要約です。",
    actionPlan: "アクションプラン",
    actionPlanSubtitle: "今すぐ着手すべき施策をビジネス影響順に並べています。",
    fallbackNarrativeFromWeaknesses:
      "レポートの弱点に基づくナラティブのフォールバックです。参考値であり、厳密な市場ベンチマークではありません。",
    fallbackNarrativeFromStrengths:
      "レポートの強みに基づくナラティブのフォールバックです。参考値であり、厳密な市場ベンチマークではありません。",
    actionPlanIntroAttractiveness: "このビューでは、掲載の魅力、もてなし、見せ方を強化するためのレバーを優先度順にまとめています。",
    actionPlanIntroConversion: "このビューでは、提案内容を明確化し、旅行者を安心させ、意思決定を早める改善を優先度順にまとめています。",
    actionPlanIntroStorytelling: "ここでは、ストーリーテリング、差別化、宿泊意欲を支えるためのアクションを整理します。",
    actionPlanIntroDefault: "詳細な改善計画が利用可能になり次第、ここにアクションが整理されます。",
    actionSignalLabel: "シグナル",
    actionImpactHigh: "高インパクト",
    actionImpactMedium: "中インパクト",
    actionImpactLow: "低インパクト",
    actionScoreLabel: "影響を受けるスコア",
    actionObjectiveLabel: "目的",
    actionSignalFallback: "シグナル要確認。",
    actionObjectiveFallback: "検出されたビジネスインパクトに基づいて優先順位を付けてください。",
    actionEmptyState: "現在利用可能な優先アクションはありません。",
    actionImprovementFallback: "改善 {index}",
    actionScoreLineWithValue: "{label}: {value}/10。",
    actionScoreLinePending: "{label}: 要確認。",
    actionLabelDescription: "説明",
    actionLabelSeo: "SEO",
    actionLabelPhotos: "写真",
    actionLabelAmenities: "設備",
    actionLabelConversion: "コンバージョン",
    actionLabelPricing: "価格",
    actionNarrativeDescription: "テキストは、掲載情報を旅行者にとって具体的な価値へよりよく変換する必要があります。快適さ、体験、立地、そして予約理由です。",
    actionReasonDescription: "説明スコア + 旅行者の投影品質。",
    actionNarrativeSeo: "タイトルと冒頭文には、立地、人気設備、差別化要素といった有用なキーワードをよりよく組み込む必要があります。",
    actionReasonSeo: "SEO スコア + プラットフォーム上の可視性。",
    actionNarrativePhotos: "ビジュアルは最初の数秒で安心感を与え続ける必要があります。最良の空間、明るさ、快適さ、知覚価値を先に見せましょう。",
    actionReasonPhotos: "写真スコア + ギャラリー順序。",
    actionNarrativeAmenities: "主要設備は予約前の不安を減らし、快適さの認識を高めるために、より目立つ必要があります。",
    actionReasonAmenities: "設備スコア + 滞在への安心感。",
    actionNarrativeConversion: "優先事項は迷いを減らすことです。明確な約束、見える証拠、具体的な情報、タイトル・写真・説明の一貫性です。",
    actionReasonConversion: "コンバージョンスコア + 意思決定の摩擦。",
    actionReasonPricing: "価格ポジショニング + 比較市場の検証。",
    actionReasonMarketComparables: "市場読み取りに {count} 件の比較掲載を使用しました。",
    actionNarrativeFallback: "レポート由来のアクションです。ビジネスインパクトと利用可能なシグナルで優先順位を付けてください。",
    actionNormalizedTitleClarify: "予約を動かす情報を明確にする",
    actionNormalizedTitleConcreteValue: "価値をより具体的にする",
    actionNormalizedTitleAnalyzePricingGap: "測定された価格差を分析する",
    actionNormalizedTitleBuildTrust: "予約前の信頼を強化する",
    actionNormalizedDescriptionPricingCompare: "対応事項: 調整の前に、タイプ、立地、サービス水準が本当に近い掲載だけと価格を比較してください。",
    auditLeversDetailTitle: "掲載レバーの詳細",
    auditStrengthsTitle: "強み",
    auditStrengthsSource: "出典: 監査サブスコアで測定された強いシグナル。",
    auditStrengthsEmpty: "利用可能なサブスコアでは、8/10 以上の測定可能な強いシグナルは検出されませんでした。",
    auditWeaknessesTitle: "弱み",
    auditWeaknessesSource: "出典: 監査サブスコアで測定された弱いシグナル。",
    auditWeaknessesEmpty: "利用可能なサブスコアでは、7/10 未満の測定可能な弱いシグナルは検出されませんでした。",
    auditStrengthPhotos: "写真が強い: {score}/10。",
    auditStrengthPhotoOrder: "写真順が強い: {score}/10。",
    auditStrengthDescription: "説明が高品質: {score}/10。",
    auditStrengthAmenities: "設備が十分に網羅: {score}/10。",
    auditStrengthSeo: "SEO が強い: {score}/10。",
    auditStrengthConversion: "コンバージョンが強い: {score}/10。",
    auditWeakDescription: "説明に改善が必要: {score}/10。",
    auditWeakSeo: "SEO の強化が必要: {score}/10。",
    auditWeakConversion: "コンバージョンの強化が必要: {score}/10。",
    auditWeakAmenities: "設備の補完が必要: {score}/10。",
    auditWeakPhotoQuality: "写真品質の改善が必要: {score}/10。",
    auditWeakPhotoOrder: "写真順の見直しが必要: {score}/10。",
    nextStepTitle: "推奨される次のステップ",
    nextStepDescription: "まず収益性の高いレバーを修正し、その後に監査を再実行して改善効果を測定してください。",
    nextStepRunAudit: "監査を再実行",
    nextStepBackToAudits: "監査一覧に戻る",
    nextStepAnalyzeAnother: "別の掲載を分析",
    businessPriority: "ビジネス優先度",
    quickOptimization: "クイック最適化",
    visibility: "可視性",
    reassurance: "安心感",
    improvement: "改善",
    photoQuality: "写真品質",
    photoOrderQuality: "写真順",
    descriptionQualityLabel: "説明品質",
    amenitiesCompletenessLabel: "設備の充実度",
    seoPerformance: "SEO パフォーマンス",
    scoreOverviewTitle: "コンバージョン性能の詳細な読み取り",
    scoreOverviewTextAirbnb: "見えるシグナルに基づく読み取りです。基盤は、感情、もてなし、掲載の独自性をさらに強化する余地を示しています。",
    scoreOverviewTextDefault: "見えるシグナルに基づく読み取りです。基盤は、明確さ、安心感、コンバージョンの最適化に役立ちます。",
    scoreStatusConfirm: "要確認",
    scoreStatusPartialData: "データはまだ部分的です",
    scoreStatusExcellent: "優秀",
    scoreStatusExcellentDetail: "明確な競争優位",
    scoreStatusStrong: "強い",
    scoreStatusStrongDetail: "維持すべき良好シグナル",
    scoreStatusCorrect: "良好",
    scoreStatusCorrectDetail: "さらに最適化可能",
    scoreStatusNeedsWork: "改善が必要",
    scoreStatusNeedsWorkDetail: "コンバージョンへの影響が見える",
    scoreStatusWeak: "弱い",
    scoreStatusWeakDetail: "改善優先",
    subScorePhotosNote: "ビジュアルは強く安心感のある第一印象を作ります。旅行者が物件の品質をすぐ理解でき、予約前の迷いを減らします。",
    subScorePhotosFallback: "この領域を詳しく読むには写真データが不足しています。",
    subScorePhotosImpact: "影響: クリック率と信頼に強く作用。",
    subScorePhotosPriority: "優先事項: この水準を維持。",
    subScorePhotoOrderNote: "写真の順序は魅力的な要素をうまく前面に出しています。最初の画像は、快適さ、広さ、知覚価値をすぐに伝えるべきです。",
    subScorePhotoOrderFallback: "シグナルがより充実した時点で視覚順序を確認する必要があります。",
    subScorePhotoOrderImpact: "影響: 第一印象を改善します。",
    subScorePhotoOrderPriority: "優先事項: 最良の空間を最初に見せる。",
    subScoreDescriptionNote: "テキストは堅実ですが、実際の体験をもっと売り込めます。雰囲気、快適さ、具体的な利点、アクセス、周辺環境、他より選ぶ理由です。",
    subScoreDescriptionFallback: "ここで信頼できる読み取りを行うには、テキストが短すぎるか十分に利用できません。",
    subScoreDescriptionImpact: "影響: 旅行者の想像を強化します。",
    subScoreDescriptionPriority: "優先事項: 約束する価値をより具体的にする。",
    subScoreAmenitiesNote: "見える設備は快適さの認識を高めます。より正確で見せ方がよいほど、滞在品質への安心感が高まります。",
    subScoreAmenitiesFallback: "設備が十分に見えないか未入力です。読み取りを補完する必要があります。",
    subScoreAmenitiesImpact: "影響: 滞在の快適さへの安心感を高めます。",
    subScoreAmenitiesPriority: "優先事項: 主要設備をよりよく見せる。",
    subScoreSeoNote: "SEO は使える水準ですが、さらに精度を上げられます。タイトル、ローカルキーワード、人気設備が、掲載内容の理解に役立つべきです。",
    subScoreSeoFallback: "この領域で結論を出すにはシグナルが部分的すぎます。",
    subScoreSeoImpact: "影響: プラットフォーム上の順位改善に寄与します。",
    subScoreSeoPriority: "優先事項: タイトルと有用キーワードを強化する。",
    subScoreConversionNote: "コンバージョン可能性は良好ですが、まだ活性化できるレバーがあります。改善は、より明確な約束、より強い安心感、より具体的な内容から生まれます。",
    subScoreConversionFallback: "追加データで読み取りを補強する必要があります。",
    subScoreConversionImpact: "影響: 予約判断に直接作用します。",
    subScoreConversionPriority: "優先事項: 安心感と明確さを改善する。",
    iqaBusinessIndicator: "ビジネス指標",
    iqaPerceivedListingQuality: "知覚される掲載品質",
    iqaReading: "IQA 読み取り",
    iqaNarrativePremium: "プレミアム読み取り: 知覚された総合水準は分析市場に対して強固です。",
    iqaNarrativeCompetitive: "競争基盤は健全で、まだ活用できるレバーが複数あります。",
    iqaNarrativeFragile: "品質ポジションは観測された競合掲載に対して依然として脆弱です。",
    iqaNarrativeRebuilt: "見えるシグナルと監査総合スコアから再構築した読み取りです。",
    scoreSideCardNarrativeLow:
      "/10 の読み取り: 脆弱な水準 — 「全体コンバージョン水準」で各項目の詳細を確認してください。",
    scoreSideCardNarrativeMedium:
      "/10 の読み取り: 中程度の水準 — メインブロックのサブスコアを確認してください。",
    impactSideCardNarrativeOutOfMarket:
      "市場セグメント外です — この掲載ではビジネスデータを信頼して利用できません。",
    impactSideCardNarrativeMarketPending:
      "この掲載には最適化余地がある可能性がありますが、数値化された割合は、市場基盤が十分に強固になった時点（信頼できる比較物件が少なくとも3件、市場スコアが統合済み）で、ユーロ推定と同じ原則に従って表示されます。",
    impactSideCardNarrativeNoRange:
      "レポート内に利用可能な伸び率 % レンジはありません。",
    prioritizedActionsIntroAirbnb:
      "生成された提案を、差別化が大きいものから構造的に重要なものへと進む順に並べています。",
    prioritizedActionsIntroDefault:
      "生成された提案を、明確さ・安心感・コンバージョンを最大化する順に並べています。",
    prioritizedActionsIntroEmpty:
      "この監査ではまだ優先アクションが抽出されていません。",
    prioritizedActionsSublineAirbnb:
      "感情、独自性、予約したくなる気持ちを強めるための流れです。",
    prioritizedActionsSublineDefault:
      "役立つ情報、安心感、実行しやすさをすばやく届けるための流れです。",
    strengthsFallbackAirbnb:
      "まだ構造化された強みは抽出されていません — ストーリーテリング、おもてなし、独自性を考えてみてください。",
    strengthsFallbackDefault:
      "まだ構造化された強みは抽出されていません — 根拠、明確さ、安心感を考えてみてください。",
    weaknessesFallbackInsightIsolated:
      "現在の方法では、「インサイト」から明確な弱点を切り出すことができませんでした。",
    weaknessesFallbackInsightStructured:
      "レポートに構造化された「weaknesses」一覧はありません。「insights」はここで正式な弱点として重複表示していません — 優先アクションと市場差分を確認してください。",
    weaknessesFallbackNoStructuredAirbnb:
      "現時点ではレポートの構造化フィールドに弱点がありません — 読み取りが不完全なだけで、改善点がないことを意味するわけではありません。",
    weaknessesFallbackNoStructuredDefault:
      "現時点ではレポートの構造化フィールドに弱点がありません — 読み取りが不完全なだけで、改善点がないことを意味するわけではありません。",
    lqiNoteUnavailable:
      "このビューでは、この軸に関するデータは利用できません。",
    lqiNoteListingNativeHigh:
      "レポート提供の要素です: この軸は高水準ですが、実際の掲載内容と照合して確認してください。",
    lqiNoteListingNativeModerate:
      "レポート提供の要素です: 中程度の水準であり、単独の判定ではなく複数シグナルの一つです。",
    lqiNoteListingLocalHigh:
      "上で既に詳述した /10 指標から再構成したローカル /100 サマリーです。同じシグナル群の凝縮表示です。",
    lqiNoteListingLocalFallback:
      "監査の /10 サブスコアから作成したローカル /100 サマリーです。参考値であり、ページ内の他の箇所でも扱われています。",
    lqiNoteMarketNativeHigh:
      "この掲載は、分析対象となった近隣掲載に対して競争力を保っています。",
    lqiNoteMarketNativeModerate:
      "市場での位置取りは適切ですが、まだ改善の余地があります。",
    lqiNoteMarketNativeLow:
      "観測された競合の方が、現時点ではより良い位置にいるようです。",
    lqiNoteMarketLocalHigh:
      "ローカルサマリー（市場スコア + 総合 /10）です。市場ブロックとは独立しない凝縮指標です。",
    lqiNoteMarketLocalFallback:
      "ローカルサマリー（市場スコア + 総合 /10）です。参考読み取りとして「市場ポジショニング」とあわせて確認してください。",
    lqiNoteConversionUnavailable:
      "この項目に /100 値はありません。コンバージョンスコアと提案を他のブロックで確認してください。",
    lqiNoteConversionNativeHigh:
      "この掲載のコンバージョンポテンシャルはすでに高い状態です。",
    lqiNoteConversionNativeModerate:
      "まだ複数の最適化でコンバージョンを改善できます。",
    lqiNoteConversionNativeLow:
      "見えている摩擦要因が、予約ポテンシャルをまだ制限しています。",
    lqiNoteConversionLocalFallback:
      "参考値です。レポート内の別フィールド（予約ポテンシャル）から補完されたもので、独立したコンバージョン測定ではありません。",
    lqiLabelHighSignal: "強いシグナル",
    lqiLabelFavorable: "良好なシグナル",
    lqiLabelImproving: "改善中",
    lqiLabelNeedsWork: "強化が必要",
    lqiSummaryNoObject: "レポートに LQI オブジェクトは存在しません。/100 の値は、このページの他の /10 シグナルから構築したローカル要約であり、別の独立した測定セットではありません。",
    lqiSummaryIndicativeScore: "主要な /100 スコアは参考値です。レポートにネイティブの数値 IQA 指標がないため、総合 /10 スコアから導出しています。",
    lqiSummaryOverview: "品質 / 市場 / コンバージョンの概要: 各カードの下で、「レポート構成要素」= 提供された構造化フィールド、「ローカル要約」= ページ上の /10 値の集約、「レポート補足」= レポートの別フィールド（例: 予約ポテンシャル）であり、独立したコンバージョン指標ではありません。",
    lqiSummaryPending: "有用なシグナルが利用可能になると、この指標が表示されます。",
    lqiSummaryCompetitiveButOptimizable: "掲載は競争力がありますが、見えるいくつかのレバーで、特に最初の画面から価値提案をより明示することで、コンバージョンとポジショニングをさらに改善できます。",
    listingConversion: "掲載コンバージョン",
  },
  zh: {
    loading: "正在加载审计报告...",
    loadingWait: "请稍候，报告正在加载。",
    notFound: "找不到此审计。请从房源页面发起新的分析。",
    copied: "已复制",
    copyAction: "复制",
    detectedSourceTitle: "已检测来源：{value}",
    copyUnavailable: "当前无法复制此内容。",
    copyMainDescription: "复制主描述",
    copyOptimizedTitle: "复制优化标题",
    copyHousing: "复制“我的房源”",
    copyDetailedHousing: "复制详细版房源描述",
    copyGuestAccess: "复制访客进入方式",
    copyGuestInteraction: "复制与访客互动",
    copyOtherInfo: "复制其他注意事项",
    copyBookingSummary: "复制 Booking 摘要",
    bookingSummaryCopied: "摘要已复制到剪贴板。",
    noBookingSummary: "当前没有可复制的摘要。",
    suggestedTextCopied: "建议文本已复制到剪贴板。",
    noDescriptionToCopy: "当前没有可复制的描述。",
    noTextToCopy: "当前没有可复制的文本。",
    auditUnavailable: "审计不可用",
    auditCompleted: "审计已成功完成",
    auditCompletedText: "你的房源已分析完成，现在可以开始优化。",
    businessReading: "业务解读",
    heroTitle: "你的房源在哪里流失预订，以及你能获得什么提升",
    host: "房东",
    hostUnavailableAgoda: "Agoda 上无房东信息",
    listingRating: "房源评分",
    ratingUnavailable: "评分不可用",
    guestReviews: "条住客评价",
    reviewsUnavailable: "评价不可用",
    marketPosition: "市场位置",
    businessImpact: "业务影响",
    monthlyGainBenchmark: "月度收益基准",
    propertyProfile: "房源画像",
    propertyType: "房源类型",
    notSpecified: "未指定",
    bedrooms: "卧室",
    bathrooms: "浴室",
    guests: "可住人数",
    beds: "床位",
    minimumStay: "最少入住（晚）",
    marketPositioning: "市场定位",
    differentiatingAttributes: "差异化属性",
    minimumStay1: "1晚",
    minimumStay2: "2晚",
    minimumStay3: "3晚",
    minimumStay5: "5晚",
    minimumStay7: "7晚",
    minimumStay14: "14晚",
    marketTierStandard: "标准",
    marketTierHighEnd: "高端",
    marketTierPremium: "高级",
    marketTierExperientialLuxury: "体验型奢华",
    marketTierUltraLuxury: "超奢华",
    attributePrivatePool: "私人泳池",
    attributeSeaView: "海景",
    attributeBeachfront: "海滨",
    attributeJacuzzi: "按摩浴缸",
    attributeParking: "停车位",
    attributeAirConditioning: "空调",
    attributeWifi: "Wi‑Fi",
    attributeGym: "健身房",
    attributeTerrace: "露台",
    attributeConcierge: "礼宾服务",
    comparableWeightingHint: "竞品加权参考，并非严格过滤。",
    marketRecalculationOnly: "仅重新计算市场数据 — AI 分析和评分保持不变。",
    diagnostic: "诊断中…",
    recalibrateMarket: "重新校准市场",
    premiumMarketInsufficient: "高端市场样本不足",
    marketRecalibrated: "市场已重新校准",
    premiumMarketText: "我们分析了可用的竞品，但没有任何一套足够接近所选高端细分，因此估算将保持谨慎。",
    recalibratedMarketText: "竞争细分已使用最接近的竞品重新细化。",
    comparablesAnalyzed: "已分析竞品",
    premiumComparables: "保留的高端竞品",
    comparablesKept: "保留的竞品",
    recalibratedMedian: "重新校准后的中位数",
    recalibratedAverage: "重新校准后的平均值",
    reliability: "可靠性",
    conversionLevel: "转化水平",
    conversionFragile: "转化基准：脆弱",
    conversionModerate: "转化基准：中等",
    conversionStrong: "转化基准：强",
    conversionScore: "转化得分",
    estimatedImpact: "预估影响",
    ceiling: "上限",
    impactToConfirm: "影响待确认",
    readingWithoutRange: "无百分比区间解读",
    listingAnalysis: "房源分析",
    listingBadge: "房源",
    bookingVariantBadge: "{value} · Booking 变体",
    listingQuality: "房源质量",
    listingQualityDescription: "对房源的内部分析：照片、视觉顺序、描述、设施、SEO 和转化潜力。",
    globalConversionLevel: "整体转化水平",
    realMarket: "真实市场",
    observedMarket: "观察市场",
    observedMarketDescription: "基于保留竞品、观察到的竞争定价、市场可靠性和计算出的价格差。",
    listingCompetitivePosition: "你的房源与竞品相比如何",
    competitiveSummary: "基于保留竞品，对你的竞争位置进行综合解读。",
    outOfMarketSegmentShort: "非目标市场细分",
    percentAfterMarketConsolidation: "市场数据整合后显示百分比",
    marketPositioningLabel: "市场定位",
    positioning: "定位",
    listingScore: "房源得分",
    market: "市场",
    base: "基础",
    averageCompetitiveQuality: "竞品平均质量",
    localSegment: "本地细分",
    comparedPrices: "对比价格",
    consolidatedScore: "综合得分",
    marketReliability: "市场可靠性",
    prioritySummary: "优先总结",
    topThreeLevers: "影响最大的 3 个杠杆",
    actionable: "可执行",
    strengthenDescription: "加强描述",
    improveSeo: "优化 SEO",
    preserveStrengths: "保留当前优势",
    marketPriorityDescriptionOne: "描述得分：{score}。优先事项：让价值承诺更具体、更有差异化。",
    marketPriorityDescriptionTwo: "SEO 得分：{score}。加入本地关键词、核心设施和受欢迎元素。",
    marketPriorityDescriptionThree: "照片：{photoScore} · 设施：{amenitiesScore}。这些信号已经在支持信任。",
    marketLabelAbove: "高于竞争水平",
    marketLabelBelow: "低于竞争水平",
    marketLabelCompetitive: "处于竞争平均值内",
    marketPositionToConfirm: "位置待确认",
    marketBenchmarkAbove: "你的房源当前比观察平均得分高 {value} 分。",
    marketBenchmarkBelow: "你的房源当前比观察平均得分低 {value} 分。",
    marketBenchmarkAligned: "你的房源处于观察到的竞品平均水平。",
    marketBenchmarkNone: "在该区域的观察中，没有保留到可用竞品。",
    marketBenchmarkOne: "解读基于你所在区域的 1 个竞品。",
    marketBenchmarkMany: "解读基于你所在区域的 {count} 个竞品。",
    marketBenchmarkPending: "一旦观察到足够数量的竞品，本地解读将可用。",
    marketScoreContextAbove: "你的得分明显高于当前市场平均值。",
    marketScoreContextBelow: "你的得分仍低于市场中观察到的水平。",
    marketScoreContextAligned: "你的得分与市场平均水平基本一致。",
    marketScoreContextObserved: "基于观察到的竞品进行解读。",
    marketScoreContextMarketBelow: "市场平均水平仍低于你当前房源水平。",
    marketScoreContextMarketAbove: "市场平均水平仍高于你当前房源水平。",
    marketScoreContextMarketAligned: "你的房源与市场处于相近水平。",
    marketScoreContextUnavailable: "当观察到足够多的房源后，将显示市场平均得分。",
    marketPositionNarrativeCompetitive: "该房源整体上与附近竞争对手大致持平。",
    marketPositionNarrativeAbove: "该房源看起来高于附近本地平均水平。",
    marketPositionNarrativeBelow: "该房源看起来低于附近本地平均水平。",
    marketPositionNarrativeNoComparables: "此审计尚未分析任何附近竞品。",
    heroMarketPositionSupport: "详细参考（竞品、相对得分、文本信号）请见“市场定位”模块。",
    heroImpactSupportOutOfSegment: "保留的竞品超出定价细分范围 — 该房源的业务估算不可靠。只有质量和内容杠杆仍可参考。",
    heroImpactSupportDefault: "数值标记：提升幅度用 %，月收入用 €/月显示在“预估预订影响”中；右侧列为 /10 得分。",
    heroImpactSupportCompetitive: "该房源已经具有竞争力。剩余增益主要来自更细致的价格定位与价值表达优化，以争取额外但真实的预订份额。",
    heroBusinessLiftHintPrudent: "在缺少充分市场价格基础的情况下，基于当前价格与转化潜力做出的谨慎预测。",
    heroBusinessLiftHintInsufficient: "市场数据不足，无法估算可靠的量化影响。",
    heroBusinessLiftHintDefault: "根据观察到的市场质量和真实转化水平，优化后的房源可能提高你的月收入。",
    heroRevenueSupportUnavailable: "无法估算 — 用于此聚合解读的市场数据不足。",
    heroRevenueSupportIndicative: "基于推荐价格、观察到的市场水平和现实目标入住率的参考估算。",
    heroRevenueSupportPrudent: "谨慎指标：在做长期定价决策前，请先验证预订量与竞品。",
    heroRevenueSupportFallback: "先稳定房源标价与市场基准（竞品），才能启用量化解读。",
    photoBadgeLow: "{count} 张照片 • 添加更多视觉素材",
    photoBadgeMedium: "{count} 张照片 • 合格图集",
    photoBadgeGood: "{count} 张照片 • 图集较完整",
    photoBadgeExcellent: "{count} 张照片 • 表现非常强",
    heroImpactRevenueRange: "+{low} 至 +{high} / 月",
    marketIndicativeLabel: "参考读数（样本基础有限）",
    bookingLiftRange: "{low} 至 {high}",
    bookingLiftUpTo: "最高 {value}",
    impactSideCardNarrativeCondensed: "精简视图：完整百分比区间见下方“{label}”卡片。",
    heroScoreNarrativeStrong: "/10 解读：水平较强 — 可结合报告建议继续优化。",
    marketReliabilityBadgeHigh: "高可靠性",
    marketReliabilityBadgeMedium: "中等可靠性",
    marketReliabilityBadgeLow: "低可靠性",
    marketReliabilityBadgeWeakFallback: "弱回退",
    marketReliabilityMessageHigh: "市场基础可用，且有多套一致的竞品。",
    marketReliabilityMessageMedium: "市场基础具有参考性，但仍需补强。",
    marketReliabilityMessageLow: "市场基础有限：请谨慎解读。",
    marketReliabilityMessageWeakFallback: "仅有回退市场基础：请更加谨慎解读。",
    marketReliabilityTitleUsable: "可用市场",
    marketReliabilityTitleLimited: "有限参考",
    marketReliabilityTitleLow: "本地市场参考价值较低",
    marketReliabilityTitleWeakFallback: "有限的本地基础",
    marketSourceLabelCrossPlatform: "跨平台基准",
    marketSourceMessageCrossPlatform:
      "由于 Booking 可比房源不足，已使用非 Booking 的可比房源。",
    marketComparablesBodyStrong: "可用于在对应细分中定位你的房源的竞争基础。",
    marketComparablesBodyNone: "本次市场解读未保留任何可靠竞品。",
    marketComparablesBodyLimited: "{base} 样本较少：可提供参考，但仍需进一步补强。",
    toConfirm: "待确认",
    pricingPositioning: "价格定位",
    pricingOpportunity: "发现定价机会",
    pricingAligned: "价格与市场一致",
    pricingAboveMedian: "价格高于中位数",
    observedMedian: "观察中位数",
    recommendedPrice: "推荐价格",
    belowMedian: "低于中位数",
    marketAligned: "与市场一致",
    aboveMedian: "高于中位数",
    potentialMonthlyGain: "潜在月收益",
    estimatedMonthlyRisk: "预估月风险",
    estimatedMonthlyImpact: "预估月影响",
    pricingAssumption: "定价假设：20 晚 / 月",
    pricingInsightUnderpriced:
      "你的价格比观察到的中位数低 {value}%。逐步提高到建议价格，可能在不突然脱离已分析竞争区间的情况下提升收入。",
    pricingInsightOptimal:
      "你的价格接近观察到的中位数（{value}%）。主要杠杆并不是明显涨价，而是改善转化和展示。",
    pricingInsightOverpriced:
      "你的价格比观察到的中位数高 {value}%。如果质量信号无法明确支撑这一差距，价格可能会成为摩擦点。",
    pricingIndicativeCaution:
      "{value} —— 由于本地样本仍然有限，请谨慎解读价格定位。",
    insufficientComparablePricing: "数据不足：没有可靠竞品可用于估算中位数或价格影响。",
    insufficientPricingData: "市场数据不足，无法估算可靠的价格影响。",
    pricingBenchmarks: "价格基准",
    pricingBenchmarksTitle: "你的价格与竞品相比如何",
    pricingBenchmarksDescription: "基于观察到的平均价格以及与竞品市场之间的估算差距所建立的价格基准。",
    reportFrictionSignalsTitle: "报告中的摩擦信号",
    reportFrictionSignalsSubtitle:
      "仅作补充：摘录自主“弱项”和“与市场的主要差距”列表之外。仅供参考，并不直接对应流失预订量的衡量。",
    mainMarketGapsTitle: "与市场的主要差距",
    mainMarketGapsEmpty:
      "目前报告中未列出市场差距——这更可能意味着该维度的数据缺失或未结构化，而不一定表示确实没有差距。",
    mainMarketAdvantagesTitle: "相较市场的主要优势",
    mainMarketAdvantagesEmpty:
      "目前尚未识别出明确优势。",
    missingAmenitiesChecklistTitle: "缺失设施清单",
    avgCompetitorPriceSupportInsufficient: "市场样本不足，无法建立可靠的价格基准。",
    avgCompetitorPriceSupportLimited: "该基准仅供参考：本地市场基础仍然有限，需要更多竞品来补强。",
    avgCompetitorPriceSupportObserved: "基于该细分中保留房源的观察竞品基准。",
    avgCompetitorPriceSupportPending: "一旦可靠的竞品价格建立起来，这个价格基准会更有用。",
    averageCompetitorPrice: "竞品平均价格",
    priceGapVsMarket: "与市场价格差",
    priceDeltaInsufficientSample: "样本不足",
    marketCompetitorPricesDispersed: "竞争房源价格分散",
    priceDeltaUnavailable: "无法在此计算价格差：当前标价或市场基准不足以形成可靠百分比。",
    priceDeltaPending: "一旦当前标价与可靠市场基准稳定下来，这里将显示百分比差值。",
    notReliable: "不可靠",
    marketAnalysisPending: "等待足够市场样本后再进行分析。",
    businessProjection: "业务预测",
    marketPricePositionWellAbove:
      "你的价格明显高于观察到的市场水平：需要非常强的质量信号来支撑。",
    marketPricePositionSlightlyAbove:
      "你的价格略高于市场：如果承诺清晰，可能属于高端定位。",
    marketPricePositionBelow:
      "你的价格低于观察到的市场：看起来仍有定价优化空间。",
    marketPricePositionSlightlyBelow:
      "你的价格略低于市场：定位有吸引力，并有适度上调空间。",
    marketPricePositionAligned:
      "你的价格与该市场观察到的平均水平一致。",
    marketPricePositionPending:
      "一旦有可靠的竞争房源平均价格，价格定位将得到澄清。",
    priceDeltaIndicativeSample:
      "基于有限本地样本的参考差距。",
    marketAverageRatingObserved:
      "观察到的竞争房源平均评分：{value}/{scale}。",
    marketAverageRatingUnavailable:
      "竞争房源平均评分暂时不可用。",
    competitorCountSupportAvailable:
      "已保留可比房源以评估你的竞争定位。",
    competitorCountSupportNone:
      "本次分析未保留可比房源；当前定位仅供参考。",
    competitorCountSupportPending:
      "在获得精确的可比房源数量之前，该定位仍只是待巩固的参考。",
    competitorCountSupportPartial:
      "在可比房源数量巩固之前，市场解读仍然是部分性的。",
    comparablesKpiLimited: "解读有限",
    comparablesKpiNone: "无可靠可比房源",
    comparablesKpiOne: "解读有限 —— 1 个可用可比房源",
    comparablesKpiTwo: "解读有限 —— 2 个可用可比房源",
    lqiPartialIndex: "部分指数",
    lqiToConsolidate: "待巩固",
    insufficientData: "数据不足",
    revenueImpactRangeDisplay:
      "当前估算：{current} / 月 · 优化后：{low} 至 {high} / 月",
    monthlyGainQualifierLimited:
      "{value} —— 需要结合更多可比房源，才能让基准更稳定。",
    monthlyGainQualifierFragile:
      "这是需要确认的参考性假设（价格和/或可比房源仍不足以形成清晰的市场基准）。",
    projectionsPotential: "预测与潜力",
    projectionsDescription: "基于市场信号、竞争定位和观察到的转化潜力给出的参考估算。",
    nightlyPrice: "每晚价格",
    premiumPosition: "高端定位",
    aggressivePosition: "激进定位",
    balancedPosition: "平衡定位",
    qualitativeAnalysisOnly: "仅定性分析",
    businessPotentialAfterOptimization: "优化后的业务潜力",
    estimatedBookingsAfterOptimization: "优化后的预估预订量",
    projectionBase: "预测基础",
    crossPlatformReading: "跨平台解读",
    readableMarket: "可读市场",
    cautiousReading: "谨慎解读",
    lowVisibility: "低可见性",
    conversionGainPotential: "潜在转化增长",
    actionableProjection: "可执行预测",
    limitedProjection: "有限预测",
    cautiousProjection: "谨慎预测",
    indicativeProjection: "参考预测",
    estimatedMonthlyGainTitle: "预估月收益",
    estimatedImpactOnBookings: "对预订的预估影响",
    impactBusinessBlockIntroOutOfSegment: "保留了超出价格细分范围的竞品 — 只有质量、内容和视觉转化建议可以被可靠解读。",
    impactBusinessBlockIntroDefault: "下方每张卡片都使用固定单位：€ 表示价格，/10 表示相对市场得分，% 表示预订提升，€/月 表示预估月收益（增量而非总收入）。",
    currentPriceContextCompareMarket: "请与估算市场均价 {value} 对比。",
    currentPriceContextDetected: "已在房源中检测到当前价格。",
    currentPriceContextMarketReference: "当前价格不可用。观察市场参考值：约 {value}/晚。",
    currentPriceContextMissing: "该房源当前价格不可用。",
    currentPriceUnavailable: "当前价格不可用",
    projectionBaseNoComparable: "没有足够一致的竞品来建立可用的竞争平均值。",
    projectionBaseRobust: "基于 {count} 个竞品建立的强健竞争基础。",
    projectionBasePartial: "基于 {count} 个可用竞品的部分基准。",
    projectionBaseUnstable: "检测到的市场仍过于不稳定，无法提供可靠的竞争基准。",
    potentialToConfirm: "潜力待确认",
    conversionGainLowConfidence: "市场置信度仍不足以推演可信的转化增长。",
    conversionGainFromScoreAndPrice: "基于转化得分与当前价格的预测，但没有可靠的竞争价格基准。",
    conversionGainOutOfSegment: "检测到跨细分竞品 — 该房源的预订潜力无法被可靠估算。",
    conversionGainPendingRange: "一旦市场基础（竞品和综合得分）足够可靠，就会像预估月收益一样显示百分比区间。",
    conversionGainEstimated: "基于你当前定位和分析过的竞品得出的估算。",
    conversionGainNoRange: "当前报告数据中没有可用的预订提升百分比区间。",
    monthlyGainOutOfSegment: "竞品超出细分范围 — 该市场不适用收益预测。",
    monthlyGainUnavailable: "无法估算 — 市场数据不足。要得到可用的量化区间，需要可靠标价和稳定的竞争基准。",
    monthlyGainNeedsStableMarket: "量化估算需要一致的标价和稳定的观察市场水平。",
    optimizedTexts: "优化后的房源文案",
    optimizedTextVariantLabel: "版本 {index} - {label}",
    optimizedTextIntro: "基于你的房源和报告信号，使用本地文本模型生成的建议（本页面不会调用远程模型）。请根据你的品牌风格进行调整。",
    optimizedTextVariantCounter: "版本 {index} / {total}",
    optimizedTextVariantNameComfort: "舒适与放松",
    optimizedTextVariantNamePractical: "实用与顺畅",
    optimizedTextVariantNameNeighborhood: "社区与位置",
    optimizedTextVariantNamePremium: "高端与信任",
    optimizedTextVariantNameBusiness: "短住 / 商务",
    variant: "版本",
    changeVariant: "切换版本",
    descriptionCopied: "描述已复制",
    newVariantReady: "新版本已准备好。",
    currentTitle: "当前标题",
    optimizedTitleExample: "优化标题示例",
    aiGeneratingTitle: "正在生成 AI 标题…",
    missingListingTitle: "此房源没有可用标题。",
    aiDescriptionPlaceholder: "一旦房源和审计数据可用，建议文案就会显示在这里。",
    aiGeneratingDescription: "AI 生成进行中…",
    aiProvenanceAi: "AI",
    aiProvenanceFallbackLocal: "本地回退",
    aiDescriptionFailed: "该语言的 AI 生成失败了，请稍后再试。",
    aiDescriptionUnavailable: "该语言目前还没有可用的 Airbnb AI 描述。",
    aiFallbackHousing: "入住一个舒适、实用、让每个停留时刻都更轻松的住所。",
    aiFallbackDetailedHousing: "这套房源提供完整的住宿体验，拥有清晰的空间布局、实用的设施和舒适愉悦的氛围。",
    aiFallbackGuestAccess: "住客可以轻松进入房源、入住期间的各个空间以及日常所需的实用设施。",
    aiFallbackGuestInteraction: "我会在入住前和入住期间保持可联系，分享有用信息，并简洁地回答实际问题。",
    aiFallbackOtherInfo: "实用信息能让抵达更顺畅、让入住安排更清晰，也帮助住客更安心地享受房源。",
    myPlace: "我的房源",
    detailedPlace: "房源 — 详细版",
    guestAccess: "访客进入方式",
    guestInteraction: "与访客互动",
    otherInfo: "其他注意事项",
    bookingDescriptionSummary: "描述摘要（Booking）",
    bookingSummaryFallback:
      "可在描述中加入：空间舒适度、房源出入方式、对住客的可联系性，以及抵达时有帮助的实用信息。",
    bookingSummaryReady: "可直接粘贴，且与当前显示版本保持一致。",
    actionPlan: "行动计划",
    actionPlanSubtitle: "按业务影响排序，建议你现在就启动的项目。",
    fallbackNarrativeFromWeaknesses:
      "基于报告弱项的叙述性回退。仅供参考，并非严格的市场基准。",
    fallbackNarrativeFromStrengths:
      "基于报告强项的叙述性回退。仅供参考，并非严格的市场基准。",
    actionPlanIntroAttractiveness: "该视图按优先级汇总可提升房源吸引力、接待感和展示效果的杠杆。",
    actionPlanIntroConversion: "该视图按优先级汇总可让产品更清晰、让旅客更安心并加快决策的改进。",
    actionPlanIntroStorytelling: "这里将按结构展示有助于讲故事、差异化和激发入住欲望的行动。",
    actionPlanIntroDefault: "一旦有更详细的改进计划，这里将按结构展示相关行动。",
    actionSignalLabel: "信号",
    actionImpactHigh: "高影响",
    actionImpactMedium: "中影响",
    actionImpactLow: "低影响",
    actionScoreLabel: "受影响得分",
    actionObjectiveLabel: "目标",
    actionSignalFallback: "信号待确认。",
    actionObjectiveFallback: "请根据检测到的业务影响排序。",
    actionEmptyState: "当前没有可用的优先行动。",
    actionImprovementFallback: "改进项 {index}",
    actionScoreLineWithValue: "{label}: {value}/10。",
    actionScoreLinePending: "{label}: 待确认。",
    actionLabelDescription: "描述",
    actionLabelSeo: "SEO",
    actionLabelPhotos: "照片",
    actionLabelAmenities: "设施",
    actionLabelConversion: "转化",
    actionLabelPricing: "价格",
    actionNarrativeDescription: "文案需要更好地把房源信息转化为旅客能感知的具体价值：舒适、体验、位置以及预订理由。",
    actionReasonDescription: "描述得分 + 旅客代入感质量。",
    actionNarrativeSeo: "标题和开头几行需要更好地整合有用关键词：位置、热门设施和差异化亮点。",
    actionReasonSeo: "SEO 得分 + 平台可见性。",
    actionNarrativePhotos: "图片需要在最初几秒持续建立信任：先展示最好的空间、采光、舒适感和感知价值。",
    actionReasonPhotos: "照片得分 + 图集顺序。",
    actionNarrativeAmenities: "关键设施需要更明显地展示，以减少预订前疑虑并增强舒适感。",
    actionReasonAmenities: "设施得分 + 入住安心感。",
    actionNarrativeConversion: "优先事项是减少犹豫：明确承诺、可见证明、具体信息，以及标题、照片、描述之间的一致性。",
    actionReasonConversion: "转化得分 + 决策摩擦。",
    actionReasonPricing: "价格定位 + 可比市场验证。",
    actionReasonMarketComparables: "使用了 {count} 个竞品房源来解读市场。",
    actionNarrativeFallback: "来自报告的行动建议：请依据业务影响和可用信号排序。",
    actionNormalizedTitleClarify: "明确触发预订的信息",
    actionNormalizedTitleConcreteValue: "让价值表达更具体",
    actionNormalizedTitleAnalyzePricingGap: "分析已测得的价格差",
    actionNormalizedTitleBuildTrust: "在预订前增强信任",
    actionNormalizedDescriptionPricingCompare: "待办：在做任何调价前，仅与类型、位置和服务水平真正相似的房源进行价格比较。",
    auditLeversDetailTitle: "房源杠杆明细",
    auditStrengthsTitle: "优势",
    auditStrengthsSource: "来源：由审计子分数测得的强信号。",
    auditStrengthsEmpty: "当前可用子分数中未检测到 8/10 及以上的可测强信号。",
    auditWeaknessesTitle: "弱点",
    auditWeaknessesSource: "来源：由审计子分数测得的弱信号。",
    auditWeaknessesEmpty: "当前可用子分数中未检测到低于 7/10 的可测弱信号。",
    auditStrengthPhotos: "照片表现强：{score}/10。",
    auditStrengthPhotoOrder: "照片顺序表现强：{score}/10。",
    auditStrengthDescription: "描述表现强：{score}/10。",
    auditStrengthAmenities: "设施覆盖良好：{score}/10。",
    auditStrengthSeo: "SEO 表现强：{score}/10。",
    auditStrengthConversion: "转化表现强：{score}/10。",
    auditWeakDescription: "描述需要改进：{score}/10。",
    auditWeakSeo: "SEO 需要加强：{score}/10。",
    auditWeakConversion: "转化需要加强：{score}/10。",
    auditWeakAmenities: "设施需要补充：{score}/10。",
    auditWeakPhotoQuality: "照片质量需要提升：{score}/10。",
    auditWeakPhotoOrder: "照片顺序需要调整：{score}/10。",
    nextStepTitle: "推荐下一步",
    nextStepDescription: "先修复最赚钱的杠杆，然后重新运行审计以衡量已获得的提升。",
    nextStepRunAudit: "重新运行审计",
    nextStepBackToAudits: "返回审计列表",
    nextStepAnalyzeAnother: "分析另一套房源",
    businessPriority: "业务优先级",
    quickOptimization: "快速优化",
    visibility: "可见性",
    reassurance: "安心感",
    improvement: "改进",
    photoQuality: "照片质量",
    photoOrderQuality: "照片顺序",
    descriptionQualityLabel: "描述质量",
    amenitiesCompletenessLabel: "设施完整度",
    seoPerformance: "SEO 表现",
    scoreOverviewTitle: "你的转化表现详细解读",
    scoreOverviewTextAirbnb: "基于可见信号的解读：当前基础提示你可以进一步强化情绪感、接待感和房源独特性。",
    scoreOverviewTextDefault: "基于可见信号的解读：当前基础有助于优化清晰度、安心感和转化。",
    scoreStatusConfirm: "待确认",
    scoreStatusPartialData: "数据仍不完整",
    scoreStatusExcellent: "优秀",
    scoreStatusExcellentDetail: "明显的竞争优势",
    scoreStatusStrong: "强",
    scoreStatusStrongDetail: "值得保持的积极信号",
    scoreStatusCorrect: "尚可",
    scoreStatusCorrectDetail: "仍可进一步优化",
    scoreStatusNeedsWork: "需要改进",
    scoreStatusNeedsWorkDetail: "对转化有可见影响",
    scoreStatusWeak: "弱",
    scoreStatusWeakDetail: "优先改进",
    subScorePhotosNote: "图片形成了强而令人安心的第一印象，帮助旅客快速理解房源质量并减少预订前犹豫。",
    subScorePhotosFallback: "照片数据不足，无法进一步细化该部分。",
    subScorePhotosImpact: "影响：对点击和信任的作用很强。",
    subScorePhotosPriority: "优先事项：保持这一水平。",
    subScorePhotoOrderNote: "照片顺序很好地突出了最吸引人的元素。前几张图应立即确认舒适感、空间感和房源价值。",
    subScorePhotoOrderFallback: "当信号更完整时，需要再次确认视觉顺序。",
    subScorePhotoOrderImpact: "影响：改善第一印象。",
    subScorePhotoOrderPriority: "优先事项：把最好的空间放在最前面。",
    subScoreDescriptionNote: "文案基础扎实，但仍可更好地销售真实体验：氛围、舒适、具体优势、交通、周边和为什么选择这套房源。",
    subScoreDescriptionFallback: "文本过少或可用性不足，无法在此形成可靠解读。",
    subScoreDescriptionImpact: "影响：增强旅客代入感。",
    subScoreDescriptionPriority: "优先事项：让价值承诺更具体。",
    subScoreAmenitiesNote: "可见设施会增强舒适感知。描述越精确、呈现越清晰，就越能让旅客相信入住品质。",
    subScoreAmenitiesFallback: "设施不够可见或未提供：该解读需要补充。",
    subScoreAmenitiesImpact: "影响：增强对入住舒适度的安心感。",
    subScoreAmenitiesPriority: "优先事项：更好地展示关键设施。",
    subScoreSeoNote: "SEO 基础可用，但仍能更精准。标题、本地关键词和热门设施应帮助平台更好理解该房源。",
    subScoreSeoFallback: "信号过于零散，无法就此部分下结论。",
    subScoreSeoImpact: "影响：帮助平台更好地提升房源排序。",
    subScoreSeoPriority: "优先事项：加强标题和有用关键词。",
    subScoreConversionNote: "转化潜力不错，但仍有可激活杠杆。增益主要来自更清晰的承诺、更强的安心感和更具体的内容。",
    subScoreConversionFallback: "该解读需要更多数据来补强。",
    subScoreConversionImpact: "影响：直接作用于预订决策。",
    subScoreConversionPriority: "优先事项：提升安心感和清晰度。",
    iqaBusinessIndicator: "业务指标",
    iqaPerceivedListingQuality: "感知房源质量",
    iqaReading: "IQA 解读",
    iqaNarrativePremium: "高端解读：感知整体水平在分析市场中表现稳健。",
    iqaNarrativeCompetitive: "竞争基础良好，仍有多个杠杆可继续激活。",
    iqaNarrativeFragile: "与观察到的竞品相比，质量定位仍然脆弱。",
    iqaNarrativeRebuilt: "基于可见信号和审计总分重新构建的解读。",
    scoreSideCardNarrativeLow:
      "/10 解读：水平较弱——请在“整体转化水平”中查看各维度详情。",
    scoreSideCardNarrativeMedium:
      "/10 解读：中等水平——请查看主区块中的子分数。",
    impactSideCardNarrativeOutOfMarket:
      "超出可比市场范围——此房源的业务数据无法被可靠使用。",
    impactSideCardNarrativeMarketPending:
      "你的房源可能存在优化空间，但量化百分比会在市场基础足够稳固后显示出来（至少三套可靠可比房源和一个已整合的市场评分），遵循与欧元估算相同的原则。",
    impactSideCardNarrativeNoRange:
      "报告中没有可用的提升百分比区间。",
    prioritizedActionsIntroAirbnb:
      "生成的建议列表，按从最具差异化到最具结构性的顺序排列。",
    prioritizedActionsIntroDefault:
      "生成的建议列表，按最大化清晰度、信任感和转化率的顺序排列。",
    prioritizedActionsIntroEmpty:
      "本次审计中暂未识别出优先行动。",
    prioritizedActionsSublineAirbnb:
      "一条用来强化情绪、独特性和预订欲望的行动序列。",
    prioritizedActionsSublineDefault:
      "一条用来快速提供有用、令人安心且可执行信息的行动序列。",
    strengthsFallbackAirbnb:
      "暂时还没有识别出结构化优势——可以从叙事、接待体验和你的独特之处来思考。",
    strengthsFallbackDefault:
      "暂时还没有识别出结构化优势——可以从证据、清晰度和信任感来思考。",
    weaknessesFallbackInsightIsolated:
      "按当前方法，无法从「insights」中单独提取出明确的弱点。",
    weaknessesFallbackInsightStructured:
      "报告中没有结构化的「weaknesses」列表：这里不会把「insights」直接复制成正式弱点——请查看优先行动和市场差距。",
    weaknessesFallbackNoStructuredAirbnb:
      "目前报告的结构化字段中没有弱点——这表示解读尚不完整，并不代表没有可改进之处。",
    weaknessesFallbackNoStructuredDefault:
      "目前报告的结构化字段中没有弱点——这表示解读尚不完整，并不代表没有可改进之处。",
    lqiNoteUnavailable:
      "此视图中该维度暂无可用数据。",
    lqiNoteListingNativeHigh:
      "这是报告直接提供的组成项：该维度水平较高，但仍需结合真实房源内容确认。",
    lqiNoteListingNativeModerate:
      "这是报告直接提供的组成项：该维度为中等水平，只是众多信号之一，并非单独结论。",
    lqiNoteListingLocalHigh:
      "基于上方已详细展示的 /10 维度重建出的本地 /100 综合值：属于同一信号体系的浓缩视图。",
    lqiNoteListingLocalFallback:
      "基于审计 /10 子分数生成的本地 /100 综合值：仅供参考，页面其他位置已作进一步展开。",
    lqiNoteMarketNativeHigh:
      "你的房源相较于已分析的附近房源仍保持竞争力。",
    lqiNoteMarketNativeModerate:
      "你的市场定位是合理的，但仍有提升空间。",
    lqiNoteMarketNativeLow:
      "观察到的竞争对手目前似乎定位更好。",
    lqiNoteMarketLocalHigh:
      "本地综合值（市场分数 + 总体 /10）：是浓缩标记，并非独立于市场区块之外。",
    lqiNoteMarketLocalFallback:
      "本地综合值（市场分数 + 总体 /10）：为参考性解读，请结合“市场定位”一起查看。",
    lqiNoteConversionUnavailable:
      "该维度没有 /100 数值：请在其他区块查看转化分数和建议。",
    lqiNoteConversionNativeHigh:
      "该房源的转化潜力已经较强。",
    lqiNoteConversionNativeModerate:
      "仍有多项优化可以进一步提升转化。",
    lqiNoteConversionNativeLow:
      "仍存在一些明显阻力在限制预订潜力。",
    lqiNoteConversionLocalFallback:
      "仅供参考：该值由报告中的其他字段（预订潜力）补全，不是独立的转化衡量。",
    lqiLabelHighSignal: "高信号",
    lqiLabelFavorable: "有利信号",
    lqiLabelImproving: "正在改善",
    lqiLabelNeedsWork: "需要加强",
    lqiSummaryNoObject: "报告中不存在 LQI 对象：/100 数值是基于页面其余 /10 信号构建的本地综合解读，而不是另一组独立测量。",
    lqiSummaryIndicativeScore: "主 /100 分数仅供参考：由于报告中没有原生数值 IQA 指数，因此从总体 /10 分数推导而来。",
    lqiSummaryOverview: "质量 / 市场 / 转化概览：每张卡片下方，“报告组件”= 报告提供的结构化字段；“本地综合”= 页面已有 /10 数值的聚合；“报告补充”= 报告中的其他字段（例如预订潜力），并非独立转化指标。",
    lqiSummaryPending: "一旦可用信号到位，该指标就会显示。",
    lqiSummaryCompetitiveButOptimizable: "该房源具有竞争力，但仍有一些可见杠杆可以进一步提升转化和定位，尤其是让价值主张在首屏更明确。",
    listingConversion: "房源转化",
  },
  ko: {
    loading: "감사 보고서를 불러오는 중...",
    loadingWait: "보고서가 로드되는 동안 잠시만 기다려 주세요.",
    notFound: "이 감사를 찾을 수 없습니다. 숙소 페이지에서 새 분석을 시작하세요.",
    copied: "복사됨",
    copyAction: "복사",
    detectedSourceTitle: "감지된 출처: {value}",
    copyUnavailable: "현재 이 내용을 복사할 수 없습니다.",
    copyMainDescription: "메인 설명 복사",
    copyOptimizedTitle: "최적화된 제목 복사",
    copyHousing: "내 숙소 설명 복사",
    copyDetailedHousing: "상세 숙소 설명 복사",
    copyGuestAccess: "게스트 출입 안내 복사",
    copyGuestInteraction: "게스트 응대 안내 복사",
    copyOtherInfo: "기타 안내 사항 복사",
    copyBookingSummary: "Booking 요약 복사",
    bookingSummaryCopied: "요약이 클립보드에 복사되었습니다.",
    noBookingSummary: "현재 복사할 수 있는 요약이 없습니다.",
    suggestedTextCopied: "제안 텍스트가 클립보드에 복사되었습니다.",
    noDescriptionToCopy: "현재 복사할 수 있는 설명이 없습니다.",
    noTextToCopy: "현재 복사할 수 있는 텍스트가 없습니다.",
    auditUnavailable: "감사를 사용할 수 없습니다",
    auditCompleted: "감사가 성공적으로 완료되었습니다",
    auditCompletedText: "숙소 분석이 완료되었으며 이제 최적화를 시작할 수 있습니다.",
    businessReading: "비즈니스 해석",
    heroTitle: "숙소가 예약을 놓치는 지점과 개선으로 얻을 수 있는 것",
    host: "호스트",
    hostUnavailableAgoda: "Agoda에서는 호스트 정보를 사용할 수 없습니다",
    listingRating: "숙소 평점",
    ratingUnavailable: "평점을 사용할 수 없습니다",
    guestReviews: "개의 게스트 리뷰",
    reviewsUnavailable: "리뷰를 사용할 수 없습니다",
    marketPosition: "시장 포지션",
    businessImpact: "비즈니스 영향",
    monthlyGainBenchmark: "월간 수익 벤치마크",
    propertyProfile: "숙소 프로필",
    propertyType: "숙소 유형",
    notSpecified: "지정되지 않음",
    bedrooms: "침실",
    bathrooms: "욕실",
    guests: "투숙 인원",
    beds: "침대",
    minimumStay: "최소 숙박일(박)",
    marketPositioning: "시장 포지셔닝",
    differentiatingAttributes: "차별화 요소",
    minimumStay1: "1박",
    minimumStay2: "2박",
    minimumStay3: "3박",
    minimumStay5: "5박",
    minimumStay7: "7박",
    minimumStay14: "14박",
    marketTierStandard: "스탠다드",
    marketTierHighEnd: "하이엔드",
    marketTierPremium: "프리미엄",
    marketTierExperientialLuxury: "경험형 럭셔리",
    marketTierUltraLuxury: "울트라 럭셔리",
    attributePrivatePool: "전용 수영장",
    attributeSeaView: "오션뷰",
    attributeBeachfront: "비치프론트",
    attributeJacuzzi: "자쿠지",
    attributeParking: "주차",
    attributeAirConditioning: "에어컨",
    attributeWifi: "와이파이",
    attributeGym: "헬스장",
    attributeTerrace: "테라스",
    attributeConcierge: "컨시어지",
    comparableWeightingHint: "비교 숙소 가중치 참고값이며, 엄격한 필터는 아닙니다.",
    marketRecalculationOnly: "시장 재계산만 수행 — AI 분석과 점수는 변경되지 않습니다.",
    diagnostic: "진단 중…",
    recalibrateMarket: "시장 재보정",
    premiumMarketInsufficient: "프리미엄 시장 샘플 부족",
    marketRecalibrated: "시장을 재보정했습니다",
    premiumMarketText: "사용 가능한 비교 숙소를 분석했지만, 선택한 프리미엄 세그먼트에 충분히 가까운 항목이 없었습니다. 따라서 추정치는 의도적으로 보수적으로 유지됩니다.",
    recalibratedMarketText: "가장 가까운 비교 숙소를 사용해 경쟁 세그먼트를 정교화했습니다.",
    comparablesAnalyzed: "분석된 비교 숙소",
    premiumComparables: "유지된 프리미엄 비교 숙소",
    comparablesKept: "유지된 비교 숙소",
    recalibratedMedian: "재보정 후 중앙값",
    recalibratedAverage: "재보정 후 평균값",
    reliability: "신뢰도",
    conversionLevel: "전환 수준",
    conversionFragile: "전환 기준: 약함",
    conversionModerate: "전환 기준: 보통",
    conversionStrong: "전환 기준: 강함",
    conversionScore: "전환 점수",
    estimatedImpact: "예상 영향",
    ceiling: "상한",
    impactToConfirm: "영향 확인 필요",
    readingWithoutRange: "퍼센트 범위 없는 해석",
    listingAnalysis: "숙소 분석",
    listingBadge: "숙소",
    bookingVariantBadge: "{value} · Booking 변형",
    listingQuality: "숙소 품질",
    listingQualityDescription: "사진, 시각적 순서, 설명, 편의시설, SEO, 전환 가능성에 대한 내부 분석입니다.",
    globalConversionLevel: "전체 전환 수준",
    realMarket: "실제 시장",
    observedMarket: "관측 시장",
    observedMarketDescription: "유지된 비교 숙소, 관측된 경쟁 가격, 시장 신뢰도, 계산된 가격 격차를 기반으로 합니다.",
    listingCompetitivePosition: "내 숙소가 경쟁 숙소와 비교해 어떤지",
    competitiveSummary: "유지된 비교 숙소를 바탕으로 한 경쟁 포지션 요약입니다.",
    outOfMarketSegmentShort: "시장 외 세그먼트",
    percentAfterMarketConsolidation: "시장 데이터가 정리되면 비율이 표시됩니다",
    marketPositioningLabel: "시장 포지셔닝",
    positioning: "포지셔닝",
    listingScore: "숙소 점수",
    market: "시장",
    base: "기반",
    averageCompetitiveQuality: "경쟁 숙소 평균 품질",
    localSegment: "로컬 세그먼트",
    comparedPrices: "비교된 가격",
    consolidatedScore: "통합 점수",
    marketReliability: "시장 신뢰도",
    prioritySummary: "우선순위 요약",
    topThreeLevers: "영향력이 가장 큰 3가지 레버",
    actionable: "실행 가능",
    strengthenDescription: "설명 강화",
    improveSeo: "SEO 개선",
    preserveStrengths: "현재 강점 유지",
    marketPriorityDescriptionOne: "설명 점수: {score}. 우선순위: 약속하는 가치를 더 구체적이고 차별적으로 만들기.",
    marketPriorityDescriptionTwo: "SEO 점수: {score}. 지역 키워드, 핵심 편의시설, 인기 요소를 추가하기.",
    marketPriorityDescriptionThree: "사진: {photoScore} · 편의시설: {amenitiesScore}. 이 신호들은 이미 신뢰 형성에 기여하고 있습니다.",
    marketLabelAbove: "경쟁 수준보다 높음",
    marketLabelBelow: "경쟁 수준보다 낮음",
    marketLabelCompetitive: "경쟁 평균 수준",
    marketPositionToConfirm: "포지션 확인 필요",
    marketBenchmarkAbove: "이 숙소는 현재 관측 평균 점수보다 {value}점 높습니다.",
    marketBenchmarkBelow: "이 숙소는 현재 관측 평균 점수보다 {value}점 낮습니다.",
    marketBenchmarkAligned: "이 숙소는 관측된 비교 숙소의 평균 수준에 있습니다.",
    marketBenchmarkNone: "이 지역 해석에 사용 가능한 비교 숙소가 유지되지 않았습니다.",
    marketBenchmarkOne: "해당 지역의 비교 숙소 1건을 기반으로 한 해석입니다.",
    marketBenchmarkMany: "해당 지역의 비교 숙소 {count}건을 기반으로 한 해석입니다.",
    marketBenchmarkPending: "충분한 수의 비교 숙소가 관측되면 로컬 해석이 제공됩니다.",
    marketScoreContextAbove: "당신의 점수는 현재 시장 평균보다 분명히 높습니다.",
    marketScoreContextBelow: "당신의 점수는 시장에서 관측된 수준보다 아직 낮습니다.",
    marketScoreContextAligned: "당신의 점수는 시장 평균 수준과 거의 일치합니다.",
    marketScoreContextObserved: "관측된 비교 숙소를 기반으로 한 해석입니다.",
    marketScoreContextMarketBelow: "시장 평균은 현재 숙소 수준보다 낮게 유지됩니다.",
    marketScoreContextMarketAbove: "시장 평균은 현재 숙소 수준보다 높게 유지됩니다.",
    marketScoreContextMarketAligned: "당신의 숙소와 시장은 비슷한 수준에 있습니다.",
    marketScoreContextUnavailable: "충분한 관측 숙소가 확보되면 시장 평균 점수가 표시됩니다.",
    marketPositionNarrativeCompetitive: "이 숙소는 전반적으로 인근 경쟁 숙소와 비슷한 수준에 있습니다.",
    marketPositionNarrativeAbove: "이 숙소는 인근 로컬 평균보다 더 높은 수준으로 보입니다.",
    marketPositionNarrativeBelow: "이 숙소는 인근 로컬 평균보다 더 낮은 수준으로 보입니다.",
    marketPositionNarrativeNoComparables: "이 감사에서는 아직 인근 경쟁 숙소가 분석되지 않았습니다.",
    heroMarketPositionSupport: "비교 숙소, 상대 점수, 텍스트 신호 등 상세 근거는 “시장 포지셔닝” 블록에서 확인할 수 있습니다.",
    heroImpactSupportOutOfSegment: "가격 세그먼트 밖의 비교 숙소가 유지되었습니다 — 이 숙소의 비즈니스 추정은 신뢰하기 어렵습니다. 품질과 콘텐츠 레버만 활용 가능합니다.",
    heroImpactSupportDefault: "수치 기준: 상승률은 %, 월 수익은 “예약에 대한 예상 영향”에서 €/월, 오른쪽 열 점수는 /10입니다.",
    heroImpactSupportCompetitive: "이 숙소는 이미 경쟁력이 있습니다. 남은 개선 여지는 주로 가격 포지셔닝과 가치 명확성의 미세 조정에서 나오며, 작지만 실제적인 추가 예약 점유율을 확보하는 단계입니다.",
    heroBusinessLiftHintPrudent: "충분한 시장 가격 기반이 없는 상태에서 현재 가격과 전환 가능성을 기반으로 한 보수적 예측입니다.",
    heroBusinessLiftHintInsufficient: "신뢰할 수 있는 정량적 영향을 추정하기에 시장 데이터가 부족합니다.",
    heroBusinessLiftHintDefault: "관측 시장의 품질과 실제 전환 수준에 따라, 최적화된 숙소는 월 수익을 개선할 수 있습니다.",
    heroRevenueSupportUnavailable: "추정 불가 — 이 집계 해석에 필요한 시장 데이터가 부족합니다.",
    heroRevenueSupportIndicative: "권장 가격, 관측 시장 수준, 현실적인 목표 점유율을 바탕으로 한 참고 추정입니다.",
    heroRevenueSupportPrudent: "보수적 지표: 장기적인 가격 결정을 내리기 전에 예약량과 비교 숙소를 확인하세요.",
    heroRevenueSupportFallback: "게시 가격과 시장 벤치마크(비교 숙소)를 안정화하면 정량 해석을 활성화할 수 있습니다.",
    photoBadgeLow: "사진 {count}장 • 시각 자료를 더 추가하세요",
    photoBadgeMedium: "사진 {count}장 • 무난한 갤러리",
    photoBadgeGood: "사진 {count}장 • 탄탄한 갤러리",
    photoBadgeExcellent: "사진 {count}장 • 매우 높은 점수",
    heroImpactRevenueRange: "+{low} ~ +{high} / 월",
    marketIndicativeLabel: "참고용 해석(제한된 표본 기반)",
    bookingLiftRange: "{low} ~ {high}",
    bookingLiftUpTo: "최대 {value}",
    impactSideCardNarrativeCondensed: "요약 보기입니다. 전체 % 범위는 아래 “{label}” 카드에 표시됩니다.",
    heroScoreNarrativeStrong: "/10 해석: 강한 수준 — 보고서 권장사항으로 더 다듬을 수 있습니다.",
    marketReliabilityBadgeHigh: "높은 신뢰도",
    marketReliabilityBadgeMedium: "보통 신뢰도",
    marketReliabilityBadgeLow: "낮은 신뢰도",
    marketReliabilityBadgeWeakFallback: "약한 폴백",
    marketReliabilityMessageHigh: "일관된 비교 숙소가 여러 건 있어 활용 가능한 시장 기반입니다.",
    marketReliabilityMessageMedium: "참고 가능한 시장 기반이지만, 추가 보강이 필요합니다.",
    marketReliabilityMessageLow: "시장 기반이 제한적입니다. 신중하게 해석하세요.",
    marketReliabilityMessageWeakFallback: "폴백 시장 기반만 있습니다. 특히 신중하게 해석하세요.",
    marketReliabilityTitleUsable: "활용 가능한 시장",
    marketReliabilityTitleLimited: "제한적 판독",
    marketReliabilityTitleLow: "로컬 시장 활용도가 낮음",
    marketReliabilityTitleWeakFallback: "제한된 로컬 기반",
    marketSourceLabelCrossPlatform: "크로스플랫폼 벤치마크",
    marketSourceMessageCrossPlatform:
      "Booking 비교 숙소가 충분하지 않아 비-Booking 비교 숙소를 사용했습니다.",
    marketComparablesBodyStrong: "이 세그먼트 내에서 숙소를 위치시키는 데 사용할 수 있는 경쟁 기반입니다.",
    marketComparablesBodyNone: "이 시장 해석을 위해 유지된 신뢰 가능한 비교 숙소가 없습니다.",
    marketComparablesBodyLimited: "{base} 샘플이 제한적이지만 참고는 가능합니다. 더 보강이 필요합니다.",
    toConfirm: "확인 필요",
    pricingPositioning: "가격 포지셔닝",
    pricingOpportunity: "가격 기회 감지",
    pricingAligned: "가격이 시장과 정렬됨",
    pricingAboveMedian: "가격이 중앙값보다 높음",
    observedMedian: "관측 중앙값",
    recommendedPrice: "권장 가격",
    belowMedian: "중앙값보다 낮음",
    marketAligned: "시장 정렬",
    aboveMedian: "중앙값보다 높음",
    potentialMonthlyGain: "잠재 월간 수익",
    estimatedMonthlyRisk: "예상 월간 리스크",
    estimatedMonthlyImpact: "예상 월간 영향",
    pricingAssumption: "가격 가정: 월 20박",
    pricingInsightUnderpriced:
      "현재 가격은 관측 중앙값보다 {value}% 낮습니다. 권장 가격 쪽으로 점진적으로 올리면 분석된 경쟁 세그먼트에서 급격히 벗어나지 않으면서 수익을 개선할 수 있습니다.",
    pricingInsightOptimal:
      "현재 가격은 관측 중앙값({value}%)에 가깝습니다. 핵심 레버는 큰 폭의 가격 인상이 아니라 전환과 표현 방식 개선입니다.",
    pricingInsightOverpriced:
      "현재 가격은 관측 중앙값보다 {value}% 높습니다. 품질 신호가 이 차이를 명확히 정당화하지 못하면 가격이 마찰 요인이 될 수 있습니다.",
    pricingIndicativeCaution:
      "{value} — 로컬 기반이 아직 제한적이므로 가격 포지션은 신중하게 해석하세요.",
    insufficientComparablePricing: "데이터 부족: 중앙값이나 가격 영향을 추정할 신뢰 가능한 비교 숙소가 없습니다.",
    insufficientPricingData: "신뢰할 수 있는 가격 영향을 추정하기에 시장 데이터가 부족합니다.",
    pricingBenchmarks: "가격 벤치마크",
    pricingBenchmarksTitle: "내 가격이 경쟁 숙소와 어떻게 비교되는지",
    pricingBenchmarksDescription: "관측 평균 가격과 비교 시장 간의 추정 격차를 기반으로 한 가격 벤치마크입니다.",
    reportFrictionSignalsTitle: "보고서에서 감지된 마찰 신호",
    reportFrictionSignalsSubtitle:
      "보충 정보 전용: 주요 ‘약점’ 및 ‘시장 대비 주요 격차’ 목록 밖의 발췌입니다. 참고용이며, 잃은 예약 수와 직접 연결되지는 않습니다.",
    mainMarketGapsTitle: "시장 대비 주요 격차",
    mainMarketGapsEmpty:
      "현재 보고서에 시장 격차가 나열되어 있지 않습니다. 이는 해당 축의 데이터가 누락되었거나 구조화되지 않았다는 뜻일 수 있으며, 실제 격차가 없다는 의미는 아닙니다.",
    mainMarketAdvantagesTitle: "시장 대비 주요 강점",
    mainMarketAdvantagesEmpty:
      "현재 뚜렷한 강점은 식별되지 않았습니다.",
    missingAmenitiesChecklistTitle: "누락된 편의시설 체크리스트",
    avgCompetitorPriceSupportInsufficient: "신뢰 가능한 가격 기준을 만들기에 시장 샘플이 부족합니다.",
    avgCompetitorPriceSupportLimited: "참고용 기준입니다. 로컬 기반이 아직 제한적이며 더 많은 비교 숙소로 보강해야 합니다.",
    avgCompetitorPriceSupportObserved: "이 세그먼트에서 유지된 숙소를 기반으로 한 관측 경쟁 벤치마크입니다.",
    avgCompetitorPriceSupportPending: "신뢰 가능한 경쟁 가격이 정리되면 이 가격 기준이 더 유용해집니다.",
    averageCompetitorPrice: "경쟁 숙소 평균 가격",
    priceGapVsMarket: "시장 대비 가격 차이",
    priceDeltaInsufficientSample: "샘플 부족",
    marketCompetitorPricesDispersed: "경쟁 숙소 가격이 분산되어 있습니다",
    priceDeltaUnavailable: "여기서는 가격 차이를 계산할 수 없습니다. 게시 가격 또는 시장 기준이 신뢰 가능한 비율 산출에 충분하지 않습니다.",
    priceDeltaPending: "게시 가격과 신뢰 가능한 시장 기준이 안정화되면 여기에서 퍼센트 차이를 표시합니다.",
    notReliable: "신뢰 불가",
    marketAnalysisPending: "충분한 시장 샘플이 확보될 때까지 분석이 보류됩니다.",
    businessProjection: "비즈니스 예측",
    marketPricePositionWellAbove:
      "현재 가격은 관측 시장보다 크게 높습니다. 매우 강한 품질 신호로 정당화되어야 합니다.",
    marketPricePositionSlightlyAbove:
      "현재 가격은 시장보다 약간 높습니다. 약속하는 가치가 분명하다면 프리미엄 포지션이 가능합니다.",
    marketPricePositionBelow:
      "현재 가격은 관측 시장보다 낮습니다. 요금 최적화 여지가 있어 보입니다.",
    marketPricePositionSlightlyBelow:
      "현재 가격은 시장보다 약간 낮으며, 매력적인 포지션과 완만한 상승 여지가 있습니다.",
    marketPricePositionAligned:
      "현재 가격은 이 시장에서 관측된 평균 수준과 정렬되어 있습니다.",
    marketPricePositionPending:
      "신뢰 가능한 경쟁 평균 가격이 확보되면 가격 포지션이 더 명확해집니다.",
    priceDeltaIndicativeSample:
      "제한된 로컬 샘플을 기반으로 한 참고 차이입니다.",
    marketAverageRatingObserved:
      "관측된 경쟁 숙소 평균 평점: {value}/{scale}.",
    marketAverageRatingUnavailable:
      "경쟁 숙소 평균 평점은 아직 활용할 수 없습니다.",
    competitorCountSupportAvailable:
      "경쟁 포지션을 평가하기 위해 비교 숙소가 유지되었습니다.",
    competitorCountSupportNone:
      "이번 해석에 유지된 비교 숙소가 없어 현재 포지션은 참고 수준에 머뭅니다.",
    competitorCountSupportPending:
      "정확한 비교 숙소 수가 확보될 때까지 이 포지션은 보강이 필요한 참고 값입니다.",
    competitorCountSupportPartial:
      "비교 숙소 수가 충분히 정리될 때까지 시장 해석은 부분적입니다.",
    comparablesKpiLimited: "제한적 해석",
    comparablesKpiNone: "신뢰 가능한 비교 숙소 없음",
    comparablesKpiOne: "제한적 해석 — 활용 가능한 비교 숙소 1개",
    comparablesKpiTwo: "제한적 해석 — 활용 가능한 비교 숙소 2개",
    lqiPartialIndex: "부분 지수",
    lqiToConsolidate: "보강 필요",
    insufficientData: "데이터 부족",
    revenueImpactRangeDisplay:
      "현재 추정: 월 {current} · 최적화 후: 월 {low} ~ {high}",
    monthlyGainQualifierLimited:
      "{value} — 기준을 안정화하려면 더 많은 비교 숙소와 함께 해석해야 합니다.",
    monthlyGainQualifierFragile:
      "확인이 필요한 참고 가정입니다(가격 및/또는 비교 숙소가 아직 명확한 시장 기준을 만들 만큼 충분히 신뢰되지 않습니다).",
    projectionsPotential: "예측 및 잠재력",
    projectionsDescription: "시장 신호, 경쟁 포지션, 관측된 전환 잠재력을 바탕으로 한 참고 추정입니다.",
    nightlyPrice: "1박 가격",
    premiumPosition: "프리미엄 포지션",
    aggressivePosition: "공격적 포지션",
    balancedPosition: "균형 포지션",
    qualitativeAnalysisOnly: "정성 분석만",
    businessPotentialAfterOptimization: "최적화 후 비즈니스 잠재력",
    estimatedBookingsAfterOptimization: "최적화 후 예상 예약 수",
    projectionBase: "예측 기반",
    crossPlatformReading: "크로스 플랫폼 해석",
    readableMarket: "해석 가능한 시장",
    cautiousReading: "신중한 해석",
    lowVisibility: "낮은 가시성",
    conversionGainPotential: "잠재 전환 증가",
    actionableProjection: "실행 가능한 예측",
    limitedProjection: "제한적 예측",
    cautiousProjection: "신중한 예측",
    indicativeProjection: "참고 예측",
    estimatedMonthlyGainTitle: "예상 월간 수익",
    estimatedImpactOnBookings: "예약에 대한 예상 영향",
    impactBusinessBlockIntroOutOfSegment: "가격 세그먼트 밖의 비교 숙소가 유지되었습니다 — 품질, 콘텐츠, 시각적 전환 관련 권장사항만 신뢰 있게 해석할 수 있습니다.",
    impactBusinessBlockIntroDefault: "아래 각 카드는 고정 단위를 사용합니다. 가격은 €, 상대 시장 점수는 /10, 예약 상승은 %, 예상 월간 수익은 €/월(총매출이 아닌 추가 수익)입니다.",
    currentPriceContextCompareMarket: "예상 시장 평균 가격 {value}와 비교하세요.",
    currentPriceContextDetected: "현재 가격이 숙소에서 감지되었습니다.",
    currentPriceContextMarketReference: "현재 가격을 사용할 수 없습니다. 관측 시장 기준: 약 {value}/박.",
    currentPriceContextMissing: "이 숙소에는 현재 가격 정보가 없습니다.",
    currentPriceUnavailable: "현재 가격을 사용할 수 없습니다",
    projectionBaseNoComparable: "활용 가능한 경쟁 평균을 만들 만큼 일관된 비교 숙소가 없습니다.",
    projectionBaseRobust: "비교 숙소 {count}건을 바탕으로 구축한 견고한 경쟁 기반입니다.",
    projectionBasePartial: "사용 가능한 비교 숙소 {count}건을 기반으로 한 부분 벤치마크입니다.",
    projectionBaseUnstable: "감지된 시장이 아직 너무 불안정하여 신뢰 가능한 경쟁 벤치마크를 제공할 수 없습니다.",
    potentialToConfirm: "잠재력 확인 필요",
    conversionGainLowConfidence: "시장 신뢰도가 아직 부족하여 설득력 있는 전환 증가를 예측하기 어렵습니다.",
    conversionGainFromScoreAndPrice: "신뢰 가능한 경쟁 가격 기준 없이, 전환 점수와 현재 가격을 바탕으로 한 예측입니다.",
    conversionGainOutOfSegment: "세그먼트 외 비교 숙소가 감지되었습니다 — 이 숙소의 예약 잠재력은 신뢰 있게 추정할 수 없습니다.",
    conversionGainPendingRange: "시장 기반(비교 숙소와 통합 점수)이 충분히 신뢰 가능해지면 예상 월간 수익과 마찬가지로 % 범위가 표시됩니다.",
    conversionGainEstimated: "현재 포지션과 분석된 경쟁 숙소를 바탕으로 한 추정입니다.",
    conversionGainNoRange: "현재 보고서 데이터에는 예약 상승에 대한 퍼센트 범위가 없습니다.",
    monthlyGainOutOfSegment: "세그먼트 외 비교 숙소 — 이 시장에는 수익 예측을 적용할 수 없습니다.",
    monthlyGainUnavailable: "추정 불가 — 시장 데이터가 부족합니다. 활용 가능한 정량 범위를 위해서는 신뢰 가능한 게시 가격과 안정화된 경쟁 기준이 필요합니다.",
    monthlyGainNeedsStableMarket: "정량적 추정에는 일관된 게시 가격과 안정화된 관측 시장 수준이 필요합니다.",
    optimizedTexts: "최적화된 숙소 문구",
    optimizedTextVariantLabel: "버전 {index} - {label}",
    optimizedTextIntro: "숙소 내용과 보고서 신호를 바탕으로 로컬 텍스트 모델로 조합한 제안입니다(이 화면에서는 원격 모델 호출 없음). 브랜드 톤에 맞게 조정하세요.",
    optimizedTextVariantCounter: "버전 {index} / {total}",
    optimizedTextVariantNameComfort: "편안함과 휴식",
    optimizedTextVariantNamePractical: "실용성과 매끄러움",
    optimizedTextVariantNameNeighborhood: "동네와 위치",
    optimizedTextVariantNamePremium: "프리미엄과 신뢰",
    optimizedTextVariantNameBusiness: "단기 숙박 / 비즈니스",
    variant: "버전",
    changeVariant: "버전 변경",
    descriptionCopied: "설명이 복사되었습니다",
    newVariantReady: "새 변형이 준비되었습니다.",
    currentTitle: "현재 제목",
    optimizedTitleExample: "최적화된 제목 예시",
    aiGeneratingTitle: "AI 제목 생성 중…",
    missingListingTitle: "이 숙소에는 사용할 수 있는 제목이 없습니다.",
    aiDescriptionPlaceholder: "숙소와 감사 데이터가 준비되는 즉시 제안 문구가 여기에 표시됩니다.",
    aiGeneratingDescription: "AI 생성이 진행 중입니다…",
    aiProvenanceAi: "AI",
    aiProvenanceFallbackLocal: "로컬 폴백",
    aiDescriptionFailed: "이 언어에 대한 AI 생성에 실패했습니다. 나중에 다시 시도해 주세요.",
    aiDescriptionUnavailable: "이 언어에 대한 Airbnb AI 설명은 아직 제공되지 않습니다.",
    aiFallbackHousing: "머무는 모든 순간을 더 편안하고 단순하게 만들어 주는 아늑하고 실용적인 공간에서 쉬어가세요.",
    aiFallbackDetailedHousing: "이 숙소는 분명한 공간 구성, 유용한 편의시설, 머무르기 좋은 분위기를 갖춘 완성도 높은 경험을 제공합니다.",
    aiFallbackGuestAccess: "게스트는 숙소, 체류를 위해 준비된 공간, 일상에 유용한 편의시설에 쉽게 접근할 수 있습니다.",
    aiFallbackGuestInteraction: "체류 전과 체류 중에도 유용한 안내를 드리고 실용적인 질문에 간단히 답변할 수 있도록 계속 응대하겠습니다.",
    aiFallbackOtherInfo: "실용적인 정보는 도착을 더 쉽게 만들고, 숙박 운영을 명확히 하며, 게스트가 안심하고 숙소를 즐길 수 있도록 돕습니다.",
    myPlace: "내 숙소",
    detailedPlace: "숙소 — 상세 버전",
    guestAccess: "게스트 출입 안내",
    guestInteraction: "게스트 응대",
    otherInfo: "기타 안내 사항",
    bookingDescriptionSummary: "설명 요약 (Booking)",
    bookingSummaryFallback:
      "설명에 포함할 내용: 공간의 편안함, 숙소 접근 방식, 게스트 응대 가능 여부, 도착 시 유용한 실용 정보.",
    bookingSummaryReady: "현재 표시된 버전에 맞춰 바로 붙여넣을 수 있습니다.",
    actionPlan: "액션 플랜",
    actionPlanSubtitle: "지금 바로 시작해야 할 프로젝트를 비즈니스 영향 순으로 정렬했습니다.",
    fallbackNarrativeFromWeaknesses:
      "보고서의 약점을 바탕으로 한 서술형 폴백입니다. 참고용 해석이며 엄격한 시장 벤치마크는 아닙니다.",
    fallbackNarrativeFromStrengths:
      "보고서의 강점을 바탕으로 한 서술형 폴백입니다. 참고용 해석이며 엄격한 시장 벤치마크는 아닙니다.",
    actionPlanIntroAttractiveness: "이 화면은 숙소의 매력, 환대감, 표현 방식을 강화할 수 있는 레버를 우선순위별로 묶어 보여줍니다.",
    actionPlanIntroConversion: "이 화면은 제안을 더 명확하게 하고, 여행자를 안심시키며, 결정을 빠르게 만드는 개선 사항을 우선순위별로 묶어 보여줍니다.",
    actionPlanIntroStorytelling: "여기에는 스토리텔링, 차별화, 숙박 욕구를 강화할 액션이 구조화되어 표시됩니다.",
    actionPlanIntroDefault: "상세 개선 계획이 준비되면 여기에 액션이 구조화되어 표시됩니다.",
    actionSignalLabel: "신호",
    actionImpactHigh: "영향 높음",
    actionImpactMedium: "영향 보통",
    actionImpactLow: "영향 낮음",
    actionScoreLabel: "영향 받는 점수",
    actionObjectiveLabel: "목표",
    actionSignalFallback: "신호 확인 필요.",
    actionObjectiveFallback: "감지된 비즈니스 영향에 따라 우선순위를 정하세요.",
    actionEmptyState: "현재 우선 실행할 액션이 없습니다.",
    actionImprovementFallback: "개선 항목 {index}",
    actionScoreLineWithValue: "{label}: {value}/10.",
    actionScoreLinePending: "{label}: 확인 필요.",
    actionLabelDescription: "설명",
    actionLabelSeo: "SEO",
    actionLabelPhotos: "사진",
    actionLabelAmenities: "편의시설",
    actionLabelConversion: "전환",
    actionLabelPricing: "가격",
    actionNarrativeDescription: "텍스트는 숙소 정보를 여행자에게 구체적인 가치로 더 잘 전환해야 합니다. 편안함, 경험, 위치, 예약해야 하는 이유가 드러나야 합니다.",
    actionReasonDescription: "설명 점수 + 여행자 상상 품질.",
    actionNarrativeSeo: "제목과 첫 문장은 위치, 인기 편의시설, 차별화 강점 등 유용한 키워드를 더 잘 통합해야 합니다.",
    actionReasonSeo: "SEO 점수 + 플랫폼 가시성.",
    actionNarrativePhotos: "비주얼은 첫 몇 초 안에 신뢰를 계속 줘야 합니다. 가장 좋은 공간, 채광, 편안함, 체감 가치를 먼저 보여주세요.",
    actionReasonPhotos: "사진 점수 + 갤러리 순서.",
    actionNarrativeAmenities: "핵심 편의시설은 예약 전의 의구심을 줄이고 편안함 인식을 높이기 위해 더 잘 드러나야 합니다.",
    actionReasonAmenities: "편의시설 점수 + 숙박 안심감.",
    actionNarrativeConversion: "우선순위는 망설임을 줄이는 것입니다. 명확한 약속, 보이는 증거, 구체적 정보, 제목·사진·설명의 일관성이 필요합니다.",
    actionReasonConversion: "전환 점수 + 의사결정 마찰.",
    actionReasonPricing: "가격 포지셔닝 + 비교 시장 검증.",
    actionReasonMarketComparables: "시장 해석에 비교 숙소 {count}건을 사용했습니다.",
    actionNarrativeFallback: "보고서 기반 액션입니다. 비즈니스 영향과 사용 가능한 신호에 따라 우선순위를 정하세요.",
    actionNormalizedTitleClarify: "예약을 유도하는 정보를 명확히 하기",
    actionNormalizedTitleConcreteValue: "가치를 더 구체적으로 만들기",
    actionNormalizedTitleAnalyzePricingGap: "측정된 가격 격차 분석",
    actionNormalizedTitleBuildTrust: "예약 전 신뢰 강화",
    actionNormalizedDescriptionPricingCompare: "할 일: 조정 전에 유형, 위치, 서비스 수준이 실제로 유사한 숙소와만 가격을 비교하세요.",
    auditLeversDetailTitle: "숙소 레버 상세",
    auditStrengthsTitle: "강점",
    auditStrengthsSource: "출처: 감사 하위 점수에서 측정된 강한 신호.",
    auditStrengthsEmpty: "사용 가능한 하위 점수에서 8/10 이상인 측정 가능한 강한 신호가 감지되지 않았습니다.",
    auditWeaknessesTitle: "약점",
    auditWeaknessesSource: "출처: 감사 하위 점수에서 측정된 약한 신호.",
    auditWeaknessesEmpty: "사용 가능한 하위 점수에서 7/10 미만의 측정 가능한 약한 신호가 감지되지 않았습니다.",
    auditStrengthPhotos: "강한 사진: {score}/10.",
    auditStrengthPhotoOrder: "강한 사진 순서: {score}/10.",
    auditStrengthDescription: "강한 설명: {score}/10.",
    auditStrengthAmenities: "편의시설이 잘 갖춰짐: {score}/10.",
    auditStrengthSeo: "강한 SEO: {score}/10.",
    auditStrengthConversion: "강한 전환: {score}/10.",
    auditWeakDescription: "설명 개선 필요: {score}/10.",
    auditWeakSeo: "SEO 강화 필요: {score}/10.",
    auditWeakConversion: "전환 강화 필요: {score}/10.",
    auditWeakAmenities: "편의시설 보완 필요: {score}/10.",
    auditWeakPhotoQuality: "사진 품질 개선 필요: {score}/10.",
    auditWeakPhotoOrder: "사진 순서 재검토 필요: {score}/10.",
    nextStepTitle: "추천 다음 단계",
    nextStepDescription: "먼저 가장 수익성이 높은 레버를 수정한 뒤 감사를 다시 실행해 개선 효과를 측정하세요.",
    nextStepRunAudit: "감사 다시 실행",
    nextStepBackToAudits: "감사 목록으로 돌아가기",
    nextStepAnalyzeAnother: "다른 숙소 분석",
    businessPriority: "비즈니스 우선순위",
    quickOptimization: "빠른 최적화",
    visibility: "가시성",
    reassurance: "안심감",
    improvement: "개선",
    photoQuality: "사진 품질",
    photoOrderQuality: "사진 순서",
    descriptionQualityLabel: "설명 품질",
    amenitiesCompletenessLabel: "편의시설 완성도",
    seoPerformance: "SEO 성과",
    scoreOverviewTitle: "전환 성과에 대한 상세 해석",
    scoreOverviewTextAirbnb: "보이는 신호를 기반으로 한 해석입니다. 현재 기반은 감성, 환대감, 숙소의 고유성을 더 강화할 여지를 보여줍니다.",
    scoreOverviewTextDefault: "보이는 신호를 기반으로 한 해석입니다. 현재 기반은 명확성, 안심감, 전환을 최적화하는 데 도움이 됩니다.",
    scoreStatusConfirm: "확인 필요",
    scoreStatusPartialData: "데이터가 아직 부분적입니다",
    scoreStatusExcellent: "탁월함",
    scoreStatusExcellentDetail: "명확한 경쟁 우위",
    scoreStatusStrong: "강함",
    scoreStatusStrongDetail: "유지해야 할 긍정 신호",
    scoreStatusCorrect: "양호",
    scoreStatusCorrectDetail: "추가 최적화 가능",
    scoreStatusNeedsWork: "개선 필요",
    scoreStatusNeedsWorkDetail: "전환에 눈에 띄는 영향",
    scoreStatusWeak: "약함",
    scoreStatusWeakDetail: "개선 우선",
    subScorePhotosNote: "비주얼은 강하고 안심되는 첫인상을 만듭니다. 여행자가 숙소 품질을 빠르게 이해하게 하고 예약 전 망설임을 줄여줍니다.",
    subScorePhotosFallback: "이 영역을 더 세밀하게 해석하기에는 사진 데이터가 부족합니다.",
    subScorePhotosImpact: "영향: 클릭과 신뢰에 강하게 작용합니다.",
    subScorePhotosPriority: "우선순위: 이 수준을 유지하기.",
    subScorePhotoOrderNote: "사진 순서는 가장 매력적인 요소를 잘 드러냅니다. 첫 이미지들은 편안함, 공간감, 체감 가치를 즉시 전달해야 합니다.",
    subScorePhotoOrderFallback: "신호가 더 완전해지면 시각 순서를 확인해야 합니다.",
    subScorePhotoOrderImpact: "영향: 첫인상을 개선합니다.",
    subScorePhotoOrderPriority: "우선순위: 가장 좋은 공간을 먼저 보여주기.",
    subScoreDescriptionNote: "텍스트는 탄탄하지만 실제 경험을 더 잘 팔 수 있습니다. 분위기, 편안함, 구체적 장점, 접근성, 동네, 그리고 이 숙소를 선택할 이유를 더 드러내야 합니다.",
    subScoreDescriptionFallback: "여기서 신뢰할 만한 해석을 하기에는 텍스트가 너무 제한적이거나 활용도가 낮습니다.",
    subScoreDescriptionImpact: "영향: 여행자의 상상과 투영을 강화합니다.",
    subScoreDescriptionPriority: "우선순위: 약속하는 가치를 더 구체적으로 만들기.",
    subScoreAmenitiesNote: "눈에 띄는 편의시설은 편안함 인식을 강화합니다. 더 정확하고 잘 제시될수록 숙박 품질에 대한 안심감을 높입니다.",
    subScoreAmenitiesFallback: "편의시설이 충분히 보이지 않거나 제공되지 않았습니다. 해석 보완이 필요합니다.",
    subScoreAmenitiesImpact: "영향: 숙박의 편안함에 대한 안심감을 줍니다.",
    subScoreAmenitiesPriority: "우선순위: 핵심 편의시설을 더 잘 보여주기.",
    subScoreSeoNote: "SEO는 활용 가능하지만 더 정교해질 수 있습니다. 제목, 로컬 키워드, 인기 편의시설이 플랫폼이 숙소를 더 잘 이해하도록 도와야 합니다.",
    subScoreSeoFallback: "이 영역에 대해 결론을 내리기에는 신호가 너무 부분적입니다.",
    subScoreSeoImpact: "영향: 플랫폼이 숙소를 더 잘 노출하도록 돕습니다.",
    subScoreSeoPriority: "우선순위: 제목과 유용한 키워드를 강화하기.",
    subScoreConversionNote: "전환 잠재력은 좋지만, 아직 활성화할 레버가 남아 있습니다. 이득은 더 명확한 약속, 더 큰 안심감, 더 구체적인 콘텐츠에서 나옵니다.",
    subScoreConversionFallback: "추가 데이터로 해석을 보강해야 합니다.",
    subScoreConversionImpact: "영향: 예약 결정에 직접 작용합니다.",
    subScoreConversionPriority: "우선순위: 안심감과 명확성 개선.",
    iqaBusinessIndicator: "비즈니스 지표",
    iqaPerceivedListingQuality: "인지된 숙소 품질",
    iqaReading: "IQA 해석",
    iqaNarrativePremium: "프리미엄 해석: 인지된 전체 수준이 분석된 시장 대비 견고합니다.",
    iqaNarrativeCompetitive: "경쟁 기반은 건전하며, 아직 활성화할 수 있는 레버가 여러 개 남아 있습니다.",
    iqaNarrativeFragile: "품질 포지셔닝은 관측된 경쟁 숙소 대비 여전히 취약합니다.",
    iqaNarrativeRebuilt: "보이는 신호와 감사의 전체 점수를 바탕으로 재구성한 해석입니다.",
    scoreSideCardNarrativeLow:
      "/10 해석: 취약한 수준 — “전체 전환 수준”에서 항목별 세부 점수를 확인하세요.",
    scoreSideCardNarrativeMedium:
      "/10 해석: 보통 수준 — 메인 블록의 하위 점수를 확인하세요.",
    impactSideCardNarrativeOutOfMarket:
      "시장 범위 밖 세그먼트입니다 — 이 숙소에는 비즈니스 데이터를 신뢰성 있게 활용할 수 없습니다.",
    impactSideCardNarrativeMarketPending:
      "이 숙소에는 최적화 잠재력이 있을 수 있지만, 정량화된 비율은 시장 기반이 충분히 견고해졌을 때(신뢰할 수 있는 비교 숙소 최소 3개와 통합된 시장 점수) 유로 추정과 같은 원칙으로 표시됩니다.",
    impactSideCardNarrativeNoRange:
      "보고서에 활용 가능한 상승 % 범위가 없습니다.",
    prioritizedActionsIntroAirbnb:
      "생성된 권장사항 목록으로, 가장 차별화되는 요소에서 가장 구조적인 요소로 이어지도록 정렬되어 있습니다.",
    prioritizedActionsIntroDefault:
      "생성된 권장사항 목록으로, 명확성·안심감·전환을 최대화하도록 정렬되어 있습니다.",
    prioritizedActionsIntroEmpty:
      "이 감사에서는 아직 우선순위 액션이 도출되지 않았습니다.",
    prioritizedActionsSublineAirbnb:
      "감정, 고유성, 예약 욕구를 강화하기 위한 흐름입니다.",
    prioritizedActionsSublineDefault:
      "유용하고 안심되는 실행 정보를 빠르게 전달하기 위한 흐름입니다.",
    strengthsFallbackAirbnb:
      "아직 구조화된 강점이 도출되지 않았습니다 — 스토리텔링, 환대, 그리고 차별점을 떠올려 보세요.",
    strengthsFallbackDefault:
      "아직 구조화된 강점이 도출되지 않았습니다 — 근거, 명확성, 안심 요소를 떠올려 보세요.",
    weaknessesFallbackInsightIsolated:
      "현재 방법으로는 ‘insights’에서 분명한 약점을 따로 분리해낼 수 없었습니다.",
    weaknessesFallbackInsightStructured:
      "보고서에 구조화된 ‘weaknesses’ 목록이 없습니다. ‘insights’를 여기서 공식 약점으로 그대로 복제하지는 않습니다 — 우선 액션과 시장 격차를 확인하세요.",
    weaknessesFallbackNoStructuredAirbnb:
      "현재 보고서의 구조화 필드에는 약점이 없습니다 — 이는 해석이 아직 불완전하다는 뜻이지, 개선할 점이 없다는 의미는 아닙니다.",
    weaknessesFallbackNoStructuredDefault:
      "현재 보고서의 구조화 필드에는 약점이 없습니다 — 이는 해석이 아직 불완전하다는 뜻이지, 개선할 점이 없다는 의미는 아닙니다.",
    lqiNoteUnavailable:
      "이 보기에서는 이 축에 대한 데이터를 사용할 수 없습니다.",
    lqiNoteListingNativeHigh:
      "보고서가 직접 제공한 구성 요소입니다: 이 축은 높은 수준이지만 실제 숙소 콘텐츠와 대조해 확인해야 합니다.",
    lqiNoteListingNativeModerate:
      "보고서가 직접 제공한 구성 요소입니다: 보통 수준이며, 여러 신호 중 하나일 뿐 단독 판정은 아닙니다.",
    lqiNoteListingLocalHigh:
      "위에서 이미 자세히 설명한 /10 차원을 바탕으로 재구성한 로컬 /100 요약입니다. 같은 신호군의 압축 보기입니다.",
    lqiNoteListingLocalFallback:
      "감사의 /10 하위 점수에서 만든 로컬 /100 요약입니다. 참고용이며 페이지 다른 곳에서 이미 더 살펴본 내용입니다.",
    lqiNoteMarketNativeHigh:
      "이 숙소는 분석된 인근 숙소들에 비해 여전히 경쟁력이 있습니다.",
    lqiNoteMarketNativeModerate:
      "시장 포지셔닝은 적절하지만 아직 개선 여지가 있습니다.",
    lqiNoteMarketNativeLow:
      "관찰된 경쟁 숙소들이 현재 더 잘 포지셔닝된 것으로 보입니다.",
    lqiNoteMarketLocalHigh:
      "로컬 요약(시장 점수 + 전체 /10)입니다. 시장 블록과 독립적이지 않은 압축 지표입니다.",
    lqiNoteMarketLocalFallback:
      "로컬 요약(시장 점수 + 전체 /10)입니다. 참고용 해석으로, “시장 포지셔닝”과 함께 확인하세요.",
    lqiNoteConversionUnavailable:
      "이 차원에는 /100 값이 없습니다. 다른 섹션의 전환 점수와 권장사항을 확인하세요.",
    lqiNoteConversionNativeHigh:
      "이 숙소의 전환 잠재력은 이미 강한 편입니다.",
    lqiNoteConversionNativeModerate:
      "여전히 여러 최적화가 전환을 더 개선할 수 있습니다.",
    lqiNoteConversionNativeLow:
      "눈에 보이는 마찰 요소들이 여전히 예약 잠재력을 제한하고 있습니다.",
    lqiNoteConversionLocalFallback:
      "참고용입니다. 보고서의 다른 필드(예약 잠재력)에서 보완된 값으로, 독립적인 전환 측정치는 아닙니다.",
    lqiLabelHighSignal: "높은 신호",
    lqiLabelFavorable: "우호적 신호",
    lqiLabelImproving: "개선 중",
    lqiLabelNeedsWork: "강화 필요",
    lqiSummaryNoObject: "보고서에는 LQI 객체가 없습니다. /100 값은 페이지의 다른 /10 신호를 기반으로 만든 로컬 종합값이며, 별도의 독립 측정 세트가 아닙니다.",
    lqiSummaryIndicativeScore: "주요 /100 점수는 참고값입니다. 보고서에 네이티브 숫자 IQA 지수가 없기 때문에 전체 /10 점수에서 파생했습니다.",
    lqiSummaryOverview: "품질 / 시장 / 전환 개요: 각 카드 아래에서 “보고서 구성요소” = 제공된 구조화 필드, “로컬 종합” = 페이지에 이미 있는 /10 값의 집계, “보고서 보완” = 보고서의 다른 필드(예: 예약 잠재력)이며 독립 전환 측정값은 아닙니다.",
    lqiSummaryPending: "유용한 신호가 준비되면 이 지표가 표시됩니다.",
    lqiSummaryCompetitiveButOptimizable: "이 숙소는 경쟁력이 있지만, 특히 첫 화면에서 가치 제안을 더 명확히 보여줌으로써 전환과 포지셔닝을 더 개선할 수 있는 가시적 레버가 남아 있습니다.",
    listingConversion: "숙소 전환",
  },
  ar: {
    loading: "جارٍ تحميل تقرير التدقيق...",
    loadingWait: "يرجى الانتظار بينما يتم تحميل التقرير.",
    notFound: "تعذر العثور على هذا التدقيق. ابدأ تحليلاً جديدًا من صفحة الإعلانات.",
    copied: "تم النسخ",
    copyAction: "نسخ",
    detectedSourceTitle: "المصدر المكتشف: {value}",
    copyUnavailable: "يتعذر نسخ هذا المحتوى الآن.",
    copyMainDescription: "نسخ الوصف الرئيسي",
    copyOptimizedTitle: "نسخ العنوان المحسّن",
    copyHousing: "نسخ قسم «مسكني»",
    copyDetailedHousing: "نسخ النسخة التفصيلية للمسكن",
    copyGuestAccess: "نسخ معلومات وصول الضيوف",
    copyGuestInteraction: "نسخ معلومات التفاعل مع الضيوف",
    copyOtherInfo: "نسخ المعلومات الأخرى المهمة",
    copyBookingSummary: "نسخ ملخص Booking",
    bookingSummaryCopied: "تم نسخ الملخص إلى الحافظة.",
    noBookingSummary: "لا يوجد ملخص متاح للنسخ حاليًا.",
    suggestedTextCopied: "تم نسخ النص المقترح إلى الحافظة.",
    noDescriptionToCopy: "لا يوجد وصف متاح للنسخ حاليًا.",
    noTextToCopy: "لا يوجد نص متاح للنسخ حاليًا.",
    auditUnavailable: "التدقيق غير متاح",
    auditCompleted: "اكتمل التدقيق بنجاح",
    auditCompletedText: "تم تحليل إعلانك ويمكن الآن البدء في تحسينه.",
    businessReading: "قراءة الأعمال",
    heroTitle: "أين يخسر إعلانك الحجوزات وما الذي يمكنك كسبه",
    host: "المضيف",
    hostUnavailableAgoda: "المضيف غير متاح على Agoda",
    listingRating: "تقييم الإعلان",
    ratingUnavailable: "التقييم غير متاح",
    guestReviews: "مراجعة من الضيوف",
    reviewsUnavailable: "المراجعات غير متاحة",
    marketPosition: "الموقع في السوق",
    businessImpact: "الأثر التجاري",
    monthlyGainBenchmark: "مرجع الربح الشهري",
    propertyProfile: "ملف العقار",
    propertyType: "نوع الإقامة",
    notSpecified: "غير محدد",
    bedrooms: "غرف النوم",
    bathrooms: "الحمّامات",
    guests: "الضيوف",
    beds: "الأسرة",
    minimumStay: "الحد الأدنى للإقامة (ليالٍ)",
    marketPositioning: "التموضع في السوق",
    differentiatingAttributes: "عناصر التميّز",
    minimumStay1: "ليلة واحدة",
    minimumStay2: "ليلتان",
    minimumStay3: "3 ليالٍ",
    minimumStay5: "5 ليالٍ",
    minimumStay7: "7 ليالٍ",
    minimumStay14: "14 ليلة",
    marketTierStandard: "قياسي",
    marketTierHighEnd: "راقٍ",
    marketTierPremium: "مميز",
    marketTierExperientialLuxury: "فخامة تجريبية",
    marketTierUltraLuxury: "فخامة فائقة",
    attributePrivatePool: "مسبح خاص",
    attributeSeaView: "إطلالة على البحر",
    attributeBeachfront: "على الشاطئ",
    attributeJacuzzi: "جاكوزي",
    attributeParking: "موقف سيارات",
    attributeAirConditioning: "تكييف",
    attributeWifi: "واي فاي",
    attributeGym: "صالة رياضية",
    attributeTerrace: "تراس",
    attributeConcierge: "كونسيرج",
    comparableWeightingHint: "ترجيح الإعلانات المقارنة — وليس تصفية صارمة.",
    marketRecalculationOnly: "إعادة حساب السوق فقط — تحليل الذكاء الاصطناعي والدرجات لا تتغير.",
    diagnostic: "جارٍ التشخيص…",
    recalibrateMarket: "إعادة معايرة السوق",
    premiumMarketInsufficient: "السوق المميز غير كافٍ",
    marketRecalibrated: "تمت إعادة معايرة السوق",
    premiumMarketText: "حللنا الإعلانات المقارنة المتاحة، لكن لم يكن أيٌّ منها قريبًا بما يكفي من الشريحة المميزة المحددة. لذلك تبقى التقديرات متحفظة عمدًا.",
    recalibratedMarketText: "تمت إعادة ضبط الشريحة التنافسية باستخدام أقرب الإعلانات المقارنة.",
    comparablesAnalyzed: "الإعلانات المقارنة التي تم تحليلها",
    premiumComparables: "الإعلانات المميزة المحتفَظ بها",
    comparablesKept: "الإعلانات المقارنة المحتفَظ بها",
    recalibratedMedian: "الوسيط بعد إعادة المعايرة",
    recalibratedAverage: "المتوسط بعد إعادة المعايرة",
    reliability: "الموثوقية",
    conversionLevel: "مستوى التحويل",
    conversionFragile: "مرجع التحويل: هش",
    conversionModerate: "مرجع التحويل: متوسط",
    conversionStrong: "مرجع التحويل: قوي",
    conversionScore: "درجة التحويل",
    estimatedImpact: "الأثر التقديري",
    ceiling: "السقف",
    impactToConfirm: "أثر يحتاج إلى تأكيد",
    readingWithoutRange: "قراءة من دون نطاق %",
    listingAnalysis: "تحليل الإعلان",
    listingBadge: "الإعلان",
    bookingVariantBadge: "{value} · نسخة Booking",
    listingQuality: "جودة الإعلان",
    listingQualityDescription: "تحليل داخلي لإعلانك: الصور، الترتيب البصري، الوصف، المرافق، SEO وإمكانات التحويل.",
    globalConversionLevel: "المستوى العام للتحويل",
    realMarket: "السوق الحقيقي",
    observedMarket: "السوق المرصود",
    observedMarketDescription: "استنادًا إلى الإعلانات المقارنة المحتفَظ بها، وأسعار المنافسين المرصودة، وموثوقية السوق، وفجوة السعر المحسوبة.",
    listingCompetitivePosition: "كيف يقارن إعلانك",
    competitiveSummary: "قراءة موجزة لموقعك التنافسي استنادًا إلى الإعلانات المقارنة المحتفَظ بها.",
    outOfMarketSegmentShort: "شريحة خارج السوق",
    percentAfterMarketConsolidation: "تُعرض النسبة بعد تثبيت بيانات السوق",
    marketPositioningLabel: "التموضع في السوق",
    positioning: "التموضع",
    listingScore: "درجة الإعلان",
    market: "السوق",
    base: "الأساس",
    averageCompetitiveQuality: "متوسط جودة المنافسين",
    localSegment: "الشريحة المحلية",
    comparedPrices: "الأسعار المقارنة",
    consolidatedScore: "الدرجة المجمعة",
    marketReliability: "موثوقية السوق",
    prioritySummary: "ملخص الأولويات",
    topThreeLevers: "أعلى 3 روافع تأثيرًا",
    actionable: "قابل للتنفيذ",
    strengthenDescription: "تعزيز الوصف",
    improveSeo: "تحسين SEO",
    preserveStrengths: "الحفاظ على نقاط القوة الحالية",
    marketPriorityDescriptionOne: "درجة الوصف: {score}. الأولوية: جعل الوعد أكثر وضوحًا وتميزًا.",
    marketPriorityDescriptionTwo: "درجة SEO: {score}. أضف كلمات محلية ومرافق قوية وعناصر مطلوبة.",
    marketPriorityDescriptionThree: "الصور: {photoScore} · المرافق: {amenitiesScore}. هذه الإشارات تدعم الثقة بالفعل.",
    marketLabelAbove: "فوق المستوى التنافسي",
    marketLabelBelow: "دون المستوى التنافسي",
    marketLabelCompetitive: "ضمن متوسط المنافسة",
    marketPositionToConfirm: "موضع يحتاج إلى تأكيد",
    marketBenchmarkAbove: "يقف إعلانك حاليًا فوق متوسط الدرجة المرصود بمقدار {value} نقطة.",
    marketBenchmarkBelow: "يقف إعلانك حاليًا دون متوسط الدرجة المرصود بمقدار {value} نقطة.",
    marketBenchmarkAligned: "إعلانك عند المستوى المتوسط للإعلانات المقارنة المرصودة.",
    marketBenchmarkNone: "لم يتم الاحتفاظ بأي إعلانات مقارنة لهذه القراءة في المنطقة المرصودة.",
    marketBenchmarkOne: "قراءة مبنية على إعلان مقارن واحد في منطقتك.",
    marketBenchmarkMany: "قراءة مبنية على {count} إعلانًا مقارنًا في منطقتك.",
    marketBenchmarkPending: "ستظهر القراءة المحلية عندما يتوفر حجم كافٍ من الإعلانات المقارنة المرصودة.",
    marketScoreContextAbove: "درجتك أعلى بوضوح من متوسط السوق الحالي.",
    marketScoreContextBelow: "لا تزال درجتك أدنى من المستوى المرصود في السوق.",
    marketScoreContextAligned: "درجتك متوافقة تمامًا مع متوسط مستوى السوق.",
    marketScoreContextObserved: "قراءة مبنية على الإعلانات المقارنة المرصودة.",
    marketScoreContextMarketBelow: "يبقى متوسط السوق أدنى من مستوى إعلانك الحالي.",
    marketScoreContextMarketAbove: "يبقى متوسط السوق أعلى من مستوى إعلانك الحالي.",
    marketScoreContextMarketAligned: "إعلانك والسوق عند مستوى متقارب.",
    marketScoreContextUnavailable: "سيُعرض متوسط درجة السوق عندما تتوفر إعلانات مرصودة كافية.",
    marketPositionNarrativeCompetitive: "هذا الإعلان منسجم إجمالًا مع المنافسين القريبين.",
    marketPositionNarrativeAbove: "يبدو أن هذا الإعلان يتفوق على المتوسط المحلي القريب.",
    marketPositionNarrativeBelow: "يبدو أن هذا الإعلان دون المتوسط المحلي القريب.",
    marketPositionNarrativeNoComparables: "لم يتم بعد تحليل أي منافس قريب لهذا التدقيق.",
    heroMarketPositionSupport: "المرجع المفصل (المقارنات، الدرجة النسبية، الإشارات النصية): انظر إلى كتلة «التموضع في السوق».",
    heroImpactSupportOutOfSegment: "تم الاحتفاظ بإعلانات مقارنة خارج شريحة التسعير — التقديرات التجارية غير موثوقة لهذا الإعلان. تبقى فقط روافع الجودة والمحتوى قابلة للاستخدام.",
    heroImpactSupportDefault: "المؤشرات الرقمية: % للارتفاع و €/شهريًا للإيراد ضمن «الأثر التقديري على الحجوزات»؛ ودرجة /10 في العمود الأيمن.",
    heroImpactSupportCompetitive: "الإعلان تنافسي بالفعل. المكاسب المتبقية ستأتي أساسًا من ضبط أدق للتموضع السعري ووضوح القيمة، لالتقاط حصة إضافية صغيرة ولكن حقيقية من الحجوزات.",
    heroBusinessLiftHintPrudent: "توقع متحفظ مبني على السعر الحالي وإمكانات التحويل، من دون قاعدة كافية لأسعار السوق.",
    heroBusinessLiftHintInsufficient: "بيانات السوق غير كافية لتقدير أثر كمي موثوق.",
    heroBusinessLiftHintDefault: "يمكن لإعلان محسّن أن يرفع إيرادك الشهري، بحسب جودة السوق المرصود ومستوى التحويل الحقيقي.",
    heroRevenueSupportUnavailable: "التقدير غير متاح — بيانات السوق غير كافية لهذه القراءة المجمعة.",
    heroRevenueSupportIndicative: "تقدير إرشادي مبني على السعر الموصى به، ومستوى السوق المرصود، ومعدل إشغال مستهدف واقعي.",
    heroRevenueSupportPrudent: "مؤشر متحفظ: تحقّق من حجم الحجوزات والإعلانات المقارنة قبل اتخاذ قرارات تسعير طويلة الأمد.",
    heroRevenueSupportFallback: "ثبّت السعر المدرج ومعيارًا سوقيًا (إعلانات مقارنة) لتفعيل قراءة كمية.",
    photoBadgeLow: "{count} صورة • أضف مزيدًا من العناصر المرئية",
    photoBadgeMedium: "{count} صورة • معرض مقبول",
    photoBadgeGood: "{count} صورة • معرض قوي",
    photoBadgeExcellent: "{count} صورة • نتيجة قوية جدًا",
    heroImpactRevenueRange: "+{low} إلى +{high} / شهريًا",
    marketIndicativeLabel: "قراءة إرشادية (قاعدة محدودة)",
    bookingLiftRange: "{low} إلى {high}",
    bookingLiftUpTo: "حتى {value}",
    impactSideCardNarrativeCondensed: "عرض مختصر: النطاق الكامل بالنسبة المئوية يظهر في بطاقة «{label}» أدناه.",
    heroScoreNarrativeStrong: "قراءة /10: مستوى قوي — يمكن صقله أكثر بتوصيات التقرير.",
    marketReliabilityBadgeHigh: "موثوقية عالية",
    marketReliabilityBadgeMedium: "موثوقية متوسطة",
    marketReliabilityBadgeLow: "موثوقية منخفضة",
    marketReliabilityBadgeWeakFallback: "Fallback ضعيف",
    marketReliabilityMessageHigh: "قاعدة سوق قابلة للاستخدام مع عدة إعلانات مقارنة متسقة.",
    marketReliabilityMessageMedium: "قاعدة سوق إرشادية ما زالت بحاجة إلى تعزيز.",
    marketReliabilityMessageLow: "قاعدة سوق محدودة: يجب تفسيرها بحذر.",
    marketReliabilityMessageWeakFallback: "قاعدة سوق fallback فقط: فسرها بحذر إضافي.",
    marketReliabilityTitleUsable: "سوق قابل للاستخدام",
    marketReliabilityTitleLimited: "قراءة محدودة",
    marketReliabilityTitleLow: "السوق المحلي قليل القابلية للاستخدام",
    marketReliabilityTitleWeakFallback: "قاعدة محلية محدودة",
    marketSourceLabelCrossPlatform: "مرجع مقارن عبر المنصات",
    marketSourceMessageCrossPlatform:
      "تم استخدام إعلانات مقارنة من خارج Booking لعدم توفر عدد كافٍ من المقارنات على Booking.",
    marketComparablesBodyStrong: "قاعدة تنافسية قابلة للاستخدام لتموضع إعلانك داخل شريحته.",
    marketComparablesBodyNone: "لم يتم الاحتفاظ بأي إعلانات مقارنة موثوقة لهذه القراءة السوقية.",
    marketComparablesBodyLimited: "{base} عينة محدودة: قراءة مفيدة لكنها ما زالت بحاجة إلى تعزيز.",
    toConfirm: "يحتاج إلى تأكيد",
    pricingPositioning: "التموضع السعري",
    pricingOpportunity: "تم رصد فرصة تسعير",
    pricingAligned: "السعر متوافق مع السوق",
    pricingAboveMedian: "السعر فوق الوسيط",
    observedMedian: "الوسيط المرصود",
    recommendedPrice: "السعر الموصى به",
    belowMedian: "أدنى من الوسيط",
    marketAligned: "متوافق مع السوق",
    aboveMedian: "أعلى من الوسيط",
    potentialMonthlyGain: "الربح الشهري المحتمل",
    estimatedMonthlyRisk: "المخاطر الشهرية التقديرية",
    estimatedMonthlyImpact: "الأثر الشهري التقديري",
    pricingAssumption: "افتراض التسعير: 20 ليلة / شهر",
    pricingInsightUnderpriced:
      "سعرك أقل بنسبة {value}% من الوسيط المرصود. قد تساعد زيادة تدريجية نحو السعر الموصى به على تحسين الإيراد من دون الخروج فجأة من الشريحة التنافسية التي تم تحليلها.",
    pricingInsightOptimal:
      "سعرك قريب من الوسيط المرصود ({value}%). الرافعة الرئيسية ليست زيادة قوية في السعر، بل تحسين التحويل وطريقة العرض.",
    pricingInsightOverpriced:
      "سعرك أعلى بنسبة {value}% من الوسيط المرصود. قد يصبح السعر نقطة احتكاك إذا لم تكن إشارات الجودة كافية لتبرير هذا الفارق بوضوح.",
    pricingIndicativeCaution:
      "{value} — فسّر تموضع السعر بحذر ما دامت القاعدة المحلية محدودة.",
    insufficientComparablePricing: "بيانات غير كافية: لا توجد مقارنة موثوقة لتقدير الوسيط أو أثر السعر.",
    insufficientPricingData: "بيانات السوق غير كافية لتقدير أثر سعري موثوق.",
    pricingBenchmarks: "معايير التسعير",
    pricingBenchmarksTitle: "كيف يقارن سعرك مع المنافسين",
    pricingBenchmarksDescription: "معايير تسعير مبنية على متوسطات الأسعار المرصودة والفجوة المقدرة مع السوق المقارن.",
    reportFrictionSignalsTitle: "إشارات الاحتكاك من التقرير",
    reportFrictionSignalsSubtitle:
      "مكمّل فقط: مقتطفات خارج القائمتين الرئيسيتين «نقاط الضعف» و«أهم الفجوات مقارنة بالسوق». قراءة إرشادية من دون ارتباط مباشر بقياس الحجوزات المفقودة.",
    mainMarketGapsTitle: "أهم الفجوات مقارنة بالسوق",
    mainMarketGapsEmpty:
      "لا توجد فجوات سوقية مدرجة في التقرير حاليًا — قد يعني ذلك أن البيانات مفقودة أو غير مهيكلة في هذا المحور، وليس بالضرورة عدم وجود فجوة فعلية.",
    mainMarketAdvantagesTitle: "أهم المزايا مقارنة بالسوق",
    mainMarketAdvantagesEmpty:
      "لم يتم تحديد أي ميزة واضحة حتى الآن.",
    missingAmenitiesChecklistTitle: "قائمة التحقق من المرافق الناقصة",
    avgCompetitorPriceSupportInsufficient: "عينة السوق غير كافية لإنشاء مرجع سعري موثوق.",
    avgCompetitorPriceSupportLimited: "مرجع إرشادي: القاعدة المحلية ما زالت محدودة ويجب تدعيمها بمزيد من الإعلانات المقارنة.",
    avgCompetitorPriceSupportObserved: "مرجع تنافسي مرصود على الإعلانات المحتفَظ بها لهذه الشريحة.",
    avgCompetitorPriceSupportPending: "سيصبح مرجع السعر أكثر فائدة عندما يتم تثبيت سعر تنافسي موثوق.",
    averageCompetitorPrice: "متوسط سعر المنافسين",
    priceGapVsMarket: "فجوة السعر مقابل السوق",
    priceDeltaInsufficientSample: "عينة غير كافية",
    marketCompetitorPricesDispersed: "أسعار المنافسين متفرقة",
    priceDeltaUnavailable: "لا يمكن حساب فجوة السعر هنا: السعر المدرج أو معيار السوق غير كافيين لإعطاء نسبة موثوقة.",
    priceDeltaPending: "بمجرد تثبيت سعر مدرج ومعيار سوقي موثوق، يمكن عرض الفجوة المئوية هنا.",
    notReliable: "غير موثوق",
    marketAnalysisPending: "التحليل مؤجل حتى يتوفر حجم كافٍ من السوق.",
    businessProjection: "التوقع التجاري",
    marketPricePositionWellAbove:
      "سعرك أعلى بكثير من السوق المرصود: يجب أن تبرره إشارات جودة قوية جدًا.",
    marketPricePositionSlightlyAbove:
      "سعرك أعلى قليلًا من السوق: يمكن اعتماد تموضع مميز إذا كانت الوعود واضحة.",
    marketPricePositionBelow:
      "سعرك أقل من السوق المرصود: يبدو أن هناك هامشًا متاحًا لتحسين التسعير.",
    marketPricePositionSlightlyBelow:
      "سعرك أقل قليلًا من السوق: تموضع جاذب مع إمكانية رفع مدروس.",
    marketPricePositionAligned:
      "سعرك متوافق مع المستوى المتوسط المرصود في هذا السوق.",
    marketPricePositionPending:
      "سيتضح تموضع السعر حالما يتوفر متوسط موثوق لأسعار المنافسين.",
    priceDeltaIndicativeSample:
      "فارق إرشادي مبني على عينة محلية محدودة.",
    marketAverageRatingObserved:
      "متوسط تقييم المنافسين المرصودين: {value}/{scale}.",
    marketAverageRatingUnavailable:
      "متوسط تقييم المنافسين غير قابل للاستخدام بعد.",
    competitorCountSupportAvailable:
      "تم الاحتفاظ بمقارنات لتقييم تموضعك التنافسي.",
    competitorCountSupportNone:
      "لم يتم الاحتفاظ بأي مقارنة لهذه القراءة؛ ويظل التموضع إرشاديًا فقط.",
    competitorCountSupportPending:
      "يبقى التموضع مؤشرًا يحتاج إلى تثبيت إلى أن يتوفر حجم دقيق للمقارنات.",
    competitorCountSupportPartial:
      "تظل قراءة السوق جزئية إلى أن يتم تثبيت حجم المقارنات.",
    comparablesKpiLimited: "قراءة محدودة",
    comparablesKpiNone: "لا توجد مقارنة موثوقة",
    comparablesKpiOne: "قراءة محدودة — مقارنة واحدة قابلة للاستخدام",
    comparablesKpiTwo: "قراءة محدودة — مقارنتان قابلتان للاستخدام",
    lqiPartialIndex: "مؤشر جزئي",
    lqiToConsolidate: "بحاجة إلى تثبيت",
    insufficientData: "بيانات غير كافية",
    revenueImpactRangeDisplay:
      "التقدير الحالي: {current} / شهر · بعد التحسين: من {low} إلى {high} / شهر",
    monthlyGainQualifierLimited:
      "{value} — قارن مع مزيد من المقارنات لتثبيت المرجع.",
    monthlyGainQualifierFragile:
      "فرضية إرشادية تحتاج إلى تأكيد (السعر و/أو المقارنات لا تزال غير موثوقة بما يكفي لمرجع سوقي واضح).",
    projectionsPotential: "التوقعات والإمكانات",
    projectionsDescription: "تقديرات إرشادية تستند إلى إشارات السوق، والتموضع التنافسي، وإمكانات التحويل المرصودة.",
    nightlyPrice: "السعر الليلي",
    premiumPosition: "موضع مميز",
    aggressivePosition: "موضع هجومي",
    balancedPosition: "موضع متوازن",
    qualitativeAnalysisOnly: "تحليل نوعي فقط",
    businessPotentialAfterOptimization: "الإمكانات التجارية بعد التحسين",
    estimatedBookingsAfterOptimization: "الحجوزات التقديرية بعد التحسين",
    projectionBase: "أساس التوقع",
    crossPlatformReading: "قراءة عبر المنصات",
    readableMarket: "سوق قابل للقراءة",
    cautiousReading: "قراءة حذرة",
    lowVisibility: "ظهور منخفض",
    conversionGainPotential: "إمكانات زيادة التحويل",
    actionableProjection: "توقع قابل للتنفيذ",
    limitedProjection: "توقع محدود",
    cautiousProjection: "توقع حذر",
    indicativeProjection: "توقع إرشادي",
    estimatedMonthlyGainTitle: "الربح الشهري التقديري",
    estimatedImpactOnBookings: "الأثر التقديري على الحجوزات",
    impactBusinessBlockIntroOutOfSegment: "تم الاحتفاظ بإعلانات مقارنة خارج شريحة السعر — فقط توصيات الجودة والمحتوى والتحويل البصري يمكن تفسيرها بثقة.",
    impactBusinessBlockIntroDefault: "كل بطاقة أدناه تستخدم وحدة ثابتة: € للسعر، /10 للدرجة السوقية النسبية، % لزيادة الحجوزات، و €/شهريًا للربح الشهري التقديري (إضافي وليس إجمالي الإيراد).",
    currentPriceContextCompareMarket: "قارن مع متوسط السعر السوقي التقديري البالغ {value}.",
    currentPriceContextDetected: "تم اكتشاف السعر الحالي في الإعلان.",
    currentPriceContextMarketReference: "السعر الحالي غير متاح. المرجع السوقي المرصود: حوالي {value}/ليلة.",
    currentPriceContextMissing: "السعر الحالي غير متاح لهذا الإعلان.",
    currentPriceUnavailable: "السعر الحالي غير متاح",
    projectionBaseNoComparable: "لا توجد إعلانات مقارنة متسقة بما يكفي لتكوين متوسط تنافسي قابل للاستخدام.",
    projectionBaseRobust: "قاعدة تنافسية قوية بُنيت من {count} إعلانًا مقارنًا.",
    projectionBasePartial: "مرجع جزئي مبني على {count} من الإعلانات المقارنة القابلة للاستخدام.",
    projectionBaseUnstable: "السوق المكتشفة ما زالت غير مستقرة للغاية لتقديم معيار تنافسي موثوق.",
    potentialToConfirm: "إمكانات تحتاج إلى تأكيد",
    conversionGainLowConfidence: "لا تزال موثوقية السوق غير كافية لتوقع زيادة تحويل قابلة للتصديق.",
    conversionGainFromScoreAndPrice: "توقع مبني على درجة التحويل والسعر الحالي، من دون معيار سعري تنافسي موثوق.",
    conversionGainOutOfSegment: "تم اكتشاف إعلانات مقارنة خارج الشريحة — لا يمكن تقدير إمكانات الحجوزات لهذا الإعلان بثقة.",
    conversionGainPendingRange: "سيظهر النطاق بالنسبة المئوية عندما تصبح قاعدة السوق موثوقة بما يكفي (إعلانات مقارنة ودرجة مجمعة)، تمامًا كما هو الحال مع الربح الشهري التقديري.",
    conversionGainEstimated: "تقدير مبني على تموضعك الحالي والإعلانات المنافسة التي تم تحليلها.",
    conversionGainNoRange: "لا يتوفر نطاق نسبي لزيادة الحجوزات في بيانات التقرير الحالية.",
    monthlyGainOutOfSegment: "إعلانات مقارنة خارج الشريحة — لا يمكن تطبيق أي توقع للربح على هذه السوق.",
    monthlyGainUnavailable: "التقدير غير متاح — بيانات السوق غير كافية. يتطلب نطاق كمي قابل للاستخدام سعرًا مدرجًا موثوقًا ومعيارًا تنافسيًا ثابتًا.",
    monthlyGainNeedsStableMarket: "يتطلب التقدير الكمي سعرًا مدرجًا متسقًا ومستوى سوق مرصودًا ثابتًا.",
    optimizedTexts: "نصوص الإعلان المحسّنة",
    optimizedTextVariantLabel: "نسخة {index} - {label}",
    optimizedTextIntro: "اقتراح تم تجميعه من إعلانك وإشارات التقرير باستخدام نماذج نصية محلية (من دون استدعاء نموذج خارجي على هذه الشاشة). عدّله بما يناسب علامتك.",
    optimizedTextVariantCounter: "نسخة {index} / {total}",
    optimizedTextVariantNameComfort: "الراحة والاسترخاء",
    optimizedTextVariantNamePractical: "العملية والسلاسة",
    optimizedTextVariantNameNeighborhood: "الحي والموقع",
    optimizedTextVariantNamePremium: "التميز والثقة",
    optimizedTextVariantNameBusiness: "إقامة قصيرة / أعمال",
    variant: "نسخة",
    changeVariant: "تغيير النسخة",
    descriptionCopied: "تم نسخ الوصف",
    newVariantReady: "النسخة الجديدة جاهزة.",
    currentTitle: "العنوان الحالي",
    optimizedTitleExample: "مثال على عنوان محسّن",
    aiGeneratingTitle: "جارٍ إنشاء عنوان بالذكاء الاصطناعي…",
    missingListingTitle: "لا يوجد عنوان متاح لهذا الإعلان.",
    aiDescriptionPlaceholder: "سيظهر النص المقترح هنا بمجرد توفر بيانات الإعلان والتدقيق.",
    aiGeneratingDescription: "جارٍ توليد النص بالذكاء الاصطناعي…",
    aiProvenanceAi: "ذكاء اصطناعي",
    aiProvenanceFallbackLocal: "بديل محلي",
    aiDescriptionFailed: "فشل إنشاء النص بالذكاء الاصطناعي لهذه اللغة. يرجى المحاولة لاحقًا.",
    aiDescriptionUnavailable: "لا يتوفر بعد وصف Airbnb بالذكاء الاصطناعي لهذه اللغة.",
    aiFallbackHousing: "استقر في مكان مريح وسهل العيش صُمم ليجعل كل لحظة من الإقامة أبسط وأكثر سلاسة.",
    aiFallbackDetailedHousing: "يوفر هذا المسكن تجربة متكاملة، مع مساحات واضحة ومرافق مفيدة وأجواء ممتعة للاستمتاع بالإقامة.",
    aiFallbackGuestAccess: "يستفيد الضيوف من وصول سهل إلى المسكن، وإلى المساحات المخصصة للإقامة، وإلى المرافق المفيدة في الحياة اليومية.",
    aiFallbackGuestInteraction: "أبقى متاحًا قبل الإقامة وأثناءها لمشاركة الإرشادات المفيدة والإجابة ببساطة عن الأسئلة العملية.",
    aiFallbackOtherInfo: "تُسهّل المعلومات العملية الوصول، وتوضح تنظيم الإقامة، وتساعد الضيوف على الاستمتاع بالمسكن براحة واطمئنان.",
    myPlace: "مسكني",
    detailedPlace: "المسكن — النسخة التفصيلية",
    guestAccess: "وصول الضيوف",
    guestInteraction: "التفاعل مع الضيوف",
    otherInfo: "معلومات أخرى يجب ملاحظتها",
    bookingDescriptionSummary: "ملخص الوصف (Booking)",
    bookingSummaryFallback:
      "يمكن تضمين ذلك في الوصف: راحة المساحات، سهولة الوصول إلى مكان الإقامة، التوفر لمساعدة الضيوف، والمعلومات العملية المفيدة عند الوصول.",
    bookingSummaryReady: "جاهز للنسخ واللصق ومتوافق مع النسخة المعروضة.",
    actionPlan: "خطة العمل",
    actionPlanSubtitle: "المشاريع التي يجب إطلاقها الآن، مرتبة حسب الأثر التجاري.",
    fallbackNarrativeFromWeaknesses:
      "سرد احتياطي مستند إلى نقاط الضعف في التقرير. قراءة إرشادية وليست معيارًا سوقيًا صارمًا.",
    fallbackNarrativeFromStrengths:
      "سرد احتياطي مستند إلى نقاط القوة في التقرير. قراءة إرشادية وليست معيارًا سوقيًا صارمًا.",
    actionPlanIntroAttractiveness: "تعرض هذه الشاشة الروافع مرتبة حسب الأولوية لتعزيز جاذبية إعلانك، وحسن الاستضافة، وطريقة تقديمه.",
    actionPlanIntroConversion: "تعرض هذه الشاشة التحسينات مرتبة حسب الأولوية لتوضيح العرض، وطمأنة المسافر، وتسريع اتخاذ القرار.",
    actionPlanIntroStorytelling: "سيتم تنظيم الإجراءات هنا لدعم السرد، والتميّز، والرغبة في الإقامة.",
    actionPlanIntroDefault: "سيتم تنظيم الإجراءات هنا بمجرد توفر خطة تحسين مفصلة.",
    actionSignalLabel: "الإشارة",
    actionImpactHigh: "أثر مرتفع",
    actionImpactMedium: "أثر متوسط",
    actionImpactLow: "أثر منخفض",
    actionScoreLabel: "الدرجة المتأثرة",
    actionObjectiveLabel: "الهدف",
    actionSignalFallback: "إشارة تحتاج إلى تأكيد.",
    actionObjectiveFallback: "رتّب الأولويات وفق الأثر التجاري المكتشف.",
    actionEmptyState: "لا توجد حاليًا أي خطوة ذات أولوية متاحة.",
    actionImprovementFallback: "تحسين {index}",
    actionScoreLineWithValue: "{label}: {value}/10.",
    actionScoreLinePending: "{label}: يحتاج إلى تأكيد.",
    actionLabelDescription: "الوصف",
    actionLabelSeo: "SEO",
    actionLabelPhotos: "الصور",
    actionLabelAmenities: "المرافق",
    actionLabelConversion: "التحويل",
    actionLabelPricing: "السعر",
    actionNarrativeDescription: "يجب أن يحوّل النص معلومات الإعلان بشكل أفضل إلى فوائد ملموسة للمسافر: الراحة، والتجربة، والموقع، وأسباب الحجز.",
    actionReasonDescription: "درجة الوصف + جودة إسقاط المسافر لنفسه في الإقامة.",
    actionNarrativeSeo: "يجب أن يدمج العنوان والأسطر الأولى كلمات مفتاحية مفيدة بشكل أفضل: الموقع، والمرافق المطلوبة، والعناصر المميزة.",
    actionReasonSeo: "درجة SEO + الظهور على المنصة.",
    actionNarrativePhotos: "يجب أن تستمر الصور في بناء الثقة منذ الثواني الأولى: أفضل المساحات أولًا، ثم الضوء، والراحة، والقيمة المدركة.",
    actionReasonPhotos: "درجة الصور + ترتيب المعرض.",
    actionNarrativeAmenities: "يجب أن تكون المرافق الأساسية أكثر وضوحًا لتقليل التردد قبل الحجز وتعزيز الشعور بالراحة.",
    actionReasonAmenities: "درجة المرافق + طمأنة الإقامة.",
    actionNarrativeConversion: "الأولوية هي تقليل التردد: وعد واضح، وأدلة مرئية، ومعلومات ملموسة، وتماسك بين العنوان والصور والوصف.",
    actionReasonConversion: "درجة التحويل + احتكاك اتخاذ القرار.",
    actionReasonPricing: "تموضع السعر + التحقق من السوق المقارن.",
    actionReasonMarketComparables: "تم استخدام {count} إعلانًا مقارنًا لقراءة السوق.",
    actionNarrativeFallback: "إجراء من التقرير: رتّب الأولويات وفق الأثر التجاري والإشارات المتاحة.",
    actionNormalizedTitleClarify: "توضيح المعلومات التي تدفع إلى الحجز",
    actionNormalizedTitleConcreteValue: "جعل القيمة أكثر ملموسية",
    actionNormalizedTitleAnalyzePricingGap: "تحليل فجوة السعر المقاسة",
    actionNormalizedTitleBuildTrust: "تعزيز الثقة قبل الحجز",
    actionNormalizedDescriptionPricingCompare: "إجراء مطلوب: قارن السعر فقط مع الإعلانات المتشابهة فعليًا في النوع والموقع ومستوى الخدمة قبل أي تعديل.",
    auditLeversDetailTitle: "تفاصيل روافع الإعلان",
    auditStrengthsTitle: "نقاط القوة",
    auditStrengthsSource: "المصدر: إشارات قوية تم قياسها عبر الدرجات الفرعية للتدقيق.",
    auditStrengthsEmpty: "لم يتم رصد أي إشارة قوية قابلة للقياس عند 8/10 أو أكثر في الدرجات الفرعية المتاحة.",
    auditWeaknessesTitle: "نقاط الضعف",
    auditWeaknessesSource: "المصدر: إشارات ضعيفة تم قياسها عبر الدرجات الفرعية للتدقيق.",
    auditWeaknessesEmpty: "لم يتم رصد أي إشارة ضعيفة قابلة للقياس تحت 7/10 في الدرجات الفرعية المتاحة.",
    auditStrengthPhotos: "صور قوية: {score}/10.",
    auditStrengthPhotoOrder: "ترتيب صور قوي: {score}/10.",
    auditStrengthDescription: "وصف قوي: {score}/10.",
    auditStrengthAmenities: "المرافق مغطاة جيدًا: {score}/10.",
    auditStrengthSeo: "SEO قوي: {score}/10.",
    auditStrengthConversion: "تحويل قوي: {score}/10.",
    auditWeakDescription: "الوصف يحتاج إلى تحسين: {score}/10.",
    auditWeakSeo: "SEO يحتاج إلى تعزيز: {score}/10.",
    auditWeakConversion: "التحويل يحتاج إلى تعزيز: {score}/10.",
    auditWeakAmenities: "المرافق تحتاج إلى استكمال: {score}/10.",
    auditWeakPhotoQuality: "جودة الصور تحتاج إلى تحسين: {score}/10.",
    auditWeakPhotoOrder: "ترتيب الصور يحتاج إلى مراجعة: {score}/10.",
    nextStepTitle: "الخطوة التالية الموصى بها",
    nextStepDescription: "ابدأ أولًا بتصحيح الروافع الأكثر ربحية، ثم أعد تشغيل التدقيق لقياس المكسب المحقق.",
    nextStepRunAudit: "إعادة تشغيل التدقيق",
    nextStepBackToAudits: "العودة إلى التدقيقات",
    nextStepAnalyzeAnother: "تحليل إعلان آخر",
    businessPriority: "الأولوية التجارية",
    quickOptimization: "تحسين سريع",
    visibility: "الظهور",
    reassurance: "الطمأنة",
    improvement: "التحسين",
    photoQuality: "جودة الصور",
    photoOrderQuality: "ترتيب الصور",
    descriptionQualityLabel: "جودة الوصف",
    amenitiesCompletenessLabel: "اكتمال المرافق",
    seoPerformance: "أداء SEO",
    scoreOverviewTitle: "قراءة مفصلة لأداء التحويل لديك",
    scoreOverviewTextAirbnb: "قراءة مبنية على الإشارات الظاهرة: الأساس الحالي يدعوك لتعزيز العاطفة، والضيافة، وتفرّد الإعلان.",
    scoreOverviewTextDefault: "قراءة مبنية على الإشارات الظاهرة: الأساس الحالي يساعد على تحسين الوضوح والطمأنة والتحويل.",
    scoreStatusConfirm: "يحتاج إلى تأكيد",
    scoreStatusPartialData: "البيانات ما تزال جزئية",
    scoreStatusExcellent: "ممتاز",
    scoreStatusExcellentDetail: "أفضلية تنافسية واضحة",
    scoreStatusStrong: "قوي",
    scoreStatusStrongDetail: "إشارة إيجابية يجب الحفاظ عليها",
    scoreStatusCorrect: "مقبول",
    scoreStatusCorrectDetail: "لا يزال التحسين ممكنًا",
    scoreStatusNeedsWork: "يحتاج إلى عمل",
    scoreStatusNeedsWorkDetail: "له أثر ظاهر على التحويل",
    scoreStatusWeak: "ضعيف",
    scoreStatusWeakDetail: "أولوية للتحسين",
    subScorePhotosNote: "تخلق الصور انطباعًا أوليًا قويًا ومطمئنًا. فهي تساعد المسافر على فهم جودة العقار بسرعة وتقلل التردد قبل الحجز.",
    subScorePhotosFallback: "لا توجد بيانات صور كافية لتفصيل هذا الجانب.",
    subScorePhotosImpact: "الأثر: قوي على النقر والثقة.",
    subScorePhotosPriority: "الأولوية: الحفاظ على هذا المستوى.",
    subScorePhotoOrderNote: "يُبرز ترتيب الصور العناصر الأكثر جاذبية بشكل جيد. يجب أن تؤكد الصور الأولى فورًا الراحة، والمساحة، والقيمة المدركة للعقار.",
    subScorePhotoOrderFallback: "يجب تأكيد الترتيب البصري عندما تكتمل الإشارات أكثر.",
    subScorePhotoOrderImpact: "الأثر: يحسن الانطباع الأول.",
    subScorePhotoOrderPriority: "الأولوية: إبراز أفضل المساحات أولًا.",
    subScoreDescriptionNote: "النص قوي، لكنه ما يزال قادرًا على بيع التجربة الحقيقية بشكل أفضل: الأجواء، والراحة، والمزايا الملموسة، والوصول، والحي، وأسباب اختيار هذا العقار بدلًا من غيره.",
    subScoreDescriptionFallback: "النص محدود جدًا أو غير قابل للاستخدام بما يكفي لتقديم قراءة موثوقة هنا.",
    subScoreDescriptionImpact: "الأثر: يعزز إسقاط المسافر لنفسه في الإقامة.",
    subScoreDescriptionPriority: "الأولوية: جعل الوعد أكثر ملموسية.",
    subScoreAmenitiesNote: "تعزز المرافق الظاهرة الإحساس بالراحة. وكلما كانت أدق وأفضل عرضًا، زادت طمأنة المسافرين بشأن جودة الإقامة.",
    subScoreAmenitiesFallback: "المرافق غير ظاهرة بما يكفي أو غير مدخلة: تحتاج القراءة إلى استكمال.",
    subScoreAmenitiesImpact: "الأثر: يطمئن بشأن راحة الإقامة.",
    subScoreAmenitiesPriority: "الأولوية: إبراز المرافق الأساسية بشكل أفضل.",
    subScoreSeoNote: "SEO قابل للاستخدام، لكنه يمكن أن يصبح أدق. يجب أن يساعد العنوان والكلمات المفتاحية المحلية والمرافق المطلوبة المنصة على فهم الإعلان بشكل أفضل.",
    subScoreSeoFallback: "الإشارات ما تزال جزئية للغاية لإعطاء استنتاج في هذا الجانب.",
    subScoreSeoImpact: "الأثر: يساعد المنصة على ترتيب الإعلان بشكل أفضل.",
    subScoreSeoPriority: "الأولوية: تعزيز العنوان والكلمات المفتاحية المفيدة.",
    subScoreConversionNote: "إمكانات التحويل جيدة، لكن ما تزال هناك روافع قابلة للتفعيل. ستأتي المكاسب أساسًا من وعد أوضح، وطمأنة أقوى، ومحتوى أكثر ملموسية.",
    subScoreConversionFallback: "القراءة تحتاج إلى تدعيم ببيانات إضافية.",
    subScoreConversionImpact: "الأثر: يعمل مباشرة على قرار الحجز.",
    subScoreConversionPriority: "الأولوية: تحسين الطمأنة والوضوح.",
    iqaBusinessIndicator: "مؤشر الأعمال",
    iqaPerceivedListingQuality: "الجودة المدركة للإعلان",
    iqaReading: "قراءة IQA",
    iqaNarrativePremium: "قراءة مميزة: يظهر المستوى العام المدرك قويًا مقارنة بالسوق المحللة.",
    iqaNarrativeCompetitive: "القاعدة التنافسية جيدة مع عدة روافع ما تزال قابلة للتفعيل.",
    iqaNarrativeFragile: "يبقى التموضع من حيث الجودة هشًا أمام الإعلانات المنافسة المرصودة.",
    iqaNarrativeRebuilt: "قراءة أعيد بناؤها من الإشارات الظاهرة والدرجة الإجمالية للتدقيق.",
    scoreSideCardNarrativeLow:
      "قراءة /10: مستوى هش — راجع تفاصيل كل محور في «مستوى التحويل العام».",
    scoreSideCardNarrativeMedium:
      "قراءة /10: مستوى متوسط — راجع الدرجات الفرعية في الكتلة الرئيسية.",
    impactSideCardNarrativeOutOfMarket:
      "الشريحة خارج السوق — لا يمكن استخدام بيانات الأعمال بشكل موثوق لهذا الإعلان.",
    impactSideCardNarrativeMarketPending:
      "قد توجد فرصة لتحسين إعلانك، لكن النسبة الكمية ستظهر عندما تصبح قاعدة السوق قوية بما يكفي (ثلاثة مقارنات موثوقة على الأقل ودرجة سوق موحدة)، وفق المبدأ نفسه المستخدم في تقدير اليورو.",
    impactSideCardNarrativeNoRange:
      "لا توجد نسبة مئوية قابلة للاستخدام للرفع في التقرير.",
    prioritizedActionsIntroAirbnb:
      "قائمة التوصيات المولدة، مرتبة للانتقال من الأكثر تمييزًا إلى الأكثر هيكلة.",
    prioritizedActionsIntroDefault:
      "قائمة التوصيات المولدة، مرتبة لتعظيم الوضوح والطمأنة والتحويل.",
    prioritizedActionsIntroEmpty:
      "لم يتم إبراز أي إجراء ذي أولوية في هذا التدقيق بعد.",
    prioritizedActionsSublineAirbnb:
      "تسلسل يعزز الإحساس والتميّز والرغبة في الحجز.",
    prioritizedActionsSublineDefault:
      "تسلسل يقدّم بسرعة معلومات مفيدة ومطمئنة وقابلة للتنفيذ.",
    strengthsFallbackAirbnb:
      "لم تظهر بعد أي نقطة قوة منظمة — فكّر في السرد، وحسن الاستقبال، وما يميزك عن غيرك.",
    strengthsFallbackDefault:
      "لم تظهر بعد أي نقطة قوة منظمة — فكّر في الأدلة والوضوح وعناصر الطمأنة.",
    weaknessesFallbackInsightIsolated:
      "لم يكن من الممكن عزل نقطة ضعف واضحة من «insights» باستخدام الطريقة الحالية.",
    weaknessesFallbackInsightStructured:
      "لا توجد قائمة «weaknesses» منظمة في التقرير: لا يتم نسخ «insights» هنا كنقاط ضعف رسمية — راجع الإجراءات ذات الأولوية وفجوات السوق.",
    weaknessesFallbackNoStructuredAirbnb:
      "لا تظهر أي نقطة ضعف في الحقول المنظمة للتقرير حاليًا — القراءة غير مكتملة، وهذا لا يعني عدم وجود ما يمكن تحسينه.",
    weaknessesFallbackNoStructuredDefault:
      "لا تظهر أي نقطة ضعف في الحقول المنظمة للتقرير حاليًا — القراءة غير مكتملة، وهذا لا يعني عدم وجود ما يمكن تحسينه.",
    lqiNoteUnavailable:
      "البيانات غير متاحة لهذا المحور في هذا العرض.",
    lqiNoteListingNativeHigh:
      "مكوّن يقدمه التقرير مباشرة: مستوى مرتفع على هذا المحور، ويجب التحقق منه مقابل المحتوى الفعلي للإعلان.",
    lqiNoteListingNativeModerate:
      "مكوّن يقدمه التقرير مباشرة: مستوى متوسط، وهو إشارة من بين عدة إشارات وليس حكمًا مستقلًا.",
    lqiNoteListingLocalHigh:
      "ملخص محلي /100 مبني على الأبعاد /10 المفصلة أعلاه: من العائلة نفسها من الإشارات، لكن في عرض مكثف.",
    lqiNoteListingLocalFallback:
      "ملخص محلي /100 مبني على الدرجات الفرعية /10 للتدقيق — قراءة إرشادية سبق استكشافها في مواضع أخرى من الصفحة.",
    lqiNoteMarketNativeHigh:
      "يبقى إعلانك تنافسيًا مقارنة بالإعلانات القريبة التي تم تحليلها.",
    lqiNoteMarketNativeModerate:
      "تموضعك في السوق صحيح، لكنه ما زال قابلًا للتحسين.",
    lqiNoteMarketNativeLow:
      "يبدو أن المنافسين المرصودين أفضل تموضعًا حاليًا.",
    lqiNoteMarketLocalHigh:
      "ملخص محلي (درجات السوق + الإجمالي /10): مؤشر مكثف وليس مستقلًا عن كتل السوق.",
    lqiNoteMarketLocalFallback:
      "ملخص محلي (درجات السوق + الإجمالي /10): قراءة إرشادية ينبغي مقاطعتها مع «التموضع في السوق».",
    lqiNoteConversionUnavailable:
      "لا توجد قيمة /100 لهذا البعد: راجع درجة التحويل والتوصيات في مواضع أخرى.",
    lqiNoteConversionNativeHigh:
      "إمكانات التحويل قوية بالفعل في هذا الإعلان.",
    lqiNoteConversionNativeModerate:
      "ما زالت هناك عدة تحسينات يمكنها رفع التحويل.",
    lqiNoteConversionNativeLow:
      "لا تزال هناك عوائق ظاهرة تحد من إمكانات الحجز.",
    lqiNoteConversionLocalFallback:
      "قراءة إرشادية: قيمة مكتملة من حقل آخر في التقرير (إمكانات الحجز)، وليست قياسًا مستقلًا للتحويل.",
    lqiLabelHighSignal: "إشارة عالية",
    lqiLabelFavorable: "إشارة مواتية",
    lqiLabelImproving: "في تحسن",
    lqiLabelNeedsWork: "يحتاج إلى تعزيز",
    lqiSummaryNoObject: "لا يوجد كائن LQI في التقرير: القيم /100 هي خلاصة محلية مبنية على نفس إشارات /10 الموجودة في بقية الصفحة — قراءة مجمعة وليست مجموعة قياس مستقلة ثانية.",
    lqiSummaryIndicativeScore: "الدرجة الرئيسية /100 إرشادية: مشتقة من الدرجة الإجمالية /10 لأنه لا يوجد مؤشر IQA رقمي أصلي في التقرير.",
    lqiSummaryOverview: "نظرة عامة على الجودة / السوق / التحويل: تحت كل بطاقة — «مكوّن التقرير» = حقل بنيوي موفّر؛ «الخلاصة المحلية» = تجميع لقيم /10 الموجودة أصلًا في الصفحة؛ «تكملة التقرير» = حقل آخر من التقرير (مثل إمكانات الحجوزات)، وليس مقياس تحويل مستقلًا.",
    lqiSummaryPending: "سيظهر هذا المؤشر بمجرد توفر الإشارات المفيدة.",
    lqiSummaryCompetitiveButOptimizable: "الإعلان تنافسي، لكن بعض الروافع الظاهرة ما تزال قادرة على تحسين التحويل والتموضع، خاصة من خلال جعل عرض القيمة أكثر وضوحًا منذ الشاشة الأولى.",
    listingConversion: "تحويل الإعلان",
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
type AiTextProvenance = "ai" | "fallback";
type AiTextProvenanceCopy = {
  aiProvenanceAi: string;
  aiProvenanceFallbackLocal: string;
};

const AI_VARIANT_LABELS = [
  "Confort & détente",
  "Pratique & fluide",
  "Quartier & emplacement",
  "Premium & confiance",
  "Court séjour / business",
] as const;

function getAiTextProvenanceBadge(
  provenance: AiTextProvenance,
  copy: AiTextProvenanceCopy
) {
  return provenance === "ai"
    ? {
        label: copy.aiProvenanceAi,
        className:
          "border-emerald-200/80 bg-emerald-50/90 text-emerald-700 shadow-[0_6px_14px_rgba(16,185,129,0.08)]",
      }
    : {
        label: copy.aiProvenanceFallbackLocal,
        className:
          "border-amber-200/80 bg-amber-50/90 text-amber-700 shadow-[0_6px_14px_rgba(245,158,11,0.08)]",
      };
}


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
function buildBookingSectionsReadySummary(
  source: string,
  fallback: string,
): string {
  const cleaned = normalizeSentence(
    source
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
    return fallback;
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

function marketLabelText(label: string | undefined, copy: Record<string, string>) {
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

function lqiLabelText(label: string | null | undefined, copy: Record<string, string>) {
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
  const [aiOptimizedTitles, setAiOptimizedTitles] = useState<string[]>([]);
  const [aiAirbnbDescriptionVariants, setAiAirbnbDescriptionVariants] = useState<AiVariant[]>([]);
  const [aiBookingDescriptions, setAiBookingDescriptions] = useState<Array<{ label: string; description: string }>>([]);
  const [isAiAirbnbDescriptionLoading, setIsAiAirbnbDescriptionLoading] = useState(false);
  const [aiAirbnbDescriptionFailed, setAiAirbnbDescriptionFailed] = useState(false);
  const [aiOptimizedTitleFailed, setAiOptimizedTitleFailed] = useState(false);
  const [showToast, setShowToast] = useState(true);
  const [, setIsPro] = useState(false);
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [copyToastKey, setCopyToastKey] = useState<AiTextSectionKey | null>(null);
  const [generationSeed, setGenerationSeed] = useState(0);
  const [editableAiDescription, setEditableAiDescription] = useState("");
  const aiDescriptionTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const aiAirbnbDescriptionRequestKeyRef = useRef<string | null>(null);
  const aiBookingDescriptionRequestKeyRef = useRef<string | null>(null);
  const aiOptimizedTitleRequestKeyRef = useRef<string | null>(null);
  const aiAirbnbDescriptionPendingRef = useRef(false);
  const aiOptimizedTitlePendingRef = useRef(false);

  useEffect(() => {
    aiAirbnbDescriptionRequestKeyRef.current = null;
    aiBookingDescriptionRequestKeyRef.current = null;
    aiOptimizedTitleRequestKeyRef.current = null;
    aiAirbnbDescriptionPendingRef.current = false;
    aiOptimizedTitlePendingRef.current = false;
    setIsAiAirbnbDescriptionLoading(false);
    setAiAirbnbDescriptionFailed(false);
    setAiOptimizedTitleFailed(false);
  }, [auditId]);

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
      } = await getSharedSession();
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
      let loadAuditStage = "init";
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
        loadAuditStage = "before_get_user";
        const {
          data: { user },
        } = await getSharedUser();

        if (!user) {
          if (isMounted) {
            setAudit(null);
            setIsPro(false);
          }
          return;
        }

        loadAuditStage = "before_workspace";
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

        loadAuditStage = "before_audit_query";
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
          loadAuditStage = "before_plan";
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

          loadAuditStage = "before_listing_query";
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

        loadAuditStage = "before_normalize";
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
        let serializedError: string | undefined;
        if (typeof error === "object" && error !== null) {
          try {
            serializedError = JSON.stringify(
              error,
              Object.getOwnPropertyNames(error)
            );
          } catch {
            serializedError = undefined;
          }
        }

        console.error("[audit-detail] Unexpected loadAudit failure", {
          stage: loadAuditStage,
          error,
          errorType: typeof error,
          isErrorInstance: error instanceof Error,
          constructorName:
            typeof error === "object" && error !== null && "constructor" in error
              ? (error as { constructor?: { name?: string } }).constructor?.name
              : undefined,
          keys:
            typeof error === "object" && error !== null ? Object.keys(error) : [],
          stringValue: String(error),
          serializedError,
          message: error instanceof Error ? error.message : undefined,
          stack: error instanceof Error ? error.stack : undefined,
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
  const photoOrderTextSignalsKey = JSON.stringify(photoOrderTextSignals);
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
        label: copy.photoBadgeLow.replace("{count}", String(visiblePhotoCount)),
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
        label: copy.photoBadgeGood.replace("{count}", String(visiblePhotoCount)),
        className: "border-emerald-300 bg-emerald-50 text-emerald-700",
      };
    }

    return {
      label: copy.photoBadgeExcellent.replace("{count}", String(visiblePhotoCount)),
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
  const photoOrderSuggestionsKey = JSON.stringify(photoOrderSuggestions);
  const missingAmenities = pickStringArray(
    payload.content?.missingAmenities,
    payload.missingAmenities
  );

  const pricingSignals = [
    comparableCount != null
      ? copy.actionReasonMarketComparables.replace("{count}", String(comparableCount))
      : null,
    avgCompetitorPrice != null
      ? `${copy.averageCompetitorPrice}: ${formatAuditPricingAmount(avgCompetitorPrice)}.`
      : null,
    priceDelta != null
      ? `${copy.priceGapVsMarket}: ${priceDelta > 0 ? "+" : ""}${priceDelta.toFixed(1)}%.`
      : null,
    marketPosition != null
      ? `${copy.marketPosition}: ${marketPosition}.`
      : null,
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

  if (DEBUG_AUDIT_UI) {
  }

  console.log("[STRENGTHS VS WEAKNESSES]", {
    strengthsCount: resolvedStrengths.length,
    strengths: resolvedStrengths,
    weaknessesCount: resolvedWeaknesses.length,
    weaknesses: resolvedWeaknesses,
    insights: insightSignals,
  });

  if (DEBUG_AUDIT_UI) {
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
  const rawImpactSummary = payload.impactSummary?.trim() || summary || null;
  const impactSummary =
    rawImpactSummary &&
    /déjà compétitive|deja competitive|already competitive|ya es competitivo/i.test(rawImpactSummary)
      ? copy.heroImpactSupportCompetitive
      : rawImpactSummary;
  const frOnlyImpactSummary = locale === "fr" ? impactSummary?.trim() || null : null;
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
  const rawMarketReliabilityTitle =
    typeof payload.market?.reliabilityTitle === "string" && payload.market.reliabilityTitle.trim()
      ? payload.market.reliabilityTitle.trim()
      : marketReliabilityDerived.reliabilityTitle;
  const marketReliabilityTitle =
    rawMarketReliabilityTitle === "Marché exploitable"
      ? copy.marketReliabilityTitleUsable
      : rawMarketReliabilityTitle === "Lecture limitée"
        ? copy.marketReliabilityTitleLimited
        : rawMarketReliabilityTitle === "Marché local peu exploitable"
          ? copy.marketReliabilityTitleLow
          : rawMarketReliabilityTitle === "Base locale limitée"
            ? copy.marketReliabilityTitleWeakFallback
            : locale === "fr"
              ? rawMarketReliabilityTitle
              : copy.marketReliabilityTitleWeakFallback;
  const marketReliabilityBadge =
    typeof payload.market?.reliabilityBadge === "string" && payload.market.reliabilityBadge.trim()
      ? payload.market.reliabilityBadge.trim()
      : marketReliabilityDerived.reliabilityBadge;
  const rawMarketReliabilityMessage =
    typeof payload.market?.reliabilityMessage === "string" && payload.market.reliabilityMessage.trim()
      ? payload.market.reliabilityMessage.trim()
      : marketReliabilityDerived.reliabilityMessage;
  const marketReliabilityMessage =
    rawMarketReliabilityMessage === "Base marché exploitable avec plusieurs comparables cohérents."
      ? copy.marketReliabilityMessageHigh
      : rawMarketReliabilityMessage ===
          "Analyse basée sur un échantillon local limité. Les recommandations restent utiles, mais les estimations marché doivent être lues avec prudence."
        ? copy.marketReliabilityMessageMedium
        : rawMarketReliabilityMessage ===
            "Aucun comparable local suffisamment fiable n’a été trouvé pour cette lecture. L’audit reste utile pour la qualité de l’annonce, mais les estimations marché et pricing doivent rester indicatives."
          ? copy.marketReliabilityMessageLow
          : rawMarketReliabilityMessage ===
              "Les comparables retenus sont proches géographiquement mais seulement partiellement comparables sur la typologie ou la capacité. Les estimations marché et le positionnement tarifaire restent indicatifs."
            ? copy.marketReliabilityMessageWeakFallback
            : locale === "fr"
              ? rawMarketReliabilityMessage
              : copy.marketReliabilityMessageWeakFallback;
  const marketSourceQuality =
    payload.market?.marketSourceQuality === "cross_platform_fallback"
      ? "cross_platform_fallback"
      : "native";
  const marketSourceLabel =
    typeof payload.market?.marketSourceLabel === "string" && payload.market.marketSourceLabel.trim()
      ? payload.market.marketSourceLabel.trim()
      : marketSourceQuality === "cross_platform_fallback"
        ? copy.marketSourceLabelCrossPlatform
        : null;
  const marketSourceMessage =
    marketSourceQuality === "cross_platform_fallback"
      ? copy.marketSourceMessageCrossPlatform
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
  const marketIndicativeLabel = copy.marketIndicativeLabel;
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
      ? copy.marketCompetitorPricesDispersed
      : null;

  const rawMarketSummaryText = market.message?.trim() || "";
  const marketSummaryText =
    rawMarketSummaryText === "Cette annonce se situe globalement dans la moyenne des concurrents proches." ||
    /broadly in line with nearby competitors/i.test(rawMarketSummaryText) ||
    /se sitúa globalmente en la media de los competidores cercanos/i.test(rawMarketSummaryText)
      ? copy.marketPositionNarrativeCompetitive
      : rawMarketSummaryText === "Cette annonce semble plus performante que la moyenne locale à proximité."
        ? copy.marketPositionNarrativeAbove
        : rawMarketSummaryText === "Cette annonce semble plus faible que la moyenne locale à proximité."
          ? copy.marketPositionNarrativeBelow
          : rawMarketSummaryText === "Aucun concurrent proche n’a encore été analysé pour cet audit."
            ? copy.marketPositionNarrativeNoComparables
            : locale === "fr"
              ? rawMarketSummaryText || copy.marketAnalysisPending
              : copy.marketAnalysisPending;
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
        ? copy.marketPricePositionWellAbove
        : priceDeltaPercentResolved > 0
          ? copy.marketPricePositionSlightlyAbove
          : priceDeltaPercentResolved < -8
            ? copy.marketPricePositionBelow
            : priceDeltaPercentResolved < 0
              ? copy.marketPricePositionSlightlyBelow
              : copy.marketPricePositionAligned
      : copy.marketPricePositionPending;
  const priceDeltaIndicativeText = hasIndicativePriceDeltaSample
    ? copy.priceDeltaIndicativeSample
    : null;
  const marketRatingScale =
    String(listing?.source_platform ?? "").toLowerCase() === "booking"
      ? 10
      : 5;

  const marketRatingContext =
    market.avgCompetitorRating !== null
      ? copy.marketAverageRatingObserved
          .replace("{value}", market.avgCompetitorRating.toFixed(1))
          .replace("{scale}", String(marketRatingScale))
      : copy.marketAverageRatingUnavailable;
  const lqiAvailableComponents = [
    lqiScore,
    lqiListingQuality,
    lqiMarketCompetitiveness,
    lqiConversionPotential,
  ].filter((value) => value !== null).length;
  const rawLqiSummaryText = listingQualityIndex?.summary?.trim() || "";
  const lqiSummaryText =
    (rawLqiSummaryText === auditDetailCopy.fr.lqiSummaryCompetitiveButOptimizable
      ? copy.lqiSummaryCompetitiveButOptimizable
      : locale === "fr"
        ? rawLqiSummaryText
        : "") ||
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

  const isLegacyHeroImpactSupportCompetitive = Object.values(auditDetailCopy).some(
    (localizedCopy) =>
      impactSummary?.trim() === localizedCopy.heroImpactSupportCompetitive
  );

  const impactBusinessBlockIntro =
    locale === "fr"
      ? businessUiLowConfidenceGuardActive
        ? copy.impactBusinessBlockIntroOutOfSegment
        : isLegacyHeroImpactSupportCompetitive
          ? copy.heroImpactSupportCompetitive
          : impactSummary?.trim() ||
            copy.impactBusinessBlockIntroDefault
      : businessUiLowConfidenceGuardActive
        ? copy.impactBusinessBlockIntroOutOfSegment
        : isLegacyHeroImpactSupportCompetitive
          ? copy.heroImpactSupportCompetitive
          : copy.impactBusinessBlockIntroDefault;
  const bookingLiftPercentValueDisplay =
    businessUiLowConfidenceGuardActive && !allowConversionOnlyRevenueProjection
      ? "—"
      : bookingLiftHigh > 0
        ? copy.bookingLiftRange
            .replace("{low}", `+${bookingLiftLow.toFixed(0)}%`)
            .replace("{high}", `+${bookingLiftHigh.toFixed(0)}%`)
        : bookingLiftHigh > 0
          ? copy.potentialToConfirm
          : "—";
  const bookingLiftCardBody =
    locale === "fr"
      ? allowConversionOnlyRevenueProjection
        ? copy.conversionGainFromScoreAndPrice
        : businessUiLowConfidenceGuardActive
          ? copy.conversionGainOutOfSegment
        : !hasMarketData && bookingLiftHigh > 0
          ? copy.conversionGainPendingRange
          : bookingLiftSummary?.trim() ||
            (bookingLiftHigh > 0
              ? copy.conversionGainEstimated
              : copy.conversionGainNoRange)
      : allowConversionOnlyRevenueProjection
        ? copy.conversionGainFromScoreAndPrice
        : businessUiLowConfidenceGuardActive
          ? copy.conversionGainOutOfSegment
        : !hasMarketData && bookingLiftHigh > 0
          ? copy.conversionGainPendingRange
          : bookingLiftHigh > 0
            ? copy.conversionGainEstimated
            : copy.conversionGainNoRange;
  const currentPriceContext =
    currentListingPrice !== null
      ? hasMarketData && avgCompetitorPriceResolved !== null
        ? copy.currentPriceContextCompareMarket.replace(
            "{value}",
            revenueFormatter.format(avgCompetitorPriceResolved)
          )
        : copy.currentPriceContextDetected
      : marketReferenceNightlyPrice != null
        ? copy.currentPriceContextMarketReference.replace(
            "{value}",
            revenueFormatter.format(marketReferenceNightlyPrice)
          )
        : copy.currentPriceContextMissing;
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
      : locale === "fr"
        ? rawMarketPositionNarrative || marketSummaryText
        : marketSummaryText;
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
        ? copy.competitorCountSupportAvailable
        : copy.competitorCountSupportNone
      : marketPositionNarrative
      ? copy.competitorCountSupportPending
      : copy.competitorCountSupportPartial;
  const comparablesKpiMainDisplay =
    marketComparableDisplayCount === null
      ? copy.comparablesKpiLimited
      : marketComparableDisplayCount === 0
        ? copy.comparablesKpiNone
        : marketComparableDisplayCount === 1
          ? copy.comparablesKpiOne
          : marketComparableDisplayCount === 2
            ? copy.comparablesKpiTwo
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
    ? copy.lqiPartialIndex
    : copy.lqiToConsolidate;
  const lqiScoreDisplay =
    lqiScore !== null
      ? `${lqiScore} / 100`
      : lqiAvailableComponents > 0
      ? `${lqiAvailableComponents}/4 signaux`
      : "À consolider";
  const avgCompetitorPriceDisplay = !hasMarketData
    ? copy.insufficientData
    : avgCompetitorPriceResolved !== null
      ? revenueFormatter.format(avgCompetitorPriceResolved)
      : marketIndicativeLabel;

  const avgCompetitorPriceSupport = !hasMarketData
    ? copy.avgCompetitorPriceSupportInsufficient
    : avgCompetitorPriceResolved !== null
      ? isMarketWeak
        ? copy.avgCompetitorPriceSupportLimited
        : copy.avgCompetitorPriceSupportObserved
      : copy.avgCompetitorPriceSupportPending;
  const priceDeltaDisplay =
    priceDeltaPercentResolved !== null
      ? `${priceDeltaPercentResolved > 0 ? "+" : ""}${priceDeltaPercentResolved.toFixed(0)}%`
      : !canResolvePriceDeltaSample
        ? copy.priceDeltaInsufficientSample
        : copy.priceDeltaUnavailable;
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
              : copy.priceDeltaPending,
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
      : copy.currentPriceUnavailable;
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
      ? copy.revenueImpactRangeDisplay
          .replace("{current}", revenueFormatter.format(Math.round(currentMonthlyRevenueBase)))
          .replace("{low}", revenueFormatter.format(monthlyOptimizedRevenueLowRounded))
          .replace("{high}", revenueFormatter.format(monthlyOptimizedRevenueHighRounded))
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
          ? copy.revenueImpactRangeDisplay
              .replace("{current}", revenueFormatter.format(Math.round(currentMonthlyRevenueBase)))
              .replace("{low}", revenueFormatter.format(monthlyOptimizedRevenueLowRounded))
              .replace("{high}", revenueFormatter.format(monthlyOptimizedRevenueHighRounded))
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
      ? copy.monthlyGainQualifierLimited.replace("{value}", marketIndicativeLabel)
      : null,
    hasMarketData &&
      monthlyGainBusinessModelReady &&
      revenueMarketDataFragile
      ? copy.monthlyGainQualifierFragile
      : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join(" ");

  const localizedMissingAmenities =
    locale === "fr"
      ? localizeGeneratedList(missingAmenities)
      : missingAmenities
          .map((item) => item.trim())
          .filter(Boolean);

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
    if (!auditId || aiOutputPlatform !== "airbnb" || loading || !audit) {
      return;
    }

    const requestKey = JSON.stringify({
      auditId,
      locale,
      title: listing?.title ?? null,
      location: locationLabel ?? null,
      description: listing?.description ?? null,
      amenities: listing?.amenities ?? [],
      platform: listing?.source_platform ?? null,
      photoOrderSuggestions,
      photoOrderTextSignals,
    });

    if (aiAirbnbDescriptionRequestKeyRef.current !== requestKey) {
      if (aiAirbnbDescriptionVariants.length > 0) {
        setAiAirbnbDescriptionVariants([]);
      }
      setGenerationSeed((current) => (current === 0 ? current : 0));
      setAiAirbnbDescriptionFailed(false);
      setIsAiAirbnbDescriptionLoading(false);
      aiAirbnbDescriptionPendingRef.current = false;
      aiAirbnbDescriptionRequestKeyRef.current = null;
    }

    if (
      aiAirbnbDescriptionRequestKeyRef.current === requestKey &&
      (aiAirbnbDescriptionPendingRef.current || aiAirbnbDescriptionVariants.length > 0)
    ) {
      return;
    }

    aiAirbnbDescriptionRequestKeyRef.current = requestKey;
    aiAirbnbDescriptionPendingRef.current = true;
    if (aiAirbnbDescriptionVariants.length > 0) {
      setAiAirbnbDescriptionVariants([]);
    }
    setGenerationSeed((current) => (current === 0 ? current : 0));
    setAiAirbnbDescriptionFailed(false);
    setIsAiAirbnbDescriptionLoading(true);

    let mounted = true;
    let timerFired = false;
    const timer = window.setTimeout(() => {
      timerFired = true;
      void loadAiAirbnbDescriptions();
    }, 700);

    async function loadAiAirbnbDescriptions() {
      try {
        const {
          data: { session },
        } = await getSharedSession();

        if (!session?.access_token) {
          if (mounted && aiAirbnbDescriptionRequestKeyRef.current === requestKey) {
            aiAirbnbDescriptionPendingRef.current = false;
            aiAirbnbDescriptionRequestKeyRef.current = null;
            setIsAiAirbnbDescriptionLoading(false);
            setAiAirbnbDescriptionFailed(false);
          }
          return;
        }

        const response = await fetch(`/api/audits/${auditId}/airbnb-description`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          cache: "no-store",
          body: JSON.stringify({
            currentTitle: listing?.title ?? null,
            location: locationLabel ?? null,
            description: listing?.description ?? null,
            amenities: listing?.amenities ?? [],
            visualSignals: [...photoOrderTextSignals, ...photoOrderSuggestions],
            platform: listing?.source_platform ?? null,
            locale,
          }),
        });

        if (!response.ok) {
          if (mounted && aiAirbnbDescriptionRequestKeyRef.current === requestKey) {
            aiAirbnbDescriptionPendingRef.current = false;
            aiAirbnbDescriptionRequestKeyRef.current = null;
            setAiAirbnbDescriptionFailed(true);
            setIsAiAirbnbDescriptionLoading(false);
          }
          return;
        }

        const data = (await response.json().catch(() => null)) as {
          variants?: Array<Partial<AiVariant>>;
        } | null;

        const isCompactAiDescriptionLocale = ["ja", "zh", "ko"].includes(locale);
        const minAiMainLength = isCompactAiDescriptionLocale ? 55 : 120;
        const minAiSectionLength = isCompactAiDescriptionLocale ? 35 : 80;
        const minAiSmallSectionLength = isCompactAiDescriptionLocale ? 25 : 40;

        const variants = Array.isArray(data?.variants)
          ? data.variants
              .map((variant) => ({
                main: typeof variant.mainAirbnb === "string" ? variant.mainAirbnb : "",
                mainAirbnb: typeof variant.mainAirbnb === "string" ? variant.mainAirbnb : "",
                mainBooking: typeof variant.mainAirbnb === "string" ? variant.mainAirbnb : "",
                logement: typeof variant.logement === "string" ? variant.logement : "",
                logementDetaille:
                  typeof variant.logementDetaille === "string" ? variant.logementDetaille : "",
                acces: typeof variant.acces === "string" ? variant.acces : "",
                echanges: typeof variant.echanges === "string" ? variant.echanges : "",
                autresInfos: typeof variant.autresInfos === "string" ? variant.autresInfos : "",
              }))
              .filter(
                (variant) =>
                  variant.mainAirbnb.trim().length >= minAiMainLength &&
                  variant.logement.trim().length >= minAiSectionLength &&
                  variant.logementDetaille.trim().length >= minAiSectionLength &&
                  variant.acces.trim().length >= minAiSmallSectionLength &&
                  variant.echanges.trim().length >= minAiSmallSectionLength &&
                  variant.autresInfos.trim().length >= minAiSmallSectionLength
              )
              .slice(0, 5)
          : [];

        if (!mounted || aiAirbnbDescriptionRequestKeyRef.current !== requestKey) {
          if (aiAirbnbDescriptionRequestKeyRef.current === requestKey) {
            aiAirbnbDescriptionPendingRef.current = false;
            aiAirbnbDescriptionRequestKeyRef.current = null;
            setIsAiAirbnbDescriptionLoading(false);
          }
          return;
        }

        setAiAirbnbDescriptionVariants(variants);
        setAiAirbnbDescriptionFailed(variants.length === 0);
        setIsAiAirbnbDescriptionLoading(false);
        aiAirbnbDescriptionPendingRef.current = false;
        if (variants.length === 0) {
          aiAirbnbDescriptionRequestKeyRef.current = null;
        }
      } catch (error) {
        if (mounted && aiAirbnbDescriptionRequestKeyRef.current === requestKey) {
          setAiAirbnbDescriptionFailed(true);
          setIsAiAirbnbDescriptionLoading(false);
          aiAirbnbDescriptionPendingRef.current = false;
          aiAirbnbDescriptionRequestKeyRef.current = null;
        }
        console.warn("[audit-page][airbnb-description-ai] fallback_to_local", error);
      }
    }

    return () => {
      mounted = false;
      window.clearTimeout(timer);
      if (
        !timerFired &&
        aiAirbnbDescriptionRequestKeyRef.current === requestKey &&
        aiAirbnbDescriptionPendingRef.current === true
      ) {
        aiAirbnbDescriptionPendingRef.current = false;
        aiAirbnbDescriptionRequestKeyRef.current = null;
        setIsAiAirbnbDescriptionLoading(false);
      }
    };
  }, [
    auditId,
    aiOutputPlatform,
    aiAirbnbDescriptionVariants.length,
    audit,
    loading,
    locale,
    listing?.amenities,
    listing?.description,
    listing?.source_platform,
    listing?.title,
    locationLabel,
    photoOrderSuggestionsKey,
    photoOrderTextSignalsKey,
  ]);

  useEffect(() => {
    if (!auditId || loading || !audit) {
      if (aiOptimizedTitles.length > 0) {
        setAiOptimizedTitles([]);
      }
      return;
    }

    const requestKey = JSON.stringify({
      auditId,
      locale,
      title: listing?.title ?? null,
      location: locationLabel ?? null,
      description: listing?.description ?? null,
      amenities: listing?.amenities ?? [],
      platform: listing?.source_platform ?? null,
    });

    if (aiOptimizedTitleRequestKeyRef.current !== requestKey) {
      if (aiOptimizedTitles.length > 0) {
        setAiOptimizedTitles([]);
      }
      setGenerationSeed((current) => (current === 0 ? current : 0));
      setAiOptimizedTitleFailed(false);
    }

    if (
      aiOptimizedTitleRequestKeyRef.current === requestKey &&
      (aiOptimizedTitlePendingRef.current || aiOptimizedTitles.length > 0)
    ) {
      return;
    }

    aiOptimizedTitleRequestKeyRef.current = requestKey;
    setAiOptimizedTitleFailed(false);

    let mounted = true;
    const timer = window.setTimeout(() => {
      void loadAiOptimizedTitles();
    }, 600);

    async function loadAiOptimizedTitles() {
      try {
        const {
          data: { session },
        } = await getSharedSession();

        if (!session?.access_token) {
          if (mounted && aiOptimizedTitleRequestKeyRef.current === requestKey) {
            aiOptimizedTitlePendingRef.current = false;
            aiOptimizedTitleRequestKeyRef.current = null;
            setAiOptimizedTitleFailed(false);
          }
          return;
        }

        aiOptimizedTitlePendingRef.current = true;
        const response = await fetch(`/api/audits/${auditId}/optimized-title`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          cache: "no-store",
          body: JSON.stringify({
            currentTitle: listing?.title ?? null,
            location: locationLabel ?? null,
            description: listing?.description ?? null,
            amenities: listing?.amenities ?? [],
            visualSignals: [...photoOrderTextSignals, ...photoOrderSuggestions],
            platform: listing?.source_platform ?? null,
            locale,
          }),
        });

        if (!response.ok) {
          if (mounted && aiOptimizedTitleRequestKeyRef.current === requestKey) {
            aiOptimizedTitlePendingRef.current = false;
            aiOptimizedTitleRequestKeyRef.current = null;
            setAiOptimizedTitleFailed(true);
          }
          return;
        }

        const data = (await response.json().catch(() => null)) as {
          variants?: unknown[];
        } | null;

        const isCompactOptimizedTitleLocale = ["ja", "zh", "ko"].includes(locale);
        const minTitleLength = isCompactOptimizedTitleLocale ? 4 : 12;

        const variants = Array.isArray(data?.variants)
          ? data.variants
              .map((variant) => (typeof variant === "string" ? variant.trim() : ""))
              .filter(
                (variant, index, array) =>
                  variant.length >= minTitleLength && array.indexOf(variant) === index
              )
              .slice(0, 5)
          : [];

        if (!mounted || aiOptimizedTitleRequestKeyRef.current !== requestKey) {
          return;
        }
        setAiOptimizedTitles(variants);
        setAiOptimizedTitleFailed(variants.length === 0);
        aiOptimizedTitlePendingRef.current = false;
        if (variants.length === 0) {
          aiOptimizedTitleRequestKeyRef.current = null;
        }
      } catch (error) {
        setAiOptimizedTitleFailed(true);
        aiOptimizedTitlePendingRef.current = false;
        aiOptimizedTitleRequestKeyRef.current = null;
        console.warn("[audit-page][optimized-title-ai] fallback_to_local", error);
      }
    }

    return () => {
      mounted = false;
      window.clearTimeout(timer);
    };
  }, [
    auditId,
    aiOptimizedTitles.length,
    audit,
    loading,
    listing?.amenities,
    listing?.description,
    listing?.source_platform,
    listing?.title,
    locale,
    locationLabel,
    photoOrderSuggestions,
    photoOrderTextSignals,
  ]);

  useEffect(() => {
    if (!auditId || aiOutputPlatform !== "booking" || loading || !audit) {
      if (aiBookingDescriptions.length > 0) {
        setAiBookingDescriptions([]);
      }
      return;
    }

    const requestKey = JSON.stringify({
      auditId,
      locale,
      title: listing?.title ?? null,
      location: locationLabel ?? null,
      amenities: listing?.amenities ?? [],
      platform: listing?.source_platform ?? null,
      photoOrderSuggestionsKey,
      photoOrderTextSignalsKey,
    });

    const previousRequestKey = aiBookingDescriptionRequestKeyRef.current;

    if (previousRequestKey !== requestKey) {
      aiBookingDescriptionRequestKeyRef.current = requestKey;
      setAiBookingDescriptions([]);
      setGenerationSeed((current) => (current === 0 ? current : 0));
    }

    if (previousRequestKey === requestKey && aiBookingDescriptions.length > 0) {
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
        } = await getSharedSession();

        if (!session?.access_token) {
          return;
        }


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
            locale,
          }),
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json().catch(() => null)) as {
          variants?: Array<{ label?: string; description?: string }>;
        } | null;

        const variants = Array.isArray(data?.variants)
          ? data.variants
              .map((variant) => ({
                label: typeof variant.label === "string" ? variant.label : "",
                description: typeof variant.description === "string" ? variant.description : "",
              }))
              .filter((variant) => variant.description.trim().length >= 120)
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
    locale,
    locationLabel,
    photoOrderSuggestionsKey,
    photoOrderTextSignalsKey,
  ]);

  const fallbackAiDescriptionVariants = aiDescriptionVariants;
  const shouldUseAirbnbLocalFallback =
    aiOutputPlatform === "airbnb" ? locale === "fr" : true;
  const shouldUseAirbnbFallbackNow =
    aiOutputPlatform === "airbnb" &&
    shouldUseAirbnbLocalFallback &&
    aiAirbnbDescriptionVariants.length === 0 &&
    !isAiAirbnbDescriptionLoading &&
    aiAirbnbDescriptionFailed &&
    fallbackAiDescriptionVariants.length > 0;
  const airbnbAiStateMessage =
    aiOutputPlatform === "airbnb" &&
    aiAirbnbDescriptionVariants.length === 0 &&
    !shouldUseAirbnbFallbackNow
      ? isAiAirbnbDescriptionLoading
        ? copy.aiGeneratingDescription
        : aiAirbnbDescriptionFailed
          ? copy.aiDescriptionFailed
          : locale !== "fr"
            ? copy.aiDescriptionUnavailable
            : null
      : null;

  const activeAiDescriptionVariants =
    aiOutputPlatform === "airbnb"
      ? aiAirbnbDescriptionVariants.length > 0
        ? aiAirbnbDescriptionVariants
        : shouldUseAirbnbFallbackNow
          ? fallbackAiDescriptionVariants
          : []
      : aiBookingDescriptions.length > 0
        ? fallbackAiDescriptionVariants
        : fallbackAiDescriptionVariants;

  const currentAiVariant =
    activeAiDescriptionVariants[generationSeed % activeAiDescriptionVariants.length] ?? {
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
  const bookingDescriptionSummarySource =
    aiOutputPlatform === "booking" && aiBookingDescription
      ? aiBookingDescription
      : currentAiVariant.mainBooking;

  const aiDescription =
    (aiOutputPlatform === "airbnb"
      ? currentAiVariant.mainAirbnb
      : aiBookingDescription || currentAiVariant.mainBooking) ||
    currentAiVariant.main;

  const optimizedTitleProvenance: AiTextProvenance =
    aiOptimizedTitles.length > 0 ? "ai" : "fallback";
  const aiDescriptionProvenance: AiTextProvenance | null =
    aiOutputPlatform === "airbnb"
      ? aiAirbnbDescriptionVariants.length > 0
        ? "ai"
        : shouldUseAirbnbFallbackNow
          ? "fallback"
          : null
      : aiBookingDescriptions.length > 0
        ? "ai"
        : "fallback";
  const optimizedTitleProvenanceBadge = getAiTextProvenanceBadge(optimizedTitleProvenance, copy);
  const aiDescriptionProvenanceBadge =
    aiDescriptionProvenance != null
      ? getAiTextProvenanceBadge(aiDescriptionProvenance, copy)
      : null;
  const currentAiVariantIndex =
    activeAiDescriptionVariants.length > 0
      ? (generationSeed % activeAiDescriptionVariants.length) + 1
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

  const fallbackOptimizedTitleExample = useMemo(
    () =>
      buildOptimizedTitleExample({
        title: listing?.title ?? null,
        location: locationLabel ?? null,
        amenities: listing?.amenities ?? null,
        description: listing?.description ?? null,
        displayPlatform: aiOutputPlatform,
        variantIndex:
          activeAiDescriptionVariants.length > 0
            ? generationSeed % activeAiDescriptionVariants.length
            : 0,
        variantCount: activeAiDescriptionVariants.length,
        fallbackSuggestedTitle: textSuggestions.suggestedTitle,
        visualSignals: [...photoOrderTextSignals, ...photoOrderSuggestions],
      }),
    [
      activeAiDescriptionVariants.length,
      aiOutputPlatform,
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

  const shouldHideOptimizedTitleFallback =
    aiOptimizedTitles.length === 0 && !aiOptimizedTitleFailed;

  const optimizedTitleExample = useMemo(
    () =>
      aiOptimizedTitles.length > 0
        ? aiOptimizedTitles[generationSeed % aiOptimizedTitles.length] || fallbackOptimizedTitleExample
        : aiOptimizedTitleFailed
          ? fallbackOptimizedTitleExample
          : copy.aiGeneratingTitle,
    [
      aiOptimizedTitles,
      aiOptimizedTitleFailed,
      fallbackOptimizedTitleExample,
      generationSeed,
      copy.aiGeneratingTitle,
    ]
  );

  const bookingSectionsReadySummary = useMemo(
    () =>
      buildBookingSectionsReadySummary(
        bookingDescriptionSummarySource,
        copy.bookingSummaryFallback,
      ),
    [
      bookingDescriptionSummarySource,
      copy.bookingSummaryFallback,
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
  const localizedCompetitorGaps =
    locale === "fr"
      ? localizeGeneratedList(competitorSummary.keyGaps)
      : competitorSummary.keyGaps
          .map((item) => item.trim())
          .filter(Boolean);
  const competitorGapsUsesContentFallback = false;
  /** Complément hors fenêtres des cartes « Points faibles » (5 premiers) et « Principaux écarts » (5 premiers) ; dédup simple. */
  const lossBlockFrictionItems: Array<{ text: string; source: "annonce" | "marché" }> = (() => {
    const annonceBase = weaknesses.length > 0 ? weaknesses : resolvedWeaknesses;
    const localizedAnnonceBaseForFriction =
      locale === "fr"
        ? localizeGeneratedList(annonceBase)
        : annonceBase.map((item) => item.trim()).filter(Boolean);
    const primaryWeaknessLabels = new Set(
      localizedAnnonceBaseForFriction
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
      annonceBase.length > 5 ? localizedAnnonceBaseForFriction.slice(5, 8) : [];
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
  const localizedCompetitorAdvantages =
    locale === "fr"
      ? localizeGeneratedList(competitorSummary.keyAdvantages)
      : competitorSummary.keyAdvantages
          .map((item) => item.trim())
          .filter(Boolean);
  const competitorAdvantagesUsesContentFallback = false;
  const localizedTargetVsMarketPosition =
    locale === "fr"
      ? localizeGeneratedText(competitorSummary.targetVsMarketPosition) || ""
      : competitorSummary.targetVsMarketPosition.trim();
  const normalizedTargetVsMarketPosition =
    /annonce se situe globalement dans la moyenne des concurrents proches/i.test(localizedTargetVsMarketPosition) ||
    /broadly in line with nearby competitors/i.test(localizedTargetVsMarketPosition) ||
    /se sitúa globalmente en la media de los competidores cercanos/i.test(localizedTargetVsMarketPosition)
      ? copy.marketPositionNarrativeCompetitive
      : localizedTargetVsMarketPosition;
  const positionnementNarrativeUi = !hasMarketData
    ? copy.marketAnalysisPending
    : normalizedTargetVsMarketPosition || marketSummaryText;
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
    value !== null
      ? copy.actionScoreLineWithValue
          .replace("{label}", label)
          .replace("{value}", String(value))
      : copy.actionScoreLinePending.replace("{label}", label);

  const enrichImprovementNarrative = (item: AuditActionItem) => {
    const text = `${item.title ?? ""} ${item.description ?? ""} ${item.reason ?? ""}`.toLowerCase();

    if (/description|texte|contenu|rédaction|redaction|storytelling|promesse/.test(text)) {
      return {
        description: `${scoreLine(copy.actionLabelDescription, descriptionQuality)} ${copy.actionNarrativeDescription}`,
        reason: copy.actionReasonDescription,
      };
    }

    if (/seo|titre|mot.?clé|recherche|visibilité|visibilite|référencement|referencement/.test(text)) {
      return {
        description: `${scoreLine(copy.actionLabelSeo, seoStrength)} ${copy.actionNarrativeSeo}`,
        reason: copy.actionReasonSeo,
      };
    }

    if (/pricing|tarif|prix|comparables|benchmark|segment tarifaire/.test(text)) {
      return {
        description: `${scoreLine(copy.actionLabelPricing, marketScore)} ${copy.actionNormalizedDescriptionPricingCompare}`,
        reason:
          comparableCount !== null && comparableCount > 0
            ? copy.actionReasonMarketComparables.replace("{count}", String(comparableCount))
            : copy.actionReasonPricing,
      };
    }

    if (/photo|visuel|image|galerie|ordre|couverture/.test(text)) {
      return {
        description: `${scoreLine(copy.actionLabelPhotos, photoQuality)} ${copy.actionNarrativePhotos}`,
        reason: copy.actionReasonPhotos,
      };
    }

    if (/équipement|equipement|amenit|confort|wifi|piscine|parking|clim/.test(text)) {
      return {
        description: `${scoreLine(copy.actionLabelAmenities, amenitiesCompleteness)} ${copy.actionNarrativeAmenities}`,
        reason: copy.actionReasonAmenities,
      };
    }

    if (/conversion|réservation|reservation|confiance|rassur|frein|friction/.test(text)) {
      return {
        description: `${scoreLine(copy.actionLabelConversion, conversionStrength)} ${copy.actionNarrativeConversion}`,
        reason: copy.actionReasonConversion,
      };
    }

    return {
      description:
        locale === "fr"
          ? localizeGeneratedText(item.description) || copy.actionNarrativeFallback
          : (typeof item.description === "string" ? item.description.trim() : "") ||
            copy.actionNarrativeFallback,
      reason:
        typeof item.reason === "string"
          ? locale === "fr"
            ? localizeGeneratedText(item.reason)
            : item.reason.trim()
          : item.reason,
    };
  };

  const resolveNonFrenchActionPlanTitle = (item: AuditActionItem, index: number) => {
    if (item.source !== "action_plan" || locale === "fr") {
      return null;
    }

    switch (item.id) {
      case "description-opening":
        return copy.actionNormalizedTitleClarify;
      case "description-specificity":
        return copy.actionNormalizedTitleConcreteValue;
      case "trust-clarity":
      case "trust-social-proof":
        return copy.actionNormalizedTitleBuildTrust;
      case "pricing-gap":
      case "pricing-data":
        return copy.actionNormalizedTitleAnalyzePricingGap;
      case "photo-signal":
      case "photo-order":
        return copy.actionLabelPhotos;
      case "amenities-visibility":
        return copy.actionLabelAmenities;
      case "seo-title":
        return copy.actionLabelSeo;
      default:
        switch (item.category) {
          case "photos":
            return copy.actionLabelPhotos;
          case "description":
            return copy.actionNormalizedTitleClarify;
          case "amenities":
            return copy.actionLabelAmenities;
          case "seo":
            return copy.actionLabelSeo;
          case "trust":
            return copy.actionNormalizedTitleBuildTrust;
          case "pricing":
            return copy.actionNormalizedTitleAnalyzePricingGap;
          default:
            return copy.actionImprovementFallback.replace("{index}", String(index + 1));
        }
    }
  };

  const factualStrengthSignals = [
    photoQuality !== null && photoQuality >= 8
      ? copy.auditStrengthPhotos.replace("{score}", String(photoQuality))
      : null,
    photoOrder !== null && photoOrder >= 8
      ? copy.auditStrengthPhotoOrder.replace("{score}", String(photoOrder))
      : null,
    descriptionQuality !== null && descriptionQuality >= 8
      ? copy.auditStrengthDescription.replace("{score}", String(descriptionQuality))
      : null,
    amenitiesCompleteness !== null && amenitiesCompleteness >= 8
      ? copy.auditStrengthAmenities.replace("{score}", String(amenitiesCompleteness))
      : null,
    seoStrength !== null && seoStrength >= 8
      ? copy.auditStrengthSeo.replace("{score}", String(seoStrength))
      : null,
    conversionStrength !== null && conversionStrength >= 8
      ? copy.auditStrengthConversion.replace("{score}", String(conversionStrength))
      : null,
  ].filter((item): item is string => typeof item === "string" && item.trim().length > 0);

  const factualWeakSignals = [
    descriptionQuality !== null && descriptionQuality < 7
      ? copy.auditWeakDescription.replace("{score}", String(descriptionQuality))
      : null,
    seoStrength !== null && seoStrength < 7
      ? copy.auditWeakSeo.replace("{score}", String(seoStrength))
      : null,
    conversionStrength !== null && conversionStrength < 7
      ? copy.auditWeakConversion.replace("{score}", String(conversionStrength))
      : null,
    amenitiesCompleteness !== null && amenitiesCompleteness < 7
      ? copy.auditWeakAmenities.replace("{score}", String(amenitiesCompleteness))
      : null,
    photoQuality !== null && photoQuality < 7
      ? copy.auditWeakPhotoQuality.replace("{score}", String(photoQuality))
      : null,
    photoOrder !== null && photoOrder < 7
      ? copy.auditWeakPhotoOrder.replace("{score}", String(photoOrder))
      : null,
  ].filter((item): item is string => typeof item === "string" && item.trim().length > 0);

  const normalizeActionPlanTitle = (value: string) => {
    const normalized = value.trim();

    if (normalized === auditDetailCopy.fr.actionNormalizedTitleClarify) {
      return copy.actionNormalizedTitleClarify;
    }
    if (normalized === auditDetailCopy.fr.actionNormalizedTitleConcreteValue) {
      return copy.actionNormalizedTitleConcreteValue;
    }
    if (normalized === auditDetailCopy.fr.actionNormalizedTitleAnalyzePricingGap) {
      return copy.actionNormalizedTitleAnalyzePricingGap;
    }
    if (normalized === auditDetailCopy.fr.actionNormalizedTitleBuildTrust) {
      return copy.actionNormalizedTitleBuildTrust;
    }

    return value;
  };

  const normalizeActionPlanReason = (value: string) => {
    const normalized = value.trim();

    if (normalized === auditDetailCopy.fr.actionReasonAmenities) {
      return copy.actionReasonAmenities;
    }
    if (normalized === auditDetailCopy.fr.actionReasonConversion) {
      return copy.actionReasonConversion;
    }
    const marketComparablesMatch = normalized.match(
      /^(\d+) annonce\(s\) comparable\(s\) utilisée\(s\) pour lire le marché\.$/i
    );
    if (marketComparablesMatch) {
      return copy.actionReasonMarketComparables.replace("{count}", marketComparablesMatch[1] ?? "0");
    }

    return value;
  };

  const normalizeActionPlanDescription = (value: string) => {
    const normalized = value.trim();

    if (normalized === auditDetailCopy.fr.actionNormalizedDescriptionPricingCompare) {
      return copy.actionNormalizedDescriptionPricingCompare;
    }

    return value;
  };

  const localizedImprovements = improvements.map((item, index) => {
    const enriched = enrichImprovementNarrative(item);
    const localizedTitle =
      locale === "fr"
        ? localizeGeneratedText(item.title)
        : typeof item.title === "string"
          ? item.title.trim()
          : "";
    const localizedDescription = enriched.description;
    const localizedReason =
      typeof enriched.reason === "string"
        ? locale === "fr"
          ? normalizeActionPlanReason(enriched.reason)
          : enriched.reason.trim()
        : enriched.reason;
    const nonFrenchActionPlanTitle = resolveNonFrenchActionPlanTitle(item, index);

    return {
      ...item,
      title:
        locale === "fr"
          ? (localizedTitle ? normalizeActionPlanTitle(localizedTitle) : localizedTitle) ||
            copy.actionImprovementFallback.replace("{index}", String(index + 1))
          : item.source === "action_plan"
            ? nonFrenchActionPlanTitle ||
              copy.actionImprovementFallback.replace("{index}", String(index + 1))
            : localizedTitle ||
              copy.actionImprovementFallback.replace("{index}", String(index + 1)),
      description:
        locale === "fr"
          ? normalizeActionPlanDescription(localizedDescription)
          : localizedDescription,
      reason: localizedReason,
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
        return copy.bookingLiftRange
          .replace("{low}", fmt(lo))
          .replace("{high}", fmt(hi));
      }
      return copy.bookingLiftUpTo.replace("{value}", fmt(hi));
    }

    if (heroBookingLiftPctFromPotential !== null) {
      return copy.bookingLiftUpTo.replace("{value}", fmt(heroBookingLiftPctFromPotential));
    }

    const ceilingLift = bookingLiftHigh > 0 ? bookingLiftHigh : null;
    if (ceilingLift !== null && ceilingLift > 0) {
      return copy.bookingLiftUpTo.replace("{value}", fmt(ceilingLift));
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
    locale === "fr"
      ? businessUiLowConfidenceGuardActive
        ? copy.heroImpactSupportOutOfSegment
        : isLegacyHeroImpactSupportCompetitive
          ? copy.heroImpactSupportCompetitive
          : impactSummary?.trim() ||
            copy.heroImpactSupportDefault
      : businessUiLowConfidenceGuardActive
        ? copy.heroImpactSupportOutOfSegment
        : isLegacyHeroImpactSupportCompetitive
          ? copy.heroImpactSupportCompetitive
          : copy.heroImpactSupportDefault;
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
      ? copy.scoreSideCardNarrativeLow
      : overallScore < 7
        ? copy.scoreSideCardNarrativeMedium
        : copy.heroScoreNarrativeStrong;
  /** Carte latérale « Impact estimé » : % dès qu’au moins un comparable alimente la lecture marché. */
  const impactEstimatedSideShowPercent =
    (!businessUiLowConfidenceGuardActive || allowConversionOnlyRevenueProjection) &&
    bookingLiftHigh > 0;
  const impactSideCardNarrative =
    allowConversionOnlyRevenueProjection
      ? copy.heroBusinessLiftHintPrudent
      : businessUiLowConfidenceGuardActive
        ? copy.impactSideCardNarrativeOutOfMarket
      : !hasMarketData && bookingLiftHigh > 0
        ? copy.impactSideCardNarrativeMarketPending
      : bookingLiftHigh > 0
          ? copy.impactSideCardNarrativeCondensed.replace(
              "{label}",
              copy.conversionGainPotential
            )
        : locale === "fr"
          ? bookingLiftSummary?.trim() ||
            frOnlyImpactSummary ||
            copy.impactSideCardNarrativeNoRange
          : copy.impactSideCardNarrativeNoRange;
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
        ? copy.lqiNoteUnavailable
        : lqiListingQualityIsNative
        ? lqiListingQuality >= 75
          ? copy.lqiNoteListingNativeHigh
          : copy.lqiNoteListingNativeModerate
        : lqiListingQuality >= 75
        ? copy.lqiNoteListingLocalHigh
        : copy.lqiNoteListingLocalFallback,
    market:
      lqiMarketCompetitiveness === null
        ? copy.lqiNoteUnavailable
        : lqiMarketCompetitivenessIsNative
        ? lqiMarketCompetitiveness >= 80
          ? copy.lqiNoteMarketNativeHigh
          : lqiMarketCompetitiveness >= 60
            ? copy.lqiNoteMarketNativeModerate
            : copy.lqiNoteMarketNativeLow
        : lqiMarketCompetitiveness >= 75
        ? copy.lqiNoteMarketLocalHigh
        : copy.lqiNoteMarketLocalFallback,
    conversion:
      lqiConversionPotential === null
        ? copy.lqiNoteConversionUnavailable
        : lqiConversionIsNative
        ? lqiConversionPotential >= 75
          ? copy.lqiNoteConversionNativeHigh
          : lqiConversionPotential >= 55
            ? copy.lqiNoteConversionNativeModerate
            : copy.lqiNoteConversionNativeLow
        : copy.lqiNoteConversionLocalFallback,
  };
  const actionPlanIntro =
    localizedImprovements.length > 0
      ? aiGenerationStyle === "airbnb"
        ? copy.actionPlanIntroAttractiveness
        : copy.actionPlanIntroConversion
      : aiGenerationStyle === "airbnb"
        ? copy.actionPlanIntroStorytelling
        : copy.actionPlanIntroDefault;
  const prioritizedActionsIntro =
    localizedImprovements.length > 0
      ? aiGenerationStyle === "airbnb"
        ? copy.prioritizedActionsIntroAirbnb
        : copy.prioritizedActionsIntroDefault
      : copy.prioritizedActionsIntroEmpty;
  const prioritizedActionsSubline =
    aiGenerationStyle === "airbnb"
      ? copy.prioritizedActionsSublineAirbnb
      : copy.prioritizedActionsSublineDefault;
  const strengthsFallbackText =
    resolvedStrengths[0] ||
    insights[0] ||
    localizedTargetVsMarketPosition ||
    (aiGenerationStyle === "airbnb"
      ? copy.strengthsFallbackAirbnb
      : copy.strengthsFallbackDefault);
  const hasStructuredWeaknessLines =
    (weaknesses.length > 0 ? weaknesses : resolvedWeaknesses).length > 0;
  const weaknessesFallbackText = !hasStructuredWeaknessLines
    ? insightSignals.length > 0 && weaknesses.length === 0
      ? weaknessListInsightDerived
        ? copy.weaknessesFallbackInsightIsolated
        : copy.weaknessesFallbackInsightStructured
      : aiGenerationStyle === "airbnb"
      ? copy.weaknessesFallbackNoStructuredAirbnb
      : copy.weaknessesFallbackNoStructuredDefault
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
      setActionToast(copy.noDescriptionToCopy);
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
      setActionToast(copy.noTextToCopy);
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
      copy.suggestedTextCopied,
      copy.noTextToCopy
    );
  };

  const handleNextAiVariant = () => {
    setGenerationSeed((current) => current + 1);
    setActionToast(copy.newVariantReady);
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
                ? copy.outOfMarketSegmentShort
                : impactEstimatedSideShowPercent
                  ? copy.estimatedBookingsAfterOptimization
                  : bookingLiftHigh > 0
                    ? copy.percentAfterMarketConsolidation
                    : copy.estimatedBookingsAfterOptimization}
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
                    ? copy.pricingInsightUnderpriced.replace(
                        "{value}",
                        Math.abs(Math.round(pricingInsightForUi.priceDeltaPercent * 10) / 10).toLocaleString("fr-FR")
                      )
                    : pricingInsightForUi.status === "OPTIMAL"
                      ? copy.pricingInsightOptimal.replace(
                          "{value}",
                          (Math.round(pricingInsightForUi.priceDeltaPercent * 10) / 10).toLocaleString("fr-FR")
                        )
                      : copy.pricingInsightOverpriced.replace(
                          "{value}",
                          Math.abs(Math.round(pricingInsightForUi.priceDeltaPercent * 10) / 10).toLocaleString("fr-FR")
                        )}
                </p>
                {isMarketWeak ? (
                  <p className="mt-3 text-[10px] leading-snug text-slate-600">
                    {copy.pricingIndicativeCaution.replace("{value}", marketIndicativeLabel)}
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
                  {copy.pricingBenchmarksDescription}
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
                        : copy.priceDeltaPending}
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
                  {copy.estimatedImpactOnBookings}
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
                    ? copy.projectionBaseNoComparable
                    : marketConfidenceLevel === "high"
                      ? copy.projectionBaseRobust.replace(
                          "{count}",
                          String(marketComparableDisplayCount)
                        )
                      : marketConfidenceLevel === "medium"
                        ? copy.projectionBasePartial.replace(
                            "{count}",
                            String(marketComparableDisplayCount)
                          )
                        : copy.projectionBaseUnstable}
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
                    ? copy.conversionGainLowConfidence
                    : allowConversionOnlyRevenueProjection
                      ? copy.conversionGainFromScoreAndPrice
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
                    ? copy.monthlyGainOutOfSegment
                    : allowConversionOnlyRevenueProjection
                      ? copy.cautiousProjection
                    : !hasMarketData
                        ? copy.monthlyGainUnavailable
                        : monthlyOptimizedRevenueBandDisplayable
                        ? copy.heroRevenueSupportIndicative
                        : monthlyGainBusinessModelReady
                          ? copy.heroRevenueSupportPrudent
                          : copy.monthlyGainNeedsStableMarket}
                </p>
                {monthlyGainHypothesisLine ? (
                  <p className="mt-2 text-[10px] leading-snug text-slate-600">{monthlyGainHypothesisLine}</p>
                ) : null}
                {monthlyGainQualifierLine ? (
                  <p className="mt-2 text-[10px] font-medium leading-snug text-amber-900/85">
                    {monthlyGainQualifierLine}
                  </p>
                ) : null}
                {locale === "fr" && hasMarketData && revenueImpactSummary && !businessUiLowConfidenceGuardActive ? (
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
                      {copy.optimizedTextVariantLabel
                        .replace("{index}", String(currentAiVariantIndex))
                        .replace(
                          "{label}",
                          [
                            copy.optimizedTextVariantNameComfort,
                            copy.optimizedTextVariantNamePractical,
                            copy.optimizedTextVariantNameNeighborhood,
                            copy.optimizedTextVariantNamePremium,
                            copy.optimizedTextVariantNameBusiness,
                          ][
                            (((currentAiVariantIndex - 1) % AI_VARIANT_LABELS.length) + AI_VARIANT_LABELS.length) %
                              AI_VARIANT_LABELS.length
                          ],
                        )}
                    </span>
                  </div>
                  <p className="mt-6 text-[11px] leading-5 text-slate-800">
                    {airbnbAiStateMessage ?? copy.optimizedTextIntro}
                  </p>
                  <p className="mt-4 text-[10px] font-medium tracking-[0.04em] text-slate-500">
                    {copy.optimizedTextVariantCounter
                      .replace("{index}", String(currentAiVariantIndex))
                      .replace("{total}", String(activeAiDescriptionVariants.length))}
                  </p>
                </div>

                <div className="relative flex flex-wrap items-center gap-2 sm:gap-3 lg:col-span-5 lg:justify-end xl:col-span-4">
                  {aiDescriptionProvenanceBadge ? (
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.08em] ${aiDescriptionProvenanceBadge.className}`}
                    >
                      {aiDescriptionProvenanceBadge.label}
                    </span>
                  ) : null}
                  {aiBookingStyleSourceLabel != null ? (
                    <span
                      className="inline-flex max-w-[min(100%,240px)] shrink-0 items-center rounded-full border border-amber-200/70 bg-white/65 px-2 py-0.5 text-[8px] font-medium leading-tight tracking-[0.03em] text-slate-600 shadow-[0_6px_14px_rgba(180,83,9,0.05)]"
                      title={copy.detectedSourceTitle.replace("{value}", aiBookingStyleSourceLabel)}
                    >
                      {copy.bookingVariantBadge.replace("{value}", aiBookingStyleSourceLabel)}
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
                        {listing?.title || copy.missingListingTitle}
                      </p>
                    </div>

                    <div className={`flex h-full min-w-0 overflow-hidden flex-col ${detailInnerCard} border-l-4 !border-emerald-200/75 !border-l-emerald-500/75 !bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_40%),linear-gradient(180deg,#ecfdf5_0%,#d1fae5_100%)]`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className={detailCardLabel}>
                            {copy.optimizedTitleExample}
                          </p>
                          <span
                            className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.08em] ${optimizedTitleProvenanceBadge.className}`}
                          >
                            {optimizedTitleProvenanceBadge.label}
                          </span>
                        </div>

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
                  placeholder={copy.aiDescriptionPlaceholder}
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
                    {currentAiVariant.logement || airbnbAiStateMessage || copy.aiFallbackHousing}
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
                    {currentAiVariant.logementDetaille || airbnbAiStateMessage || copy.aiFallbackDetailedHousing}
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
                    {currentAiVariant.acces || airbnbAiStateMessage || copy.aiFallbackGuestAccess}
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
                    {currentAiVariant.echanges || airbnbAiStateMessage || copy.aiFallbackGuestInteraction}
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
                    {currentAiVariant.autresInfos || airbnbAiStateMessage || copy.aiFallbackOtherInfo}
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
                        copy.bookingSummaryCopied,
                        copy.noBookingSummary
                      )
                    }
                    className={aiCardCopyButtonClass}
                  >
                    <svg aria-hidden="true" className="h-3 w-3" viewBox="0 0 16 16" fill="none">
                      <path d="M5.5 5.5H4.25A1.25 1.25 0 0 0 3 6.75v5A1.25 1.25 0 0 0 4.25 13h5A1.25 1.25 0 0 0 10.5 11.75V10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      <path d="M6.25 3h5.5C12.44 3 13 3.56 13 4.25v5.5C13 10.44 12.44 11 11.75 11h-5.5C5.56 11 5 10.44 5 9.75v-5.5C5 3.56 5.56 3 6.25 3Z" stroke="currentColor" strokeWidth="1.4" />
                    </svg>
                    {copy.copyAction}
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
                                {copy.actionSignalLabel}: {item.reason}
                              </p>
                            )}
                          </div>
                          <span className={`${pillBaseClass} ${impactClass(item.impact)}`}>
                            {(item.impact ?? "medium") === "high"
                              ? copy.actionImpactHigh
                              : (item.impact ?? "medium") === "low"
                              ? copy.actionImpactLow
                              : copy.actionImpactMedium}
                          </span>
                        </div>
                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          <div className="rounded-xl border border-white/70 bg-white/65 px-3 py-2">
                            <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                              {copy.actionScoreLabel}
                            </p>
                            <p className="mt-1 text-[11px] font-semibold leading-4 text-slate-900">
                              {scorePart || copy.actionSignalFallback}
                            </p>
                          </div>

                          <div className="rounded-2xl border border-white/70 bg-white/70 p-3">
                            <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                              {copy.actionObjectiveLabel}
                            </p>
                            <p className="mt-1 text-[11px] leading-4 text-slate-700">
                              {objectiveText || copy.actionObjectiveFallback}
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
                      {copy.actionEmptyState}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {lossBlockFrictionItems.length > 0 ? (
              <div className={`nk-card nk-card-hover relative overflow-hidden ${radiusContainer} border border-l-4 border-rose-200/80 border-l-rose-500/75 ${surfaceCritical} !bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.14),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,241,242,0.92)_100%)] ${cardGlow} p-5 xl:col-span-12 ${shadowEmphasis}`}>
                <div className="flex items-center justify-between gap-5">
                  <p className="text-[16px] font-semibold tracking-[-0.02em] text-slate-900 md:text-[18px]">
                    {copy.reportFrictionSignalsTitle}
                  </p>
                </div>
                <p className="mt-6 text-[12px] leading-5 text-slate-800">
                  {copy.reportFrictionSignalsSubtitle}
                </p>
                <div className="mt-6 grid items-stretch gap-5 md:gap-5 md:grid-cols-2">
                  {lossBlockFrictionItems.map((item, index) => (
                    <div
                      key={`${item.source}-${index}-${item.text.slice(0, 48)}`}
                      className={`relative overflow-hidden ${radiusCard} border border-l-4 border-rose-200/70 border-l-rose-500/75 bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.10),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(244,63,94,0.08),transparent_28%),linear-gradient(180deg,#ffffff_0%,#fff3f5_100%)] p-3 ${shadowMini} ring-1 ring-white/60`}
                    >
                      <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-rose-700">
                        {item.source === "annonce" ? copy.listingBadge : copy.market}
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
                  {copy.auditLeversDetailTitle}
                </div>
                <dl className="space-y-4 text-[12px] leading-5">
                  <div className={`relative overflow-hidden flex items-center justify-between gap-5 ${radiusCard} border border-l-4 border-blue-200/70 border-l-blue-500/75 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(239,246,255,0.92)_100%)] px-3.5 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.055),0_1px_0_rgba(255,255,255,0.64)_inset] ring-1 ring-white/60`}>
                    <dt className="text-slate-900">{copy.photoQuality}</dt>
                    <dd>
                      <span className={`${pillBaseClass} ${scoreBadgeClass(photoQuality)}`}>
                        {photoQuality !== null ? `${photoQuality}/10` : copy.toConfirm}
                      </span>
                    </dd>
                  </div>
                  <div className={`relative overflow-hidden flex items-center justify-between gap-5 ${radiusCard} border border-l-4 border-indigo-200/70 border-l-indigo-500/75 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(238,242,255,0.92)_100%)] px-3.5 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.055),0_1px_0_rgba(255,255,255,0.64)_inset] ring-1 ring-white/60`}>
                    <dt className="text-slate-900">{copy.photoOrderQuality}</dt>
                    <dd>
                      <span className={`${pillBaseClass} ${scoreBadgeClass(photoOrder)}`}>
                        {photoOrder !== null ? `${photoOrder}/10` : copy.toConfirm}
                      </span>
                    </dd>
                  </div>
                  <div className={`relative overflow-hidden flex items-center justify-between gap-5 ${radiusCard} border border-l-4 border-violet-200/70 border-l-violet-500/75 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(245,243,255,0.92)_100%)] px-3.5 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.055),0_1px_0_rgba(255,255,255,0.64)_inset] ring-1 ring-white/60`}>
                    <dt className="text-slate-900">{copy.descriptionQualityLabel}</dt>
                    <dd>
                      <span className={`${pillBaseClass} ${scoreBadgeClass(descriptionQuality)}`}>
                        {descriptionQuality !== null ? `${descriptionQuality}/10` : copy.toConfirm}
                      </span>
                    </dd>
                  </div>
                  <div className={`relative overflow-hidden flex items-center justify-between gap-5 ${radiusCard} border border-l-4 border-emerald-200/70 border-l-emerald-500/75 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(236,253,245,0.92)_100%)] px-3.5 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.055),0_1px_0_rgba(255,255,255,0.64)_inset] ring-1 ring-white/60`}>
                    <dt className="text-slate-900">{copy.amenitiesCompletenessLabel}</dt>
                    <dd>
                      <span className={`${pillBaseClass} ${scoreBadgeClass(amenitiesCompleteness)}`}>
                        {amenitiesCompleteness !== null ? `${amenitiesCompleteness}/10` : copy.toConfirm}
                      </span>
                    </dd>
                  </div>
                  <div className={`relative overflow-hidden flex items-center justify-between gap-5 ${radiusCard} border border-l-4 border-cyan-200/70 border-l-cyan-500/75 bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(236,254,255,0.92)_100%)] px-3.5 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.055),0_1px_0_rgba(255,255,255,0.64)_inset] ring-1 ring-white/60`}>
                    <dt className="text-slate-900">{copy.seoPerformance}</dt>
                    <dd>
                      <span className={`${pillBaseClass} ${scoreBadgeClass(seoStrength)}`}>
                        {seoStrength !== null ? `${seoStrength}/10` : copy.toConfirm}
                      </span>
                    </dd>
                  </div>
                  <div className={`relative overflow-hidden flex items-center justify-between gap-5 ${radiusCard} border border-l-4 border-orange-200/70 border-l-orange-500/75 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,247,237,0.92)_100%)] px-3.5 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.055),0_1px_0_rgba(255,255,255,0.64)_inset] ring-1 ring-white/60`}>
                    <dt className="text-slate-900">{copy.listingConversion}</dt>
                    <dd>
                      <span className={`${pillBaseClass} ${scoreBadgeClass(conversionStrength)}`}>
                        {conversionStrength !== null ? `${conversionStrength}/10` : copy.toConfirm}
                      </span>
                    </dd>
                  </div>
                </dl>
              </div>

              <div className={`nk-card nk-card-hover relative flex h-full min-w-0 overflow-hidden flex-col ${radiusCard} border !border-l-[5px] border-emerald-200/80 !border-l-emerald-600 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.36),transparent_42%),linear-gradient(180deg,#d1fae5_0%,#a7f3d0_100%)] ${cardGlow} p-4 ${shadowEmphasis}`}>
                <div className={`mb-2 ${detailCardLabel}`}>
                  {copy.auditStrengthsTitle}
                </div>
                <p className="mb-2 text-[10px] leading-snug text-slate-600">
                  {copy.auditStrengthsSource}
                </p>
                <ul className={`${detailCardList} list-disc pl-4 text-slate-800 marker:text-emerald-500 marker:font-semibold`}>
                  {factualStrengthSignals.length > 0 ? (
                    factualStrengthSignals.slice(0, 5).map((item, index) => <li key={index}>{item}</li>)
                  ) : (
                    <li className={detailCardBody}>
                      {copy.auditStrengthsEmpty}
                    </li>
                  )}
                </ul>
              </div>

              <div className={`nk-card nk-card-hover relative flex h-full min-w-0 overflow-hidden flex-col ${radiusCard} border !border-l-[5px] border-rose-200/80 !border-l-rose-500 bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.36),transparent_42%),linear-gradient(180deg,#ffe4e6_0%,#fda4af_100%)] ${cardGlow} p-4 ${shadowEmphasis}`}>
                <div className={`mb-2 ${detailCardLabel}`}>
                  {copy.auditWeaknessesTitle}
                </div>
                <p className="mb-2 text-[10px] leading-snug text-slate-600">
                  {copy.auditWeaknessesSource}
                </p>
                <ul className={`${detailCardList} list-disc pl-4 text-slate-800 marker:text-amber-500 marker:font-semibold`}>
                  {factualWeakSignals.length > 0 ? (
                    factualWeakSignals.slice(0, 5).map((item, index) => <li key={index}>{item}</li>)
                  ) : (
                    <li className={detailCardBody}>
                      {copy.auditWeaknessesEmpty}
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
                  {copy.mainMarketGapsTitle}
                </p>
                {competitorGapsUsesContentFallback ? (
                  <p className="mt-2 text-[10px] leading-snug text-slate-600">
                    {copy.fallbackNarrativeFromWeaknesses}
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
                      {copy.mainMarketGapsEmpty}
                    </li>
                  )}
                </ul>
              </div>

              <div className={`nk-card nk-card-hover relative flex h-full min-w-0 overflow-hidden flex-col ${radiusCard} border !border-l-[5px] border-emerald-200/75 !border-l-emerald-600 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.34),transparent_42%),linear-gradient(180deg,#d1fae5_0%,#a7f3d0_100%)] ${cardGlow} p-4 ${shadowEmphasis}`}>
                <p className={detailCardLabel}>
                  {copy.mainMarketAdvantagesTitle}
                </p>
                {competitorAdvantagesUsesContentFallback ? (
                  <p className="mt-2 text-[10px] leading-snug text-slate-600">
                    {copy.fallbackNarrativeFromStrengths}
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
                      {copy.mainMarketAdvantagesEmpty}
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
                {copy.missingAmenitiesChecklistTitle}
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
                {copy.nextStepTitle}
              </h2>
              <p className="mt-6 text-[12px] leading-5 text-slate-700">
                {copy.nextStepDescription}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 md:shrink-0">
              <Link
                href="/dashboard/listings/new"
                className="inline-flex items-center justify-center rounded-lg border border-blue-500/30 bg-[linear-gradient(135deg,#3b82f6_0%,#06b6d4_52%,#7c3aed_100%)] px-6 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-white shadow-[0_14px_32px_rgba(59,130,246,0.30),0_1px_0_rgba(255,255,255,0.16)_inset] transition hover:brightness-110"
              >
                {copy.nextStepRunAudit}
              </Link>
              <Link
                href="/dashboard/audits"
                className="inline-flex items-center justify-center rounded-lg border border-blue-500/30 bg-[linear-gradient(135deg,#3b82f6_0%,#06b6d4_52%,#7c3aed_100%)] px-6 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-white shadow-[0_14px_32px_rgba(59,130,246,0.30),0_1px_0_rgba(255,255,255,0.16)_inset] transition hover:brightness-110"
              >
                {copy.nextStepBackToAudits}
              </Link>
              <Link
                href="/dashboard/listings"
                className="inline-flex items-center justify-center rounded-lg border border-blue-500/30 bg-[linear-gradient(135deg,#3b82f6_0%,#06b6d4_52%,#7c3aed_100%)] px-6 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-white shadow-[0_14px_32px_rgba(59,130,246,0.30),0_1px_0_rgba(255,255,255,0.16)_inset] transition hover:brightness-110"
              >
                {copy.nextStepAnalyzeAnother}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
