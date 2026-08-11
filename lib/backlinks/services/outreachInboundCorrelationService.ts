import { hashBacklinkOutreachReplyToken } from "./outreachReplyCorrelationIdentity";

export type BacklinkInboundCorrelationResult =
  | { status: "correlated"; method: "reply_token"; workspaceId: string; outreachId: string; attemptId: string; contactId: string }
  | { status: "unmatched" | "ambiguous" | "ignored"; method: null };

export type BacklinkInboundCorrelationDependencies = {
  getAttemptByReplyTokenHash(replyTokenHash: string): Promise<{ id: string; workspace_id: string; outreach_id: string } | null>;
  getOutreach(workspaceId: string, outreachId: string): Promise<{ id: string; workspace_id: string; contact_id: string; status: string }>;
  getContact(workspaceId: string, contactId: string): Promise<{ id: string; workspace_id: string; email_normalized: string | null; contact_status: string }>;
};

export class BacklinkInboundCorrelationError extends Error {
  constructor(public readonly code: "INBOUND_CORRELATION_INTEGRITY_INVALID") { super(code); this.name = "BacklinkInboundCorrelationError"; }
}

export function correlateBacklinkInboundReply(dependencies: BacklinkInboundCorrelationDependencies) {
  return async (input: { sender: string; tokenCandidates: readonly string[]; autoReply: { isAutoReply: boolean } }): Promise<BacklinkInboundCorrelationResult> => {
    if (input.autoReply.isAutoReply) return { status: "ignored", method: null };
    const tokenCandidates = [...new Set(input.tokenCandidates)];
    if (tokenCandidates.length === 0) return { status: "unmatched", method: null };
    if (tokenCandidates.length !== 1) return { status: "ambiguous", method: null };
    const attempt = await dependencies.getAttemptByReplyTokenHash(hashBacklinkOutreachReplyToken(tokenCandidates[0]));
    if (attempt == null) return { status: "unmatched", method: null };
    const outreach = await dependencies.getOutreach(attempt.workspace_id, attempt.outreach_id);
    if (outreach.id !== attempt.outreach_id || outreach.workspace_id !== attempt.workspace_id) throw new BacklinkInboundCorrelationError("INBOUND_CORRELATION_INTEGRITY_INVALID");
    const contact = await dependencies.getContact(attempt.workspace_id, outreach.contact_id);
    if (contact.id !== outreach.contact_id || contact.workspace_id !== attempt.workspace_id) throw new BacklinkInboundCorrelationError("INBOUND_CORRELATION_INTEGRITY_INVALID");
    if (contact.email_normalized !== input.sender) return { status: "ambiguous", method: null };
    return { status: "correlated", method: "reply_token", workspaceId: attempt.workspace_id, outreachId: outreach.id, attemptId: attempt.id, contactId: contact.id };
  };
}
