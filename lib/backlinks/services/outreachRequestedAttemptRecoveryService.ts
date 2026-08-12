import type {
  BacklinkOutreachAttemptRow,
  BacklinkOutreachAttemptStatePatch,
} from "../repositories/outreachAttemptsRepository";

export const REQUESTED_ATTEMPT_RECOVERY_GRACE_SECONDS = 15 * 60;
export const REQUESTED_ATTEMPT_RECOVERY_ERROR_CODE = "OUTREACH_PROVIDER_RESULT_UNCONFIRMED";
export const REQUESTED_ATTEMPT_RECOVERY_ERROR_MESSAGE = "Provider result was not confirmed after the requested Attempt grace period.";

export type BacklinkOutreachRequestedAttemptRecoveryErrorCode =
  | "REQUESTED_ATTEMPT_OUTREACH_MISMATCH"
  | "REQUESTED_ATTEMPT_RECOVERY_TOO_EARLY"
  | "REQUESTED_ATTEMPT_RECOVERY_INTEGRITY_CONFLICT"
  | "REQUESTED_ATTEMPT_RECOVERY_STATE_CONFLICT";

export class BacklinkOutreachRequestedAttemptRecoveryError extends Error {
  constructor(public readonly code: BacklinkOutreachRequestedAttemptRecoveryErrorCode) {
    super(code);
    this.name = "BacklinkOutreachRequestedAttemptRecoveryError";
  }
}

export type BacklinkOutreachRequestedAttemptRecoveryResult = {
  disposition: "updated" | "existing";
  attemptId: string;
  outreachId: string;
  attemptStatus: "unknown";
  errorCode: typeof REQUESTED_ATTEMPT_RECOVERY_ERROR_CODE;
};

export type BacklinkOutreachRequestedAttemptRecoveryDependencies = {
  getAttempt(workspaceId: string, attemptId: string): Promise<BacklinkOutreachAttemptRow>;
  recoverRequestedAttempt(
    workspaceId: string,
    attemptId: string,
    patch: BacklinkOutreachAttemptStatePatch,
  ): Promise<BacklinkOutreachAttemptRow | null>;
  now?: () => string;
};

function parseTime(value: string | null): number | null {
  if (value == null) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function assertSameRecovery(attempt: BacklinkOutreachAttemptRow): BacklinkOutreachRequestedAttemptRecoveryResult {
  if (
    attempt.status === "unknown" &&
    attempt.error_code === REQUESTED_ATTEMPT_RECOVERY_ERROR_CODE &&
    attempt.error_message === REQUESTED_ATTEMPT_RECOVERY_ERROR_MESSAGE
  ) {
    return {
      disposition: "existing",
      attemptId: attempt.id,
      outreachId: attempt.outreach_id,
      attemptStatus: "unknown",
      errorCode: REQUESTED_ATTEMPT_RECOVERY_ERROR_CODE,
    };
  }
  throw new BacklinkOutreachRequestedAttemptRecoveryError("REQUESTED_ATTEMPT_RECOVERY_STATE_CONFLICT");
}

export function recoverBacklinkOutreachRequestedAttempt(
  dependencies: BacklinkOutreachRequestedAttemptRecoveryDependencies,
) {
  return async (input: {
    workspaceId: string;
    actorUserId: string;
    outreachId: string;
    attemptId: string;
  }): Promise<BacklinkOutreachRequestedAttemptRecoveryResult> => {
    const attempt = await dependencies.getAttempt(input.workspaceId, input.attemptId);
    if (attempt.outreach_id !== input.outreachId) {
      throw new BacklinkOutreachRequestedAttemptRecoveryError("REQUESTED_ATTEMPT_OUTREACH_MISMATCH");
    }
    if (attempt.status === "unknown") {
      return assertSameRecovery(attempt);
    }
    if (attempt.status !== "requested") {
      throw new BacklinkOutreachRequestedAttemptRecoveryError("REQUESTED_ATTEMPT_RECOVERY_STATE_CONFLICT");
    }

    const requestedAt = parseTime(attempt.requested_at);
    const now = Date.parse((dependencies.now ?? (() => new Date().toISOString()))());
    if (requestedAt == null || !Number.isFinite(now)) {
      throw new BacklinkOutreachRequestedAttemptRecoveryError("REQUESTED_ATTEMPT_RECOVERY_INTEGRITY_CONFLICT");
    }
    if (requestedAt + REQUESTED_ATTEMPT_RECOVERY_GRACE_SECONDS * 1000 > now) {
      throw new BacklinkOutreachRequestedAttemptRecoveryError("REQUESTED_ATTEMPT_RECOVERY_TOO_EARLY");
    }

    const recovered = await dependencies.recoverRequestedAttempt(input.workspaceId, attempt.id, {
      status: "unknown",
      accepted_at: null,
      failed_at: null,
      resolved_at: null,
      error_code: REQUESTED_ATTEMPT_RECOVERY_ERROR_CODE,
      error_message: REQUESTED_ATTEMPT_RECOVERY_ERROR_MESSAGE,
    });
    if (recovered != null) {
      return {
        disposition: "updated",
        attemptId: recovered.id,
        outreachId: recovered.outreach_id,
        attemptStatus: "unknown",
        errorCode: REQUESTED_ATTEMPT_RECOVERY_ERROR_CODE,
      };
    }

    const canonical = await dependencies.getAttempt(input.workspaceId, attempt.id);
    return assertSameRecovery(canonical);
  };
}
