import { detectInboundAutoReply, extractBacklinkOutreachReplyToken, extractBacklinkOutreachReplyTokens } from "../providers/resendInboundEmailNormalization";
import type { CreateBacklinkOutreachInboundMessageInput, BacklinkOutreachInboundMessageReservation } from "../repositories/outreachInboundMessagesRepository";
import type { BacklinkInboundCorrelationResult } from "./outreachInboundCorrelationService";

type InboundWebhook = { provider: "resend"; providerEventId: string; inboundMessageId: string; sender: string; recipients: string[]; subject: string | null; occurredAt: string };
type InboundContent = { textBody: string | null; inReplyTo: string[]; references: string[]; autoReply: { isAutoReply: boolean } };

export type BacklinkInboundMessageIngestionDependencies = {
  correlate(input: { sender: string; tokenCandidates: readonly string[]; autoReply: { isAutoReply: boolean } }): Promise<BacklinkInboundCorrelationResult>;
  createInboundMessage(input: CreateBacklinkOutreachInboundMessageInput): Promise<BacklinkOutreachInboundMessageReservation>;
  now(): string;
};

function boundedHeader(values: readonly string[], limit: number): string | null { const value = values.join(" "); return value ? Array.from(value).slice(0, limit).join("") : null; }

export function ingestBacklinkInboundMessage(dependencies: BacklinkInboundMessageIngestionDependencies) {
  return async (input: { webhook: InboundWebhook; content: InboundContent; inboundReplyDomain: string }) => {
    const autoReply = input.content.autoReply.isAutoReply
      ? input.content.autoReply
      : detectInboundAutoReply({ sender: input.webhook.sender, autoSubmitted: null, precedence: null, xAutoreply: null });
    const tokenCandidates = autoReply.isAutoReply ? [] : extractBacklinkOutreachReplyTokens(input.webhook.recipients, input.inboundReplyDomain);
    const correlation = await dependencies.correlate({ sender: input.webhook.sender, tokenCandidates, autoReply });
    const tokenRecipient = tokenCandidates.length === 1 ? input.webhook.recipients.find((recipient) => extractBacklinkOutreachReplyToken(recipient, input.inboundReplyDomain) === tokenCandidates[0]) : undefined;
    const payload: CreateBacklinkOutreachInboundMessageInput = {
      workspaceId: correlation.status === "correlated" ? correlation.workspaceId : null,
      outreachId: correlation.status === "correlated" ? correlation.outreachId : null,
      attemptId: correlation.status === "correlated" ? correlation.attemptId : null,
      contactId: correlation.status === "correlated" ? correlation.contactId : null,
      provider: input.webhook.provider,
      providerEventId: input.webhook.providerEventId,
      inboundMessageId: input.webhook.inboundMessageId,
      correlationStatus: correlation.status,
      correlationMethod: correlation.method,
      sender: input.webhook.sender,
      recipient: tokenRecipient ?? input.webhook.recipients[0] ?? "",
      subject: input.webhook.subject,
      textBody: input.content.textBody,
      inReplyTo: boundedHeader(input.content.inReplyTo, 998),
      referencesHeader: boundedHeader(input.content.references, 8192),
      receivedAt: dependencies.now(),
      occurredAt: input.webhook.occurredAt,
    };
    const reservation = await dependencies.createInboundMessage(payload);
    return { disposition: reservation.disposition, message: reservation.message, correlationStatus: reservation.message.correlation_status };
  };
}
