import { createHash } from "node:crypto";

import { load } from "cheerio";

import { buildContactFormMappingPreview, type ContactFormDiscoveredControl, type ContactFormDiscoveredForm, type ContactFormDiscoveredPage } from "./contactFormMappingPreview";
import { buildContactFormVerificationEvidenceFromRuntime } from "./contactFormVerificationRuntimeAdapter";

export type ContactFormStaticHtmlParseResult = Readonly<{
  status: "verified" | "manual_review" | "failed";
  safeReasonCode: string | null;
  page: ContactFormDiscoveredPage | null;
  submitControls: readonly StaticSubmitControl[];
  indicators: Readonly<{ hasCaptcha: boolean; hasLoginWall: boolean; hasPasswordField: boolean; dynamicForm: boolean; visibilityAmbiguous: boolean }>;
  mapping: ReturnType<typeof buildContactFormMappingPreview> | null;
  evidence: ReturnType<typeof buildContactFormVerificationEvidenceFromRuntime> | null;
}>;

type StaticSubmitControl = Readonly<{ formOrdinal: number; controlOrdinal: number; tag: string; type: string; name: string | null; id: string | null; visible: boolean; enabled: boolean; disabled: boolean; hidden: boolean; fingerprint: string }>;

const APPROVED_CONTENT = { senderName: "Verification", senderFirstName: "Verification", senderLastName: "Only", senderEmail: "preflight@example.invalid", senderCompany: "Norixo", senderWebsite: "https://norixo.io/", subject: "Structural verification", body: "Structural verification only." };

function text(value: string | null | undefined): string | null {
  const normalized = value?.replace(/\s+/g, " ").trim() ?? "";
  return normalized ? normalized.slice(0, 300) : null;
}

function fingerprint(value: unknown): string { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function attr($element: ReturnType<ReturnType<typeof load>>): string | null { return text($element.attr("aria-label")); }

function isHidden($element: ReturnType<ReturnType<typeof load>>): boolean {
  const style = ($element.attr("style") ?? "").toLowerCase();
  return $element.is("[hidden]") || $element.attr("type")?.toLowerCase() === "hidden" || /display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?:\D|$)/.test(style);
}

function labelFor($: ReturnType<typeof load>, $form: ReturnType<ReturnType<typeof load>>, id: string | null, element: unknown): string | null {
  const direct = $(element as never).closest("label").text();
  const referenced = id == null ? "" : $form.find("label[for]").filter((_, label) => $(label).attr("for") === id).text();
  return text(`${direct} ${referenced}`);
}

function ariaLabelledBy($: ReturnType<typeof load>, ids: string | null): string | null {
  if (ids == null) return null;
  return text(ids.split(/\s+/).map((id) => $("[id]").filter((_, element) => $(element).attr("id") === id).text()).join(" "));
}

function actionFor(formAction: string | null, pageUrl: string): string | null {
  try { return new URL(formAction?.trim() || pageUrl, pageUrl).toString(); } catch { return null; }
}

function staticControl($: ReturnType<typeof load>, $form: ReturnType<ReturnType<typeof load>>, element: unknown, ordinal: number): ContactFormDiscoveredControl {
  const $element = $(element as never);
  const tag = String((element as { tagName?: string }).tagName ?? "").toLowerCase() as ContactFormDiscoveredControl["tag"];
  const rawType = ($element.attr("type") ?? (tag === "textarea" ? "textarea" : tag === "select" ? "select" : tag === "button" ? "submit" : "text")).toLowerCase();
  const id = text($element.attr("id"));
  const selectOptions = tag === "select" ? $element.find("option").toArray().slice(0, 50).map((option, optionOrdinal) => {
    const $option = $(option);
    const value = $option.attr("value") ?? $option.text();
    return { ordinal: optionOrdinal, labelText: text($option.text()) ?? "", valuePresent: value.trim().length > 0, disabled: $option.is(":disabled"), selected: $option.is(":selected") };
  }) : undefined;
  const currentValue = tag === "textarea" ? $element.text() : tag === "select" ? $element.find("option:selected").attr("value") ?? "" : $element.attr("value") ?? "";
  return {
    ordinal, tag, type: rawType, name: text($element.attr("name")), id, autocomplete: text($element.attr("autocomplete")),
    labelText: labelFor($, $form, id, element), ariaLabel: attr($element), ariaLabelledbyText: ariaLabelledBy($, text($element.attr("aria-labelledby"))), placeholder: text($element.attr("placeholder")),
    required: $element.is("[required]"), disabled: $element.is(":disabled"), readOnly: $element.is("[readonly]"), hidden: isHidden($element), visible: !isHidden($element), valuePresent: currentValue.trim().length > 0,
    ...(selectOptions == null ? {} : { optionsCount: selectOptions.length, options: selectOptions }),
  };
}

function extract(pageUrl: string, html: string): { page: ContactFormDiscoveredPage; submitControls: StaticSubmitControl[]; indicators: ContactFormStaticHtmlParseResult["indicators"]; externalAction: boolean } {
  const $ = load(html);
  const bodyText = text($("body").text())?.toLowerCase() ?? "";
  const hasCaptcha = /(captcha|recaptcha|hcaptcha|turnstile|verify you are human|human verification)/.test(bodyText) || $("[class*='captcha' i], [id*='captcha' i], [name='g-recaptcha-response'], [name='h-captcha-response'], [name='cf-turnstile-response']").length > 0;
  const hasPasswordField = $("input[type='password']").length > 0;
  const hasLoginWall = hasPasswordField || /\b(sign in|log in|login|required login|members only|authentication)\b/.test(bodyText);
  const forms = $("form").toArray().slice(0, 5).map((form, formOrdinal) => {
    const $form = $(form);
    const controls = $form.find("input, textarea, select, button").toArray().slice(0, 30).map((element, ordinal) => staticControl($, $form, element, ordinal));
    const action = actionFor(text($form.attr("action")), pageUrl);
    const buttonText = text($form.find("button, input[type='submit'], input[type='image']").first().text() || $form.find("input[type='submit'], input[type='image']").first().attr("value"));
    return { ordinal: formOrdinal, action, method: text($form.attr("method"))?.toUpperCase() ?? "GET", labelText: text($form.attr("aria-label")) ?? text($form.find("h1,h2,h3,h4,h5,h6").first().text()), legendText: text($form.find("legend").first().text()), buttonText, controls } satisfies ContactFormDiscoveredForm;
  });
  const submitControls = forms.flatMap((form) => form.controls.flatMap((control) => {
    const submit = (control.tag === "button" && (control.type === "" || control.type === "submit")) || (control.tag === "input" && (control.type === "submit" || control.type === "image"));
    return !submit ? [] : [{ formOrdinal: form.ordinal, controlOrdinal: control.ordinal, tag: control.tag, type: control.type, name: control.name, id: control.id, visible: control.visible, enabled: !control.disabled, disabled: control.disabled, hidden: control.hidden, fingerprint: fingerprint({ form: form.ordinal, control: control.ordinal, tag: control.tag, type: control.type, name: control.name, id: control.id }) }];
  }));
  const styleText = $("style").text().toLowerCase();
  const visibilityAmbiguous = $("style, link[rel~='stylesheet']").length > 0 || /display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?:\D|$)/.test(styleText);
  const scripts = $("script");
  const dynamicForm = scripts.length > 0 || /__next_data__|__next|react-root|data-reactroot|hydrateRoot|createRoot/.test(html);
  const page = { pageUrl, pageTitle: text($("title").first().text()) ?? "", forms } satisfies ContactFormDiscoveredPage;
  const origin = new URL(pageUrl).origin;
  const externalAction = forms.some((form) => form.action != null && new URL(form.action).origin !== origin);
  return { page, submitControls, indicators: { hasCaptcha, hasLoginWall, hasPasswordField, dynamicForm, visibilityAmbiguous }, externalAction };
}

export function parseStaticContactFormHtml(input: Readonly<{ finalUrl: string; html: string; contentType: string }>): ContactFormStaticHtmlParseResult {
  if (!input.html.trim() || !/^\s*(?:<!doctype[^>]*>|<html\b|<head\b|<body\b|<form\b)/i.test(input.html) || !/^(text\/html|application\/xhtml\+xml)(?:\s*;|$)/i.test(input.contentType)) return { status: "failed", safeReasonCode: "CONTACT_FORM_STATIC_HTML_INVALID", page: null, submitControls: [], indicators: { hasCaptcha: false, hasLoginWall: false, hasPasswordField: false, dynamicForm: false, visibilityAmbiguous: false }, mapping: null, evidence: null };
  try {
    const extracted = extract(input.finalUrl, input.html);
    if (extracted.indicators.hasCaptcha) return { status: "manual_review", safeReasonCode: "CONTACT_FORM_CAPTCHA_DETECTED", ...extracted, mapping: null, evidence: null };
    if (extracted.indicators.hasLoginWall) return { status: "manual_review", safeReasonCode: "CONTACT_FORM_LOGIN_WALL_DETECTED", ...extracted, mapping: null, evidence: null };
    if (extracted.indicators.dynamicForm) return { status: "manual_review", safeReasonCode: "CONTACT_FORM_STATIC_DYNAMIC_FORM", ...extracted, mapping: null, evidence: null };
    if (extracted.indicators.visibilityAmbiguous) return { status: "manual_review", safeReasonCode: "CONTACT_FORM_STATIC_VISIBILITY_AMBIGUOUS", ...extracted, mapping: null, evidence: null };
    if (extracted.externalAction) return { status: "manual_review", safeReasonCode: "CONTACT_FORM_STATIC_EXTERNAL_ACTION", ...extracted, mapping: null, evidence: null };
    const mapping = buildContactFormMappingPreview({ page: extracted.page, approvedContent: APPROVED_CONTENT, pageSignals: extracted.indicators });
    if (mapping.result !== "mapped" || mapping.selectedFormOrdinal == null) return { status: "manual_review", safeReasonCode: "CONTACT_FORM_STATIC_NOT_UNAMBIGUOUS", ...extracted, mapping, evidence: null };
    const evidence = buildContactFormVerificationEvidenceFromRuntime({ page: extracted.page, mapping, pageSignals: extracted.indicators, submitControls: extracted.submitControls });
    if (!evidence.ok) return { status: "manual_review", safeReasonCode: `CONTACT_FORM_STATIC_EVIDENCE_${evidence.reason.toUpperCase()}`, ...extracted, mapping, evidence };
    return { status: "verified", safeReasonCode: null, ...extracted, mapping, evidence };
  } catch {
    return { status: "failed", safeReasonCode: "CONTACT_FORM_STATIC_HTML_PARSE_FAILED", page: null, submitControls: [], indicators: { hasCaptcha: false, hasLoginWall: false, hasPasswordField: false, dynamicForm: false, visibilityAmbiguous: false }, mapping: null, evidence: null };
  }
}
