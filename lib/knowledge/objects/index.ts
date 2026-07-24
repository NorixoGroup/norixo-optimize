import { accommodationRevenueKnowledgeObject } from "./accommodation-revenue";
import { averageDailyRateKnowledgeObject } from "./adr";
import { availableNightsKnowledgeObject } from "./available-nights";
import { bookedNightsKnowledgeObject } from "./booked-nights";
import { occupancyRateKnowledgeObject } from "./occupancy";
import { revenuePerAvailableRentalNightKnowledgeObject } from "./revpar";

export { accommodationRevenueKnowledgeObject } from "./accommodation-revenue";
export { averageDailyRateKnowledgeObject } from "./adr";
export { availableNightsKnowledgeObject } from "./available-nights";
export { bookedNightsKnowledgeObject } from "./booked-nights";
export { occupancyRateKnowledgeObject } from "./occupancy";
export { revenuePerAvailableRentalNightKnowledgeObject } from "./revpar";

export const canonicalKnowledgeObjects = [
  averageDailyRateKnowledgeObject,
  occupancyRateKnowledgeObject,
  revenuePerAvailableRentalNightKnowledgeObject,
  availableNightsKnowledgeObject,
  bookedNightsKnowledgeObject,
  accommodationRevenueKnowledgeObject,
];
