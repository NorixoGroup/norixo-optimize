/** Read-only, advisory rate eligibility. Atomic reservation remains authoritative. */
export type BacklinkOutreachRateEligibilityDependencies = {
  listAttemptSummariesSince: (workspaceId: string, since: string) => Promise<readonly { outreach_id: string; requested_at: string; status: string }[]>;
  getOutreach: (workspaceId: string, outreachId: string) => Promise<{ id: string; opportunity_id: string; contact_id: string }>;
  getOpportunity: (workspaceId: string, opportunityId: string) => Promise<{ id: string; domain_id: string }>;
};

export type BacklinkOutreachRateEligibility =
  | { allowed: true }
  | { allowed: false; reason: "WORKSPACE_30_DAY_LIMIT_REACHED" | "WORKSPACE_DAILY_LIMIT_REACHED" | "WORKSPACE_HOURLY_LIMIT_REACHED" | "DOMAIN_DAILY_LIMIT_REACHED" | "CONTACT_DAILY_LIMIT_REACHED" };

function addHours(iso: string, hours: number): string {
  return new Date(Date.parse(iso) + hours * 60 * 60 * 1000).toISOString();
}

export async function evaluateBacklinkOutreachRateEligibility(
  dependencies: BacklinkOutreachRateEligibilityDependencies,
  input: { workspaceId: string; contactId: string; domainId: string; now: string },
): Promise<BacklinkOutreachRateEligibility> {
  const monthlyCutoff = addHours(input.now, -(24 * 30));
  const dailyCutoff = addHours(input.now, -24);
  const hourlyCutoff = addHours(input.now, -1);
  const monthlyAttempts = await dependencies.listAttemptSummariesSince(input.workspaceId, monthlyCutoff);
  const recentAttempts = monthlyAttempts.filter((attempt) => Date.parse(attempt.requested_at) >= Date.parse(dailyCutoff));
  const hourlyAttempts = recentAttempts.filter((attempt) => Date.parse(attempt.requested_at) >= Date.parse(hourlyCutoff));
  if (monthlyAttempts.length >= 100) return { allowed: false, reason: "WORKSPACE_30_DAY_LIMIT_REACHED" };
  if (recentAttempts.length >= 5) return { allowed: false, reason: "WORKSPACE_DAILY_LIMIT_REACHED" };
  if (hourlyAttempts.length >= 2) return { allowed: false, reason: "WORKSPACE_HOURLY_LIMIT_REACHED" };
  const outreachRows = await Promise.all([...new Set(recentAttempts.map((attempt) => attempt.outreach_id))].map((id) => dependencies.getOutreach(input.workspaceId, id)));
  const opportunities = await Promise.all([...new Set(outreachRows.map((row) => row.opportunity_id))].map((id) => dependencies.getOpportunity(input.workspaceId, id)));
  const domainByOpportunity = new Map(opportunities.map((row) => [row.id, row.domain_id] as const));
  let sameContact = 0;
  let sameDomain = 0;
  for (const attempt of recentAttempts) {
    const outreach = outreachRows.find((row) => row.id === attempt.outreach_id);
    if (outreach?.contact_id === input.contactId) sameContact += 1;
    if (outreach != null && domainByOpportunity.get(outreach.opportunity_id) === input.domainId) sameDomain += 1;
  }
  if (sameDomain >= 1) return { allowed: false, reason: "DOMAIN_DAILY_LIMIT_REACHED" };
  if (sameContact >= 1) return { allowed: false, reason: "CONTACT_DAILY_LIMIT_REACHED" };
  return { allowed: true };
}
