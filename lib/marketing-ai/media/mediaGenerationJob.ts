import type { MediaAssetRequest } from "./mediaAssetRequest";
import type { MediaProviderGenerateResult } from "./mediaProviderAdapter";

export type MediaGenerationJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type MediaGenerationJob = {
  id: string;
  request: MediaAssetRequest;
  status: MediaGenerationJobStatus;
  providerId?: string | null;
  externalJobId?: string | null;
  attempts: number;
  maxAttempts: number;
  result?: MediaProviderGenerateResult | null;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
};
