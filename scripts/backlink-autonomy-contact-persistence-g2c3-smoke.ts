import assert from "node:assert/strict";

import { executeBacklinkContactResolutionTask } from "../lib/automation/backlink-contact-resolution-task-handler";
import { executeBacklinkContactValidationTask } from "../lib/automation/backlink-contact-validation-task-handler";
import { runBacklinkAutonomyOrchestrator } from "../lib/automation/backlink-master-autonomy-orchestrator";
import {
  BacklinkRepositoryError,
} from "../lib/backlinks/repositories/errors";
import {
  persistOrReuseEvidenceBackedResolvedContact,
  resolveCanonicalContactIdentity,
  ResolvedContactPersistenceError,
  type ContactResolutionCandidate,
  type ExistingResolvedContact,
} from "../lib/backlinks/services/contactResolutionService";
import type { ContactResolutionResult } from "../lib/backlinks/services/contactResolutionService";

type StoredContact = ExistingResolvedContact & { contact_key: string };

const scope = { workspaceId: "workspace", domainId: "domain", actorUserId: "actor" };

function candidate(channel: "email" | "contact_form" | "linkedin", value: string): ContactResolutionCandidate {
  const evidenceKind = channel === "email" ? "mailto" : channel;
  return {
    email: channel === "email" ? value : null,
    contactFormUrl: channel === "contact_form" ? value : null,
    linkedinUrl: channel === "linkedin" ? value : null,
    evidence: [{ kind: evidenceKind, value, sourceUrl: "https://example.com/contact", confidence: channel === "email" ? "strong" : "medium" }],
  };
}

function store(initial: StoredContact[] = []) {
  const contacts = [...initial];
  const created: Array<Record<string, unknown>> = [];
  let conflictHook: ((input: Record<string, unknown>) => void) | null = null;
  return {
    contacts,
    created,
    conflictOnNextCreate(hook: (input: Record<string, unknown>) => void) { conflictHook = hook; },
    list: async () => contacts,
    create: async (_workspaceId: string, _actorUserId: string, input: Record<string, unknown>) => {
      if (conflictHook != null) {
        const hook = conflictHook;
        conflictHook = null;
        hook(input);
        throw new BacklinkRepositoryError({ code: "CONFLICT", operation: "createBacklinkContact", message: "The operation conflicts with existing data." });
      }
      if (contacts.some((contact) => contact.contact_key === input.contact_key || (input.email_normalized != null && contact.email_normalized === input.email_normalized))) {
        throw new BacklinkRepositoryError({ code: "CONFLICT", operation: "createBacklinkContact", message: "The operation conflicts with existing data." });
      }
      const id = `contact-${contacts.length + 1}`;
      contacts.push({
        id,
        workspace_id: scope.workspaceId,
        domain_id: scope.domainId,
        contact_key: String(input.contact_key),
        contact_status: String(input.contact_status),
        email_normalized: input.email_normalized as string | null,
        contact_form_url: input.contact_form_url as string | null,
        linkedin_url: input.linkedin_url as string | null,
      });
      created.push(input);
      return { id };
    },
  };
}

async function persist(candidateInput: ContactResolutionCandidate, value = store()) {
  const result = await persistOrReuseEvidenceBackedResolvedContact({ ...scope, candidate: candidateInput, listContactsByDomain: value.list, createContact: value.create });
  return { result, value };
}

/** Models two initial reads seeing the same empty canonical store before either create. */
async function assertConcurrentConvergence(candidateInput: ContactResolutionCandidate) {
  const value = store();
  let initialReads = 0;
  let releaseInitialReads: (() => void) | null = null;
  const initialReadsComplete = new Promise<void>((resolve) => { releaseInitialReads = resolve; });
  const list = async () => {
    const snapshot = [...value.contacts];
    initialReads += 1;
    if (initialReads <= 2) {
      if (initialReads === 2) releaseInitialReads?.();
      await initialReadsComplete;
      return snapshot;
    }
    return value.contacts;
  };
  const persistConcurrently = () => persistOrReuseEvidenceBackedResolvedContact({ ...scope, candidate: candidateInput, listContactsByDomain: list, createContact: value.create });
  const [first, second] = await Promise.all([persistConcurrently(), persistConcurrently()]);
  assert.equal(first.id, second.id);
  assert.deepEqual(new Set([first.disposition, second.disposition]), new Set(["created", "reused"]));
  assert.equal(value.contacts.length, 1);
  assert.equal(value.created.length, 1);
  return { id: first.id, value };
}

function resolution(candidates: readonly ContactResolutionCandidate[]): ContactResolutionResult {
  return { status: "resolved", inspectedUrls: ["https://example.com/"], candidates, reasons: [] };
}

function handlerDependencies(value: ReturnType<typeof store>, result: ContactResolutionResult) {
  return {
    getDomain: async () => ({ id: scope.domainId, workspace_id: scope.workspaceId, hostname: "example.com", lifecycle_status: "active", archived_at: null }),
    getOpportunity: async () => ({ id: "opportunity", workspace_id: scope.workspaceId, domain_id: scope.domainId, lifecycle_status: "active", archived_at: null }),
    listContactsByDomain: value.list,
    createContact: value.create,
    resolve: async () => result,
  };
}

async function main() {
  const email = candidate("email", " Editor@Example.com ");
  const form = candidate("contact_form", "https://EXAMPLE.com/contact/#top");
  const linkedin = candidate("linkedin", "https://www.linkedin.com/company/example/#about");
  const emailIdentity = resolveCanonicalContactIdentity({ ...scope, candidate: email });
  const formIdentity = resolveCanonicalContactIdentity({ ...scope, candidate: form });
  const linkedinIdentity = resolveCanonicalContactIdentity({ ...scope, candidate: linkedin });
  for (const identity of [emailIdentity, formIdentity, linkedinIdentity]) {
    assert(identity != null);
    assert.match(identity.contactKey, /^CT-\d{6,}$/);
  }
  assert.equal(emailIdentity!.contactKey, resolveCanonicalContactIdentity({ ...scope, candidate: email })!.contactKey);
  assert.equal(formIdentity!.value, "https://example.com/contact");
  assert.equal(linkedinIdentity!.value, "https://www.linkedin.com/company/example");

  const createdEmail = await persist(email);
  assert.equal(createdEmail.result.disposition, "created");
  assert.equal(createdEmail.value.created[0]?.contact_status, "unverified");
  assert.equal(createdEmail.value.created[0]?.email_normalized, "editor@example.com");
  const replay = await persist(email, createdEmail.value);
  assert.equal(replay.result.disposition, "reused");
  assert.equal(createdEmail.value.created.length, 1);

  const conflict = store();
  conflict.conflictOnNextCreate((input) => conflict.contacts.push({
    id: "reread-email", workspace_id: scope.workspaceId, domain_id: scope.domainId, contact_key: String(input.contact_key), contact_status: "unverified", email_normalized: String(input.email_normalized), contact_form_url: null, linkedin_url: null,
  }));
  assert.deepEqual((await persist(email, conflict)).result, { id: "reread-email", disposition: "reused" });

  const emailUniqueConflict = store();
  emailUniqueConflict.conflictOnNextCreate((input) => emailUniqueConflict.contacts.push({
    id: "email-unique", workspace_id: scope.workspaceId, domain_id: scope.domainId, contact_key: "CT-777777", contact_status: "unverified", email_normalized: String(input.email_normalized), contact_form_url: null, linkedin_url: null,
  }));
  assert.deepEqual((await persist(email, emailUniqueConflict)).result, { id: "email-unique", disposition: "reused" });

  const concurrentEmail = await assertConcurrentConvergence(email);
  assert.equal(concurrentEmail.value.contacts[0]?.email_normalized, "editor@example.com");

  const incompatible = store([{ id: "wrong-key", workspace_id: scope.workspaceId, domain_id: scope.domainId, contact_key: emailIdentity!.contactKey, contact_status: "unverified", email_normalized: "different@example.com", contact_form_url: null, linkedin_url: null }]);
  await assert.rejects(() => persist(email, incompatible), (error: unknown) => error instanceof ResolvedContactPersistenceError && error.code === "CONTACT_IDENTITY_CONFLICT");
  const incompatibleHandler = await executeBacklinkContactResolutionTask(handlerDependencies(incompatible, resolution([email])), { ...scope, opportunityId: "opportunity" });
  assert.equal(incompatibleHandler.status, "blocked");
  assert.deepEqual(incompatibleHandler.createdContactIds, []);
  assert.deepEqual(incompatibleHandler.existingContactIds, []);

  for (const input of [form, linkedin]) {
    const channel = await persist(input);
    assert.equal(channel.result.disposition, "created");
    assert.equal((await persist(input, channel.value)).result.disposition, "reused");
    await assertConcurrentConvergence(input);
  }

  for (const status of ["do_not_contact", "archived", "verified"]) {
    const existing = store([{ id: status, workspace_id: scope.workspaceId, domain_id: scope.domainId, contact_key: `CT-${status === "verified" ? "999999" : status === "archived" ? "999998" : "999997"}`, contact_status: status, email_normalized: `${status}@example.com`, contact_form_url: null, linkedin_url: null }]);
    const reused = await persist(candidate("email", `${status}@example.com`), existing);
    assert.equal(reused.result.disposition, "reused");
    assert.equal(existing.contacts[0]?.contact_status, status);
    assert.equal(existing.created.length, 0);
  }

  for (const status of ["do_not_contact", "archived"]) {
    const assessed = await executeBacklinkContactValidationTask({
      getDomain: async () => ({ id: scope.domainId, workspace_id: scope.workspaceId, hostname: "example.com", archived_at: null }),
      getOpportunity: async () => ({ id: "opportunity", workspace_id: scope.workspaceId, domain_id: scope.domainId, archived_at: null }),
      getContact: async () => ({ id: status, workspace_id: scope.workspaceId, domain_id: scope.domainId, contact_status: status, email_normalized: `${status}@example.com`, contact_form_url: null, linkedin_url: null, source_reference: null }),
      hasMxRecords: async () => true,
    }, { workspaceId: scope.workspaceId, domainId: scope.domainId, opportunityId: "opportunity", contactId: status });
    assert.equal(assessed.status, "manual_review");
    assert.equal(assessed.statusTransition, "preserved");
  }

  const one = store();
  const oneResult = await executeBacklinkContactResolutionTask(handlerDependencies(one, resolution([candidate("email", "one@example.com")])), { ...scope, opportunityId: "opportunity" });
  // Simulate a crash after persistence and before task completion/handoff, then replay the same task.
  const replayedAfterCrash = await executeBacklinkContactResolutionTask(handlerDependencies(one, resolution([candidate("email", "one@example.com")])), { ...scope, opportunityId: "opportunity" });
  assert.deepEqual(replayedAfterCrash.createdContactIds, []);
  assert.deepEqual(replayedAfterCrash.existingContactIds, oneResult.createdContactIds);
  assert.equal(one.created.length, 1);
  const validationTasks = new Map<string, string>();
  const createOrGetTask = async (input: { taskKey: string }) => {
    const existing = validationTasks.get(input.taskKey);
    if (existing != null) return { kind: "existing" as const, task: { id: existing } };
    const id = `validation-${validationTasks.size + 1}`;
    validationTasks.set(input.taskKey, id);
    return { kind: "created" as const, task: { id } };
  };
  const validationInput = (contactIds: readonly string[]) => ({
    workspaceId: scope.workspaceId, runId: "run", domainId: scope.domainId, opportunityId: "opportunity", scheduledAt: "2026-01-01T00:00:00.000Z", mode: "apply" as const,
    control: { backlinksEnabled: true, disabledReason: null, dryRunOnly: true, backlinkAutonomyEnabled: true, liveExecutionAuthorized: false },
    progress: { stage: "contact_resolution" as const, completedTaskId: "resolution-task", completedTaskKind: "backlinks.contact_resolution", contactIds },
  });
  const validation = await runBacklinkAutonomyOrchestrator({ createOrGetTask }, validationInput([...oneResult.createdContactIds, ...oneResult.existingContactIds]));
  const replayedValidation = await runBacklinkAutonomyOrchestrator({ createOrGetTask }, validationInput(replayedAfterCrash.existingContactIds));
  assert.equal(validation.outcome, "task_created");
  assert.equal(replayedValidation.outcome, "task_existing");
  assert.equal(validation.taskId, replayedValidation.taskId);
  assert.equal(validationTasks.size, 1);
  assert.equal(validation.task?.taskKind, "backlinks.contact_validation");
  assert.equal((validation.task?.input as { contactId: string }).contactId, oneResult.createdContactIds[0]);

  const liveBlocked = await runBacklinkAutonomyOrchestrator({}, {
    ...validationInput(replayedAfterCrash.existingContactIds),
    mode: "live",
  });
  assert.equal(liveBlocked.outcome, "disabled");
  assert.deepEqual(liveBlocked.reasonCodes, ["LIVE_EXECUTION_NOT_AUTHORIZED"]);

  const multiple = store();
  const multipleResult = await executeBacklinkContactResolutionTask(handlerDependencies(multiple, resolution([candidate("email", "a@example.com"), candidate("email", "b@example.com")])), { ...scope, opportunityId: "opportunity" });
  const manual = await runBacklinkAutonomyOrchestrator({}, {
    workspaceId: scope.workspaceId, runId: "run", domainId: scope.domainId, opportunityId: "opportunity", scheduledAt: "2026-01-01T00:00:00.000Z", mode: "apply",
    control: { backlinksEnabled: true, disabledReason: null, dryRunOnly: true, backlinkAutonomyEnabled: true, liveExecutionAuthorized: false },
    progress: { stage: "contact_resolution", completedTaskId: "resolution-task", completedTaskKind: "backlinks.contact_resolution", contactIds: multipleResult.createdContactIds },
  });
  assert.equal(manual.outcome, "manual_review");
  assert.deepEqual(manual.reasonCodes, ["CONTACT_SELECTION_REQUIRED"]);
  console.log("PASS — Backlink autonomy canonical contact persistence G2C.3 smoke");
}

void main();
