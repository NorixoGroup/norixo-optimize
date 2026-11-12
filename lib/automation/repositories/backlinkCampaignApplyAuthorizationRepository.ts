import type { Database } from "@/types/database.types";

type SetAuthRpcName = "set_backlink_campaign_apply_authorization";
type SetAuthRpcArgs = Database["public"]["Functions"][SetAuthRpcName]["Args"];

type SetAuthRpcClient = {
  rpc: (
    functionName: SetAuthRpcName,
    args: SetAuthRpcArgs,
  ) => PromiseLike<{ data: unknown; error: unknown }>;
};

export type BacklinkCampaignApplyAuthorizationErrorCode =
  | "CAMPAIGN_APPLY_AUTHORIZATION_UNAUTHORIZED"
  | "CAMPAIGN_APPLY_AUTHORIZATION_WORKSPACE_NOT_FOUND"
  | "CAMPAIGN_APPLY_AUTHORIZATION_RESULT_INVALID"
  | "CAMPAIGN_APPLY_AUTHORIZATION_RPC_FAILED";

export class BacklinkCampaignApplyAuthorizationError extends Error {
  readonly code: BacklinkCampaignApplyAuthorizationErrorCode;

  constructor(code: BacklinkCampaignApplyAuthorizationErrorCode) {
    super("The campaign-apply authorization operation could not be completed.");
    this.name = "BacklinkCampaignApplyAuthorizationError";
    this.code = code;
  }
}

export type SetBacklinkCampaignApplyAuthorizationResult = {
  enabled: boolean;
  authorizedBy: string | null;
  authorizedAt: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const KNOWN_CODES: readonly BacklinkCampaignApplyAuthorizationErrorCode[] = [
  "CAMPAIGN_APPLY_AUTHORIZATION_UNAUTHORIZED",
  "CAMPAIGN_APPLY_AUTHORIZATION_WORKSPACE_NOT_FOUND",
];

function isKnownCode(value: string): value is BacklinkCampaignApplyAuthorizationErrorCode {
  return (KNOWN_CODES as readonly string[]).includes(value);
}

function readErrorCode(error: unknown): BacklinkCampaignApplyAuthorizationErrorCode | null {
  if (!isRecord(error)) return null;
  const message = error.message;
  if (typeof message === "string" && isKnownCode(message)) return message;
  const code = error.code;
  if (typeof code === "string" && isKnownCode(code)) return code;
  return null;
}

/**
 * Calls the double-authorized grant/revoke RPC with the caller's own
 * authenticated client — never the admin client. The RPC's own auth.uid()
 * check is the actual enforcement; this function does not attempt to
 * re-implement it.
 */
export async function setBacklinkCampaignApplyAuthorization(
  client: SetAuthRpcClient,
  input: { workspaceId: string; enabled: boolean },
): Promise<SetBacklinkCampaignApplyAuthorizationResult> {
  const { data, error } = await client.rpc("set_backlink_campaign_apply_authorization", {
    p_workspace_id: input.workspaceId,
    p_enabled: input.enabled,
  });

  if (error !== null) {
    const code = readErrorCode(error);
    throw new BacklinkCampaignApplyAuthorizationError(code ?? "CAMPAIGN_APPLY_AUTHORIZATION_RPC_FAILED");
  }
  if (!Array.isArray(data) || data.length !== 1 || !isRecord(data[0])) {
    throw new BacklinkCampaignApplyAuthorizationError("CAMPAIGN_APPLY_AUTHORIZATION_RESULT_INVALID");
  }

  const row = data[0];
  if (typeof row.campaign_apply_authorized_enabled !== "boolean") {
    throw new BacklinkCampaignApplyAuthorizationError("CAMPAIGN_APPLY_AUTHORIZATION_RESULT_INVALID");
  }

  return {
    enabled: row.campaign_apply_authorized_enabled,
    authorizedBy: typeof row.campaign_apply_authorized_by === "string" ? row.campaign_apply_authorized_by : null,
    authorizedAt: typeof row.campaign_apply_authorized_at === "string" ? row.campaign_apply_authorized_at : null,
  };
}
