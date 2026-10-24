/**
 * `subscriptions.plan_code` after a one-shot purchase. Offers (Starter 1, Pro 5, Scale 15) only add credits; the plan code
 * is never used to restrict or replace credits, and a purchase never lowers it. Starter (also bought as `audit_test`)
 * grants no Pro privilege: it leaves an existing pro/scale code untouched and otherwise leaves the workspace on "free".
 */
const RANK: Record<string, number> = { free: 0, pro: 1, scale: 2 };

export function resolvePlanCodeAfterPurchase(params: {
  purchasedPlan: string;
  priorPlanCode: string | null | undefined;
  subscriptionStatus: string | null | undefined;
}): string {
  const prior = params.priorPlanCode === "pro" || params.priorPlanCode === "scale" ? params.priorPlanCode : "free";
  const purchased = params.purchasedPlan === "pro" || params.purchasedPlan === "scale" ? params.purchasedPlan : "free";
  const paidStatus = params.subscriptionStatus === "active" || params.subscriptionStatus === "trialing";
  if (!paidStatus) return prior;
  return RANK[purchased] > RANK[prior] ? purchased : prior;
}
