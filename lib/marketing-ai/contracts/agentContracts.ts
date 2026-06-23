import type { PublicationPack } from "../publication/publicationPack";

export type AgentQuality = {
  qualityScore: number;
  warnings: string[];
  improvements: string[];
};

export type MarketingBrainBrief = {
  campaignGoal: string;
  targetAudience: string;
  personas: string[];
  pains: string[];
  desires: string[];
  positioning: string;
  valueProposition: string;
  keyMessages: string[];
  objections: string[];
  tone: string;
  channels: string[];
  funnelStage: string;
  recommendedFormats: string[];
  recommendedCadence: string;
  seoTopics: string[];
  ctaStrategy: string;
  successMetrics: string[];
};

export type PlannerInput = {
  brief: MarketingBrainBrief;
  channels: string[];
  timeframe: string;
  language: string;
};

export type PlannerItem = {
  day: number;
  channel: string;
  format: string;
  topic: string;
  goal: string;
  angle: string;
  cta: string;
  target: string;
  notes: string;
};

export type PlannerOutput = AgentQuality & {
  campaign: string;
  timeframe: string;
  objective: string;
  items: PlannerItem[];
};

export type SocialInput = {
  brief: MarketingBrainBrief;
  planning: PlannerOutput;
  language: string;
  targetPlatform: string;
};

export type SocialOutput = AgentQuality & {
  title: string;
  hook: string;
  caption: string;
  hashtags: string[];
  cta: string;
  imageIdea: string;
  imagePrompt: string;
  videoPrompt: string;
  recommendedPublishTime: string;
  targetPlatform: string;
  approvalChecklist: string[];
};

export type CreativeInput = {
  brief: MarketingBrainBrief;
  planning: PlannerOutput;
  social: SocialOutput;
  language: string;
};

export type CreativeOutput = AgentQuality & {
  creativeConcept: string;
  visualStyle: string;
  layout: string;
  mainTextOverlay: string;
  secondaryTextOverlay: string;
  assetFormat: string;
  gptImagePrompt: string;
  negativePrompt: string;
  brandChecklist: string[];
};

export type VideoInput = {
  brief: MarketingBrainBrief;
  planning: PlannerOutput;
  social: SocialOutput;
  creative: CreativeOutput;
  language: string;
  duration: string;
  format: string;
};

export type VideoScene = {
  scene: number;
  duration: string;
  visual: string;
  onScreenText: string;
  voiceOver: string;
  transition: string;
};

export type VideoOutput = AgentQuality & {
  videoTitle: string;
  duration: string;
  format: string;
  hook: string;
  voiceOver: string;
  scenes: VideoScene[];
  musicDirection: string;
  caption: string;
  cta: string;
  editingNotes: string;
  assetChecklist: string[];
};

export type PublisherInput = {
  pack: PublicationPack;
};

export type PublisherOutput = {
  finalTitle: string;
  finalCaption: string;
  finalCta: string;
  finalHashtags: string[];
  platformNotes: string[];
  manualPublishChecklist: string[];
  warnings: string[];
  approvalRequired: true;
};
