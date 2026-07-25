import {
  getAncestors,
  getChildren,
  getParents,
  getRelated,
  getRequires,
} from "./graph";
import {
  ProjectionFormulaResolutionError,
  resolveFormulaForProjection,
  resolvePrimaryFormulaForProjection,
} from "./formulas";
import { getArticleBySlug } from "@/data/articles";
import { getGuideBySlug } from "@/data/guides";
import { getKnowledgeObject, knowledgeRegistry, validateKnowledgeRegistry } from "./registry";
import type { KnowledgeObject } from "./types";

const ADR_ID = "metrics.average-daily-rate";
const OCCUPANCY_ID = "metrics.occupancy-rate";
const REVPAR_ID = "metrics.revenue-per-available-rental-night";
const AVAILABLE_NIGHTS_ID = "inventory.available-nights";
const BOOKED_NIGHTS_ID = "inventory.booked-nights";
const ACCOMMODATION_REVENUE_ID = "revenue.accommodation-revenue";
const REVENUE_MANAGEMENT_ID = "domains.revenue-management";
const REVENUE_METRICS_ID = "domains.revenue-metrics";
const INVENTORY_METRICS_ID = "domains.inventory-metrics";
const ADR_ARTICLE_PATH = "/articles/airbnb-adr";
const REVPAR_ARTICLE_PATH = "/articles/airbnb-revpar";
const OCCUPANCY_ARTICLE_PATH = "/articles/airbnb-occupancy-rate";
const REVPAR_GUIDE_PATH = "/guides/airbnb-revenue-optimization";
const ADR_GUIDE_PATH = "/guides/airbnb-pricing-optimization";

function includesCanonicalIds(objects: KnowledgeObject[], canonicalIds: string[]): boolean {
  return canonicalIds.every((canonicalId) =>
    objects.some((object) => object.identity.canonicalId === canonicalId)
  );
}

function expectFormulaResolutionError(
  resolve: () => void,
  expectedCode: ProjectionFormulaResolutionError["code"]
): void {
  try {
    resolve();
  } catch (error) {
    if (error instanceof ProjectionFormulaResolutionError && error.code === expectedCode) {
      return;
    }

    throw error;
  }

  throw new Error(`Expected formula resolution error: ${expectedCode}`);
}

export function runKnowledgeEngineSmokeTest(): void {
  const objects = knowledgeRegistry.listKnowledgeObjects();
  const validation = validateKnowledgeRegistry();
  const adr = getKnowledgeObject(ADR_ID);
  const occupancy = getKnowledgeObject(OCCUPANCY_ID);
  const revpar = getKnowledgeObject(REVPAR_ID);
  const availableNights = getKnowledgeObject(AVAILABLE_NIGHTS_ID);
  const bookedNights = getKnowledgeObject(BOOKED_NIGHTS_ID);
  const accommodationRevenue = getKnowledgeObject(ACCOMMODATION_REVENUE_ID);
  const revenueManagement = getKnowledgeObject(REVENUE_MANAGEMENT_ID);
  const revenueMetrics = getKnowledgeObject(REVENUE_METRICS_ID);
  const inventoryMetrics = getKnowledgeObject(INVENTORY_METRICS_ID);

  if (
    !validation.valid ||
    objects.length !== 9 ||
    !adr ||
    !occupancy ||
    !revpar ||
    !availableNights ||
    !bookedNights ||
    !accommodationRevenue ||
    !revenueManagement ||
    !revenueMetrics ||
    !inventoryMetrics
  ) {
    throw new Error("Canonical knowledge objects failed registry validation.");
  }

  if (
    !includesCanonicalIds(getChildren(knowledgeRegistry, revenueManagement), [
      REVENUE_METRICS_ID,
      INVENTORY_METRICS_ID,
    ]) ||
    !includesCanonicalIds(getParents(knowledgeRegistry, revenueMetrics), [REVENUE_MANAGEMENT_ID]) ||
    !includesCanonicalIds(getParents(knowledgeRegistry, inventoryMetrics), [REVENUE_MANAGEMENT_ID])
  ) {
    throw new Error("Revenue Management domain hierarchy is invalid.");
  }

  if (
    !includesCanonicalIds(getChildren(knowledgeRegistry, revenueMetrics), [
      ADR_ID,
      REVPAR_ID,
      ACCOMMODATION_REVENUE_ID,
    ]) ||
    !includesCanonicalIds(getChildren(knowledgeRegistry, inventoryMetrics), [
      OCCUPANCY_ID,
      AVAILABLE_NIGHTS_ID,
      BOOKED_NIGHTS_ID,
    ])
  ) {
    throw new Error("Metric domain children are invalid.");
  }

  if (
    !includesCanonicalIds(getParents(knowledgeRegistry, adr), [REVENUE_METRICS_ID]) ||
    !includesCanonicalIds(getParents(knowledgeRegistry, occupancy), [INVENTORY_METRICS_ID])
  ) {
    throw new Error("KPI parent relationships are invalid.");
  }

  if (
    !includesCanonicalIds(getAncestors(knowledgeRegistry, adr), [REVENUE_MANAGEMENT_ID]) ||
    !includesCanonicalIds(getAncestors(knowledgeRegistry, availableNights), [REVENUE_MANAGEMENT_ID])
  ) {
    throw new Error("Transitive domain membership is invalid.");
  }

  if (!getRelated(knowledgeRegistry, adr).some((object) => object.identity.canonicalId === REVPAR_ID)) {
    throw new Error("ADR must know RevPAR.");
  }

  if (!getRelated(knowledgeRegistry, occupancy).some((object) => object.identity.canonicalId === ADR_ID)) {
    throw new Error("Occupancy must know ADR.");
  }

  const hasDerivedInputs = (object: KnowledgeObject, inputIds: string[]) =>
    inputIds.every((canonicalId) =>
      object.relationships.derivedFrom.some((reference) => reference.canonicalId === canonicalId)
    );

  if (!hasDerivedInputs(adr, [ACCOMMODATION_REVENUE_ID, BOOKED_NIGHTS_ID])) {
    throw new Error("ADR must be derived from Accommodation Revenue and Booked Nights.");
  }

  if (!hasDerivedInputs(occupancy, [BOOKED_NIGHTS_ID, AVAILABLE_NIGHTS_ID])) {
    throw new Error("Occupancy must be derived from Booked Nights and Available Nights.");
  }

  if (!hasDerivedInputs(revpar, [ACCOMMODATION_REVENUE_ID, AVAILABLE_NIGHTS_ID])) {
    throw new Error("RevPAR must be derived from Accommodation Revenue and Available Nights.");
  }

  const includesUsedBy = (object: KnowledgeObject, canonicalIds: string[]) =>
    canonicalIds.every((canonicalId) =>
      object.relationships.usedBy.some((reference) => reference.canonicalId === canonicalId)
    );

  if (!includesUsedBy(availableNights, [OCCUPANCY_ID, REVPAR_ID])) {
    throw new Error("Available Nights must be used by Occupancy and RevPAR.");
  }

  if (!includesUsedBy(bookedNights, [ADR_ID, OCCUPANCY_ID])) {
    throw new Error("Booked Nights must be used by ADR and Occupancy.");
  }

  if (!includesUsedBy(accommodationRevenue, [ADR_ID, REVPAR_ID])) {
    throw new Error("Accommodation Revenue must be used by ADR and RevPAR.");
  }

  if (
    getRequires(knowledgeRegistry, revpar).length < 4 ||
    !includesCanonicalIds(getParents(knowledgeRegistry, revpar), [REVENUE_METRICS_ID])
  ) {
    throw new Error("RevPAR dependencies or parent relationships are invalid.");
  }

  if (
    adr.identity.owner !== "Norixo research team" ||
    adr.identity.reviewDate !== "2026-07-24" ||
    revpar.identity.owner !== "Norixo research team" ||
    revpar.identity.reviewDate !== "2026-07-24" ||
    occupancy.identity.owner !== "Norixo research team" ||
    occupancy.identity.reviewDate !== "2026-07-24"
  ) {
    throw new Error("Canonical KPI editorial metadata are invalid.");
  }

  const hasFormula = (
    object: KnowledgeObject,
    id: string,
    expression: string,
    role: "primary_definition" | "equivalent_expression"
  ) =>
    object.definition.formulas?.some(
      (formula) =>
        formula.id === id &&
        formula.expression === expression &&
        formula.role === role &&
        formula.executionStatus === "reference_only"
    );

  if (
    !hasFormula(
      adr,
      "direct-revenue-per-booked-night",
      "ADR = accommodation revenue ÷ booked nights",
      "primary_definition"
    ) ||
    !hasFormula(
      occupancy,
      "booked-nights-per-available-nights",
      "Occupancy rate = booked nights ÷ available nights × 100",
      "primary_definition"
    ) ||
    !hasFormula(
      revpar,
      "direct-revenue-per-available-night",
      "RevPAR = accommodation revenue ÷ available nights",
      "primary_definition"
    ) ||
    !hasFormula(
      revpar,
      "adr-times-decimal-occupancy",
      "RevPAR = ADR × occupancy rate expressed as a decimal",
      "equivalent_expression"
    ) ||
    adr.definition.formulaReferences[0] !== adr.definition.formulas?.[0]?.expression ||
    occupancy.definition.formulaReferences[0] !== occupancy.definition.formulas?.[0]?.expression ||
    revpar.definition.formulaReferences[0] !== revpar.definition.formulas?.[0]?.expression ||
    revpar.definition.formulaReferences[1] !== revpar.definition.formulas?.[1]?.expression
  ) {
    throw new Error("Canonical KPI formula contracts are invalid.");
  }

  const adrPrimaryFormula = resolvePrimaryFormulaForProjection(ADR_ID);
  const occupancyPrimaryFormula = resolvePrimaryFormulaForProjection(OCCUPANCY_ID);
  const revparPrimaryFormula = resolvePrimaryFormulaForProjection(REVPAR_ID);
  const revparEquivalentFormula = resolveFormulaForProjection(
    REVPAR_ID,
    "adr-times-decimal-occupancy"
  );

  if (
    adrPrimaryFormula.id !== "direct-revenue-per-booked-night" ||
    adrPrimaryFormula.expression !== "ADR = accommodation revenue ÷ booked nights" ||
    adrPrimaryFormula.role !== "primary_definition" ||
    adrPrimaryFormula.executionStatus !== "reference_only" ||
    occupancyPrimaryFormula.expression !== "Occupancy rate = booked nights ÷ available nights × 100" ||
    occupancyPrimaryFormula.outputUnit !== "percentage_of_available_nights" ||
    revparPrimaryFormula.id !== "direct-revenue-per-available-night" ||
    revparPrimaryFormula.role !== "primary_definition" ||
    revparEquivalentFormula.id !== "adr-times-decimal-occupancy" ||
    revparEquivalentFormula.role !== "equivalent_expression"
  ) {
    throw new Error("Projection formula resolution is invalid.");
  }

  expectFormulaResolutionError(
    () => resolvePrimaryFormulaForProjection("metrics.unknown"),
    "KNOWLEDGE_OBJECT_NOT_FOUND"
  );
  expectFormulaResolutionError(
    () => resolvePrimaryFormulaForProjection(REVENUE_MANAGEMENT_ID),
    "FORMULA_CONTRACT_MISSING"
  );
  expectFormulaResolutionError(
    () => resolveFormulaForProjection(ADR_ID, "unknown-formula"),
    "FORMULA_NOT_FOUND"
  );

  const adrArticle = getArticleBySlug("airbnb-adr");
  const adrArticleProjection = adr.editorialProjections.find(
    (projection) => projection.type === "article" && projection.canonicalUrl === ADR_ARTICLE_PATH
  );

  if (
    !adrArticle ||
    !adr.relationships.articleReferences.includes(ADR_ARTICLE_PATH) ||
    !adrArticleProjection
  ) {
    throw new Error("The canonical ADR article projection is invalid.");
  }

  const revparArticle = getArticleBySlug("airbnb-revpar");
  const revparArticleProjection = revpar.editorialProjections.find(
    (projection) => projection.type === "article" && projection.canonicalUrl === REVPAR_ARTICLE_PATH
  );

  if (
    !revparArticle ||
    !revpar.relationships.articleReferences.includes(REVPAR_ARTICLE_PATH) ||
    !revparArticleProjection
  ) {
    throw new Error("The canonical RevPAR article projection is invalid.");
  }

  const occupancyArticle = getArticleBySlug("airbnb-occupancy-rate");
  const occupancyArticleProjection = occupancy.editorialProjections.find(
    (projection) => projection.type === "article" && projection.canonicalUrl === OCCUPANCY_ARTICLE_PATH
  );

  if (
    !occupancyArticle ||
    !occupancy.relationships.articleReferences.includes(OCCUPANCY_ARTICLE_PATH) ||
    !occupancyArticleProjection
  ) {
    throw new Error("The canonical Occupancy article projection is invalid.");
  }

  const revparGuide = getGuideBySlug("airbnb-revenue-optimization");
  const revparGuideProjection = revpar.editorialProjections.find(
    (projection) => projection.type === "guide" && projection.canonicalUrl === REVPAR_GUIDE_PATH
  );

  if (
    !revparGuide ||
    !revpar.relationships.guideReferences.includes(REVPAR_GUIDE_PATH) ||
    !revparGuideProjection
  ) {
    throw new Error("The canonical RevPAR guide projection is invalid.");
  }

  const adrGuide = getGuideBySlug("airbnb-pricing-optimization");
  const adrGuideProjection = adr.editorialProjections.find(
    (projection) => projection.type === "guide" && projection.canonicalUrl === ADR_GUIDE_PATH
  );

  if (
    !adrGuide ||
    !adr.relationships.guideReferences.includes(ADR_GUIDE_PATH) ||
    !adrGuideProjection
  ) {
    throw new Error("The canonical ADR guide projection is invalid.");
  }

  const kpiGuidePaths = new Set(
    [adr, revpar, occupancy].flatMap((object) =>
      object.editorialProjections
        .filter((projection) => projection.type === "guide" && projection.status === "published")
        .flatMap((projection) => (projection.canonicalUrl ? [projection.canonicalUrl] : []))
    )
  );

  if (
    kpiGuidePaths.size !== 2 ||
    !kpiGuidePaths.has(ADR_GUIDE_PATH) ||
    !kpiGuidePaths.has(REVPAR_GUIDE_PATH)
  ) {
    throw new Error("Canonical KPI guide projections must contain exactly two published routes.");
  }

  const guideProjectionKeys = new Set<string>();

  objects.forEach((object) => {
    object.editorialProjections
      .filter((projection) => projection.type === "guide")
      .forEach((projection) => {
        const canonicalUrl = projection.canonicalUrl;
        const projectionKey = `${object.identity.canonicalId}:${canonicalUrl}`;

        if (
          projection.status !== "published" ||
          !canonicalUrl ||
          !object.identity.reviewDate ||
          !object.relationships.guideReferences.includes(canonicalUrl) ||
          !getGuideBySlug(canonicalUrl.replace("/guides/", "")) ||
          guideProjectionKeys.has(projectionKey)
        ) {
          throw new Error(`Invalid canonical guide projection: ${projectionKey}`);
        }

        guideProjectionKeys.add(projectionKey);
      });
  });
}
