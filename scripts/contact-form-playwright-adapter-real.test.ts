import assert from "node:assert/strict";

import {
  createPlaywrightChromiumBrowserRuntime,
  type ContactFormBrowserRequest,
} from "../lib/backlinks/services/contactFormNavigationWorker";

const targetUrl = "https://hostalaska.org/contact";
const observedRequests: ContactFormBrowserRequest[] = [];

async function main() {
  const runtime = await createPlaywrightChromiumBrowserRuntime();
  try {
    const session = await runtime.openContext();
    try {
      await session.page.routeRequests(async (request) => {
        observedRequests.push(request);
        return request.method === "GET" || request.method === "HEAD" ? "continue" : "abort";
      });

      await session.page.goto(targetUrl, { timeoutMs: 15_000 });
      const signals = await session.page.evaluatePageSignals();
      const page = await session.page.inspectForms();
      const subjectSelect = page.forms.flatMap((form) => form.controls).find((control) => control.tag === "select" && control.id === "subject" && control.name === "subject");

      assert.equal(session.page.url(), targetUrl, "navigation must remain on the Host Alaska contact page");
      assert.equal(typeof signals.hasCaptcha, "boolean", "page signals must be evaluated through the real adapter");
      assert.equal(page.forms.length, 1, "Host Alaska must expose exactly one contact form");
      assert.ok(page.forms[0]?.controls.length, "real adapter must discover form controls");
      assert.equal(subjectSelect?.required, true, "Host Alaska subject select must be marked required");
      assert.equal(subjectSelect?.optionsCount, 9, "Host Alaska subject select option count must be discovered");
      assert.equal(subjectSelect?.options?.[0]?.labelText, "Select a topic...", "placeholder label must be discovered");
      assert.equal(subjectSelect?.options?.[0]?.normalizedLabel, "select a topic...", "placeholder normalized label must be discovered");
      assert.equal(subjectSelect?.options?.[0]?.valuePresent, false, "placeholder value must be recognized as empty without exposing it");
      assert.equal(subjectSelect?.options?.some((option) => option.normalizedLabel === "other" && option.valuePresent && !option.disabled), true, "Other must be discovered as a non-empty enabled option");
      assert.ok(observedRequests.length > 0, "navigation must make GET-only requests");
      assert.ok(observedRequests.every((request) => request.method === "GET" || request.method === "HEAD"), "the regression must not allow a mutating network request");
      console.log("PASS — real tsx + Playwright contact-form adapter regression");
    } finally {
      await session.close();
    }
  } finally {
    await runtime.close?.();
  }
}

void main();
