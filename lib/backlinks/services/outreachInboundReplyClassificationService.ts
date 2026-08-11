import type { BacklinkOutreachInboundMessageRow } from "../repositories/outreachInboundMessagesRepository";
import type { BacklinkOutreachInboundReplyClassification, ClassifyBacklinkOutreachInboundReplyInput, ClassifyBacklinkOutreachInboundReplyResult } from "../repositories/outreachInboundReplyClassificationsRepository";

type Outreach = { id: string; workspace_id: string };
export class BacklinkOutreachInboundReplyClassificationServiceError extends Error { constructor(public readonly code: "INPUT_INVALID" | "INBOUND_OUTREACH_MISMATCH" | "INBOUND_SOURCE_INVALID") { super(code); } }
export type BacklinkOutreachInboundReplyClassificationServiceDependencies = { getOutreach(workspaceId: string, outreachId: string): Promise<Outreach>; getInboundMessage(inboundMessageId: string): Promise<BacklinkOutreachInboundMessageRow>; classify(input: ClassifyBacklinkOutreachInboundReplyInput): Promise<ClassifyBacklinkOutreachInboundReplyResult>; now?: () => string };
export type BacklinkOutreachInboundReplyClassificationServiceInput = { workspaceId: string; actorUserId: string; outreachId: string; inboundMessageId: string; classification: BacklinkOutreachInboundReplyClassification };

export function classifyBacklinkOutreachInboundReply(deps: BacklinkOutreachInboundReplyClassificationServiceDependencies) {
  return async (input: BacklinkOutreachInboundReplyClassificationServiceInput) => {
    if (!input.workspaceId.trim() || !input.actorUserId.trim() || !input.outreachId.trim() || !input.inboundMessageId.trim() || (input.classification !== "positive" && input.classification !== "negative")) throw new BacklinkOutreachInboundReplyClassificationServiceError("INPUT_INVALID");
    const outreach = await deps.getOutreach(input.workspaceId, input.outreachId);
    const inbound = await deps.getInboundMessage(input.inboundMessageId);
    if (inbound.workspace_id !== input.workspaceId || inbound.outreach_id !== outreach.id) throw new BacklinkOutreachInboundReplyClassificationServiceError("INBOUND_OUTREACH_MISMATCH");
    if (inbound.correlation_status !== "correlated" || inbound.correlation_method !== "reply_token") throw new BacklinkOutreachInboundReplyClassificationServiceError("INBOUND_SOURCE_INVALID");
    return deps.classify({ inboundMessageId: inbound.id, classification: input.classification, classifiedBy: input.actorUserId, classifiedAt: (deps.now ?? (() => new Date().toISOString()))() });
  };
}
