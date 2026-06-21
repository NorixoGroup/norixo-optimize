import type { ProviderCapability, ProviderId } from "./providerTypes";

export type MarketingAiAgentId =
  | "marketing-manager"
  | "campaign"
  | "content"
  | "localization"
  | "image"
  | "video"
  | "publication"
  | "analytics"
  | "learning";

export type MarketingAiAgentStatus =
  | "planned"
  | "not_active"
  | "simulation"
  | "read_only";

export type MarketingAiAgentDefinition = {
  id: MarketingAiAgentId;
  name: string;
  role: string;
  description: string;
  status: MarketingAiAgentStatus;
  requiredCapabilities: ProviderCapability[];
  preferredProviderIds: ProviderId[];
  preferredModels: string[];
  inputType: string;
  outputType: string;
  isExecutable: false;
};
