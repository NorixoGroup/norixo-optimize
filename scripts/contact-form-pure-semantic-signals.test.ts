import assert from "node:assert/strict";

import {
  deriveContactFormSemanticSignals,
} from "../lib/backlinks/services/contactFormPureEvidence";

import type {
  ContactFormDiscoveredForm,
} from "../lib/backlinks/services/contactFormMappingPreview";

function form(
  overrides: Partial<ContactFormDiscoveredForm> = {},
): ContactFormDiscoveredForm {
  return {
    ordinal: 0,
    action: "/contact",
    method: "post",
    labelText: "",
    legendText: "",
    buttonText: "",
    controls: [],
    ...overrides,
  } as ContactFormDiscoveredForm;
}

assert.deepEqual(
  deriveContactFormSemanticSignals(form()),
  {
    supportOnly: null,
    salesDemoOnly: null,
  },
  "absence of semantic evidence must remain UNKNOWN",
);

assert.deepEqual(
  deriveContactFormSemanticSignals(
    form({
      labelText: "Customer Support",
      buttonText: "Submit support request",
    }),
  ),
  {
    supportOnly: true,
    salesDemoOnly: null,
  },
  "positive support-only evidence",
);

assert.deepEqual(
  deriveContactFormSemanticSignals(
    form({
      legendText: "Talk to Sales",
      buttonText: "Request a demo",
    }),
  ),
  {
    supportOnly: null,
    salesDemoOnly: true,
  },
  "positive sales/demo-only evidence",
);

assert.deepEqual(
  deriveContactFormSemanticSignals(
    form({
      labelText: "Contact us",
      buttonText: "Send us a message",
    }),
  ),
  {
    supportOnly: false,
    salesDemoOnly: false,
  },
  "positive general-contact evidence can prove both restricted-only flags false",
);

assert.deepEqual(
  deriveContactFormSemanticSignals(
    form({
      labelText: "Contact us — Customer Support",
      buttonText: "Send us a message",
    }),
  ),
  {
    supportOnly: null,
    salesDemoOnly: false,
  },
  "conflicting general/support evidence must remain UNKNOWN for support-only",
);

assert.deepEqual(
  deriveContactFormSemanticSignals(
    form({
      labelText: "Contact us",
      legendText: "Talk to Sales",
      buttonText: "Send us a message",
    }),
  ),
  {
    supportOnly: false,
    salesDemoOnly: null,
  },
  "conflicting general/sales evidence must remain UNKNOWN for sales-demo-only",
);

assert.deepEqual(
  deriveContactFormSemanticSignals(
    form({
      buttonText: "Support",
    }),
  ),
  {
    supportOnly: null,
    salesDemoOnly: null,
  },
  "weak isolated keyword must not manufacture a classification",
);

assert.deepEqual(
  deriveContactFormSemanticSignals(
    form({
      buttonText: "Demo",
    }),
  ),
  {
    supportOnly: null,
    salesDemoOnly: null,
  },
  "isolated demo keyword must remain UNKNOWN",
);

console.log("contact-form pure semantic signal tests passed");
