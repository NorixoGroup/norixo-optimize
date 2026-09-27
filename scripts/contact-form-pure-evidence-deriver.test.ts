import assert from "node:assert/strict";

import {
  deriveContactFormPureEvidence,
} from "../lib/backlinks/services/contactFormPureEvidence";

function baseInput() {
  return {
    page: {
      pageUrl: "https://example.com/contact",
      pageTitle: "Contact us",
      forms: [
        {
          ordinal: 0,
          action: "/contact",
          method: "post",
          labelText: "Contact us",
          legendText: null,
          buttonText: "Send message",
          controls: [
            {
              ordinal: 0,
              tag: "input" as const,
              type: "text",
              name: "name",
              id: "name",
              autocomplete: "name",
              labelText: "Your name",
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
              tag: "input" as const,
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
              ordinal: 2,
              tag: "textarea" as const,
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
            {
              ordinal: 3,
              tag: "button" as const,
              type: "submit",
              name: null,
              id: "submit",
              autocomplete: null,
              labelText: "Send message",
              ariaLabel: null,
              ariaLabelledbyText: null,
              placeholder: null,
              required: false,
              disabled: false,
              readOnly: false,
              hidden: false,
              visible: true,
              valuePresent: false,
            },
          ],
        },
      ],
    },
    mapping: {
      result: "mapped" as const,
      selectedFormOrdinal: 0,
      selectedFormFingerprint: "form-fingerprint",
      mappedFields: [
        { semanticField: "sender_name" as const },
        { semanticField: "sender_email" as const },
        { semanticField: "message" as const },
      ],
    },
    submitControls: [
      {
        formOrdinal: 0,
        controlOrdinal: 3,
        tag: "button" as const,
        type: "submit" as const,
        name: null,
        id: "submit",
        visible: true,
        enabled: true,
        disabled: false,
        hidden: false,
        fingerprint: "submit-fingerprint",
      },
    ],
    supportSignal: false as boolean | null,
    salesDemoOnlySignal: null as boolean | null,
  };
}

{
  const evidence = deriveContactFormPureEvidence(baseInput());

  assert.equal(evidence.form_present, true);
  assert.equal(evidence.message_field_present, true);
  assert.equal(evidence.strict_submit_control_present, true);
  assert.equal(evidence.support_only, false);

  // Critical invariant:
  // UNKNOWN must remain UNKNOWN. Never manufacture false.
  assert.equal(evidence.sales_demo_only, null);
}

{
  const input = baseInput();
  input.supportSignal = null;

  const evidence = deriveContactFormPureEvidence(input);

  assert.equal(
    evidence.support_only,
    null,
    "absence of support evidence must remain unknown",
  );
}

{
  const input = baseInput();
  input.salesDemoOnlySignal = true;

  const evidence = deriveContactFormPureEvidence(input);

  assert.equal(evidence.sales_demo_only, true);
}

{
  const input = baseInput();
  input.page.forms = [];

  const evidence = deriveContactFormPureEvidence(input);

  assert.equal(evidence.form_present, false);
  assert.equal(evidence.message_field_present, false);
  assert.equal(evidence.strict_submit_control_present, false);
}


{
  const input = baseInput();
  input.submitControls.push({
    ...input.submitControls[0],
    controlOrdinal: 4,
    id: "submit-2",
    fingerprint: "submit-fingerprint-2",
  });

  const evidence = deriveContactFormPureEvidence(input);

  assert.equal(
    evidence.strict_submit_control_present,
    false,
    "multiple submit controls on the selected form must not satisfy strict submit evidence",
  );
}

{
  const input = baseInput();
  input.submitControls[0].disabled = true;
  input.submitControls[0].enabled = false;

  const evidence = deriveContactFormPureEvidence(input);

  assert.equal(
    evidence.strict_submit_control_present,
    false,
    "disabled submit control must not satisfy strict submit evidence",
  );
}

{
  const input = baseInput();
  input.submitControls[0].hidden = true;
  input.submitControls[0].visible = false;

  const evidence = deriveContactFormPureEvidence(input);

  assert.equal(
    evidence.strict_submit_control_present,
    false,
    "hidden submit control must not satisfy strict submit evidence",
  );
}

{
  const input = baseInput();
  input.submitControls[0].formOrdinal = 1;

  const evidence = deriveContactFormPureEvidence(input);

  assert.equal(
    evidence.strict_submit_control_present,
    false,
    "submit control from another form must not satisfy strict submit evidence",
  );
}

{
  const input = baseInput();
  input.submitControls[0].tag = "a" as never;

  const evidence = deriveContactFormPureEvidence(input);

  assert.equal(
    evidence.strict_submit_control_present,
    false,
    "unsupported submit tag must not satisfy strict submit evidence",
  );
}

console.log("PASS — contact-form pure evidence deriver");
