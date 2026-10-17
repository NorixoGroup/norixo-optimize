import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { inspectContactFormVerificationPreflight, type ContactFormVerificationPreflightPage } from "../lib/backlinks/services/contactFormVerificationPreflightService";

const root = process.cwd();
const worker = readFileSync(join(root, "lib/backlinks/services/contactFormVerificationPreflightWorker.ts"), "utf8");
const service = readFileSync(join(root, "lib/backlinks/services/contactFormVerificationPreflightService.ts"), "utf8");
const route = readFileSync(join(root, "app/api/backlinks/contacts/[id]/contact-form-verification-preflight/route.ts"), "utf8");
const migration = readFileSync(join(root, "supabase/migrations/20261009120000_add_backlink_contact_form_verification_preflights.sql"), "utf8");
assert(!service.includes("clickSubmitControl") && !service.includes("fillField") && !service.includes("selectFieldOption"), "preflight must not expose submission capabilities");
assert(!worker.includes("executeContactFormControlledSubmission"), "preflight worker must not import submission execution");
for (const token of [
  "fetchContactFormStaticHtml",
  "parseStaticContactFormHtml",
  "CONTACT_FORM_STATIC_PARSE_UNVERIFIED",
  "CONTACT_FORM_PREFLIGHT_FORM_MISMATCH",
]) assert(worker.includes(token), `missing read-only transport protection ${token}`);
assert(!worker.includes("allowRealSubmission"), "preflight must not opt into real submission");
for (const forbidden of ["playwright", "chromium", "BrowserContext", "routeWebSocket", "createPlaywrightChromiumBrowserRuntime"]) assert(!worker.toLowerCase().includes(forbidden.toLowerCase()), `preflight must not import ${forbidden}`);
for (const token of ["getRequestUserAndWorkspace", "isAdminPrivateEmail", "executeContactFormVerificationPreflight"]) assert(route.includes(token), `missing authenticated worker integration ${token}`);
assert(route.includes("randomUUID") && route.includes("contact-form-preflight:${auth.user.id}:${randomUUID()}"), "each server-side preflight invocation must receive a unique worker identifier");
for (const token of ["unique (workspace_id, contact_id, form_url)", "unique (workspace_id, idempotency_key)", "CONTACT_FORM_PREFLIGHT_FORM_MISMATCH", "grant execute on function public.claim_backlink_contact_form_verification_preflight"]) assert(migration.includes(token), `missing ${token}`);
const page: ContactFormVerificationPreflightPage = {
  goto: async () => undefined,
  url: () => "https://example.com/contact",
  evaluatePageSignals: async () => ({ hasCaptcha: false, hasLoginWall: false, hasPasswordField: false }),
  inspectForms: async () => ({ pageUrl: "https://example.com/contact", pageTitle: "Contact", forms: [{ ordinal: 0, action: "/contact", method: "POST", labelText: "Contact us", legendText: null, buttonText: "Send message", controls: [{ ordinal: 0, tag: "input", type: "text", name: "name", id: "name", labelText: "Name", ariaLabel: null, ariaLabelledbyText: null, placeholder: null, autocomplete: "name", required: true, visible: true, disabled: false, readOnly: false, hidden: false, valuePresent: false }, { ordinal: 1, tag: "input", type: "email", name: "email", id: "email", labelText: "Email", ariaLabel: null, ariaLabelledbyText: null, placeholder: null, autocomplete: "email", required: true, visible: true, disabled: false, readOnly: false, hidden: false, valuePresent: false }, { ordinal: 2, tag: "textarea", type: "textarea", name: "message", id: "message", labelText: "Message", ariaLabel: null, ariaLabelledbyText: null, placeholder: null, autocomplete: null, required: true, visible: true, disabled: false, readOnly: false, hidden: false, valuePresent: false }, { ordinal: 3, tag: "button", type: "submit", name: null, id: "submit", labelText: "Send", ariaLabel: null, ariaLabelledbyText: null, placeholder: null, autocomplete: null, required: false, visible: true, disabled: false, readOnly: false, hidden: false, valuePresent: false }] }] }),
  listSubmitControls: async () => [{ formOrdinal: 0, controlOrdinal: 3, tag: "button", type: "submit", name: null, id: "submit", visible: true, enabled: true, disabled: false, hidden: false, fingerprint: "submit" }],
};
void (async () => {
  const result = await inspectContactFormVerificationPreflight({ page, formUrl: "https://example.com/contact" });
  assert.equal(result.status, "verified", "valid public form verifies without outreach or campaign");
  const captcha = await inspectContactFormVerificationPreflight({ page: { ...page, evaluatePageSignals: async () => ({ hasCaptcha: true, hasLoginWall: false, hasPasswordField: false }) }, formUrl: "https://example.com/contact" });
  assert.deepEqual(captcha, { status: "manual_review", safeErrorCode: "CONTACT_FORM_CAPTCHA_DETECTED" });
  console.log("PASS — contact-form verification preflight smoke");
})().catch((error) => { console.error(error); process.exitCode = 1; });
