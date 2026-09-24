import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildNextDownstreamTask } from "../lib/automation/backlink-autonomy-pipeline";
import {
  executeBacklinkCampaignPrepareTask,
  executeBacklinkDraftPrepareTask,
  executeBacklinkOutreachDecisionTask,
} from "../lib/automation/backlink-downstream-task-handlers";
import { BacklinkOutreachDraftError } from "../lib/backlinks/services/outreachDraftService";

const scope = { workspaceId: "workspace", domainId: "domain", opportunityId: "opportunity", contactId: "contact" };
const domain = async () => ({ id: "domain", workspace_id: "workspace", archived_at: null });
const opportunity = async () => ({ id: "opportunity", workspace_id: "workspace", domain_id: "domain", archived_at: null });
let contactStatus = "verified";
const contact = async () => ({ id: "contact", workspace_id: "workspace", domain_id: "domain", contact_status: contactStatus, evidence_backed: true });

const facts = {
  backlinksEnabled: true,
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
  let membership: { campaignId: string; membershipStatus: string } | null = null;
  let campaignCalls = 0;
  const campaignDeps = {
    getDomain: domain,
    getOpportunity: opportunity,
    getContact: contact,
    findCampaignMembership: async () => membership,
    prepareCampaign: async () => { campaignCalls += 1; membership = { campaignId: "campaign", membershipStatus: "planned" }; return { campaignId: "campaign", disposition: "created" as const, membershipStatus: "planned" }; },
  };
  assert.equal((await executeBacklinkCampaignPrepareTask(campaignDeps, { ...scope, actorUserId: "actor" })).outcome, "manual_review");
  assert.equal(campaignCalls, 0);
  const campaign = await executeBacklinkCampaignPrepareTask(campaignDeps, { ...scope, actorUserId: "actor", campaignPreparationConfirmed: true });
  assert.equal(campaign.campaignId, "campaign");
  assert.equal(campaignCalls, 1);
  assert.equal((await executeBacklinkCampaignPrepareTask(campaignDeps, { ...scope, actorUserId: "actor", campaignPreparationConfirmed: true })).campaignId, "campaign");
  assert.equal(campaignCalls, 1);
  contactStatus = "do_not_contact";
  assert.equal((await executeBacklinkCampaignPrepareTask(campaignDeps, { ...scope, actorUserId: "actor" })).outcome, "blocked");
  contactStatus = "verified";

  let active: { id: string; status: string } | null = null;
  let draftCalls = 0;
  const draftDeps = {
    getDomain: domain,
    getOpportunity: opportunity,
    getContact: contact,
    getCampaign: async () => ({ id: "campaign", workspace_id: "workspace", lifecycle_status: "active" }),
    getActiveOutreach: async () => active,
    createDraft: async () => { draftCalls += 1; active = { id: "outreach", status: "draft" }; return { outreachId: "outreach", disposition: "created" as const, status: "draft" }; },
  };
  const draftInput = { ...scope, campaignId: "campaign", actorUserId: "actor", channel: "email" as const };
  assert.equal((await executeBacklinkDraftPrepareTask(draftDeps, draftInput)).outreachId, "outreach");
  assert.equal(draftCalls, 1);
  assert.equal((await executeBacklinkDraftPrepareTask(draftDeps, draftInput)).reasons[0], "EXISTING_OUTREACH");
  assert.equal(draftCalls, 1);
  active = null;
  const ineligibleDraft = await executeBacklinkDraftPrepareTask({ ...draftDeps, createDraft: async () => { throw new BacklinkOutreachDraftError("CHANNEL_NOT_ELIGIBLE"); } }, draftInput);
  assert.equal(ineligibleDraft.outcome, "blocked");
  contactStatus = "archived";
  assert.equal((await executeBacklinkDraftPrepareTask(draftDeps, draftInput)).outcome, "blocked");
  contactStatus = "verified";

  let senderCalls = 0;
  const decision = await executeBacklinkOutreachDecisionTask({ getFacts: async () => ({ ...facts }) }, { workspaceId: "workspace", outreachId: "outreach" });
  assert.equal(decision.execution, null); // liveAutomationEnabled absent defaults false.
  const email = await executeBacklinkOutreachDecisionTask({ getFacts: async () => ({ ...facts, liveAutomationEnabled: true }) }, { workspaceId: "workspace", outreachId: "outreach" });
  assert.equal(email.execution?.kind, "email_sender");
  assert.equal(senderCalls, 0);
  assert.equal((await executeBacklinkOutreachDecisionTask({ getFacts: async () => ({ ...facts, liveAutomationEnabled: true, contactStatus: "unverified" }) }, { workspaceId: "workspace", outreachId: "outreach" })).execution, null);
  assert.equal((await executeBacklinkOutreachDecisionTask({ getFacts: async () => ({ ...facts, liveAutomationEnabled: true, inboundReplyStop: true }) }, { workspaceId: "workspace", outreachId: "outreach" })).outcome, "blocked");
  const contactForm = await executeBacklinkOutreachDecisionTask({ getFacts: async () => ({ ...facts, liveAutomationEnabled: true, channel: "contact_form" as const, contactFormVerified: true }) }, { workspaceId: "workspace", outreachId: "outreach" });
  assert.equal(contactForm.execution?.kind, "contact_form_worker");
  const decisionHandler = readFileSync(new URL("../lib/automation/backlink-downstream-task-handlers.ts", import.meta.url), "utf8");
  const staticPolicy = readFileSync(new URL("../lib/backlinks/services/autonomousOutreachPolicy.ts", import.meta.url), "utf8");
  assert.doesNotMatch(decisionHandler, /contactFormCaptchaOrManualReview/);
  assert.doesNotMatch(staticPolicy, /contactFormAmbiguous/);
  assert.equal((await executeBacklinkOutreachDecisionTask({ getFacts: async () => ({ ...facts, liveAutomationEnabled: true, channel: "linkedin" as const }) }, { workspaceId: "workspace", outreachId: "outreach" })).outcome, "manual_action_required");

  const next = { workspaceId: "workspace", runId: "run", completedTaskId: "completed", domainId: "domain", opportunityId: "opportunity", contactId: "contact", scheduledAt: "2026-09-21T00:00:00.000Z" };
  assert.equal(buildNextDownstreamTask({ ...next, stage: "campaign_prepare" }).dependsOnTaskId, "completed");
  assert.equal(buildNextDownstreamTask({ ...next, stage: "draft_prepare" }).taskKind, "backlinks.draft_prepare");
  assert.equal(buildNextDownstreamTask({ ...next, stage: "outreach_decision" }).taskKind, "backlinks.outreach_decision");
  assert.deepEqual(buildNextDownstreamTask({ ...next, stage: "campaign_prepare" }), buildNextDownstreamTask({ ...next, stage: "campaign_prepare" }));
  assert(!JSON.stringify(email).includes("<html"));
  console.log("PASS — Backlink downstream task handlers smoke");
}

void main();
