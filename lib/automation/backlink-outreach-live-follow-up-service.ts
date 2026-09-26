import { randomUUID } from "node:crypto";

import type {
  BacklinkOutreachFollowUpEligibilityResult,
} from "@/lib/backlinks/services/outreachFollowUpEligibilityService";
import type {
  BacklinkOutreachFollowUpPreparationResult,
} from "@/lib/backlinks/services/outreachFollowUpPreparationService";
import type {
  BacklinkOutreachFollowUpEmailSendResult,
} from "@/lib/backlinks/services/outreachFollowUpEmailSendService";

export type BacklinkOutreachLiveFollowUpWorkspaceControl = {
  backlinksEnabled: boolean;
  backlinkOutreachScheduleApplyEnabled: boolean;
  dryRunOnly: boolean;
  disabledReason: string | null;
};

export type BacklinkOutreachLiveFollowUpInput = {
  workspaceId: string;
  outreachId: string;
  workspaceControl: BacklinkOutreachLiveFollowUpWorkspaceControl | null;
};

export type BacklinkOutreachLiveFollowUpResult = {
  disposition:
    | "accepted"
    | "failed"
    | "unknown"
    | "existing"
    | "ineligible";
  outreachId: string;
  attemptId: string | null;
  eligibilityReason: BacklinkOutreachFollowUpEligibilityResult["reason"];
};

export type BacklinkOutreachLiveFollowUpDependencies = {
  resolveActorUserId: (input: {
    workspaceId: string;
    outreachId: string;
  }) => Promise<string | null>;

  evaluateEligibility: (input: {
    workspaceId: string;
    outreachId: string;
  }) => Promise<BacklinkOutreachFollowUpEligibilityResult>;

  prepareFollowUp: (input: {
    workspaceId: string;
    actorUserId: string;
    outreachId: string;
    idempotencyKey: string;
  }) => Promise<BacklinkOutreachFollowUpPreparationResult>;

  sendFollowUpEmail: (input: {
    workspaceId: string;
    actorUserId: string;
    outreachId: string;
    attemptId: string;
    confirm: boolean;
  }) => Promise<BacklinkOutreachFollowUpEmailSendResult>;

  now?: () => string;

  createIdempotencyKey?: (input: {
    workspaceId: string;
    outreachId: string;
    selectedAt: string;
  }) => string;
};

export class BacklinkOutreachLiveFollowUpError extends Error {
  constructor(
    public readonly code:
      | "LIVE_FOLLOW_UP_NOT_ENABLED"
      | "LIVE_FOLLOW_UP_INVALID_INPUT",
  ) {
    super(code);
    this.name = "BacklinkOutreachLiveFollowUpError";
  }
}

function assert(
  condition: boolean,
  code: BacklinkOutreachLiveFollowUpError["code"],
): asserts condition {
  if (!condition) {
    throw new BacklinkOutreachLiveFollowUpError(code);
  }
}

export function canRunBacklinkOutreachLiveFollowUp(
  control: BacklinkOutreachLiveFollowUpWorkspaceControl | null,
): boolean {
  return control != null &&
    control.backlinksEnabled === true &&
    control.backlinkOutreachScheduleApplyEnabled === true &&
    control.dryRunOnly === false &&
    control.disabledReason == null;
}

function defaultIdempotencyKey(input: {
  workspaceId: string;
  outreachId: string;
  selectedAt: string;
}): string {
  return [
    "automation",
    "backlinks",
    "live-follow-up",
    input.workspaceId,
    input.outreachId,
    input.selectedAt,
    randomUUID(),
  ].join(":");
}

export async function runBacklinkOutreachLiveFollowUp(
  dependencies: BacklinkOutreachLiveFollowUpDependencies,
  input: BacklinkOutreachLiveFollowUpInput,
): Promise<BacklinkOutreachLiveFollowUpResult> {
  assert(
    typeof input.workspaceId === "string" &&
      input.workspaceId.trim().length > 0,
    "LIVE_FOLLOW_UP_INVALID_INPUT",
  );

  assert(
    typeof input.outreachId === "string" &&
      input.outreachId.trim().length > 0,
    "LIVE_FOLLOW_UP_INVALID_INPUT",
  );

  if (!canRunBacklinkOutreachLiveFollowUp(input.workspaceControl)) {
    throw new BacklinkOutreachLiveFollowUpError(
      "LIVE_FOLLOW_UP_NOT_ENABLED",
    );
  }

  const actorUserId = (
    await dependencies.resolveActorUserId({
      workspaceId: input.workspaceId,
      outreachId: input.outreachId,
    })
  )?.trim();

  assert(
    typeof actorUserId === "string" && actorUserId.length > 0,
    "LIVE_FOLLOW_UP_INVALID_INPUT",
  );

  const eligibility = await dependencies.evaluateEligibility({
    workspaceId: input.workspaceId,
    outreachId: input.outreachId,
  });

  if (!eligibility.eligible) {
    return {
      disposition: "ineligible",
      outreachId: input.outreachId,
      attemptId: null,
      eligibilityReason: eligibility.reason,
    };
  }

  const selectedAt =
    dependencies.now?.() ?? new Date().toISOString();

  const idempotencyKey =
    dependencies.createIdempotencyKey?.({
      workspaceId: input.workspaceId,
      outreachId: input.outreachId,
      selectedAt,
    }) ??
    defaultIdempotencyKey({
      workspaceId: input.workspaceId,
      outreachId: input.outreachId,
      selectedAt,
    });

  const prepared = await dependencies.prepareFollowUp({
    workspaceId: input.workspaceId,
    actorUserId,
    outreachId: input.outreachId,
    idempotencyKey,
  });

  const sent = await dependencies.sendFollowUpEmail({
    workspaceId: input.workspaceId,
    actorUserId,
    outreachId: prepared.outreachId,
    attemptId: prepared.attemptId,
    confirm: true,
  });

  return {
    disposition: sent.disposition,
    outreachId: sent.outreachId,
    attemptId: sent.attemptId,
    eligibilityReason: null,
  };
}
