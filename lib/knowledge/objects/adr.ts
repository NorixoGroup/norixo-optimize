import type { KnowledgeObject } from "../types";

export const averageDailyRateKnowledgeObject: KnowledgeObject = {
  identity: {
    canonicalId: "metrics.average-daily-rate",
    canonicalName: "Average Daily Rate",
    slug: "average-daily-rate",
    aliases: ["average booked nightly revenue"],
    abbreviations: ["ADR"],
    translations: {
      en: { canonicalName: "Average Daily Rate", aliases: ["ADR"] },
      fr: { canonicalName: "tarif journalier moyen", aliases: ["ADR"] },
    },
    parentConcepts: [
      { canonicalId: "domains.revenue-metrics", rationale: "ADR is a revenue-performance metric." },
    ],
    childConcepts: [],
    siblingConcepts: [],
    relatedConcepts: [
      { canonicalId: "metrics.occupancy-rate", rationale: "ADR requires occupancy context." },
      {
        canonicalId: "metrics.revenue-per-available-rental-night",
        rationale: "RevPAR combines achieved rate with availability.",
      },
    ],
    status: "validated",
    version: "1.0.0",
    owner: "Norixo research team",
    reviewDate: "2026-07-24",
    evidenceLevel: "E3",
  },
  definition: {
    shortDefinition: "Accommodation revenue earned per booked night during a consistent measurement period.",
    longDefinition:
      "Average Daily Rate measures accommodation revenue divided by booked nights. It is useful for analysing the rate achieved on nights that were reserved, provided the revenue definition and time period remain consistent.",
    purpose: "Describe the achieved revenue rate on booked nights.",
    scope: ["Accommodation revenue", "Booked nights", "Consistent measurement periods"],
    outOfScope: ["Occupancy", "Revenue per available night", "Operating costs", "Net margin"],
    commonMisunderstandings: [
      "ADR is not the same as the displayed nightly price.",
      "A high ADR does not by itself indicate stronger total performance.",
    ],
    terminologyNotes: ["Provider revenue inclusions can differ."],
    calculationRelevance: "ADR = accommodation revenue ÷ booked nights.",
    businessRelevance: "Supports pricing analysis when interpreted with occupancy and RevPAR.",
    unitsAndDimensions: ["Currency per booked night"],
    formulaReferences: ["ADR = accommodation revenue ÷ booked nights"],
    formulas: [
      {
        id: "direct-revenue-per-booked-night",
        role: "primary_definition",
        expression: "ADR = accommodation revenue ÷ booked nights",
        inputCanonicalIds: ["revenue.accommodation-revenue", "inventory.booked-nights"],
        outputUnit: "currency_per_booked_night",
        executionStatus: "reference_only",
      },
    ],
    conventionVariants: [
      "Cleaning fees may be included or excluded depending on the selected convention.",
      "Taxes, deposits, and commissions must be treated consistently across comparisons.",
    ],
  },
  evidence: {
    primarySources: [
      {
        title: "AirDNA: How does AirDNA calculate average daily rate (ADR)?",
        url: "https://help.airdna.co/en/articles/8062173-how-does-airdna-calculate-average-daily-rate-adr",
        sourceType: "primary",
        supports: ["ADR definition", "Revenue component convention"],
      },
    ],
    secondarySources: [
      {
        title: "PriceLabs: Portfolio Analytics terminology",
        url: "https://help.pricelabs.co/portal/en/kb/articles/portfolio-analytics-terminology",
        sourceType: "secondary",
        supports: ["Provider revenue convention differences"],
      },
    ],
    internalMethodologyReferences: [
      {
        title: "Norixo KPI calculator calculation convention",
        identifier: "app/(default)/tools/[tool]/page.tsx",
        sourceType: "internal",
        supports: ["Norixo calculator convention"],
      },
    ],
    confidence: "High for the stated formula; provider conventions remain variable.",
    lastValidation: "2026-07-24",
    citationRules: [
      "Cite provider-specific revenue inclusions or exclusions close to the claim.",
      "Label Norixo’s convention as a convention, not a universal standard.",
    ],
    externalReferences: [],
    internalReferences: ["/tools/airbnb-adr-calculator", "/articles/airbnb-adr"],
    limitations: ["Does not measure occupancy, available-night revenue, cost, or margin."],
    contradictoryEvidence: ["Providers can use different definitions of included revenue."],
  },
  relationships: {
    requires: [
      { canonicalId: "revenue.accommodation-revenue", rationale: "Numerator of the ADR formula." },
      { canonicalId: "inventory.booked-nights", rationale: "Denominator of the ADR formula." },
    ],
    dependsOn: [
      { canonicalId: "revenue.accommodation-revenue", rationale: "Revenue convention affects the result." },
      { canonicalId: "inventory.booked-nights", rationale: "Booked-night convention affects the result." },
    ],
    relatedTo: [],
    oftenConfusedWith: [
      { canonicalId: "metrics.revenue-per-available-rental-night", rationale: "Different denominator." },
    ],
    opposite: [],
    derivedFrom: [
      { canonicalId: "revenue.accommodation-revenue", rationale: "Numerator of the ADR formula." },
      { canonicalId: "inventory.booked-nights", rationale: "Denominator of the ADR formula." },
    ],
    uses: [],
    usedBy: [
      {
        canonicalId: "metrics.revenue-per-available-rental-night",
        rationale: "RevPAR can be expressed as ADR multiplied by occupancy.",
      },
    ],
    calculatorReferences: ["/tools/airbnb-adr-calculator"],
    guideReferences: ["/guides/airbnb-pricing-optimization"],
    articleReferences: ["/articles/airbnb-adr"],
    researchReferences: ["/research/methodology"],
    apiReferences: [],
  },
  editorialProjections: [
    {
      type: "calculator",
      identifier: "airbnb-adr-calculator",
      canonicalUrl: "/tools/airbnb-adr-calculator",
      status: "published",
      purpose: "Calculate ADR from accommodation revenue and booked nights.",
    },
    {
      type: "article",
      identifier: "airbnb-adr",
      canonicalUrl: "/articles/airbnb-adr",
      status: "published",
      purpose: "Provide editorial explanation of ADR.",
    },
    {
      type: "guide",
      identifier: "airbnb-pricing-optimization",
      canonicalUrl: "/guides/airbnb-pricing-optimization",
      status: "published",
      purpose: "Provide pricing strategy context.",
    },
    {
      type: "research",
      identifier: "research-methodology",
      canonicalUrl: "/research/methodology",
      status: "published",
      purpose: "Provide methodology context for public data artifacts.",
    },
  ],
  structuredKnowledge: {
    canonicalUrls: ["/tools/airbnb-adr-calculator", "/articles/airbnb-adr"],
    entity: "Average Daily Rate",
    entityType: "performance_metric",
    schemaSuitability: "applicable",
    schemaTypes: ["WebApplication"],
    searchIntent: "Understand and calculate ADR.",
    primaryKeyword: "Airbnb ADR",
    secondaryKeywords: ["average daily rate", "booked nightly revenue"],
    semanticKeywords: ["occupancy", "RevPAR", "accommodation revenue", "booked nights"],
    searchStage: "understanding",
    localeCoverage: { en: "available", fr: "planned" },
    internalImportance: "critical",
    externalLinkability: "reference_worthy",
    retrievalEligibility: "eligible",
    apiEligibility: "pending_design",
  },
  internalLinking: {
    requiredInboundLinks: ["/tools", "/articles/airbnb-adr"],
    requiredOutboundLinks: [
      "/tools/airbnb-occupancy-calculator",
      "/tools/airbnb-revpar-calculator",
      "/guides/airbnb-pricing-optimization",
    ],
    anchorGuidance: ["Use descriptive, non-repetitive KPI anchors."],
    canonicalDestinations: ["/tools/airbnb-adr-calculator", "/articles/airbnb-adr"],
    linkRationales: ["Connect rate achieved with occupancy and revenue per available night."],
    duplicationGuard: "Link once per user need and avoid repeated exact-match anchors.",
    projectionSpecificRules: ["The calculator remains canonical for formula execution."],
  },
  quality: {
    requiredChecks: ["Definition", "Evidence", "Relationships", "Projection routes"],
    validationRecord: "2026-07-24",
    privacyReview: "not_applicable",
    translationReview: "required",
    structuredDataReview: "passed",
  },
  lifecycle: {
    stateHistory: [
      { status: "draft", date: "2026-07-24", reason: "Initial canonical object created." },
      { status: "validated", date: "2026-07-24", reason: "Contract and relationships reviewed." },
    ],
    reviewFrequency: "Annual or after a material provider-convention change.",
    versionHistory: ["1.0.0"],
    breakingChangePolicy: "Create a major version for formula or scope changes.",
    ownershipTransferHistory: [],
  },
};
