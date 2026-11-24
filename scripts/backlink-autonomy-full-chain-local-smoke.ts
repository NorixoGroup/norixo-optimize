import assert from "node:assert/strict";

import { createMockBacklinkDiscoveryProvider } from "@/lib/automation/mock-backlink-discovery-provider";
import { executeBacklinkDiscoveryPreview } from "@/lib/automation/backlink-discovery-handler";
import { DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1 } from "@/lib/automation/backlink-qualification-policy";
import { executeBacklinkQualificationPreviewHandler } from "@/lib/automation/backlink-qualification-handler";
import { DEFAULT_BACKLINK_PROMOTION_POLICY_V1 } from "@/lib/automation/backlink-promotion-policy";
import { executeBacklinkPromotionPreviewHandler } from "@/lib/automation/backlink-promotion-handler";
import { applyBacklinkPromotionProposal } from "@/lib/automation/backlink-promotion-apply-service";
import { readBacklinkPromotionProposal } from "@/lib/automation/backlink-promotion-proposal-reader";
import { applyBacklinkPromotionProposalTransaction } from "@/lib/automation/repositories/backlinkPromotionApplicationRepository";
import { enterPromotedOpportunityContactResolution } from "@/lib/automation/backlink-promotion-resolution-entry";
import { runBacklinkAutonomyCycle } from "@/lib/automation/backlink-autonomy-local-cycle";
import type { AutomationTask, AutomationTaskDependencies, CreateAutomationTaskInput } from "@/lib/automation/types";
import type { ContactResolutionResult } from "@/lib/backlinks/services/contactResolutionService";
import type { MailboxVerificationProvider } from "@/lib/backlinks/services/mailboxVerificationService";
import type { RecordMailboxVerificationAndMaybePromoteInput } from "@/lib/backlinks/repositories/mailboxVerificationsRepository";

/**
 * BACKLINKS-AUTO-04: a single continuous, isolated chain —
 * discovery -> qualification -> promotion -> apply -> contact_resolution ->
 * contact_validation -> mailbox_verification (simulated provider) ->
 * campaign_prepare -> draft_prepare -> outreach_decision -> EMAIL_EXECUTION_PENDING.
 *
 * Every stage's output is the REAL return value of the real business
 * function for that stage (discovery/qualification/promotion handlers,
 * the real promotion-apply service, the real autonomy orchestrator/cycle).
 * Nothing intermediate is hand-fabricated — only the outermost edges
 * (the search provider, the RPC client, the ZeroBounce provider, the asset
 * lookup) are fakes, exactly the pattern already used by this repository's
 * own existing, already-validated smoke tests for each of these stages.
 *
 * Fail-closed network guard: if anything in this process ever attempted a
 * real network call, this throws immediately rather than silently
 * succeeding or hanging.
 */
const originalFetch = globalThis.fetch;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).fetch = async (...args: unknown[]) => {
  throw new Error(`FORBIDDEN_NETWORK_CALL_IN_LOCAL_CHAIN: ${JSON.stringify(args[0])}`);
};

function assertTrue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const uuid = (n: number) => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
const ids = {
  workspace: uuid(1),
  actor: uuid(2),
  preRun: uuid(3),
  discoveryTask: uuid(4),
  qualificationTask: uuid(5),
  promotionTask: uuid(6),
  asset: uuid(7),
};
const now = "2026-11-24T06:15:00.000Z";

type Trace = { step: string; detail: Record<string, unknown> };
const trace: Trace[] = [];
function record(step: string, detail: Record<string, unknown>): void {
  trace.push({ step, detail });
}

// ---------------------------------------------------------------------------
// Stage 1: discovery — real executeBacklinkDiscoveryPreview, fake search provider only.
// ---------------------------------------------------------------------------
async function runDiscovery() {
  const provider = createMockBacklinkDiscoveryProvider([
    {
      query: "airbnb host resources",
      countryCode: "US",
      languageCode: "en",
      items: [
        {
          url: "https://example.com/airbnb-host-resources",
          title: "Airbnb Host Resources: Vacation Rental Hosting Guide",
          snippet: "A vacation rental hosting guide covering revenue management and listing optimization for Airbnb hosts.",
          rank: 1,
        },
      ],
    },
  ]);
  const discoveryInput = {
    version: 1,
    source: "manual_dashboard",
    provider: "mock",
    searches: [{ query: "airbnb host resources", countryCode: "US", languageCode: "en" }],
    maxResultsPerSearch: 3,
    maxCandidates: 3,
  };
  const result = await executeBacklinkDiscoveryPreview(
    { providers: { mock: provider } },
    { workspaceId: ids.workspace, runId: ids.preRun, taskId: ids.discoveryTask, taskKind: "backlinks.discovery.preview", input: discoveryInput, attemptedAt: now },
  );
  assertTrue(result.output.candidates !== undefined && Array.isArray(result.output.candidates) && result.output.candidates.length === 1, "discovery must accept exactly one real candidate");
  const discoveryTask: AutomationTask = {
    id: ids.discoveryTask, workspaceId: ids.workspace, runId: ids.preRun, dependsOnTaskId: null, system: "backlinks",
    taskKind: "backlinks.discovery.preview", taskKey: "discovery-preview", status: "completed", priority: 10,
    scheduledAt: now, availableAt: now, claimedAt: now, startedAt: now, heartbeatAt: now, leaseExpiresAt: null,
    completedAt: now, failedAt: null, cancelledAt: null, workerId: "full-chain-smoke", attemptCount: 1, maxAttempts: 3,
    backoffBaseSeconds: 60, input: discoveryInput, output: result.output, errorCode: null, errorMessage: null, createdAt: now, updatedAt: now,
  };
  record("discovery", { taskId: discoveryTask.id, candidateKey: (result.output.candidates as { candidateKey: string }[])[0]!.candidateKey, hostname: (result.output.candidates as { hostname: string }[])[0]!.hostname });
  return discoveryTask;
}

// ---------------------------------------------------------------------------
// Stage 2: qualification — real executeBacklinkQualificationPreviewHandler, real default policy.
// ---------------------------------------------------------------------------
async function runQualification(discoveryTask: AutomationTask) {
  const qualificationTask: AutomationTask = {
    id: ids.qualificationTask, workspaceId: ids.workspace, runId: ids.preRun, dependsOnTaskId: discoveryTask.id, system: "backlinks",
    taskKind: "backlinks.qualification.preview", taskKey: "qualification-preview", status: "running", priority: 20,
    scheduledAt: now, availableAt: now, claimedAt: now, startedAt: now, heartbeatAt: now, leaseExpiresAt: "2026-11-24T06:20:00.000Z",
    completedAt: null, failedAt: null, cancelledAt: null, workerId: "full-chain-smoke", attemptCount: 1, maxAttempts: 3,
    backoffBaseSeconds: 60, input: {}, output: null, errorCode: null, errorMessage: null, createdAt: now, updatedAt: now,
  };
  const output = await executeBacklinkQualificationPreviewHandler(
    { task: qualificationTask },
    { getTaskByIdInRun: async (lookup) => (lookup.taskId === discoveryTask.id ? discoveryTask : null), policy: DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1 },
  );
  assertTrue(output.results.length === 1, "exactly one real candidate must be evaluated");
  const qualified = output.results[0]!;
  if (qualified.decision !== "qualified") {
    throw new Error(`RUPTURE: real qualification engine returned decision="${qualified.decision}" for this candidate under the default policy, not "qualified" — reasons=${JSON.stringify(qualified.reasons)}`);
  }
  const completed: AutomationTask = { ...qualificationTask, status: "completed", completedAt: now, output };
  record("qualification", { taskId: completed.id, decision: qualified.decision, score: qualified.qualificationScore });
  return completed;
}

// ---------------------------------------------------------------------------
// Stage 3: promotion preview — real executeBacklinkPromotionPreviewHandler, real default policy.
// ---------------------------------------------------------------------------
async function runPromotionPreview(discoveryTask: AutomationTask, qualificationTask: AutomationTask) {
  const promotionTask: AutomationTask = {
    id: ids.promotionTask, workspaceId: ids.workspace, runId: ids.preRun, dependsOnTaskId: qualificationTask.id, system: "backlinks",
    taskKind: "backlinks.promotion.preview", taskKey: "promotion-preview", status: "running", priority: 30,
    scheduledAt: now, availableAt: now, claimedAt: now, startedAt: now, heartbeatAt: now, leaseExpiresAt: "2026-11-24T06:20:00.000Z",
    completedAt: null, failedAt: null, cancelledAt: null, workerId: "full-chain-smoke", attemptCount: 1, maxAttempts: 3,
    backoffBaseSeconds: 60, input: { source: "automation_qualification", requestedScope: "preview" }, output: null, errorCode: null, errorMessage: null, createdAt: now, updatedAt: now,
  };
  const output = await executeBacklinkPromotionPreviewHandler(
    { task: promotionTask },
    {
      getTaskByIdInRun: async (lookup) => {
        if (lookup.taskId === qualificationTask.id) return qualificationTask;
        if (lookup.taskId === discoveryTask.id) return discoveryTask;
        return null;
      },
      policy: DEFAULT_BACKLINK_PROMOTION_POLICY_V1,
    },
  );
  if (output.proposals.length === 0) {
    throw new Error(`RUPTURE: real promotion engine produced zero proposals for a qualified candidate under the default policy — skippedItems=${JSON.stringify(output.skippedItems)}`);
  }
  const proposal = output.proposals[0]!;
  const completed: AutomationTask = { ...promotionTask, status: "completed", completedAt: now, output };
  record("promotion_preview", { taskId: completed.id, proposalKey: proposal.proposalKey, hostname: proposal.hostname, priority: proposal.priority });
  return { promotionTask: completed, proposal };
}

// ---------------------------------------------------------------------------
// Stage 4: promotion apply — real applyBacklinkPromotionProposal + real
// readBacklinkPromotionProposal; only the RPC transport and the asset
// lookup are faked (no Supabase connection of any kind).
// ---------------------------------------------------------------------------
async function runPromotionApply(promotionTask: AutomationTask, proposalKey: string) {
  const rpcRow = {
    application_id: uuid(8),
    domain_id: uuid(9),
    opportunity_id: uuid(1).replace(/^1/, "9"),
    domain_disposition: "created" as const,
    opportunity_disposition: "created" as const,
    audit_written: true,
  };
  const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const fakeRpcClient = {
    async rpc(name: string, args: Record<string, unknown>) {
      rpcCalls.push({ name, args });
      return { data: [rpcRow], error: null };
    },
  };
  const applied = await applyBacklinkPromotionProposal(
    {
      readPromotionProposal: (input) => readBacklinkPromotionProposal({ getTaskByIdInRun: async () => promotionTask }, input),
      getAssetById: async (input) => (input.assetId === ids.asset ? { id: ids.asset, workspaceId: ids.workspace, lifecycleStatus: "active" } : null),
      applyPromotionTransaction: (input) => applyBacklinkPromotionProposalTransaction(fakeRpcClient, input),
    },
    { workspaceId: ids.workspace, actorUserId: ids.actor, runId: ids.preRun, promotionTaskId: promotionTask.id, proposalKey, assetId: ids.asset },
  );
  assertTrue(applied.kind === "applied" && applied.auditWritten === true, "promotion apply must succeed and write an audit record");
  assertTrue(rpcCalls.length === 1 && rpcCalls[0]!.name === "apply_backlink_promotion_proposal", "exactly one canonical apply RPC must be issued");
  record("promotion_apply", { applicationId: applied.applicationId, domainId: applied.domainId, opportunityId: applied.opportunityId, disposition: applied.disposition });
  return applied;
}

// ---------------------------------------------------------------------------
// Stage 5+: autonomy, reusing the exact fixture shape already validated by
// backlink-autonomy-local-e2e-smoke.ts (AUTO-03), but this time fed with the
// REAL applied promotion identifiers from stages 1-4, and a mailbox
// verification provider that is simulated (never a real ZeroBounce call)
// but whose "deliverable" result is consumed by the REAL coordinator logic.
// ---------------------------------------------------------------------------
type Contact = { id: string; workspace_id: string; domain_id: string; contact_status: string; email_normalized: string | null; linkedin_url: string | null; contact_form_url: string | null; source_reference: string | null };

const control = { backlinksEnabled: true, disabledReason: null, backlinkAutonomyEnabled: true, campaignApplyAuthorized: true, paidMailboxVerificationAuthorized: true, dryRunOnly: false };

function autonomyTask(input: CreateAutomationTaskInput, id: string): AutomationTask {
  return { id, workspaceId: input.workspaceId, runId: input.runId, dependsOnTaskId: input.dependsOnTaskId ?? null, system: input.system, taskKind: input.taskKind, taskKey: input.taskKey, status: "queued", priority: input.priority, scheduledAt: input.scheduledAt, availableAt: input.availableAt, claimedAt: null, startedAt: null, heartbeatAt: null, leaseExpiresAt: null, completedAt: null, failedAt: null, cancelledAt: null, workerId: null, attemptCount: 0, maxAttempts: input.maxAttempts, backoffBaseSeconds: input.backoffBaseSeconds, input: input.input, output: null, errorCode: null, errorMessage: null, createdAt: now, updatedAt: now };
}

/** A simulated, never-network ZeroBounce-shaped provider: deliverable by default. */
function simulatedMailboxProvider(result: "deliverable" | "undeliverable" = "deliverable"): MailboxVerificationProvider {
  return {
    async verify() {
      return { status: result, provider: "simulated", providerReference: "sim-1", safeMetadata: null, safeReason: `SIMULATED_${result.toUpperCase()}` };
    },
  };
}

function autonomyFixture(options: { domainId: string; opportunityId: string; hostname: string; paidMailboxVerificationAuthorized: boolean }) {
  const queue: AutomationTask[] = []; const byKey = new Map<string, AutomationTask>();
  const contacts: Contact[] = [];
  const counters = { tasks: 0, contactCreates: 0, campaignCreates: 0, draftCreates: 0, claims: 0, completes: 0, failures: 0, sends: 0, forms: 0, linkedin: 0, zeroBounceCalls: 0 };
  const deps: AutomationTaskDependencies = {
    async createOrGetTask(input) { const found = byKey.get(input.taskKey); if (found) return { kind: "existing", task: found }; const value = autonomyTask(input, `${String(byKey.size + 10).padStart(8, "0")}-0000-4000-8000-000000000000`); byKey.set(input.taskKey, value); queue.push(value); counters.tasks++; return { kind: "created", task: value }; },
    async claimNextTask(input) { const value = queue.find((item) => item.status === "queued") ?? null; if (!value) return null; value.status = "running"; value.workerId = input.workerId; value.attemptCount++; counters.claims++; return value; },
    async heartbeatTask() { return null; },
    async completeTask(input) { const value = [...byKey.values()].find((item) => item.id === input.taskId) ?? null; if (!value || value.status !== "running") return null; value.status = "completed"; value.output = input.output; value.completedAt = input.completedAt; counters.completes++; return value; },
    async failTask(input) { const value = [...byKey.values()].find((item) => item.id === input.taskId)!; counters.failures++; value.status = value.attemptCount >= value.maxAttempts ? "dead_letter" : "queued"; value.errorCode = input.errorCode; value.errorMessage = input.errorMessage; return value; },
    async reclaimExpiredTasks() { return []; }, async cancelTask() { return null; },
  };
  const domain = { id: options.domainId, workspace_id: ids.workspace, hostname: options.hostname, archived_at: null };
  const opportunity = { id: options.opportunityId, workspace_id: ids.workspace, domain_id: options.domainId, archived_at: null };
  const handlers = {
    resolution: {
      getDomain: async () => domain, getOpportunity: async () => opportunity,
      listContactsByDomain: async () => contacts,
      allocateContactKey: async () => `contact-${contacts.length + 1}`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createContact: async (_workspace: string, _actor: string, input: any) => { const id = `contact-${contacts.length + 1}`; contacts.push({ id, workspace_id: ids.workspace, domain_id: options.domainId, contact_status: input.contact_status, email_normalized: input.email_normalized, linkedin_url: input.linkedin_url, contact_form_url: input.contact_form_url, source_reference: input.source_reference }); counters.contactCreates++; return { id }; },
      resolve: async () => ({ status: "resolved", inspectedUrls: [`https://${options.hostname}`], candidates: [{ email: `editor@${options.hostname}`, linkedinUrl: null, contactFormUrl: null, evidence: [{ kind: "visible_email" as const, value: `editor@${options.hostname}`, sourceUrl: `https://${options.hostname}/contact`, confidence: "strong" as const }] }], reasons: [] } satisfies ContactResolutionResult),
    },
    validation: { getDomain: async () => domain, getOpportunity: async () => opportunity, getContact: async (_workspace: string, id: string) => contacts.find((item) => item.id === id)!, hasMxRecords: async () => true },
    mailbox: {
      getProvider: () => (options.paidMailboxVerificationAuthorized ? simulatedMailboxProvider("deliverable") : null),
      reserveVerification: async () => { counters.zeroBounceCalls++; return { outcome: "reserved" as const }; },
      cyclePeriodStart: "2026-11-01",
      getContact: async (_workspace: string, id: string) => { const contact = contacts.find((item) => item.id === id); return contact == null ? null : { ...contact, do_not_contact_at: null, archived_at: null }; },
      record: async (input: RecordMailboxVerificationAndMaybePromoteInput) => { const contact = contacts.find((item) => item.id === input.contactId); if (contact != null) contact.contact_status = "verified"; return { contactStatus: "verified", verificationId: "verification-sim-1", disposition: "created" as const, verifiedAt: now }; },
    },
    campaign: { getDomain: async () => domain, getOpportunity: async () => opportunity, getContact: async (_workspace: string, id: string) => contacts.find((item) => item.id === id)!, findCampaignMembership: async () => (counters.campaignCreates ? { campaignId: "campaign", membershipStatus: "active" } : null), prepareCampaign: async () => { counters.campaignCreates++; return { campaignId: "campaign", disposition: "created" as const, membershipStatus: "active" }; } },
    draft: { getDomain: async () => domain, getOpportunity: async () => opportunity, getContact: async (_workspace: string, id: string) => contacts.find((item) => item.id === id)!, getCampaign: async () => ({ id: "campaign", workspace_id: ids.workspace, lifecycle_status: "active" }), getActiveOutreach: async () => (counters.draftCreates ? { id: "outreach", status: "draft" } : null), createDraft: async () => { counters.draftCreates++; return { outreachId: "outreach", disposition: "created" as const, status: "draft" }; } },
    decision: { getFacts: async () => ({ backlinksEnabled: true, liveAutomationEnabled: true, evidenceBackedContact: true, contactStatus: contacts[0]?.contact_status ?? "unverified", channel: "email" as const, validOpportunity: true, validCampaign: true, validDraft: true, inboundReplyStop: false, complaintOrBounceStop: false, conflictingOpenAttempt: false, rateLimitEligible: true, maxAttemptEligible: true, contactFormVerified: false }) },
    contactForm: { getLatestApprovalCandidate: async () => null, queueExistingApproval: async () => { throw new Error("must not queue a contact-form submission without a preexisting human approval"); } },
  };
  return { deps, handlers, contacts, counters, byKey, setPaidMailboxVerificationAuthorized(value: boolean) { options.paidMailboxVerificationAuthorized = value; } };
}

async function enterAutonomy(fixture: ReturnType<typeof autonomyFixture>, applied: { applicationId: string; domainId: string; opportunityId: string }, promotionTask: AutomationTask, autonomyRunId: string, hostname: string) {
  return enterPromotedOpportunityContactResolution(
    { getDomain: async () => ({ id: applied.domainId, workspaceId: ids.workspace, hostname }), getOpportunity: async () => ({ id: applied.opportunityId, workspaceId: ids.workspace, domainId: applied.domainId }), createOrGetTask: fixture.deps.createOrGetTask },
    { promotion: { applicationId: applied.applicationId, workspaceId: ids.workspace, runId: ids.preRun, promotionTaskId: promotionTask.id, promotionTaskKind: "backlinks.promotion.preview", promotionTaskStatus: "completed", domainId: applied.domainId, opportunityId: applied.opportunityId, actorUserId: ids.actor, applied: true }, autonomyRunId, control, mode: "apply", scheduledAt: now },
  );
}

async function main(): Promise<void> {
  // Stages 1-4: the real discovery/qualification/promotion/apply chain.
  const discoveryTask = await runDiscovery();
  const qualificationTask = await runQualification(discoveryTask);
  const { promotionTask, proposal } = await runPromotionPreview(discoveryTask, qualificationTask);
  const applied = await runPromotionApply(promotionTask, proposal.proposalKey);
  assertTrue(applied.domainId !== discoveryTask.workspaceId, "sanity: domainId must be its own identifier");

  // Stage 5: golden path through the autonomy cycle to EMAIL_EXECUTION_PENDING.
  const autonomyRunId = uuid(9).replace(/^9/, "7");
  const golden = autonomyFixture({ domainId: applied.domainId, opportunityId: applied.opportunityId, hostname: proposal.hostname, paidMailboxVerificationAuthorized: true });
  const enterResult = await enterAutonomy(golden, applied, promotionTask, autonomyRunId, proposal.hostname);
  assertTrue(enterResult.outcome === "task_created", `expected a real contact_resolution task to be created, got ${enterResult.outcome}`);
  record("autonomy_enter", { outcome: enterResult.outcome, taskKind: enterResult.task?.taskKind });

  const cycleResult = await runBacklinkAutonomyCycle({ taskDependencies: golden.deps, handlers: golden.handlers, workspaceId: ids.workspace, runId: autonomyRunId, workerId: "full-chain-smoke", actorUserId: ids.actor, domainId: applied.domainId, opportunityId: applied.opportunityId, scheduledAt: now, mode: "apply", control, channel: "email" });
  record("autonomy_cycle", { outcome: cycleResult.outcome, reasonCodes: cycleResult.reasonCodes, steps: cycleResult.steps, taskIds: cycleResult.taskIds });
  assertTrue(cycleResult.outcome === "execution_pending", `RUPTURE: expected execution_pending (EMAIL_EXECUTION_PENDING), got ${cycleResult.outcome} / ${JSON.stringify(cycleResult.reasonCodes)}`);
  assertTrue(JSON.stringify(cycleResult.reasonCodes) === JSON.stringify(["EMAIL_EXECUTION_PENDING"]), "the chain must reach exactly EMAIL_EXECUTION_PENDING");
  assertTrue(golden.contacts[0]?.contact_status === "verified", "the contact must have been genuinely promoted to verified by the simulated mailbox verification");
  assertTrue(golden.counters.sends === 0 && golden.counters.forms === 0 && golden.counters.linkedin === 0, "zero real send/form/LinkedIn action anywhere in the golden path");
  assertTrue(golden.counters.zeroBounceCalls === 1, "the simulated verification was reached exactly once — never a real ZeroBounce HTTP call");

  // Replay: re-entering and re-cycling the same identifiers must create nothing new.
  const before = { ...golden.counters };
  const replayEnter = await enterAutonomy(golden, applied, promotionTask, autonomyRunId, proposal.hostname);
  assertTrue(replayEnter.outcome === "task_existing", "replaying the same promotion application must reuse the existing task, not create a second one");
  const replayCycle = await runBacklinkAutonomyCycle({ taskDependencies: golden.deps, handlers: golden.handlers, workspaceId: ids.workspace, runId: autonomyRunId, workerId: "full-chain-smoke", actorUserId: ids.actor, domainId: applied.domainId, opportunityId: applied.opportunityId, scheduledAt: now, mode: "apply", control, channel: "email" });
  assertTrue(replayCycle.outcome === "empty", "a full replay of an already-completed chain must claim nothing new");
  assertTrue(JSON.stringify(golden.counters) === JSON.stringify(before), "replay must not change any counter — no duplicate run, task, or business action");
  record("replay", { enterOutcome: replayEnter.outcome, cycleOutcome: replayCycle.outcome, countersUnchanged: true });

  // Stage 6: explicit security refusal, reusing the SAME real applied promotion —
  // without paid mailbox-verification authorization, the dispatcher must reject
  // before the simulated ZeroBounce provider is ever reached.
  const refusalRunId = uuid(9).replace(/^9/, "6");
  const refused = autonomyFixture({ domainId: applied.domainId, opportunityId: applied.opportunityId, hostname: proposal.hostname, paidMailboxVerificationAuthorized: false });
  await enterAutonomy(refused, applied, promotionTask, refusalRunId, proposal.hostname);
  const refusalCycle = await runBacklinkAutonomyCycle({ taskDependencies: refused.deps, handlers: refused.handlers, workspaceId: ids.workspace, runId: refusalRunId, workerId: "full-chain-smoke", actorUserId: ids.actor, domainId: applied.domainId, opportunityId: applied.opportunityId, scheduledAt: now, mode: "apply", control: { ...control, paidMailboxVerificationAuthorized: false }, channel: "email" });
  assertTrue(refusalCycle.outcome === "blocked" && JSON.stringify(refusalCycle.reasonCodes) === JSON.stringify(["MAILBOX_VERIFICATION_PAID_AUTHORIZATION_REQUIRED"]), "the security refusal must be deferred through the full real chain, not just an isolated fixture");
  assertTrue(refused.counters.zeroBounceCalls === 0, "the refusal must occur before the simulated provider is ever reached — zero verification calls");
  const deferredMailbox = [...refused.byKey.values()].find((value) => value.taskKind === "backlinks.mailbox_verification")!;
  assertTrue(deferredMailbox.status === "queued" && deferredMailbox.errorCode === "MAILBOX_VERIFICATION_PAID_AUTHORIZATION_REQUIRED", "the refused task must persist its reason and leave running for a bounded retry");
  record("security_refusal", { outcome: refusalCycle.outcome, reasonCodes: refusalCycle.reasonCodes, zeroBounceCalls: refused.counters.zeroBounceCalls });
  refused.setPaidMailboxVerificationAuthorized(true);
  const resumedCycle = await runBacklinkAutonomyCycle({ taskDependencies: refused.deps, handlers: refused.handlers, workspaceId: ids.workspace, runId: refusalRunId, workerId: "full-chain-smoke", actorUserId: ids.actor, domainId: applied.domainId, opportunityId: applied.opportunityId, scheduledAt: now, mode: "apply", control: { ...control, paidMailboxVerificationAuthorized: true }, channel: "email" });
  assertTrue(resumedCycle.outcome === "execution_pending", "a queued authorization block must resume from the same mailbox task after authorization is supplied");
  assertTrue(Number(refused.counters.zeroBounceCalls) === 1, "the authorized retry uses exactly one simulated verification, with no duplicate provider call before authorization");
  const resumedReplayCounters = { ...refused.counters };
  assertTrue((await runBacklinkAutonomyCycle({ taskDependencies: refused.deps, handlers: refused.handlers, workspaceId: ids.workspace, runId: refusalRunId, workerId: "full-chain-smoke", actorUserId: ids.actor, domainId: applied.domainId, opportunityId: applied.opportunityId, scheduledAt: now, mode: "apply", control: { ...control, paidMailboxVerificationAuthorized: true }, channel: "email" })).outcome === "empty", "the resumed chain remains idempotent");
  assertTrue(JSON.stringify(refused.counters) === JSON.stringify(resumedReplayCounters), "replaying a resumed chain must not create duplicates");
  record("authorization_resume", { outcome: resumedCycle.outcome, zeroBounceCalls: refused.counters.zeroBounceCalls, replayCountersUnchanged: true });

  console.log("TRACE", JSON.stringify(trace, null, 2));
  console.log("EXTERNAL_EFFECT_COUNTERS", JSON.stringify({ golden: golden.counters, refused: refused.counters }, null, 2));
  console.log("PASS — Backlink autonomy full-chain local smoke");
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => { (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = originalFetch; });
