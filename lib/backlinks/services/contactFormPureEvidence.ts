type TriState = boolean | null;

type PageControl = Readonly<{
  ordinal: number;
  tag: "input" | "textarea" | "select" | "button";
  type: string | null;
  name: string | null;
  id: string | null;
  autocomplete: string | null;
  labelText: string | null;
  ariaLabel: string | null;
  ariaLabelledbyText: string | null;
  placeholder: string | null;
  required: boolean;
  disabled: boolean;
  readOnly: boolean;
  hidden: boolean;
  visible: boolean;
  valuePresent: boolean;
}>;

type PageForm = Readonly<{
  ordinal: number;
  action: string | null;
  method: string | null;
  labelText: string | null;
  legendText: string | null;
  buttonText: string | null;
  controls: readonly PageControl[];
}>;

type Mapping = {
  result: "mapped" | string;
  selectedFormOrdinal: number | null;
  selectedFormFingerprint: string | null;
  mappedFields: Array<{
    semanticField: string;
  }>;
};

type SubmitControl = {
  formOrdinal: number;
  controlOrdinal: number;
  tag: string;
  type: string;
  name: string | null;
  id: string | null;
  visible: boolean;
  enabled: boolean;
  disabled: boolean;
  hidden: boolean;
  fingerprint: string;
};

export type ContactFormPureEvidenceInput = {
  page: {
    pageUrl: string;
    pageTitle: string | null;
    forms: PageForm[];
  };
  mapping: Mapping;
  submitControls: SubmitControl[];
  supportSignal: TriState;
  salesDemoOnlySignal: TriState;
};


export type ContactFormSemanticSignals = {
  supportOnly: boolean | null;
  salesDemoOnly: boolean | null;
};

function normalizeSemanticText(value: unknown): string {
  if (typeof value !== "string") return "";

  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function collectObservedFormSemanticText(form: PageForm): string {
  const parts: string[] = [
    form.labelText ?? "",
    form.legendText ?? "",
    form.buttonText ?? "",
  ];

  for (const control of form.controls ?? []) {
    parts.push(
      control.labelText ?? "",
      control.ariaLabel ?? "",
      control.ariaLabelledbyText ?? "",
      control.placeholder ?? "",
      control.name ?? "",
      control.id ?? "",
    );
  }

  return normalizeSemanticText(parts.join(" "));
}

function containsAnyPhrase(text: string, phrases: readonly string[]): boolean {
  return phrases.some((phrase) => {
    const normalized = normalizeSemanticText(phrase);
    return normalized.length > 0 && (` ${text} `).includes(` ${normalized} `);
  });
}

/**
 * Conservative tri-state semantic classification.
 *
 * true  = positive evidence that the observed form is purpose-restricted.
 * false = positive evidence of a general-contact form that conflicts with
 *         the restricted-only interpretation.
 * null  = insufficient or ambiguous evidence.
 *
 * Absence of a support/sales/demo keyword is never enough to manufacture
 * false. UNKNOWN stays UNKNOWN.
 */
export function deriveContactFormSemanticSignals(
  form: PageForm,
): ContactFormSemanticSignals {
  const text = collectObservedFormSemanticText(form);

  if (!text) {
    return {
      supportOnly: null,
      salesDemoOnly: null,
    };
  }

  const supportEvidence = containsAnyPhrase(text, [
    "customer support",
    "customer service",
    "technical support",
    "tech support",
    "support request",
    "support ticket",
    "help desk",
    "help center",
    "help centre",
    "contact support",
  ]);

  const salesDemoEvidence = containsAnyPhrase(text, [
    "book a demo",
    "request a demo",
    "schedule a demo",
    "get a demo",
    "talk to sales",
    "speak to sales",
    "contact sales",
    "sales inquiry",
    "sales enquiry",
    "sales team",
  ]);

  const generalContactEvidence = containsAnyPhrase(text, [
    "contact us",
    "get in touch",
    "send us a message",
    "send a message",
    "write to us",
    "general inquiry",
    "general enquiry",
  ]);

  return {
    supportOnly: supportEvidence
      ? generalContactEvidence
        ? null
        : true
      : generalContactEvidence
        ? false
        : null,

    salesDemoOnly: salesDemoEvidence
      ? generalContactEvidence
        ? null
        : true
      : generalContactEvidence
        ? false
        : null,
  };
}

export type ContactFormPureEvidence = {
  form_present: boolean;
  message_field_present: boolean;
  strict_submit_control_present: boolean;
  support_only: TriState;
  sales_demo_only: TriState;
};

export function deriveContactFormPureEvidence(
  input: ContactFormPureEvidenceInput,
): ContactFormPureEvidence {
  const selectedForm =
    input.mapping.selectedFormOrdinal == null
      ? null
      : input.page.forms.find(
          (form) => form.ordinal === input.mapping.selectedFormOrdinal,
        ) ?? null;

  const formPresent = input.page.forms.length > 0;

  const messageFieldPresent =
    selectedForm?.controls.some(
      (control) =>
        control.tag === "textarea" ||
        control.type?.toLowerCase() === "textarea",
    ) ?? false;

  const selectedFormSubmitControls =
    selectedForm == null
      ? []
      : input.submitControls.filter(
          (control) => control.formOrdinal === selectedForm.ordinal,
        );

  const strictSubmitControlPresent =
    selectedFormSubmitControls.length === 1 &&
    selectedFormSubmitControls[0].visible &&
    selectedFormSubmitControls[0].enabled &&
    !selectedFormSubmitControls[0].disabled &&
    !selectedFormSubmitControls[0].hidden &&
    (selectedFormSubmitControls[0].tag === "button" ||
      selectedFormSubmitControls[0].tag === "input") &&
    selectedFormSubmitControls[0].type.toLowerCase() === "submit";

  return {
    form_present: formPresent,
    message_field_present: messageFieldPresent,
    strict_submit_control_present: strictSubmitControlPresent,
    support_only: input.supportSignal,
    sales_demo_only: input.salesDemoOnlySignal,
  };
}
