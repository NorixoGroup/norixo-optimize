/**
 * /dashboard/listings status card for a workspace that is still on the "free" plan code (Starter buyers keep it).
 * The free-plan card only knows the free allowance, so it would say "no audits available" next to a usable purchased
 * credit. When the credit balance exceeds what the free allowance still offers, the card shows the real balance.
 * Credits are never invented: this only decides which of two existing numbers is displayed.
 */
export function shouldShowCreditBalanceOnFreePlan(params: {
  remainingFreeAudits: number | null;
  creditsAvailable: number | null;
}): boolean {
  const { remainingFreeAudits, creditsAvailable } = params;
  if (typeof creditsAvailable !== "number" || !(creditsAvailable > 0)) return false;
  return creditsAvailable > (remainingFreeAudits ?? 0);
}
