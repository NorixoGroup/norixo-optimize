import { accommodationRevenueKnowledgeObject } from "./accommodation-revenue";
import { averageDailyRateKnowledgeObject } from "./adr";
import { availableNightsKnowledgeObject } from "./available-nights";
import { bookedNightsKnowledgeObject } from "./booked-nights";
import { inventoryMetricsKnowledgeObject } from "./inventory-metrics";
import { occupancyRateKnowledgeObject } from "./occupancy";
import { revenueManagementKnowledgeObject } from "./revenue-management";
import { revenueMetricsKnowledgeObject } from "./revenue-metrics";
import { revenuePerAvailableRentalNightKnowledgeObject } from "./revpar";

export { accommodationRevenueKnowledgeObject } from "./accommodation-revenue";
export { averageDailyRateKnowledgeObject } from "./adr";
export { availableNightsKnowledgeObject } from "./available-nights";
export { bookedNightsKnowledgeObject } from "./booked-nights";
export { inventoryMetricsKnowledgeObject } from "./inventory-metrics";
export { occupancyRateKnowledgeObject } from "./occupancy";
export { revenueManagementKnowledgeObject } from "./revenue-management";
export { revenueMetricsKnowledgeObject } from "./revenue-metrics";
export { revenuePerAvailableRentalNightKnowledgeObject } from "./revpar";

export const canonicalKnowledgeObjects = [
  revenueManagementKnowledgeObject,
  revenueMetricsKnowledgeObject,
  inventoryMetricsKnowledgeObject,
  averageDailyRateKnowledgeObject,
  occupancyRateKnowledgeObject,
  revenuePerAvailableRentalNightKnowledgeObject,
  availableNightsKnowledgeObject,
  bookedNightsKnowledgeObject,
  accommodationRevenueKnowledgeObject,
];
