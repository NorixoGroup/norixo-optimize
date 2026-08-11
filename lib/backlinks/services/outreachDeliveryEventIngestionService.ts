import type { CreateBacklinkOutreachDeliveryEventInput, BacklinkOutreachDeliveryEventReservation, BacklinkOutreachDeliveryEventRow } from "../repositories/outreachDeliveryEventsRepository";
import type { BacklinkOutreachAttemptRow } from "../repositories/outreachAttemptsRepository";
import type { ResendOutreachWebhookResult } from "../providers/resendWebhookAdapter";

export type OutreachDeliveryEventIngestionDependencies = {
  getAttemptByProviderMessageId(provider: "resend", providerMessageId: string): Promise<BacklinkOutreachAttemptRow | null>;
  createDeliveryEvent(input: CreateBacklinkOutreachDeliveryEventInput): Promise<BacklinkOutreachDeliveryEventReservation>;
  now(): string;
};

export type OutreachDeliveryEventIngestionResult =
  | { disposition: "ignored"; eventType: string }
  | { disposition: "unmatched"; eventType: string }
  | { disposition: "created" | "existing"; deliveryEvent: BacklinkOutreachDeliveryEventRow; eventId: string; outreachId: string; attemptId: string; eventType: Exclude<ResendOutreachWebhookResult, { disposition: "ignored" }>["eventType"] };

export function createBacklinkOutreachDeliveryEventIngestionService(deps: OutreachDeliveryEventIngestionDependencies) {
  return async (event: ResendOutreachWebhookResult): Promise<OutreachDeliveryEventIngestionResult> => {
    if (event.disposition === "ignored") return { disposition: "ignored", eventType: event.eventType };

    const attempt = await deps.getAttemptByProviderMessageId("resend", event.providerMessageId);
    if (attempt == null) return { disposition: "unmatched", eventType: event.eventType };

    const reservation = await deps.createDeliveryEvent({
      workspaceId: attempt.workspace_id,
      outreachId: attempt.outreach_id,
      attemptId: attempt.id,
      provider: event.provider,
      providerEventId: event.providerEventId,
      providerMessageId: event.providerMessageId,
      eventType: event.eventType,
      bounceType: event.eventType === "email.bounced" ? event.bounceType : null,
      occurredAt: event.occurredAt,
      receivedAt: deps.now(),
    });

    return {
      disposition: reservation.disposition,
      deliveryEvent: reservation.event,
      eventId: reservation.event.id,
      outreachId: attempt.outreach_id,
      attemptId: attempt.id,
      eventType: event.eventType,
    };
  };
}
