import type { BacklinkOutreachDeliveryEventRow } from "../repositories/outreachDeliveryEventsRepository";
import type { ApplyBacklinkOutreachProviderPermanentBounceInput, ApplyBacklinkOutreachProviderPermanentBounceResult } from "../repositories/outreachDeliveryEffectsRepository";

export type PermanentBounceStopSignalResult =
  | { disposition: "not_applicable" }
  | { disposition: "applied" | "existing"; deliveryEventId: string; outreachId: string; contactId: string };

export type OutreachPermanentBounceStopSignalDependencies = {
  applyPermanentBounce(input: ApplyBacklinkOutreachProviderPermanentBounceInput): Promise<ApplyBacklinkOutreachProviderPermanentBounceResult>;
  now?: () => string;
};

export function createBacklinkOutreachPermanentBounceStopSignalService(deps: OutreachPermanentBounceStopSignalDependencies) {
  return async (deliveryEvent: BacklinkOutreachDeliveryEventRow): Promise<PermanentBounceStopSignalResult> => {
    if (deliveryEvent.event_type !== "email.bounced" || deliveryEvent.bounce_type !== "permanent") return { disposition: "not_applicable" };
    const result = await deps.applyPermanentBounce({ deliveryEventId: deliveryEvent.id, appliedAt: (deps.now ?? (() => new Date().toISOString()))() });
    return { disposition: result.disposition, deliveryEventId: result.deliveryEventId, outreachId: result.outreachId, contactId: result.contactId };
  };
}
