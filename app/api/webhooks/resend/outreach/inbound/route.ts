import { NextResponse } from "next/server";
import { Resend } from "resend";

import { createEnvironmentResendInboundEmailClient } from "@/lib/backlinks/providers/resendInboundEmailClient";
import { ResendInboundWebhookAdapterError, verifyAndNormalizeResendInboundWebhook, type ResendInboundWebhookResult } from "@/lib/backlinks/providers/resendInboundWebhookAdapter";
import type { ResendWebhookVerify } from "@/lib/backlinks/providers/resendWebhookAdapter";
import { getBacklinkContactById } from "@/lib/backlinks/repositories/contactsRepository";
import { applyBacklinkOutreachInboundReplyStop } from "@/lib/backlinks/repositories/outreachInboundEffectsRepository";
import { createBacklinkOutreachInboundMessage, type BacklinkOutreachInboundMessageRow } from "@/lib/backlinks/repositories/outreachInboundMessagesRepository";
import { getBacklinkOutreachById } from "@/lib/backlinks/repositories/outreachRepository";
import { getBacklinkOutreachAttemptByReplyTokenHash } from "@/lib/backlinks/repositories/outreachAttemptsRepository";
import { correlateBacklinkInboundReply } from "@/lib/backlinks/services/outreachInboundCorrelationService";
import { ingestBacklinkInboundMessage } from "@/lib/backlinks/services/outreachInboundMessageIngestionService";
import { createBacklinkOutreachInboundReplyStopSignalService, type InboundReplyStopSignalResult } from "@/lib/backlinks/services/outreachInboundReplyStopSignalService";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type InboundReceivingContent = { textBody: string | null; messageId: string | null; inReplyTo: string[]; references: string[]; autoReply: { isAutoReply: boolean } };
type InboundIngestionResult = { disposition: "created" | "existing"; message: BacklinkOutreachInboundMessageRow; correlationStatus: string };
type InboundWebhookInput = { webhook: { provider: "resend"; providerEventId: string; inboundMessageId: string; sender: string; recipients: string[]; subject: string | null; occurredAt: string }; content: InboundReceivingContent; inboundReplyDomain: string };

type ResendOutreachInboundWebhookHandlerDependencies = {
  getWebhookSecret(): string | null | undefined;
  getInboundReplyDomain(): string;
  verify: ResendWebhookVerify;
  receive(emailId: string): Promise<InboundReceivingContent>;
  ingest(input: InboundWebhookInput): Promise<InboundIngestionResult>;
  processInboundReply(inboundMessage: BacklinkOutreachInboundMessageRow): Promise<InboundReplyStopSignalResult>;
};

function response(body: Record<string, string | boolean>) {
  return NextResponse.json(body);
}

export function createResendOutreachInboundWebhookHandler(deps: ResendOutreachInboundWebhookHandlerDependencies) {
  return async (request: Request) => {
    const payload = await request.text();
    let event: ResendInboundWebhookResult;
    try {
      event = verifyAndNormalizeResendInboundWebhook({
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
      if (error instanceof ResendInboundWebhookAdapterError && error.code === "RESEND_INBOUND_WEBHOOK_SECRET_MISSING") {
        return NextResponse.json({ error: "Webhook unavailable." }, { status: 500 });
      }
      return NextResponse.json({ error: "Invalid webhook request." }, { status: 400 });
    }
    if (event.disposition === "ignored") return response({ ok: true, disposition: "ignored" });

    let content: InboundReceivingContent;
    try {
      content = await deps.receive(event.emailId);
    } catch {
      return NextResponse.json({ error: "Webhook inbound reply processing unavailable." }, { status: 500 });
    }

    let ingestion: InboundIngestionResult;
    try {
      ingestion = await deps.ingest({
        webhook: {
          provider: event.provider,
          providerEventId: event.providerEventId,
          inboundMessageId: event.inboundMessageId,
          sender: event.sender,
          recipients: event.recipients,
          subject: event.subject,
          occurredAt: event.occurredAt,
        },
        content,
        inboundReplyDomain: deps.getInboundReplyDomain(),
      });
    } catch {
      return NextResponse.json({ error: "Webhook inbound reply processing unavailable." }, { status: 500 });
    }

    if (ingestion.correlationStatus !== "correlated") return response({ ok: true, disposition: ingestion.correlationStatus });

    let effect: InboundReplyStopSignalResult;
    try {
      effect = await deps.processInboundReply(ingestion.message);
    } catch {
      return NextResponse.json({ error: "Webhook inbound reply processing unavailable." }, { status: 500 });
    }
    if (effect.disposition === "not_applicable") return response({ ok: true, disposition: "correlated" });
    return response({ ok: true, disposition: ingestion.disposition, correlationStatus: "correlated", effectDisposition: effect.disposition });
  };
}

export async function POST(request: Request) {
  return createResendOutreachInboundWebhookHandler({
    getWebhookSecret: () => process.env.RESEND_INBOUND_WEBHOOK_SECRET,
    getInboundReplyDomain: () => process.env.OUTREACH_INBOUND_REPLY_DOMAIN ?? "",
    verify: (input) => new Resend().webhooks.verify(input),
    receive: createEnvironmentResendInboundEmailClient(),
    ingest: async (input) => {
      const client = createSupabaseAdminClient();
      return ingestBacklinkInboundMessage({
        correlate: correlateBacklinkInboundReply({
          getAttemptByReplyTokenHash: (replyTokenHash) => getBacklinkOutreachAttemptByReplyTokenHash(client, replyTokenHash),
          getOutreach: (workspaceId, outreachId) => getBacklinkOutreachById(client, workspaceId, outreachId),
          getContact: (workspaceId, contactId) => getBacklinkContactById(client, workspaceId, contactId),
        }),
        createInboundMessage: (value) => createBacklinkOutreachInboundMessage(client, value),
        now: () => new Date().toISOString(),
      })(input);
    },
    processInboundReply: async (inboundMessage) => {
      const client = createSupabaseAdminClient();
      return createBacklinkOutreachInboundReplyStopSignalService({
        applyInboundReplyStop: (value) => applyBacklinkOutreachInboundReplyStop(client, value),
        now: () => new Date().toISOString(),
      })(inboundMessage);
    },
  })(request);
}
