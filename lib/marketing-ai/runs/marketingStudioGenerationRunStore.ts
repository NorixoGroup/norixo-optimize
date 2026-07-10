import type {
  MarketingStudioOrchestratorV2Input,
  MarketingStudioOrchestratorV2Result,
} from "../orchestrator/marketingStudioOrchestratorV2";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type MarketingStudioGenerationRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "abandoned";

export type MarketingStudioGenerationRunRecord = {
  id: string;
  campaignId: string;
  workspaceId: string;
  createdBy: string | null;
  submissionKey: string;
  requestId: string;
  status: MarketingStudioGenerationRunStatus;
  input: MarketingStudioOrchestratorV2Input;
  errorMessage: string | null;
  workerId: string | null;
  heartbeatAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MarketingStudioGenerationRunStatusView = {
  id: string;
  campaignId: string;
  requestId: string;
  status: MarketingStudioGenerationRunStatus;
  errorMessage: string | null;
  workerId: string | null;
  heartbeatAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EnqueueMarketingStudioGenerationRunResult = {
  runId: string;
  campaignId: string;
  status: MarketingStudioGenerationRunStatus;
  wasCreated: boolean;
};

type StoredGenerationRunRow = {
  id: string;
  campaign_id: string;
  workspace_id: string;
  created_by: string | null;
  submission_key: string;
  request_id: string;
  status: MarketingStudioGenerationRunStatus;
  input_json: MarketingStudioOrchestratorV2Input;
  error_message: string | null;
  worker_id: string | null;
  heartbeat_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  created_at: string;
  updated_at: string;
};

type EnqueueRpcRow = {
  run_id: string;
  campaign_id: string;
  status: MarketingStudioGenerationRunStatus;
  was_created: boolean;
};

const RUN_ERROR_REDACTION = "[REDACTED]";
const RUN_ERROR_MAX_LENGTH = 1000;

function replaceCaseInsensitiveLiteral(
  value: string,
  needle: string,
  replacement: string,
) {
  if (!needle) {
    return value;
  }

  const escapedNeedle = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return value.replace(new RegExp(escapedNeedle, "gi"), replacement);
}

function redactKnownSecretValues(value: string) {
  let sanitized = value;
  const secretValues = [
    process.env.OPENAI_API_KEY,
    process.env.FAL_KEY,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  ].filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);

  for (const secretValue of secretValues) {
    sanitized = replaceCaseInsensitiveLiteral(
      sanitized,
      secretValue,
      RUN_ERROR_REDACTION,
    );
  }

  return sanitized;
}

export function sanitizeMarketingStudioRunError(error: unknown): string {
  const rawValue = error instanceof Error ? error.message : String(error ?? "");
  let sanitized = rawValue.trim() || "Marketing Studio generation failed.";

  sanitized = redactKnownSecretValues(sanitized);
  sanitized = sanitized.replace(
    /Authorization:\s*Bearer\s+[^\s"']+/gi,
    `Authorization: Bearer ${RUN_ERROR_REDACTION}`,
  );
  sanitized = sanitized.replace(
    /\bBearer\s+[A-Za-z0-9._~+/=-]+\b/g,
    `Bearer ${RUN_ERROR_REDACTION}`,
  );
  sanitized = sanitized.replace(
    /([?&](?:token|access_token|api_key|key|signature|sig)=)[^&#\s]+/gi,
    `$1${RUN_ERROR_REDACTION}`,
  );

  if (sanitized.length > RUN_ERROR_MAX_LENGTH) {
    sanitized = sanitized.slice(0, RUN_ERROR_MAX_LENGTH);
  }

  return sanitized || "Marketing Studio generation failed.";
}

function parseChannels(value: unknown): MarketingStudioOrchestratorV2Input["channels"] {
  const channels = Array.isArray(value)
    ? value
        .filter((channel): channel is string => typeof channel === "string")
        .map((channel) => channel.trim().toLowerCase())
        .filter((channel) => channel.length > 0)
    : [];

  return channels.length > 0
    ? channels
    : ["facebook", "instagram", "linkedin", "tiktok"];
}

export function buildMarketingStudioOrchestratorInput(
  body: Record<string, unknown>,
): MarketingStudioOrchestratorV2Input {
  return {
    name:
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim()
        : "Campagne marketing mensuelle",
    objective:
      typeof body.objective === "string" && body.objective.trim()
        ? body.objective.trim()
        : "Faire découvrir Norixo Optimize aux conciergeries et aux hôtes professionnels.",
    audience:
      typeof body.audience === "string" && body.audience.trim()
        ? body.audience.trim()
        : "Hôtes et conciergeries",
    language: typeof body.language === "string" ? body.language : "fr",
    tone: typeof body.tone === "string" ? body.tone : "professional",
    cta:
      typeof body.cta === "string" && body.cta.trim()
        ? body.cta.trim()
        : "Découvrir Norixo.io",
    durationDays:
      typeof body.durationDays === "number" && Number.isFinite(body.durationDays)
        ? body.durationDays
        : 30,
    channels: parseChannels(body.channels),
  };
}

export function buildMarketingStudioTimeframeLabel(
  input: MarketingStudioOrchestratorV2Input,
): string {
  const durationDays =
    typeof input.durationDays === "number" && Number.isFinite(input.durationDays)
      ? input.durationDays
      : 30;
  return `${durationDays} jours`;
}

function mapStoredRunRow(row: StoredGenerationRunRow): MarketingStudioGenerationRunRecord {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    workspaceId: row.workspace_id,
    createdBy: row.created_by ?? null,
    submissionKey: row.submission_key,
    requestId: row.request_id,
    status: row.status,
    input: row.input_json,
    errorMessage: row.error_message ?? null,
    workerId: row.worker_id ?? null,
    heartbeatAt: row.heartbeat_at ?? null,
    startedAt: row.started_at ?? null,
    completedAt: row.completed_at ?? null,
    failedAt: row.failed_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapStoredRunStatusView(
  row: StoredGenerationRunRow,
): MarketingStudioGenerationRunStatusView {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    requestId: row.request_id,
    status: row.status,
    errorMessage: row.error_message ?? null,
    workerId: row.worker_id ?? null,
    heartbeatAt: row.heartbeat_at ?? null,
    startedAt: row.started_at ?? null,
    completedAt: row.completed_at ?? null,
    failedAt: row.failed_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function parseClaimedMarketingStudioGenerationRun(
  data: StoredGenerationRunRow | StoredGenerationRunRow[] | null | undefined,
): MarketingStudioGenerationRunRecord | null {
  const row = (
    Array.isArray(data) ? (data[0] ?? null) : (data ?? null)
  ) as StoredGenerationRunRow | null;

  if (!row || typeof row.id !== "string" || row.id.trim().length === 0) {
    return null;
  }

  return mapStoredRunRow(row);
}

function parseOutput(output: unknown) {
  if (typeof output !== "string") {
    return null;
  }

  try {
    return JSON.parse(output);
  } catch {
    return null;
  }
}

function buildCampaignUpdatePayload(
  result: MarketingStudioOrchestratorV2Result,
  fallbackInput: MarketingStudioOrchestratorV2Input,
) {
  const plannerJson = parseOutput(result?.planner?.output);
  const socialJson = parseOutput(result?.social?.output);
  const creativeJson = parseOutput(result?.creative?.output);
  const videoJson = parseOutput(result?.video?.output);
  const generatedCampaign = result.bundle.campaign;

  return {
    name: generatedCampaign?.name ?? fallbackInput.name,
    objective: plannerJson?.objective ?? generatedCampaign?.objective ?? fallbackInput.objective,
    language: generatedCampaign?.language ?? fallbackInput.language,
    timeframe:
      plannerJson?.timeframe ??
      buildMarketingStudioTimeframeLabel(fallbackInput),
    channels:
      Array.isArray(generatedCampaign?.platforms) && generatedCampaign.platforms.length > 0
        ? generatedCampaign.platforms
        : fallbackInput.channels,
    status: "draft",
    planner_json: plannerJson,
    social_json: socialJson,
    creative_json: creativeJson,
    video_json: videoJson,
    raw_result: result,
    updated_at: new Date().toISOString(),
  };
}

export async function enqueueMarketingStudioGenerationRun(params: {
  workspaceId: string;
  createdBy: string;
  submissionKey: string;
  requestId: string;
  input: MarketingStudioOrchestratorV2Input;
}): Promise<EnqueueMarketingStudioGenerationRunResult> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc(
    "enqueue_marketing_studio_generation_run",
    {
      p_workspace_id: params.workspaceId,
      p_created_by: params.createdBy,
      p_submission_key: params.submissionKey,
      p_request_id: params.requestId,
      p_name: params.input.name,
      p_objective: params.input.objective,
      p_language: params.input.language,
      p_timeframe: buildMarketingStudioTimeframeLabel(params.input),
      p_channels: (params.input.channels ?? [
        "facebook",
        "instagram",
        "linkedin",
        "tiktok",
      ]).map((channel) => channel),
      p_input_json: params.input,
    },
  );

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? (data[0] as EnqueueRpcRow | undefined) : undefined;

  if (!row?.run_id || !row.campaign_id) {
    throw new Error("Marketing Studio generation enqueue failed.");
  }

  return {
    runId: row.run_id,
    campaignId: row.campaign_id,
    status: row.status,
    wasCreated: row.was_created,
  };
}

export async function readMarketingStudioGenerationRunStatus(params: {
  runId: string;
  workspaceId: string;
}): Promise<MarketingStudioGenerationRunStatusView | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("marketing_studio_generation_runs")
    .select(
      "id,campaign_id,workspace_id,created_by,submission_key,request_id,status,input_json,error_message,worker_id,heartbeat_at,started_at,completed_at,failed_at,created_at,updated_at",
    )
    .eq("id", params.runId)
    .eq("workspace_id", params.workspaceId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const row = (data ?? null) as StoredGenerationRunRow | null;
  return row ? mapStoredRunStatusView(row) : null;
}

export async function claimNextMarketingStudioGenerationRun(params: {
  workerId: string;
}): Promise<MarketingStudioGenerationRunRecord | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc(
    "claim_marketing_studio_generation_run",
    {
      p_worker_id: params.workerId,
    },
  );

  if (error) {
    throw error;
  }

  return parseClaimedMarketingStudioGenerationRun(
    data as StoredGenerationRunRow | StoredGenerationRunRow[] | null | undefined,
  );
}

export async function heartbeatOwnedMarketingStudioGenerationRun(params: {
  runId: string;
  workerId: string;
}): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc(
    "heartbeat_marketing_studio_generation_run",
    {
      p_run_id: params.runId,
      p_worker_id: params.workerId,
    },
  );

  if (error) {
    throw error;
  }

  return data === true;
}

export async function markMarketingStudioGenerationRunCompleted(params: {
  runId: string;
  campaignId: string;
  input: MarketingStudioOrchestratorV2Input;
  result: MarketingStudioOrchestratorV2Result;
}) {
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const campaignPayload = buildCampaignUpdatePayload(params.result, params.input);

  const { error: campaignError } = await admin
    .from("marketing_campaigns")
    .update(campaignPayload)
    .eq("id", params.campaignId);

  if (campaignError) {
    throw campaignError;
  }

  const { error: runError } = await admin
    .from("marketing_studio_generation_runs")
    .update({
      status: "completed",
      error_message: null,
      completed_at: now,
      updated_at: now,
    })
    .eq("id", params.runId);

  if (runError) {
    throw runError;
  }
}

export async function markMarketingStudioGenerationRunFailed(params: {
  runId: string;
  error: unknown;
}) {
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin
    .from("marketing_studio_generation_runs")
    .update({
      status: "failed",
      error_message: sanitizeMarketingStudioRunError(params.error),
      failed_at: now,
      updated_at: now,
    })
    .eq("id", params.runId);

  if (error) {
    throw error;
  }
}

export type MarketingStudioGenerationRunProcessorStore = {
  claimNextQueuedRun: (params: {
    workerId: string;
  }) => Promise<MarketingStudioGenerationRunRecord | null>;
  heartbeatOwnedRun: (params: {
    runId: string;
    workerId: string;
  }) => Promise<boolean>;
  completeRun: (params: {
    runId: string;
    campaignId: string;
    input: MarketingStudioOrchestratorV2Input;
    result: MarketingStudioOrchestratorV2Result;
  }) => Promise<void>;
  failRun: (params: { runId: string; error: unknown }) => Promise<void>;
};

export function createSupabaseMarketingStudioGenerationRunProcessorStore(): MarketingStudioGenerationRunProcessorStore {
  return {
    claimNextQueuedRun: claimNextMarketingStudioGenerationRun,
    heartbeatOwnedRun: heartbeatOwnedMarketingStudioGenerationRun,
    completeRun: markMarketingStudioGenerationRunCompleted,
    failRun: markMarketingStudioGenerationRunFailed,
  };
}
