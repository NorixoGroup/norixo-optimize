import type { KnowledgeObject } from "../types";

export const inventoryMetricsKnowledgeObject: KnowledgeObject = {
  identity: {
    canonicalId: "domains.inventory-metrics",
    canonicalName: "Inventory Metrics",
    slug: "inventory-metrics",
    aliases: ["rental inventory metrics"],
    abbreviations: [],
    translations: { en: { canonicalName: "Inventory Metrics" }, fr: { canonicalName: "métriques d’inventaire" } },
    parentConcepts: [{ canonicalId: "domains.revenue-management", rationale: "Inventory metrics support revenue-management decisions." }],
    childConcepts: [
      { canonicalId: "metrics.occupancy-rate", rationale: "Occupancy measures available-night utilisation." },
      { canonicalId: "inventory.available-nights", rationale: "Available Nights define rental inventory." },
      { canonicalId: "inventory.booked-nights", rationale: "Booked Nights measure inventory use." },
    ],
    siblingConcepts: [], relatedConcepts: [], status: "validated", version: "1.0.0", owner: "Norixo research team", reviewDate: "2026-07-24", evidenceLevel: "E1",
  },
  definition: {
    shortDefinition: "Concepts related to rental-night inventory and its use.",
    longDefinition: "Inventory Metrics is the canonical domain for concepts that describe rental-night inventory, its availability, and its use.",
    purpose: "Classify availability and booked-night concepts within the knowledge graph.",
    scope: ["Available Nights", "Booked Nights", "Occupancy Rate", "Future availability and blocking concepts"],
    outOfScope: ["Revenue", "Price", "Reservation counts without a night dimension", "Operational task management"],
    commonMisunderstandings: ["Inventory Metrics does not include revenue or price.", "A reservation count is not necessarily an inventory metric."],
    terminologyNotes: ["This is a classification object, not a calculable KPI."],
    calculationRelevance: "Groups availability and utilisation inputs used by KPI calculations.",
    businessRelevance: "Makes inventory utilisation comparable across related performance measures.",
    unitsAndDimensions: [], formulaReferences: [], conventionVariants: [],
  },
  evidence: {
    primarySources: [], secondarySources: [],
    internalMethodologyReferences: [{ title: "Norixo Knowledge Object Contract", identifier: "lib/knowledge/types.ts", sourceType: "internal", supports: ["Domain classification contract"] }],
    confidence: "Internal taxonomy classification reviewed for the initial KPI cluster.", lastValidation: "2026-07-24",
    citationRules: ["Do not present this internal taxonomy as an external industry standard."], externalReferences: [], internalReferences: [], limitations: ["This domain does not choose a universal availability or blocked-night convention."], contradictoryEvidence: [],
  },
  relationships: { requires: [], dependsOn: [], relatedTo: [], oftenConfusedWith: [], opposite: [], derivedFrom: [], uses: [], usedBy: [], calculatorReferences: [], guideReferences: [], articleReferences: [], researchReferences: [], apiReferences: [] },
  editorialProjections: [],
  structuredKnowledge: { canonicalUrls: [], entity: "Inventory Metrics", entityType: "knowledge_domain", schemaSuitability: "deferred", schemaTypes: [], secondaryKeywords: [], semanticKeywords: ["available nights", "booked nights", "occupancy", "blocked nights"], localeCoverage: { en: "planned", fr: "planned" }, internalImportance: "high", externalLinkability: "none", retrievalEligibility: "eligible", apiEligibility: "pending_design" },
  internalLinking: { requiredInboundLinks: [], requiredOutboundLinks: [], anchorGuidance: ["No public projection exists yet."], canonicalDestinations: [], linkRationales: [], duplicationGuard: "No public projection exists yet.", projectionSpecificRules: ["Do not create a URL until a canonical public projection is approved."] },
  quality: { requiredChecks: ["Definition", "Hierarchy reciprocity", "Lifecycle"], validationRecord: "2026-07-24", privacyReview: "not_applicable", translationReview: "required", structuredDataReview: "not_applicable" },
  lifecycle: { stateHistory: [{ status: "draft", date: "2026-07-24", reason: "Initial canonical domain object created." }, { status: "validated", date: "2026-07-24", reason: "Initial taxonomy hierarchy reviewed." }], reviewFrequency: "Annual or when the canonical taxonomy materially changes.", versionHistory: ["1.0.0"], breakingChangePolicy: "Create a major version for a material domain-scope change.", ownershipTransferHistory: [] },
};
