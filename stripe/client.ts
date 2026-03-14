// Placeholder Stripe helpers. Replace with real Stripe SDK integration.

export interface CheckoutSessionResult {
  url: string;
}

export async function createCheckoutSession(): Promise<CheckoutSessionResult> {
  console.warn("Stripe checkout is not configured. Returning placeholder URL.");
  return { url: "https://billing.stripe.com/p/test-placeholder" };
}

export async function getCustomerPortalUrl(): Promise<string> {
  console.warn("Stripe customer portal not configured. Returning placeholder URL.");
  return "https://billing.stripe.com/p/test-portal-placeholder";
}
