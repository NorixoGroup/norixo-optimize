export type ProviderId =
  | "openai"
  | "anthropic"
  | "google"
  | "xai"
  | "meta"
  | "brevo";

export type ProviderCategory =
  | "llm"
  | "image"
  | "video"
  | "audio"
  | "social"
  | "email"
  | "analytics";

export type ProviderStatus =
  | "planned"
  | "not_connected"
  | "disabled"
  | "simulation";

export type ProviderCapability =
  | "chat"
  | "image"
  | "video"
  | "audio"
  | "embeddings"
  | "moderation"
  | "translation"
  | "socialPublishing"
  | "emailCampaigns"
  | "analytics";

export type MarketingAiProviderDefinition = {
  id: ProviderId;
  name: string;
  category: ProviderCategory[];
  status: ProviderStatus;
  capabilities: ProviderCapability[];
  models: string[];
  description: string;
  isConnected: false;
};
