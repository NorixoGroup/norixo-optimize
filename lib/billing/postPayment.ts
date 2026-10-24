/**
 * Post-payment contract (pure, no I/O).
 *
 * A purchase is "confirmed" only when the Stripe webhook has finished: it grants the credit lot, records the payment and
 * marks the checkout intent `completed` LAST (app/api/stripe/webhook/route.ts). The interface may therefore say that a
 * credit is available only for a completed intent. Nothing here runs an audit or consumes a credit.
 */

/** Where a customer who has paid creates or selects a listing and launches the audit (credit-gated by /api/audits). */
export const POST_PAYMENT_AUDIT_PATH = "/dashboard/listings/new";

export function getPostPaymentAuditUrl(appUrl: string): string {
  return `${appUrl.replace(/\/$/, "")}${POST_PAYMENT_AUDIT_PATH}`;
}

/** How long the billing page keeps waiting for the webhook before it only says that confirmation is still pending. */
export const POST_PAYMENT_CONFIRMATION_WAIT_MS = 45_000;

export type CheckoutIntentSnapshot = { status?: string | null; completed_at?: string | null } | null | undefined;

export type PostPaymentState = "confirmed" | "pending" | "failed";

export function resolvePostPaymentState(intent: CheckoutIntentSnapshot): PostPaymentState {
  if (!intent || typeof intent.status !== "string") return "pending";
  if (intent.status === "completed") return intent.completed_at ? "confirmed" : "pending";
  if (intent.status === "failed" || intent.status === "expired" || intent.status === "canceled") return "failed";
  return "pending";
}

export type PostPaymentStep = "show_credit_available" | "keep_waiting" | "show_still_pending" | "show_failure";

export function nextPostPaymentStep(state: PostPaymentState, elapsedMs: number): PostPaymentStep {
  if (state === "confirmed") return "show_credit_available";
  if (state === "failed") return "show_failure";
  return elapsedMs >= POST_PAYMENT_CONFIRMATION_WAIT_MS ? "show_still_pending" : "keep_waiting";
}

export type PostPaymentOutcome = "credit_available" | "still_pending" | "failed" | "aborted";

/**
 * Waits for the webhook after the Stripe redirect. `fetchState` reads the checkout intent of THIS session (workspace-scoped
 * on the server). The browser may leave the page at any time (`isActive`); the loop then stops without announcing anything.
 */
export async function waitForPostPaymentConfirmation(deps: {
  fetchState: () => Promise<PostPaymentState>;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  isActive: () => boolean;
  pollMs: number;
}): Promise<PostPaymentOutcome> {
  const startedAt = deps.now();
  while (deps.isActive()) {
    const state = await deps.fetchState();
    if (!deps.isActive()) return "aborted";
    const step = nextPostPaymentStep(state, deps.now() - startedAt);
    if (step === "show_credit_available") return "credit_available";
    if (step === "show_failure") return "failed";
    if (step === "show_still_pending") return "still_pending";
    await deps.sleep(deps.pollMs);
  }
  return "aborted";
}
