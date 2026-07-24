import {
  getParents,
  getRelated,
  getRequires,
} from "./graph";
import { getKnowledgeObject, knowledgeRegistry, validateKnowledgeRegistry } from "./registry";

const ADR_ID = "metrics.average-daily-rate";
const OCCUPANCY_ID = "metrics.occupancy-rate";
const REVPAR_ID = "metrics.revenue-per-available-rental-night";

export function runKnowledgeEngineSmokeTest(): void {
  const objects = knowledgeRegistry.listKnowledgeObjects();
  const validation = validateKnowledgeRegistry();
  const adr = getKnowledgeObject(ADR_ID);
  const occupancy = getKnowledgeObject(OCCUPANCY_ID);
  const revpar = getKnowledgeObject(REVPAR_ID);

  if (!validation.valid || objects.length !== 3 || !adr || !occupancy || !revpar) {
    throw new Error("Canonical KPI knowledge objects failed registry validation.");
  }

  if (!getRelated(knowledgeRegistry, adr).some((object) => object.identity.canonicalId === REVPAR_ID)) {
    throw new Error("ADR must know RevPAR.");
  }

  if (!getRelated(knowledgeRegistry, occupancy).some((object) => object.identity.canonicalId === ADR_ID)) {
    throw new Error("Occupancy must know ADR.");
  }

  const revparDependencies = getRequires(knowledgeRegistry, revpar);
  const dependencyIds = revparDependencies.map((object) => object.identity.canonicalId);

  if (!dependencyIds.includes(ADR_ID) || !dependencyIds.includes(OCCUPANCY_ID)) {
    throw new Error("RevPAR must depend on ADR and Occupancy.");
  }

  if (getParents(knowledgeRegistry, revpar).length !== 0) {
    throw new Error("The initial KPI objects should not have registered parents.");
  }
}
