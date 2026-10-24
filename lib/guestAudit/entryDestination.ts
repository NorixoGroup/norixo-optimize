import { POST_PAYMENT_AUDIT_PATH } from "../billing/postPayment";

/**
 * Destinations of the /audit/new entry page. The guest audit is disabled (app/api/guest-audit answers 410), so the page
 * only routes the visitor to the real, credit-gated audit flow. A signed-out visitor goes through /sign-in with `next`
 * set to the final destination (never back to /audit/new, so there is no sign-in loop).
 */
export const BILLING_PATH = "/dashboard/billing";
const KNOWN_OFFERS = new Set(["audit_test", "pack_5", "pack_15"]);

const viaSignIn = (path: string) => `/sign-in?next=${encodeURIComponent(path)}`;

export function getAuditEntryDestinations(input: { isAuthenticated: boolean; offer?: string | null }): {
  auditHref: string;
  billingHref: string;
} {
  const offer = input.offer && KNOWN_OFFERS.has(input.offer) ? input.offer : null;
  const billingPath = offer ? `${BILLING_PATH}?offer=${offer}` : BILLING_PATH;
  return {
    auditHref: input.isAuthenticated ? POST_PAYMENT_AUDIT_PATH : viaSignIn(POST_PAYMENT_AUDIT_PATH),
    billingHref: input.isAuthenticated ? billingPath : viaSignIn(billingPath),
  };
}
