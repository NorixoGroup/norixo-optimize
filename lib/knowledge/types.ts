export type KnowledgeObjectStatus =
  | "draft"
  | "validated"
  | "published"
  | "deprecated"
  | "merged"
  | "archived";

export type EvidenceLevel = "E0" | "E1" | "E2" | "E3" | "E4";

export type EditorialProjectionType =
  | "calculator"
  | "guide"
  | "article"
  | "glossary"
  | "faq"
  | "research"
  | "landing"
  | "documentation"
  | "api"
  | "ai_retrieval";

export interface LocalizedKnowledgeTerm {
  canonicalName: string;
  aliases?: string[];
  terminologyNotes?: string[];
}

export interface ConceptReference {
  canonicalId: string;
  rationale?: string;
}

export interface KnowledgeIdentity {
  canonicalId: string;
  canonicalName: string;
  slug?: string;
  aliases: string[];
  abbreviations: string[];
  translations: Record<string, LocalizedKnowledgeTerm>;
  parentConcepts: ConceptReference[];
  childConcepts: ConceptReference[];
  siblingConcepts: ConceptReference[];
  relatedConcepts: ConceptReference[];
  status: KnowledgeObjectStatus;
  version: string;
  owner: string;
  reviewDate?: string;
  evidenceLevel: EvidenceLevel;
}

export interface KnowledgeDefinition {
  shortDefinition: string;
  longDefinition?: string;
  purpose: string;
  scope: string[];
  outOfScope: string[];
  commonMisunderstandings: string[];
  terminologyNotes: string[];
  calculationRelevance: string;
  businessRelevance: string;
  unitsAndDimensions: string[];
  formulaReferences: string[];
  conventionVariants: string[];
}

export interface EvidenceReference {
  title: string;
  url?: string;
  identifier?: string;
  sourceType: "primary" | "secondary" | "internal";
  supports: string[];
}

export interface KnowledgeEvidence {
  primarySources: EvidenceReference[];
  secondarySources: EvidenceReference[];
  internalMethodologyReferences: EvidenceReference[];
  confidence?: string;
  lastValidation?: string;
  citationRules: string[];
  externalReferences: EvidenceReference[];
  internalReferences: string[];
  limitations: string[];
  contradictoryEvidence: string[];
}

export interface KnowledgeRelationships {
  requires: ConceptReference[];
  dependsOn: ConceptReference[];
  relatedTo: ConceptReference[];
  oftenConfusedWith: ConceptReference[];
  opposite: ConceptReference[];
  derivedFrom: ConceptReference[];
  uses: ConceptReference[];
  usedBy: ConceptReference[];
  calculatorReferences: string[];
  guideReferences: string[];
  articleReferences: string[];
  researchReferences: string[];
  apiReferences: string[];
}

export interface EditorialProjection {
  type: EditorialProjectionType;
  identifier: string;
  canonicalUrl?: string;
  status: KnowledgeObjectStatus;
  purpose: string;
}

export interface StructuredKnowledge {
  canonicalUrls: string[];
  entity: string;
  entityType: string;
  schemaSuitability: "applicable" | "not_applicable" | "deferred";
  schemaTypes: string[];
  searchIntent?: string;
  primaryKeyword?: string;
  secondaryKeywords: string[];
  semanticKeywords: string[];
  searchStage?: string;
  localeCoverage: Record<string, "available" | "planned" | "not_applicable">;
  internalImportance: "critical" | "high" | "medium" | "low";
  externalLinkability?: "none" | "contextual" | "reference_worthy" | "research_worthy";
  retrievalEligibility: "eligible" | "restricted" | "excluded" | "pending_review";
  apiEligibility: "eligible" | "internal_only" | "excluded" | "pending_design";
}

export interface InternalLinking {
  requiredInboundLinks: string[];
  requiredOutboundLinks: string[];
  anchorGuidance: string[];
  canonicalDestinations: string[];
  linkRationales: string[];
  duplicationGuard: string;
  projectionSpecificRules: string[];
}

export interface KnowledgeQuality {
  requiredChecks: string[];
  validationRecord?: string;
  privacyReview: "required" | "passed" | "not_applicable";
  translationReview: "required" | "passed" | "not_applicable";
  structuredDataReview: "required" | "passed" | "not_applicable";
}

export interface LifecycleEvent {
  status: KnowledgeObjectStatus;
  date: string;
  reason: string;
}

export interface KnowledgeLifecycle {
  stateHistory: LifecycleEvent[];
  reviewFrequency: string;
  versionHistory: string[];
  breakingChangePolicy: string;
  ownershipTransferHistory: string[];
  deprecationReason?: string;
  mergeTarget?: string;
  archiveReason?: string;
}

export interface KnowledgeObject {
  identity: KnowledgeIdentity;
  definition: KnowledgeDefinition;
  evidence: KnowledgeEvidence;
  relationships: KnowledgeRelationships;
  editorialProjections: EditorialProjection[];
  structuredKnowledge: StructuredKnowledge;
  internalLinking: InternalLinking;
  quality: KnowledgeQuality;
  lifecycle: KnowledgeLifecycle;
}

export interface KnowledgeValidationIssue {
  path: string;
  message: string;
}

export interface KnowledgeValidationResult {
  valid: boolean;
  issues: KnowledgeValidationIssue[];
}
