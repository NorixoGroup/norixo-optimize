import assert from "node:assert/strict";
import { chromium } from "playwright-core";

import {
  contactFormNavigationWorkerTestHooks,
  type ContactFormBrowserPage,
} from "../lib/backlinks/services/contactFormNavigationWorker";

const { adaptPlaywrightPage } = contactFormNavigationWorkerTestHooks;

const ORIGIN = "https://forms.example";
const FORM_FINGERPRINT = "cf-r24g4-selected-form";

async function setFixture(
  rawPage: import("playwright-core").Page,
  body: string,
  path = "/contact",
) {
  await rawPage.goto(`${ORIGIN}${path}`);
  await rawPage.setContent(`<!doctype html><html><body>${body}</body></html>`);
}

async function observe(page: ContactFormBrowserPage) {
  return page.observeSubmissionConfirmation({
    expectedOrigin: ORIGIN,
    selectedFormOrdinal: 0,
    selectedFormFingerprint: FORM_FINGERPRINT,
    timeoutMs: 250,
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext();

    try {
      const rawPage = await context.newPage();

      await rawPage.route("**/*", async (route) => {
        const request = route.request();
        const url = new URL(request.url());

        if (
          request.isNavigationRequest() &&
          request.method() === "GET" &&
          url.origin === ORIGIN
        ) {
          await route.fulfill({
            status: 200,
            contentType: "text/html",
            body: "<!doctype html><html><body></body></html>",
          });
          return;
        }

        await route.abort("blockedbyclient");
      });

      const page = adaptPlaywrightPage(rawPage);

      // T1 — explicit visible success marker.
      await setFixture(
        rawPage,
        `
          <form id="contact-form"><input name="name"></form>
          <div
            id="success-explicit"
            data-norixo-contact-form-confirmation="success"
          >Message sent successfully</div>
        `,
      );

      const explicit = await observe(page);
      assert.equal(explicit.confirmed, true);
      if (explicit.confirmed) {
        assert.equal(explicit.kind, "EXPLICIT_SUCCESS_ELEMENT");
        assert.equal(explicit.markerId, "success-explicit");
      }
      console.log("T1_EXPLICIT_SUCCESS_ELEMENT=PASS");

      // T2 — selected form disappeared and explicit replacement exists.
      await setFixture(
        rawPage,
        `
          <div
            id="success-replacement"
            data-norixo-contact-form-replacement="success"
          >Your message has been received</div>
        `,
      );

      const replacement = await observe(page);
      assert.equal(replacement.confirmed, true);
      if (replacement.confirmed) {
        assert.equal(replacement.kind, "EXPLICIT_SUCCESS_REPLACEMENT");
        assert.equal(replacement.markerId, "success-replacement");
      }
      console.log("T2_EXPLICIT_SUCCESS_REPLACEMENT=PASS");

      // T3 — known same-host confirmation path.
      await setFixture(
        rawPage,
        `<div>Submission result</div>`,
        "/thank-you",
      );

      const knownPath = await observe(page);
      assert.equal(knownPath.confirmed, true);
      if (knownPath.confirmed) {
        assert.equal(knownPath.kind, "KNOWN_SAME_HOST_CONFIRMATION_PATH");
        assert.equal(knownPath.markerId, null);
      }
      console.log("T3_KNOWN_SAME_HOST_CONFIRMATION_PATH=PASS");

      // T4 — hidden marker must not confirm.
      await setFixture(
        rawPage,
        `
          <form id="contact-form"><input name="name"></form>
          <div
            id="hidden-success"
            data-contact-form-confirmation="success"
            style="display:none"
          >Message sent</div>
        `,
      );

      const hidden = await observe(page);
      assert.equal(hidden.confirmed, false);
      if (!hidden.confirmed) {
        assert.equal(hidden.reason, "no_explicit_confirmation");
      }
      console.log("T4_HIDDEN_MARKER_REJECTED=PASS");

      // T5 — empty marker must not confirm.
      await setFixture(
        rawPage,
        `
          <form id="contact-form"><input name="name"></form>
          <div
            id="empty-success"
            data-contact-form-confirmation="success"
          ></div>
        `,
      );

      const empty = await observe(page);
      assert.equal(empty.confirmed, false);
      if (!empty.confirmed) {
        assert.equal(empty.reason, "no_explicit_confirmation");
      }
      console.log("T5_EMPTY_MARKER_REJECTED=PASS");

      // T6 — form disappearance alone must not confirm.
      await setFixture(
        rawPage,
        `<div id="neutral-result">Submission finished</div>`,
      );

      const disappeared = await observe(page);
      assert.equal(disappeared.confirmed, false);
      if (!disappeared.confirmed) {
        assert.equal(disappeared.reason, "no_explicit_confirmation");
      }
      console.log("T6_FORM_DISAPPEARANCE_ALONE_REJECTED=PASS");

      // T7 — generic thank-you text without explicit marker must not confirm.
      await setFixture(
        rawPage,
        `
          <form id="contact-form"><input name="name"></form>
          <div id="generic-thanks">
            Thank you! Your message was sent successfully.
          </div>
        `,
      );

      const generic = await observe(page);
      assert.equal(generic.confirmed, false);
      if (!generic.confirmed) {
        assert.equal(generic.reason, "no_explicit_confirmation");
      }
      console.log("T7_GENERIC_THANK_YOU_REJECTED=PASS");

      console.log("PASS — real Playwright confirmation detector regression");
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

void main();
