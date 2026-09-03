import { createHash } from "node:crypto";

import {
  CONTACT_FORM_SUPPORTED_CONTROL_TYPES,
  CONTACT_FORM_SUPPORTED_SEMANTIC_FIELDS,
  buildContactFormMappingPreview,
  contactFormMappingPreviewToSafeMetadata,
  type ContactFormDiscoveredPage,
  type ContactFormMappedFieldPreview,
  type ContactFormMappingPreview,
  type ContactFormSupportedControlType,
  type ContactFormSupportedSemanticField,
} from "@/lib/backlinks/services/contactFormMappingPreview";
import { buildContactFormApprovalFingerprint } from "@/lib/backlinks/services/contactFormApprovalFingerprint";
import type { ContactFormRun, ContactFormRunExecutionContext, ContactFormRunState } from "@/lib/backlinks/repositories/contactFormAutomationRepository";
import type { Json } from "@/types/database.types";

export type ContactFormSubmissionSignals = Readonly<{
  hasCaptcha: boolean;
  hasLoginWall: boolean;
  hasPasswordField: boolean;
}>;

export type ContactFormFieldLocator = ContactFormMappedFieldPreview["locator"];

export type ContactFormSubmitControl = Readonly<{
  formOrdinal: number;
  controlOrdinal: number;
  tag: "button" | "input";
  type: "submit";
  name: string | null;
  id: string | null;
  visible: boolean;
  enabled: boolean;
  disabled: boolean;
  hidden: boolean;
  fingerprint: string;
}>;

export type ContactFormSubmissionPage = {
  url: () => string;
  evaluatePageSignals: () => Promise<ContactFormSubmissionSignals>;
  inspectForms: () => Promise<ContactFormDiscoveredPage>;
  readFieldValue: (locator: ContactFormFieldLocator) => Promise<string | null>;
  fillField: (locator: ContactFormFieldLocator, value: string, options: { timeoutMs: number }) => Promise<void>;
  listSubmitControls: (formOrdinal: number) => Promise<readonly ContactFormSubmitControl[]>;
  clickSubmitControl: (control: ContactFormSubmitControl, options: { timeoutMs: number }) => Promise<void>;
  observeSubmissionConfirmation: (input: {
    expectedOrigin: string;
    selectedFormOrdinal: number;
    selectedFormFingerprint: string;
    timeoutMs: number;
  }) => Promise<ContactFormConfirmationObservation>;
};

export type ContactFormSubmitRequestAllowance = Readonly<{
  runId: string;
  method: "POST";
  origin: string;
  path: string;
  search: string;
}>;

export type ContactFormConfirmationKind = "EXPLICIT_SUCCESS_ELEMENT" | "KNOWN_SAME_HOST_CONFIRMATION_PATH" | "EXPLICIT_SUCCESS_REPLACEMENT";

export type ContactFormConfirmationObservation =
  | Readonly<{
      confirmed: true;
      kind: ContactFormConfirmationKind;
      finalUrl: string;
      evidenceFingerprint: string;
      markerId: string | null;
    }>
  | Readonly<{
      confirmed: false;
      reason: string;
      finalUrl: string;
      httpStatus?: number;
      formPresent?: boolean;
    }>;

export type ContactFormSubmissionBlockState = Extract<ContactFormRunState, "blocked_policy" | "blocked_captcha" | "failed_pre_submit" | "manual_review">;

export type ContactFormRevalidationResult =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; state: ContactFormSubmissionBlockState; code: string; eventType: string; metadata: Json }>;

export type ContactFormControlledSubmissionResult =
  | Readonly<{ kind: "submission_confirmed"; run: ContactFormRun; confirmation: Extract<ContactFormConfirmationObservation, { confirmed: true }>; attemptId: string; disposition: string }>
  | Readonly<{ kind: "submission_ambiguous"; run: ContactFormRun; observation: ContactFormConfirmationObservation; safeErrorCode: string }>
  | Readonly<{ kind: "blocked"; run: ContactFormRun; state: ContactFormSubmissionBlockState; safeErrorCode: string }>
  | Readonly<{ kind: "lease_lost"; runId: string; clickMayHaveOccurred: boolean }>;

export type ContactFormControlledSubmissionDependencies = Readonly<{
  loadExecutionContext: (run: ContactFormRun) => Promise<ContactFormRunExecutionContext>;
  transitionRun: (input: {
    runId: string;
    workerId: string;
    nextState: ContactFormRunState;
    eventType: string;
    safeMetadata?: Json;
    safeErrorCode?: string;
    evidenceReference?: string;
    finalUrl?: string;
  }) => Promise<ContactFormRun>;
  confirmSubmission: (input: { runId: string; workerId: string; evidenceReference: string; finalUrl?: string }) => Promise<{ run_id: string; attempt_id: string; disposition: string }>;
  keepLease: () => Promise<void>;
  armSubmitRequest: (allowance: ContactFormSubmitRequestAllowance) => void;
  revokeSubmitRequest: () => void;
}>;

type SubmissionCheckpoint = Readonly<{ ok: true; context: ContactFormRunExecutionContext; mapping: ContactFormMappingPreview }>;
type SubmissionFailure = Extract<ContactFormRevalidationResult, { ok: false }>;

const DEFAULT_FIELD_TIMEOUT_MS = 5_000;
const DEFAULT_SUBMIT_TIMEOUT_MS = 10_000;
const DEFAULT_CONFIRMATION_TIMEOUT_MS = 10_000;
const SUCCESS_PATHS = new Set(["/thank-you", "/thanks", "/success", "/confirmation", "/message-sent", "/contact/thank-you", "/contact/thanks", "/contact/success", "/contact/confirmation", "/contact/message-sent"]);

export async function executeContactFormControlledSubmission(input: {
  run: ContactFormRun;
  workerId: string;
  page: ContactFormSubmissionPage;
  mapping: ContactFormMappingPreview;
  expectedPageUrl: string;
  dependencies: ContactFormControlledSubmissionDependencies;
  fieldTimeoutMs?: number;
  submitTimeoutMs?: number;
  confirmationTimeoutMs?: number;
}): Promise<ContactFormControlledSubmissionResult> {
  const fieldTimeoutMs = input.fieldTimeoutMs ?? DEFAULT_FIELD_TIMEOUT_MS;
  const submitTimeoutMs = input.submitTimeoutMs ?? DEFAULT_SUBMIT_TIMEOUT_MS;
  const confirmationTimeoutMs = input.confirmationTimeoutMs ?? DEFAULT_CONFIRMATION_TIMEOUT_MS;
  const deps = input.dependencies;

  let beforeFill: SubmissionCheckpoint | SubmissionFailure;
  try {
    beforeFill = await validateSubmissionCheckpoint({
      phase: "before_fill",
      run: input.run,
      workerId: input.workerId,
      page: input.page,
      expectedPageUrl: input.expectedPageUrl,
      expectedMapping: input.mapping,
      dependencies: deps,
    });
  } catch (error) {
    if (isLeaseLostError(error)) return { kind: "lease_lost", runId: input.run.id, clickMayHaveOccurred: false };
    throw error;
  }
  if (!beforeFill.ok) return transitionBlocked(input.run, input.workerId, deps, beforeFill);

  const fields = orderedMappedFields(input.mapping);
  const prefillFailure = await ensureMappedFieldsAreEmpty(input.page, fields);
  if (prefillFailure != null) return transitionBlocked(input.run, input.workerId, deps, prefillFailure);

  const fillEvidence: Json[] = [];
  for (const field of fields) {
    const sourceValue = sourceValueForSemantic(beforeFill.context, field.semanticField);
    await input.page.fillField(field.locator, sourceValue, { timeoutMs: fieldTimeoutMs });
    const readback = await input.page.readFieldValue(field.locator);
    const normalizedReadback = normalizeSubmittedValue(readback ?? "");
    const normalizedSource = normalizeSubmittedValue(sourceValue);
    if (normalizedReadback !== normalizedSource) {
      return transitionBlocked(input.run, input.workerId, deps, failure("failed_pre_submit", "CONTACT_FORM_FIELD_VALUE_MISMATCH", "field_value_mismatch", { semantic_field: field.semanticField, control_fingerprint: field.fieldFingerprint }));
    }
    fillEvidence.push(fieldValueEvidence(field, normalizedReadback));
  }

  let filledRun: ContactFormRun;
  try {
    filledRun = await deps.transitionRun({
      runId: input.run.id,
      workerId: input.workerId,
      nextState: "filled",
      eventType: "fill_verified",
      safeMetadata: fillMetadata(input.mapping, fillEvidence),
      finalUrl: input.page.url(),
    });
  } catch (error) {
    if (isLeaseLostError(error)) return { kind: "lease_lost", runId: input.run.id, clickMayHaveOccurred: false };
    throw error;
  }

  let preSubmit: SubmissionCheckpoint | SubmissionFailure;
  try {
    preSubmit = await validateSubmissionCheckpoint({
      phase: "before_submit",
      run: filledRun,
      workerId: input.workerId,
      page: input.page,
      expectedPageUrl: input.expectedPageUrl,
      expectedMapping: input.mapping,
      dependencies: deps,
      filledFields: fields,
    });
  } catch (error) {
    if (isLeaseLostError(error)) return { kind: "lease_lost", runId: filledRun.id, clickMayHaveOccurred: false };
    throw error;
  }
  if (!preSubmit.ok) return transitionBlocked(filledRun, input.workerId, deps, preSubmit);

  const submitSelection = await selectStrictSubmitControl(input.page, input.mapping);
  if (!submitSelection.ok) return transitionBlocked(filledRun, input.workerId, deps, submitSelection.failure);

  const submitTarget = resolveSubmitTarget(input.mapping, submitSelection.control, preSubmit.context.run.id);
  if (!submitTarget.ok) return transitionBlocked(filledRun, input.workerId, deps, submitTarget.failure);

  let preSubmitRun: ContactFormRun;
  try {
    preSubmitRun = await deps.transitionRun({
      runId: filledRun.id,
      workerId: input.workerId,
      nextState: "pre_submit_validated",
      eventType: "pre_submit_validated",
      safeMetadata: preSubmitMetadata(input.mapping, submitSelection.control, submitTarget.allowance),
      finalUrl: input.page.url(),
    });
  } catch (error) {
    if (isLeaseLostError(error)) return { kind: "lease_lost", runId: filledRun.id, clickMayHaveOccurred: false };
    throw error;
  }

  let submittingRun: ContactFormRun;
  try {
    submittingRun = await deps.transitionRun({
      runId: preSubmitRun.id,
      workerId: input.workerId,
      nextState: "submitting",
      eventType: "submit_started",
      safeMetadata: submittingMetadata(input.mapping, submitSelection.control, submitTarget.allowance),
      evidenceReference: `c5_submitting:${preSubmitRun.id}`,
      finalUrl: input.page.url(),
    });
  } catch (error) {
    if (isLeaseLostError(error)) return { kind: "lease_lost", runId: preSubmitRun.id, clickMayHaveOccurred: false };
    throw error;
  }

  try {
    await deps.keepLease();
  } catch (error) {
    if (isLeaseLostError(error)) return { kind: "lease_lost", runId: submittingRun.id, clickMayHaveOccurred: false };
    throw error;
  }

  const submitStillStable = await selectStrictSubmitControl(input.page, input.mapping);
  if (!submitStillStable.ok) return transitionBlocked(submittingRun, input.workerId, deps, submitStillStable.failure);
  if (submitStillStable.control.fingerprint !== submitSelection.control.fingerprint || submitStillStable.control.controlOrdinal !== submitSelection.control.controlOrdinal) {
    return transitionBlocked(submittingRun, input.workerId, deps, failure("manual_review", "CONTACT_FORM_SUBMIT_CONTROL_DRIFT", "submit_control_revalidation_failed", { expected_submit_control_fingerprint: submitSelection.control.fingerprint, current_submit_control_fingerprint: submitStillStable.control.fingerprint }));
  }

  let clickMayHaveOccurred = false;
  deps.armSubmitRequest(submitTarget.allowance);
  try {
    await input.page.clickSubmitControl(submitSelection.control, { timeoutMs: submitTimeoutMs });
    clickMayHaveOccurred = true;
  } catch (error) {
    clickMayHaveOccurred = true;
    deps.revokeSubmitRequest();
    return markAmbiguous(submittingRun, input.workerId, deps, ambiguousObservation(input.page.url(), isTimeoutError(error) ? "post_click_timeout" : "post_click_error"), "CONTACT_FORM_SUBMISSION_CLICK_UNCERTAIN");
  } finally {
    deps.revokeSubmitRequest();
  }

  let observation: ContactFormConfirmationObservation;
  try {
    observation = await input.page.observeSubmissionConfirmation({
      expectedOrigin: submitTarget.allowance.origin,
      selectedFormOrdinal: input.mapping.selectedFormOrdinal ?? -1,
      selectedFormFingerprint: input.mapping.selectedFormFingerprint ?? "",
      timeoutMs: confirmationTimeoutMs,
    });
  } catch (error) {
    return markAmbiguous(submittingRun, input.workerId, deps, ambiguousObservation(input.page.url(), isTimeoutError(error) ? "confirmation_timeout" : "confirmation_observation_failed"), "CONTACT_FORM_SUBMISSION_CONFIRMATION_UNCERTAIN");
  }

  if (!observation.confirmed || !isConfirmationObservationSafe(observation, submitTarget.allowance.origin)) {
    return markAmbiguous(submittingRun, input.workerId, deps, observation, "CONTACT_FORM_SUBMISSION_CONFIRMATION_UNPROVEN");
  }

  const evidenceReference = confirmationEvidenceReference(submittingRun.id, observation);
  try {
    const result = await deps.confirmSubmission({
      runId: submittingRun.id,
      workerId: input.workerId,
      evidenceReference,
      finalUrl: observation.finalUrl,
    });
    return {
      kind: "submission_confirmed",
      run: { ...submittingRun, state: "submission_confirmed", final_attempt_id: result.attempt_id, evidence_reference: evidenceReference, final_url: observation.finalUrl, result_class: "semantic_success" },
      confirmation: observation,
      attemptId: result.attempt_id,
      disposition: result.disposition,
    };
  } catch (error) {
    if (isLeaseLostError(error)) return { kind: "lease_lost", runId: submittingRun.id, clickMayHaveOccurred };
    return markAmbiguous(submittingRun, input.workerId, deps, ambiguousObservation(observation.finalUrl, "confirmation_rpc_rejected"), "CONTACT_FORM_CONFIRMATION_RPC_REJECTED");
  }
}

export function revalidateContactFormExecutionContext(context: ContactFormRunExecutionContext): ContactFormRevalidationResult {
  const run = context.run;
  const approval = context.approval;
  const outreach = context.outreach;
  const contact = context.contact;
  const opportunity = context.opportunity;
  const formUrl = trimToNull(contact.contact_form_url);
  const targetUrl = trimToNull(opportunity.target_page_url);
  const subject = trimToNull(outreach.subject);
  const body = trimToNull(outreach.body);
  if (run.id !== run.id.trim() || run.workspace_id !== approval.workspace_id || run.outreach_id !== approval.outreach_id || run.approval_id !== approval.id || run.form_url !== approval.form_url) {
    return stale("CONTACT_FORM_RUN_APPROVAL_STALE", "run_approval_binding");
  }
  if (outreach.workspace_id !== run.workspace_id || outreach.id !== run.outreach_id || outreach.campaign_id !== run.campaign_id || outreach.contact_id !== approval.contact_id || outreach.opportunity_id !== approval.opportunity_id) {
    return stale("CONTACT_FORM_APPROVAL_STALE", "outreach_binding");
  }
  if (outreach.channel !== "contact_form" || outreach.status !== "draft" || outreach.current_attempt !== 0 || context.outreachAttemptCount !== 0) {
    return stale("CONTACT_FORM_OUTREACH_NOT_APPROVABLE", "outreach_state");
  }
  if (contact.workspace_id !== run.workspace_id || contact.id !== approval.contact_id || contact.contact_status === "do_not_contact" || contact.contact_status === "archived" || contact.do_not_contact_at !== null || contact.archived_at !== null) {
    return { ok: false, state: "manual_review", code: "CONTACT_FORM_CONTACT_SUPPRESSED", eventType: "dnc_revalidation_failed", metadata: { reason: "contact_suppressed" } };
  }
  if (opportunity.workspace_id !== run.workspace_id || opportunity.id !== approval.opportunity_id || formUrl == null || targetUrl == null || subject == null || body == null || approval.form_url !== formUrl || approval.target_url !== targetUrl) {
    return stale("CONTACT_FORM_APPROVAL_STALE", "content_binding");
  }
  const fingerprint = buildContactFormApprovalFingerprint({
    workspaceId: run.workspace_id,
    campaignId: outreach.campaign_id,
    outreachId: outreach.id,
    contactId: contact.id,
    opportunityId: opportunity.id,
    targetUrl,
    formUrl,
    senderName: approval.sender_name,
    senderEmail: approval.sender_email,
    senderCompany: approval.sender_company,
    senderWebsite: approval.sender_website,
    subject,
    body,
  });
  if (fingerprint !== approval.content_fingerprint) return stale("CONTACT_FORM_APPROVAL_STALE", "fingerprint_mismatch");
  return { ok: true };
}

export function sourceValueForSemantic(context: ContactFormRunExecutionContext, semantic: ContactFormSupportedSemanticField): string {
  if (semantic === "sender_name") return context.approval.sender_name;
  if (semantic === "sender_email") return context.approval.sender_email;
  if (semantic === "sender_company") return context.approval.sender_company;
  if (semantic === "sender_website") return context.approval.sender_website;
  if (semantic === "subject") return context.approval.subject;
  return context.approval.body;
}

export function contactFormSafeFingerprint(value: Json): string {
  return `sha256:${createHash("sha256").update(stableStringify(value)).digest("hex")}`;
}

export function isKnownSameHostConfirmationPath(pathname: string): boolean {
  const normalized = pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;
  return SUCCESS_PATHS.has(normalized);
}

function orderedMappedFields(mapping: ContactFormMappingPreview): readonly ContactFormMappedFieldPreview[] {
  return [...mapping.mappedFields].sort((left, right) => left.locator.formOrdinal - right.locator.formOrdinal || left.locator.controlOrdinal - right.locator.controlOrdinal || CONTACT_FORM_SUPPORTED_SEMANTIC_FIELDS.indexOf(left.semanticField) - CONTACT_FORM_SUPPORTED_SEMANTIC_FIELDS.indexOf(right.semanticField));
}

async function ensureMappedFieldsAreEmpty(page: ContactFormSubmissionPage, fields: readonly ContactFormMappedFieldPreview[]): Promise<SubmissionFailure | null> {
  for (const field of fields) {
    if (!CONTACT_FORM_SUPPORTED_CONTROL_TYPES.includes(field.controlType as ContactFormSupportedControlType)) {
      return failure("blocked_policy", "CONTACT_FORM_UNSUPPORTED_CONTROL_TYPE", "field_control_policy_blocked", { semantic_field: field.semanticField, control_type: field.controlType });
    }
    const currentValue = await page.readFieldValue(field.locator);
    if (normalizeSubmittedValue(currentValue ?? "").length > 0) {
      return failure("manual_review", "CONTACT_FORM_PREFILLED_VALUE_PRESENT", "prefilled_value_detected", { semantic_field: field.semanticField, control_fingerprint: field.fieldFingerprint });
    }
  }
  return null;
}

async function validateSubmissionCheckpoint(input: {
  phase: "before_fill" | "before_submit";
  run: ContactFormRun;
  workerId: string;
  page: ContactFormSubmissionPage;
  expectedPageUrl: string;
  expectedMapping: ContactFormMappingPreview;
  dependencies: ContactFormControlledSubmissionDependencies;
  filledFields?: readonly ContactFormMappedFieldPreview[];
}): Promise<SubmissionCheckpoint | SubmissionFailure> {
  await input.dependencies.keepLease();
  const context = await input.dependencies.loadExecutionContext(input.run);
  const contextValidation = revalidateContactFormExecutionContext(context);
  if (!contextValidation.ok) return contextValidation;
  if (input.page.url() !== input.expectedPageUrl) {
    return failure("manual_review", "CONTACT_FORM_PAGE_URL_DRIFT", "page_url_drift", { expected_url_fingerprint: contactFormSafeFingerprint(input.expectedPageUrl), current_url_fingerprint: contactFormSafeFingerprint(input.page.url()) });
  }
  const signals = await input.page.evaluatePageSignals();
  if (signals.hasCaptcha) return failure("blocked_captcha", "CONTACT_FORM_CAPTCHA_DETECTED", "captcha_detected", { has_captcha: true, phase: input.phase });
  if (signals.hasLoginWall || signals.hasPasswordField) return failure("manual_review", "CONTACT_FORM_LOGIN_WALL_DETECTED", "login_wall_detected", { has_login_wall: true, has_password_field: signals.hasPasswordField, phase: input.phase });

  const currentMapping = buildContactFormMappingPreview({
    page: await input.page.inspectForms(),
    approvedContent: {
      senderName: context.approval.sender_name,
      senderEmail: context.approval.sender_email,
      senderCompany: context.approval.sender_company,
      senderWebsite: context.approval.sender_website,
      subject: context.approval.subject,
      body: context.approval.body,
    },
    pageSignals: signals,
  });
  if (currentMapping.result === "blocked_captcha") return failure("blocked_captcha", "CONTACT_FORM_CAPTCHA_DETECTED", "captcha_detected", contactFormMappingPreviewToSafeMetadata(currentMapping));
  if (currentMapping.result === "blocked_policy") return failure("blocked_policy", "CONTACT_FORM_MAPPING_POLICY_BLOCKED", "mapping_policy_blocked", contactFormMappingPreviewToSafeMetadata(currentMapping));
  if (currentMapping.result !== "mapped") return failure("manual_review", "CONTACT_FORM_MAPPING_STALE", "mapping_revalidation_failed", contactFormMappingPreviewToSafeMetadata(currentMapping));
  const mappingFailure = compareMapping(input.expectedMapping, currentMapping);
  if (mappingFailure != null) return mappingFailure;

  if (input.phase === "before_submit") {
    for (const field of input.filledFields ?? []) {
      const expectedValue = normalizeSubmittedValue(sourceValueForSemantic(context, field.semanticField));
      const currentValue = normalizeSubmittedValue((await input.page.readFieldValue(field.locator)) ?? "");
      if (currentValue !== expectedValue) {
        return failure("failed_pre_submit", "CONTACT_FORM_FILLED_VALUE_TAMPERED", "filled_value_revalidation_failed", { semantic_field: field.semanticField, control_fingerprint: field.fieldFingerprint });
      }
    }
  }

  return { ok: true, context, mapping: currentMapping };
}

function compareMapping(expected: ContactFormMappingPreview, current: ContactFormMappingPreview): SubmissionFailure | null {
  if (expected.formActionOrigin !== current.formActionOrigin || expected.formActionPath !== current.formActionPath || expected.formActionSearch !== current.formActionSearch || expected.formMethod !== current.formMethod) {
    return failure("manual_review", "CONTACT_FORM_FORM_ACTION_DRIFT", "form_action_drift", { expected_origin_fingerprint: contactFormSafeFingerprint(expected.formActionOrigin ?? ""), current_origin_fingerprint: contactFormSafeFingerprint(current.formActionOrigin ?? ""), expected_path: expected.formActionPath, current_path: current.formActionPath, expected_search_fingerprint: contactFormSafeFingerprint(expected.formActionSearch ?? ""), current_search_fingerprint: contactFormSafeFingerprint(current.formActionSearch ?? ""), expected_method: expected.formMethod, current_method: current.formMethod });
  }
  const currentBySemantic = new Map(current.mappedFields.map((field) => [field.semanticField, field]));
  for (const expectedField of expected.mappedFields) {
    const currentField = currentBySemantic.get(expectedField.semanticField);
    if (currentField == null || currentField.fieldFingerprint !== expectedField.fieldFingerprint || currentField.locator.formOrdinal !== expectedField.locator.formOrdinal || currentField.locator.controlOrdinal !== expectedField.locator.controlOrdinal || currentField.sourceValueFingerprint !== expectedField.sourceValueFingerprint) {
      return failure("manual_review", "CONTACT_FORM_FIELD_FINGERPRINT_DRIFT", "field_fingerprint_drift", { semantic_field: expectedField.semanticField, expected_field_fingerprint: expectedField.fieldFingerprint, current_field_fingerprint: currentField?.fieldFingerprint ?? null });
    }
  }
  if (expected.selectedFormOrdinal !== current.selectedFormOrdinal || expected.selectedFormFingerprint !== current.selectedFormFingerprint) {
    return failure("manual_review", "CONTACT_FORM_FORM_FINGERPRINT_DRIFT", "form_fingerprint_drift", { expected_form_fingerprint: expected.selectedFormFingerprint, current_form_fingerprint: current.selectedFormFingerprint });
  }
  if (expected.mappingFingerprint !== current.mappingFingerprint) {
    return failure("manual_review", "CONTACT_FORM_MAPPING_FINGERPRINT_DRIFT", "mapping_fingerprint_drift", { expected_mapping_fingerprint: expected.mappingFingerprint, current_mapping_fingerprint: current.mappingFingerprint });
  }
  return null;
}

async function selectStrictSubmitControl(page: ContactFormSubmissionPage, mapping: ContactFormMappingPreview): Promise<{ ok: true; control: ContactFormSubmitControl } | { ok: false; failure: SubmissionFailure }> {
  const formOrdinal = mapping.selectedFormOrdinal;
  if (formOrdinal == null) return { ok: false, failure: failure("manual_review", "CONTACT_FORM_SUBMIT_FORM_UNAVAILABLE", "submit_control_unavailable", { reason: "selected_form_missing" }) };
  const controls = await page.listSubmitControls(formOrdinal);
  if (controls.length !== 1) return { ok: false, failure: failure("manual_review", controls.length === 0 ? "CONTACT_FORM_SUBMIT_CONTROL_MISSING" : "CONTACT_FORM_SUBMIT_CONTROL_AMBIGUOUS", "submit_control_rejected", { submit_control_count: controls.length }) };
  const [control] = controls;
  if (control.formOrdinal !== formOrdinal) return { ok: false, failure: failure("manual_review", "CONTACT_FORM_SUBMIT_CONTROL_FORM_MISMATCH", "submit_control_rejected", { expected_form_ordinal: formOrdinal, actual_form_ordinal: control.formOrdinal }) };
  if (control.tag !== "button" && control.tag !== "input") return { ok: false, failure: failure("manual_review", "CONTACT_FORM_SUBMIT_CONTROL_UNSUPPORTED", "submit_control_rejected", { control_tag: control.tag }) };
  if (control.type !== "submit" || control.hidden || control.disabled || !control.enabled || !control.visible) {
    return { ok: false, failure: failure("manual_review", "CONTACT_FORM_SUBMIT_CONTROL_NOT_ACTIONABLE", "submit_control_rejected", { visible: control.visible, enabled: control.enabled, hidden: control.hidden, disabled: control.disabled }) };
  }
  return { ok: true, control };
}

function resolveSubmitTarget(mapping: ContactFormMappingPreview, control: ContactFormSubmitControl, runId: string): { ok: true; allowance: ContactFormSubmitRequestAllowance } | { ok: false; failure: SubmissionFailure } {
  if (mapping.selectedFormOrdinal == null || mapping.formActionOrigin == null || mapping.formActionPath == null || mapping.formActionSearch == null || mapping.formMethod == null || mapping.formMethod === "UNKNOWN") {
    return { ok: false, failure: failure("blocked_policy", "CONTACT_FORM_SUBMIT_TARGET_UNRESOLVED", "submit_target_unresolved", { form_method: mapping.formMethod }) };
  }
  if (mapping.formMethod !== "POST") return { ok: false, failure: failure("manual_review", "CONTACT_FORM_SUBMIT_METHOD_UNSUPPORTED", "submit_method_unsupported", { form_method: mapping.formMethod, c5_v1_supported_method: "POST" }) };
  let origin: URL;
  try {
    origin = new URL(mapping.formActionOrigin);
  } catch {
    return { ok: false, failure: failure("blocked_policy", "CONTACT_FORM_SUBMIT_TARGET_INVALID", "submit_target_invalid", {}) };
  }
  if (origin.protocol !== "https:") return { ok: false, failure: failure("blocked_policy", "CONTACT_FORM_SUBMIT_TARGET_HTTPS_REQUIRED", "submit_target_https_required", { protocol: origin.protocol.replace(":", "") }) };
  return {
    ok: true,
    allowance: {
      runId,
      method: mapping.formMethod,
      origin: origin.origin,
      path: mapping.formActionPath,
      search: mapping.formActionSearch,
    },
  };
}

function fillMetadata(mapping: ContactFormMappingPreview, fields: readonly Json[]): Json {
  return { version: "contact_form_fill_v1", mapping_fingerprint: mapping.mappingFingerprint, selected_form_fingerprint: mapping.selectedFormFingerprint, field_count: fields.length, fields: [...fields], raw_content_persisted: false, full_html_persisted: false, secrets_persisted: false, evidence_bounded: true };
}

function preSubmitMetadata(mapping: ContactFormMappingPreview, control: ContactFormSubmitControl, allowance: ContactFormSubmitRequestAllowance): Json {
  return { version: "contact_form_pre_submit_v1", mapping_fingerprint: mapping.mappingFingerprint, selected_form_fingerprint: mapping.selectedFormFingerprint, submit_control_fingerprint: control.fingerprint, form_method: allowance.method, form_action_origin_fingerprint: contactFormSafeFingerprint(allowance.origin), form_action_path: allowance.path, form_action_search_fingerprint: contactFormSafeFingerprint(allowance.search), values_verified: true, raw_content_persisted: false, full_html_persisted: false, evidence_bounded: true };
}

function submittingMetadata(mapping: ContactFormMappingPreview, control: ContactFormSubmitControl, allowance: ContactFormSubmitRequestAllowance): Json {
  return { version: "contact_form_submit_v1", mapping_fingerprint: mapping.mappingFingerprint, submit_control_fingerprint: control.fingerprint, form_method: allowance.method, form_action_origin_fingerprint: contactFormSafeFingerprint(allowance.origin), form_action_path: allowance.path, form_action_search_fingerprint: contactFormSafeFingerprint(allowance.search), durable_submitting_before_click: true, one_shot_submit_allowance: true, max_external_submit_actions_per_run: 1, external_submit_action: "locator.click", no_retry_after_submit: true, raw_content_persisted: false, full_html_persisted: false, evidence_bounded: true };
}

function fieldValueEvidence(field: ContactFormMappedFieldPreview, normalizedValue: string): Json {
  return { semantic_field: field.semanticField, control_fingerprint: field.fieldFingerprint, control_type: field.controlType, required: field.required, normalized_length: normalizedValue.length, value_fingerprint: contactFormSafeFingerprint({ semantic_field: field.semanticField, normalized_value: normalizedValue }), raw_value_persisted: false };
}

async function transitionBlocked(run: ContactFormRun, workerId: string, deps: ContactFormControlledSubmissionDependencies, failureValue: SubmissionFailure): Promise<ContactFormControlledSubmissionResult> {
  try {
    const transitioned = await deps.transitionRun({
      runId: run.id,
      workerId,
      nextState: failureValue.state,
      eventType: failureValue.eventType,
      safeErrorCode: failureValue.code,
      safeMetadata: failureValue.metadata,
    });
    return { kind: "blocked", run: transitioned, state: failureValue.state, safeErrorCode: failureValue.code };
  } catch (error) {
    if (isLeaseLostError(error)) return { kind: "lease_lost", runId: run.id, clickMayHaveOccurred: false };
    throw error;
  }
}

async function markAmbiguous(run: ContactFormRun, workerId: string, deps: ContactFormControlledSubmissionDependencies, observation: ContactFormConfirmationObservation, code: string): Promise<ContactFormControlledSubmissionResult> {
  try {
    const transitioned = await deps.transitionRun({
      runId: run.id,
      workerId,
      nextState: "submission_ambiguous",
      eventType: "submission_ambiguous",
      safeErrorCode: code,
      safeMetadata: ambiguityMetadata(observation),
      finalUrl: observation.finalUrl,
    });
    return { kind: "submission_ambiguous", run: transitioned, observation, safeErrorCode: code };
  } catch (error) {
    if (isLeaseLostError(error)) return { kind: "lease_lost", runId: run.id, clickMayHaveOccurred: true };
    throw error;
  }
}

function ambiguityMetadata(observation: ContactFormConfirmationObservation): Json {
  if (observation.confirmed) return { version: "contact_form_submission_ambiguity_v1", reason: "unsafe_confirmation_observation", confirmation_kind: observation.kind, final_url_fingerprint: contactFormSafeFingerprint(observation.finalUrl), click_may_have_occurred: true, automatic_retry: false, evidence_bounded: true };
  return { version: "contact_form_submission_ambiguity_v1", reason: observation.reason, final_url_fingerprint: contactFormSafeFingerprint(observation.finalUrl), http_status: observation.httpStatus ?? null, form_present: observation.formPresent ?? null, click_may_have_occurred: true, automatic_retry: false, evidence_bounded: true };
}

function ambiguousObservation(finalUrl: string, reason: string): Extract<ContactFormConfirmationObservation, { confirmed: false }> {
  return { confirmed: false, finalUrl, reason };
}

function isConfirmationObservationSafe(observation: Extract<ContactFormConfirmationObservation, { confirmed: true }>, expectedOrigin: string): boolean {
  let finalUrl: URL;
  try {
    finalUrl = new URL(observation.finalUrl);
  } catch {
    return false;
  }
  if (finalUrl.protocol !== "https:" || finalUrl.origin !== expectedOrigin) return false;
  if (observation.kind === "KNOWN_SAME_HOST_CONFIRMATION_PATH") return isKnownSameHostConfirmationPath(finalUrl.pathname);
  return observation.evidenceFingerprint.startsWith("sha256:");
}

function confirmationEvidenceReference(runId: string, observation: Extract<ContactFormConfirmationObservation, { confirmed: true }>): string {
  return `c5_confirmation:${runId}:${contactFormSafeFingerprint({ kind: observation.kind, final_url: observation.finalUrl, evidence: observation.evidenceFingerprint }).slice("sha256:".length, "sha256:".length + 24)}`;
}

function failure(state: ContactFormSubmissionBlockState, code: string, eventType: string, metadata: Json): SubmissionFailure {
  return { ok: false, state, code, eventType, metadata };
}

function stale(code: string, reason: string): SubmissionFailure {
  return { ok: false, state: "manual_review", code, eventType: "approval_revalidation_failed", metadata: { reason } };
}

function normalizeSubmittedValue(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

function trimToNull(value: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && /timeout/i.test(error.message);
}

function isLeaseLostError(error: unknown): boolean {
  if (error instanceof Error) {
    if (error.message.includes("CONTACT_FORM_RUN_LEASE_LOST")) return true;
    const cause = error.cause;
    return cause instanceof Error && cause.message.includes("CONTACT_FORM_RUN_LEASE_LOST");
  }
  return false;
}

function stableStringify(value: Json): string {
  if (value == null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const entries = Object.entries(value)
    .filter((entry): entry is [string, Json] => entry[1] !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
}
