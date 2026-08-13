import type { EditorialMapping } from "../mapping-registry";

const marketIntelligenceTopicId = "topic:market-intelligence" as const;
const marketIntelligencePillarId = "content:guide:airbnb-market-intelligence" as const;
const airbnbPlatformId = "platform:airbnb" as const;

/** Minimal canonical mapping for the Market Intelligence editorial hub. */
export const marketIntelligenceEditorialMappings: readonly EditorialMapping[] = [
  { type: "pillar_for", sourceId: marketIntelligencePillarId, targetId: marketIntelligenceTopicId },
  { type: "is_about", sourceId: marketIntelligencePillarId, targetId: marketIntelligenceTopicId },
  { type: "part_of_cluster", sourceId: marketIntelligencePillarId, targetId: marketIntelligenceTopicId },
  { type: "applies_to", sourceId: marketIntelligencePillarId, targetId: airbnbPlatformId },
];
