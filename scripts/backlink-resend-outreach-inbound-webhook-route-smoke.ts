import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

async function main() {
  const source = readFileSync(new URL("../app/api/webhooks/resend/outreach/inbound/route.ts", import.meta.url), "utf8");
  for (const required of ["export async function POST", "export const runtime = \"nodejs\"", "await request.text()", "svix-id", "svix-timestamp", "svix-signature", "RESEND_INBOUND_WEBHOOK_SECRET", "verifyAndNormalizeResendInboundWebhook", "createEnvironmentResendInboundEmailClient", "ingestBacklinkInboundMessage", "createBacklinkOutreachInboundReplyStopSignalService", "processInboundReply(ingestion.message)"]) assert(source.includes(required), `Missing ${required}`);
  for (const forbidden of ["request.json()", "RESEND_API_KEY", "getRequestUserAndWorkspace", "requireWorkspace", "request.url", "searchParams", "updateBacklinkOutreach", "updateBacklinkContact", "updateBacklinkOutreachAttemptState", "outreachLifecycleService", "outreachEmailSendService", "sendTransactionalEmail", "scheduler", "classification", "next_follow_up_at"]) assert(!source.includes(forbidden), `Forbidden route behavior: ${forbidden}`);
  for (const sensitive of ["inboundMessageId", "outreachId", "contactId", "attemptId", "sender", "recipient", "subject", "textBody", "references", "token", "workspaceId"]) assert(!/return response\([^\n]*\b/.test(source) || !source.includes(`{ ok: true, ${sensitive}`), `Route response must not expose ${sensitive}`);
  console.log("PASS — Resend outreach inbound webhook route smoke");
}

void main();
