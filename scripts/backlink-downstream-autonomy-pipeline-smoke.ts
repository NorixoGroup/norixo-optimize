import assert from "node:assert/strict";

import {
  buildCampaignPrepareTask,
  buildDraftPrepareTask,
  buildOutreachDecisionTask,
} from "../lib/automation/backlink-autonomy-foundation";
import {
  buildBacklinkAutonomyPipelinePlan,
  evaluateBacklinkAutonomyDownstreamDecision,
} from "../lib/automation/backlink-autonomy-pipeline";
import {
  disabledMailboxVerificationProvider,
  evaluateMailboxVerifiedTransition,
} from "../lib/backlinks/services/mailboxVerificationService";

const transition = (status: "deliverable" | "undeliverable" | "risky" | "unknown" | "provider_error", changes = {}) => evaluateMailboxVerifiedTransition({
  providerResult: { status, provider: "fake", safeReason: status },
  officialDomainEmail: true,
  explicitPublicEvidence: true,
  contactStatus: "unverified",
  inboundReplyStop: false,
  complaintOrBounceStop: false,
  ...changes,
});

const policy = {
  workspaceId: "workspace",
  outreachId: "outreach",
  backlinksEnabled: true,
  liveAutomationEnabled: true,
  evidenceBackedContact: true,
  contactStatus: "verified",
  channel: "email" as const,
  validOpportunity: true,
  validCampaign: true,
  validDraft: true,
  inboundReplyStop: false,
  complaintOrBounceStop: false,
  conflictingOpenAttempt: false,
  rateLimitEligible: true,
  maxAttemptEligible: true,
};

async function main() {
  assert.equal((await disabledMailboxVerificationProvider.verify({ email: "editor@example.com", domain: "example.com" })).status, "unknown");
  assert.equal(transition("deliverable").verificationTransitionEligible, true);
  assert.equal(transition("deliverable", { explicitPublicEvidence: false }).verificationTransitionEligible, false);
  assert.equal(transition("deliverable", { officialDomainEmail: false }).verificationTransitionEligible, false);
  assert.equal(transition("risky").verificationTransitionEligible, false);
  assert.equal(transition("unknown").verificationTransitionEligible, false);
  assert.equal(transition("provider_error").outcome, "retryable");
  assert.equal(transition("undeliverable").verificationTransitionEligible, false);
  assert.equal(transition("deliverable", { contactStatus: "do_not_contact" }).verificationTransitionEligible, false);
  assert.equal(transition("deliverable", { contactStatus: "archived" }).verificationTransitionEligible, false);
  assert.equal(transition("deliverable", { inboundReplyStop: true }).verificationTransitionEligible, false);
  assert.equal(transition("deliverable", { complaintOrBounceStop: true }).verificationTransitionEligible, false);

  const planInput = { workspaceId: "workspace", runId: "run", resolutionTaskKey: "contact-resolution:opportunity:domain", domainId: "domain", opportunityId: "opportunity", contactId: "contact" };
  const plan = buildBacklinkAutonomyPipelinePlan(planInput);
  assert.deepEqual(plan, buildBacklinkAutonomyPipelinePlan(planInput));
  assert.deepEqual(plan.tasks.map((task) => task.taskKind), ["backlinks.contact_validation", "backlinks.campaign_prepare", "backlinks.draft_prepare", "backlinks.outreach_decision"]);
  assert.equal(plan.tasks[1]?.dependsOnTaskKey, plan.tasks[0]?.taskKey);
  assert.equal(plan.tasks[2]?.dependsOnTaskKey, plan.tasks[1]?.taskKey);
  assert.equal(plan.tasks[3]?.dependsOnTaskKey, plan.tasks[2]?.taskKey);
  assert.equal(new Set(plan.tasks.map((task) => task.taskKey)).size, 4);
  assert(!JSON.stringify(plan).includes("@example.com"));

  const taskInput = { workspaceId: "workspace", runId: "run", dependsOnTaskId: "dependency", domainId: "domain", opportunityId: "opportunity", contactId: "contact", scheduledAt: "2026-09-21T00:00:00.000Z" };
  assert.equal(buildCampaignPrepareTask(taskInput).taskKind, "backlinks.campaign_prepare");
  assert.equal(buildDraftPrepareTask(taskInput).taskKind, "backlinks.draft_prepare");
  assert.equal(buildOutreachDecisionTask(taskInput).taskKind, "backlinks.outreach_decision");

  assert.deepEqual(evaluateBacklinkAutonomyDownstreamDecision(policy).execution, { kind: "email_sender", workspaceId: "workspace", outreachId: "outreach" });
  assert.equal(evaluateBacklinkAutonomyDownstreamDecision({ ...policy, contactStatus: "unverified" }).outcome, "manual_review");
  assert.deepEqual(evaluateBacklinkAutonomyDownstreamDecision({ ...policy, channel: "contact_form", contactFormVerified: true }).execution, { kind: "contact_form_worker", workspaceId: "workspace", outreachId: "outreach" });
  assert.equal(evaluateBacklinkAutonomyDownstreamDecision({ ...policy, channel: "contact_form", contactFormVerified: true, contactFormAmbiguous: true }).outcome, "manual_review");
  assert.deepEqual(evaluateBacklinkAutonomyDownstreamDecision({ ...policy, channel: "linkedin" }).execution, { kind: "linkedin_manual_action", workspaceId: "workspace", outreachId: "outreach" });
  for (const change of [
    { contactStatus: "do_not_contact" },
    { inboundReplyStop: true },
    { complaintOrBounceStop: true },
    { rateLimitEligible: false },
    { maxAttemptEligible: false },
    { validCampaign: false },
    { validDraft: false },
  ]) {
    const result = evaluateBacklinkAutonomyDownstreamDecision({ ...policy, ...change });
    assert.equal(result.execution, null);
    assert.equal(result.outcome, "blocked");
  }
  console.log("PASS — Backlink downstream autonomy pipeline smoke");
}

void main();
