import type { Database } from "@/types/database.types";

type SetAuthRpcName = "set_backlink_promotion_auto_apply_authorization";
type SetAuthRpcArgs = Database["public"]["Functions"][SetAuthRpcName]["Args"];

type SetAuthRpcClient = {
  rpc: (
    functionName: SetAuthRpcName,
    args: SetAuthRpcArgs,
  ) => PromiseLike<{ data: unknown; error: unknown }>;
};

export type BacklinkPromotionAutoApplyAuthorizationErrorCode =
  | "PROMOTION_AUTO_APPLY_AUTHORIZATION_UNAUTHORIZED"
  | "PROMOTION_AUTO_APPLY_AUTHORIZATION_WORKSPACE_NOT_FOUND"
  | "PROMOTION_AUTO_APPLY_AUTHORIZATION_RESULT_INVALID"
  | "PROMOTION_AUTO_APPLY_AUTHORIZATION_RPC_FAILED";

export class BacklinkPromotionAutoApplyAuthorizationError extends Error {
  readonly code: BacklinkPromotionAutoApplyAuthorizationErrorCode;

  constructor(code: BacklinkPromotionAutoApplyAuthorizationErrorCode) {
    super("The promotion auto-apply authorization operation could not be completed.");
    this.name = "BacklinkPromotionAutoApplyAuthorizationError";
    this.code = code;
  }
}

export type SetBacklinkPromotionAutoApplyAuthorizationResult = {
  enabled: boolean;
  authorizedBy: string | null;
  authorizedAt: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const KNOWN_CODES: readonly BacklinkPromotionAutoApplyAuthorizationErrorCode[] = [
  "PROMOTION_AUTO_APPLY_AUTHORIZATION_UNAUTHORIZED",
  "PROMOTION_AUTO_APPLY_AUTHORIZATION_WORKSPACE_NOT_FOUND",
];

function isKnownCode(value: string): value is BacklinkPromotionAutoApplyAuthorizationErrorCode {
  return (KNOWN_CODES as readonly string[]).includes(value);
}

function readErrorCode(error: unknown): BacklinkPromotionAutoApplyAuthorizationErrorCode | null {
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
export async function setBacklinkPromotionAutoApplyAuthorization(
  client: SetAuthRpcClient,
  input: { workspaceId: string; enabled: boolean },
): Promise<SetBacklinkPromotionAutoApplyAuthorizationResult> {
  const { data, error } = await client.rpc("set_backlink_promotion_auto_apply_authorization", {
    p_workspace_id: input.workspaceId,
    p_enabled: input.enabled,
  });

  if (error !== null) {
    const code = readErrorCode(error);
    throw new BacklinkPromotionAutoApplyAuthorizationError(code ?? "PROMOTION_AUTO_APPLY_AUTHORIZATION_RPC_FAILED");
  }
  if (!Array.isArray(data) || data.length !== 1 || !isRecord(data[0])) {
    throw new BacklinkPromotionAutoApplyAuthorizationError("PROMOTION_AUTO_APPLY_AUTHORIZATION_RESULT_INVALID");
  }

  const row = data[0];
  if (typeof row.promotion_auto_apply_enabled !== "boolean") {
    throw new BacklinkPromotionAutoApplyAuthorizationError("PROMOTION_AUTO_APPLY_AUTHORIZATION_RESULT_INVALID");
  }

  return {
    enabled: row.promotion_auto_apply_enabled,
    authorizedBy: typeof row.promotion_auto_apply_authorized_by === "string" ? row.promotion_auto_apply_authorized_by : null,
    authorizedAt: typeof row.promotion_auto_apply_authorized_at === "string" ? row.promotion_auto_apply_authorized_at : null,
  };
}
