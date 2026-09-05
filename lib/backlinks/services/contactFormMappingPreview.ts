import { createHash } from "node:crypto";

import type { Json } from "@/types/database.types";

export const CONTACT_FORM_SUPPORTED_SEMANTIC_FIELDS = ["sender_name", "sender_email", "sender_company", "sender_website", "subject", "message"] as const;
export const CONTACT_FORM_SUPPORTED_CONTROL_TYPES = ["text", "email", "url", "textarea"] as const;

export type ContactFormSupportedSemanticField = (typeof CONTACT_FORM_SUPPORTED_SEMANTIC_FIELDS)[number];
export type ContactFormSupportedControlType = (typeof CONTACT_FORM_SUPPORTED_CONTROL_TYPES)[number];
export type ContactFormPreviewControlType = ContactFormSupportedControlType | "select";
export type ContactFormFieldClassification = "SUPPORTED_EXACT" | "SUPPORTED_OPTIONAL" | "UNSUPPORTED" | "AMBIGUOUS" | "IGNORED_SAFE" | "BLOCKING";
export type ContactFormMappingStatus = "mapped" | "manual_review" | "blocked_policy" | "blocked_captcha";

export type ContactFormApprovedContent = Readonly<{
  senderName: string;
  senderEmail: string;
  senderCompany: string;
  senderWebsite: string;
  subject: string;
  body: string;
}>;

export type ContactFormDiscoveredSelectOption = Readonly<{
  ordinal: number;
  labelText: string;
  normalizedLabel?: string;
  valuePresent: boolean;
  disabled: boolean;
  selected: boolean;
}>;

export type ContactFormDiscoveredControl = Readonly<{
  ordinal: number;
  tag: "input" | "textarea" | "select" | "button";
  type: string;
  name: string | null;
  id: string | null;
  autocomplete: string | null;
  labelText: string | null;
  ariaLabel: string | null;
  ariaLabelledbyText: string | null;
  placeholder: string | null;
  required: boolean;
  disabled: boolean;
  readOnly: boolean;
  hidden: boolean;
  visible: boolean;
  valuePresent: boolean;
  optionsCount?: number;
  options?: readonly ContactFormDiscoveredSelectOption[];
}>;

export type ContactFormDiscoveredForm = Readonly<{
  ordinal: number;
  action: string | null;
  method: string | null;
  labelText: string | null;
  legendText: string | null;
  buttonText: string | null;
  controls: readonly ContactFormDiscoveredControl[];
}>;

export type ContactFormDiscoveredPage = Readonly<{
  pageUrl: string;
  pageTitle: string;
  forms: readonly ContactFormDiscoveredForm[];
}>;

export type ContactFormFieldPreview = Readonly<{
  controlOrdinal: number;
  fieldFingerprint: string;
  tag: ContactFormDiscoveredControl["tag"];
  type: string;
  name: string | null;
  id: string | null;
  labelText: string | null;
  required: boolean;
  classification: ContactFormFieldClassification;
  semanticCandidates: readonly ContactFormSupportedSemanticField[];
  blockingReason: string | null;
  selectOptions?: readonly ContactFormSelectOptionPreview[];
  selectOption?: ContactFormSelectOptionPreview | null;
}>;

export type ContactFormSelectOptionPreview = Readonly<{
  ordinal: number;
  labelText: string;
  normalizedLabel: string;
  valuePresent: boolean;
  disabled: boolean;
  selected: boolean;
  optionFingerprint: string;
}>;

export type ContactFormMappedFieldPreview = Readonly<{
  semanticField: ContactFormSupportedSemanticField;
  fieldFingerprint: string;
  locator: Readonly<{
    strategy: "field_fingerprint";
    formOrdinal: number;
    controlOrdinal: number;
    name: string | null;
    id: string | null;
  }>;
  controlType: ContactFormPreviewControlType;
  required: boolean;
  classification: "SUPPORTED_EXACT" | "SUPPORTED_OPTIONAL";
  assignmentType: "field_value" | "select_option";
  selectOption: ContactFormSelectOptionPreview | null;
  sourceValueFingerprint: string;
  sourceValueLength: number;
  sourceValueRedaction: string;
}>;

export type ContactFormMappingPreview = Readonly<{
  version: "contact_form_mapping_preview_v1";
  result: ContactFormMappingStatus;
  selectedFormOrdinal: number | null;
  selectedFormFingerprint: string | null;
  formActionOrigin: string | null;
  formActionPath: string | null;
  formActionSearch: string | null;
  formMethod: "GET" | "POST" | "UNKNOWN" | null;
  formCount: number;
  candidateCount: number;
  mappedFields: readonly ContactFormMappedFieldPreview[];
  discoveredFields: readonly ContactFormFieldPreview[];
  unsupportedRequiredFields: readonly ContactFormFieldPreview[];
  blockingReasons: readonly string[];
  mappingFingerprint: string | null;
  evidenceBounded: true;
  fullHtmlPersisted: false;
}>;

type SemanticScore = Readonly<{ semantic: ContactFormSupportedSemanticField; score: number; source: "strong" | "weak" }>;
type FormAnalysis = Readonly<{
  form: ContactFormDiscoveredForm;
  score: number;
  purpose: string;
  preview: ContactFormMappingPreview;
}>;

const REQUIRED_SEMANTIC_FIELDS = new Set<ContactFormSupportedSemanticField>(["sender_name", "sender_email", "message"]);
const OPTIONAL_SEMANTIC_FIELDS = new Set<ContactFormSupportedSemanticField>(["sender_company", "sender_website", "subject"]);
const MAX_FORMS = 5;
const MAX_CONTROLS_PER_FORM = 30;
const MAX_SELECT_OPTIONS = 50;
const MAX_TEXT_LENGTH = 80;
const MAPPING_SCORE_THRESHOLD = 4;
const SAFE_GENERIC_SELECT_LABELS = new Set(["other", "general inquiry", "general enquiry"]);
const UNSAFE_SELECT_LABEL_PATTERN = /\b(partnership|sponsorship|media|membership|regulatory|committee|join|sales|demo|support)\b/;

export function buildContactFormMappingPreview(input: {
  page: ContactFormDiscoveredPage;
  approvedContent: ContactFormApprovedContent;
  pageSignals?: Readonly<{ hasCaptcha?: boolean; hasLoginWall?: boolean; hasPasswordField?: boolean }>;
}): ContactFormMappingPreview {
  const page = sanitizePage(input.page);
  const forms = page.forms;
  if (input.pageSignals?.hasCaptcha) return terminalPreview("blocked_captcha", forms, ["captcha_detected"]);
  if (input.pageSignals?.hasLoginWall || input.pageSignals?.hasPasswordField) return terminalPreview("manual_review", forms, ["login_wall_detected"]);
  if (!forms.length) return terminalPreview("manual_review", forms, ["no_candidate_form"]);

  const analyses = forms.map((form) => analyzeForm(form, page.pageUrl, input.approvedContent, forms.length));
  const captchaAnalysis = analyses.find((analysis) => analysis.preview.result === "blocked_captcha");
  if (captchaAnalysis) return captchaAnalysis.preview;

  const mapped = analyses.filter((analysis) => analysis.preview.result === "mapped");
  if (mapped.length === 1) return mapped[0].preview;
  if (mapped.length > 1) {
    const highest = Math.max(...mapped.map((analysis) => analysis.score));
    const tied = mapped.filter((analysis) => analysis.score === highest);
    if (tied.length === 1 && highest - Math.max(...mapped.filter((analysis) => analysis !== tied[0]).map((analysis) => analysis.score)) >= 3) return tied[0].preview;
    return terminalPreview("manual_review", forms, ["multiple_plausible_contact_forms"]);
  }

  const policy = analyses.find((analysis) => analysis.preview.result === "blocked_policy");
  if (policy) return policy.preview;
  const bestManual = [...analyses].sort((a, b) => b.score - a.score)[0];
  return bestManual?.preview ?? terminalPreview("manual_review", forms, ["no_candidate_form"]);
}

export function contactFormMappingPreviewToSafeMetadata(preview: ContactFormMappingPreview): Json {
  return {
    version: preview.version,
    result: preview.result,
    selected_form_ordinal: preview.selectedFormOrdinal,
    selected_form_fingerprint: preview.selectedFormFingerprint,
    form_action_origin: preview.formActionOrigin,
    form_action_path: preview.formActionPath,
    form_action_search_fingerprint: preview.formActionSearch == null ? null : fingerprint(preview.formActionSearch),
    form_method: preview.formMethod,
    form_count: preview.formCount,
    candidate_count: preview.candidateCount,
    mapped_fields: preview.mappedFields.map((field) => ({
      semantic_field: field.semanticField,
      field_fingerprint: field.fieldFingerprint,
      locator: {
        strategy: field.locator.strategy,
        form_ordinal: field.locator.formOrdinal,
        control_ordinal: field.locator.controlOrdinal,
        name: field.locator.name,
        id: field.locator.id,
      },
      control_type: field.controlType,
      required: field.required,
      classification: field.classification,
      assignment_type: field.assignmentType,
      select_option:
        field.selectOption == null
          ? null
          : {
              option_ordinal: field.selectOption.ordinal,
              label_text: field.selectOption.labelText,
              normalized_label: field.selectOption.normalizedLabel,
              value_present: field.selectOption.valuePresent,
              disabled: field.selectOption.disabled,
              selected: field.selectOption.selected,
              option_fingerprint: field.selectOption.optionFingerprint,
            },
      source_value_fingerprint: field.sourceValueFingerprint,
      source_value_length: field.sourceValueLength,
      source_value_redaction: field.sourceValueRedaction,
    })),
    discovered_fields: preview.discoveredFields.map((field) => ({
      control_ordinal: field.controlOrdinal,
      field_fingerprint: field.fieldFingerprint,
      tag: field.tag,
      type: field.type,
      name: field.name,
      id: field.id,
      label_text: field.labelText,
      required: field.required,
      classification: field.classification,
      semantic_candidates: [...field.semanticCandidates],
      blocking_reason: field.blockingReason,
      select_options: (field.selectOptions ?? []).map((option) => ({
        option_ordinal: option.ordinal,
        label_text: option.labelText,
        normalized_label: option.normalizedLabel,
        value_present: option.valuePresent,
        disabled: option.disabled,
        selected: option.selected,
        option_fingerprint: option.optionFingerprint,
      })),
      select_option:
        field.selectOption == null
          ? null
          : {
              option_ordinal: field.selectOption.ordinal,
              label_text: field.selectOption.labelText,
              normalized_label: field.selectOption.normalizedLabel,
              value_present: field.selectOption.valuePresent,
              disabled: field.selectOption.disabled,
              selected: field.selectOption.selected,
              option_fingerprint: field.selectOption.optionFingerprint,
            },
    })),
    unsupported_required_fields: preview.unsupportedRequiredFields.map((field) => ({
      control_ordinal: field.controlOrdinal,
      field_fingerprint: field.fieldFingerprint,
      tag: field.tag,
      type: field.type,
      name: field.name,
      id: field.id,
      label_text: field.labelText,
      required: field.required,
      classification: field.classification,
      blocking_reason: field.blockingReason,
      select_options: (field.selectOptions ?? []).map((option) => ({
        option_ordinal: option.ordinal,
        label_text: option.labelText,
        normalized_label: option.normalizedLabel,
        value_present: option.valuePresent,
        disabled: option.disabled,
        selected: option.selected,
        option_fingerprint: option.optionFingerprint,
      })),
    })),
    blocking_reasons: [...preview.blockingReasons],
    mapping_fingerprint: preview.mappingFingerprint,
    evidence_bounded: preview.evidenceBounded,
    full_html_persisted: preview.fullHtmlPersisted,
  };
}

function analyzeForm(form: ContactFormDiscoveredForm, pageUrl: string, approvedContent: ContactFormApprovedContent, formCount: number): FormAnalysis {
  const purpose = classifyFormPurpose(form);
  const fields = form.controls.map((control) => classifyControl(form, control));
  const unsupportedRequiredFields = fields.filter((field) => field.required && (field.classification === "UNSUPPORTED" || field.classification === "BLOCKING" || field.classification === "AMBIGUOUS"));
  const baseScore = scoreForm(form, fields);
  const action = normalizeFormAction(form.action, pageUrl);
  const method = normalizeFormMethod(form.method);
  const formFingerprint = fingerprint({
    action_origin: action.origin,
    action_path: action.path,
    action_search: action.search,
    method,
    fields: fields.map((field) => ({ fingerprint: field.fieldFingerprint, classification: field.classification, required: field.required, candidates: [...field.semanticCandidates] })),
  });

  const terminal = (result: ContactFormMappingStatus, reasons: readonly string[]): FormAnalysis => ({
    form,
    score: baseScore,
    purpose,
    preview: {
      version: "contact_form_mapping_preview_v1",
      result,
      selectedFormOrdinal: form.ordinal,
      selectedFormFingerprint: formFingerprint,
      formActionOrigin: action.origin,
      formActionPath: action.path,
      formActionSearch: action.search,
      formMethod: method,
      formCount,
      candidateCount: result === "mapped" ? 1 : 0,
      mappedFields: [],
      discoveredFields: fields,
      unsupportedRequiredFields,
      blockingReasons: uniqueStrings(reasons),
      mappingFingerprint: null,
      evidenceBounded: true,
      fullHtmlPersisted: false,
    },
  });

  if (purpose === "captcha") return terminal("blocked_captcha", ["captcha_detected"]);
  if (purpose === "login" || purpose === "registration" || purpose === "checkout" || purpose === "booking" || purpose === "job_application" || purpose === "newsletter_only") return terminal("manual_review", [`${purpose}_form_detected`]);
  if (unsupportedRequiredFields.some((field) => field.blockingReason === "required_consent_control")) return terminal("blocked_policy", ["required_consent_control"]);
  if (fields.some((field) => field.blockingReason === "file_upload_control")) return terminal("manual_review", ["file_upload_control"]);
  if (unsupportedRequiredFields.some((field) => field.blockingReason === "required_select_control")) return terminal("manual_review", ["required_select_control"]);
  if (unsupportedRequiredFields.some((field) => field.blockingReason === "required_choice_control")) return terminal("manual_review", ["required_choice_control"]);
  if (unsupportedRequiredFields.some((field) => field.blockingReason === "required_non_writable_control")) return terminal("manual_review", ["required_non_writable_control"]);
  if (unsupportedRequiredFields.length > 0) return terminal("manual_review", unsupportedRequiredFields.map((field) => field.blockingReason ?? "required_unsupported_field"));

  const mapping = mapFields(form, fields, approvedContent);
  if (!mapping.ok) return terminal("manual_review", mapping.reasons);
  const mappingFingerprint = fingerprint({
    form: formFingerprint,
    mapped_fields: mapping.fields.map((field) => ({
      semantic_field: field.semanticField,
      field_fingerprint: field.fieldFingerprint,
      control_type: field.controlType,
      required: field.required,
      assignment_type: field.assignmentType,
      select_option_fingerprint: field.selectOption?.optionFingerprint ?? null,
    })),
  });

  return {
    form,
    score: baseScore + mapping.fields.length,
    purpose,
    preview: {
      version: "contact_form_mapping_preview_v1",
      result: "mapped",
      selectedFormOrdinal: form.ordinal,
      selectedFormFingerprint: formFingerprint,
      formActionOrigin: action.origin,
      formActionPath: action.path,
      formActionSearch: action.search,
      formMethod: method,
      formCount,
      candidateCount: 1,
      mappedFields: mapping.fields,
      discoveredFields: fields,
      unsupportedRequiredFields,
      blockingReasons: [],
      mappingFingerprint,
      evidenceBounded: true,
      fullHtmlPersisted: false,
    },
  };
}

function classifyControl(form: ContactFormDiscoveredForm, control: ContactFormDiscoveredControl): ContactFormFieldPreview {
  const fieldFingerprint = fingerprint({
    ordinal: control.ordinal,
    tag: control.tag,
    type: normalizeControlType(control),
    name: control.name,
    id: control.id,
    autocomplete: control.autocomplete,
    label: control.labelText,
    aria_label: control.ariaLabel,
    aria_labelledby: control.ariaLabelledbyText,
    required: control.required,
    visible: control.visible,
  });
  const selectOptions = control.tag === "select" ? buildSelectOptionPreviews(fieldFingerprint, control) : undefined;
  const generalBlockingReason = blockingReasonForNonSelectControl(form, control);
  if (generalBlockingReason) {
    return { controlOrdinal: control.ordinal, fieldFingerprint, tag: control.tag, type: normalizeControlType(control), name: control.name, id: control.id, labelText: control.labelText, required: control.required, classification: control.hidden ? "IGNORED_SAFE" : "BLOCKING", semanticCandidates: [], blockingReason: generalBlockingReason, selectOptions };
  }
  if (control.tag === "select") {
    return classifySelectControl(form, control, fieldFingerprint, selectOptions ?? []);
  }
  const blockingReason = blockingReasonForControl(form, control);
  if (blockingReason) {
    return { controlOrdinal: control.ordinal, fieldFingerprint, tag: control.tag, type: normalizeControlType(control), name: control.name, id: control.id, labelText: control.labelText, required: control.required, classification: control.hidden ? "IGNORED_SAFE" : "BLOCKING", semanticCandidates: [], blockingReason };
  }
  if (!isWritablePreviewCandidate(control)) {
    return { controlOrdinal: control.ordinal, fieldFingerprint, tag: control.tag, type: normalizeControlType(control), name: control.name, id: control.id, labelText: control.labelText, required: control.required, classification: "IGNORED_SAFE", semanticCandidates: [], blockingReason: null };
  }
  const scores = scoreSemantics(control).filter((score) => score.score >= MAPPING_SCORE_THRESHOLD).sort((a, b) => b.score - a.score || CONTACT_FORM_SUPPORTED_SEMANTIC_FIELDS.indexOf(a.semantic) - CONTACT_FORM_SUPPORTED_SEMANTIC_FIELDS.indexOf(b.semantic));
  const topScore = scores[0]?.score ?? 0;
  const top = scores.filter((score) => score.score === topScore);
  if (top.length > 1) {
    return { controlOrdinal: control.ordinal, fieldFingerprint, tag: control.tag, type: normalizeControlType(control), name: control.name, id: control.id, labelText: control.labelText, required: control.required, classification: "AMBIGUOUS", semanticCandidates: top.map((score) => score.semantic), blockingReason: "ambiguous_semantic_field" };
  }
  if (!scores.length) {
    return { controlOrdinal: control.ordinal, fieldFingerprint, tag: control.tag, type: normalizeControlType(control), name: control.name, id: control.id, labelText: control.labelText, required: control.required, classification: control.required ? "UNSUPPORTED" : "IGNORED_SAFE", semanticCandidates: [], blockingReason: control.required ? "required_unsupported_field" : null };
  }
  const semantic = scores[0].semantic;
  return {
    controlOrdinal: control.ordinal,
    fieldFingerprint,
    tag: control.tag,
    type: normalizeControlType(control),
    name: control.name,
    id: control.id,
    labelText: control.labelText,
    required: control.required,
    classification: OPTIONAL_SEMANTIC_FIELDS.has(semantic) && !control.required ? "SUPPORTED_OPTIONAL" : "SUPPORTED_EXACT",
    semanticCandidates: [semantic],
    blockingReason: null,
  };
}

function mapFields(
  form: ContactFormDiscoveredForm,
  fields: readonly ContactFormFieldPreview[],
  approvedContent: ContactFormApprovedContent,
): { ok: true; fields: readonly ContactFormMappedFieldPreview[] } | { ok: false; reasons: readonly string[] } {
  const reasons: string[] = [];
  const mapped: ContactFormMappedFieldPreview[] = [];
  const usedControls = new Set<number>();
  const requiresSplitSenderName = hasRequiredSplitSenderName(form);
  if (requiresSplitSenderName) reasons.push("required_split_sender_name");
  for (const semantic of CONTACT_FORM_SUPPORTED_SEMANTIC_FIELDS) {
    if (semantic === "sender_name" && requiresSplitSenderName) continue;
    const candidates = fields.filter((field) => field.semanticCandidates.includes(semantic));
    if (candidates.length > 1) {
      reasons.push(`ambiguous_${semantic}`);
      continue;
    }
    const candidate = candidates[0];
    if (!candidate) {
      if (REQUIRED_SEMANTIC_FIELDS.has(semantic)) reasons.push(`missing_${semantic}`);
      continue;
    }
    if (usedControls.has(candidate.controlOrdinal)) {
      if (REQUIRED_SEMANTIC_FIELDS.has(semantic)) reasons.push(`duplicate_control_${semantic}`);
      continue;
    }
    const control = form.controls.find((current) => current.ordinal === candidate.controlOrdinal);
    if (candidate.selectOption != null) {
      if (!control || normalizeControlType(control) !== "select" || control.valuePresent || candidate.selectOption.disabled || !candidate.selectOption.valuePresent) {
        reasons.push(control?.valuePresent ? `prefilled_${semantic}` : `unsupported_${semantic}`);
        continue;
      }
      usedControls.add(candidate.controlOrdinal);
      const sourceValue = candidate.selectOption.normalizedLabel;
      mapped.push({
        semanticField: semantic,
        fieldFingerprint: candidate.fieldFingerprint,
        locator: { strategy: "field_fingerprint", formOrdinal: form.ordinal, controlOrdinal: candidate.controlOrdinal, name: candidate.name, id: candidate.id },
        controlType: "select",
        required: candidate.required,
        classification: candidate.classification === "SUPPORTED_OPTIONAL" ? "SUPPORTED_OPTIONAL" : "SUPPORTED_EXACT",
        assignmentType: "select_option",
        selectOption: candidate.selectOption,
        sourceValueFingerprint: candidate.selectOption.optionFingerprint,
        sourceValueLength: sourceValue.length,
        sourceValueRedaction: `<select-option:${sourceValue}>`,
      });
      continue;
    }
    if (!control || !isSupportedControlType(normalizeControlType(control)) || control.valuePresent) {
      reasons.push(control?.valuePresent ? `prefilled_${semantic}` : `unsupported_${semantic}`);
      continue;
    }
    usedControls.add(candidate.controlOrdinal);
    const sourceValue = sourceValueForSemantic(approvedContent, semantic);
    mapped.push({
      semanticField: semantic,
      fieldFingerprint: candidate.fieldFingerprint,
      locator: { strategy: "field_fingerprint", formOrdinal: form.ordinal, controlOrdinal: candidate.controlOrdinal, name: candidate.name, id: candidate.id },
      controlType: normalizeControlType(control) as ContactFormSupportedControlType,
      required: candidate.required,
      classification: candidate.classification === "SUPPORTED_OPTIONAL" ? "SUPPORTED_OPTIONAL" : "SUPPORTED_EXACT",
      assignmentType: "field_value",
      selectOption: null,
      sourceValueFingerprint: fingerprint({ semantic, value: sourceValue }),
      sourceValueLength: sourceValue.length,
      sourceValueRedaction: `<redacted:${sourceValue.length}>`,
    });
  }
  return reasons.length ? { ok: false, reasons: uniqueStrings(reasons) } : { ok: true, fields: mapped };
}

function classifySelectControl(form: ContactFormDiscoveredForm, control: ContactFormDiscoveredControl, fieldFingerprint: string, selectOptions: readonly ContactFormSelectOptionPreview[]): ContactFormFieldPreview {
  if (!control.required) {
    return { controlOrdinal: control.ordinal, fieldFingerprint, tag: control.tag, type: "select", name: control.name, id: control.id, labelText: control.labelText, required: control.required, classification: "IGNORED_SAFE", semanticCandidates: [], blockingReason: null, selectOptions };
  }
  if (control.valuePresent) {
    return { controlOrdinal: control.ordinal, fieldFingerprint, tag: control.tag, type: "select", name: control.name, id: control.id, labelText: control.labelText, required: control.required, classification: "BLOCKING", semanticCandidates: [], blockingReason: "required_select_prefilled", selectOptions };
  }
  const scores = scoreSemantics(control).filter((score) => score.semantic === "subject" && score.score >= MAPPING_SCORE_THRESHOLD);
  if (!scores.length) {
    return { controlOrdinal: control.ordinal, fieldFingerprint, tag: control.tag, type: "select", name: control.name, id: control.id, labelText: control.labelText, required: control.required, classification: "BLOCKING", semanticCandidates: [], blockingReason: "required_select_control", selectOptions };
  }
  const safeChoice = deterministicSafeSelectOption(selectOptions);
  if (!safeChoice.ok) {
    return { controlOrdinal: control.ordinal, fieldFingerprint, tag: control.tag, type: "select", name: control.name, id: control.id, labelText: control.labelText, required: control.required, classification: "BLOCKING", semanticCandidates: [], blockingReason: safeChoice.reason, selectOptions };
  }
  return { controlOrdinal: control.ordinal, fieldFingerprint, tag: control.tag, type: "select", name: control.name, id: control.id, labelText: control.labelText, required: control.required, classification: "SUPPORTED_EXACT", semanticCandidates: ["subject"], blockingReason: null, selectOptions, selectOption: safeChoice.option };
}

function buildSelectOptionPreviews(fieldFingerprint: string, control: ContactFormDiscoveredControl): readonly ContactFormSelectOptionPreview[] {
  return (control.options ?? []).slice(0, MAX_SELECT_OPTIONS).map((option, optionIndex) => {
    const labelText = clamp(option.labelText, MAX_TEXT_LENGTH);
    const normalizedLabel = normalizeText(option.normalizedLabel ?? labelText);
    return {
      ordinal: Number.isInteger(option.ordinal) ? option.ordinal : optionIndex,
      labelText,
      normalizedLabel,
      valuePresent: Boolean(option.valuePresent),
      disabled: Boolean(option.disabled),
      selected: Boolean(option.selected),
      optionFingerprint: fingerprint({
        select_fingerprint: fieldFingerprint,
        option_ordinal: Number.isInteger(option.ordinal) ? option.ordinal : optionIndex,
        normalized_label: normalizedLabel,
        value_present: Boolean(option.valuePresent),
        disabled: Boolean(option.disabled),
        selected: Boolean(option.selected),
      }),
    };
  });
}

function deterministicSafeSelectOption(options: readonly ContactFormSelectOptionPreview[]): { ok: true; option: ContactFormSelectOptionPreview } | { ok: false; reason: string } {
  const safeOptions = options.filter((option) => option.valuePresent && !option.disabled && SAFE_GENERIC_SELECT_LABELS.has(option.normalizedLabel) && !UNSAFE_SELECT_LABEL_PATTERN.test(option.normalizedLabel));
  if (safeOptions.length === 1) return { ok: true, option: safeOptions[0] };
  if (safeOptions.length > 1) return { ok: false, reason: "required_select_ambiguous_safe_option" };
  return { ok: false, reason: "required_select_no_safe_option" };
}

function blockingReasonForNonSelectControl(form: ContactFormDiscoveredForm, control: ContactFormDiscoveredControl): string | null {
  const type = normalizeControlType(control);
  const text = controlText(form, control);
  if (/(captcha|recaptcha|hcaptcha|turnstile)/.test(text) || control.name === "cf-turnstile-response" || control.name === "g-recaptcha-response" || control.name === "h-captcha-response") return "captcha_control";
  if (control.hidden || type === "hidden") return "hidden_field_ignored";
  if (type === "password") return "password_control";
  if (type === "file") return "file_upload_control";
  if (control.disabled || control.readOnly) return control.required ? "required_non_writable_control" : null;
  return null;
}

function blockingReasonForControl(form: ContactFormDiscoveredForm, control: ContactFormDiscoveredControl): string | null {
  const type = normalizeControlType(control);
  const text = controlText(form, control);
  if (type === "checkbox" || type === "radio") {
    if (control.required && /(terms|privacy|policy|consent|agree|gdpr|subscribe|newsletter|marketing|legal)/.test(text)) return "required_consent_control";
    return control.required ? "required_choice_control" : null;
  }
  if (["date", "time", "datetime-local", "number", "range", "color", "month", "week"].includes(type)) return control.required ? "required_unsupported_field" : null;
  return null;
}

function scoreSemantics(control: ContactFormDiscoveredControl): readonly SemanticScore[] {
  const type = normalizeControlType(control);
  const strong = normalizeText([control.labelText, control.ariaLabel, control.ariaLabelledbyText, control.name, control.id, control.autocomplete].filter(Boolean).join(" "));
  const weak = normalizeText(control.placeholder ?? "");
  const scores: SemanticScore[] = [];
  const add = (semantic: ContactFormSupportedSemanticField, score: number, source: "strong" | "weak") => {
    if (score > 0) scores.push({ semantic, score, source });
  };
  add("sender_email", (type === "email" ? 5 : 0) + keywordScore(strong, ["email", "e-mail", "courriel"]) + weakKeywordScore(weak, ["email", "e-mail"]), type === "email" || keywordScore(strong, ["email", "e-mail", "courriel"]) > 0 ? "strong" : "weak");
  add("sender_website", (type === "url" ? 4 : 0) + keywordScore(strong, ["website", "web site", "site web", "url", "homepage"]) + weakKeywordScore(weak, ["website", "url"]), type === "url" || keywordScore(strong, ["website", "url", "homepage"]) > 0 ? "strong" : "weak");
  add("message", (control.tag === "textarea" ? 4 : 0) + keywordScore(strong, ["message", "comment", "comments", "inquiry", "enquiry", "details", "body"]) + weakKeywordScore(weak, ["message", "comment", "inquiry", "enquiry"]), control.tag === "textarea" || keywordScore(strong, ["message", "comment", "inquiry", "enquiry"]) > 0 ? "strong" : "weak");
  add("subject", keywordScore(strong, ["subject", "topic", "title", "objet"]) + weakKeywordScore(weak, ["subject", "topic"]), keywordScore(strong, ["subject", "topic", "title", "objet"]) > 0 ? "strong" : "weak");
  const companyPenalty = /\b(company|organisation|organization|business|agency|hotel)\b/.test(strong) ? -5 : 0;
  add("sender_name", keywordScore(strong, ["full name", "your name", "name", "nom"]) + autocompleteNameScore(control.autocomplete) + weakKeywordScore(weak, ["name"]) + companyPenalty, keywordScore(strong, ["full name", "your name", "name", "nom"]) > 0 || autocompleteNameScore(control.autocomplete) > 0 ? "strong" : "weak");
  add("sender_company", keywordScore(strong, ["company", "organisation", "organization", "business", "agency", "hotel"]) + weakKeywordScore(weak, ["company", "organization"]), keywordScore(strong, ["company", "organisation", "organization", "business", "agency", "hotel"]) > 0 ? "strong" : "weak");
  return scores.filter((score) => score.source === "strong" || score.score >= MAPPING_SCORE_THRESHOLD);
}

function classifyFormPurpose(form: ContactFormDiscoveredForm): string {
  const text = normalizeText([form.labelText, form.legendText, form.buttonText, ...form.controls.map((control) => controlText(form, control))].join(" "));
  const hasPassword = form.controls.some((control) => normalizeControlType(control) === "password");
  const hasFile = form.controls.some((control) => normalizeControlType(control) === "file");
  const hasTextarea = form.controls.some((control) => control.tag === "textarea");
  if (/(captcha|recaptcha|hcaptcha|turnstile|verify you are human|human verification)/.test(text)) return "captcha";
  if (hasPassword || /\b(sign in|log in|login|password|authentication required|members only)\b/.test(text)) return "login";
  if (/\b(register|registration|create account|create an account|join now|sign up)\b/.test(text) && !/\bnewsletter|subscribe\b/.test(text)) return "registration";
  if (/\b(checkout|payment|credit card|card number|billing|cart)\b/.test(text)) return "checkout";
  if (/\b(booking|reservation|reserve|check in|check-in|arrival|departure|guest)\b/.test(text)) return "booking";
  if (hasFile && /\b(cv|resume|job|career|application|apply)\b/.test(text)) return "job_application";
  if (/\b(job|career|application|apply|resume|cv)\b/.test(text)) return "job_application";
  const hasNewsletter = /\b(newsletter|subscribe|subscription|mailing list)\b/.test(text);
  const contactScore = scoreForm(form, form.controls.map((control) => classifyControlWithoutPurpose(form, control)));
  if (hasNewsletter && !hasTextarea && contactScore < 8) return "newsletter_only";
  return "candidate";
}

function classifyControlWithoutPurpose(form: ContactFormDiscoveredForm, control: ContactFormDiscoveredControl): ContactFormFieldPreview {
  const fieldFingerprint = fingerprint({ ordinal: control.ordinal, tag: control.tag, type: normalizeControlType(control), name: control.name, id: control.id, label: control.labelText, required: control.required });
  const scores = scoreSemantics(control).filter((score) => score.score >= MAPPING_SCORE_THRESHOLD);
  return { controlOrdinal: control.ordinal, fieldFingerprint, tag: control.tag, type: normalizeControlType(control), name: control.name, id: control.id, labelText: control.labelText, required: control.required, classification: scores.length ? "SUPPORTED_EXACT" : "IGNORED_SAFE", semanticCandidates: scores.map((score) => score.semantic), blockingReason: null };
}

function scoreForm(form: ContactFormDiscoveredForm, fields: readonly ContactFormFieldPreview[]): number {
  const text = normalizeText([form.labelText, form.legendText, form.buttonText].join(" "));
  let score = 0;
  if (/\b(contact|message|inquiry|enquiry|feedback|get in touch|reach us)\b/.test(text)) score += 4;
  if (fields.some((field) => field.semanticCandidates.includes("sender_email"))) score += 3;
  if (fields.some((field) => field.semanticCandidates.includes("sender_name"))) score += 2;
  if (fields.some((field) => field.semanticCandidates.includes("message"))) score += 4;
  if (fields.some((field) => field.semanticCandidates.includes("subject"))) score += 1;
  return score;
}

function terminalPreview(result: ContactFormMappingStatus, forms: readonly ContactFormDiscoveredForm[], reasons: readonly string[]): ContactFormMappingPreview {
  return {
    version: "contact_form_mapping_preview_v1",
    result,
    selectedFormOrdinal: null,
    selectedFormFingerprint: null,
    formActionOrigin: null,
    formActionPath: null,
    formActionSearch: null,
    formMethod: null,
    formCount: Math.min(forms.length, MAX_FORMS),
    candidateCount: 0,
    mappedFields: [],
    discoveredFields: [],
    unsupportedRequiredFields: [],
    blockingReasons: uniqueStrings(reasons),
    mappingFingerprint: null,
    evidenceBounded: true,
    fullHtmlPersisted: false,
  };
}

function isWritablePreviewCandidate(control: ContactFormDiscoveredControl): boolean {
  return control.visible && !control.disabled && !control.readOnly && !control.hidden && isSupportedControlType(normalizeControlType(control)) && !control.valuePresent;
}

function hasRequiredSplitSenderName(form: ContactFormDiscoveredForm): boolean {
  const requiredParts = form.controls
    .filter((control) => control.required && control.visible && !control.disabled && !control.readOnly && !control.hidden && isSupportedControlType(normalizeControlType(control)))
    .map((control) => ({ ordinal: control.ordinal, part: senderNamePart(form, control) }))
    .filter((item): item is { ordinal: number; part: "first" | "last" } => item.part != null);
  return requiredParts.some((item) => item.part === "first") && requiredParts.some((item) => item.part === "last");
}

function senderNamePart(form: ContactFormDiscoveredForm, control: ContactFormDiscoveredControl): "first" | "last" | null {
  const text = controlText(form, control);
  const autocomplete = normalizeText(control.autocomplete ?? "");
  const first = autocomplete === "given-name" || /\b(first|given|forename|prenom)\b/.test(text);
  const last = autocomplete === "family-name" || /\b(last|family|surname|nom de famille)\b/.test(text);
  if (first && !last) return "first";
  if (last && !first) return "last";
  return null;
}

function isSupportedControlType(type: string): type is ContactFormSupportedControlType {
  return CONTACT_FORM_SUPPORTED_CONTROL_TYPES.includes(type as ContactFormSupportedControlType);
}

function normalizeControlType(control: ContactFormDiscoveredControl): string {
  if (control.tag === "textarea") return "textarea";
  if (control.tag === "select") return "select";
  if (control.tag === "button") return control.type || "button";
  return normalizeText(control.type || "text") || "text";
}

function normalizeFormMethod(method: string | null): "GET" | "POST" | "UNKNOWN" {
  const normalized = normalizeText(method ?? "get").toUpperCase();
  return normalized === "GET" || normalized === "POST" ? normalized : "UNKNOWN";
}

function normalizeFormAction(action: string | null, pageUrl: string): { origin: string | null; path: string | null; search: string | null } {
  try {
    const url = new URL(action?.trim() || pageUrl, pageUrl);
    return { origin: url.origin, path: url.pathname || "/", search: url.search || "" };
  } catch {
    return { origin: null, path: null, search: null };
  }
}

function sourceValueForSemantic(content: ContactFormApprovedContent, semantic: ContactFormSupportedSemanticField): string {
  if (semantic === "sender_name") return content.senderName;
  if (semantic === "sender_email") return content.senderEmail;
  if (semantic === "sender_company") return content.senderCompany;
  if (semantic === "sender_website") return content.senderWebsite;
  if (semantic === "subject") return content.subject;
  return content.body;
}

function controlText(form: ContactFormDiscoveredForm, control: ContactFormDiscoveredControl): string {
  return normalizeText([form.labelText, form.legendText, form.buttonText, control.labelText, control.ariaLabel, control.ariaLabelledbyText, control.placeholder, control.name, control.id, control.autocomplete, control.type].filter(Boolean).join(" "));
}

function keywordScore(value: string, keywords: readonly string[]): number {
  return keywords.some((keyword) => value.includes(keyword)) ? 4 : 0;
}

function weakKeywordScore(value: string, keywords: readonly string[]): number {
  return keywords.some((keyword) => value.includes(keyword)) ? 1 : 0;
}

function autocompleteNameScore(value: string | null): number {
  const normalized = normalizeText(value ?? "");
  return ["name", "given-name", "family-name", "additional-name"].includes(normalized) ? 4 : 0;
}

function sanitizePage(page: ContactFormDiscoveredPage): ContactFormDiscoveredPage {
  return {
    pageUrl: clamp(page.pageUrl, 300),
    pageTitle: clamp(page.pageTitle, MAX_TEXT_LENGTH),
    forms: page.forms.slice(0, MAX_FORMS).map((form, formIndex) => ({
      ordinal: Number.isInteger(form.ordinal) ? form.ordinal : formIndex,
      action: nullableClamp(form.action, 300),
      method: nullableClamp(form.method, 12),
      labelText: nullableClamp(form.labelText, MAX_TEXT_LENGTH),
      legendText: nullableClamp(form.legendText, MAX_TEXT_LENGTH),
      buttonText: nullableClamp(form.buttonText, MAX_TEXT_LENGTH),
      controls: form.controls.slice(0, MAX_CONTROLS_PER_FORM).map((control, controlIndex) => ({
        ordinal: Number.isInteger(control.ordinal) ? control.ordinal : controlIndex,
        tag: control.tag,
        type: clamp(control.type || "text", 32),
        name: nullableClamp(control.name, MAX_TEXT_LENGTH),
        id: nullableClamp(control.id, MAX_TEXT_LENGTH),
        autocomplete: nullableClamp(control.autocomplete, MAX_TEXT_LENGTH),
        labelText: nullableClamp(control.labelText, MAX_TEXT_LENGTH),
        ariaLabel: nullableClamp(control.ariaLabel, MAX_TEXT_LENGTH),
        ariaLabelledbyText: nullableClamp(control.ariaLabelledbyText, MAX_TEXT_LENGTH),
        placeholder: nullableClamp(control.placeholder, MAX_TEXT_LENGTH),
        required: Boolean(control.required),
        disabled: Boolean(control.disabled),
        readOnly: Boolean(control.readOnly),
        hidden: Boolean(control.hidden),
        visible: Boolean(control.visible),
        valuePresent: Boolean(control.valuePresent),
        optionsCount: typeof control.optionsCount === "number" ? Math.max(0, Math.min(100, Math.floor(control.optionsCount))) : undefined,
        options:
          control.tag === "select"
            ? (control.options ?? []).slice(0, MAX_SELECT_OPTIONS).map((option, optionIndex) => ({
                ordinal: Number.isInteger(option.ordinal) ? option.ordinal : optionIndex,
                labelText: clamp(option.labelText, MAX_TEXT_LENGTH),
                normalizedLabel: normalizeText(option.normalizedLabel ?? option.labelText),
                valuePresent: Boolean(option.valuePresent),
                disabled: Boolean(option.disabled),
                selected: Boolean(option.selected),
              }))
            : undefined,
      })),
    })),
  };
}

function nullableClamp(value: string | null | undefined, limit: number): string | null {
  const text = clamp(value ?? "", limit);
  return text ? text : null;
}

function clamp(value: string, limit: number): string {
  const text = value.trim().replace(/\s+/g, " ");
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fingerprint(value: Json): string {
  return `sha256:${createHash("sha256").update(stableStringify(value)).digest("hex")}`;
}

function stableStringify(value: Json): string {
  if (value == null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const entries = Object.entries(value)
    .filter((entry): entry is [string, Json] => entry[1] !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
