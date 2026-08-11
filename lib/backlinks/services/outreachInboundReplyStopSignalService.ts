import type { BacklinkOutreachInboundMessageRow } from "../repositories/outreachInboundMessagesRepository";
import type { ApplyBacklinkOutreachInboundReplyStopInput, ApplyBacklinkOutreachInboundReplyStopResult } from "../repositories/outreachInboundEffectsRepository";

export type InboundReplyStopSignalResult =
  | { disposition: "not_applicable" }
  | { disposition: "applied" | "existing"; inboundMessageId: string; outreachId: string; contactId: string };

export type OutreachInboundReplyStopSignalDependencies = {
  applyInboundReplyStop(input: ApplyBacklinkOutreachInboundReplyStopInput): Promise<ApplyBacklinkOutreachInboundReplyStopResult>;
  now?: () => string;
};

export function createBacklinkOutreachInboundReplyStopSignalService(deps: OutreachInboundReplyStopSignalDependencies) {
  return async (inboundMessage: BacklinkOutreachInboundMessageRow): Promise<InboundReplyStopSignalResult> => {
    if (inboundMessage.correlation_status !== "correlated" || inboundMessage.correlation_method !== "reply_token") return { disposition: "not_applicable" };
    const result = await deps.applyInboundReplyStop({ inboundMessageId: inboundMessage.id, appliedAt: (deps.now ?? (() => new Date().toISOString()))() });
    return { disposition: result.disposition, inboundMessageId: result.inboundMessageId, outreachId: result.outreachId, contactId: result.contactId };
  };
}
