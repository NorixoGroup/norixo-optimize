import { Resend } from "resend";

import { detectInboundAutoReply, normalizeInboundTextBody, selectInboundHeaders } from "./resendInboundEmailNormalization";

type ResendReceivingEmailResponse = { data: { text: string | null; headers: Record<string, string> | null } | null; error: { name: string; statusCode: number | null; message: string } | null };
export type ResendInboundEmailClientDependencies = { apiKey: string | undefined; get?: (emailId: string) => Promise<ResendReceivingEmailResponse> };
export type ResendInboundEmailClientErrorCode = "RESEND_INBOUND_EMAIL_CONFIGURATION_MISSING" | "RESEND_INBOUND_EMAIL_ID_INVALID" | "RESEND_INBOUND_EMAIL_PROVIDER_REJECTED" | "RESEND_INBOUND_EMAIL_PROVIDER_UNAVAILABLE" | "RESEND_INBOUND_EMAIL_CONTENT_INVALID";

export class ResendInboundEmailClientError extends Error {
  constructor(public readonly code: ResendInboundEmailClientErrorCode) { super(code); this.name = "ResendInboundEmailClientError"; }
}

function requiredEmailId(value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new ResendInboundEmailClientError("RESEND_INBOUND_EMAIL_ID_INVALID");
  return normalized;
}

export function createResendInboundEmailClient(dependencies: ResendInboundEmailClientDependencies) {
  return async (emailId: string): Promise<{ textBody: string | null; messageId: string | null; inReplyTo: string[]; references: string[]; autoReply: { isAutoReply: boolean; reason: ReturnType<typeof detectInboundAutoReply>["reason"] } }> => {
    const normalizedEmailId = requiredEmailId(emailId);
    const apiKey = dependencies.apiKey?.trim();
    if (!apiKey) throw new ResendInboundEmailClientError("RESEND_INBOUND_EMAIL_CONFIGURATION_MISSING");
    const get = dependencies.get ?? ((id) => new Resend(apiKey).emails.receiving.get(id));
    let response: ResendReceivingEmailResponse;
    try { response = await get(normalizedEmailId); } catch { throw new ResendInboundEmailClientError("RESEND_INBOUND_EMAIL_PROVIDER_UNAVAILABLE"); }
    if (response.error != null) {
      if (response.error.statusCode != null && response.error.statusCode >= 400 && response.error.statusCode < 500) throw new ResendInboundEmailClientError("RESEND_INBOUND_EMAIL_PROVIDER_REJECTED");
      throw new ResendInboundEmailClientError("RESEND_INBOUND_EMAIL_PROVIDER_UNAVAILABLE");
    }
    if (response.data == null) throw new ResendInboundEmailClientError("RESEND_INBOUND_EMAIL_CONTENT_INVALID");
    const headers = selectInboundHeaders(response.data.headers);
    return { textBody: normalizeInboundTextBody(response.data.text), messageId: headers.messageId, inReplyTo: headers.inReplyTo, references: headers.references, autoReply: detectInboundAutoReply({ sender: null, autoSubmitted: headers.autoSubmitted, precedence: headers.precedence, xAutoreply: headers.xAutoreply }) };
  };
}

export function createEnvironmentResendInboundEmailClient() {
  return createResendInboundEmailClient({ apiKey: process.env.RESEND_API_KEY });
}
