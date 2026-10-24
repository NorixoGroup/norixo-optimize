/**
 * True when one of the audits carries a trace of a paid checkout. Historical audits created by the former
 * "restore after payment" mechanism (`restored_after_payment`, `source: "stripe_webhook_audit_test"` or a Stripe session
 * id) keep matching, so they stay visible and unlock the same panel as before.
 */
export function hasPaidAuditSignal(
  audits: ReadonlyArray<{
    result_payload?: {
      restored_after_payment?: boolean | null;
      source?: string | null;
      stripe_checkout_session_id?: string | null;
    } | null;
  }>
): boolean {
  return audits.some((audit) => {
    const payload = audit.result_payload;
    return Boolean(
      payload?.restored_after_payment ||
        payload?.source === "stripe_webhook_audit_test" ||
        payload?.stripe_checkout_session_id
    );
  });
}
