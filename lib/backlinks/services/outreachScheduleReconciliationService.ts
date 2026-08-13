import { evaluateBacklinkOutreachFollowUpSchedulingPolicy } from "./outreachFollowUpSchedulingPolicy";
import type { BacklinkContactRow } from "../repositories/contactsRepository";
import type { BacklinkOutreachRow } from "../repositories/outreachRepository";

export type BacklinkOutreachScheduleReconciliationCandidate = Pick<
  BacklinkOutreachRow,
  | "id"
  | "workspace_id"
  | "contact_id"
  | "status"
  | "channel"
  | "current_attempt"
  | "max_attempts"
  | "last_attempt_at"
  | "next_follow_up_at"
  | "response_deadline_at"
>;

export type BacklinkOutreachScheduleReconciliationReason =
  | "OUTREACH_NOT_ACTIVE"
  | "CHANNEL_NOT_SUPPORTED"
  | "LATEST_ATTEMPT_NOT_ACCEPTED"
  | "CONTACT_UNAVAILABLE"
  | "OPEN_ATTEMPT_PRESENT"
  | "INBOUND_REPLY_STOPPED"
  | "POLICY_NONE";

export type BacklinkOutreachScheduleReconciliationEligibilityResult =
  | {
      disposition: "eligible";
      kind: "follow_up" | "final_response";
      scheduledAt: string;
      reason: null;
    }
  | {
      disposition: "not_applicable";
      kind: null;
      scheduledAt: null;
      reason: BacklinkOutreachScheduleReconciliationReason;
    };

export type BacklinkOutreachScheduleReconciliationPreviewDisposition =
  | "would_schedule"
  | "existing"
  | "not_applicable"
  | "conflict";

export type BacklinkOutreachScheduleReconciliationPreviewReason =
  | BacklinkOutreachScheduleReconciliationReason
  | "SCHEDULE_MISSING"
  | "SCHEDULE_ALREADY_PRESENT"
  | "SCHEDULE_CONFLICT";

export type BacklinkOutreachScheduleReconciliationPreviewItem = {
  outreachId: string;
  disposition: BacklinkOutreachScheduleReconciliationPreviewDisposition;
  kind: "follow_up" | "final_response" | null;
  scheduledAt: string | null;
  reason: BacklinkOutreachScheduleReconciliationPreviewReason;
};

export type BacklinkOutreachScheduleReconciliationPreviewResult = {
  scanned: number;
  wouldScheduleFollowUp: number;
  wouldScheduleFinalResponse: number;
  existing: number;
  notApplicable: number;
  conflicts: number;
  items: BacklinkOutreachScheduleReconciliationPreviewItem[];
};

export type BacklinkOutreachScheduleReconciliationCandidateEvaluationDependencies = {
  getLatestAttempt: (workspaceId: string, outreachId: string) => Promise<{ status: string } | null>;
  getOpenAttempt: (workspaceId: string, outreachId: string) => Promise<{ status: string } | null>;
  getContact: (workspaceId: string, contactId: string) => Promise<Pick<BacklinkContactRow, "contact_status" | "email_normalized"> | null>;
  hasInboundReplyStopEffect: (workspaceId: string, outreachId: string) => Promise<boolean>;
};

export type PreviewBacklinkOutreachScheduleReconciliationRunInput = {
  workspaceId: string;
  requestedBy: string | null;
  idempotencyKey: string;
  scheduledAt: string;
  limit?: number;
};

export type PreviewBacklinkOutreachScheduleReconciliationRunDependencies = BacklinkOutreachScheduleReconciliationCandidateEvaluationDependencies & {
  createRun: (input: {
    workspaceId: string;
    system: "backlinks";
    runKind: string;
    idempotencyKey: string;
    mode: "dry_run";
    triggerSource: "internal";
    requestedBy: string | null;
    scheduledAt: string;
    input: Record<string, unknown>;
  }) => Promise<{ kind: "created" | "existing"; run: { id: string } } | { kind: "rejected"; reason: string }>;
  completeRun: (input: {
    workspaceId: string;
    runId: string;
    completedAt: string;
    summary: Record<string, unknown> | null;
  }) => Promise<{ kind: "transitioned"; run: { id: string } } | { kind: "rejected"; reason: string }>;
  listCandidates: (workspaceId: string, limit: number) => Promise<BacklinkOutreachScheduleReconciliationCandidate[]>;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RUN_KIND = "backlinks.outreach.maintenance" as const;
const RUN_OPERATION = "schedule_reconciliation" as const;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertUuid(value: string, label: string): void {
  assert(UUID_PATTERN.test(value), `${label} must be a valid UUID`);
}

function assertTimestamp(value: string, label: string): void {
  assert(Number.isFinite(Date.parse(value)), `${label} must be a valid date`);
}

function normalizeLimit(limit: number | undefined): number {
  if (limit == null) return DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1) return DEFAULT_LIMIT;
  return Math.min(limit, MAX_LIMIT);
}

function isUsableContact(contact: Pick<BacklinkContactRow, "contact_status" | "email_normalized"> | null): boolean {
  return contact != null &&
    contact.contact_status !== "do_not_contact" &&
    contact.contact_status !== "archived" &&
    Boolean(contact.email_normalized?.trim());
}

function notApplicable(reason: BacklinkOutreachScheduleReconciliationReason): BacklinkOutreachScheduleReconciliationEligibilityResult {
  return { disposition: "not_applicable", kind: null, scheduledAt: null, reason };
}

export function evaluateBacklinkOutreachScheduleReconciliationCandidate(
  dependencies: BacklinkOutreachScheduleReconciliationCandidateEvaluationDependencies,
) {
  return async (
    candidate: BacklinkOutreachScheduleReconciliationCandidate,
  ): Promise<BacklinkOutreachScheduleReconciliationEligibilityResult> => {
    if (candidate.status !== "active") return notApplicable("OUTREACH_NOT_ACTIVE");
    if (candidate.channel !== "email") return notApplicable("CHANNEL_NOT_SUPPORTED");
    if (
      candidate.current_attempt <= 0 ||
      candidate.max_attempts <= 0 ||
      candidate.current_attempt > candidate.max_attempts ||
      candidate.last_attempt_at == null
    ) {
      return notApplicable("LATEST_ATTEMPT_NOT_ACCEPTED");
    }

    const latestAttempt = await dependencies.getLatestAttempt(candidate.workspace_id, candidate.id);
    if (latestAttempt == null || latestAttempt.status !== "accepted") {
      return notApplicable("LATEST_ATTEMPT_NOT_ACCEPTED");
    }

    const contact = await dependencies.getContact(candidate.workspace_id, candidate.contact_id);
    if (!isUsableContact(contact)) return notApplicable("CONTACT_UNAVAILABLE");

    const openAttempt = await dependencies.getOpenAttempt(candidate.workspace_id, candidate.id);
    if (openAttempt?.status === "prepared" || openAttempt?.status === "requested" || openAttempt?.status === "unknown") {
      return notApplicable("OPEN_ATTEMPT_PRESENT");
    }

    if (await dependencies.hasInboundReplyStopEffect(candidate.workspace_id, candidate.id)) {
      return notApplicable("INBOUND_REPLY_STOPPED");
    }

    const policy = evaluateBacklinkOutreachFollowUpSchedulingPolicy({
      currentAttempt: candidate.current_attempt,
      maxAttempts: candidate.max_attempts,
      lastAttemptAt: candidate.last_attempt_at,
    });

    if (policy.kind === "none") {
      return notApplicable("POLICY_NONE");
    }

    return {
      disposition: "eligible",
      kind: policy.kind,
      scheduledAt: policy.kind === "follow_up" ? policy.nextFollowUpAt : policy.responseDeadlineAt,
      reason: null,
    };
  };
}

export function classifyBacklinkOutreachScheduleReconciliationCandidate(
  candidate: BacklinkOutreachScheduleReconciliationCandidate,
  eligibility: BacklinkOutreachScheduleReconciliationEligibilityResult,
): BacklinkOutreachScheduleReconciliationPreviewItem {
  if (eligibility.disposition === "not_applicable") {
    return {
      outreachId: candidate.id,
      disposition: "not_applicable",
      kind: null,
      scheduledAt: null,
      reason: eligibility.reason,
    };
  }

  const targetScheduleAt =
    eligibility.kind === "follow_up" ? candidate.next_follow_up_at : candidate.response_deadline_at;

  if (targetScheduleAt == null) {
    return {
      outreachId: candidate.id,
      disposition: "would_schedule",
      kind: eligibility.kind,
      scheduledAt: eligibility.scheduledAt,
      reason: "SCHEDULE_MISSING",
    };
  }

  if (targetScheduleAt === eligibility.scheduledAt) {
    return {
      outreachId: candidate.id,
      disposition: "existing",
      kind: eligibility.kind,
      scheduledAt: eligibility.scheduledAt,
      reason: "SCHEDULE_ALREADY_PRESENT",
    };
  }

  return {
    outreachId: candidate.id,
    disposition: "conflict",
    kind: eligibility.kind,
    scheduledAt: eligibility.scheduledAt,
    reason: "SCHEDULE_CONFLICT",
  };
}

export async function previewBacklinkOutreachScheduleReconciliationRun(
  dependencies: PreviewBacklinkOutreachScheduleReconciliationRunDependencies,
  input: PreviewBacklinkOutreachScheduleReconciliationRunInput,
): Promise<BacklinkOutreachScheduleReconciliationPreviewResult> {
  assertUuid(input.workspaceId, "workspaceId");
  assert(input.requestedBy == null || (typeof input.requestedBy === "string" && UUID_PATTERN.test(input.requestedBy)), "requestedBy must be a UUID or null");
  assert(typeof input.idempotencyKey === "string" && input.idempotencyKey.trim().length > 0, "idempotencyKey must not be empty");
  assertTimestamp(input.scheduledAt, "scheduledAt");

  const limit = normalizeLimit(input.limit);
  const createdRun = await dependencies.createRun({
    workspaceId: input.workspaceId,
    system: "backlinks",
    runKind: RUN_KIND,
    idempotencyKey: input.idempotencyKey.trim(),
    mode: "dry_run",
    triggerSource: "internal",
    requestedBy: input.requestedBy,
    scheduledAt: input.scheduledAt,
    input: { operation: RUN_OPERATION, limit },
  });

  if (createdRun.kind === "rejected") {
    throw new Error("BACKLINK_OUTREACH_MAINTENANCE_RUN_REJECTED");
  }

  const evaluate = evaluateBacklinkOutreachScheduleReconciliationCandidate(dependencies);
  const candidates = await dependencies.listCandidates(input.workspaceId, limit);
  const selectedCandidates = candidates.filter(
    (candidate) =>
      candidate.status === "active" &&
      candidate.channel === "email" &&
      candidate.current_attempt > 0 &&
      candidate.last_attempt_at != null,
  );

  const items: BacklinkOutreachScheduleReconciliationPreviewItem[] = [];
  let wouldScheduleFollowUp = 0;
  let wouldScheduleFinalResponse = 0;
  let existing = 0;
  let notApplicable = 0;
  let conflicts = 0;

  for (const candidate of selectedCandidates) {
    const eligibility = await evaluate(candidate);
    const item = classifyBacklinkOutreachScheduleReconciliationCandidate(candidate, eligibility);
    items.push(item);
    if (item.disposition === "would_schedule" && item.kind === "follow_up") {
      wouldScheduleFollowUp += 1;
    } else if (item.disposition === "would_schedule" && item.kind === "final_response") {
      wouldScheduleFinalResponse += 1;
    } else if (item.disposition === "existing") {
      existing += 1;
    } else if (item.disposition === "conflict") {
      conflicts += 1;
    } else {
      notApplicable += 1;
    }
  }

  const summary = {
    scanned: selectedCandidates.length,
    wouldScheduleFollowUp,
    wouldScheduleFinalResponse,
    existing,
    notApplicable,
    conflicts,
    items,
  };

  const completed = await dependencies.completeRun({
    workspaceId: input.workspaceId,
    runId: createdRun.run.id,
    completedAt: input.scheduledAt,
    summary,
  });
  if (completed.kind === "rejected") {
    throw new Error("BACKLINK_OUTREACH_MAINTENANCE_RUN_COMPLETION_REJECTED");
  }

  return summary;
}
