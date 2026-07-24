import {
  getAncestors,
  getChildren,
  getParents,
  getRelated,
  getRequires,
} from "./graph";
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

function includesCanonicalIds(objects: KnowledgeObject[], canonicalIds: string[]): boolean {
  return canonicalIds.every((canonicalId) =>
    objects.some((object) => object.identity.canonicalId === canonicalId)
  );
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
}
