import {
  createBacklinkContact,
  type CreateBacklinkContactInput,
} from "../repositories/contactsRepository";
import {
  createBacklinkOutreach,
  getBacklinkOutreachById,
  listBacklinkOutreach,
  updateBacklinkOutreach,
  type CreateBacklinkOutreachInput,
  type ListBacklinkOutreachInput,
  type UpdateBacklinkOutreachInput,
} from "../repositories/outreachRepository";
import type { RepositoryPage } from "../repositories/pagination";
import type { BacklinkRepositoryClient } from "../repositories/repositoryClient";
import type { BacklinkContactRow } from "../repositories/contactsRepository";
import type { BacklinkOutreachRow } from "../repositories/outreachRepository";
import type { WorkspaceId } from "../repositories/types";
import { listBacklinkOutreachExpiredResponseDeadlines } from "../repositories/outreachRepository";
import { listBacklinkOutreachAttemptSummariesForOutreachIds, type BacklinkOutreachAttemptSummary } from "../repositories/outreachAttemptsRepository";
import { listBacklinkOutreachInboundReplySummariesForOutreachIds, type BacklinkOutreachInboundReplySummary } from "../repositories/outreachInboundReplyClassificationsRepository";

export type ListOutreachInput = Omit<ListBacklinkOutreachInput, "workspaceId">;
export type CreateOutreachInput = Omit<CreateBacklinkOutreachInput, "createdBy">;
export type UpdateOutreachInput = UpdateBacklinkOutreachInput;
export type CreateContactInput = Omit<CreateBacklinkContactInput, "createdBy">;
export type RecordOutreachResponseInput = Pick<
  UpdateBacklinkOutreachInput,
  "status" | "last_response_type" | "closed_at" | "stop_reason"
>;
export type BacklinkOutreachFollowUpSummary = {
  state: "none" | "scheduled" | "due" | "prepared" | "requested" | "unknown" | "final_response";
  nextFollowUpAt: string | null;
  responseDeadlineAt: string | null;
  attemptId: string | null;
  finalNoResponseEligible: boolean;
};
export type BacklinkOutreachWithAttemptSummary = BacklinkOutreachRow & { attemptSummary: BacklinkOutreachAttemptSummary; inboundReplySummary: BacklinkOutreachInboundReplySummary; followUpSummary: BacklinkOutreachFollowUpSummary; finalNoResponseEligible: boolean };

function buildFollowUpSummary(outreach: BacklinkOutreachRow, attemptSummary: BacklinkOutreachAttemptSummary, now: string, finalNoResponseEligible: boolean): BacklinkOutreachFollowUpSummary {
  const nowValue = Date.parse(now);
  const scheduledAt = outreach.next_follow_up_at;
  const responseDeadlineAt = outreach.response_deadline_at;
  if (outreach.status !== "active" || outreach.channel !== "email") return { state: "none", nextFollowUpAt: scheduledAt, responseDeadlineAt, attemptId: attemptSummary.latestOpenAttemptId, finalNoResponseEligible };
  if (attemptSummary.latestOpenStatus === "unknown") return { state: "unknown", nextFollowUpAt: scheduledAt, responseDeadlineAt, attemptId: attemptSummary.latestOpenAttemptId, finalNoResponseEligible };
  if (attemptSummary.latestOpenStatus === "requested") return { state: "requested", nextFollowUpAt: scheduledAt, responseDeadlineAt, attemptId: attemptSummary.latestOpenAttemptId, finalNoResponseEligible };
  if (attemptSummary.latestOpenStatus === "prepared") return { state: "prepared", nextFollowUpAt: scheduledAt, responseDeadlineAt, attemptId: attemptSummary.latestOpenAttemptId, finalNoResponseEligible };
  if (responseDeadlineAt != null) return { state: "final_response", nextFollowUpAt: scheduledAt, responseDeadlineAt, attemptId: null, finalNoResponseEligible };
  if (scheduledAt == null) return { state: "none", nextFollowUpAt: null, responseDeadlineAt: null, attemptId: null, finalNoResponseEligible };
  const scheduledTime = Date.parse(scheduledAt);
  if (Number.isFinite(nowValue) && Number.isFinite(scheduledTime) && scheduledTime <= nowValue) return { state: "due", nextFollowUpAt: scheduledAt, responseDeadlineAt: null, attemptId: null, finalNoResponseEligible };
  return { state: "scheduled", nextFollowUpAt: scheduledAt, responseDeadlineAt: null, attemptId: null, finalNoResponseEligible };
}

export async function listOutreach(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  input: ListOutreachInput = {},
): Promise<RepositoryPage<BacklinkOutreachWithAttemptSummary>> {
  const page = await listBacklinkOutreach(client, { ...input, workspaceId });
  const outreachIds = page.items.map((outreach) => outreach.id);
  const now = new Date().toISOString();
  const [summaries, inboundSummaries, finalNoResponseRows] = await Promise.all([
    listBacklinkOutreachAttemptSummariesForOutreachIds(client, workspaceId, outreachIds),
    listBacklinkOutreachInboundReplySummariesForOutreachIds(client, workspaceId, outreachIds),
    listBacklinkOutreachExpiredResponseDeadlines(client, { workspaceId, now, limit: 200 }),
  ]);
  const finalNoResponseEligible = new Set(finalNoResponseRows.map((row) => row.outreachId));
  return { ...page, items: page.items.map((outreach) => {
    const attemptSummary = summaries.get(outreach.id) ?? { latestStatus: null, latestOpenAttemptId: null, latestOpenStatus: null, hasOpenAttempt: false };
    const eligible = finalNoResponseEligible.has(outreach.id);
    return {
      ...outreach,
      attemptSummary,
      inboundReplySummary: inboundSummaries.get(outreach.id) ?? { correlatedCount: 0, unclassifiedCount: 0, latestReceivedAt: null },
      followUpSummary: buildFollowUpSummary(outreach, attemptSummary, now, eligible),
      finalNoResponseEligible: eligible,
    };
  }) };
}

export async function getOutreach(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  outreachId: string,
): Promise<BacklinkOutreachRow> {
  return getBacklinkOutreachById(client, workspaceId, outreachId);
}

export async function createOutreach(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  actorUserId: string,
  input: CreateOutreachInput,
): Promise<BacklinkOutreachRow> {
  return createBacklinkOutreach(client, workspaceId, {
    ...input,
    createdBy: actorUserId,
  });
}

export async function updateOutreach(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  outreachId: string,
  input: UpdateOutreachInput,
): Promise<BacklinkOutreachRow> {
  return updateBacklinkOutreach(client, workspaceId, outreachId, input);
}

export async function recordOutreachResponse(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  outreachId: string,
  input: RecordOutreachResponseInput,
): Promise<BacklinkOutreachRow> {
  return updateBacklinkOutreach(client, workspaceId, outreachId, input);
}

export async function createContact(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  actorUserId: string,
  input: CreateContactInput,
): Promise<BacklinkContactRow> {
  return createBacklinkContact(client, workspaceId, {
    ...input,
    createdBy: actorUserId,
  });
}
