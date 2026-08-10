import type {
  BacklinkOutreachAttemptRow,
  BacklinkOutreachAttemptStatePatch,
} from "../repositories/outreachAttemptsRepository";

export type BacklinkOutreachAttemptTransitionErrorCode =
  | "OUTREACH_ATTEMPT_TRANSITION_INVALID"
  | "OUTREACH_ATTEMPT_ACCEPTED_CONFLICT"
  | "OUTREACH_ATTEMPT_FAILED_CONFLICT"
  | "OUTREACH_ATTEMPT_UNKNOWN_CONFLICT";

export class BacklinkOutreachAttemptTransitionError extends Error {
  constructor(public readonly code: BacklinkOutreachAttemptTransitionErrorCode) {
    super(code);
    this.name = "BacklinkOutreachAttemptTransitionError";
  }
}

export type BacklinkOutreachAttemptTransitionDependencies = {
  getAttempt: (workspaceId: string, attemptId: string) => Promise<BacklinkOutreachAttemptRow>;
  updateAttempt: (
    workspaceId: string,
    attemptId: string,
    patch: BacklinkOutreachAttemptStatePatch,
  ) => Promise<BacklinkOutreachAttemptRow>;
  now?: () => string;
};

type AttemptTransitionResult = {
  attemptId: string;
  outreachId: string;
  status: "accepted" | "failed" | "unknown";
  disposition: "updated" | "existing";
  providerMessageId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  requestedAt: string;
  acceptedAt: string | null;
  failedAt: string | null;
  resolvedAt: string | null;
};

function result(
  attempt: BacklinkOutreachAttemptRow,
  disposition: "updated" | "existing",
): AttemptTransitionResult {
  if (
    attempt.status !== "accepted" &&
    attempt.status !== "failed" &&
    attempt.status !== "unknown"
  ) {
    throw new BacklinkOutreachAttemptTransitionError(
      "OUTREACH_ATTEMPT_TRANSITION_INVALID",
    );
  }

  return {
    attemptId: attempt.id,
    outreachId: attempt.outreach_id,
    status: attempt.status,
    disposition,
    providerMessageId: attempt.provider_message_id,
    errorCode: attempt.error_code,
    errorMessage: attempt.error_message,
    requestedAt: attempt.requested_at,
    acceptedAt: attempt.accepted_at,
    failedAt: attempt.failed_at,
    resolvedAt: attempt.resolved_at,
  };
}

function normalizeRequired(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new BacklinkOutreachAttemptTransitionError(
      "OUTREACH_ATTEMPT_TRANSITION_INVALID",
    );
  }
  return normalized;
}

function normalizeOptional(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function canTransition(attempt: BacklinkOutreachAttemptRow): boolean {
  return attempt.status === "requested" || attempt.status === "unknown";
}

export function markBacklinkOutreachAttemptAccepted(
  dependencies: BacklinkOutreachAttemptTransitionDependencies,
) {
  return async (input: {
    workspaceId: string;
    attemptId: string;
    providerMessageId: string | null;
  }): Promise<AttemptTransitionResult> => {
    const attempt = await dependencies.getAttempt(input.workspaceId, input.attemptId);
    const providerMessageId = normalizeOptional(input.providerMessageId);

    if (attempt.status === "accepted") {
      if (attempt.provider_message_id !== providerMessageId) {
        throw new BacklinkOutreachAttemptTransitionError(
          "OUTREACH_ATTEMPT_ACCEPTED_CONFLICT",
        );
      }
      return result(attempt, "existing");
    }

    if (!canTransition(attempt)) {
      throw new BacklinkOutreachAttemptTransitionError(
        "OUTREACH_ATTEMPT_TRANSITION_INVALID",
      );
    }

    const now = (dependencies.now ?? (() => new Date().toISOString()))();
    const updated = await dependencies.updateAttempt(input.workspaceId, input.attemptId, {
      status: "accepted",
      accepted_at: now,
      resolved_at: now,
      failed_at: null,
      error_code: null,
      error_message: null,
      provider_message_id: providerMessageId,
    });
    return result(updated, "updated");
  };
}

export function markBacklinkOutreachAttemptFailed(
  dependencies: BacklinkOutreachAttemptTransitionDependencies,
) {
  return async (input: {
    workspaceId: string;
    attemptId: string;
    errorCode: string;
    errorMessage: string;
  }): Promise<AttemptTransitionResult> => {
    const attempt = await dependencies.getAttempt(input.workspaceId, input.attemptId);
    const errorCode = normalizeRequired(input.errorCode);
    const errorMessage = normalizeRequired(input.errorMessage);

    if (attempt.status === "failed") {
      if (
        attempt.error_code !== errorCode ||
        attempt.error_message !== errorMessage
      ) {
        throw new BacklinkOutreachAttemptTransitionError(
          "OUTREACH_ATTEMPT_FAILED_CONFLICT",
        );
      }
      return result(attempt, "existing");
    }

    if (!canTransition(attempt)) {
      throw new BacklinkOutreachAttemptTransitionError(
        "OUTREACH_ATTEMPT_TRANSITION_INVALID",
      );
    }

    const now = (dependencies.now ?? (() => new Date().toISOString()))();
    const updated = await dependencies.updateAttempt(input.workspaceId, input.attemptId, {
      status: "failed",
      failed_at: now,
      resolved_at: now,
      accepted_at: null,
      provider_message_id: null,
      error_code: errorCode,
      error_message: errorMessage,
    });
    return result(updated, "updated");
  };
}

export function markBacklinkOutreachAttemptUnknown(
  dependencies: BacklinkOutreachAttemptTransitionDependencies,
) {
  return async (input: {
    workspaceId: string;
    attemptId: string;
    errorCode?: string | null;
    errorMessage?: string | null;
  }): Promise<AttemptTransitionResult> => {
    const attempt = await dependencies.getAttempt(input.workspaceId, input.attemptId);
    const errorCode = normalizeOptional(input.errorCode);
    const errorMessage = normalizeOptional(input.errorMessage);

    if (attempt.status === "unknown") {
      if (
        attempt.error_code !== errorCode ||
        attempt.error_message !== errorMessage
      ) {
        throw new BacklinkOutreachAttemptTransitionError(
          "OUTREACH_ATTEMPT_UNKNOWN_CONFLICT",
        );
      }
      return result(attempt, "existing");
    }

    if (attempt.status !== "requested") {
      throw new BacklinkOutreachAttemptTransitionError(
        "OUTREACH_ATTEMPT_TRANSITION_INVALID",
      );
    }

    const updated = await dependencies.updateAttempt(input.workspaceId, input.attemptId, {
      status: "unknown",
      accepted_at: null,
      failed_at: null,
      resolved_at: null,
      provider_message_id: null,
      error_code: errorCode,
      error_message: errorMessage,
    });
    return result(updated, "updated");
  };
}
