const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function normalizedString(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized || null;
}

function normalizedInboundDomain(domain: string): string | null {
  const normalized = normalizedString(domain)?.toLowerCase() ?? null;
  if (!normalized) return null;
  const labels = normalized.split(".");
  if (normalized.length > 253 || labels.length < 2 || labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return null;
  return normalized;
}

export function normalizeInboundEmailAddress(value: string | null | undefined): string | null {
  const normalized = normalizedString(value);
  if (!normalized) return null;
  const bracketed = normalized.match(/<([^<>\s]+)>$/)?.[1] ?? normalized;
  const email = bracketed.toLowerCase();
  return emailPattern.test(email) ? email : null;
}

export function normalizeMessageId(value: string | null | undefined): string | null {
  const normalized = normalizedString(value);
  return normalized != null && /^<[^<>\s]+>$/.test(normalized) ? normalized : null;
}

export function normalizeReferences(value: string | null | undefined): string[] {
  const candidates = value?.match(/<[^<>\s]+>/g) ?? [];
  return [...new Set(candidates.map(normalizeMessageId).filter((candidate): candidate is string => candidate != null))];
}

export function normalizeInReplyTo(value: string | null | undefined): string[] {
  return normalizeReferences(value);
}

export function normalizeInboundTextBody(value: string | null | undefined): string | null {
  const normalized = normalizedString(value);
  return normalized == null ? null : Array.from(normalized).slice(0, 65536).join("");
}

export function extractBacklinkOutreachReplyToken(recipient: string, inboundReplyDomain: string): string | null {
  const email = normalizeInboundEmailAddress(recipient);
  const domain = normalizedInboundDomain(inboundReplyDomain);
  if (!email || !domain) return null;
  const separator = email.lastIndexOf("@");
  const localPart = email.slice(0, separator);
  if (email.slice(separator + 1) !== domain || !localPart.startsWith("reply+")) return null;
  const token = localPart.slice("reply+".length);
  return uuidPattern.test(token) ? token.toLowerCase() : null;
}

export function extractBacklinkOutreachReplyTokens(recipients: readonly string[], inboundReplyDomain: string): string[] {
  return [...new Set(recipients.map((recipient) => extractBacklinkOutreachReplyToken(recipient, inboundReplyDomain)).filter((token): token is string => token != null))];
}

export type InboundAutoReplyReason = "auto_submitted" | "precedence" | "x_autoreply" | "mailer_daemon" | "postmaster" | null;

export function detectInboundAutoReply(input: { sender: string | null; autoSubmitted: string | null; precedence: string | null; xAutoreply: string | null }): { isAutoReply: boolean; reason: InboundAutoReplyReason } {
  if (input.autoSubmitted?.trim().toLowerCase() !== undefined && input.autoSubmitted.trim().toLowerCase() !== "no") return { isAutoReply: true, reason: "auto_submitted" };
  if (["bulk", "list", "junk", "auto_reply", "auto-reply"].includes(input.precedence?.trim().toLowerCase() ?? "")) return { isAutoReply: true, reason: "precedence" };
  if (input.xAutoreply?.trim()) return { isAutoReply: true, reason: "x_autoreply" };
  const sender = normalizeInboundEmailAddress(input.sender);
  if (sender?.startsWith("mailer-daemon@")) return { isAutoReply: true, reason: "mailer_daemon" };
  if (sender?.startsWith("postmaster@")) return { isAutoReply: true, reason: "postmaster" };
  return { isAutoReply: false, reason: null };
}

export function selectInboundHeaders(headers: Record<string, string> | null | undefined): { messageId: string | null; inReplyTo: string[]; references: string[]; autoSubmitted: string | null; precedence: string | null; xAutoreply: string | null } {
  const values = new Map<string, string>();
  for (const [name, value] of Object.entries(headers ?? {})) values.set(name.toLowerCase(), value);
  return {
    messageId: normalizeMessageId(values.get("message-id")),
    inReplyTo: normalizeInReplyTo(values.get("in-reply-to")),
    references: normalizeReferences(values.get("references")),
    autoSubmitted: normalizedString(values.get("auto-submitted")),
    precedence: normalizedString(values.get("precedence")),
    xAutoreply: normalizedString(values.get("x-autoreply")),
  };
}
