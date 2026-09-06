import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { Json } from "../types/database.types";
import type { ContactFormDiscoveredForm } from "../lib/backlinks/services/contactFormMappingPreview";
import {
  executeContactFormNavigationWorkerOnceWithDependencies,
  isContactFormNavigationWorkerEnabled,
  isContactFormRealSubmissionEnabled,
  isPublicIpAddress,
  validateContactFormNavigationUrl,
  type ContactFormBrowserPage,
  type ContactFormBrowserRequest,
  type ContactFormBrowserRequestDecision,
  type ContactFormBrowserRuntime,
  type ContactFormDnsResolver,
  type ContactFormNavigationDependencies,
} from "../lib/backlinks/services/contactFormNavigationWorker";
import { contactFormSafeFingerprint, type ContactFormConfirmationObservation, type ContactFormFieldLocator, type ContactFormSubmitControl } from "../lib/backlinks/services/contactFormSubmission";
import { buildContactFormApprovalFingerprint } from "../lib/backlinks/services/contactFormApprovalFingerprint";
import type {
  ContactFormApproval,
  ContactFormExecutionContact,
  ContactFormExecutionOpportunity,
  ContactFormExecutionOutreach,
  ContactFormRun,
  ContactFormRunExecutionContext,
  ContactFormRunState,
} from "../lib/backlinks/repositories/contactFormAutomationRepository";

const now = "2026-09-02T12:00:00.000Z";
const workspaceId = "10000000-0000-4000-8000-000000000001";
const campaignId = "10000000-0000-4000-8000-000000000002";
const outreachId = "10000000-0000-4000-8000-000000000003";
const contactId = "10000000-0000-4000-8000-000000000004";
const opportunityId = "10000000-0000-4000-8000-000000000005";
const approvalId = "10000000-0000-4000-8000-000000000006";
const runId = "10000000-0000-4000-8000-000000000007";
const workerId = "c3-test-worker";

type TestCase = { name: string; run: () => Promise<void> | void };
const tests: TestCase[] = [];
function test(name: string, run: TestCase["run"]) {
  tests.push({ name, run });
}

function rowRun(overrides: Partial<ContactFormRun> = {}): ContactFormRun {
  return {
    approval_id: approvalId,
    campaign_id: campaignId,
    claimed_at: now,
    claimed_by: workerId,
    created_at: now,
    evidence_reference: null,
    final_attempt_id: null,
    final_url: null,
    finished_at: null,
    form_schema_fingerprint: null,
    form_url: "https://forms.example/contact",
    heartbeat_at: now,
    id: runId,
    lease_expires_at: "2026-09-02T12:02:00.000Z",
    max_pre_submit_attempts: 2,
    outreach_id: outreachId,
    pre_submit_attempt_count: 0,
    result_class: null,
    safe_error_code: null,
    started_at: now,
    state: "claimed",
    submit_started_at: null,
    updated_at: now,
    workspace_id: workspaceId,
    ...overrides,
  };
}

function rowOutreach(overrides: Partial<ContactFormExecutionOutreach> = {}): ContactFormExecutionOutreach {
  return { body: "Approved body", campaign_id: campaignId, channel: "contact_form", contact_id: contactId, current_attempt: 0, id: outreachId, opportunity_id: opportunityId, status: "draft", subject: "Approved subject", workspace_id: workspaceId, ...overrides };
}

function rowContact(overrides: Partial<ContactFormExecutionContact> = {}): ContactFormExecutionContact {
  return { archived_at: null, contact_form_url: "https://forms.example/contact", contact_status: "verified", do_not_contact_at: null, id: contactId, workspace_id: workspaceId, ...overrides };
}

function rowOpportunity(overrides: Partial<ContactFormExecutionOpportunity> = {}): ContactFormExecutionOpportunity {
  return { id: opportunityId, target_page_url: "https://target.example/page", workspace_id: workspaceId, ...overrides };
}

function rowApproval(input?: {
  outreach?: ContactFormExecutionOutreach;
  contact?: ContactFormExecutionContact;
  opportunity?: ContactFormExecutionOpportunity;
  overrides?: Partial<ContactFormApproval>;
}): ContactFormApproval {
  const outreach = input?.outreach ?? rowOutreach();
  const contact = input?.contact ?? rowContact();
  const opportunity = input?.opportunity ?? rowOpportunity();
  const senderName = input?.overrides?.sender_name ?? "Norixo";
  const senderFirstName = input?.overrides?.sender_first_name ?? null;
  const senderLastName = input?.overrides?.sender_last_name ?? null;
  const content_fingerprint = buildContactFormApprovalFingerprint({
    workspaceId,
    campaignId,
    outreachId,
    contactId,
    opportunityId,
    targetUrl: opportunity.target_page_url.trim(),
    formUrl: contact.contact_form_url?.trim() ?? "",
    senderName,
    senderFirstName,
    senderLastName,
    senderEmail: "ops@norixo.example",
    senderCompany: "Norixo",
    senderWebsite: "https://norixo.example",
    subject: outreach.subject?.trim() ?? "",
    body: outreach.body?.trim() ?? "",
  });
  return {
    approved_at: now,
    approved_by_user_id: "10000000-0000-4000-8000-000000000008",
    body: outreach.body ?? "",
    campaign_id: campaignId,
    contact_id: contactId,
    content_fingerprint,
    created_at: now,
    form_schema_fingerprint: null,
    form_url: contact.contact_form_url?.trim() ?? "",
    id: approvalId,
    opportunity_id: opportunityId,
    outreach_id: outreachId,
    sender_company: "Norixo",
    sender_email: "ops@norixo.example",
    sender_first_name: senderFirstName,
    sender_last_name: senderLastName,
    sender_name: senderName,
    sender_website: "https://norixo.example",
    subject: outreach.subject ?? "",
    target_url: opportunity.target_page_url.trim(),
    workspace_id: workspaceId,
    ...input?.overrides,
  };
}

function context(overrides: {
  run?: Partial<ContactFormRun>;
  outreach?: Partial<ContactFormExecutionOutreach>;
  contact?: Partial<ContactFormExecutionContact>;
  opportunity?: Partial<ContactFormExecutionOpportunity>;
  approval?: Partial<ContactFormApproval>;
  outreachAttemptCount?: number;
} = {}): ContactFormRunExecutionContext {
  const run = rowRun(overrides.run);
  const outreach = rowOutreach(overrides.outreach);
  const contact = rowContact(overrides.contact);
  const opportunity = rowOpportunity(overrides.opportunity);
  const approval = rowApproval({ outreach, contact, opportunity, overrides: overrides.approval });
  return { run, approval, outreach, contact, opportunity, outreachAttemptCount: overrides.outreachAttemptCount ?? 0 };
}

function publicDns(hostname: string): readonly { address: string; family: 4 | 6 }[] {
  assert.equal(hostname.length > 0, true);
  return [{ address: "93.184.216.34", family: 4 }];
}

function resolver(records: readonly { address: string; family: 4 | 6 }[] | Error): ContactFormDnsResolver {
  return async () => {
    if (records instanceof Error) throw records;
    return records;
  };
}

function discoveredContactForm(overrides: Partial<ContactFormDiscoveredForm> = {}): ContactFormDiscoveredForm {
  return {
    ordinal: 0,
    action: "/contact",
    method: "post",
    labelText: "Contact us",
    legendText: null,
    buttonText: "Send message",
    controls: [
      { ordinal: 0, tag: "input", type: "text", name: "name", id: "name", autocomplete: "name", labelText: "Your name", ariaLabel: null, ariaLabelledbyText: null, placeholder: null, required: true, disabled: false, readOnly: false, hidden: false, visible: true, valuePresent: false },
      { ordinal: 1, tag: "input", type: "email", name: "email", id: "email", autocomplete: "email", labelText: "Email", ariaLabel: null, ariaLabelledbyText: null, placeholder: null, required: true, disabled: false, readOnly: false, hidden: false, visible: true, valuePresent: false },
      { ordinal: 2, tag: "input", type: "text", name: "subject", id: "subject", autocomplete: null, labelText: "Subject", ariaLabel: null, ariaLabelledbyText: null, placeholder: null, required: false, disabled: false, readOnly: false, hidden: false, visible: true, valuePresent: false },
      { ordinal: 3, tag: "textarea", type: "textarea", name: "message", id: "message", autocomplete: null, labelText: "Message", ariaLabel: null, ariaLabelledbyText: null, placeholder: null, required: true, disabled: false, readOnly: false, hidden: false, visible: true, valuePresent: false },
      { ordinal: 4, tag: "button", type: "submit", name: null, id: null, autocomplete: null, labelText: null, ariaLabel: null, ariaLabelledbyText: null, placeholder: null, required: false, disabled: false, readOnly: false, hidden: false, visible: true, valuePresent: false },
    ],
    ...overrides,
  };
}

function discoveredSplitNameContactForm(overrides: Partial<ContactFormDiscoveredForm> = {}): ContactFormDiscoveredForm {
  return discoveredContactForm({
    controls: [
      { ordinal: 0, tag: "input", type: "text", name: "first_name", id: "first_name", autocomplete: "given-name", labelText: "First Name", ariaLabel: null, ariaLabelledbyText: null, placeholder: null, required: true, disabled: false, readOnly: false, hidden: false, visible: true, valuePresent: false },
      { ordinal: 1, tag: "input", type: "text", name: "last_name", id: "last_name", autocomplete: "family-name", labelText: "Last Name", ariaLabel: null, ariaLabelledbyText: null, placeholder: null, required: true, disabled: false, readOnly: false, hidden: false, visible: true, valuePresent: false },
      { ordinal: 2, tag: "input", type: "email", name: "email", id: "email", autocomplete: "email", labelText: "Email", ariaLabel: null, ariaLabelledbyText: null, placeholder: null, required: true, disabled: false, readOnly: false, hidden: false, visible: true, valuePresent: false },
      { ordinal: 3, tag: "textarea", type: "textarea", name: "message", id: "message", autocomplete: null, labelText: "Message", ariaLabel: null, ariaLabelledbyText: null, placeholder: null, required: true, disabled: false, readOnly: false, hidden: false, visible: true, valuePresent: false },
      { ordinal: 4, tag: "button", type: "submit", name: null, id: null, autocomplete: null, labelText: null, ariaLabel: null, ariaLabelledbyText: null, placeholder: null, required: false, disabled: false, readOnly: false, hidden: false, visible: true, valuePresent: false },
    ],
    ...overrides,
  });
}

class FakePage implements ContactFormBrowserPage {
  private handler: ((request: ContactFormBrowserRequest) => Promise<ContactFormBrowserRequestDecision>) | null = null;
  currentUrl = "about:blank";
  titleValue = "Contact us";
  counts = new Map<string, number>([
    ["form", 1],
    ["input", 3],
    ["textarea", 1],
    ["select", 0],
    ["button", 1],
  ]);
  signals = { hasCaptcha: false, hasLoginWall: false, hasPasswordField: false };
  forms: ContactFormDiscoveredForm[] = [discoveredContactForm()];
	  requests: ContactFormBrowserRequest[] = [];
	  submitRequests: ContactFormBrowserRequest[] | null = null;
	  submitConcurrent = false;
	  submitDecisions: Array<{ url: string; method: string; decision: ContactFormBrowserRequestDecision }> = [];
	  afterConcurrentSubmitDispatchStarted: (() => Promise<void> | void) | null = null;
	  submitted = false;
	  filledValues = new Map<number, string>();
	  clickCount = 0;
	  confirmation: ContactFormConfirmationObservation = { confirmed: true, kind: "EXPLICIT_SUCCESS_ELEMENT", finalUrl: "https://forms.example/contact", evidenceFingerprint: contactFormSafeFingerprint({ fixture: "explicit_success_element" }), markerId: "success" };
	  popupHandler: (() => void) | null = null;
	  downloadHandler: (() => void) | null = null;
	  throwOnGoto: Error | null = null;
  async routeRequests(handler: (request: ContactFormBrowserRequest) => Promise<ContactFormBrowserRequestDecision>) {
    this.handler = handler;
  }
  async goto(url: string) {
    if (this.throwOnGoto) throw this.throwOnGoto;
    const requests = this.requests.length ? this.requests : [{ url, method: "GET", resourceType: "document", isNavigationRequest: true }];
    for (const request of requests) {
      const decision = await this.dispatch(request);
      if (decision === "abort") throw new Error("blockedbyclient");
      if (request.isNavigationRequest) this.currentUrl = request.url;
    }
  }
  url() {
    return this.currentUrl;
  }
  async title() {
    return this.titleValue;
  }
  async count(selector: string) {
    return this.counts.get(selector) ?? 0;
  }
  async evaluatePageSignals() {
    return this.signals;
  }
	  async inspectForms() {
	    return { pageUrl: this.currentUrl, pageTitle: this.titleValue, forms: this.forms };
	  }
	  async readFieldValue(locator: ContactFormFieldLocator) {
	    return this.filledValues.get(locator.controlOrdinal) ?? "";
	  }
	  async fillField(locator: ContactFormFieldLocator, value: string) {
	    this.filledValues.set(locator.controlOrdinal, value);
	  }
	  async listSubmitControls(formOrdinal: number) {
	    const form = this.forms.find((current) => current.ordinal === formOrdinal);
	    if (!form) return [];
	    return form.controls
	      .filter((control) => (control.tag === "button" || control.tag === "input") && control.type.toLowerCase() === "submit")
	      .map((control): ContactFormSubmitControl => ({
	        formOrdinal,
	        controlOrdinal: control.ordinal,
	        tag: control.tag === "button" ? "button" : "input",
	        type: "submit",
	        name: control.name,
	        id: control.id,
	        visible: control.visible,
	        enabled: !control.disabled,
	        disabled: control.disabled,
	        hidden: control.hidden,
	        fingerprint: contactFormSafeFingerprint({ form_ordinal: formOrdinal, control_ordinal: control.ordinal, tag: control.tag, type: control.type, name: control.name, id: control.id }),
	      }));
	  }
	  async clickSubmitControl(control: ContactFormSubmitControl) {
	    this.clickCount += 1;
	    this.submitted = true;
	    const form = this.forms.find((current) => current.ordinal === control.formOrdinal);
	    assert.ok(form, "submit form exists");
	    const action = new URL(form.action ?? this.currentUrl, this.currentUrl);
	    const method = (form.method ?? "get").toUpperCase();
	    const requests = this.submitRequests ?? [{ url: action.href, method, resourceType: "document", isNavigationRequest: true }];
	    const record = async (request: ContactFormBrowserRequest) => {
	      const decision = await this.dispatch(request);
	      this.submitDecisions.push({ url: request.url, method: request.method, decision });
	      if (decision === "continue" && request.isNavigationRequest) this.currentUrl = request.url;
	      return { request, decision };
	    };
	    const decisions = this.submitConcurrent ? await Promise.all(requests.map(record)) : await serialSubmitRequests(requests, record);
	    if (decisions.some((result) => result.decision === "abort" && result.request.isNavigationRequest)) throw new Error("blockedbyclient");
	  }
	  async observeSubmissionConfirmation() {
	    return this.confirmation;
	  }
	  onPopup(handler: () => void) {
	    this.popupHandler = handler;
	  }
  onDownload(handler: () => void) {
    this.downloadHandler = handler;
  }
  async dispatch(request: ContactFormBrowserRequest) {
    assert.ok(this.handler, "route handler registered");
    return this.handler(request);
  }
}

async function serialSubmitRequests<T extends ContactFormBrowserRequest>(
  requests: readonly T[],
  handler: (request: T) => Promise<{ request: T; decision: ContactFormBrowserRequestDecision }>,
) {
  const results: Array<{ request: T; decision: ContactFormBrowserRequestDecision }> = [];
  for (const request of requests) results.push(await handler(request));
  return results;
}

function runtime(page = new FakePage(), closeFailure = false): ContactFormBrowserRuntime & { opened: number; closed: number; page: FakePage } {
  return {
    name: "fake-playwright-chromium",
    opened: 0,
    closed: 0,
    page,
    async openContext() {
      this.opened += 1;
      return {
        page,
        close: async () => {
          this.closed += 1;
          if (closeFailure) throw new Error("close failed");
        },
      };
    },
  };
}

function deps(input: {
  ctx?: ContactFormRunExecutionContext;
  page?: FakePage;
  dns?: ContactFormDnsResolver;
  heartbeatError?: Error;
  closeFailure?: boolean;
  claimNextRunResult?: ContactFormRun | null;
  claimRunByIdResult?: ContactFormRun | null;
} = {}): ContactFormNavigationDependencies & { transitions: Array<{ state: ContactFormRunState; eventType: string; safeErrorCode: string | null; metadata: Json | undefined; finalUrl: string | null }>; runtime: ReturnType<typeof runtime>; heartbeats: number; claims: number; targetClaims: number; targetClaimRunIds: string[]; loadedRunIds: string[]; confirmations: number } {
  const ctx = input.ctx ?? context();
  const fakeRuntime = runtime(input.page, input.closeFailure);
  const transitions: Array<{ state: ContactFormRunState; eventType: string; safeErrorCode: string | null; metadata: Json | undefined; finalUrl: string | null }> = [];
  let heartbeats = 0;
  let claims = 0;
  let targetClaims = 0;
  const targetClaimRunIds: string[] = [];
  const loadedRunIds: string[] = [];
  let confirmations = 0;
  return {
    get heartbeats() {
      return heartbeats;
    },
    get claims() {
      return claims;
    },
    get targetClaims() {
      return targetClaims;
    },
    targetClaimRunIds,
    loadedRunIds,
    get confirmations() {
      return confirmations;
    },
    runtime: fakeRuntime,
    transitions,
    async claimNextRun() {
      claims += 1;
      return "claimNextRunResult" in input ? input.claimNextRunResult ?? null : ctx.run;
    },
    async claimRunById(targetRunId) {
      targetClaims += 1;
      targetClaimRunIds.push(targetRunId);
      if ("claimRunByIdResult" in input) return input.claimRunByIdResult ?? null;
      return targetRunId === ctx.run.id ? ctx.run : null;
    },
    async heartbeatRun() {
      heartbeats += 1;
      if (input.heartbeatError) throw input.heartbeatError;
      return ctx.run;
    },
    async transitionRun(transition) {
      transitions.push({ state: transition.nextState, eventType: transition.eventType, safeErrorCode: transition.safeErrorCode ?? null, metadata: transition.safeMetadata, finalUrl: transition.finalUrl ?? null });
      return { ...ctx.run, id: transition.runId, state: transition.nextState, final_url: transition.finalUrl ?? ctx.run.final_url, safe_error_code: transition.safeErrorCode ?? ctx.run.safe_error_code, submit_started_at: transition.nextState === "submitting" ? now : ctx.run.submit_started_at };
    },
    async confirmSubmission(input) {
      confirmations += 1;
      return { run_id: input.runId, attempt_id: "10000000-0000-4000-8000-000000000099", disposition: "created" };
    },
    async loadExecutionContext(run) {
      loadedRunIds.push(run.id);
      return { ...ctx, run };
    },
    resolveHostname: input.dns ?? (async (hostname) => publicDns(hostname)),
    browserRuntime: fakeRuntime,
    nowMs: () => Date.parse(now),
  };
}

async function expectUrl(rawUrl: string, expected: boolean, dns: ContactFormDnsResolver = async (hostname) => publicDns(hostname)) {
  const result = await validateContactFormNavigationUrl(rawUrl, dns);
  assert.equal(result.ok, expected, `${rawUrl} expected ${expected ? "accepted" : "rejected"}`);
}

async function expectRealSubmissionDisabled(options?: { allowRealSubmission?: boolean; targetRunId?: string }) {
  const page = new FakePage();
  const d = deps({ page });
  const result = await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId, options);
  assert.equal(result.kind, "blocked");
  if (result.kind === "blocked") {
    assert.equal(result.state, "manual_review");
    assert.equal(result.safeErrorCode, "CONTACT_FORM_REAL_SUBMISSION_DISABLED");
  }
  assert.deepEqual(d.transitions.map((transition) => transition.state), ["navigating", "discovered", "mapped", "manual_review"]);
  assert.equal(d.transitions.at(-1)?.eventType, "real_submission_disabled");
  assert.equal(d.transitions.at(-1)?.safeErrorCode, "CONTACT_FORM_REAL_SUBMISSION_DISABLED");
  assert.equal(d.transitions.some((transition) => transition.state === "filled"), false);
  assert.equal(d.transitions.some((transition) => transition.state === "pre_submit_validated"), false);
  assert.equal(d.transitions.some((transition) => transition.state === "submitting"), false);
  assert.equal(page.submitted, false);
  assert.equal(page.filledValues.size, 0);
  assert.equal(page.clickCount, 0);
  assert.equal(page.submitDecisions.length, 0);
  assert.equal(d.confirmations, 0);
  if (options?.targetRunId != null) {
    assert.equal(d.claims, 0);
    assert.equal(d.targetClaims, 1);
  }
}

test("HTTPS URL acceptance", () => expectUrl("https://forms.example/contact", true));
test("generic mode uses claimNextRun when targetRunId is absent", async () => {
  const d = deps();
  await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId);
  assert.equal(d.claims, 1);
  assert.equal(d.targetClaims, 0);
});
test("target mode uses claimRunById and never claimNextRun", async () => {
  const d = deps();
  await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId, { targetRunId: ` ${runId} ` });
  assert.equal(d.claims, 0);
  assert.equal(d.targetClaims, 1);
  assert.deepEqual(d.targetClaimRunIds, [runId]);
});
test("target unavailable returns safe result without opening browser or fallback", async () => {
  const targetRunId = "10000000-0000-4000-8000-0000000000f1";
  const d = deps({ claimRunByIdResult: null });
  const result = await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId, { targetRunId });
  assert.deepEqual(result, { kind: "target_unavailable", runId: targetRunId });
  assert.equal(d.claims, 0);
  assert.equal(d.targetClaims, 1);
  assert.equal(d.runtime.opened, 0);
  assert.equal(d.loadedRunIds.length, 0);
});
test("target not queued exact claim returns none without fallback or browser", async () => {
  const targetRunId = "10000000-0000-4000-8000-0000000000f2";
  const d = deps({ claimRunByIdResult: null });
  const result = await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId, { targetRunId });
  assert.equal(result.kind, "target_unavailable");
  assert.equal(d.claims, 0);
  assert.equal(d.runtime.opened, 0);
});
test("target exact claim succeeds and processes returned target", async () => {
  const targetRunId = "10000000-0000-4000-8000-0000000000f3";
  const d = deps({ ctx: context({ run: { id: targetRunId } }) });
  const result = await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId, { targetRunId });
  assert.equal(d.claims, 0);
  assert.equal(d.targetClaims, 1);
  assert.deepEqual(d.loadedRunIds, [targetRunId]);
  assert.notEqual(result.kind, "empty");
  assert.notEqual(result.kind, "target_unavailable");
  if ("run" in result) assert.equal(result.run.id, targetRunId);
});
test("targeted invocation ignores another queued run", async () => {
  const targetRunId = "10000000-0000-4000-8000-0000000000f4";
  const otherQueuedRun = rowRun({ id: "10000000-0000-4000-8000-0000000000f5", state: "queued" });
  const d = deps({ ctx: context({ run: { id: targetRunId } }), claimNextRunResult: otherQueuedRun });
  const result = await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId, { targetRunId });
  assert.equal(d.claims, 0);
  assert.equal(d.targetClaims, 1);
  assert.deepEqual(d.loadedRunIds, [targetRunId]);
  assert.notEqual(result.kind, "empty");
  assert.notEqual(result.kind, "target_unavailable");
  if ("run" in result) assert.equal(result.run.id, targetRunId);
});
test("targeted invocation processes max one run", async () => {
  const targetRunId = "10000000-0000-4000-8000-0000000000f6";
  const d = deps({ ctx: context({ run: { id: targetRunId } }) });
  await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId, { targetRunId });
  assert.equal(d.targetClaims, 1);
  assert.equal(d.claims, 0);
  assert.equal(d.runtime.opened, 1);
  assert.deepEqual(d.loadedRunIds, [targetRunId]);
});
test("targetRunId does not enable real submission when disabled", () => expectRealSubmissionDisabled({ targetRunId: runId, allowRealSubmission: false }));
test("targetRunId with real submission true proceeds exact fake target without second claim", async () => {
  const d = deps();
  const result = await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId, { targetRunId: runId, allowRealSubmission: true });
  assert.equal(result.kind, "submission_confirmed");
  assert.equal(d.claims, 0);
  assert.equal(d.targetClaims, 1);
  assert.equal(d.confirmations, 1);
  assert.equal(d.runtime.opened, 1);
});
test("explicit split identity reaches mapping preview without split-name blocker", async () => {
  const page = new FakePage();
  page.forms = [discoveredSplitNameContactForm()];
  const d = deps({ page, ctx: context({ approval: { sender_name: "Test Sender", sender_first_name: "Test", sender_last_name: "Sender" } }) });
  const result = await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId);
  assert.equal(result.kind, "blocked");
  assert.equal(d.transitions.map((transition) => transition.state).includes("mapped"), true);
  const metadata = JSON.stringify(d.transitions.find((transition) => transition.state === "mapped")?.metadata ?? {});
  assert.match(metadata, /sender_first_name/);
  assert.match(metadata, /sender_last_name/);
  assert.doesNotMatch(metadata, /required_split_sender_name|Test Sender|ops@norixo/);
});
test("HTTP rejection", () => expectUrl("http://forms.example/contact", false));
test("unsupported protocol rejection", () => expectUrl("ftp://forms.example/contact", false));
test("URL credentials rejection", () => expectUrl("https://user:pass@forms.example/contact", false));
test("localhost rejection", () => expectUrl("https://localhost/contact", false));
test("private IPv4 rejection", () => expectUrl("https://10.0.0.1/contact", false));
test("link-local rejection", () => expectUrl("https://169.254.10.20/contact", false));
test("private/reserved IPv6 rejection", () => expectUrl("https://[fc00::1]/contact", false));
test("public IP literal rejected by policy", () => expectUrl("https://93.184.216.34/contact", false));
test("mixed public/private DNS rejection", () => expectUrl("https://forms.example/contact", false, resolver([{ address: "93.184.216.34", family: 4 }, { address: "10.0.0.2", family: 4 }])));
test("DNS failure", () => expectUrl("https://forms.example/contact", false, resolver(new Error("ENOTFOUND"))));
test("safe redirect", async () => {
  const page = new FakePage();
  page.requests = [
    { url: "https://forms.example/contact", method: "GET", resourceType: "document", isNavigationRequest: true },
    { url: "https://forms.example/contact-us", method: "GET", resourceType: "document", isNavigationRequest: true },
  ];
  const d = deps({ page });
  const result = await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId);
  assert.equal(result.kind, "blocked");
  if (result.kind === "blocked") {
    assert.equal(result.state, "manual_review");
    assert.equal(result.safeErrorCode, "CONTACT_FORM_REAL_SUBMISSION_DISABLED");
  }
  assert.equal(d.transitions.find((transition) => transition.state === "discovered")?.finalUrl, "https://forms.example/contact-us");
});
test("private redirect rejection", async () => {
  const page = new FakePage();
  page.requests = [
    { url: "https://forms.example/contact", method: "GET", resourceType: "document", isNavigationRequest: true },
    { url: "https://10.0.0.1/private", method: "GET", resourceType: "document", isNavigationRequest: true },
  ];
  const d = deps({ page });
  const result = await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId);
  assert.equal(result.kind, "blocked");
  assert.equal(result.state, "blocked_policy");
});
test("HTTPS to HTTP redirect rejection", async () => {
  const page = new FakePage();
  page.requests = [
    { url: "https://forms.example/contact", method: "GET", resourceType: "document", isNavigationRequest: true },
    { url: "http://forms.example/contact", method: "GET", resourceType: "document", isNavigationRequest: true },
  ];
  const d = deps({ page });
  const result = await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId);
  assert.equal(result.kind, "blocked");
  assert.equal(result.state, "blocked_policy");
});
test("redirect limit", async () => {
  const page = new FakePage();
  page.requests = [
    { url: "https://forms.example/1", method: "GET", resourceType: "document", isNavigationRequest: true },
    { url: "https://forms.example/2", method: "GET", resourceType: "document", isNavigationRequest: true },
    { url: "https://forms.example/3", method: "GET", resourceType: "document", isNavigationRequest: true },
  ];
  const d = deps({ page });
  const result = await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId, { redirectLimit: 1 });
  assert.equal(result.kind, "blocked");
  assert.equal(d.transitions.at(-1)?.safeErrorCode, "CONTACT_FORM_REDIRECT_LIMIT_EXCEEDED");
});
test("isolated contexts", async () => {
  const d1 = deps();
  const d2 = deps({ ctx: context({ run: { id: "10000000-0000-4000-8000-000000000009" } }) });
  await executeContactFormNavigationWorkerOnceWithDependencies(d1, workerId);
  await executeContactFormNavigationWorkerOnceWithDependencies(d2, workerId);
  assert.equal(d1.runtime.opened, 1);
  assert.equal(d2.runtime.opened, 1);
});
test("no cookie/storage reuse", async () => {
  const d = deps();
  await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId);
  assert.equal(d.runtime.opened, 1);
  assert.equal(d.runtime.closed, 1);
});
test("background POST blocked", async () => {
  const page = new FakePage();
  page.requests = [
    { url: "https://forms.example/contact", method: "GET", resourceType: "document", isNavigationRequest: true },
    { url: "https://forms.example/track", method: "POST", resourceType: "fetch", isNavigationRequest: false },
  ];
  const d = deps({ page });
  const result = await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId);
  assert.equal(result.kind, "blocked");
  assert.equal(d.transitions.at(-1)?.safeErrorCode, "CONTACT_FORM_TARGET_MUTATION_BLOCKED");
});
for (const method of ["PUT", "PATCH", "DELETE"]) {
  test(`${method} blocked`, async () => {
    const page = new FakePage();
    page.requests = [
      { url: "https://forms.example/contact", method: "GET", resourceType: "document", isNavigationRequest: true },
      { url: "https://forms.example/api", method, resourceType: "fetch", isNavigationRequest: false },
    ];
    const d = deps({ page });
    const result = await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId);
    assert.equal(result.kind, "blocked");
    assert.equal(d.transitions.at(-1)?.safeErrorCode, "CONTACT_FORM_TARGET_MUTATION_BLOCKED");
  });
}
test("GET navigation allowed", async () => {
  const d = deps();
  const result = await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId, { allowRealSubmission: true });
  assert.equal(result.kind, "submission_confirmed");
});
test("form metadata inspection precedes controlled submit", async () => {
  const page = new FakePage();
  const d = deps({ page });
  const result = await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId, { allowRealSubmission: true });
  assert.equal(result.kind, "submission_confirmed");
  assert.equal(result.metadata.formCount, 1);
  assert.equal(page.submitted, true);
  assert.equal(page.clickCount, 1);
});
test("no alternate submit primitives in worker source", () => {
  const worker = readFileSync(join(process.cwd(), "lib/backlinks/services/contactFormNavigationWorker.ts"), "utf8");
  const submission = readFileSync(join(process.cwd(), "lib/backlinks/services/contactFormSubmission.ts"), "utf8");
  assert.doesNotMatch(`${worker}\n${submission}`, /\.type\(|press\(|requestSubmit|form\.submit|dispatchEvent|SubmitEvent|backlink_outreach_attempts/);
});
test("real submission env helper requires exact true", () => {
  assert.equal(isContactFormRealSubmissionEnabled({}), false);
  assert.equal(isContactFormRealSubmissionEnabled({ CONTACT_FORM_REAL_SUBMISSION_ENABLED: "false" }), false);
  assert.equal(isContactFormRealSubmissionEnabled({ CONTACT_FORM_REAL_SUBMISSION_ENABLED: "TRUE" }), false);
  assert.equal(isContactFormRealSubmissionEnabled({ CONTACT_FORM_REAL_SUBMISSION_ENABLED: "1" }), false);
  assert.equal(isContactFormRealSubmissionEnabled({ CONTACT_FORM_REAL_SUBMISSION_ENABLED: "true" }), true);
});
test("mapped contact form defaults to manual review when real submission is omitted", () => expectRealSubmissionDisabled());
test("mapped contact form stays manual review when real submission is false", () => expectRealSubmissionDisabled({ allowRealSubmission: false }));
test("CLI real submission opt-in is independent from worker enabled flag", () => {
  const cli = readFileSync(join(process.cwd(), "scripts/contact-form-navigation-worker.ts"), "utf8");
  const worker = readFileSync(join(process.cwd(), "lib/backlinks/services/contactFormNavigationWorker.ts"), "utf8");
  assert.match(cli, /isContactFormNavigationWorkerEnabled\(\)/);
  assert.match(cli, /allowRealSubmission:\s*isContactFormRealSubmissionEnabled\(\)/);
  assert.match(cli, /CONTACT_FORM_TARGET_RUN_ID/);
  assert.match(cli, /targetRunId:\s*readTargetRunId\(\)/);
  assert.match(worker, /CONTACT_FORM_REAL_SUBMISSION_ENABLED/);
  assert.doesNotMatch(cli, /allowRealSubmission:\s*isContactFormNavigationWorkerEnabled\(\)/);
  assert.doesNotMatch(cli, /allowRealSubmission:\s*true/);
});
test("target run id never enables real submission", () => {
  const cli = readFileSync(join(process.cwd(), "scripts/contact-form-navigation-worker.ts"), "utf8");
  const worker = readFileSync(join(process.cwd(), "lib/backlinks/services/contactFormNavigationWorker.ts"), "utf8");
  assert.match(worker, /targetRunId\?:\s*string/);
  assert.doesNotMatch(`${cli}\n${worker}`, /CONTACT_FORM_TARGET_RUN_ID[\s\S]{0,240}allowRealSubmission:\s*true/);
});
test("CAPTCHA classification only", async () => {
  const page = new FakePage();
  page.signals = { hasCaptcha: true, hasLoginWall: false, hasPasswordField: false };
  const d = deps({ page });
  const result = await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId);
  assert.equal(result.kind, "blocked");
  assert.equal(result.state, "blocked_captcha");
});
test("login wall to manual review", async () => {
  const page = new FakePage();
  page.signals = { hasCaptcha: false, hasLoginWall: true, hasPasswordField: true };
  const d = deps({ page });
  const result = await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId);
  assert.equal(result.kind, "blocked");
  assert.equal(result.state, "manual_review");
});
test("navigation timeout", async () => {
  const page = new FakePage();
  page.throwOnGoto = new Error("Timeout 15000ms exceeded");
  const d = deps({ page });
  const result = await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId);
  assert.equal(result.kind, "blocked");
  assert.equal(result.state, "failed_pre_submit");
  assert.equal(result.safeErrorCode, "CONTACT_FORM_NAVIGATION_TIMEOUT");
});
test("lease loss", async () => {
  const page = new FakePage();
  const d = deps({ page, heartbeatError: new Error("CONTACT_FORM_RUN_LEASE_LOST") });
  const result = await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId);
  assert.equal(result.kind, "lease_lost");
  assert.equal(page.url(), "about:blank");
});
test("stale approval", async () => {
  const d = deps({ ctx: context({ approval: { content_fingerprint: "cf1_0000000000000000000000000000000000000000000000000000000000000000" } }) });
  const result = await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId);
  assert.equal(result.kind, "blocked");
  assert.equal(result.state, "manual_review");
  assert.equal(d.transitions.at(-1)?.eventType, "approval_revalidation_failed");
});
test("DNC race", async () => {
  const d = deps({ ctx: context({ contact: { contact_status: "do_not_contact", do_not_contact_at: now } }) });
  const result = await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId);
  assert.equal(result.kind, "blocked");
  assert.equal(result.state, "manual_review");
  assert.equal(d.transitions.at(-1)?.eventType, "dnc_revalidation_failed");
});
test("successful C5 progression preserves ordered C3/C4/C5 states", async () => {
  const d = deps();
  const result = await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId, { allowRealSubmission: true });
  assert.equal(result.kind, "submission_confirmed");
  assert.deepEqual(d.transitions.map((transition) => transition.state), ["navigating", "discovered", "mapped", "filled", "pre_submit_validated", "submitting"]);
  assert.equal(d.confirmations, 1);
});
for (const requiredState of ["filled", "pre_submit_validated", "submitting"] as const) {
  test(`C5 reaches ${requiredState} before confirmation RPC`, async () => {
    const d = deps();
    await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId, { allowRealSubmission: true });
    assert.equal(d.transitions.some((transition) => transition.state === requiredState), true);
  });
}
test("accepted initial attempt is delegated to confirmation RPC only", async () => {
  const d = deps();
  await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId, { allowRealSubmission: true });
  assert.equal(d.confirmations, 1);
  assert.equal(d.transitions.some((transition) => transition.eventType === "submission_confirmed"), false);
});
test("no outreach activation", () => {
  const source = readFileSync(join(process.cwd(), "lib/backlinks/services/contactFormNavigationWorker.ts"), "utf8");
  assert.doesNotMatch(source, /status\s*=\s*['"]active|current_attempt\s*=\s*1|activate/i);
});
test("no automatic retry", () => {
  const source = readFileSync(join(process.cwd(), "lib/backlinks/services/contactFormNavigationWorker.ts"), "utf8");
  assert.doesNotMatch(source, /retryContactFormPreSubmitRun|retry_backlink_contact_form_pre_submit/i);
});
test("safe redacted evidence", async () => {
  const d = deps();
  await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId, { allowRealSubmission: true });
  const metadata = JSON.stringify(d.transitions.at(-1)?.metadata ?? {});
  assert.match(metadata, /full_html_persisted/);
  assert.doesNotMatch(metadata, /Approved body|<html|ops@norixo/);
});
test("popup policy", async () => {
  const page = new FakePage();
  const d = deps({ page });
  const runPromise = executeContactFormNavigationWorkerOnceWithDependencies(d, workerId);
  await runPromise;
  page.popupHandler?.();
  assert.ok(page.popupHandler);
});
test("cleanup success", async () => {
  const d = deps();
  const result = await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId);
  assert.notEqual(result.kind, "empty");
  assert.notEqual(result.kind, "target_unavailable");
  if (result.kind !== "empty" && result.kind !== "target_unavailable") assert.equal(result.cleanup, "success");
  assert.equal(d.runtime.closed, 1);
});
test("cleanup failure", async () => {
  const d = deps({ closeFailure: true });
  const result = await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId);
  assert.notEqual(result.kind, "empty");
  assert.notEqual(result.kind, "target_unavailable");
  if (result.kind !== "empty" && result.kind !== "target_unavailable") assert.equal(result.cleanup, "failed");
});
test("concurrency equals one claimed run per execution", async () => {
  const d = deps();
  await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId);
  assert.equal(d.claims, 1);
});
test("worker default disabled", () => {
  assert.equal(isContactFormNavigationWorkerEnabled({}), false);
  assert.equal(isContactFormNavigationWorkerEnabled({ CONTACT_FORM_NAVIGATION_WORKER_ENABLED: "true" }), true);
});
test("unsafe IP classifier rejects internal ranges", () => {
  for (const address of ["127.0.0.1", "10.0.0.1", "172.16.0.1", "192.168.1.1", "169.254.1.1", "::1", "fc00::1", "fe80::1", "2001:db8::1"]) assert.equal(isPublicIpAddress(address), false, address);
  assert.equal(isPublicIpAddress("93.184.216.34"), true);
  assert.equal(isPublicIpAddress("2606:2800:220:1:248:1893:25c8:1946"), true);
});

async function main() {
  let passed = 0;
  for (const current of tests) {
    await current.run();
    passed += 1;
  }
  console.log(`contact-form navigation worker tests passed: ${passed}/${tests.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
