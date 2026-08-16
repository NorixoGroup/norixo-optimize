import type { ApplyBacklinkOutreachBacklinkObtainedResult, BacklinkOutreachLifecyclePatch, BacklinkOutreachRow } from "../repositories/outreachRepository";

export type BacklinkOutreachResponseType = "positive" | "negative" | "neutral" | "bounced" | "unsubscribed";
export type BacklinkOutreachLifecycleTransition =
  | { kind: "mark_replied"; responseType: BacklinkOutreachResponseType }
  | { kind: "open_conversation" }
  | { kind: "decline"; stopReason: string }
  | { kind: "mark_no_response" }
  | { kind: "pause" }
  | { kind: "mark_backlink_obtained" }
  | { kind: "close"; stopReason: string; responseType?: BacklinkOutreachResponseType | null };
export type BacklinkOutreachLifecycleErrorCode = "OUTREACH_LIFECYCLE_TRANSITION_INVALID" | "OUTREACH_LIFECYCLE_CONFLICT" | "OUTREACH_LIFECYCLE_NO_RESPONSE_ATTEMPTS_REMAIN" | "OUTREACH_LIFECYCLE_STOP_REASON_REQUIRED" | "OUTREACH_LIFECYCLE_RESPONSE_TYPE_INVALID" | "OUTREACH_LIFECYCLE_BACKLINK_OBTAINED_LINK_REQUIRED";
export class BacklinkOutreachLifecycleError extends Error { constructor(public readonly code: BacklinkOutreachLifecycleErrorCode) { super(code); this.name = "BacklinkOutreachLifecycleError"; } }

type Dependencies = { getOutreach(workspaceId: string, outreachId: string): Promise<BacklinkOutreachRow>; updateIfStatus(workspaceId: string, outreachId: string, expectedStatus: string, patch: BacklinkOutreachLifecyclePatch): Promise<BacklinkOutreachRow | null>; markBacklinkObtained(workspaceId: string, outreachId: string, appliedAt: string): Promise<ApplyBacklinkOutreachBacklinkObtainedResult>; now?: () => string };
type Input = { workspaceId: string; actorUserId: string; outreachId: string; transition: BacklinkOutreachLifecycleTransition };
type Outcome = { status: string; lastResponseType: string | null; stopReason: string | null; closedAt: string | null; nextFollowUpAt: string | null; responseDeadlineAt: string | null };

function requiredStopReason(value: string): string { const normalized = value.trim(); if (!normalized) throw new BacklinkOutreachLifecycleError("OUTREACH_LIFECYCLE_STOP_REASON_REQUIRED"); return normalized; }
function outcome(row: BacklinkOutreachRow): Outcome { return { status: row.status, lastResponseType: row.last_response_type, stopReason: row.stop_reason, closedAt: row.closed_at, nextFollowUpAt: row.next_follow_up_at, responseDeadlineAt: row.response_deadline_at }; }
function compatible(row: BacklinkOutreachRow, target: Outcome): boolean { const current = outcome(row); return current.status === target.status && current.lastResponseType === target.lastResponseType && current.stopReason === target.stopReason && current.nextFollowUpAt === target.nextFollowUpAt && current.responseDeadlineAt === target.responseDeadlineAt && (target.closedAt == null ? current.closedAt == null : current.closedAt != null); }

export function transitionBacklinkOutreachLifecycle(dependencies: Dependencies) { return async (input: Input) => {
  const outreach = await dependencies.getOutreach(input.workspaceId, input.outreachId);
  const now = dependencies.now ?? (() => new Date().toISOString());
  let expectedStatus: string;
  let patch: BacklinkOutreachLifecyclePatch;
  switch (input.transition.kind) {
    case "mark_replied": expectedStatus = "active"; patch = { status: "replied", last_response_type: input.transition.responseType, closed_at: null, stop_reason: null, next_follow_up_at: null, response_deadline_at: null }; break;
    case "open_conversation": if (outreach.status === "replied" && outreach.last_response_type !== "positive") throw new BacklinkOutreachLifecycleError("OUTREACH_LIFECYCLE_RESPONSE_TYPE_INVALID"); expectedStatus = "replied"; patch = { status: "conversation_open", last_response_type: "positive", closed_at: null, stop_reason: null, next_follow_up_at: null, response_deadline_at: null }; break;
    case "decline": expectedStatus = "active"; patch = { status: "declined", last_response_type: "negative", closed_at: now(), stop_reason: requiredStopReason(input.transition.stopReason), next_follow_up_at: null, response_deadline_at: null }; break;
    case "mark_no_response": if (outreach.status === "active" && outreach.current_attempt !== outreach.max_attempts) throw new BacklinkOutreachLifecycleError("OUTREACH_LIFECYCLE_NO_RESPONSE_ATTEMPTS_REMAIN"); expectedStatus = "active"; patch = { status: "no_response", last_response_type: null, closed_at: now(), stop_reason: "attempt_limit", next_follow_up_at: null, response_deadline_at: null }; break;
    case "pause": expectedStatus = "active"; patch = { status: "paused", last_response_type: outreach.last_response_type, closed_at: null, stop_reason: null, next_follow_up_at: null, response_deadline_at: null }; break;
    case "mark_backlink_obtained": {
      const result = await dependencies.markBacklinkObtained(input.workspaceId, input.outreachId, now());
      return {
        outreachId: result.outreachId,
        previousStatus: result.previousStatus,
        status: result.outreachStatus,
        lastResponseType: result.lastResponseType,
        stopReason: result.stopReason,
        closedAt: result.closedAt,
        nextFollowUpAt: result.nextFollowUpAt,
        responseDeadlineAt: result.responseDeadlineAt,
        disposition: result.disposition,
      };
    }
    case "close": expectedStatus = "active"; patch = { status: "closed", last_response_type: input.transition.responseType === undefined ? outreach.last_response_type : input.transition.responseType, closed_at: now(), stop_reason: requiredStopReason(input.transition.stopReason), next_follow_up_at: null, response_deadline_at: null }; break;
  }
  const target: Outcome = { status: patch.status ?? "", lastResponseType: patch.last_response_type ?? null, stopReason: patch.stop_reason ?? null, closedAt: patch.closed_at ?? null, nextFollowUpAt: patch.next_follow_up_at ?? null, responseDeadlineAt: patch.response_deadline_at ?? null };
  if (outreach.status !== expectedStatus) { if (compatible(outreach, target)) return { outreachId: outreach.id, previousStatus: outreach.status, ...outcome(outreach), disposition: "existing" as const }; throw new BacklinkOutreachLifecycleError("OUTREACH_LIFECYCLE_TRANSITION_INVALID"); }
  const updated = await dependencies.updateIfStatus(input.workspaceId, input.outreachId, expectedStatus, patch);
  if (updated != null) return { outreachId: updated.id, previousStatus: outreach.status, ...outcome(updated), disposition: "updated" as const };
  const canonical = await dependencies.getOutreach(input.workspaceId, input.outreachId);
  if (compatible(canonical, target)) return { outreachId: canonical.id, previousStatus: outreach.status, ...outcome(canonical), disposition: "existing" as const };
  throw new BacklinkOutreachLifecycleError("OUTREACH_LIFECYCLE_CONFLICT");
}; }
