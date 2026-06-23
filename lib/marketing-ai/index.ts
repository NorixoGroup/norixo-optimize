export {
  canProviderSupportAgent,
  getAgentsForProvider,
  getCapabilitiesCoverage,
  getProvidersForAgent,
} from "./capabilityResolver";
export type { MarketingAiCapabilityCoverage } from "./capabilityResolver";
export {
  resolveBestModelForAgent,
  resolveBestProviderForAgent,
  resolveMarketingAiExecutionPlan,
} from "./routingResolver";
export type { MarketingAiRoutingPlan } from "./routingResolver";
export { MARKETING_AI_AGENT_REGISTRY } from "./agentRegistry";
export {
  getExecutableMarketingAiAgents,
  getMarketingAiAgentsByCapability,
  getMarketingAiAgentsByPreferredProvider,
  resolveMarketingAiAgent,
} from "./agentResolver";
export type {
  MarketingAiAgentDefinition,
  MarketingAiAgentId,
  MarketingAiAgentStatus,
} from "./agentTypes";
export { MARKETING_AI_PROVIDER_CAPABILITIES } from "./providerCapabilities";
export { MARKETING_AI_PROVIDER_REGISTRY } from "./providerRegistry";
export {
  getConnectedMarketingAiProviders,
  getMarketingAiModelCatalog,
  getMarketingAiProvidersByCapability,
  resolveMarketingAiProvider,
} from "./providerResolver";
export type {
  MarketingAiProviderDefinition,
  ProviderCapability,
  ProviderCategory,
  ProviderId,
  ProviderStatus,
} from "./providerTypes";

export {
  getAllProviderConnections,
  getConnectionSummary,
  getProviderConnectionState,
  isProviderAvailable,
} from "./connectionManager";

export {
  getMarketingAiExecutionSimulation,
} from "./executionSimulator";
export type {
  MarketingAiExecutionSimulation,
  MarketingAiExecutionSimulationStep,
} from "./executionSimulator";

export {
  createDefaultMarketingCampaign,
  isMarketingCampaign,
  normalizeCampaignFormat,
  normalizeCampaignObjective,
  normalizeCampaignPlatform,
  normalizeCampaignStatus,
} from "./campaigns/campaignModel";
export type {
  CreateDefaultMarketingCampaignInput,
  MarketingCampaign,
  MarketingCampaignFormat,
  MarketingCampaignObjective,
  MarketingCampaignPlatform,
  MarketingCampaignStatus,
} from "./campaigns/campaignModel";
export {
  addCampaignGeneratedVariant,
  addCampaignMemoryEntry,
  addCampaignMemoryWarning,
  addCampaignPublishedTopic,
  addCampaignUsedFormat,
  createCampaignMemoryFromCampaign,
  isMarketingCampaignMemory,
} from "./campaigns/campaignMemory";
export type {
  MarketingCampaignGeneratedVariant,
  MarketingCampaignMemory,
  MarketingCampaignMemoryEntry,
  MarketingCampaignMemoryWarning,
} from "./campaigns/campaignMemory";
export {
  addQualityImprovement,
  addQualityIssue,
  addQualityWarning,
  calculateQualityGrade,
  createEmptyQualityGateResult,
  isMarketingQualityGateResult,
} from "./quality/qualityGate";
export type {
  MarketingQualityCheckType,
  MarketingQualityGateResult,
  MarketingQualityGrade,
  MarketingQualityImprovement,
  MarketingQualityIssue,
  MarketingQualityWarning,
} from "./quality/qualityGate";
export {
  createPublicationPack,
  isPublicationPack,
  normalizePublicationPackPlatform,
  normalizePublicationPackStatus,
} from "./publication/publicationPack";
export {
  buildPublicationPack,
  isPublicationPackBuilderInput,
} from "./publication/publicationPackBuilder";
export {
  approvePublicationPack,
  markReadyForReview,
  rejectPublicationPack,
  resetPublicationPackToDraft,
} from "./publication/publicationReview";

export {
  createPublicationWorkspace,
  isPublicationWorkspace,
  normalizePublicationWorkspaceStatus,
} from "./publication/publicationWorkspace";
export type {
  CreatePublicationPackInput,
  PublicationPack,
  PublicationPackAssetRef,
  PublicationPackAssetType,
  PublicationPackPlatform,
  PublicationPackStatus,
} from "./publication/publicationPack";
export type { PublicationPackBuilderInput } from "./publication/publicationPackBuilder";
export type {
  CreatePublicationWorkspaceInput,
  PublicationWorkspace,
  PublicationWorkspaceHistoryEntry,
  PublicationWorkspaceStatus,
} from "./publication/publicationWorkspace";

export {
  createMarketingCommunity,
  isMarketingCommunity,
  normalizeCommunityActivity,
  normalizeCommunityPlatform,
  normalizeCommunityRelevance,
  normalizeCommunityType,
} from "./community/communityModel";

export type {
  CreateMarketingCommunityInput,
  MarketingCommunity,
  MarketingCommunityActivity,
  MarketingCommunityPlatform,
  MarketingCommunityRelevance,
  MarketingCommunityType,
} from "./community/communityModel";

export {
  createCommunityWorkspace,
  isCommunityWorkspace,
  normalizeCommunityWorkspaceStatus,
} from "./community/communityWorkspace";

export type {
  CommunityWorkspace,
  CommunityWorkspaceHistoryEntry,
  CommunityWorkspaceStatus,
  CreateCommunityWorkspaceInput,
} from "./community/communityWorkspace";

export {
  approveCommunityWorkspace,
  markCommunityReadyForReview,
  rejectCommunityWorkspace,
  resetCommunityWorkspaceToDraft,
} from "./community/communityReview";

export {
  buildCommunityWorkspace,
  isCommunityWorkspaceBuilderInput,
} from "./community/communityWorkspaceBuilder";

export type { CommunityWorkspaceBuilderInput } from "./community/communityWorkspaceBuilder";
