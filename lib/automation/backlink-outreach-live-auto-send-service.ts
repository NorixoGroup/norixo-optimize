import { randomUUID } from "node:crypto";

import { BacklinkOutreachEmailSendError, type BacklinkOutreachEmailSendResult } from "@/lib/backlinks/services/outreachEmailSendService";
import type { BacklinkOutreachLiveAutoSendCandidateRow } from "@/lib/backlinks/repositories/outreachRepository";

const MAX_LIVE_AUTO_SENDS_PER_RUN = 1 as const;
const MAX_CANDIDATE_SCAN_LIMIT = 200;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type BacklinkOutreachLiveAutoSendWorkspaceControl = {
  backlinksEnabled: boolean;
  backlinkOutreachScheduleApplyEnabled: boolean;
  dryRunOnly: boolean;
  disabledReason: string | null;
};

export type BacklinkOutreachLiveAutoSendResult = {
  disposition: "sent" | "failed" | "unknown" | "no_candidate";
  outreachId: string | null;
  attemptId: string | null;
};

export type BacklinkOutreachLiveAutoSendInput = {
  workspaceId: string;
  actorUserId: string;
  workspaceControl: BacklinkOutreachLiveAutoSendWorkspaceControl | null;
  outreachId?: string | null;
};

export type BacklinkOutreachLiveAutoSendDependencies = {
  getCandidateById: (
    workspaceId: string,
    outreachId: string,
  ) => Promise<BacklinkOutreachLiveAutoSendCandidateRow | null>;
  listCandidates: (
    workspaceId: string,
    limit: number,
  ) => Promise<BacklinkOutreachLiveAutoSendCandidateRow[]>;
  sendBacklinkOutreachEmail: (input: {
    workspaceId: string;
    actorUserId: string;
    outreachId: string;
    idempotencyKey: string;
  }) => Promise<BacklinkOutreachEmailSendResult>;
  now?: () => string;
  createIdempotencyKey?: (input: {
    workspaceId: string;
    outreachId: string;
    selectedAt: string;
  }) => string;
};

export class BacklinkOutreachLiveAutoSendError extends Error {
  constructor(public readonly code: "LIVE_AUTO_SEND_NOT_ENABLED" | "LIVE_AUTO_SEND_INVALID_INPUT") {
    super(code);
    this.name = "BacklinkOutreachLiveAutoSendError";
  }
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new BacklinkOutreachLiveAutoSendError("LIVE_AUTO_SEND_INVALID_INPUT");
  }
}

function isValidUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function canRunBacklinkOutreachLiveAutoSend(
  control: BacklinkOutreachLiveAutoSendWorkspaceControl | null,
): boolean {
  return control != null &&
    control.backlinksEnabled === true &&
    control.backlinkOutreachScheduleApplyEnabled === true &&
    control.dryRunOnly === false &&
    control.disabledReason == null;
}

function isCandidateEligible(candidate: BacklinkOutreachLiveAutoSendCandidateRow): boolean {
  return candidate.status === "ready" &&
    candidate.channel === "email" &&
    candidate.current_attempt < candidate.max_attempts;
}

function isSkippableSendError(code: BacklinkOutreachEmailSendError["code"]): boolean {
  return code === "OUTREACH_NOT_SENDABLE" ||
    code === "OUTREACH_EMAIL_CHANNEL_UNSUPPORTED" ||
    code === "OUTREACH_EMAIL_CONTENT_INCOMPLETE" ||
    code === "OUTREACH_CONTACT_NOT_ELIGIBLE" ||
    code === "OUTREACH_MAX_ATTEMPTS_REACHED" ||
    code === "OUTREACH_ATTEMPT_IDEMPOTENCY_CONFLICT" ||
    code === "OUTREACH_SEND_ATTEMPT_IN_PROGRESS" ||
    code === "OUTREACH_SEND_ATTEMPT_UNRESOLVED";
}

function createDefaultIdempotencyKey(input: {
  workspaceId: string;
  outreachId: string;
  selectedAt: string;
}): string {
  return `automation:backlinks:live-auto-send:${input.workspaceId}:${input.outreachId}:${input.selectedAt}:${randomUUID()}`;
}

function normalizeSendResult(
  result: BacklinkOutreachEmailSendResult,
): BacklinkOutreachLiveAutoSendResult["disposition"] {
  return result.disposition === "failed" || result.disposition === "unknown"
    ? result.disposition
    : "sent";
}

export async function runBacklinkOutreachLiveAutoSend(
  dependencies: BacklinkOutreachLiveAutoSendDependencies,
  input: BacklinkOutreachLiveAutoSendInput,
): Promise<BacklinkOutreachLiveAutoSendResult> {
  assert(typeof input.workspaceId === "string" && input.workspaceId.trim().length > 0, "workspaceId must not be empty");
  assert(typeof input.actorUserId === "string" && input.actorUserId.trim().length > 0, "actorUserId must not be empty");
  if (!canRunBacklinkOutreachLiveAutoSend(input.workspaceControl)) {
    throw new BacklinkOutreachLiveAutoSendError("LIVE_AUTO_SEND_NOT_ENABLED");
  }
  assert(input.outreachId == null || (typeof input.outreachId === "string" && isValidUuid(input.outreachId)), "outreachId must be a valid UUID or null");

  const selectedAt = dependencies.now?.() ?? new Date().toISOString();
  const selectedCandidates = input.outreachId == null
    ? (await dependencies.listCandidates(input.workspaceId, MAX_CANDIDATE_SCAN_LIMIT)).filter(isCandidateEligible)
    : await dependencies
        .getCandidateById(input.workspaceId, input.outreachId)
        .then((candidate) => (candidate != null && isCandidateEligible(candidate) ? [candidate] : []));

  for (const candidate of selectedCandidates) {
    const idempotencyKey = dependencies.createIdempotencyKey?.({
      workspaceId: input.workspaceId,
      outreachId: candidate.id,
      selectedAt,
    }) ?? createDefaultIdempotencyKey({
      workspaceId: input.workspaceId,
      outreachId: candidate.id,
      selectedAt,
    });

    try {
      const result = await dependencies.sendBacklinkOutreachEmail({
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        outreachId: candidate.id,
        idempotencyKey,
      });
      return {
        disposition: normalizeSendResult(result),
        outreachId: candidate.id,
        attemptId: result.attemptId,
      };
    } catch (error) {
      if (error instanceof BacklinkOutreachEmailSendError && isSkippableSendError(error.code)) {
        continue;
      }
      throw error;
    }
  }

  return {
    disposition: "no_candidate",
    outreachId: null,
    attemptId: null,
  };
}

export { MAX_LIVE_AUTO_SENDS_PER_RUN };
export type { BacklinkOutreachLiveAutoSendCandidateRow };
