import { BacklinkRepositoryError, type BacklinkRepositoryErrorCode } from "../repositories/errors";
import type { BacklinkOutreachRow } from "../repositories/outreachRepository";
import { canApplyBacklinkOutreachScheduling, type AutomationWorkspaceControl } from "@/lib/automation";
import {
  classifyBacklinkOutreachScheduleReconciliationCandidate,
  evaluateBacklinkOutreachScheduleReconciliationCandidate,
  type BacklinkOutreachScheduleReconciliationCandidate,
} from "./outreachScheduleReconciliationService";
import type { BacklinkContactRow } from "../repositories/contactsRepository";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function normalizeLimit(limit: number | undefined): number {
  if (limit == null) return DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1) return DEFAULT_LIMIT;
  return Math.min(limit, MAX_LIMIT);
}

function isSelectableCandidate(candidate: BacklinkOutreachScheduleReconciliationCandidate): boolean {
  return candidate.status === "active" &&
    candidate.channel === "email" &&
    candidate.current_attempt > 0 &&
    candidate.last_attempt_at != null;
}

function toCandidate(row: Pick<BacklinkOutreachRow, "id" | "workspace_id" | "contact_id" | "status" | "channel" | "current_attempt" | "max_attempts" | "last_attempt_at" | "next_follow_up_at" | "response_deadline_at">): BacklinkOutreachScheduleReconciliationCandidate {
  return row;
}

export type BacklinkOutreachScheduleApplyDisposition =
  | "scheduled"
  | "existing"
  | "not_applicable"
  | "conflict"
  | "failed";

export type BacklinkOutreachScheduleApplyItem = {
  outreachId: string;
  disposition: BacklinkOutreachScheduleApplyDisposition;
  kind: "follow_up" | "final_response" | null;
  scheduledAt: string | null;
  reason: string;
};

export type BacklinkOutreachScheduleApplySummary = {
  scanned: number;
  scheduled: number;
  existing: number;
  notApplicable: number;
  conflicts: number;
  failed: number;
  items: BacklinkOutreachScheduleApplyItem[];
};

export type ApplyBacklinkOutreachScheduleReconciliationAutomationInput = {
  workspaceId: string;
  limit?: number;
  now?: () => string;
};

export type ApplyBacklinkOutreachScheduleReconciliationAutomationDependencies = {
  getWorkspaceControl: (workspaceId: string) => Promise<AutomationWorkspaceControl | null>;
  listCandidates: (workspaceId: string, limit: number) => Promise<BacklinkOutreachScheduleReconciliationCandidate[]>;
  getLatestAttempt: (workspaceId: string, outreachId: string) => Promise<{ status: string } | null>;
  getOpenAttempt: (workspaceId: string, outreachId: string) => Promise<{ status: string } | null>;
  getContact: (workspaceId: string, contactId: string) => Promise<Pick<BacklinkContactRow, "contact_status" | "email_normalized"> | null>;
  hasInboundReplyStopEffect: (workspaceId: string, outreachId: string) => Promise<boolean>;
  reconcileSchedule: (
    workspaceId: string,
    outreachId: string,
    input: {
      expectedCurrentAttempt: number;
      expectedLastAttemptAt: string;
      scheduleKind: "follow_up" | "final_response";
      scheduledAt: string;
    },
  ) => Promise<{ disposition: "scheduled" | "existing"; kind: "follow_up" | "final_response"; scheduledAt: string; nextFollowUpAt: string | null; responseDeadlineAt: string | null }>;
};

export class BacklinkOutreachScheduleApplyError extends Error {
  constructor(public readonly code: BacklinkRepositoryErrorCode | "APPLY_NOT_ENABLED" | "APPLY_INVALID") {
    super(code);
    this.name = "BacklinkOutreachScheduleApplyError";
  }
}

function normalizeApplyError(error: unknown): BacklinkOutreachScheduleApplyError {
  if (error instanceof BacklinkOutreachScheduleApplyError) return error;
  if (error instanceof BacklinkRepositoryError) {
    if (error.code === "CONFLICT") {
      return new BacklinkOutreachScheduleApplyError("CONFLICT");
    }
    if (error.code === "NOT_FOUND") {
      return new BacklinkOutreachScheduleApplyError("NOT_FOUND");
    }
  }
  return new BacklinkOutreachScheduleApplyError("APPLY_INVALID");
}

export async function applyBacklinkOutreachScheduleReconciliationAutomation(
  dependencies: ApplyBacklinkOutreachScheduleReconciliationAutomationDependencies,
  input: ApplyBacklinkOutreachScheduleReconciliationAutomationInput,
): Promise<BacklinkOutreachScheduleApplySummary> {
  assert(typeof input.workspaceId === "string" && input.workspaceId.trim().length > 0, "workspaceId must not be empty");
  const limit = normalizeLimit(input.limit);

  const control = await dependencies.getWorkspaceControl(input.workspaceId);
  if (control == null || !canApplyBacklinkOutreachScheduling(control)) {
    throw new BacklinkOutreachScheduleApplyError("APPLY_NOT_ENABLED");
  }

  const candidates = (await dependencies.listCandidates(input.workspaceId, limit)).filter(isSelectableCandidate);
  const evaluate = evaluateBacklinkOutreachScheduleReconciliationCandidate({
    getLatestAttempt: dependencies.getLatestAttempt,
    getOpenAttempt: dependencies.getOpenAttempt,
    getContact: dependencies.getContact,
    hasInboundReplyStopEffect: dependencies.hasInboundReplyStopEffect,
  });

  const items: BacklinkOutreachScheduleApplyItem[] = [];
  let scheduled = 0;
  let existing = 0;
  let notApplicable = 0;
  let conflicts = 0;
  let failed = 0;

  for (const candidate of candidates) {
    try {
      const eligibility = await evaluate(candidate);
      const classification = classifyBacklinkOutreachScheduleReconciliationCandidate(candidate, eligibility);
      if (classification.disposition === "not_applicable") {
        notApplicable += 1;
        items.push({
          outreachId: candidate.id,
          disposition: "not_applicable",
          kind: null,
          scheduledAt: null,
          reason: classification.reason,
        });
        continue;
      }

      if (classification.disposition === "conflict") {
        const conflictKind = classification.kind;
        const conflictScheduledAt = classification.scheduledAt;
        if (conflictKind == null || conflictScheduledAt == null) {
          throw new BacklinkOutreachScheduleApplyError("APPLY_INVALID");
        }
        conflicts += 1;
        items.push({
          outreachId: candidate.id,
          disposition: "conflict",
          kind: conflictKind,
          scheduledAt: conflictScheduledAt,
          reason: "SCHEDULE_CONFLICT",
        });
        continue;
      }

      const scheduleKind = classification.kind;
      const scheduledAt = classification.scheduledAt;
      const expectedLastAttemptAt = candidate.last_attempt_at;
      if (scheduleKind == null || scheduledAt == null || expectedLastAttemptAt == null) {
        throw new BacklinkOutreachScheduleApplyError("APPLY_INVALID");
      }

      try {
        const result = await dependencies.reconcileSchedule(input.workspaceId, candidate.id, {
          expectedCurrentAttempt: candidate.current_attempt,
          expectedLastAttemptAt,
          scheduleKind,
          scheduledAt,
        });
        if (result.disposition === "scheduled") {
          scheduled += 1;
        } else {
          existing += 1;
        }
        items.push({
          outreachId: candidate.id,
          disposition: result.disposition,
          kind: result.kind,
          scheduledAt: result.scheduledAt,
          reason: result.disposition === "scheduled" ? "SCHEDULED" : "EXISTING",
        });
      } catch (error) {
        const normalized = normalizeApplyError(error);
        if (normalized.code === "CONFLICT") {
          conflicts += 1;
          items.push({
            outreachId: candidate.id,
            disposition: "conflict",
            kind: eligibility.kind,
            scheduledAt: eligibility.scheduledAt,
            reason: normalized.code,
          });
        } else {
          failed += 1;
          items.push({
            outreachId: candidate.id,
            disposition: "failed",
            kind: eligibility.kind,
            scheduledAt: null,
            reason: normalized.code,
          });
        }
      }
    } catch (error) {
      const normalized = normalizeApplyError(error);
      failed += 1;
      items.push({
        outreachId: candidate.id,
        disposition: "failed",
        kind: null,
        scheduledAt: null,
        reason: normalized.code,
      });
    }
  }

  return {
    scanned: candidates.length,
    scheduled,
    existing,
    notApplicable,
    conflicts,
    failed,
    items,
  };
}

export function buildBacklinkOutreachScheduleApplyCandidateSelection(
  rows: Pick<BacklinkOutreachRow, "id" | "workspace_id" | "contact_id" | "status" | "channel" | "current_attempt" | "max_attempts" | "last_attempt_at" | "next_follow_up_at" | "response_deadline_at">[],
): BacklinkOutreachScheduleReconciliationCandidate[] {
  return rows.map(toCandidate);
}
