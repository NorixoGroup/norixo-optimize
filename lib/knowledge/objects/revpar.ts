import type { KnowledgeObject } from "../types";

export const revenuePerAvailableRentalNightKnowledgeObject: KnowledgeObject = {
  identity: {
    canonicalId: "metrics.revenue-per-available-rental-night",
    canonicalName: "Revenue per Available Rental Night",
    slug: "revenue-per-available-rental-night",
    aliases: ["revenue per available night"],
    abbreviations: ["RevPAR", "RevPAN"],
    translations: {
      en: { canonicalName: "Revenue per Available Rental Night", aliases: ["RevPAR", "RevPAN"] },
      fr: { canonicalName: "revenu par nuit locative disponible", aliases: ["RevPAR"] },
    },
    parentConcepts: [],
    childConcepts: [],
    siblingConcepts: [],
    relatedConcepts: [
      {
        canonicalId: "metrics.average-daily-rate",
        rationale: "ADR is an input to the equivalent RevPAR formula.",
      },
      {
        canonicalId: "metrics.occupancy-rate",
        rationale: "Occupancy is an input to the equivalent RevPAR formula.",
      },
    ],
    status: "validated",
    version: "1.0.0",
    owner: "Norixo research team",
    reviewDate: "2026-07-24",
    evidenceLevel: "E3",
  },
  definition: {
    shortDefinition: "Accommodation revenue earned per available rental night during a consistent measurement period.",
    longDefinition:
      "Revenue per Available Rental Night measures accommodation revenue divided by available nights. It can also be expressed as Average Daily Rate multiplied by occupancy expressed as a decimal, when both use the same revenue, availability, and period conventions.",
    purpose: "Measure revenue efficiency across available inventory.",
    scope: ["Accommodation revenue", "Available nights", "Consistent period and inventory conventions"],
    outOfScope: ["Operating costs", "Commissions", "Net margin", "Provider-specific data reconciliation"],
    commonMisunderstandings: [
      "RevPAR does not explain whether rate or occupancy caused the result.",
      "RevPAR is not a profitability metric.",
    ],
    terminologyNotes: ["RevPAN is an alternative short-term rental label for the same available-night concept."],
    calculationRelevance:
      "RevPAR = accommodation revenue ÷ available nights; equivalently, ADR × occupancy rate in decimal form.",
    businessRelevance: "Combines achieved rate and calendar utilisation for performance comparison.",
    unitsAndDimensions: ["Currency per available rental night"],
    formulaReferences: [
      "RevPAR = accommodation revenue ÷ available nights",
      "RevPAR = ADR × occupancy rate expressed as a decimal",
    ],
    conventionVariants: [
      "Available-night treatment changes the denominator when nights are removed from inventory.",
      "Revenue inclusions must remain consistent across comparisons.",
    ],
  },
  evidence: {
    primarySources: [
      {
        title: "AirDNA: What is RevPAR?",
        url: "https://help.airdna.co/en/articles/8062179-what-is-revpar",
        sourceType: "primary",
        supports: ["RevPAR definition", "Period and available-inventory convention"],
      },
    ],
    secondarySources: [
      {
        title: "PriceLabs: Report Builder metrics",
        url: "https://help.pricelabs.co/portal/en/kb/articles/a-complete-guide-to-report-builder-metrics",
        sourceType: "secondary",
        supports: ["RevPAR formulas", "Availability convention differences"],
      },
    ],
    internalMethodologyReferences: [
      {
        title: "Norixo KPI calculator calculation convention",
        identifier: "app/(default)/tools/[tool]/page.tsx",
        sourceType: "internal",
        supports: ["Norixo calculator convention", "ADR × occupancy explanation"],
      },
    ],
    confidence: "High for the stated formulas when inputs use the same conventions.",
    lastValidation: "2026-07-24",
    citationRules: [
      "Cite the denominator and provider-specific inventory convention close to the claim.",
      "State that ADR × occupancy requires occupancy as a decimal and matching conventions.",
    ],
    externalReferences: [],
    internalReferences: ["/tools/airbnb-revpar-calculator", "/articles/airbnb-revpar"],
    limitations: ["Does not measure operating costs, commissions, or net margin."],
    contradictoryEvidence: ["Revenue and available-inventory conventions can differ among providers."],
  },
  relationships: {
    requires: [
      { canonicalId: "metrics.average-daily-rate", rationale: "Required for the equivalent multiplication formula." },
      { canonicalId: "metrics.occupancy-rate", rationale: "Required for the equivalent multiplication formula." },
    ],
    dependsOn: [
      { canonicalId: "metrics.average-daily-rate", rationale: "Required for the equivalent multiplication formula." },
      { canonicalId: "metrics.occupancy-rate", rationale: "Required for the equivalent multiplication formula." },
    ],
    relatedTo: [],
    oftenConfusedWith: [
      { canonicalId: "metrics.average-daily-rate", rationale: "ADR uses booked nights rather than available nights." },
    ],
    opposite: [],
    derivedFrom: [
      { canonicalId: "metrics.average-daily-rate", rationale: "Part of the ADR × occupancy formula." },
      { canonicalId: "metrics.occupancy-rate", rationale: "Part of the ADR × occupancy formula." },
    ],
    uses: [],
    usedBy: [],
    calculatorReferences: ["/tools/airbnb-revpar-calculator"],
    guideReferences: ["/guides/airbnb-revenue-optimization"],
    articleReferences: ["/articles/airbnb-revpar"],
    researchReferences: ["/research/methodology"],
    apiReferences: [],
  },
  editorialProjections: [
    {
      type: "calculator",
      identifier: "airbnb-revpar-calculator",
      canonicalUrl: "/tools/airbnb-revpar-calculator",
      status: "published",
      purpose: "Calculate RevPAR from accommodation revenue and available nights.",
    },
    {
      type: "article",
      identifier: "airbnb-revpar",
      canonicalUrl: "/articles/airbnb-revpar",
      status: "published",
      purpose: "Provide editorial explanation of RevPAR.",
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
    canonicalUrls: ["/tools/airbnb-revpar-calculator", "/articles/airbnb-revpar"],
    entity: "Revenue per Available Rental Night",
    entityType: "performance_metric",
    schemaSuitability: "applicable",
    schemaTypes: ["WebApplication"],
    searchIntent: "Understand and calculate RevPAR.",
    primaryKeyword: "Airbnb RevPAR",
    secondaryKeywords: ["revenue per available night", "RevPAN"],
    semanticKeywords: ["ADR", "occupancy", "available nights", "accommodation revenue"],
    searchStage: "understanding",
    localeCoverage: { en: "available", fr: "planned" },
    internalImportance: "critical",
    externalLinkability: "reference_worthy",
    retrievalEligibility: "eligible",
    apiEligibility: "pending_design",
  },
  internalLinking: {
    requiredInboundLinks: ["/tools", "/articles/airbnb-revpar"],
    requiredOutboundLinks: [
      "/tools/airbnb-adr-calculator",
      "/tools/airbnb-occupancy-calculator",
      "/guides/airbnb-revenue-optimization",
    ],
    anchorGuidance: ["Describe whether the link concerns rate, occupancy, or available-night revenue."],
    canonicalDestinations: ["/tools/airbnb-revpar-calculator", "/articles/airbnb-revpar"],
    linkRationales: ["Connect revenue efficiency with its rate and occupancy inputs."],
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
