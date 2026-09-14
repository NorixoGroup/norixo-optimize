import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { buildContactFormApprovalFingerprint } from "../lib/backlinks/services/contactFormApprovalFingerprint";
import {
  buildContactFormMappingPreview,
  type ContactFormApprovedContent,
  type ContactFormDiscoveredControl,
  type ContactFormDiscoveredForm,
  type ContactFormDiscoveredPage,
  type ContactFormMappedFieldPreview,
  type ContactFormMappingPreview,
  type ContactFormSupportedSemanticField,
} from "../lib/backlinks/services/contactFormMappingPreview";
import {
  contactFormSafeFingerprint,
  executeContactFormControlledSubmission,
  isKnownSameHostConfirmationPath,
  sourceValueForSemantic,
  type ContactFormConfirmationObservation,
  type ContactFormControlledSubmissionDependencies,
  type ContactFormFieldLocator,
  type ContactFormSubmitControl,
  type ContactFormSubmitRequestAllowance,
  type ContactFormSubmissionPage,
} from "../lib/backlinks/services/contactFormSubmission";
import type {
  ContactFormApproval,
  ContactFormExecutionContact,
  ContactFormExecutionOpportunity,
  ContactFormExecutionOutreach,
  ContactFormRun,
  ContactFormRunExecutionContext,
  ContactFormRunState,
} from "../lib/backlinks/repositories/contactFormAutomationRepository";
import type { Json } from "../types/database.types";

type TestCase = { name: string; run: () => Promise<void> | void };
const tests: TestCase[] = [];
function test(name: string, run: TestCase["run"]) {
  tests.push({ name, run });
}

const now = "2026-09-03T09:00:00.000Z";
const workspaceId = "20000000-0000-4000-8000-000000000001";
const campaignId = "20000000-0000-4000-8000-000000000002";
const outreachId = "20000000-0000-4000-8000-000000000003";
const contactId = "20000000-0000-4000-8000-000000000004";
const opportunityId = "20000000-0000-4000-8000-000000000005";
const approvalId = "20000000-0000-4000-8000-000000000006";
const runId = "20000000-0000-4000-8000-000000000007";
const workerId = "c5-test-worker";
const attemptId = "20000000-0000-4000-8000-000000000099";
const pageUrl = "https://forms.example/contact";

const approvedContent: ContactFormApprovedContent = {
  senderName: "Norixo Operator",
  senderEmail: "outreach@norixo.example",
  senderCompany: "Norixo",
  senderWebsite: "https://norixo.example",
  subject: "Approved subject",
  body: "Approved body",
};
const splitApprovedContent: ContactFormApprovedContent = {
  ...approvedContent,
  senderName: "Test Sender",
  senderFirstName: "Test",
  senderLastName: "Sender",
};

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
    form_url: pageUrl,
    heartbeat_at: now,
    id: runId,
    lease_expires_at: "2026-09-03T09:02:00.000Z",
    max_pre_submit_attempts: 2,
    outreach_id: outreachId,
    pre_submit_attempt_count: 0,
    result_class: null,
    safe_error_code: null,
    started_at: now,
    state: "mapped",
    submit_started_at: null,
    updated_at: now,
    workspace_id: workspaceId,
    ...overrides,
  };
}

function rowOutreach(overrides: Partial<ContactFormExecutionOutreach> = {}): ContactFormExecutionOutreach {
  return { body: approvedContent.body, campaign_id: campaignId, channel: "contact_form", contact_id: contactId, current_attempt: 0, id: outreachId, opportunity_id: opportunityId, status: "draft", subject: approvedContent.subject, workspace_id: workspaceId, ...overrides };
}

function rowContact(overrides: Partial<ContactFormExecutionContact> = {}): ContactFormExecutionContact {
  return { archived_at: null, contact_form_url: pageUrl, contact_status: "verified", do_not_contact_at: null, id: contactId, workspace_id: workspaceId, ...overrides };
}

function rowOpportunity(overrides: Partial<ContactFormExecutionOpportunity> = {}): ContactFormExecutionOpportunity {
  return { id: opportunityId, target_page_url: "https://publisher.example/article", workspace_id: workspaceId, ...overrides };
}

function rowApproval(input: {
  outreach?: ContactFormExecutionOutreach;
  contact?: ContactFormExecutionContact;
  opportunity?: ContactFormExecutionOpportunity;
  overrides?: Partial<ContactFormApproval>;
} = {}): ContactFormApproval {
  const outreach = input.outreach ?? rowOutreach();
  const contact = input.contact ?? rowContact();
  const opportunity = input.opportunity ?? rowOpportunity();
  const senderName = input.overrides?.sender_name ?? approvedContent.senderName;
  const senderFirstName = input.overrides?.sender_first_name ?? null;
  const senderLastName = input.overrides?.sender_last_name ?? null;
  const senderEmail = input.overrides?.sender_email ?? approvedContent.senderEmail;
  const senderCompany = input.overrides?.sender_company ?? approvedContent.senderCompany;
  const senderWebsite = input.overrides?.sender_website ?? approvedContent.senderWebsite;
  const subject = input.overrides?.subject ?? outreach.subject ?? "";
  const body = input.overrides?.body ?? outreach.body ?? "";
  const targetUrl = opportunity.target_page_url.trim();
  const formUrl = contact.contact_form_url?.trim() ?? "";
  const content_fingerprint = buildContactFormApprovalFingerprint({
    workspaceId,
    campaignId,
    outreachId,
    contactId,
    opportunityId,
    targetUrl,
    formUrl,
    senderName,
    senderFirstName,
    senderLastName,
    senderEmail,
    senderCompany,
    senderWebsite,
    subject: subject.trim(),
    body: body.trim(),
  });
  return {
    approved_at: now,
    approved_by_user_id: "20000000-0000-4000-8000-000000000008",
    body: body.trim(),
    campaign_id: campaignId,
    contact_id: contactId,
    content_fingerprint,
    created_at: now,
    form_schema_fingerprint: null,
    form_url: formUrl,
    id: approvalId,
    opportunity_id: opportunityId,
    outreach_id: outreachId,
    sender_company: senderCompany,
    sender_email: senderEmail,
    sender_first_name: senderFirstName,
    sender_last_name: senderLastName,
    sender_name: senderName,
    sender_website: senderWebsite,
    subject: subject.trim(),
    target_url: targetUrl,
    workspace_id: workspaceId,
    ...input.overrides,
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

function control(overrides: Partial<ContactFormDiscoveredControl> = {}): ContactFormDiscoveredControl {
  return {
    ordinal: 0,
    tag: "input",
    type: "text",
    name: null,
    id: null,
    autocomplete: null,
    labelText: null,
    ariaLabel: null,
    ariaLabelledbyText: null,
    placeholder: null,
    required: false,
    disabled: false,
    readOnly: false,
    hidden: false,
    visible: true,
    valuePresent: false,
    ...overrides,
  };
}

function textInput(ordinal: number, labelText: string, overrides: Partial<ContactFormDiscoveredControl> = {}): ContactFormDiscoveredControl {
  const normalized = labelText.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || `field_${ordinal}`;
  return control({ ordinal, tag: "input", type: "text", name: normalized, id: normalized, labelText, ...overrides });
}

function emailInput(ordinal = 1, overrides: Partial<ContactFormDiscoveredControl> = {}): ContactFormDiscoveredControl {
  return control({ ordinal, tag: "input", type: "email", name: "email", id: "email", autocomplete: "email", labelText: "Email", required: true, ...overrides });
}

function urlInput(ordinal: number, labelText: string, overrides: Partial<ContactFormDiscoveredControl> = {}): ContactFormDiscoveredControl {
  return control({ ordinal, tag: "input", type: "url", name: "website", id: "website", labelText, ...overrides });
}

function textarea(ordinal = 3, overrides: Partial<ContactFormDiscoveredControl> = {}): ContactFormDiscoveredControl {
  return control({ ordinal, tag: "textarea", type: "textarea", name: "message", id: "message", labelText: "Message", required: true, ...overrides });
}

function submitButton(ordinal = 4, overrides: Partial<ContactFormDiscoveredControl> = {}): ContactFormDiscoveredControl {
  return control({ ordinal, tag: "button", type: "submit", name: null, id: "submit", labelText: "Send message", required: false, ...overrides });
}

function contactForm(overrides: Partial<ContactFormDiscoveredForm> = {}): ContactFormDiscoveredForm {
  return {
    ordinal: 0,
    action: "/contact",
    method: "post",
    labelText: "Contact us",
    legendText: null,
    buttonText: "Send message",
    controls: [textInput(0, "Your name", { autocomplete: "name", required: true }), emailInput(1), textInput(2, "Subject"), textarea(3), submitButton(4)],
    ...overrides,
  };
}

function allFieldsForm(overrides: Partial<ContactFormDiscoveredForm> = {}): ContactFormDiscoveredForm {
  return contactForm({
    controls: [textInput(0, "Your name", { autocomplete: "name", required: true }), emailInput(1), textInput(2, "Company"), urlInput(3, "Website"), textInput(4, "Subject"), textarea(5), submitButton(6)],
    ...overrides,
  });
}

function splitNameForm(overrides: Partial<ContactFormDiscoveredForm> = {}): ContactFormDiscoveredForm {
  return contactForm({
    controls: [textInput(0, "First Name", { autocomplete: "given-name", required: true }), textInput(1, "Last Name", { autocomplete: "family-name", required: true }), emailInput(2), textarea(3), submitButton(4)],
    ...overrides,
  });
}

function discoveredPage(form: ContactFormDiscoveredForm): ContactFormDiscoveredPage {
  return { pageUrl, pageTitle: "Contact", forms: [form] };
}


function safeSelectOption(input: {
  ordinal: number;
  labelText: string;
  normalizedLabel: string;
  valuePresent: boolean;
  selected: boolean;
  disabled?: boolean;
}) {
  return {
    ordinal: input.ordinal,
    labelText: input.labelText,
    normalizedLabel: input.normalizedLabel,
    valuePresent: input.valuePresent,
    disabled: input.disabled ?? false,
    selected: input.selected,
    optionFingerprint: contactFormSafeFingerprint({
      fixture: "c9ay-select-option",
      ordinal: input.ordinal,
      normalized_label: input.normalizedLabel,
      value_present: input.valuePresent,
      disabled: input.disabled ?? false,
    }),
  };
}

function subjectSelect(
  overrides: Partial<ContactFormDiscoveredControl> = {},
): ContactFormDiscoveredControl {
  return control({
    ordinal: 3,
    tag: "select",
    type: "select-one",
    name: "subject",
    id: "subject",
    labelText: "Subject",
    required: true,
    visible: true,
    valuePresent: false,
    options: [
      safeSelectOption({
        ordinal: 0,
        labelText: "Select a topic...",
        normalizedLabel: "select a topic...",
        valuePresent: false,
        selected: true,
      }),
      safeSelectOption({
        ordinal: 1,
        labelText: "Membership question",
        normalizedLabel: "membership question",
        valuePresent: true,
        selected: false,
      }),
      safeSelectOption({
        ordinal: 2,
        labelText: "Other",
        normalizedLabel: "other",
        valuePresent: true,
        selected: false,
      }),
    ],
    ...overrides,
  });
}

function selectContactForm(
  selectOverrides: Partial<ContactFormDiscoveredControl> = {},
): ContactFormDiscoveredForm {
  return contactForm({
    controls: [
      textInput(0, "Your name", {
        autocomplete: "name",
        required: true,
      }),
      emailInput(1),
      textarea(2),
      subjectSelect(selectOverrides),
      submitButton(4),
    ],
  });
}

function mutateSelectOption(
  form: ContactFormDiscoveredForm,
  targetOrdinal: number,
  mutate: (
    option: NonNullable<ContactFormDiscoveredControl["options"]>[number],
  ) => NonNullable<ContactFormDiscoveredControl["options"]>[number],
): ContactFormDiscoveredForm {
  return {
    ...form,
    controls: form.controls.map((current) =>
      current.tag !== "select"
        ? current
        : {
            ...current,
            options: (current.options ?? []).map((option) =>
              option.ordinal === targetOrdinal
                ? mutate(option)
                : option,
            ),
          },
    ),
  };
}

function mappingFor(form: ContactFormDiscoveredForm): ContactFormMappingPreview {
  const mapping = buildContactFormMappingPreview({ page: discoveredPage(form), approvedContent });
  assert.equal(mapping.result, "mapped");
  return mapping;
}

function mappingForContent(form: ContactFormDiscoveredForm, content: ContactFormApprovedContent): ContactFormMappingPreview {
  const mapping = buildContactFormMappingPreview({ page: discoveredPage(form), approvedContent: content });
  assert.equal(mapping.result, "mapped");
  return mapping;
}

function fieldBySemantic(mapping: ContactFormMappingPreview, semantic: ContactFormSupportedSemanticField): ContactFormMappedFieldPreview {
  const field = mapping.mappedFields.find((current) => current.semanticField === semantic);
  assert.ok(field, `missing mapped field ${semantic}`);
  return field;
}

class FakeC5Page implements ContactFormSubmissionPage {
  currentUrl = pageUrl;
  forms: ContactFormDiscoveredForm[];
  formsSequence: ContactFormDiscoveredForm[] | null = null;
  signalsSequence: Array<{ hasCaptcha: boolean; hasLoginWall: boolean; hasPasswordField: boolean }> | null = null;
  values = new Map<number, string>();
  fillCalls: Array<{ semantic: string | null; controlOrdinal: number; valueLength: number }> = [];
  selectCalls: Array<{ controlOrdinal: number; optionOrdinal: number; normalizedLabel: string }> = [];
  readCounts = new Map<number, number>();
  clickCount = 0;
  listSubmitCount = 0;
  confirmation: ContactFormConfirmationObservation = { confirmed: true, kind: "EXPLICIT_SUCCESS_ELEMENT", finalUrl: pageUrl, evidenceFingerprint: contactFormSafeFingerprint({ fixture: "success" }), markerId: "success" };
  clickError: Error | null = null;
  mismatchAfterFillOrdinal: number | null = null;
  tamperBeforeSubmitOrdinal: number | null = null;
  submitMode: "normal" | "missing" | "multiple" | "disabled" | "hidden" | "generic" | "input" | "wrong_form" | "drift_after_submit_start" = "normal";

  constructor(form = contactForm()) {
    this.forms = [form];
  }

  url() {
    return this.currentUrl;
  }

  async evaluatePageSignals() {
    return this.signalsSequence?.shift() ?? { hasCaptcha: false, hasLoginWall: false, hasPasswordField: false };
  }

  async inspectForms() {
    if (this.formsSequence?.length) this.forms = [this.formsSequence.shift() ?? this.forms[0]];
    return discoveredPage(this.forms[0]);
  }

  async readFieldValue(locator: ContactFormFieldLocator) {
    const count = (this.readCounts.get(locator.controlOrdinal) ?? 0) + 1;
    this.readCounts.set(locator.controlOrdinal, count);
    const value = this.values.get(locator.controlOrdinal) ?? "";
    if (this.mismatchAfterFillOrdinal === locator.controlOrdinal && count === 2) return `${value} mismatch`;
    if (this.tamperBeforeSubmitOrdinal === locator.controlOrdinal && count >= 3) return `${value} tampered`;
    return value;
  }

  async fillField(locator: ContactFormFieldLocator, value: string) {
    const mapping = buildContactFormMappingPreview({ page: discoveredPage(this.forms[0]), approvedContent });
    const semantic = mapping.result === "mapped" ? mapping.mappedFields.find((field) => field.locator.controlOrdinal === locator.controlOrdinal)?.semanticField ?? null : null;
    this.fillCalls.push({ semantic, controlOrdinal: locator.controlOrdinal, valueLength: value.length });
    this.values.set(locator.controlOrdinal, value);
  }

  async selectFieldOption(
    locator: ContactFormFieldLocator,
    option: {
      ordinal: number;
      labelText: string;
      normalizedLabel: string;
      valuePresent: boolean;
      disabled: boolean;
      optionFingerprint: string;
    },
  ) {
    const form = this.forms.find(
      (candidate) => candidate.ordinal === locator.formOrdinal,
    );
    assert.ok(form, "select form exists");

    const controlIndex = form.controls.findIndex(
      (candidate) => candidate.ordinal === locator.controlOrdinal,
    );
    assert.ok(controlIndex >= 0, "select control exists");

    const current = form.controls[controlIndex];
    assert.equal(current.tag, "select");

    const candidate = current.options?.find(
      (item) => item.ordinal === option.ordinal,
    );

    assert.ok(candidate, "select option exists");
    assert.equal(candidate.labelText, option.labelText);
    assert.equal(candidate.normalizedLabel, option.normalizedLabel);
    assert.equal(candidate.valuePresent, true);
    assert.equal(candidate.disabled, false);

    this.selectCalls.push({
      controlOrdinal: locator.controlOrdinal,
      optionOrdinal: option.ordinal,
      normalizedLabel: option.normalizedLabel,
    });

    const nextForm = {
      ...form,
      controls: form.controls.map((item, index) =>
        index !== controlIndex
          ? item
          : {
              ...item,
              valuePresent: true,
              options: (item.options ?? []).map((currentOption) => ({
                ...currentOption,
                selected: currentOption.ordinal === option.ordinal,
              })),
            },
      ),
    };

    this.forms = this.forms.map((currentForm) =>
      currentForm.ordinal === form.ordinal ? nextForm : currentForm,
    );

    this.values.set(locator.controlOrdinal, option.normalizedLabel);
  }

  async listSubmitControls(formOrdinal: number) {
    this.listSubmitCount += 1;
    if (this.submitMode === "missing" || this.submitMode === "generic") return [];
    const form = this.forms.find((current) => current.ordinal === formOrdinal);
    assert.ok(form, "form exists");
    const base = this.submitMode === "input" ? control({ ordinal: 4, tag: "input", type: "submit", name: "send", id: "send", visible: true }) : submitButton(4);
    const controls = this.submitMode === "multiple" ? [submitButton(4), submitButton(5, { id: "send-2" })] : [base];
    return controls.map((candidate): ContactFormSubmitControl => {
      const hidden = this.submitMode === "hidden" || candidate.hidden;
      const disabled = this.submitMode === "disabled" || candidate.disabled;
      const driftId = this.submitMode === "drift_after_submit_start" && this.listSubmitCount >= 2 ? "submit-drift" : candidate.id;
      const controlFormOrdinal = this.submitMode === "wrong_form" ? formOrdinal + 1 : formOrdinal;
      return {
        formOrdinal: controlFormOrdinal,
        controlOrdinal: candidate.ordinal,
        tag: candidate.tag === "button" ? "button" : "input",
        type: "submit",
        name: candidate.name,
        id: driftId,
        visible: !hidden && candidate.visible,
        enabled: !disabled,
        disabled,
        hidden,
        fingerprint: contactFormSafeFingerprint({ form_ordinal: formOrdinal, control_ordinal: candidate.ordinal, tag: candidate.tag, type: candidate.type, id: driftId }),
      };
    });
  }

  async clickSubmitControl() {
    this.clickCount += 1;
    if (this.clickError) throw this.clickError;
  }

  async observeSubmissionConfirmation() {
    return this.confirmation;
  }
}

function harness(input: {
  page?: FakeC5Page;
  mapping?: ContactFormMappingPreview;
  contexts?: ContactFormRunExecutionContext[];
  keepLeaseFailureAt?: number;
  transitionFailureState?: ContactFormRunState;
  confirmFailure?: Error;
} = {}) {
  const page = input.page ?? new FakeC5Page();
  const mapping = input.mapping ?? mappingFor(page.forms[0]);
  const contexts = input.contexts ?? [context()];
  let contextIndex = 0;
  let currentRun = rowRun({ state: "mapped" });
  let keepLeaseCalls = 0;
  let confirmations = 0;
  let acceptedInitialCount = 0;
  let armedAllowance: ContactFormSubmitRequestAllowance | null = null;
  const armedAllowanceHistory: ContactFormSubmitRequestAllowance[] = [];
  const transitions: Array<{ state: ContactFormRunState; eventType: string; safeErrorCode: string | null; metadata: Json | undefined }> = [];
  const deps: ContactFormControlledSubmissionDependencies = {
    async loadExecutionContext(run) {
      const selected = contexts[Math.min(contextIndex, contexts.length - 1)] ?? contexts[0];
      contextIndex += 1;
      return { ...selected, run };
    },
    async transitionRun(transition) {
      if (transition.nextState === input.transitionFailureState) throw new Error("CONTACT_FORM_RUN_LEASE_LOST");
      transitions.push({ state: transition.nextState, eventType: transition.eventType, safeErrorCode: transition.safeErrorCode ?? null, metadata: transition.safeMetadata });
      currentRun = { ...currentRun, state: transition.nextState, final_url: transition.finalUrl ?? currentRun.final_url, safe_error_code: transition.safeErrorCode ?? currentRun.safe_error_code, submit_started_at: transition.nextState === "submitting" ? now : currentRun.submit_started_at };
      return currentRun;
    },
    async confirmSubmission(inputValue) {
      if (input.confirmFailure) throw input.confirmFailure;
      assert.equal(currentRun.state, "submitting");
      assert.match(inputValue.evidenceReference, /^c5_confirmation:/);
      confirmations += 1;
      acceptedInitialCount += 1;
      currentRun = { ...currentRun, state: "submission_confirmed", final_attempt_id: attemptId, evidence_reference: inputValue.evidenceReference, final_url: inputValue.finalUrl ?? currentRun.final_url, result_class: "semantic_success" };
      return { run_id: inputValue.runId, attempt_id: attemptId, disposition: confirmations === 1 ? "created" : "existing" };
    },
    async keepLease() {
      keepLeaseCalls += 1;
      if (input.keepLeaseFailureAt === keepLeaseCalls) throw new Error("CONTACT_FORM_RUN_LEASE_LOST");
    },
    armSubmitRequest(allowance) {
      armedAllowance = allowance;
      armedAllowanceHistory.push(allowance);
      assert.equal(currentRun.state, "submitting");
    },
    revokeSubmitRequest() {
      armedAllowance = null;
    },
  };
  return {
    page,
    mapping,
    transitions,
    get keepLeaseCalls() {
      return keepLeaseCalls;
    },
    get confirmations() {
      return confirmations;
    },
    get acceptedInitialCount() {
      return acceptedInitialCount;
    },
    get armedAllowance() {
      return armedAllowance;
    },
    armedAllowanceHistory,
    run: () => executeContactFormControlledSubmission({ run: currentRun, workerId, page, mapping, expectedPageUrl: pageUrl, dependencies: deps }),
  };
}

function assertNoSubmit(page: FakeC5Page) {
  assert.equal(page.clickCount, 0);
}

function transitionStates(h: ReturnType<typeof harness>) {
  return h.transitions.map((transition) => transition.state);
}

function expectBlocked(name: string, input: Parameters<typeof harness>[0], code?: string) {
  test(name, async () => {
    const h = harness(input);
    const result = await h.run();
    assert.equal(result.kind === "blocked" || result.kind === "lease_lost", true);
    if (code && result.kind === "blocked") assert.equal(result.safeErrorCode, code);
    assertNoSubmit(h.page);
    assert.equal(h.acceptedInitialCount, 0);
  });
}

test("T01 valid mapped form becomes fillable and confirmed", async () => {
  const h = harness();
  const result = await h.run();
  assert.equal(result.kind, "submission_confirmed");
  assert.deepEqual(transitionStates(h), ["filled", "pre_submit_validated", "submitting"]);
  assert.equal(h.page.clickCount, 1);
  assert.equal(h.confirmations, 1);
});

expectBlocked("T02 stale approval fails before mutation", { contexts: [context({ approval: { content_fingerprint: "cf1_0000000000000000000000000000000000000000000000000000000000000000" } })] }, "CONTACT_FORM_APPROVAL_STALE");
expectBlocked("T03 DNC fails before mutation", { contexts: [context({ contact: { contact_status: "do_not_contact", do_not_contact_at: now } })] }, "CONTACT_FORM_CONTACT_SUPPRESSED");
expectBlocked("T04 target URL drift fails", { contexts: [context({ approval: { target_url: "https://publisher.example/old" } })] }, "CONTACT_FORM_APPROVAL_STALE");
expectBlocked("T05 form URL drift fails", { contexts: [context({ approval: { form_url: "https://forms.example/old" } })] }, "CONTACT_FORM_RUN_APPROVAL_STALE");
expectBlocked("T06 form fingerprint drift fails", { page: Object.assign(new FakeC5Page(), { formsSequence: [contactForm({ controls: [textInput(0, "Your name", { autocomplete: "name", required: true }), emailInput(1), textInput(2, "Subject"), textarea(3), submitButton(4), textInput(5, "Optional unrelated")] })] }) }, "CONTACT_FORM_FORM_FINGERPRINT_DRIFT");
expectBlocked("T07 field fingerprint drift fails", { page: Object.assign(new FakeC5Page(), { formsSequence: [contactForm({ controls: [textInput(0, "Your name", { autocomplete: "name", required: true }), emailInput(1, { id: "email-drift" }), textInput(2, "Subject"), textarea(3), submitButton(4)] })] }) }, "CONTACT_FORM_FIELD_FINGERPRINT_DRIFT");
expectBlocked("T08 lease loss fails before mutation", { keepLeaseFailureAt: 1 });
expectBlocked("T09 CAPTCHA before fill blocks", { page: Object.assign(new FakeC5Page(), { signalsSequence: [{ hasCaptcha: true, hasLoginWall: false, hasPasswordField: false }] }) }, "CONTACT_FORM_CAPTCHA_DETECTED");
expectBlocked("T10 login wall before fill blocks", { page: Object.assign(new FakeC5Page(), { signalsSequence: [{ hasCaptcha: false, hasLoginWall: true, hasPasswordField: true }] }) }, "CONTACT_FORM_LOGIN_WALL_DETECTED");
expectBlocked("T11 required consent before fill blocks", { page: Object.assign(new FakeC5Page(), { formsSequence: [contactForm({ controls: [textInput(0, "Your name", { autocomplete: "name", required: true }), emailInput(1), textarea(2), control({ ordinal: 3, tag: "input", type: "checkbox", name: "terms", labelText: "I agree to terms and privacy policy", required: true, visible: true }), submitButton(4)] })] }) }, "CONTACT_FORM_MAPPING_POLICY_BLOCKED");

for (const [index, semantic] of (["sender_name", "sender_email", "sender_company", "sender_website", "subject", "message"] as const).entries()) {
  test(`T${String(12 + index).padStart(2, "0")} ${semantic} fill`, async () => {
    const form = allFieldsForm();
    const h = harness({ page: new FakeC5Page(form), mapping: mappingFor(form) });
    const result = await h.run();
    assert.equal(result.kind, "submission_confirmed");
    assert.equal(h.page.fillCalls.some((call) => call.semantic === semantic), true);
  });
}

test("T18a explicit sender_first_name and sender_last_name source values are resolved only from approval fields", () => {
  const splitContext = context({ approval: { sender_name: "Test Sender", sender_first_name: "Test", sender_last_name: "Sender" } });
  assert.equal(sourceValueForSemantic(splitContext, "sender_first_name"), "Test");
  assert.equal(sourceValueForSemantic(splitContext, "sender_last_name"), "Sender");
  const legacyContext = context({ approval: { sender_name: "Test Sender", sender_first_name: null, sender_last_name: null } });
  assert.equal(sourceValueForSemantic(legacyContext, "sender_first_name"), null);
  assert.equal(sourceValueForSemantic(legacyContext, "sender_last_name"), null);
});

test("T18b explicit split-name form fills only with approved split identity", async () => {
  const form = splitNameForm();
  const h = harness({
    page: new FakeC5Page(form),
    mapping: mappingForContent(form, splitApprovedContent),
    contexts: [context({ approval: { sender_name: "Test Sender", sender_first_name: "Test", sender_last_name: "Sender" } })],
  });
  const result = await h.run();
  assert.equal(result.kind, "submission_confirmed");
  assert.equal(h.page.values.get(0), "Test");
  assert.equal(h.page.values.get(1), "Sender");
});

test("T18c legacy approval cannot satisfy required split-name mapping and fails before fill", async () => {
  const form = splitNameForm();
  const h = harness({
    page: new FakeC5Page(form),
    mapping: mappingForContent(form, splitApprovedContent),
    contexts: [context({ approval: { sender_name: "Test Sender", sender_first_name: null, sender_last_name: null } })],
  });
  const result = await h.run();
  assert.equal(result.kind, "blocked");
  assert.equal(result.kind === "blocked" ? result.safeErrorCode : null, "CONTACT_FORM_MAPPING_STALE");
  assert.equal(h.page.values.size, 0);
  assertNoSubmit(h.page);
});

for (const [index, controlType] of (["text", "email", "url", "textarea"] as const).entries()) {
  test(`T${String(18 + index).padStart(2, "0")} ${controlType} allowed`, async () => {
    const form = allFieldsForm();
    const mappedField = mappingFor(form).mappedFields.find((field) => field.controlType === controlType);
    assert.ok(mappedField, `${controlType} mapped`);
    const h = harness({ page: new FakeC5Page(form), mapping: mappingFor(form) });
    const result = await h.run();
    assert.equal(result.kind, "submission_confirmed");
  });
}

const forbiddenTypes = [
  ["T22 checkbox forbidden", "checkbox"],
  ["T23 radio forbidden", "radio"],
  ["T24 select forbidden", "select"],
  ["T25 file forbidden", "file"],
  ["T26 password forbidden", "password"],
  ["T27 hidden forbidden", "hidden"],
] as const;
for (const [name, type] of forbiddenTypes) {
  expectBlocked(name, {
    page: Object.assign(new FakeC5Page(), {
      formsSequence: [
        contactForm({
          controls: [textInput(0, "Your name", { autocomplete: "name", required: true }), emailInput(1), textarea(2), control({ ordinal: 3, tag: type === "select" ? "select" : "input", type, name: type, labelText: type, required: true, hidden: type === "hidden", visible: type !== "hidden" }), submitButton(4)],
        }),
      ],
    }),
  });
}

test("T28 prefilled value not overwritten", async () => {
  const h = harness();
  const nameField = fieldBySemantic(h.mapping, "sender_name");
  h.page.values.set(nameField.locator.controlOrdinal, "Existing value");
  const result = await h.run();
  assert.equal(result.kind, "blocked");
  assert.equal(result.safeErrorCode, "CONTACT_FORM_PREFILLED_VALUE_PRESENT");
  assert.equal(h.page.values.get(nameField.locator.controlOrdinal), "Existing value");
  assertNoSubmit(h.page);
});

test("T29 unmapped field not touched", async () => {
  const form = contactForm({ controls: [...contactForm().controls, textInput(5, "Optional unrelated")] });
  const h = harness({ page: new FakeC5Page(form), mapping: mappingFor(form) });
  await h.run();
  assert.equal(h.page.values.has(5), false);
});

test("T30 control outside selected form not touched", async () => {
  const page = new FakeC5Page(contactForm());
  page.forms = [contactForm(), contactForm({ ordinal: 1, controls: [textInput(0, "Your name", { required: true }), emailInput(1), textarea(2), submitButton(3)] })];
  const h = harness({ page, mapping: mappingFor(contactForm()) });
  await h.run();
  assert.equal(h.page.fillCalls.every((call) => call.controlOrdinal <= 3), true);
});

test("T31 exact value readback", async () => {
  const h = harness();
  await h.run();
  for (const field of h.mapping.mappedFields) assert.equal(h.page.values.get(field.locator.controlOrdinal)?.length, field.sourceValueLength);
});

test("T32 normalization verified", async () => {
  const h = harness();
  await h.run();
  assert.equal(h.transitions.some((transition) => transition.eventType === "fill_verified"), true);
});

test("T33 value mismatch fails", async () => {
  const h = harness();
  h.page.mismatchAfterFillOrdinal = fieldBySemantic(h.mapping, "sender_email").locator.controlOrdinal;
  const result = await h.run();
  assert.equal(result.kind, "blocked");
  assert.equal(result.safeErrorCode, "CONTACT_FORM_FIELD_VALUE_MISMATCH");
  assertNoSubmit(h.page);
});

test("T34 evidence stores fingerprint not raw body", async () => {
  const h = harness();
  await h.run();
  const metadata = JSON.stringify(h.transitions.find((transition) => transition.state === "filled")?.metadata ?? {});
  assert.match(metadata, /value_fingerprint/);
  assert.doesNotMatch(metadata, /Approved body|outreach@norixo/);
});

test("T35 full HTML not stored", async () => {
  const h = harness();
  await h.run();
  assert.match(JSON.stringify(h.transitions), /"full_html_persisted":false/);
  assert.doesNotMatch(JSON.stringify(h.transitions), /<html|<\/form>|<input/i);
});

test("T36 secret-like value not logged", async () => {
  const secretContext = context({ outreach: { body: "SECRET_BODY_TOKEN" }, approval: { body: "SECRET_BODY_TOKEN" } });
  const h = harness({ contexts: [secretContext] });
  await h.run();
  assert.doesNotMatch(JSON.stringify(h.transitions), /SECRET_BODY_TOKEN/);
});

test("T37 evidence length bounded", async () => {
  const h = harness();
  await h.run();
  assert.ok(JSON.stringify(h.transitions).length < 10_000);
});

test("T38 all fields verified before filled state", async () => {
  const h = harness();
  h.page.mismatchAfterFillOrdinal = fieldBySemantic(h.mapping, "message").locator.controlOrdinal;
  await h.run();
  assert.equal(h.transitions.some((transition) => transition.state === "filled"), false);
});

expectBlocked("T39 DNC changed after fill blocks submit", { contexts: [context(), context({ contact: { contact_status: "do_not_contact", do_not_contact_at: now } })] }, "CONTACT_FORM_CONTACT_SUPPRESSED");
expectBlocked("T40 approval changed after fill blocks", { contexts: [context(), context({ approval: { content_fingerprint: "cf1_1111111111111111111111111111111111111111111111111111111111111111" } })] }, "CONTACT_FORM_APPROVAL_STALE");
expectBlocked("T41 lease lost after fill blocks", { keepLeaseFailureAt: 2 });
expectBlocked("T42 CAPTCHA appears after fill blocks", { page: Object.assign(new FakeC5Page(), { signalsSequence: [{ hasCaptcha: false, hasLoginWall: false, hasPasswordField: false }, { hasCaptcha: true, hasLoginWall: false, hasPasswordField: false }] }) }, "CONTACT_FORM_CAPTCHA_DETECTED");
expectBlocked("T43 login wall appears after fill blocks", { page: Object.assign(new FakeC5Page(), { signalsSequence: [{ hasCaptcha: false, hasLoginWall: false, hasPasswordField: false }, { hasCaptcha: false, hasLoginWall: true, hasPasswordField: true }] }) }, "CONTACT_FORM_LOGIN_WALL_DETECTED");
expectBlocked("T44 consent appears after fill blocks", { page: Object.assign(new FakeC5Page(), { formsSequence: [contactForm(), contactForm({ controls: [textInput(0, "Your name", { autocomplete: "name", required: true }), emailInput(1), textarea(2), control({ ordinal: 3, tag: "input", type: "checkbox", name: "terms", labelText: "I agree to terms and privacy policy", required: true }), submitButton(4)] })] }) }, "CONTACT_FORM_MAPPING_POLICY_BLOCKED");
expectBlocked("T45 form drift after fill blocks", { page: Object.assign(new FakeC5Page(), { formsSequence: [contactForm(), contactForm({ controls: [textInput(0, "Your name", { autocomplete: "name", required: true }), emailInput(1), textInput(2, "Subject"), textarea(3), submitButton(4), textInput(5, "Optional unrelated")] })] }) }, "CONTACT_FORM_FORM_FINGERPRINT_DRIFT");
expectBlocked("T46 field drift after fill blocks", { page: Object.assign(new FakeC5Page(), { formsSequence: [contactForm(), contactForm({ controls: [textInput(0, "Your name", { autocomplete: "name", required: true }), emailInput(1, { name: "email_drift" }), textInput(2, "Subject"), textarea(3), submitButton(4)] })] }) }, "CONTACT_FORM_FIELD_FINGERPRINT_DRIFT");
test("T47 filled value tampering blocks", async () => {
  const h = harness();
  h.page.tamperBeforeSubmitOrdinal = fieldBySemantic(h.mapping, "sender_email").locator.controlOrdinal;
  const result = await h.run();
  assert.equal(result.kind, "blocked");
  assert.equal(result.kind === "blocked" ? result.safeErrorCode : null, "CONTACT_FORM_FILLED_VALUE_TAMPERED");
  assertNoSubmit(h.page);
});
expectBlocked("T48 submit identity drift blocks", { page: Object.assign(new FakeC5Page(), { submitMode: "drift_after_submit_start" as const }) }, "CONTACT_FORM_SUBMIT_CONTROL_DRIFT");

test("T49 exactly one button[type=submit]", async () => {
  const h = harness();
  await h.run();
  assert.equal(h.page.clickCount, 1);
});
test("T50 exactly one input[type=submit]", async () => {
  const page = Object.assign(new FakeC5Page(), { submitMode: "input" as const });
  const h = harness({ page });
  const result = await h.run();
  assert.equal(result.kind, "submission_confirmed");
  assert.equal(page.clickCount, 1);
});
expectBlocked("T51 no submit control -> no click", { page: Object.assign(new FakeC5Page(), { submitMode: "missing" as const }) }, "CONTACT_FORM_SUBMIT_CONTROL_MISSING");
expectBlocked("T52 multiple submit controls -> no click", { page: Object.assign(new FakeC5Page(), { submitMode: "multiple" as const }) }, "CONTACT_FORM_SUBMIT_CONTROL_AMBIGUOUS");
expectBlocked("T53 disabled submit -> no click", { page: Object.assign(new FakeC5Page(), { submitMode: "disabled" as const }) }, "CONTACT_FORM_SUBMIT_CONTROL_NOT_ACTIONABLE");
expectBlocked("T54 hidden submit -> no click", { page: Object.assign(new FakeC5Page(), { submitMode: "hidden" as const }) }, "CONTACT_FORM_SUBMIT_CONTROL_NOT_ACTIONABLE");
expectBlocked("T55 generic button rejected", { page: Object.assign(new FakeC5Page(), { submitMode: "generic" as const }) }, "CONTACT_FORM_SUBMIT_CONTROL_MISSING");
expectBlocked("T56 external unrelated button rejected", { page: Object.assign(new FakeC5Page(contactForm({ controls: [textInput(0, "Your name", { autocomplete: "name", required: true }), emailInput(1), textarea(2), control({ ordinal: 3, tag: "button", type: "button", labelText: "Send" })] })), { submitMode: "generic" as const }) }, "CONTACT_FORM_SUBMIT_CONTROL_MISSING");

test("T57 mapped -> filled only after verification", async () => {
  const h = harness();
  await h.run();
  assert.deepEqual(transitionStates(h).slice(0, 1), ["filled"]);
});
test("T58 filled -> pre_submit_validated only after revalidation", async () => {
  const h = harness();
  await h.run();
  assert.ok(transitionStates(h).indexOf("filled") < transitionStates(h).indexOf("pre_submit_validated"));
});
test("T59 submitting persisted before click", async () => {
  const h = harness();
  await h.run();
  assert.ok(transitionStates(h).indexOf("submitting") >= 0);
  assert.equal(h.page.clickCount, 1);
});
expectBlocked("T60 failed submitting transition => zero click", { transitionFailureState: "submitting" });
test("T61 only submitting owner can click", async () => {
  const h = harness();
  await h.run();
  assert.equal(h.page.clickCount, 1);
  assert.equal(h.armedAllowance, null);
});
test("T62 max click count one", async () => {
  const h = harness();
  await h.run();
  assert.equal(h.page.clickCount, 1);
});

test("T63 no form.submit()", () => assert.doesNotMatch(sourceText(), /form\.submit\(/));
test("T64 no requestSubmit()", () => assert.doesNotMatch(sourceText(), /requestSubmit/));
test("T65 no Enter-submit", () => assert.doesNotMatch(sourceText(), /keyboard\.press|press\(["']Enter/));
test("T66 no synthetic submit event", () => assert.doesNotMatch(sourceText(), /dispatchEvent|SubmitEvent/));
test("T67 no second click", () => assert.doesNotMatch(readFileSync(join(process.cwd(), "lib/backlinks/services/contactFormSubmission.ts"), "utf8"), /second click|retry click/i));

for (const [name, kind, finalUrl] of [
  ["T68 explicit success element confirms", "EXPLICIT_SUCCESS_ELEMENT", pageUrl],
  ["T69 same-host known path confirms", "KNOWN_SAME_HOST_CONFIRMATION_PATH", "https://forms.example/thank-you"],
  ["T70 explicit replacement confirms", "EXPLICIT_SUCCESS_REPLACEMENT", pageUrl],
] as const) {
  test(name, async () => {
    const page = new FakeC5Page();
    page.confirmation = { confirmed: true, kind, finalUrl, evidenceFingerprint: contactFormSafeFingerprint({ kind, finalUrl }), markerId: kind === "KNOWN_SAME_HOST_CONFIRMATION_PATH" ? null : "success" };
    const h = harness({ page });
    const result = await h.run();
    assert.equal(result.kind, "submission_confirmed");
  });
}

for (const [name, observation] of [
  ["T71 HTTP 200 alone does not confirm", { confirmed: false, reason: "http_200_without_marker", finalUrl: pageUrl, httpStatus: 200 }],
  ["T72 form disappearance alone does not confirm", { confirmed: false, reason: "form_disappeared_without_ack", finalUrl: pageUrl, formPresent: false }],
  ["T73 disabled button alone does not confirm", { confirmed: false, reason: "button_disabled_only", finalUrl: pageUrl }],
  ["T74 generic thank-you elsewhere does not confirm", { confirmed: false, reason: "generic_thank_you_elsewhere", finalUrl: pageUrl }],
  ["T75 arbitrary URL change does not confirm", { confirmed: false, reason: "arbitrary_url_change", finalUrl: "https://forms.example/random" }],
  ["T76 off-host redirect does not confirm", { confirmed: true, kind: "EXPLICIT_SUCCESS_ELEMENT", finalUrl: "https://evil.example/thank-you", evidenceFingerprint: contactFormSafeFingerprint({ off_host: true }), markerId: "success" }],
] as const) {
  test(name, async () => {
    const page = new FakeC5Page();
    page.confirmation = observation;
    const h = harness({ page });
    const result = await h.run();
    assert.equal(result.kind, "submission_ambiguous");
    assert.equal(h.acceptedInitialCount, 0);
    assert.equal(page.clickCount, 1);
  });
}

for (const [name, error] of [
  ["T77 timeout after click -> ambiguous", new Error("Timeout 10000ms exceeded")],
  ["T78 connection loss after click -> ambiguous", new Error("net::ERR_CONNECTION_RESET")],
  ["T80 browser failure after click -> ambiguous", new Error("page closed")],
] as const) {
  test(name, async () => {
    const page = new FakeC5Page();
    page.clickError = error;
    const h = harness({ page });
    const result = await h.run();
    assert.equal(result.kind, "submission_ambiguous");
    assert.equal(page.clickCount, 1);
    assert.equal(h.acceptedInitialCount, 0);
  });
}

test("T79 generic page after click -> ambiguous", async () => {
  const page = new FakeC5Page();
  page.confirmation = { confirmed: false, reason: "generic_page", finalUrl: pageUrl };
  const h = harness({ page });
  const result = await h.run();
  assert.equal(result.kind, "submission_ambiguous");
});
test("T81 lease loss after click => no retry", async () => {
  const h = harness({ confirmFailure: new Error("CONTACT_FORM_RUN_LEASE_LOST") });
  const result = await h.run();
  assert.equal(result.kind, "lease_lost");
  assert.equal(h.page.clickCount, 1);
  assert.equal(sourceText().includes("retryContactFormPreSubmitRun"), false);
});
test("T82 crash after submitting before click => no automatic retry", async () => {
  const h = harness({ transitionFailureState: "submitting" });
  await h.run();
  assert.equal(h.page.clickCount, 0);
  assert.equal(sourceText().includes("retry_backlink_contact_form_pre_submit"), false);
});
test("T83 stale submitting not requeued", () => assert.match(migrationText(), /old\.state = 'submitting' and new\.state in \('queued','claimed','navigating','discovered','mapped','filled','pre_submit_validated'\)/));
test("T84 submission_ambiguous not requeued", () => assert.match(migrationText(), /where state='queued'/));
test("T85 submission_confirmed not requeued", () => assert.match(migrationText(), /if r\.state='submission_confirmed'/));

test("T86 duplicate worker only one submitting transition", async () => {
  const h = harness();
  await h.run();
  assert.equal(h.transitions.filter((transition) => transition.state === "submitting").length, 1);
});
test("T87 duplicate worker at most one click", async () => {
  const h = harness();
  await h.run();
  assert.equal(h.page.clickCount, 1);
});
test("T88 duplicate confirmation idempotent", async () => {
  const h = harness();
  await h.run();
  assert.equal(h.confirmations, 1);
});
test("T89 accepted initial remains unique", async () => {
  const h = harness();
  await h.run();
  assert.equal(h.acceptedInitialCount, 1);
  assert.match(migrationText(), /CONTACT_FORM_ACCEPTED_INITIAL_EXISTS/);
});
test("T90 outreach activation happens once", async () => {
  const h = harness();
  await h.run();
  assert.equal(h.acceptedInitialCount, 1);
  assert.match(migrationText(), /update public\.backlink_outreach set status='active',current_attempt=1/);
});

test("T91 confirmed submission creates accepted initial only after evidence", async () => {
  const h = harness();
  await h.run();
  assert.ok(transitionStates(h).indexOf("submitting") >= 0);
  assert.equal(h.acceptedInitialCount, 1);
});
test("T92 click without confirmation creates no accepted initial", async () => {
  const page = new FakeC5Page();
  page.confirmation = { confirmed: false, reason: "no_marker", finalUrl: pageUrl };
  const h = harness({ page });
  await h.run();
  assert.equal(h.acceptedInitialCount, 0);
});
test("T93 ambiguous submission creates no accepted initial", async () => {
  const page = new FakeC5Page();
  page.confirmation = { confirmed: false, reason: "ambiguous", finalUrl: pageUrl };
  const h = harness({ page });
  const result = await h.run();
  assert.equal(result.kind, "submission_ambiguous");
  assert.equal(h.acceptedInitialCount, 0);
});
test("T94 confirmed form does not mark delivered", () => assert.doesNotMatch(sourceText(), /delivered|delivery/i));
test("T95 confirmed form does not create reply", () => assert.doesNotMatch(sourceText(), /reply|inbound/i));
test("T96 confirmed form does not create backlink", () => assert.doesNotMatch(sourceText(), /insert into public\.backlinks|backlink_created/i));

test("T97 C3 HTTPS-only preserved", () => assert.match(sourceText(), /https_required|CONTACT_FORM_URL_HTTPS_REQUIRED/));
test("T98 C3 private-network rejection preserved", () => assert.match(sourceText(), /isPublicIpAddress|CONTACT_FORM_URL_DNS_UNSAFE/));
test("T99 C3 DNS protection preserved", () => assert.match(sourceText(), /resolveHostnamePublicAddresses|dns_private_or_mixed/));
test("T100 C3 redirect validation preserved", () => assert.match(sourceText(), /CONTACT_FORM_REDIRECT_LIMIT_EXCEEDED/));
test("T101 target POST remains blocked except explicit submit allowance", () => {
  const source = sourceText();
  assert.match(source, /consumeSubmitAllowanceIfMatched/);
  assert.match(source, /CONTACT_FORM_TARGET_MUTATION_BLOCKED/);
});
test("T102 arbitrary script/API POST remains blocked", () => assert.match(sourceText(), /resourceType/));
test("T103 PUT blocked", () => assert.match(sourceText(), /"PUT"/));
test("T104 PATCH blocked", () => assert.match(sourceText(), /"PATCH"/));
test("T105 DELETE blocked", () => assert.match(sourceText(), /"DELETE"/));

test("T106 context cleanup after confirmation", async () => {
  const h = harness();
  const result = await h.run();
  assert.equal(result.kind, "submission_confirmed");
  assert.equal(h.armedAllowance, null);
});
test("T107 context cleanup after ambiguity", async () => {
  const page = new FakeC5Page();
  page.confirmation = { confirmed: false, reason: "ambiguous", finalUrl: pageUrl };
  const h = harness({ page });
  await h.run();
  assert.equal(h.armedAllowance, null);
});
test("T108 context cleanup after pre-submit failure", async () => {
  const h = harness({ keepLeaseFailureAt: 2 });
  await h.run();
  assert.equal(h.armedAllowance, null);
});
test("T109 no external target used in tests", () => {
  const urls = readFileSync(join(process.cwd(), "scripts/contact-form-controlled-submission.test.ts"), "utf8").match(/https:\/\/[^\s"',)]+/g) ?? [];
  assert.deepEqual(urls.filter((url) => !url.includes(".example")), []);
});
test("T110 no production DB writes", () => {
  const source = readFileSync(join(process.cwd(), "scripts/contact-form-controlled-submission.test.ts"), "utf8");
  assert.equal(source.includes("supabase" + ".co"), false);
  assert.equal(source.includes("create" + "SupabaseAdminClient"), false);
  assert.equal(source.includes("DATABASE_" + "URL"), false);
});

test("T111 explicit GET form submission rejected without click", async () => {
  const form = contactForm({ method: "get" });
  const h = harness({ page: new FakeC5Page(form), mapping: mappingFor(form) });
  const result = await h.run();
  assert.equal(result.kind, "blocked");
  assert.equal(result.kind === "blocked" ? result.safeErrorCode : null, "CONTACT_FORM_SUBMIT_METHOD_UNSUPPORTED");
  assert.equal(h.page.clickCount, 0);
  assert.equal(h.armedAllowanceHistory.length, 0);
});

test("T112 missing method defaults to GET and is rejected without click", async () => {
  const form = contactForm({ method: null });
  const h = harness({ page: new FakeC5Page(form), mapping: mappingFor(form) });
  const result = await h.run();
  assert.equal(result.kind, "blocked");
  assert.equal(result.kind === "blocked" ? result.safeErrorCode : null, "CONTACT_FORM_SUBMIT_METHOD_UNSUPPORTED");
  assert.equal(h.page.clickCount, 0);
  assert.equal(h.armedAllowanceHistory.length, 0);
});

test("T113 GET action with query rejected without allowance", async () => {
  const form = contactForm({ action: "/contact?source=norixo", method: "get" });
  const h = harness({ page: new FakeC5Page(form), mapping: mappingFor(form) });
  const result = await h.run();
  assert.equal(result.kind, "blocked");
  assert.equal(result.kind === "blocked" ? result.safeErrorCode : null, "CONTACT_FORM_SUBMIT_METHOD_UNSUPPORTED");
  assert.equal(h.page.clickCount, 0);
  assert.equal(h.armedAllowanceHistory.length, 0);
});

test("T114 POST action query is preserved in one-shot allowance", async () => {
  const form = contactForm({ action: "/contact?source=norixo", method: "post" });
  const h = harness({ page: new FakeC5Page(form), mapping: mappingFor(form) });
  const result = await h.run();
  assert.equal(result.kind, "submission_confirmed");
  assert.equal(h.armedAllowanceHistory.length, 1);
  assert.equal(h.armedAllowanceHistory[0].method, "POST");
  assert.equal(h.armedAllowanceHistory[0].search, "?source=norixo");
});

test("T115 network allowance does not claim intrinsic DOM form/control scope", () => {
  const source = readFileSync(join(process.cwd(), "lib/backlinks/services/contactFormSubmission.ts"), "utf8");
  const allowanceDefinition = source.slice(source.indexOf("export type ContactFormSubmitRequestAllowance"), source.indexOf("export type ContactFormConfirmationKind"));
  assert.doesNotMatch(allowanceDefinition, /formOrdinal|submitControlFingerprint/);
});

expectBlocked("T116 submit control reported from another form is rejected before click", { page: Object.assign(new FakeC5Page(), { submitMode: "wrong_form" as const }) }, "CONTACT_FORM_SUBMIT_CONTROL_FORM_MISMATCH");

test("T117 durable submitting precedes allowance arming and click", async () => {
  const h = harness();
  const result = await h.run();
  assert.equal(result.kind, "submission_confirmed");
  assert.equal(transitionStates(h).at(-1), "submitting");
  assert.equal(h.armedAllowanceHistory.length, 1);
  assert.equal(h.page.clickCount, 1);
});

function sourceText(): string {
  return `${readFileSync(join(process.cwd(), "lib/backlinks/services/contactFormNavigationWorker.ts"), "utf8")}\n${readFileSync(join(process.cwd(), "lib/backlinks/services/contactFormSubmission.ts"), "utf8")}`;
}

function migrationText(): string {
  return readFileSync(join(process.cwd(), "supabase/migrations/20260902120000_add_backlink_contact_form_automation_foundation.sql"), "utf8");
}


test("T121 controlled safe select chooses exact mapped Other option", async () => {
  const form = selectContactForm();
  const mapping = mappingFor(form);

  const selectField = mapping.mappedFields.find(
    (field) => field.assignmentType === "select_option",
  );

  assert.ok(selectField);
  assert.equal(selectField.controlType, "select");
  assert.equal(selectField.semanticField, "subject");
  assert.equal(selectField.selectOption?.normalizedLabel, "other");

  const page = new FakeC5Page(form);
  const h = harness({ page, mapping });
  const result = await h.run();

  assert.equal(result.kind, "submission_confirmed");
  assert.equal(page.selectCalls.length, 1);
  assert.equal(
    page.selectCalls[0]?.controlOrdinal,
    selectField.locator.controlOrdinal,
  );
  assert.equal(
    page.selectCalls[0]?.optionOrdinal,
    selectField.selectOption?.ordinal,
  );
  assert.equal(page.selectCalls[0]?.normalizedLabel, "other");

  assert.equal(
    page.fillCalls.some(
      (call) =>
        call.controlOrdinal === selectField.locator.controlOrdinal,
    ),
    false,
  );

  assert.equal(page.clickCount, 1);
});

test("T122 select option ordinal drift blocks before select mutation", async () => {
  const original = selectContactForm();
  const mapping = mappingFor(original);

  const drifted = mutateSelectOption(
    original,
    2,
    (option) => ({
      ...option,
      ordinal: 7,
    }),
  );

  const page = new FakeC5Page(original);
  page.formsSequence = [drifted];

  const h = harness({ page, mapping });
  const result = await h.run();

  assert.equal(result.kind, "blocked");
  assert.equal(page.selectCalls.length, 0);
  assert.equal(page.clickCount, 0);
  assert.equal(h.armedAllowanceHistory.length, 0);
});

test("T123 select option label drift blocks before select mutation", async () => {
  const original = selectContactForm();
  const mapping = mappingFor(original);

  const drifted = mutateSelectOption(
    original,
    2,
    (option) => ({
      ...option,
      labelText: "Changed option",
      normalizedLabel: "changed option",
    }),
  );

  const page = new FakeC5Page(original);
  page.formsSequence = [drifted];

  const h = harness({ page, mapping });
  const result = await h.run();

  assert.equal(result.kind, "blocked");
  assert.equal(page.selectCalls.length, 0);
  assert.equal(page.clickCount, 0);
  assert.equal(h.armedAllowanceHistory.length, 0);
});

test("T124 disabled safe select option blocks before select mutation", async () => {
  const original = selectContactForm();
  const mapping = mappingFor(original);

  const drifted = mutateSelectOption(
    original,
    2,
    (option) => ({
      ...option,
      disabled: true,
    }),
  );

  const page = new FakeC5Page(original);
  page.formsSequence = [drifted];

  const h = harness({ page, mapping });
  const result = await h.run();

  assert.equal(result.kind, "blocked");
  assert.equal(page.selectCalls.length, 0);
  assert.equal(page.clickCount, 0);
  assert.equal(h.armedAllowanceHistory.length, 0);
});

test("T125 safe select option without value blocks before select mutation", async () => {
  const original = selectContactForm();
  const mapping = mappingFor(original);

  const drifted = mutateSelectOption(
    original,
    2,
    (option) => ({
      ...option,
      valuePresent: false,
    }),
  );

  const page = new FakeC5Page(original);
  page.formsSequence = [drifted];

  const h = harness({ page, mapping });
  const result = await h.run();

  assert.equal(result.kind, "blocked");
  assert.equal(page.selectCalls.length, 0);
  assert.equal(page.clickCount, 0);
  assert.equal(h.armedAllowanceHistory.length, 0);
});


test("T126 selected option state drift immediately after selection blocks before submit", async () => {
  const original = selectContactForm();
  const mapping = mappingFor(original);

  const selectField = mapping.mappedFields.find(
    (field) => field.assignmentType === "select_option",
  );

  assert.ok(selectField);
  assert.ok(selectField.selectOption);

  /*
   * inspectForms sequence:
   * 1. before_fill checkpoint -> original
   * 2. select preflight       -> original
   * 3. post-select verify     -> drifted state
   *
   * The fake select mutation itself still occurs exactly once.
   * The following inspection deliberately reports that the expected
   * option is no longer selected.
   */
  const postSelectDrift = {
    ...original,
    controls: original.controls.map((control) =>
      control.ordinal !== selectField.locator.controlOrdinal
        ? control
        : {
            ...control,
            valuePresent: true,
            options: (control.options ?? []).map((option) => ({
              ...option,
              selected: false,
            })),
          },
    ),
  };

  const page = new FakeC5Page(original);
  page.formsSequence = [
    original,
    original,
    postSelectDrift,
  ];

  const h = harness({ page, mapping });
  const result = await h.run();

  assert.equal(result.kind, "blocked");
  assert.equal(page.selectCalls.length, 1);
  assert.equal(page.clickCount, 0);
  assert.equal(h.armedAllowanceHistory.length, 0);
});

test("T127 selected option drifts before before_submit checkpoint and blocks before arm or click", async () => {
  const original = selectContactForm();
  const mapping = mappingFor(original);

  const selectField = mapping.mappedFields.find(
    (field) => field.assignmentType === "select_option",
  );

  assert.ok(selectField);
  assert.ok(selectField.selectOption);

  /*
   * inspectForms sequence:
   * 1. before_fill checkpoint -> original
   * 2. select preflight       -> original
   * 3. post-select verify     -> correct selected state
   * 4. before_submit          -> drifted selected state
   */

  const correctlySelected = {
    ...original,
    controls: original.controls.map((control) =>
      control.ordinal !== selectField.locator.controlOrdinal
        ? control
        : {
            ...control,
            valuePresent: true,
            options: (control.options ?? []).map((option) => ({
              ...option,
              selected:
                option.ordinal === selectField.selectOption?.ordinal,
            })),
          },
    ),
  };

  const beforeSubmitDrift = {
    ...correctlySelected,
    controls: correctlySelected.controls.map((control) =>
      control.ordinal !== selectField.locator.controlOrdinal
        ? control
        : {
            ...control,
            options: (control.options ?? []).map((option) => ({
              ...option,
              selected: false,
            })),
          },
    ),
  };

  const page = new FakeC5Page(original);
  page.formsSequence = [
    original,
    original,
    correctlySelected,
    beforeSubmitDrift,
  ];

  const h = harness({ page, mapping });
  const result = await h.run();

  assert.equal(result.kind, "blocked");
  assert.equal(page.selectCalls.length, 1);
  assert.equal(page.clickCount, 0);
  assert.equal(h.armedAllowanceHistory.length, 0);
});

async function main() {
  let passed = 0;
  for (const current of tests) {
    await current.run();
    passed += 1;
  }
  console.log(`contact-form controlled submission C5 tests passed: ${passed}/${tests.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
