import assert from "node:assert/strict";
import test from "node:test";

import {
  buildContactFormVerificationEvidenceFromRuntime,
} from "@/lib/backlinks/services/contactFormVerificationRuntimeAdapter";

import type {
  ContactFormDiscoveredPage,
  ContactFormMappingPreview,
} from "@/lib/backlinks/services/contactFormMappingPreview";

const page: ContactFormDiscoveredPage = {
  pageUrl: "https://example.com/contact",
  pageTitle: "Contact us",
  forms: [
    {
      ordinal: 0,
      action: "/contact",
      method: "POST",
      labelText: "Contact us",
      legendText: null,
      buttonText: "Send message",
      controls: [
        {
          ordinal: 0,
          tag: "input",
          type: "email",
          name: "email",
          id: "email",
          autocomplete: "email",
          labelText: "Email",
          ariaLabel: null,
          ariaLabelledbyText: null,
          placeholder: null,
          required: true,
          disabled: false,
          readOnly: false,
          hidden: false,
          visible: true,
          valuePresent: false,
        },
        {
          ordinal: 1,
          tag: "textarea",
          type: "textarea",
          name: "message",
          id: "message",
          autocomplete: null,
          labelText: "Message",
          ariaLabel: null,
          ariaLabelledbyText: null,
          placeholder: null,
          required: true,
          disabled: false,
          readOnly: false,
          hidden: false,
          visible: true,
          valuePresent: false,
        },
      ],
    },
  ],
};

const mapping = {
  version: "contact_form_mapping_preview_v1",
  result: "mapped",
  selectedFormOrdinal: 0,
  selectedFormFingerprint: "form-fingerprint",
  formActionOrigin: "https://example.com",
  formActionPath: "/contact",
  formActionSearch: null,
  formMethod: "POST",
  formCount: 1,
  candidateCount: 1,
  mappedFields: [
    {
      semanticField: "sender_email",
      fieldFingerprint: "email-fingerprint",
      locator: {
        strategy: "field_fingerprint",
        formOrdinal: 0,
        controlOrdinal: 0,
        name: "email",
        id: "email",
      },
      controlType: "email",
      required: true,
      classification: "SUPPORTED_EXACT",
      assignmentType: "field_value",
      selectOption: null,
      sourceValueFingerprint: "source-email",
      sourceValueLength: 16,
      sourceValueRedaction: "[redacted]",
    },
    {
      semanticField: "message",
      fieldFingerprint: "message-fingerprint",
      locator: {
        strategy: "field_fingerprint",
        formOrdinal: 0,
        controlOrdinal: 1,
        name: "message",
        id: "message",
      },
      controlType: "textarea",
      required: true,
      classification: "SUPPORTED_EXACT",
      assignmentType: "field_value",
      selectOption: null,
      sourceValueFingerprint: "source-message",
      sourceValueLength: 42,
      sourceValueRedaction: "[redacted]",
    },
  ],
  discoveredFields: [],
  unsupportedRequiredFields: [],
  blockingReasons: [],
  mappingFingerprint: "mapping-fingerprint",
  evidenceBounded: true,
  fullHtmlPersisted: false,
} satisfies ContactFormMappingPreview;

const submitControls = [
  {
    formOrdinal: 0,
    controlOrdinal: 2,
    tag: "button",
    type: "submit",
    name: null,
    id: "submit",
    visible: true,
    enabled: true,
    disabled: false,
    hidden: false,
    fingerprint: "submit-fingerprint",
  },
];

test("runtime adapter derives a safe cfv1 candidate from observed runtime facts", () => {
  const result = buildContactFormVerificationEvidenceFromRuntime({
    page,
    mapping,
    pageSignals: {
      hasLoginWall: false,
      hasPasswordField: false,
    },
    submitControls,
  });

  assert.equal(result.ok, true);

  if (!result.ok) return;

  assert.equal(result.evidenceVersion, "cfv1");
  assert.equal(result.safeEvidence.actual_form_observed, true);
  assert.equal(result.safeEvidence.form_count, 1);
  assert.equal(result.safeEvidence.message_field_present, true);
  assert.equal(result.safeEvidence.submit_control_present, true);
  assert.equal(result.safeEvidence.contact_intent, true);
  assert.equal(result.safeEvidence.newsletter_only, false);
  assert.equal(result.safeEvidence.login_only, false);
  assert.equal(result.safeEvidence.support_only, false);
  assert.equal(result.safeEvidence.sales_demo_only, false);
});

test("runtime adapter stays conservative when semantic purpose is unknown", () => {
  const unknownPage: ContactFormDiscoveredPage = {
    ...page,
    forms: [
      {
        ...page.forms[0],
        labelText: null,
        legendText: null,
        buttonText: null,
      },
    ],
  };

  const result = buildContactFormVerificationEvidenceFromRuntime({
    page: unknownPage,
    mapping,
    pageSignals: {
      hasLoginWall: false,
      hasPasswordField: false,
    },
    submitControls,
  });

  assert.equal(result.ok, false);

  if (result.ok) return;

  assert.equal(result.reason, "support_only_unknown");
});

test("runtime adapter rejects login evidence", () => {
  const result = buildContactFormVerificationEvidenceFromRuntime({
    page,
    mapping,
    pageSignals: {
      hasLoginWall: true,
      hasPasswordField: false,
    },
    submitControls,
  });

  assert.deepEqual(result, {
    ok: false,
    reason: "login_only",
  });
});

test("runtime adapter rejects missing strict submit control", () => {
  const result = buildContactFormVerificationEvidenceFromRuntime({
    page,
    mapping,
    pageSignals: {
      hasLoginWall: false,
      hasPasswordField: false,
    },
    submitControls: [],
  });

  assert.deepEqual(result, {
    ok: false,
    reason: "strict_submit_control_not_observed",
  });
});
