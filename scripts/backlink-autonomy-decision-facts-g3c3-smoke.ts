import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { assembleBacklinkAutonomyDecisionFacts } from "../lib/automation/backlink-autonomy-decision-facts";
import { evaluateBacklinkOutreachRateEligibility } from "../lib/backlinks/services/outreachRateEligibilityService";
import { evaluateBacklinkAutonomyDownstreamDecision } from "../lib/automation/backlink-autonomy-pipeline";

const now = "2026-09-24T12:00:00.000Z";
const attempt = (i: number, requested_at = "2026-09-24T11:30:00.000Z") => ({ outreach_id: `old-${i}`, requested_at, status: "accepted" });
async function rate(attempts: ReturnType<typeof attempt>[]) { return evaluateBacklinkOutreachRateEligibility({ listAttemptSummariesSince: async () => attempts, getOutreach: async (_w, id) => ({ id, opportunity_id: "old-opportunity", contact_id: "other" }), getOpportunity: async () => ({ id: "old-opportunity", domain_id: "other-domain" }) }, { workspaceId: "w", contactId: "contact", domainId: "domain", now }); }

async function main() {
  assert.equal((await rate([])).allowed, true);
  assert.equal((await rate(Array.from({ length: 100 }, (_, i) => attempt(i, "2026-09-01T12:00:00.000Z")))).allowed, false);
  assert.equal((await rate(Array.from({ length: 5 }, (_, i) => attempt(i, "2026-09-24T11:00:00.000Z")))).allowed, false);
  assert.equal((await rate([attempt(1), attempt(2)])).allowed, false);
  const sameDomain = await evaluateBacklinkOutreachRateEligibility({ listAttemptSummariesSince: async () => [attempt(1)], getOutreach: async () => ({ id: "old-1", opportunity_id: "old-opportunity", contact_id: "other" }), getOpportunity: async () => ({ id: "old-opportunity", domain_id: "domain" }) }, { workspaceId: "w", contactId: "contact", domainId: "domain", now });
  assert.deepEqual(sameDomain, { allowed: false, reason: "DOMAIN_DAILY_LIMIT_REACHED" });
  const sameContact = await evaluateBacklinkOutreachRateEligibility({ listAttemptSummariesSince: async () => [attempt(1)], getOutreach: async () => ({ id: "old-1", opportunity_id: "old-opportunity", contact_id: "contact" }), getOpportunity: async () => ({ id: "old-opportunity", domain_id: "other" }) }, { workspaceId: "w", contactId: "contact", domainId: "domain", now });
  assert.deepEqual(sameContact, { allowed: false, reason: "CONTACT_DAILY_LIMIT_REACHED" });
  let sent = 0;
  const facts = assembleBacklinkAutonomyDecisionFacts({
    getOutreach: async () => ({ id: "outreach", workspace_id: "w", campaign_id: "campaign", opportunity_id: "opportunity", contact_id: "contact", channel: "email", status: "draft", subject: "Subject", body: "Body", current_attempt: 0, max_attempts: 2 }),
    getDomain: async () => ({ id: "domain", workspace_id: "w", hostname: "example.com", archived_at: null }),
    getOpportunity: async () => ({ id: "opportunity", workspace_id: "w", domain_id: "domain", lifecycle_status: "active", closed_at: null, archived_at: null }),
    getContact: async () => ({ id: "contact", workspace_id: "w", domain_id: "domain", contact_status: "verified", email_normalized: "person@example.com", linkedin_url: null, contact_form_url: null, source_reference: JSON.stringify([{ kind: "mailto", value: "person@example.com", sourceUrl: "https://example.com/contact", confidence: "strong" }]) }),
    getCampaign: async () => ({ id: "campaign", workspace_id: "w", status: "draft", archived_at: null }), getMembership: async () => ({ campaign_id: "campaign", opportunity_id: "opportunity", membership_status: "included" }), hasCurrentContactFormEvidence: async () => false, hasInboundReplyStop: async () => false, hasComplaintOrBounceStop: async () => false, getOpenAttempt: async () => null, getWorkspaceControl: async () => ({ backlinksEnabled: true, backlinkAutonomyEnabled: true, dryRunOnly: false, disabledReason: null }), rateEligibility: { listAttemptSummariesSince: async () => [], getOutreach: async () => ({ id: "x", opportunity_id: "x", contact_id: "x" }), getOpportunity: async () => ({ id: "x", domain_id: "x" }) }, now: () => now,
  });
  const eligible = await facts({ workspaceId: "w", outreachId: "outreach" });
  assert.equal(eligible.rateLimitEligible, true); assert.equal(eligible.maxAttemptEligible, true);
  assert.equal(evaluateBacklinkAutonomyDownstreamDecision({ ...eligible, workspaceId: "w", outreachId: "outreach" }).outcome, "execution_eligible");
  assert.equal(sent, 0);
  const [sender, composition, assembler] = await Promise.all([readFile("lib/backlinks/services/outreachEmailSendService.ts", "utf8"), readFile("lib/automation/backlink-autonomy-production-composition.ts", "utf8"), readFile("lib/automation/backlink-autonomy-decision-facts.ts", "utf8")]);
  assert(sender.includes("evaluateBacklinkOutreachRateEligibility")); assert(composition.includes("assembleBacklinkAutonomyDecisionFacts"));
  for (const forbidden of ["reserveAttempt", "sendEmail", "updateOutreach", "activateOutreach", "markAttemptAccepted", "markAttemptFailed", "markAttemptUnknown"]) assert(!assembler.includes(forbidden), `assembler must not access ${forbidden}`);
  console.log("PASS — Backlink autonomy decision facts G3C.3 smoke");
}
void main();
