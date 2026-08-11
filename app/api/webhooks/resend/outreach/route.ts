import { NextResponse } from "next/server";
import { Resend } from "resend";

import { verifyAndNormalizeResendOutreachWebhook, ResendWebhookAdapterError, type ResendOutreachWebhookResult, type ResendWebhookVerify } from "@/lib/backlinks/providers/resendWebhookAdapter";
import { createBacklinkOutreachDeliveryEventIngestionService, type OutreachDeliveryEventIngestionResult } from "@/lib/backlinks/services/outreachDeliveryEventIngestionService";
import { createBacklinkOutreachDeliveryEvent, type BacklinkOutreachDeliveryEventRow } from "@/lib/backlinks/repositories/outreachDeliveryEventsRepository";
import { applyBacklinkOutreachProviderComplaint } from "@/lib/backlinks/repositories/outreachDeliveryEffectsRepository";
import { applyBacklinkOutreachProviderPermanentBounce } from "@/lib/backlinks/repositories/outreachDeliveryEffectsRepository";
import { getBacklinkOutreachAttemptByProviderMessageId } from "@/lib/backlinks/repositories/outreachAttemptsRepository";
import { createBacklinkOutreachComplaintStopSignalService, type ComplaintStopSignalResult } from "@/lib/backlinks/services/outreachComplaintStopSignalService";
import { createBacklinkOutreachPermanentBounceStopSignalService, type PermanentBounceStopSignalResult } from "@/lib/backlinks/services/outreachPermanentBounceStopSignalService";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type ResendOutreachWebhookHandlerDependencies = {
  getWebhookSecret(): string | null | undefined;
  verify: ResendWebhookVerify;
  ingest(event: ResendOutreachWebhookResult): Promise<OutreachDeliveryEventIngestionResult>;
  processComplaint(event: BacklinkOutreachDeliveryEventRow): Promise<ComplaintStopSignalResult>;
  processPermanentBounce(event: BacklinkOutreachDeliveryEventRow): Promise<PermanentBounceStopSignalResult>;
};

function response(disposition: OutreachDeliveryEventIngestionResult["disposition"], effectDisposition?: "applied" | "existing") {
  return NextResponse.json({ ok: true, disposition, ...(effectDisposition == null ? {} : { effectDisposition }) });
}

export function createResendOutreachWebhookHandler(deps: ResendOutreachWebhookHandlerDependencies) {
  return async (request: Request) => {
    const payload = await request.text();
    let event: ResendOutreachWebhookResult;
    try {
      event = verifyAndNormalizeResendOutreachWebhook({
        payload,
        headers: {
          svixId: request.headers.get("svix-id"),
          svixTimestamp: request.headers.get("svix-timestamp"),
          svixSignature: request.headers.get("svix-signature"),
        },
        webhookSecret: deps.getWebhookSecret(),
        verify: deps.verify,
      });
    } catch (error) {
      if (error instanceof ResendWebhookAdapterError && error.code === "RESEND_WEBHOOK_SECRET_MISSING") {
        return NextResponse.json({ error: "Webhook unavailable." }, { status: 500 });
      }
      return NextResponse.json({ error: "Invalid webhook request." }, { status: 400 });
    }

    let ingestion: OutreachDeliveryEventIngestionResult;
    try {
      ingestion = await deps.ingest(event);
    } catch {
      return NextResponse.json({ error: "Webhook ingestion unavailable." }, { status: 500 });
    }

    if (ingestion.disposition === "ignored" || ingestion.disposition === "unmatched") return response(ingestion.disposition);

    let complaintEffect: ComplaintStopSignalResult;
    try {
      complaintEffect = await deps.processComplaint(ingestion.deliveryEvent);
    } catch {
      return NextResponse.json({ error: "Webhook complaint processing unavailable." }, { status: 500 });
    }
    let permanentBounceEffect: PermanentBounceStopSignalResult;
    try {
      permanentBounceEffect = await deps.processPermanentBounce(ingestion.deliveryEvent);
    } catch {
      return NextResponse.json({ error: "Webhook permanent bounce processing unavailable." }, { status: 500 });
    }
    const effectDisposition = complaintEffect.disposition === "not_applicable"
      ? permanentBounceEffect.disposition === "not_applicable" ? undefined : permanentBounceEffect.disposition
      : complaintEffect.disposition;
    return response(ingestion.disposition, effectDisposition);
  };
}

export async function POST(request: Request) {
  return createResendOutreachWebhookHandler({
    getWebhookSecret: () => process.env.RESEND_WEBHOOK_SECRET,
    verify: (input) => new Resend().webhooks.verify(input),
    ingest: async (event) => {
      const client = createSupabaseAdminClient();
      return createBacklinkOutreachDeliveryEventIngestionService({
        getAttemptByProviderMessageId: (provider, providerMessageId) => getBacklinkOutreachAttemptByProviderMessageId(client, provider, providerMessageId),
        createDeliveryEvent: (input) => createBacklinkOutreachDeliveryEvent(client, input),
        now: () => new Date().toISOString(),
      })(event);
    },
    processComplaint: async (deliveryEvent) => {
      const client = createSupabaseAdminClient();
      return createBacklinkOutreachComplaintStopSignalService({
        applyProviderComplaint: (input) => applyBacklinkOutreachProviderComplaint(client, input),
        now: () => new Date().toISOString(),
      })(deliveryEvent);
    },
    processPermanentBounce: async (deliveryEvent) => {
      const client = createSupabaseAdminClient();
      return createBacklinkOutreachPermanentBounceStopSignalService({
        applyPermanentBounce: (input) => applyBacklinkOutreachProviderPermanentBounce(client, input),
        now: () => new Date().toISOString(),
      })(deliveryEvent);
    },
  })(request);
}
