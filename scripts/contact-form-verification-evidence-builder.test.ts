import assert from "node:assert/strict";

import {
  buildContactFormVerificationEvidenceCandidate,
  type ContactFormVerificationEvidenceInput,
} from "../lib/backlinks/services/contactFormVerificationEvidence";

const validInput: ContactFormVerificationEvidenceInput = {
  formCount: 1,
  selectedFormOrdinal: 0,
  mappingResult: "mapped",
  mappedSemanticFields: [
    "sender_name",
    "sender_email",
    "message",
  ],
  messageFieldPresent: true,
  strictSubmitControlPresent: true,
  hasLoginWall: false,
  hasPasswordField: false,
  newsletterOnly: false,
  supportOnly: false,
  salesDemoOnly: false,
};

const valid =
  buildContactFormVerificationEvidenceCandidate(validInput);

assert.equal(valid.ok, true);

if (!valid.ok) {
  throw new Error("expected valid verification evidence");
}

assert.equal(valid.evidenceVersion, "cfv1");

assert.deepEqual(valid.safeEvidence, {
  actual_form_observed: true,
  form_count: 1,
  message_field_present: true,
  submit_control_present: true,
  contact_intent: true,
  newsletter_only: false,
  login_only: false,
  support_only: false,
  sales_demo_only: false,
});

const reject = (
  overrides: Partial<ContactFormVerificationEvidenceInput>,
  expectedReason: string,
) => {
  const result = buildContactFormVerificationEvidenceCandidate({
    ...validInput,
    ...overrides,
  });

  assert.equal(result.ok, false);

  if (result.ok) {
    throw new Error(`expected rejection: ${expectedReason}`);
  }

  assert.equal(result.reason, expectedReason);
};

reject({ formCount: 0 }, "actual_form_not_observed");
reject({ selectedFormOrdinal: null }, "selected_form_not_observed");
reject({ mappingResult: "manual_review" }, "form_not_mapped");
reject({ messageFieldPresent: false }, "message_field_not_observed");
reject(
  { strictSubmitControlPresent: false },
  "strict_submit_control_not_observed",
);
reject(
  { mappedSemanticFields: ["sender_name", "message"] },
  "contact_intent_not_proven",
);
reject(
  { mappedSemanticFields: ["sender_name", "sender_email"] },
  "contact_intent_not_proven",
);
reject({ newsletterOnly: true }, "newsletter_only");
reject({ hasLoginWall: true }, "login_only");
reject({ hasPasswordField: true }, "login_only");
reject({ supportOnly: true }, "support_only");
reject({ supportOnly: null }, "support_only_unknown");
reject({ salesDemoOnly: true }, "sales_demo_only");
reject({ salesDemoOnly: null }, "sales_demo_only_unknown");

console.log("PASS — contact-form verification evidence builder");
