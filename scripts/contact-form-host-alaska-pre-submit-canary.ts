import assert from "node:assert/strict";

import {
  createPlaywrightChromiumBrowserRuntime,
  resolveHostnamePublicAddresses,
  validateContactFormNavigationUrl,
  type ContactFormBrowserRequest,
} from "../lib/backlinks/services/contactFormNavigationWorker";

import {
  buildContactFormMappingPreview,
  type ContactFormApprovedContent,
  type ContactFormSupportedSemanticField,
} from "../lib/backlinks/services/contactFormMappingPreview";

import { buildContactFormPinnedConnectionTarget } from "../lib/backlinks/services/contactFormProxyPolicy";

const TARGET_URL = "https://hostalaska.org/contact";
const NAVIGATION_TIMEOUT_MS = 15_000;
const FIELD_TIMEOUT_MS = 5_000;

const approvedContent: ContactFormApprovedContent = {
  senderName: "Norixo Canary",
  senderFirstName: "Norixo",
  senderLastName: "Canary",
  senderEmail: "contact@norixo.io",
  senderCompany: "Norixo",
  senderWebsite: "https://norixo.io",
  subject: "Other",
  body: "Norixo pre-submit contact-form canary. This message must never be submitted.",
};

function valueForSemantic(
  semantic: ContactFormSupportedSemanticField,
): string | null {
  switch (semantic) {
    case "sender_name":
      return approvedContent.senderName;
    case "sender_first_name":
      return approvedContent.senderFirstName ?? null;
    case "sender_last_name":
      return approvedContent.senderLastName ?? null;
    case "sender_email":
      return approvedContent.senderEmail;
    case "sender_company":
      return approvedContent.senderCompany;
    case "sender_website":
      return approvedContent.senderWebsite;
    case "subject":
      return approvedContent.subject;
    case "message":
      return approvedContent.body;
  }
}

async function main() {
  const observedRequests: ContactFormBrowserRequest[] = [];

  const target = await validateContactFormNavigationUrl(
    TARGET_URL,
    resolveHostnamePublicAddresses,
  );

  assert.equal(
    target.ok,
    true,
    "Host Alaska target must pass URL validation",
  );

  if (!target.ok) return;

  const pinnedTarget = buildContactFormPinnedConnectionTarget({
    authorityHostname: target.hostname,
    selectedAddress: target.selectedAddress,
    port: Number(target.url.port || "443"),
  });

  const runtime = await createPlaywrightChromiumBrowserRuntime();

  try {
    const session = await runtime.openContext({ pinnedTarget });

    try {
      await session.page.routeRequests(async (request) => {
        observedRequests.push(request);

        return request.method === "GET" || request.method === "HEAD"
          ? "continue"
          : "abort";
      });

      await session.page.goto(TARGET_URL, {
        timeoutMs: NAVIGATION_TIMEOUT_MS,
      });

      assert.equal(
        session.page.url(),
        TARGET_URL,
        "navigation must remain on Host Alaska contact page",
      );

      const signals = await session.page.evaluatePageSignals();

      assert.equal(signals.hasCaptcha, false, "captcha must not be present");
      assert.equal(signals.hasLoginWall, false, "login wall must not be present");
      assert.equal(
        signals.hasPasswordField,
        false,
        "password field must not be present",
      );

      const discoveredPage = await session.page.inspectForms();

      assert.equal(
        discoveredPage.forms.length,
        1,
        "Host Alaska must expose exactly one form",
      );

      const mapping = buildContactFormMappingPreview({
        page: discoveredPage,
        approvedContent,
        pageSignals: signals,
      });

      assert.equal(mapping.result, "mapped", "mapping must be deterministic");
      assert.equal(mapping.selectedFormOrdinal, 0);
      assert.ok(mapping.selectedFormFingerprint);
      assert.ok(mapping.mappedFields.length > 0);

      for (const field of mapping.mappedFields) {
        const before = await session.page.readFieldValue(field.locator);

        assert.equal(
          before ?? "",
          "",
          `mapped field ${field.semanticField} must start empty`,
        );

        if (field.assignmentType === "select_option") {
          assert.ok(
            field.selectOption,
            `select option required for ${field.semanticField}`,
          );

          await session.page.selectFieldOption(
            field.locator,
            field.selectOption,
            { timeoutMs: FIELD_TIMEOUT_MS },
          );

          const after = await session.page.readFieldValue(field.locator);

          assert.ok(
            after != null && after.trim().length > 0,
            `select ${field.semanticField} must have non-empty readback`,
          );

          continue;
        }

        const expected = valueForSemantic(field.semanticField);

        assert.ok(
          expected != null && expected.length > 0,
          `approved value required for ${field.semanticField}`,
        );

        await session.page.fillField(
          field.locator,
          expected,
          { timeoutMs: FIELD_TIMEOUT_MS },
        );

        const after = await session.page.readFieldValue(field.locator);

        assert.equal(
          after,
          expected,
          `readback mismatch for ${field.semanticField}`,
        );
      }

      assert.equal(
        mapping.selectedFormOrdinal,
        0,
        "selected form ordinal must remain pinned to form 0",
      );

      const submitControls = await session.page.listSubmitControls(
        mapping.selectedFormOrdinal,
      );

      const actionableSubmitControls = submitControls.filter(
        (control) =>
          control.visible &&
          control.enabled &&
          !control.disabled &&
          !control.hidden,
      );

      assert.equal(
        actionableSubmitControls.length,
        1,
        "exactly one actionable submit control must exist",
      );

      assert.ok(
        observedRequests.length > 0,
        "the canary must observe browser requests",
      );

      assert.ok(
        observedRequests.every(
          (request) =>
            request.method === "GET" || request.method === "HEAD",
        ),
        "no mutating network request may be allowed",
      );

      console.log("PASS — Host Alaska pre-submit canary");
      console.log(`MAPPING_RESULT=${mapping.result}`);
      console.log(`MAPPED_FIELDS=${mapping.mappedFields.length}`);
      console.log(`SUBMIT_CONTROLS=${submitControls.length}`);
      console.log(
        `ACTIONABLE_SUBMIT_CONTROLS=${actionableSubmitControls.length}`,
      );
      console.log("FORM_FILLED=YES");
      console.log("SUBMIT_CLICK=NO");
      console.log("NETWORK_MUTATION_ALLOWED=NO");
      console.log("DB_WRITE=NO");
    } finally {
      await session.close();
    }
  } finally {
    await runtime.close?.();
  }
}

void main();
