import assert from "node:assert/strict";

import { evaluateBacklinkAutonomyDownstreamDecision } from "../lib/automation/backlink-autonomy-pipeline";
import { runBacklinkAutonomyOrchestrator } from "../lib/automation/backlink-master-autonomy-orchestrator";

const control = { backlinksEnabled: true, disabledReason: null, dryRunOnly: true, backlinkAutonomyEnabled: true };
const base = {
  workspaceId: "workspace",
  runId: "run",
  domainId: "domain",
  opportunityId: "opportunity",
  scheduledAt: "2026-09-21T00:00:00.000Z",
  mode: "preview" as const,
  control,
  progress: { stage: "contact_resolution" as const, completedTaskId: "resolution", completedTaskKind: "backlinks.contact_resolution", contactIds: ["contact"] },
};
const policy = { workspaceId: "workspace", outreachId: "outreach", backlinksEnabled: true, liveAutomationEnabled: true, evidenceBackedContact: true, contactStatus: "verified", channel: "email" as const, validOpportunity: true, validCampaign: true, validDraft: true, inboundReplyStop: false, complaintOrBounceStop: false, conflictingOpenAttempt: false, rateLimitEligible: true, maxAttemptEligible: true };

async function main() {
  let writes = 0;
  const tasks = new Map<string, { id: string }>();
  const deps = { createOrGetTask: async (task: { taskKey: string }) => {
    const existing = tasks.get(task.taskKey);
    if (existing) return { kind: "existing" as const, task: existing };
    const created = { id: `task-${tasks.size + 1}` }; tasks.set(task.taskKey, created); writes += 1;
    return { kind: "created" as const, task: created };
  } };
  assert.equal((await runBacklinkAutonomyOrchestrator(deps, { ...base, control: { ...control, backlinksEnabled: false } })).outcome, "disabled");
  assert.equal((await runBacklinkAutonomyOrchestrator(deps, { ...base, control: { ...control, disabledReason: "stop" } })).outcome, "disabled");
  assert.equal((await runBacklinkAutonomyOrchestrator(deps, { ...base, control: { backlinksEnabled: true, disabledReason: null, dryRunOnly: true } })).outcome, "disabled");
  assert.equal((await runBacklinkAutonomyOrchestrator(deps, { ...base, control: { ...control, backlinkAutonomyEnabled: false } })).outcome, "disabled");
  assert.equal((await runBacklinkAutonomyOrchestrator(deps, { ...base, mode: "live", control: { ...control } })).outcome, "disabled");
  const preview = await runBacklinkAutonomyOrchestrator(deps, base);
  assert.equal(preview.outcome, "preview"); assert.equal(preview.task?.taskKind, "backlinks.contact_validation"); assert.equal(writes, 0);
  assert.deepEqual(preview, await runBacklinkAutonomyOrchestrator(deps, base));
  assert.equal((await runBacklinkAutonomyOrchestrator(deps, { ...base, progress: { ...base.progress, contactIds: [] } })).outcome, "blocked");
  assert.equal((await runBacklinkAutonomyOrchestrator(deps, { ...base, progress: { ...base.progress, contactIds: ["a", "b"] } })).outcome, "manual_review");
  assert.equal((await runBacklinkAutonomyOrchestrator(deps, { ...base, progress: { ...base.progress, completedTaskKind: "backlinks.draft_prepare" } })).outcome, "blocked");
  assert.equal((await runBacklinkAutonomyOrchestrator(deps, { ...base, mode: "apply" })).outcome, "task_created");
  assert.equal((await runBacklinkAutonomyOrchestrator(deps, { ...base, mode: "apply" })).outcome, "task_existing"); assert.equal(writes, 1);
  const validationResult = { status: "verified" as const, domainId: "domain", opportunityId: "opportunity", contactId: "contact", contactStatus: "verified", currentNormalizedEmail: "editor@example.test", suppressed: false, email: "verified" as const, contactForm: null, linkedin: null, statusTransition: "preserved" as const, manualReviewRequired: false, reasons: [] };
  const validation = { ...base, mode: "apply" as const, progress: { stage: "contact_validation" as const, completedTaskId: "validation", completedTaskKind: "backlinks.contact_validation", contactIds: ["contact"], validation: validationResult } };
  assert.equal((await runBacklinkAutonomyOrchestrator(deps, validation)).outcome, "manual_review");
  assert.equal((await runBacklinkAutonomyOrchestrator(deps, { ...validation, control: { ...control, campaignApplyAuthorized: true } })).task?.taskKind, "backlinks.campaign_prepare");
  const completedDecision = evaluateBacklinkAutonomyDownstreamDecision(policy);
  const decision = await runBacklinkAutonomyOrchestrator(deps, { ...base, progress: { stage: "outreach_decision", completedTaskId: "decision", completedTaskKind: "backlinks.outreach_decision", contactIds: ["contact"], decision: completedDecision } });
  assert.equal(decision.outcome, "execution_pending"); assert.equal(decision.readyTransitionRequired, true);
  const stoppedDecision = evaluateBacklinkAutonomyDownstreamDecision({ ...policy, inboundReplyStop: true });
  assert.equal((await runBacklinkAutonomyOrchestrator(deps, { ...base, progress: { stage: "outreach_decision", completedTaskId: "decision", completedTaskKind: "backlinks.outreach_decision", contactIds: ["contact"], decision: stoppedDecision } })).outcome, "blocked");
  assert.equal((await runBacklinkAutonomyOrchestrator(deps, { ...base, progress: { stage: "dead_letter", completedTaskId: "dead", completedTaskKind: "backlinks.contact_validation", contactIds: ["contact"] } })).outcome, "dead_letter");
  assert(!JSON.stringify(preview).includes("<html"));
  console.log("PASS — Backlink master autonomy orchestrator smoke");
}

void main();
