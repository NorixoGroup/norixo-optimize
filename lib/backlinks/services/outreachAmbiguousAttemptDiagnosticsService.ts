import { REQUESTED_ATTEMPT_RECOVERY_GRACE_SECONDS } from "./outreachRequestedAttemptRecoveryService";
import type { BacklinkOutreachAmbiguousAttemptPage } from "../repositories/outreachAttemptsRepository";

export type BacklinkOutreachAmbiguousAttemptDiagnostic = {
  attemptId: string;
  outreachId: string;
  status: "requested" | "unknown";
  reason: "REQUESTED_STALE_PROVIDER_RESULT_UNCONFIRMED" | "UNKNOWN_PROVIDER_RESULT";
  channel: string;
  provider: string;
  attemptKind: string;
  requestedAt: string;
  ageSeconds: number;
  hasProviderMessageId: boolean;
  errorCode: string | null;
  /** Always true: the provider may or may not have accepted the email. Never a certain failure, never a resend authorization. */
  requiresHumanReview: true;
};

export type BacklinkOutreachAmbiguousAttemptDiagnosticsResult = {
  attempts: BacklinkOutreachAmbiguousAttemptDiagnostic[];
  /** True when more eligible attempts exist than `limit`: the list is NOT exhaustive and must not be treated as complete. */
  truncated: boolean;
  limit: number;
};

export const AMBIGUOUS_ATTEMPT_DIAGNOSTICS_DEFAULT_LIMIT = 200;

export type BacklinkOutreachAmbiguousAttemptDiagnosticsDependencies = {
  listAmbiguousAttempts(workspaceId: string, requestedBefore: string, limit: number): Promise<BacklinkOutreachAmbiguousAttemptPage>;
  now?: () => string;
};

/** Strictly read-only diagnostic. Performs no write, send, retry or state change. */
export function diagnoseBacklinkOutreachAmbiguousAttempts(dependencies: BacklinkOutreachAmbiguousAttemptDiagnosticsDependencies) {
  return async (input: { workspaceId: string; limit?: number }): Promise<BacklinkOutreachAmbiguousAttemptDiagnosticsResult> => {
    const limit = input.limit ?? AMBIGUOUS_ATTEMPT_DIAGNOSTICS_DEFAULT_LIMIT;
    const nowMs = Date.parse((dependencies.now ?? (() => new Date().toISOString()))());
    const cutoffMs = nowMs - REQUESTED_ATTEMPT_RECOVERY_GRACE_SECONDS * 1000;
    const page = await dependencies.listAmbiguousAttempts(input.workspaceId, new Date(cutoffMs).toISOString(), limit);
    const rows = page.rows.slice(0, limit);
    const result: BacklinkOutreachAmbiguousAttemptDiagnostic[] = [];
    for (const row of rows) {
      const requestedMs = Date.parse(row.requested_at);
      if (!Number.isFinite(requestedMs)) continue;
      if (row.status === "requested" && requestedMs > cutoffMs) continue;
      if (row.status !== "requested" && row.status !== "unknown") continue;
      result.push({
        attemptId: row.id, outreachId: row.outreach_id, status: row.status,
        reason: row.status === "requested" ? "REQUESTED_STALE_PROVIDER_RESULT_UNCONFIRMED" : "UNKNOWN_PROVIDER_RESULT",
        channel: row.channel, provider: row.provider, attemptKind: row.attempt_kind, requestedAt: row.requested_at,
        ageSeconds: Math.max(0, Math.floor((nowMs - requestedMs) / 1000)),
        hasProviderMessageId: row.has_provider_message_id, errorCode: row.error_code, requiresHumanReview: true,
      });
    }
    // Conservative: truncated whenever the source reports more eligible rows than `limit`.
    return { attempts: result, truncated: page.truncated || page.rows.length > limit, limit };
  };
}
