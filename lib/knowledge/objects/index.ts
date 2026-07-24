import { averageDailyRateKnowledgeObject } from "./adr";
import { occupancyRateKnowledgeObject } from "./occupancy";
import { revenuePerAvailableRentalNightKnowledgeObject } from "./revpar";

export { averageDailyRateKnowledgeObject } from "./adr";
export { occupancyRateKnowledgeObject } from "./occupancy";
export { revenuePerAvailableRentalNightKnowledgeObject } from "./revpar";

export const canonicalKnowledgeObjects = [
  averageDailyRateKnowledgeObject,
  occupancyRateKnowledgeObject,
  revenuePerAvailableRentalNightKnowledgeObject,
];
