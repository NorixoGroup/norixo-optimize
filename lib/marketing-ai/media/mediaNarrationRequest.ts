export type MediaNarrationPurpose = "video_voiceover";

export type MediaNarrationRequest = {
  id: string;
  campaignId: string;
  text: string;
  language: string;
  purpose: MediaNarrationPurpose;
  providerHint?: string;
  voiceHint?: string;
  relatedVideoAssetId?: string;
};
