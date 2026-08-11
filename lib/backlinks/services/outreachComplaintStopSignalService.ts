import type { BacklinkOutreachDeliveryEventRow } from "../repositories/outreachDeliveryEventsRepository";
import type { ApplyBacklinkOutreachProviderComplaintInput, ApplyBacklinkOutreachProviderComplaintResult } from "../repositories/outreachDeliveryEffectsRepository";

export type ComplaintStopSignalResult =
  | { disposition: "not_applicable" }
  | { disposition: "applied" | "existing"; deliveryEventId: string; outreachId: string; contactId: string };

export type OutreachComplaintStopSignalDependencies = {
  applyProviderComplaint(input: ApplyBacklinkOutreachProviderComplaintInput): Promise<ApplyBacklinkOutreachProviderComplaintResult>;
  now(): string;
};

export function createBacklinkOutreachComplaintStopSignalService(deps: OutreachComplaintStopSignalDependencies) {
  return async (deliveryEvent: BacklinkOutreachDeliveryEventRow): Promise<ComplaintStopSignalResult> => {
    if (deliveryEvent.event_type !== "email.complained") return { disposition: "not_applicable" };
    const result = await deps.applyProviderComplaint({ deliveryEventId: deliveryEvent.id, appliedAt: deps.now() });
    return {
      disposition: result.disposition,
      deliveryEventId: result.deliveryEventId,
      outreachId: result.outreachId,
      contactId: result.contactId,
    };
  };
}
