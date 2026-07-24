import {
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

export function runKnowledgeEngineSmokeTest(): void {
  const objects = knowledgeRegistry.listKnowledgeObjects();
  const validation = validateKnowledgeRegistry();
  const adr = getKnowledgeObject(ADR_ID);
  const occupancy = getKnowledgeObject(OCCUPANCY_ID);
  const revpar = getKnowledgeObject(REVPAR_ID);
  const availableNights = getKnowledgeObject(AVAILABLE_NIGHTS_ID);
  const bookedNights = getKnowledgeObject(BOOKED_NIGHTS_ID);
  const accommodationRevenue = getKnowledgeObject(ACCOMMODATION_REVENUE_ID);

  if (
    !validation.valid ||
    objects.length !== 6 ||
    !adr ||
    !occupancy ||
    !revpar ||
    !availableNights ||
    !bookedNights ||
    !accommodationRevenue
  ) {
    throw new Error("Canonical KPI knowledge objects failed registry validation.");
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

  if (getRequires(knowledgeRegistry, revpar).length < 4 || getParents(knowledgeRegistry, revpar).length !== 0) {
    throw new Error("RevPAR dependencies or initial parent relationships are invalid.");
  }
}
