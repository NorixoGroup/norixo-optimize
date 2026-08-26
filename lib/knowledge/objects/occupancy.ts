import type { KnowledgeObject } from "../types";

export const occupancyRateKnowledgeObject: KnowledgeObject = {
  identity: {
    canonicalId: "metrics.occupancy-rate",
    canonicalName: "Occupancy Rate",
    slug: "occupancy-rate",
    aliases: ["occupancy"],
    abbreviations: [],
    translations: {
      en: { canonicalName: "Occupancy Rate", aliases: ["occupancy"] },
      fr: { canonicalName: "taux d’occupation", aliases: ["occupation"] },
    },
    parentConcepts: [
      { canonicalId: "domains.inventory-metrics", rationale: "Occupancy measures inventory utilisation." },
    ],
    childConcepts: [],
    siblingConcepts: [],
    relatedConcepts: [
      { canonicalId: "metrics.average-daily-rate", rationale: "Rate and occupancy require joint interpretation." },
      {
        canonicalId: "metrics.revenue-per-available-rental-night",
        rationale: "RevPAR includes occupancy in its formula.",
      },
    ],
    status: "validated",
    version: "1.0.0",
    owner: "Norixo research team",
    reviewDate: "2026-07-24",
    evidenceLevel: "E3",
  },
  definition: {
    shortDefinition: "The percentage of available nights that were booked during a consistent measurement period.",
    longDefinition:
      "Occupancy Rate divides booked nights by available nights. Its meaning depends on the availability convention used, particularly the treatment of blocked nights, owner stays, and maintenance closures.",
    purpose: "Describe the proportion of inventory treated as available that converted into bookings.",
    scope: ["Booked nights", "Available nights", "Availability convention"],
    outOfScope: ["Nightly rate", "Revenue", "Costs", "Profitability"],
    commonMisunderstandings: [
      "High occupancy does not necessarily indicate high profitability.",
      "Blocked dates and booked dates are not interchangeable.",
    ],
    terminologyNotes: ["Available-night definitions vary across providers and reporting contexts."],
    calculationRelevance: "Occupancy rate = booked nights ÷ available nights × 100.",
    businessRelevance: "Shows calendar utilisation and helps interpret ADR and RevPAR.",
    unitsAndDimensions: ["Percentage of available nights"],
    formulaReferences: ["Occupancy rate = booked nights ÷ available nights × 100"],
    formulas: [
      {
        id: "booked-nights-per-available-nights",
        role: "primary_definition",
        expression: "Occupancy rate = booked nights ÷ available nights × 100",
        inputCanonicalIds: ["inventory.booked-nights", "inventory.available-nights"],
        outputUnit: "percentage_of_available_nights",
        executionStatus: "reference_only",
      },
    ],
    conventionVariants: [
      "Some analyses exclude voluntarily unavailable nights.",
      "Other analyses use full calendar inventory or alternative adjusted occupancy definitions.",
    ],
  },
  evidence: {
    primarySources: [
      {
        title: "HSMAI: Occupancy glossary",
        url: "https://academy.hsmai.org/glossary/occupancy/",
        sourceType: "primary",
        supports: ["Hotel-standard occupancy terminology"],
      },
      {
        title: "AirDNA: How does AirDNA calculate occupancy rate?",
        url: "https://help.airdna.co/en/articles/8062178-how-does-airdna-calculate-occupancy-rate",
        sourceType: "primary",
        supports: ["Occupancy definition", "Blocked-night treatment"],
      },
      {
        title: "Airbnb: Manage your calendar",
        url: "https://www.airbnb.com/resources/hosting-homes/a/manage-your-calendar-654",
        sourceType: "primary",
        supports: ["Platform calendar availability and blocked-date controls"],
      },
    ],
    secondarySources: [
      {
        title: "PriceLabs: Report Builder metrics",
        url: "https://help.pricelabs.co/portal/en/kb/articles/a-complete-guide-to-report-builder-metrics",
        sourceType: "secondary",
        supports: ["Occupancy convention variants"],
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
    confidence: "High for the stated formula; availability conventions remain variable.",
    lastValidation: "2026-07-24",
    citationRules: [
      "Cite blocked-night treatment and provider-specific availability conventions.",
      "Cite HSMAI only for hotel-standard occupancy terminology.",
      "Cite Airbnb only for platform calendar availability and blocked-date controls.",
      "Do not present one availability convention as universal.",
    ],
    externalReferences: [],
    internalReferences: ["/tools/airbnb-occupancy-calculator", "/articles/airbnb-occupancy-rate"],
    limitations: [
      "Does not measure achieved rate, revenue, operating cost, or profit.",
      "A higher occupancy rate is not automatically better and there is no universal target.",
    ],
    contradictoryEvidence: ["Providers can use different availability denominators."],
  },
  relationships: {
    requires: [
      { canonicalId: "inventory.booked-nights", rationale: "Numerator of the occupancy formula." },
      { canonicalId: "inventory.available-nights", rationale: "Denominator of the occupancy formula." },
    ],
    dependsOn: [
      { canonicalId: "inventory.booked-nights", rationale: "Booked-night convention affects the result." },
      { canonicalId: "inventory.available-nights", rationale: "Availability convention affects the result." },
    ],
    relatedTo: [],
    oftenConfusedWith: [
      {
        canonicalId: "metrics.revenue-per-available-rental-night",
        rationale: "Occupancy measures utilisation, not revenue per available night.",
      },
    ],
    opposite: [],
    derivedFrom: [
      { canonicalId: "inventory.booked-nights", rationale: "Numerator of the occupancy formula." },
      { canonicalId: "inventory.available-nights", rationale: "Denominator of the occupancy formula." },
    ],
    uses: [],
    usedBy: [
      {
        canonicalId: "metrics.revenue-per-available-rental-night",
        rationale: "RevPAR can be expressed as ADR multiplied by occupancy.",
      },
    ],
    calculatorReferences: ["/tools/airbnb-occupancy-calculator"],
    guideReferences: ["/guides/airbnb-revenue-optimization"],
    articleReferences: ["/articles/airbnb-occupancy-rate"],
    researchReferences: ["/research/methodology"],
    apiReferences: [],
  },
  editorialProjections: [
    {
      type: "calculator",
      identifier: "airbnb-occupancy-calculator",
      canonicalUrl: "/tools/airbnb-occupancy-calculator",
      status: "published",
      purpose: "Calculate occupancy from booked and available nights.",
    },
    {
      type: "article",
      identifier: "airbnb-occupancy-rate",
      canonicalUrl: "/articles/airbnb-occupancy-rate",
      status: "published",
      purpose: "Provide editorial explanation of occupancy.",
    },
    {
      type: "guide",
      identifier: "airbnb-revenue-optimization",
      canonicalUrl: "/guides/airbnb-revenue-optimization",
      status: "published",
      purpose: "Provide revenue strategy context.",
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
    canonicalUrls: ["/tools/airbnb-occupancy-calculator", "/articles/airbnb-occupancy-rate"],
    entity: "Occupancy Rate",
    entityType: "performance_metric",
    schemaSuitability: "applicable",
    schemaTypes: ["WebApplication"],
    searchIntent: "Understand and calculate occupancy rate.",
    primaryKeyword: "Airbnb occupancy rate",
    secondaryKeywords: ["available nights", "booked nights"],
    semanticKeywords: ["ADR", "RevPAR", "blocked nights", "owner stays"],
    searchStage: "understanding",
    localeCoverage: { en: "available", fr: "planned" },
    internalImportance: "critical",
    externalLinkability: "reference_worthy",
    retrievalEligibility: "eligible",
    apiEligibility: "pending_design",
  },
  internalLinking: {
    requiredInboundLinks: ["/tools", "/articles/airbnb-occupancy-rate"],
    requiredOutboundLinks: [
      "/tools/airbnb-adr-calculator",
      "/tools/airbnb-revpar-calculator",
      "/guides/airbnb-revenue-optimization",
    ],
    anchorGuidance: ["Explain whether the link concerns availability, rate, or revenue efficiency."],
    canonicalDestinations: ["/tools/airbnb-occupancy-calculator", "/articles/airbnb-occupancy-rate"],
    linkRationales: ["Connect calendar utilisation with achieved rate and RevPAR."],
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
