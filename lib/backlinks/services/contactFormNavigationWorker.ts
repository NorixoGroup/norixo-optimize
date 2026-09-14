import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import type { Browser, BrowserContext, Page } from "playwright-core";

import {
  claimContactFormRunById,
  claimNextContactFormRun,
  confirmContactFormSubmission,
  getContactFormRunExecutionContext,
  heartbeatContactFormRun,
  transitionContactFormRun,
  type ContactFormRun,
  type ContactFormRunExecutionContext,
  type ContactFormRunState,
} from "@/lib/backlinks/repositories/contactFormAutomationRepository";
import type { BacklinkRepositoryClient } from "@/lib/backlinks/repositories/repositoryClient";
import {
  buildContactFormMappingPreview,
  contactFormMappingPreviewToSafeMetadata,
  type ContactFormDiscoveredPage,
  type ContactFormMappingPreview,
} from "@/lib/backlinks/services/contactFormMappingPreview";
import {
  contactFormSafeFingerprint,
  executeContactFormControlledSubmission,
  isKnownSameHostConfirmationPath,
  revalidateContactFormExecutionContext,
  type ContactFormConfirmationObservation,
  type ContactFormFieldLocator,
  type ContactFormSelectOptionExpectation,
  type ContactFormSubmitControl,
  type ContactFormSubmitRequestAllowance,
} from "@/lib/backlinks/services/contactFormSubmission";
import type { Json } from "@/types/database.types";

const UNSAFE_MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const NETWORK_SCHEMES = new Set(["http:", "https:"]);
const NON_NETWORK_SCHEMES = new Set(["about:", "blob:", "data:"]);
const DEFAULT_LEASE_DURATION_SECONDS = 120;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 15_000;
const DEFAULT_NAVIGATION_TIMEOUT_MS = 15_000;
const DEFAULT_RUN_TIMEOUT_MS = 60_000;
const DEFAULT_REDIRECT_LIMIT = 5;

export type ContactFormDnsAddress = Readonly<{ address: string; family: 4 | 6 }>;
export type ContactFormDnsResolver = (hostname: string) => Promise<readonly ContactFormDnsAddress[]>;
export type ContactFormBrowserRequest = Readonly<{ url: string; method: string; resourceType: string; isNavigationRequest: boolean }>;
export type ContactFormBrowserRequestDecision = "continue" | "abort";
export type ContactFormBrowserPage = {
  routeRequests: (handler: (request: ContactFormBrowserRequest) => Promise<ContactFormBrowserRequestDecision>) => Promise<void>;
  goto: (url: string, options: { timeoutMs: number }) => Promise<void>;
  url: () => string;
  title: () => Promise<string>;
  count: (selector: string) => Promise<number>;
  evaluatePageSignals: () => Promise<ContactFormPageSignals>;
  inspectForms: () => Promise<ContactFormDiscoveredPage>;
  readFieldValue: (locator: ContactFormFieldLocator) => Promise<string | null>;
  fillField: (locator: ContactFormFieldLocator, value: string, options: { timeoutMs: number }) => Promise<void>;
  selectFieldOption: (
    locator: ContactFormFieldLocator,
    option: ContactFormSelectOptionExpectation,
    options: { timeoutMs: number },
  ) => Promise<void>;
  listSubmitControls: (formOrdinal: number) => Promise<readonly ContactFormSubmitControl[]>;
  clickSubmitControl: (control: ContactFormSubmitControl, options: { timeoutMs: number }) => Promise<void>;
  observeSubmissionConfirmation: (input: { expectedOrigin: string; selectedFormOrdinal: number; selectedFormFingerprint: string; timeoutMs: number }) => Promise<ContactFormConfirmationObservation>;
  onPopup: (handler: () => void) => void;
  onDownload: (handler: () => void) => void;
};
export type ContactFormBrowserSession = { page: ContactFormBrowserPage; close: () => Promise<void> };
export type ContactFormBrowserRuntime = {
  name: string;
  openContext: () => Promise<ContactFormBrowserSession>;
  close?: () => Promise<void>;
};
export type ContactFormPageSignals = Readonly<{
  hasCaptcha: boolean;
  hasLoginWall: boolean;
  hasPasswordField: boolean;
}>;
export type ContactFormWorkerOptions = Readonly<{
  leaseDurationSeconds?: number;
  heartbeatIntervalMs?: number;
  navigationTimeoutMs?: number;
  runTimeoutMs?: number;
  redirectLimit?: number;
  allowRealSubmission?: boolean;
  targetRunId?: string;
}>;
export type ContactFormNavigationDependencies = Readonly<{
  claimNextRun: (workerId: string, leaseDurationSeconds: number) => Promise<ContactFormRun | null>;
  claimRunById: (runId: string, workerId: string, leaseDurationSeconds: number) => Promise<ContactFormRun | null>;
  heartbeatRun: (input: { runId: string; workerId: string; leaseDurationSeconds: number }) => Promise<ContactFormRun>;
  transitionRun: (input: { runId: string; workerId: string; nextState: ContactFormRunState; eventType: string; safeMetadata?: Json; safeErrorCode?: string; evidenceReference?: string; finalUrl?: string }) => Promise<ContactFormRun>;
  confirmSubmission: (input: { runId: string; workerId: string; evidenceReference: string; finalUrl?: string }) => Promise<{ run_id: string; attempt_id: string; disposition: string }>;
  loadExecutionContext: (run: ContactFormRun) => Promise<ContactFormRunExecutionContext>;
  resolveHostname: ContactFormDnsResolver;
  browserRuntime: ContactFormBrowserRuntime;
  nowMs?: () => number;
}>;
export type ContactFormNavigationResult =
  | { kind: "empty" }
  | { kind: "target_unavailable"; runId: string }
  | { kind: "discovered"; run: ContactFormRun; metadata: ContactFormNavigationMetadata; cleanup: "success" | "failed" }
  | { kind: "mapped"; run: ContactFormRun; metadata: ContactFormNavigationMetadata; mapping: ContactFormMappingPreview; cleanup: "success" | "failed" }
  | { kind: "submission_confirmed"; run: ContactFormRun; metadata: ContactFormNavigationMetadata; mapping: ContactFormMappingPreview; confirmation: Extract<ContactFormConfirmationObservation, { confirmed: true }>; cleanup: "success" | "failed" }
  | { kind: "submission_ambiguous"; run: ContactFormRun; metadata: ContactFormNavigationMetadata; mapping: ContactFormMappingPreview; cleanup: "success" | "failed" }
  | { kind: "blocked"; run: ContactFormRun; state: "blocked_policy" | "blocked_captcha" | "manual_review" | "failed_pre_submit"; safeErrorCode: string; cleanup: "success" | "failed" }
  | { kind: "lease_lost"; runId: string; cleanup: "success" | "failed" };
export type ContactFormNavigationMetadata = Readonly<{
  finalUrl: string;
  pageTitleLength: number;
  formCount: number;
  inputCount: number;
  textareaCount: number;
  selectCount: number;
  buttonCount: number;
  popupBlockedCount: number;
  downloadBlockedCount: number;
  networkMutationBlockedCount: number;
  navigationRequestCount: number;
}>;
type UrlValidationOk = Readonly<{ ok: true; url: URL; hostname: string; dns: Json }>;
type UrlValidationFailure = Readonly<{ ok: false; code: string; reason: string; metadata: Json }>;
type UrlValidationResult = UrlValidationOk | UrlValidationFailure;

export function isContactFormNavigationWorkerEnabled(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return env.CONTACT_FORM_NAVIGATION_WORKER_ENABLED === "true";
}

export function isContactFormRealSubmissionEnabled(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return env.CONTACT_FORM_REAL_SUBMISSION_ENABLED === "true";
}

export function createContactFormNavigationDependencies(client: BacklinkRepositoryClient, browserRuntime: ContactFormBrowserRuntime): ContactFormNavigationDependencies {
  return {
    claimNextRun: (workerId, leaseDurationSeconds) => claimNextContactFormRun(client, workerId, leaseDurationSeconds),
    claimRunById: (runId, workerId, leaseDurationSeconds) => claimContactFormRunById(client, runId, workerId, leaseDurationSeconds),
    heartbeatRun: (input) => heartbeatContactFormRun(client, input),
    transitionRun: (input) => transitionContactFormRun(client, input),
    confirmSubmission: (input) => confirmContactFormSubmission(client, input),
    loadExecutionContext: (run) => getContactFormRunExecutionContext(client, run),
    resolveHostname: resolveHostnamePublicAddresses,
    browserRuntime,
  };
}

export async function createPlaywrightChromiumBrowserRuntime(): Promise<ContactFormBrowserRuntime> {
  const { chromium } = await import("playwright-core");
  const browser = await chromium.launch({ headless: true });
  return {
    name: "playwright-chromium",
    openContext: async () => createPlaywrightBrowserSession(browser),
    close: () => browser.close(),
  };
}

async function createPlaywrightBrowserSession(browser: Browser): Promise<ContactFormBrowserSession> {
  const context: BrowserContext = await browser.newContext({
    acceptDownloads: false,
    permissions: [],
    storageState: { cookies: [], origins: [] },
  });
  const page = await context.newPage();
  return {
    page: adaptPlaywrightPage(page),
    close: () => context.close(),
  };
}

// This is deliberately a browser expression, rather than a TypeScript callback passed to
// page.evaluate. tsx/esbuild may inject module helpers (for example __name) into serialized
// callbacks; those helpers do not exist in the page execution context.
const INSPECT_FORMS_EXPRESSION = String.raw`(() => {
  const maxForms = 5;
  const maxControlsPerForm = 30;
  const maxOptionsPerSelect = 50;
  const maxTextLength = 80;
  const clamp = (value, limit = maxTextLength) => {
    const text = (value || "").trim().replace(/\s+/g, " ");
    return text.length > limit ? text.slice(0, limit - 1) + "…" : text;
  };
  const nullable = (value, limit = maxTextLength) => {
    const text = clamp(value, limit);
    return text ? text : null;
  };
  const normalizeText = (value) => clamp(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  const visible = (element) => {
    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0" && element.getClientRects().length > 0;
  };
  const textOf = (element) => nullable(element ? element.textContent : null);
  const textByIds = (ids) => {
    if (!ids) return null;
    return nullable(ids.split(/\s+/).map((id) => { const item = document.getElementById(id); return item ? item.textContent || "" : ""; }).join(" "));
  };
  const labelsFor = (control) => {
    const direct = Array.from(control.labels || []).map((label) => label.textContent || "");
    const id = control.id ? Array.from(document.querySelectorAll("label[for=\"" + CSS.escape(control.id) + "\"]")).map((label) => label.textContent || "") : [];
    return nullable(direct.concat(id).join(" "));
  };
  const formHeading = (form) => {
    const labelled = textByIds(form.getAttribute("aria-labelledby"));
    if (labelled) return labelled;
    const aria = nullable(form.getAttribute("aria-label"));
    if (aria) return aria;
    const previous = form.previousElementSibling;
    if (previous && /^(H1|H2|H3|H4|H5|H6)$/.test(previous.tagName)) return textOf(previous);
    return null;
  };
  const controlsFor = (form) => Array.from(form.querySelectorAll("input, textarea, select, button")).slice(0, maxControlsPerForm).map((element, ordinal) => {
    const tag = element.tagName.toLowerCase();
    const rawType = tag === "input" || tag === "button" ? element.type : tag;
    const value = "value" in element ? element.value : "";
    const options = tag === "select" ? Array.from(element.options).slice(0, maxOptionsPerSelect).map((option, optionOrdinal) => ({
      ordinal: optionOrdinal,
      labelText: clamp(option.label || option.textContent || ""),
      normalizedLabel: normalizeText(option.label || option.textContent || ""),
      valuePresent: Boolean(option.value && option.value.trim().length > 0),
      disabled: option.disabled === true,
      selected: option.selected === true,
    })) : undefined;
    return {
      ordinal,
      tag,
      type: clamp(rawType || tag, 32),
      name: nullable(element.getAttribute("name")),
      id: nullable(element.id),
      autocomplete: nullable(element.getAttribute("autocomplete")),
      labelText: labelsFor(element),
      ariaLabel: nullable(element.getAttribute("aria-label")),
      ariaLabelledbyText: textByIds(element.getAttribute("aria-labelledby")),
      placeholder: nullable(element.getAttribute("placeholder")),
      required: element.hasAttribute("required"),
      disabled: element.disabled === true,
      readOnly: "readOnly" in element ? element.readOnly === true : false,
      hidden: tag === "input" && rawType.toLowerCase() === "hidden",
      visible: visible(element),
      valuePresent: value.trim().length > 0,
      optionsCount: tag === "select" ? element.options.length : undefined,
      options,
    };
  });
  return {
    pageUrl: window.location.href,
    pageTitle: clamp(document.title),
    forms: Array.from(document.forms).slice(0, maxForms).map((form, ordinal) => ({
      ordinal,
      action: nullable(form.getAttribute("action"), 300),
      method: nullable(form.getAttribute("method"), 12),
      labelText: formHeading(form),
      legendText: textOf(form.querySelector("fieldset legend")),
      buttonText: nullable(Array.from(form.querySelectorAll("button, input[type='submit'], input[type='button']")).map((button) => button.textContent || button.getAttribute("value") || "").join(" ")),
      controls: controlsFor(form),
    })),
  };
})()`;

function adaptPlaywrightPage(page: Page): ContactFormBrowserPage {
  const controlLocator = (locator: ContactFormFieldLocator) => page.locator("form").nth(locator.formOrdinal).locator("input, textarea, select, button").nth(locator.controlOrdinal);
  return {
    routeRequests: async (handler) => {
      await page.route("**/*", async (route) => {
        const request = route.request();
        const decision = await handler({
          url: request.url(),
          method: request.method(),
          resourceType: request.resourceType(),
          isNavigationRequest: request.isNavigationRequest(),
        });
        if (decision === "continue") await route.continue();
        else await route.abort("blockedbyclient");
      });
    },
    goto: async (url, options) => {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: options.timeoutMs });
    },
    url: () => page.url(),
    title: () => page.title(),
    count: (selector) => page.locator(selector).count(),
    evaluatePageSignals: () =>
      page.evaluate(() => {
        const bodyText = document.body?.innerText?.toLowerCase() ?? "";
        const hasCaptcha =
          Boolean(document.querySelector('[class*="captcha" i], [id*="captcha" i], iframe[src*="captcha" i], iframe[src*="recaptcha" i], iframe[src*="hcaptcha" i], iframe[src*="turnstile" i], [class*="cf-turnstile" i], [name="cf-turnstile-response"]')) ||
          /\b(captcha|recaptcha|hcaptcha|turnstile|verify you are human|human verification)\b/i.test(bodyText);
        const hasPasswordField = Boolean(document.querySelector('input[type="password"]'));
        const hasLoginWall = hasPasswordField || /\b(sign in|log in|login required|create an account|members only)\b/i.test(bodyText);
        return { hasCaptcha, hasLoginWall, hasPasswordField };
      }),
    inspectForms: () => page.evaluate(INSPECT_FORMS_EXPRESSION) as Promise<ContactFormDiscoveredPage>,
    readFieldValue: (locator) => controlLocator(locator).inputValue({ timeout: 5_000 }).catch(() => null),
    fillField: async (locator, value, options) => {
      await controlLocator(locator).fill(value, { timeout: options.timeoutMs });
    },
    selectFieldOption: async (locator, expectedOption, options) => {
      if (
        !Number.isInteger(expectedOption.ordinal) ||
        expectedOption.ordinal < 0 ||
        !expectedOption.valuePresent ||
        expectedOption.disabled
      ) {
        throw new Error("CONTACT_FORM_SELECT_OPTION_EXPECTATION_INVALID");
      }

      const select = controlLocator(locator);
      const optionsLocator = select.locator("option");
      const optionCount = await optionsLocator.count();

      if (expectedOption.ordinal >= optionCount) {
        throw new Error("CONTACT_FORM_SELECT_OPTION_DRIFT");
      }

      const option = optionsLocator.nth(expectedOption.ordinal);
      const rawLabel =
        (await option.getAttribute("label")) ??
        (await option.textContent()) ??
        "";

      const compactLabel = rawLabel.trim().replace(/\s+/g, " ");
      const boundedLabel =
        compactLabel.length > 80
          ? `${compactLabel.slice(0, 79)}…`
          : compactLabel;

      const rawValue = (await option.getAttribute("value")) ?? "";
      const disabled = await option.isDisabled();

      if (
        boundedLabel !== expectedOption.labelText ||
        rawValue.trim().length === 0 ||
        disabled
      ) {
        throw new Error("CONTACT_FORM_SELECT_OPTION_DRIFT");
      }

      await select.selectOption(
        { index: expectedOption.ordinal },
        { timeout: options.timeoutMs },
      );

      const selectedValue = await select.inputValue({
        timeout: options.timeoutMs,
      });

      if (
        selectedValue.trim().length === 0 ||
        selectedValue !== rawValue
      ) {
        throw new Error("CONTACT_FORM_SELECT_OPTION_READBACK_MISMATCH");
      }
    },
    listSubmitControls: async (formOrdinal) => {
      type SubmitControlRaw = Omit<ContactFormSubmitControl, "fingerprint">;
      const controls = await page.evaluate((ordinal): SubmitControlRaw[] => {
        const form = document.forms.item(ordinal);
        if (!form) return [];
        const visible = (element: Element) => {
          const htmlElement = element as HTMLElement;
          const style = window.getComputedStyle(htmlElement);
          return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0" && htmlElement.getClientRects().length > 0;
        };
        const allControls = Array.from(form.querySelectorAll("input, textarea, select, button"));
        return Array.from(form.querySelectorAll('button[type="submit"], input[type="submit"]')).map((element) => {
          const input = element as HTMLButtonElement | HTMLInputElement;
          const controlOrdinal = allControls.indexOf(element);
          const tag = element.tagName.toLowerCase() === "button" ? "button" : "input";
          const hidden = tag === "input" && (input as HTMLInputElement).type.toLowerCase() === "hidden";
          const disabled = input.disabled === true || input.getAttribute("aria-disabled") === "true";
          return {
            formOrdinal: ordinal,
            controlOrdinal,
            tag,
            type: "submit",
            name: input.getAttribute("name")?.trim() || null,
            id: input.id?.trim() || null,
            visible: visible(input),
            enabled: !disabled,
            disabled,
            hidden,
          };
        });
      }, formOrdinal);
      return controls.map((control) => ({
        ...control,
        fingerprint: contactFormSafeFingerprint({
          form_ordinal: control.formOrdinal,
          control_ordinal: control.controlOrdinal,
          tag: control.tag,
          type: control.type,
          name: control.name,
          id: control.id,
          visible: control.visible,
          enabled: control.enabled,
          hidden: control.hidden,
        }),
      }));
    },
    clickSubmitControl: async (control, options) => {
      await page.locator("form").nth(control.formOrdinal).locator("input, textarea, select, button").nth(control.controlOrdinal).click({ timeout: options.timeoutMs });
    },
    observeSubmissionConfirmation: async (input) => {
      await page.waitForLoadState("domcontentloaded", { timeout: input.timeoutMs }).catch(() => undefined);
      const finalUrl = page.url();
      try {
        const url = new URL(finalUrl);
        if (url.origin === input.expectedOrigin && isKnownSameHostConfirmationPath(url.pathname)) {
          return {
            confirmed: true,
            kind: "KNOWN_SAME_HOST_CONFIRMATION_PATH",
            finalUrl,
            evidenceFingerprint: contactFormSafeFingerprint({ kind: "known_same_host_confirmation_path", final_url: finalUrl, selected_form_fingerprint: input.selectedFormFingerprint }),
            markerId: null,
          };
        }
      } catch {
        return { confirmed: false, reason: "final_url_invalid", finalUrl };
      }
      const marker = await page.evaluate((selectedFormOrdinal) => {
        const visible = (element: Element) => {
          const htmlElement = element as HTMLElement;
          const style = window.getComputedStyle(htmlElement);
          return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0" && htmlElement.getClientRects().length > 0;
        };
        const success = Array.from(document.querySelectorAll('[data-norixo-contact-form-confirmation="success"], [data-contact-form-confirmation="success"], [data-contact-form-success="true"], [role="status"][data-contact-form-result="success"], [role="alert"][data-contact-form-result="success"]')).find(visible);
        const replacement = Array.from(document.querySelectorAll('[data-norixo-contact-form-replacement="success"], [data-contact-form-replacement="success"]')).find(visible);
        const selectedFormPresent = selectedFormOrdinal >= 0 ? document.forms.item(selectedFormOrdinal) != null : false;
        const element = replacement && !selectedFormPresent ? replacement : success;
        return element
          ? {
              replacement: Boolean(replacement && !selectedFormPresent),
              id: (element as HTMLElement).id?.trim() || null,
              role: element.getAttribute("role"),
              textLength: (element.textContent ?? "").trim().replace(/\s+/g, " ").length,
            }
          : { replacement: false, id: null, role: null, textLength: 0 };
      }, input.selectedFormOrdinal);
      if (marker.textLength > 0) {
        return {
          confirmed: true,
          kind: marker.replacement ? "EXPLICIT_SUCCESS_REPLACEMENT" : "EXPLICIT_SUCCESS_ELEMENT",
          finalUrl,
          evidenceFingerprint: contactFormSafeFingerprint({ kind: marker.replacement ? "explicit_success_replacement" : "explicit_success_element", id: marker.id, role: marker.role, text_length: marker.textLength }),
          markerId: marker.id,
        };
      }
      return { confirmed: false, reason: "no_explicit_confirmation", finalUrl, formPresent: input.selectedFormOrdinal >= 0 };
    },
    onPopup: (handler) => {
      page.on("popup", (popup) => {
        handler();
        void popup.close().catch(() => undefined);
      });
    },
    onDownload: (handler) => {
      page.on("download", (download) => {
        handler();
        void download.cancel().catch(() => undefined);
      });
    },
  };
}

export async function resolveHostnamePublicAddresses(hostname: string): Promise<readonly ContactFormDnsAddress[]> {
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => ({ address: record.address, family: record.family === 6 ? 6 : 4 }));
}

export async function validateContactFormNavigationUrl(rawUrl: string, resolveHostname: ContactFormDnsResolver): Promise<UrlValidationResult> {
  const value = rawUrl.trim();
  if (value.length === 0 || value.includes("\\") || /[\u0000-\u001f\u007f\s]/.test(value)) {
    return validationFailure("CONTACT_FORM_URL_INVALID", "url_syntax", {});
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return validationFailure("CONTACT_FORM_URL_INVALID", "url_parse", {});
  }
  if (url.protocol !== "https:") return validationFailure("CONTACT_FORM_URL_HTTPS_REQUIRED", "https_required", { protocol: url.protocol.replace(":", "") });
  if (url.username || url.password) return validationFailure("CONTACT_FORM_URL_CREDENTIALS_REJECTED", "credentials_rejected", {});
  const hostname = normalizeHostname(url.hostname);
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    return validationFailure("CONTACT_FORM_URL_LOCAL_HOST_REJECTED", "local_hostname", { hostname_class: "local" });
  }
  if (isIpLiteral(hostname)) return validationFailure("CONTACT_FORM_URL_IP_LITERAL_REJECTED", "ip_literal_rejected", { ip_literal_policy: "reject_all" });
  let records: readonly ContactFormDnsAddress[];
  try {
    records = await resolveHostname(hostname);
  } catch {
    return validationFailure("CONTACT_FORM_URL_DNS_FAILED", "dns_failed", { hostname_class: "public_name" });
  }
  if (!records.length) return validationFailure("CONTACT_FORM_URL_DNS_FAILED", "dns_empty", { hostname_class: "public_name" });
  const unsafeCount = records.filter((record) => !isPublicIpAddress(record.address)).length;
  if (unsafeCount > 0) {
    return validationFailure("CONTACT_FORM_URL_DNS_UNSAFE", "dns_private_or_mixed", {
      address_count: records.length,
      unsafe_address_count: unsafeCount,
      mixed_public_private_dns: unsafeCount < records.length,
      families: Array.from(new Set(records.map((record) => record.family))).join(","),
    });
  }
  return { ok: true, url, hostname, dns: { address_count: records.length, families: Array.from(new Set(records.map((record) => record.family))).join(","), all_addresses_public: true } };
}

export function isPublicIpAddress(address: string): boolean {
  const normalized = stripIpv6Brackets(address.trim().toLowerCase());
  const family = isIP(normalized);
  if (family === 4) return isPublicIpv4(normalized);
  if (family === 6) return isPublicIpv6(normalized);
  return false;
}

export async function executeContactFormNavigationWorkerOnce(input: {
  client: BacklinkRepositoryClient;
  workerId: string;
  browserRuntime?: ContactFormBrowserRuntime;
  options?: ContactFormWorkerOptions;
}): Promise<ContactFormNavigationResult> {
  const settings = resolveContactFormWorkerSettings(input.workerId, input.options ?? {});
  if (input.browserRuntime == null && settings.targetRunId != null) {
    const claimedRun = await claimContactFormRunById(input.client, settings.targetRunId, settings.workerId, settings.leaseDurationSeconds);
    if (claimedRun == null) return { kind: "target_unavailable", runId: settings.targetRunId };
    const runtime = await createPlaywrightChromiumBrowserRuntime();
    try {
      return await executeClaimedContactFormNavigationWorkerOnce(createContactFormNavigationDependencies(input.client, runtime), settings, claimedRun);
    } finally {
      await runtime.close?.();
    }
  }
  const ownsRuntime = input.browserRuntime == null;
  const runtime = input.browserRuntime ?? (await createPlaywrightChromiumBrowserRuntime());
  try {
    return await executeContactFormNavigationWorkerOnceWithDependencies(createContactFormNavigationDependencies(input.client, runtime), input.workerId, input.options);
  } finally {
    if (ownsRuntime) await runtime.close?.();
  }
}

export async function executeContactFormNavigationWorkerOnceWithDependencies(
  deps: ContactFormNavigationDependencies,
  workerIdInput: string,
  options: ContactFormWorkerOptions = {},
): Promise<ContactFormNavigationResult> {
  const settings = resolveContactFormWorkerSettings(workerIdInput, options);
  const claimedRun =
    settings.targetRunId == null
      ? await deps.claimNextRun(settings.workerId, settings.leaseDurationSeconds)
      : await deps.claimRunById(settings.targetRunId, settings.workerId, settings.leaseDurationSeconds);
  if (claimedRun == null) return settings.targetRunId == null ? { kind: "empty" } : { kind: "target_unavailable", runId: settings.targetRunId };
  return executeClaimedContactFormNavigationWorkerOnce(deps, settings, claimedRun);
}

type ResolvedContactFormWorkerSettings = Readonly<{
  workerId: string;
  leaseDurationSeconds: number;
  heartbeatIntervalMs: number;
  navigationTimeoutMs: number;
  runTimeoutMs: number;
  redirectLimit: number;
  allowRealSubmission: boolean;
  targetRunId: string | null;
}>;

function resolveContactFormWorkerSettings(workerIdInput: string, options: ContactFormWorkerOptions): ResolvedContactFormWorkerSettings {
  const workerId = workerIdInput.trim();
  if (!workerId) throw new Error("workerId must not be empty");
  const leaseDurationSeconds = options.leaseDurationSeconds ?? DEFAULT_LEASE_DURATION_SECONDS;
  const heartbeatIntervalMs = options.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;
  const navigationTimeoutMs = options.navigationTimeoutMs ?? DEFAULT_NAVIGATION_TIMEOUT_MS;
  const runTimeoutMs = options.runTimeoutMs ?? DEFAULT_RUN_TIMEOUT_MS;
  const redirectLimit = options.redirectLimit ?? DEFAULT_REDIRECT_LIMIT;
  validateWorkerOptions({ leaseDurationSeconds, heartbeatIntervalMs, navigationTimeoutMs, runTimeoutMs, redirectLimit });
  return {
    workerId,
    leaseDurationSeconds,
    heartbeatIntervalMs,
    navigationTimeoutMs,
    runTimeoutMs,
    redirectLimit,
    allowRealSubmission: options.allowRealSubmission === true,
    targetRunId: options.targetRunId?.trim() || null,
  };
}

async function executeClaimedContactFormNavigationWorkerOnce(
  deps: ContactFormNavigationDependencies,
  settings: ResolvedContactFormWorkerSettings,
  claimedRun: ContactFormRun,
): Promise<Exclude<ContactFormNavigationResult, { kind: "empty" } | { kind: "target_unavailable" }>> {
  const { workerId, leaseDurationSeconds, heartbeatIntervalMs, navigationTimeoutMs, runTimeoutMs, redirectLimit, allowRealSubmission } = settings;
  const nowMs = deps.nowMs ?? Date.now;
  const runDeadline = nowMs() + runTimeoutMs;
  let session: ContactFormBrowserSession | null = null;
  const pendingResult: { value: Exclude<ContactFormNavigationResult, { kind: "empty" } | { kind: "target_unavailable" }> | null } = { value: null };
  const finish = <T extends Exclude<ContactFormNavigationResult, { kind: "empty" } | { kind: "target_unavailable" }>>(result: T): T => {
    pendingResult.value = result;
    return result;
  };
  const heartbeat = startLeaseHeartbeat({ workerId, runId: claimedRun.id, leaseDurationSeconds, heartbeatIntervalMs, heartbeatRun: deps.heartbeatRun });
  const keepLease = async () => {
    if (heartbeat.hasLeaseLost()) throw new Error("CONTACT_FORM_RUN_LEASE_LOST");
    if (nowMs() > runDeadline) throw new Error("CONTACT_FORM_NAVIGATION_RUN_TIMEOUT");
    await deps.heartbeatRun({ runId: claimedRun.id, workerId, leaseDurationSeconds });
  };
  try {
    await keepLease();
    const context = await deps.loadExecutionContext(claimedRun);
    const revalidation = revalidateContactFormExecutionContext(context);
    if (!revalidation.ok) {
      const run = await deps.transitionRun({
        runId: claimedRun.id,
        workerId,
        nextState: revalidation.state,
        eventType: revalidation.eventType,
        safeErrorCode: revalidation.code,
        safeMetadata: revalidation.metadata,
      });
      return finish({ kind: "blocked", run, state: revalidation.state, safeErrorCode: revalidation.code, cleanup: "success" });
    }
    const target = await validateContactFormNavigationUrl(context.approval.form_url, deps.resolveHostname);
    if (!target.ok) {
      const run = await transitionPolicyBlocked(deps, claimedRun.id, workerId, target.code, target.metadata);
      return finish({ kind: "blocked", run, state: "blocked_policy", safeErrorCode: target.code, cleanup: "success" });
    }
    await keepLease();
    let popupBlockedCount = 0;
    let downloadBlockedCount = 0;
    let networkMutationBlockedCount = 0;
    let navigationRequestCount = 0;
    const networkPolicy: { violation: UrlValidationFailure | null } = { violation: null };
    const submitAllowance = createSubmitAllowanceState();
    session = await deps.browserRuntime.openContext();
    session.page.onPopup(() => {
      popupBlockedCount += 1;
    });
    session.page.onDownload(() => {
      downloadBlockedCount += 1;
    });
    await session.page.routeRequests(async (request) => {
      const method = request.method.toUpperCase();
      if (consumeSubmitAllowanceIfMatched(submitAllowance, claimedRun.id, request)) {
        const requestTarget = await validateContactFormNavigationUrl(request.url, deps.resolveHostname);
        if (!requestTarget.ok) {
          networkPolicy.violation ??= requestTarget;
          return "abort";
        }
        return "continue";
      }
      if (UNSAFE_MUTATION_METHODS.has(method)) {
        networkMutationBlockedCount += 1;
        networkPolicy.violation ??= validationFailure("CONTACT_FORM_TARGET_MUTATION_BLOCKED", "target_mutation_blocked", { method });
        return "abort";
      }
      if (method !== "GET" && method !== "HEAD") {
        networkPolicy.violation ??= validationFailure("CONTACT_FORM_TARGET_METHOD_BLOCKED", "target_method_blocked", { method });
        return "abort";
      }
      const protocol = readProtocol(request.url);
      if (request.isNavigationRequest) {
        navigationRequestCount += 1;
        if (navigationRequestCount > redirectLimit + 1) {
          networkPolicy.violation ??= validationFailure("CONTACT_FORM_REDIRECT_LIMIT_EXCEEDED", "redirect_limit", { redirect_limit: redirectLimit });
          return "abort";
        }
      }
      if (NON_NETWORK_SCHEMES.has(protocol) && !request.isNavigationRequest) return "continue";
      if (!NETWORK_SCHEMES.has(protocol)) {
        networkPolicy.violation ??= validationFailure("CONTACT_FORM_URL_UNSUPPORTED_PROTOCOL", "unsupported_protocol", { protocol: protocol.replace(":", "") });
        return "abort";
      }
      const requestTarget = await validateContactFormNavigationUrl(request.url, deps.resolveHostname);
      if (!requestTarget.ok) {
        networkPolicy.violation ??= requestTarget;
        return "abort";
      }
      return "continue";
    });
    const navigatingRun = await deps.transitionRun({ runId: claimedRun.id, workerId, nextState: "navigating", eventType: "navigation_started", safeMetadata: { browser_runtime: deps.browserRuntime.name, initial_hostname: target.hostname, dns: target.dns } });
    await keepLease();
    try {
      await session.page.goto(target.url.href, { timeoutMs: navigationTimeoutMs });
    } catch (error) {
      const violation = networkPolicy.violation;
      if (violation != null) {
        const run = await transitionPolicyBlocked(deps, navigatingRun.id, workerId, violation.code, violation.metadata);
        return finish({ kind: "blocked", run, state: "blocked_policy", safeErrorCode: violation.code, cleanup: "success" });
      }
      const code = isTimeoutError(error) ? "CONTACT_FORM_NAVIGATION_TIMEOUT" : "CONTACT_FORM_NAVIGATION_FAILED";
      const run = await deps.transitionRun({ runId: navigatingRun.id, workerId, nextState: "failed_pre_submit", eventType: "navigation_failed", safeErrorCode: code, safeMetadata: { error_class: code } });
      return finish({ kind: "blocked", run, state: "failed_pre_submit", safeErrorCode: code, cleanup: "success" });
    }
    const violation = networkPolicy.violation;
    if (violation != null) {
      const run = await transitionPolicyBlocked(deps, navigatingRun.id, workerId, violation.code, violation.metadata);
      return finish({ kind: "blocked", run, state: "blocked_policy", safeErrorCode: violation.code, cleanup: "success" });
    }
    await keepLease();
    const finalTarget = await validateContactFormNavigationUrl(session.page.url(), deps.resolveHostname);
    if (!finalTarget.ok) {
      const run = await transitionPolicyBlocked(deps, navigatingRun.id, workerId, finalTarget.code, finalTarget.metadata);
      return finish({ kind: "blocked", run, state: "blocked_policy", safeErrorCode: finalTarget.code, cleanup: "success" });
    }
    const metadata = await inspectPageMetadata(session.page, {
      finalUrl: finalTarget.url.href,
      popupBlockedCount,
      downloadBlockedCount,
      networkMutationBlockedCount,
      navigationRequestCount,
    });
    const signals = await session.page.evaluatePageSignals();
    if (signals.hasCaptcha) {
      const run = await deps.transitionRun({ runId: navigatingRun.id, workerId, nextState: "blocked_captcha", eventType: "captcha_detected", safeErrorCode: "CONTACT_FORM_CAPTCHA_DETECTED", safeMetadata: { has_captcha: true, form_count: metadata.formCount } });
      return finish({ kind: "blocked", run, state: "blocked_captcha", safeErrorCode: "CONTACT_FORM_CAPTCHA_DETECTED", cleanup: "success" });
    }
    if (signals.hasLoginWall) {
      const run = await deps.transitionRun({ runId: navigatingRun.id, workerId, nextState: "manual_review", eventType: "login_wall_detected", safeErrorCode: "CONTACT_FORM_LOGIN_WALL_DETECTED", safeMetadata: { has_login_wall: true, has_password_field: signals.hasPasswordField, form_count: metadata.formCount } });
      return finish({ kind: "blocked", run, state: "manual_review", safeErrorCode: "CONTACT_FORM_LOGIN_WALL_DETECTED", cleanup: "success" });
    }
    const discovered = await deps.transitionRun({
      runId: navigatingRun.id,
      workerId,
      nextState: "discovered",
      eventType: "page_discovered",
      finalUrl: metadata.finalUrl,
      evidenceReference: `c3_navigation:${navigatingRun.id}`,
      safeMetadata: toSafeMetadata(metadata),
    });
    await keepLease();
    const mapping = buildContactFormMappingPreview({
      page: await session.page.inspectForms(),
      approvedContent: {
        senderName: context.approval.sender_name,
        senderFirstName: context.approval.sender_first_name,
        senderLastName: context.approval.sender_last_name,
        senderEmail: context.approval.sender_email,
        senderCompany: context.approval.sender_company,
        senderWebsite: context.approval.sender_website,
        subject: context.approval.subject,
        body: context.approval.body,
      },
      pageSignals: signals,
    });
    const mappingMetadata = contactFormMappingPreviewToSafeMetadata(mapping);
    if (mapping.result === "mapped") {
      const mapped = await deps.transitionRun({
        runId: discovered.id,
        workerId,
        nextState: "mapped",
        eventType: "form_mapping_previewed",
        finalUrl: metadata.finalUrl,
        evidenceReference: `c4_mapping:${discovered.id}`,
        safeMetadata: mappingMetadata,
      });
      if (!allowRealSubmission) {
        const run = await deps.transitionRun({
          runId: mapped.id,
          workerId,
          nextState: "manual_review",
          eventType: "real_submission_disabled",
          safeErrorCode: "CONTACT_FORM_REAL_SUBMISSION_DISABLED",
          finalUrl: metadata.finalUrl,
          safeMetadata: mappingMetadata,
        });
        return finish({ kind: "blocked", run, state: "manual_review", safeErrorCode: "CONTACT_FORM_REAL_SUBMISSION_DISABLED", cleanup: "success" });
      }
      const submission = await executeContactFormControlledSubmission({
        run: mapped,
        workerId,
        page: session.page,
        mapping,
        expectedPageUrl: metadata.finalUrl,
        dependencies: {
          loadExecutionContext: deps.loadExecutionContext,
          transitionRun: deps.transitionRun,
          confirmSubmission: deps.confirmSubmission,
          keepLease,
          armSubmitRequest: (allowance) => {
            armSubmitAllowance(submitAllowance, allowance);
          },
          revokeSubmitRequest: () => {
            revokeSubmitAllowance(submitAllowance);
          },
        },
      });
      if (submission.kind === "submission_confirmed") return finish({ kind: "submission_confirmed", run: submission.run, metadata, mapping, confirmation: submission.confirmation, cleanup: "success" });
      if (submission.kind === "submission_ambiguous") return finish({ kind: "submission_ambiguous", run: submission.run, metadata, mapping, cleanup: "success" });
      if (submission.kind === "lease_lost") return finish({ kind: "lease_lost", runId: submission.runId, cleanup: "success" });
      return finish({ kind: "blocked", run: submission.run, state: submission.state, safeErrorCode: submission.safeErrorCode, cleanup: "success" });
    }
    if (mapping.result === "blocked_captcha") {
      const run = await deps.transitionRun({ runId: discovered.id, workerId, nextState: "blocked_captcha", eventType: "captcha_detected", safeErrorCode: "CONTACT_FORM_CAPTCHA_DETECTED", safeMetadata: mappingMetadata });
      return finish({ kind: "blocked", run, state: "blocked_captcha", safeErrorCode: "CONTACT_FORM_CAPTCHA_DETECTED", cleanup: "success" });
    }
    if (mapping.result === "blocked_policy") {
      const run = await deps.transitionRun({ runId: discovered.id, workerId, nextState: "blocked_policy", eventType: "mapping_policy_blocked", safeErrorCode: "CONTACT_FORM_MAPPING_POLICY_BLOCKED", safeMetadata: mappingMetadata });
      return finish({ kind: "blocked", run, state: "blocked_policy", safeErrorCode: "CONTACT_FORM_MAPPING_POLICY_BLOCKED", cleanup: "success" });
    }
    const run = await deps.transitionRun({ runId: discovered.id, workerId, nextState: "manual_review", eventType: "mapping_manual_review", safeErrorCode: "CONTACT_FORM_MAPPING_MANUAL_REVIEW", safeMetadata: mappingMetadata });
    return finish({ kind: "blocked", run, state: "manual_review", safeErrorCode: "CONTACT_FORM_MAPPING_MANUAL_REVIEW", cleanup: "success" });
  } catch (error) {
    if (isLeaseLostError(error)) return finish({ kind: "lease_lost", runId: claimedRun.id, cleanup: "success" });
    const code = isRunTimeoutError(error) ? "CONTACT_FORM_NAVIGATION_RUN_TIMEOUT" : "CONTACT_FORM_NAVIGATION_FAILED";
    try {
      const run = await deps.transitionRun({ runId: claimedRun.id, workerId, nextState: "failed_pre_submit", eventType: "navigation_failed", safeErrorCode: code, safeMetadata: { error_class: code } });
      return finish({ kind: "blocked", run, state: "failed_pre_submit", safeErrorCode: code, cleanup: "success" });
    } catch (transitionError) {
      if (isLeaseLostError(transitionError)) return finish({ kind: "lease_lost", runId: claimedRun.id, cleanup: "success" });
      throw transitionError;
    }
  } finally {
    heartbeat.stop();
    if (session != null) {
      try {
        await session.close();
      } catch {
        if (pendingResult.value != null) pendingResult.value.cleanup = "failed";
      }
    }
  }
}

function validateWorkerOptions(options: { leaseDurationSeconds: number; heartbeatIntervalMs: number; navigationTimeoutMs: number; runTimeoutMs: number; redirectLimit: number }) {
  if (!Number.isInteger(options.leaseDurationSeconds) || options.leaseDurationSeconds < 30 || options.leaseDurationSeconds > 3600) throw new Error("leaseDurationSeconds must be an integer between 30 and 3600");
  if (!Number.isInteger(options.heartbeatIntervalMs) || options.heartbeatIntervalMs < 1000 || options.heartbeatIntervalMs > 300000) throw new Error("heartbeatIntervalMs must be an integer between 1000 and 300000");
  if (!Number.isInteger(options.navigationTimeoutMs) || options.navigationTimeoutMs < 1000 || options.navigationTimeoutMs > 120000) throw new Error("navigationTimeoutMs must be an integer between 1000 and 120000");
  if (!Number.isInteger(options.runTimeoutMs) || options.runTimeoutMs < 1000 || options.runTimeoutMs > 600000) throw new Error("runTimeoutMs must be an integer between 1000 and 600000");
  if (!Number.isInteger(options.redirectLimit) || options.redirectLimit < 0 || options.redirectLimit > 20) throw new Error("redirectLimit must be an integer between 0 and 20");
}

function startLeaseHeartbeat(params: {
  workerId: string;
  runId: string;
  leaseDurationSeconds: number;
  heartbeatIntervalMs: number;
  heartbeatRun: ContactFormNavigationDependencies["heartbeatRun"];
}) {
  let stopped = false;
  let leaseLost = false;
  let inFlight = false;
  const timer = setInterval(() => {
    if (stopped || leaseLost || inFlight) return;
    inFlight = true;
    params
      .heartbeatRun({ runId: params.runId, workerId: params.workerId, leaseDurationSeconds: params.leaseDurationSeconds })
      .catch(() => {
        leaseLost = true;
      })
      .finally(() => {
        inFlight = false;
      });
  }, params.heartbeatIntervalMs);
  timer.unref?.();
  return {
    stop: () => {
      stopped = true;
      clearInterval(timer);
    },
    hasLeaseLost: () => leaseLost,
  };
}

type SubmitAllowanceState = { current: ContactFormSubmitRequestAllowance | null; consumed: boolean };

function createSubmitAllowanceState(): SubmitAllowanceState {
  return { current: null, consumed: false };
}

function armSubmitAllowance(state: SubmitAllowanceState, allowance: ContactFormSubmitRequestAllowance): void {
  state.current = allowance;
  state.consumed = false;
}

function revokeSubmitAllowance(state: SubmitAllowanceState): void {
  state.current = null;
}

function consumeSubmitAllowanceIfMatched(state: SubmitAllowanceState, runId: string, request: ContactFormBrowserRequest): boolean {
  const allowance = state.current;
  if (allowance == null || state.consumed || allowance.runId !== runId || request.method.toUpperCase() !== allowance.method || !request.isNavigationRequest) return false;
  try {
    const url = new URL(request.url);
    if (url.protocol !== "https:" || url.origin !== allowance.origin || url.pathname !== allowance.path || url.search !== allowance.search) return false;
  } catch {
    return false;
  }
  state.consumed = true;
  state.current = null;
  return true;
}

async function transitionPolicyBlocked(deps: ContactFormNavigationDependencies, runId: string, workerId: string, code: string, metadata: Json) {
  return deps.transitionRun({ runId, workerId, nextState: "blocked_policy", eventType: "navigation_policy_blocked", safeErrorCode: code, safeMetadata: metadata });
}

async function inspectPageMetadata(page: ContactFormBrowserPage, input: Omit<ContactFormNavigationMetadata, "pageTitleLength" | "formCount" | "inputCount" | "textareaCount" | "selectCount" | "buttonCount">): Promise<ContactFormNavigationMetadata> {
  const [title, formCount, inputCount, textareaCount, selectCount, buttonCount] = await Promise.all([
    page.title(),
    page.count("form"),
    page.count("input"),
    page.count("textarea"),
    page.count("select"),
    page.count("button"),
  ]);
  return {
    ...input,
    pageTitleLength: title.length,
    formCount,
    inputCount,
    textareaCount,
    selectCount,
    buttonCount,
  };
}

function toSafeMetadata(metadata: ContactFormNavigationMetadata): Json {
  return {
    final_url_protocol: readProtocol(metadata.finalUrl).replace(":", ""),
    page_title_length: metadata.pageTitleLength,
    form_count: metadata.formCount,
    input_count: metadata.inputCount,
    textarea_count: metadata.textareaCount,
    select_count: metadata.selectCount,
    button_count: metadata.buttonCount,
    popup_blocked_count: metadata.popupBlockedCount,
    download_blocked_count: metadata.downloadBlockedCount,
    network_mutation_blocked_count: metadata.networkMutationBlockedCount,
    navigation_request_count: metadata.navigationRequestCount,
    full_html_persisted: false,
  };
}

function validationFailure(code: string, reason: string, metadata: Json): UrlValidationFailure {
  return { ok: false, code, reason, metadata };
}

function readProtocol(rawUrl: string): string {
  try {
    return new URL(rawUrl).protocol;
  } catch {
    return "";
  }
}

function normalizeHostname(hostname: string): string {
  return stripIpv6Brackets(hostname.trim().replace(/\.$/, "").toLowerCase());
}

function stripIpv6Brackets(value: string): string {
  return value.startsWith("[") && value.endsWith("]") ? value.slice(1, -1) : value;
}

function isIpLiteral(hostname: string): boolean {
  return isIP(stripIpv6Brackets(hostname)) !== 0;
}

function isPublicIpv4(address: string): boolean {
  const parts = address.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b, c, d] = parts;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && (b === 0 || b === 168)) return false;
  if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  if (a === 255 && b === 255 && c === 255 && d === 255) return false;
  return true;
}

function isPublicIpv6(address: string): boolean {
  const normalized = stripIpv6Brackets(address.toLowerCase());
  if (normalized.startsWith("::ffff:")) {
    const embedded = normalized.slice("::ffff:".length);
    if (isIP(embedded) === 4) return isPublicIpv4(embedded);
  }
  const segments = expandIpv6(normalized);
  if (segments == null) return false;
  const allZero = segments.every((segment) => segment === 0);
  const loopback = segments.slice(0, 7).every((segment) => segment === 0) && segments[7] === 1;
  if (allZero || loopback) return false;
  if ((segments[0] & 0xfe00) === 0xfc00) return false;
  if ((segments[0] & 0xffc0) === 0xfe80) return false;
  if ((segments[0] & 0xff00) === 0xff00) return false;
  if (segments[0] === 0x2001 && segments[1] === 0x0db8) return false;
  if (segments[0] === 0x2002) return false;
  if (segments[0] === 0x0000) return false;
  return true;
}

function expandIpv6(address: string): number[] | null {
  if (!address.includes(":")) return null;
  let working = address;
  const ipv4Match = working.match(/(^|:)(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (ipv4Match) {
    const ipv4 = ipv4Match[2];
    if (!isPublicIpv4(ipv4) && isIP(ipv4) !== 4) return null;
    const octets = ipv4.split(".").map((part) => Number.parseInt(part, 10));
    working = `${working.slice(0, -ipv4.length)}${((octets[0] << 8) | octets[1]).toString(16)}:${((octets[2] << 8) | octets[3]).toString(16)}`;
  }
  const pieces = working.split("::");
  if (pieces.length > 2) return null;
  const head = pieces[0] ? pieces[0].split(":") : [];
  const tail = pieces.length === 2 && pieces[1] ? pieces[1].split(":") : [];
  if (head.some((piece) => piece === "") || tail.some((piece) => piece === "")) return null;
  const missing = 8 - head.length - tail.length;
  if (missing < 0 || (pieces.length === 1 && missing !== 0)) return null;
  const values = [...head, ...Array.from({ length: missing }, () => "0"), ...tail].map((piece) => Number.parseInt(piece, 16));
  if (values.length !== 8 || values.some((value) => !Number.isInteger(value) || value < 0 || value > 0xffff)) return null;
  return values;
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && /timeout/i.test(error.message);
}

function isRunTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.message === "CONTACT_FORM_NAVIGATION_RUN_TIMEOUT";
}

function isLeaseLostError(error: unknown): boolean {
  if (error instanceof Error) {
    if (error.message.includes("CONTACT_FORM_RUN_LEASE_LOST")) return true;
    const cause = error.cause;
    return cause instanceof Error && cause.message.includes("CONTACT_FORM_RUN_LEASE_LOST");
  }
  return false;
}
