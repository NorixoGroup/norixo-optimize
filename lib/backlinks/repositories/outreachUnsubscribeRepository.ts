import { BacklinkRepositoryError } from "./errors";

export type BacklinkOutreachUnsubscribeSource = "hosted_unsubscribe" | "admin_unsubscribe" | "inbound_reply";

export type ApplyBacklinkOutreachUnsubscribeInput = {
  workspaceId: string;
  outreachId: string;
  source: BacklinkOutreachUnsubscribeSource;
  appliedAt?: string;
};

export type ApplyBacklinkOutreachUnsubscribeResult = {
  disposition: "applied" | "existing";
  outreachId: string;
  outreachStatus: string;
  emailSuppressed: true;
  closedOutreachCount: number;
  appliedAt: string;
};

type RpcRow = {
  disposition: string;
  outreach_id: string;
  outreach_status: string;
  email_suppressed: boolean;
  closed_outreach_count: number;
  applied_at: string;
};

/** Minimal structural client: the RPC is intentionally not part of the generated Database types yet. */
export type ApplyBacklinkOutreachUnsubscribeRpcClient = {
  rpc(
    name: "apply_backlink_outreach_unsubscribe",
    args: { p_workspace_id: string; p_outreach_id: string; p_source: string; p_applied_at?: string },
  ): PromiseLike<{ data: RpcRow[] | null; error: unknown }>;
};

const OPERATION = "applyBacklinkOutreachUnsubscribe";

function stableMessage(error: unknown): string | null {
  return typeof error === "object" && error !== null && "message" in error && typeof (error as { message: unknown }).message === "string"
    ? (error as { message: string }).message
    : null;
}

function normalizeRpcError(error: unknown): BacklinkRepositoryError {
  const message = stableMessage(error);
  if (message === "BACKLINK_UNSUBSCRIBE_OUTREACH_NOT_FOUND") {
    return new BacklinkRepositoryError({ code: "NOT_FOUND", operation: OPERATION, message: "The outreach was not found." });
  }
  if (message === "BACKLINK_UNSUBSCRIBE_EMAIL_UNAVAILABLE" || message === "BACKLINK_UNSUBSCRIBE_INVALID") {
    return new BacklinkRepositoryError({ code: "VALIDATION", operation: OPERATION, message: "The unsubscribe request is not applicable to this outreach." });
  }
  return new BacklinkRepositoryError({ code: "DATABASE", operation: OPERATION, message: "The unsubscribe could not be recorded." });
}

export async function applyBacklinkOutreachUnsubscribe(
  client: ApplyBacklinkOutreachUnsubscribeRpcClient,
  input: ApplyBacklinkOutreachUnsubscribeInput,
): Promise<ApplyBacklinkOutreachUnsubscribeResult> {
  const workspaceId = input.workspaceId.trim();
  const outreachId = input.outreachId.trim();
  if (!workspaceId || !outreachId) {
    throw new BacklinkRepositoryError({ code: "VALIDATION", operation: OPERATION, message: "workspaceId and outreachId are required." });
  }
  const { data, error } = await client.rpc("apply_backlink_outreach_unsubscribe", {
    p_workspace_id: workspaceId,
    p_outreach_id: outreachId,
    p_source: input.source,
    ...(input.appliedAt ? { p_applied_at: input.appliedAt } : {}),
  });
  if (error != null) throw normalizeRpcError(error);
  if (!Array.isArray(data) || data.length !== 1) {
    throw new BacklinkRepositoryError({ code: "DATABASE", operation: OPERATION, message: "The database returned an invalid unsubscribe result." });
  }
  const row = data[0];
  if ((row.disposition !== "applied" && row.disposition !== "existing") || row.email_suppressed !== true) {
    throw new BacklinkRepositoryError({ code: "DATABASE", operation: OPERATION, message: "The database returned an invalid unsubscribe result." });
  }
  return {
    disposition: row.disposition,
    outreachId: row.outreach_id,
    outreachStatus: row.outreach_status,
    emailSuppressed: true,
    closedOutreachCount: row.closed_outreach_count,
    appliedAt: row.applied_at,
  };
}
