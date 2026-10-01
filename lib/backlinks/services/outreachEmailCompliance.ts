/**
 * Send-time compliance block for outreach email.
 *
 * It is appended by the provider layer at send time, not stored in the approved
 * draft. That keeps the human-approved body and its approval fingerprint intact
 * while guaranteeing that every email (initial, follow-up, previously approved
 * or not) carries the Norixo identity and an opt-out instruction.
 *
 * No legal entity, postal address or registration number is included: those are
 * owner decisions and are intentionally not invented here.
 */

export type OutreachComplianceLocale = "en";

type OutreachComplianceCopy = {
  senderIdentity: string;
  optOutIntro: string;
  optOutReply: string;
  optOutLink: string;
};

export const OUTREACH_COMPLIANCE_COPY: Readonly<Record<OutreachComplianceLocale, OutreachComplianceCopy>> = {
  en: {
    senderIdentity: "Norixo",
    optOutIntro: "If you would rather not receive further emails from Norixo,",
    optOutReply: "reply to this message with \"unsubscribe\"",
    optOutLink: "or opt out here:",
  },
};

export const OUTREACH_DEFAULT_COMPLIANCE_LOCALE: OutreachComplianceLocale = "en";

export function appendOutreachComplianceFooter(
  body: string,
  unsubscribeUrl: string,
  locale: OutreachComplianceLocale = OUTREACH_DEFAULT_COMPLIANCE_LOCALE,
): string {
  const url = unsubscribeUrl.trim();
  if (!url) throw new Error("OUTREACH_COMPLIANCE_UNSUBSCRIBE_URL_REQUIRED");
  if (body.includes(url)) return body;
  const copy = OUTREACH_COMPLIANCE_COPY[locale];
  return [
    body.replace(/\s+$/, ""),
    "",
    "--",
    copy.senderIdentity,
    `${copy.optOutIntro} ${copy.optOutReply} ${copy.optOutLink}`,
    url,
  ].join("\n");
}

/**
 * RFC 2369 `List-Unsubscribe` plus RFC 8058 one-click signalling. Only an https
 * target is advertised: the hosted endpoint accepts the one-click POST directly.
 * The header names/values are emitted through Resend's `headers` option
 * (Record<string, string>, present in the installed SDK typings).
 */
export function buildListUnsubscribeHeaders(unsubscribeUrl: string): Record<string, string> {
  const url = unsubscribeUrl.trim();
  if (!/^https:\/\//i.test(url)) throw new Error("OUTREACH_COMPLIANCE_UNSUBSCRIBE_URL_NOT_HTTPS");
  return {
    "List-Unsubscribe": `<${url}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}
