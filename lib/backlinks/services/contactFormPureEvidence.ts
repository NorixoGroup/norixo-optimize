type TriState = boolean | null;

type PageControl = {
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
};

type PageForm = {
  ordinal: number;
  action: string | null;
  method: string | null;
  labelText: string | null;
  legendText: string | null;
  buttonText: string | null;
  controls: PageControl[];
};

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
