import assert from "node:assert/strict";

import { parseStaticContactFormHtml } from "../lib/backlinks/services/contactFormStaticHtmlParser";

const URL = "https://example.com/contact";
const parse = (html: string) => parseStaticContactFormHtml({ finalUrl: URL, html, contentType: "text/html; charset=utf-8" });
const contact = (extra = "") => `<!doctype html><html><title>Contact us</title><body><form action="/send" method="post" aria-label="Contact us"><label for="name">Name</label><input id="name" name="name" required><label for="email">Email</label><input id="email" name="email" type="email" required><label for="message">Message</label><textarea id="message" name="message" required></textarea>${extra}<button type="submit">Send message</button></form></body></html>`;
const associated = (control: string) => contact().replace("<form action=", '<form id="contact" action=').replace("</body>", `${control}</body>`);
const withBase = (base: string, html = contact()) => html.replace("<body>", `<head>${base}</head><body>`);

function manual(html: string, reason?: string) {
  const result = parse(html); assert.equal(result.status, "manual_review"); if (reason != null) assert.equal(result.safeReasonCode, reason); return result;
}

const complete = parse(contact());
assert.equal(complete.status, "verified");
assert.equal(complete.mapping?.result, "mapped");
assert.equal(complete.evidence?.ok, true);
assert.equal(complete.page?.forms[0]?.action, "https://example.com/send");

const multiple = manual(`${contact()}${contact()}`, "CONTACT_FORM_STATIC_NOT_UNAMBIGUOUS");
assert.equal(multiple.page?.forms.length, 2);
manual(`<!doctype html><form aria-label="Newsletter"><input type="email" name="email" required><button type="submit">Subscribe newsletter</button></form>`);
manual(`<!doctype html><form aria-label="Request a demo"><input type="email" name="email" required><textarea name="message"></textarea><button type="submit">Request demo</button></form>`);
manual(`<!doctype html><form aria-label="Customer support"><input type="email" name="email" required><textarea name="message"></textarea><button type="submit">Open support ticket</button></form>`);
manual(`${contact()}<div class="g-recaptcha"></div>`, "CONTACT_FORM_CAPTCHA_DETECTED");
manual(`<!doctype html><form><input type="password" name="password"><button type="submit">Sign in</button></form>`, "CONTACT_FORM_LOGIN_WALL_DETECTED");
manual(`<!doctype html><div id="root"></div><script>window.executed = true</script>`, "CONTACT_FORM_STATIC_DYNAMIC_FORM");
manual(`<!doctype html><div id="__next"></div><script id="__NEXT_DATA__">{}</script>`, "CONTACT_FORM_STATIC_DYNAMIC_FORM");
manual(`${contact()}<script>document.forms[0].remove()</script>`, "CONTACT_FORM_STATIC_DYNAMIC_FORM");

const hidden = parse(contact('<input type="hidden" name="token" value="safe">'));
assert.equal(hidden.status, "verified");
assert.equal(hidden.page?.forms[0]?.controls.some((control) => control.hidden), true);
manual(contact('<input name="company" required disabled>'));
manual(contact('<input name="company" required readonly>'));
manual(`<!doctype html><form><input required><input type="email" required><textarea required></textarea><button type="submit">Send</button></form>`);

const aria = parse(`<!doctype html><form aria-label="Contact us"><input aria-label="Full name" required><input aria-label="Email" type="email" required><textarea aria-label="Message" required></textarea><button type="submit">Send message</button></form>`);
assert.equal(aria.status, "verified");
const select = parse(contact('<label for="topic">Subject</label><select id="topic" name="topic"><option value="general">General inquiry</option></select>'));
assert.equal(select.status, "verified");
assert.equal(select.page?.forms[0]?.controls.some((control) => control.tag === "select"), true);
manual(contact().replace('<button type="submit">Send message</button>', ""));
manual(`${contact()}<style>form { display: none; }</style>`, "CONTACT_FORM_STATIC_VISIBILITY_AMBIGUOUS");

for (const control of [
  '<input form="contact" name="company" required>',
  '<button form="contact" type="submit">External submit</button>',
  '<textarea form="contact" name="other" required></textarea>',
  '<select form="contact" name="topic"><option>General</option></select>',
  '<input form="contact" type="hidden" name="token" value="x">',
  '<input form="unknown" name="unknown">',
]) manual(associated(control), "CONTACT_FORM_STATIC_FORM_ASSOCIATION_AMBIGUOUS");
manual(associated("").replace('<form id="contact" action=', '<form id="duplicate" action=').replace("</body>", '<form id="duplicate"></form></body>'), "CONTACT_FORM_STATIC_FORM_ASSOCIATION_AMBIGUOUS");

manual(withBase('<base href="https://third-party.example/forms/">'), "CONTACT_FORM_STATIC_BASE_AMBIGUOUS");
const sameOriginBase = parse(withBase('<base href="/forms/">', contact().replace('action="/send"', 'action="send"')));
assert.equal(sameOriginBase.status, "verified");
assert.equal(sameOriginBase.page?.forms[0]?.action, "https://example.com/forms/send");
manual(withBase('<base href="https://third-party.example/forms/">', contact().replace('action="/send"', 'action="https://forms.example/submit"')), "CONTACT_FORM_STATIC_BASE_AMBIGUOUS");
const emptyAction = parse(withBase('<base href="/forms/">', contact().replace('action="/send"', 'action=""')));
assert.equal(emptyAction.status, "verified");
assert.equal(emptyAction.page?.forms[0]?.action, URL);
const missingAction = parse(withBase('<base href="/forms/">', contact().replace(' action="/send"', "")));
assert.equal(missingAction.status, "verified");
assert.equal(missingAction.page?.forms[0]?.action, URL);
manual(withBase('<base href="/forms/"><base href="/other/">'), "CONTACT_FORM_STATIC_BASE_AMBIGUOUS");
manual(withBase('<base href="https://[bad">'), "CONTACT_FORM_STATIC_BASE_AMBIGUOUS");
manual(withBase('<base href="//third-party.example/forms/">'), "CONTACT_FORM_STATIC_BASE_AMBIGUOUS");
manual(withBase('<base href="javascript:alert(1)">'), "CONTACT_FORM_STATIC_BASE_AMBIGUOUS");

const malformed = parse("not an HTML document");
assert.deepEqual({ status: malformed.status, code: malformed.safeReasonCode }, { status: "failed", code: "CONTACT_FORM_STATIC_HTML_INVALID" });
manual(`<!doctype html><form action="https://forms.example/submit" aria-label="Contact us"><input name="name" required><input name="email" type="email" required><textarea name="message" required></textarea><button type="submit">Send message</button></form>`, "CONTACT_FORM_STATIC_EXTERNAL_ACTION");
manual("<!doctype html><html><body><p>Contact us by phone.</p></body></html>");

assert.equal((globalThis as { executed?: boolean }).executed, undefined, "scripts are parsed as text and never executed");
assert.equal(complete.submitControls.length, 1, "parser observes submit controls without submission");
assert.equal(complete.evidence?.ok, true, "existing evidence builder accepts static parser output");
console.log("PASS — contact-form static HTML parser");
