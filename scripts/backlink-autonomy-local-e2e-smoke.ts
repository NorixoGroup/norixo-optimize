import assert from "node:assert/strict";
import { enterPromotedOpportunityContactResolution } from "@/lib/automation/backlink-promotion-resolution-entry";
import { runBacklinkAutonomyCycle } from "@/lib/automation/backlink-autonomy-local-cycle";
import { runBacklinkAutonomyOrchestrator } from "@/lib/automation/backlink-master-autonomy-orchestrator";
import { buildBacklinkAutonomyPipelinePlan } from "@/lib/automation/backlink-autonomy-pipeline";
import type { AutomationTask, AutomationTaskDependencies, CreateAutomationTaskInput } from "@/lib/automation/types";
import type { ContactResolutionResult } from "@/lib/backlinks/services/contactResolutionService";

const ids = { workspace: "00000000-0000-4000-8000-000000000001", run: "00000000-0000-4000-8000-000000000002", autonomyRun: "00000000-0000-4000-8000-000000000009", promotion: "00000000-0000-4000-8000-000000000003", domain: "00000000-0000-4000-8000-000000000004", opportunity: "00000000-0000-4000-8000-000000000005", actor: "00000000-0000-4000-8000-000000000006" };
const now = "2026-09-21T00:00:00.000Z";
const control = { backlinksEnabled: true, disabledReason: null, backlinkAutonomyEnabled: true, campaignApplyAuthorized: true, dryRunOnly: false };
type Contact = { id: string; workspace_id: string; domain_id: string; contact_status: string; email_normalized: string | null; linkedin_url: string | null; contact_form_url: string | null; source_reference: string | null };

function task(input: CreateAutomationTaskInput, id: string): AutomationTask {
  return { id, workspaceId: input.workspaceId, runId: input.runId, dependsOnTaskId: input.dependsOnTaskId ?? null, system: input.system, taskKind: input.taskKind, taskKey: input.taskKey, status: "queued", priority: input.priority, scheduledAt: input.scheduledAt, availableAt: input.availableAt, claimedAt: null, startedAt: null, heartbeatAt: null, leaseExpiresAt: null, completedAt: null, failedAt: null, cancelledAt: null, workerId: null, attemptCount: 0, maxAttempts: input.maxAttempts, backoffBaseSeconds: input.backoffBaseSeconds, input: input.input, output: null, errorCode: null, errorMessage: null, createdAt: now, updatedAt: now };
}

function fixture(options: { channel?: "email" | "contact_form" | "linkedin"; contacts?: Contact[]; resolution: ContactResolutionResult; decisionStop?: string; throwResolution?: boolean; throwCampaign?: boolean; throwDraft?: boolean; invalidWorkspace?: boolean } ) {
  const queue: AutomationTask[] = []; const byKey = new Map<string, AutomationTask>();
  const contacts = [...(options.contacts ?? [])];
  const counters = { tasks: 0, contactCreates: 0, campaignCreates: 0, draftCreates: 0, claims: 0, completes: 0, failures: 0, sends: 0, forms: 0, linkedin: 0 };
  const deps: AutomationTaskDependencies = {
    async createOrGetTask(input) { const found = byKey.get(input.taskKey); if (found) return { kind: "existing", task: found }; const value = task(input, `00000000-0000-4000-8000-${String(byKey.size + 10).padStart(12, "0")}`); byKey.set(input.taskKey, value); queue.push(value); counters.tasks++; return { kind: "created", task: value }; },
    async claimNextTask(input) { const value = queue.find((item) => item.status === "queued") ?? null; if (!value) return null; value.status = "running"; value.workerId = input.workerId; value.attemptCount++; counters.claims++; return value; },
    async heartbeatTask() { return null; },
    async completeTask(input) { const value = [...byKey.values()].find((item) => item.id === input.taskId) ?? null; if (!value || value.status !== "running") return null; value.status = "completed"; value.output = input.output; value.completedAt = input.completedAt; counters.completes++; return value; },
    async failTask(input) { const value = [...byKey.values()].find((item) => item.id === input.taskId)!; counters.failures++; value.status = value.attemptCount >= value.maxAttempts ? "dead_letter" : "failed"; return value; },
    async reclaimExpiredTasks() { return []; }, async cancelTask() { return null; },
  };
  const domain = { id: ids.domain, workspace_id: ids.workspace, hostname: "example.test", archived_at: null };
  const opportunity = { id: ids.opportunity, workspace_id: ids.workspace, domain_id: ids.domain, archived_at: null };
  const handlers = {
    resolution: {
      getDomain: async () => options.invalidWorkspace ? { ...domain, workspace_id: "other" } : domain, getOpportunity: async () => opportunity,
      listContactsByDomain: async () => contacts,
      allocateContactKey: async () => `contact-${contacts.length + 1}`,
      createContact: async (_workspace: string, _actor: string, input: any) => { const id = `contact-${contacts.length + 1}`; contacts.push({ id, workspace_id: ids.workspace, domain_id: ids.domain, contact_status: input.contact_status, email_normalized: input.email_normalized, linkedin_url: input.linkedin_url, contact_form_url: input.contact_form_url, source_reference: input.source_reference }); counters.contactCreates++; return { id }; },
      resolve: async () => { if (options.throwResolution) throw new Error("transient resolution"); return options.resolution; },
    },
    validation: {
      getDomain: async () => domain, getOpportunity: async () => opportunity,
      getContact: async (_workspace: string, id: string) => contacts.find((item) => item.id === id)!,
      hasMxRecords: async () => true,
    },
    mailbox: {
      getProvider: () => null,
      getContact: async (_workspace: string, id: string) => {
        const contact = contacts.find((item) => item.id === id);
        return contact == null ? null : { ...contact, do_not_contact_at: null, archived_at: null };
      },
      record: async () => { throw new Error("must not persist mailbox verification in legacy verified fixture"); },
    },
    campaign: {
      getDomain: async () => domain, getOpportunity: async () => opportunity, getContact: async (_workspace: string, id: string) => contacts.find((item) => item.id === id)!,
      findCampaignMembership: async () => counters.campaignCreates ? { campaignId: "campaign", membershipStatus: "active" } : null,
      prepareCampaign: async () => { if (options.throwCampaign) throw new Error("transient campaign"); counters.campaignCreates++; return { campaignId: "campaign", disposition: "created" as const, membershipStatus: "active" }; },
    },
    draft: {
      getDomain: async () => domain, getOpportunity: async () => opportunity, getContact: async (_workspace: string, id: string) => contacts.find((item) => item.id === id)!,
      getCampaign: async () => ({ id: "campaign", workspace_id: ids.workspace, lifecycle_status: "active" }),
      getActiveOutreach: async () => counters.draftCreates ? { id: "outreach", status: "draft" } : null,
      createDraft: async () => { if (options.throwDraft) throw new Error("transient draft"); counters.draftCreates++; return { outreachId: "outreach", disposition: "created" as const, status: "draft" }; },
    },
    decision: { getFacts: async () => ({ backlinksEnabled: true, liveAutomationEnabled: true, evidenceBackedContact: true, contactStatus: contacts[0]?.contact_status ?? "unverified", channel: options.channel ?? "email", validOpportunity: true, validCampaign: true, validDraft: true, inboundReplyStop: options.decisionStop === "reply", complaintOrBounceStop: options.decisionStop === "bounce", conflictingOpenAttempt: false, rateLimitEligible: options.decisionStop !== "rate", maxAttemptEligible: options.decisionStop !== "max", contactFormVerified: options.channel === "contact_form" }) },
  };
  return { deps, handlers, contacts, counters, queue, byKey };
}
function resolved(candidates: ContactResolutionResult["candidates"]): ContactResolutionResult { return { status: "resolved", inspectedUrls: ["https://example.test"], candidates, reasons: [] }; }
const emailCandidate = { email: "editor@example.test", linkedinUrl: null, contactFormUrl: null, evidence: [{ kind: "visible_email" as const, value: "editor@example.test", sourceUrl: "https://example.test/contact", confidence: "strong" as const }] };
function verified(id = "contact-1", email = "editor@example.test"): Contact { return { id, workspace_id: ids.workspace, domain_id: ids.domain, contact_status: "verified", email_normalized: email, linkedin_url: null, contact_form_url: null, source_reference: JSON.stringify([{ kind: "visible_email", value: email, sourceUrl: "https://example.test/contact", confidence: "strong" }]) }; }
async function enter(f: ReturnType<typeof fixture>, mode: "preview" | "apply" | "live" = "apply") { return enterPromotedOpportunityContactResolution({ getDomain: async () => ({ id: ids.domain, workspaceId: ids.workspace }), getOpportunity: async () => ({ id: ids.opportunity, workspaceId: ids.workspace, domainId: ids.domain }), createOrGetTask: f.deps.createOrGetTask }, { promotion: { applicationId: "application", workspaceId: ids.workspace, runId: ids.run, promotionTaskId: ids.promotion, promotionTaskKind: "backlinks.promotion.preview", promotionTaskStatus: "completed", domainId: ids.domain, opportunityId: ids.opportunity, actorUserId: ids.actor, applied: true }, autonomyRunId: ids.autonomyRun, control, mode, scheduledAt: now }); }
async function cycle(f: ReturnType<typeof fixture>, channel: "email" | "contact_form" | "linkedin" = "email") { return runBacklinkAutonomyCycle({ taskDependencies: f.deps, handlers: f.handlers, workspaceId: ids.workspace, runId: ids.autonomyRun, workerId: "local-smoke", actorUserId: ids.actor, domainId: ids.domain, opportunityId: ids.opportunity, scheduledAt: now, mode: "apply", control, channel }); }

async function main() {
  // A: discovery persists unverified evidence and cannot reach an email executor.
  const discovered = fixture({ resolution: resolved([emailCandidate]) }); assert.equal((await enter(discovered)).outcome, "task_created"); const a = await cycle(discovered); assert.equal(a.outcome, "blocked"); assert.equal(discovered.contacts[0]?.contact_status, "unverified"); assert.equal(discovered.counters.sends, 0);
  // B + H: pre-verified contact traverses all handlers once and replay creates nothing twice.
  const safe = fixture({ contacts: [verified()], resolution: resolved([emailCandidate]) }); await enter(safe); const b = await cycle(safe); assert.equal(b.outcome, "execution_pending"); assert.deepEqual(b.reasonCodes, ["EMAIL_EXECUTION_PENDING"]); assert.equal(b.readyTransitionRequired, true); const before = { ...safe.counters }; await enter(safe); const replay = await cycle(safe); assert.equal(replay.outcome, "empty"); assert.deepEqual(safe.counters, before); assert.equal(safe.counters.sends, 0);
  // C/D: terminal descriptors are never dispatched as send/form/LinkedIn actions.
  const form = fixture({ channel: "contact_form", contacts: [verified()], resolution: resolved([emailCandidate]) }); await enter(form); const c = await cycle(form, "contact_form"); assert.deepEqual(c.reasonCodes, ["CONTACT_FORM_APPROVAL_REQUIRED"]); assert.equal(form.counters.forms, 0);
  const linkedin = fixture({ channel: "linkedin", contacts: [verified()], resolution: resolved([emailCandidate]) }); await enter(linkedin); const d = await cycle(linkedin, "linkedin"); assert.equal(d.outcome, "manual_review"); assert.equal(linkedin.counters.linkedin, 0);
  // E/F/G and all policy stops remain terminal before campaign/draft work.
  const multi = fixture({ contacts: [verified("contact-1"), verified("contact-2", "second@example.test")], resolution: resolved([emailCandidate, { ...emailCandidate, email: "second@example.test", evidence: [{ ...emailCandidate.evidence[0]!, value: "second@example.test" }] }]) }); await enter(multi); const e = await cycle(multi); assert.equal(e.outcome, "manual_review"); assert.deepEqual(e.reasonCodes, ["CONTACT_SELECTION_REQUIRED"]); assert.equal(multi.counters.campaignCreates + multi.counters.draftCreates, 0);
  const dnc = fixture({ contacts: [{ ...verified(), contact_status: "do_not_contact" }], resolution: resolved([emailCandidate]) }); await enter(dnc); assert.equal((await cycle(dnc)).outcome, "blocked");
  const archived = fixture({ contacts: [{ ...verified(), contact_status: "archived" }], resolution: resolved([emailCandidate]) }); await enter(archived); assert.equal((await cycle(archived)).outcome, "blocked");
  const reply = fixture({ contacts: [verified()], resolution: resolved([emailCandidate]), decisionStop: "reply" }); await enter(reply); const g = await cycle(reply); assert.equal(g.outcome, "blocked"); assert.deepEqual(g.reasonCodes, ["INBOUND_REPLY_STOP"]);
  for (const [stop, reason] of [["bounce", "PROVIDER_STOP"], ["rate", "RATE_LIMIT"], ["max", "MAX_ATTEMPTS"]] as const) { const stopped = fixture({ contacts: [verified()], resolution: resolved([emailCandidate]), decisionStop: stop }); await enter(stopped); const result = await cycle(stopped); assert.equal(result.outcome, "blocked"); assert.deepEqual(result.reasonCodes, [reason]); }
  const invalid = fixture({ resolution: resolved([emailCandidate]), invalidWorkspace: true }); await enter(invalid); const invalidResult = await cycle(invalid); assert.equal(invalidResult.outcome, "manual_review"); assert.deepEqual(invalidResult.reasonCodes, ["WORKSPACE_OR_DOMAIN_OPPORTUNITY_MISMATCH"]);
  const dead = await runBacklinkAutonomyOrchestrator({}, { workspaceId: ids.workspace, runId: ids.run, domainId: ids.domain, opportunityId: ids.opportunity, scheduledAt: now, mode: "apply", control, progress: { stage: "dead_letter", completedTaskId: ids.promotion, completedTaskKind: "backlinks.contact_resolution", contactIds: [] } }); assert.equal(dead.outcome, "dead_letter");
  // I/J: preview and disabled never write a task or invoke a handler.
  const preview = fixture({ contacts: [verified()], resolution: resolved([emailCandidate]) }); const previewEntry = await enter(preview, "preview"); assert.equal(previewEntry.outcome, "preview"); assert.equal(preview.counters.tasks, 0); const plan = buildBacklinkAutonomyPipelinePlan({ workspaceId: ids.workspace, runId: ids.run, resolutionTaskKey: previewEntry.task!.taskKey, domainId: ids.domain, opportunityId: ids.opportunity, contactId: "contact-1" }); assert.deepEqual([previewEntry.task!.taskKind, ...plan.tasks.map((item) => item.taskKind)], ["backlinks.contact_resolution", "backlinks.contact_validation", "backlinks.campaign_prepare", "backlinks.draft_prepare", "backlinks.outreach_decision"]);
  const disabled = fixture({ contacts: [verified()], resolution: resolved([emailCandidate]) }); const disabledResult = await enterPromotedOpportunityContactResolution({ getDomain: async () => ({ id: ids.domain, workspaceId: ids.workspace }), getOpportunity: async () => ({ id: ids.opportunity, workspaceId: ids.workspace, domainId: ids.domain }), createOrGetTask: disabled.deps.createOrGetTask }, { promotion: { applicationId: "application", workspaceId: ids.workspace, runId: ids.run, promotionTaskId: ids.promotion, promotionTaskKind: "backlinks.promotion.preview", promotionTaskStatus: "completed", domainId: ids.domain, opportunityId: ids.opportunity, actorUserId: ids.actor, applied: true }, autonomyRunId: ids.run, control: { ...control, backlinkAutonomyEnabled: false }, mode: "apply", scheduledAt: now }); assert.equal(disabledResult.outcome, "disabled"); assert.equal(disabled.counters.tasks + disabled.counters.claims, 0);
  // Transient adapters use the existing failure lifecycle; no retry loop is created here.
  const transientResolution = fixture({ resolution: resolved([emailCandidate]), throwResolution: true }); await enter(transientResolution); assert.equal((await cycle(transientResolution)).outcome, "rejected"); assert.equal(transientResolution.counters.failures, 1);
  const transientCampaign = fixture({ contacts: [verified()], resolution: resolved([emailCandidate]), throwCampaign: true }); await enter(transientCampaign); assert.equal((await cycle(transientCampaign)).outcome, "rejected");
  const transientDraft = fixture({ contacts: [verified()], resolution: resolved([emailCandidate]), throwDraft: true }); await enter(transientDraft); assert.equal((await cycle(transientDraft)).outcome, "rejected");
  const noCampaignAuthorization = fixture({ contacts: [verified()], resolution: resolved([emailCandidate]) }); await enter(noCampaignAuthorization); const noCampaign = await runBacklinkAutonomyCycle({ taskDependencies: noCampaignAuthorization.deps, handlers: noCampaignAuthorization.handlers, workspaceId: ids.workspace, runId: ids.autonomyRun, workerId: "local-smoke", actorUserId: ids.actor, domainId: ids.domain, opportunityId: ids.opportunity, scheduledAt: now, mode: "apply", control: { ...control, campaignApplyAuthorized: false }, channel: "email" }); assert.equal(noCampaign.outcome, "manual_review"); assert.deepEqual(noCampaign.reasonCodes, ["CAMPAIGN_APPLY_AUTHORIZATION_REQUIRED"]); assert.equal(noCampaignAuthorization.counters.campaignCreates, 0);
  console.log("PASS — Backlink autonomy local E2E smoke");
}
void main();
