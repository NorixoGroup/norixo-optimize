import type {
  ContactFormDiscoveredPage,
  ContactFormMappingPreview,
} from "@/lib/backlinks/services/contactFormMappingPreview";

import {
  deriveContactFormPureEvidence,
  deriveContactFormSemanticSignals,
} from "@/lib/backlinks/services/contactFormPureEvidence";

import {
  buildContactFormVerificationEvidenceCandidate,
  type ContactFormVerificationEvidenceCandidate,
} from "@/lib/backlinks/services/contactFormVerificationEvidence";

type RuntimePageSignals = Readonly<{
  hasLoginWall: boolean;
  hasPasswordField: boolean;
}>;

type RuntimeSubmitControl = Readonly<{
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
}>;

export type ContactFormVerificationRuntimeAdapterInput = Readonly<{
  page: ContactFormDiscoveredPage;
  mapping: ContactFormMappingPreview;
  pageSignals: RuntimePageSignals;
  submitControls: readonly RuntimeSubmitControl[];
}>;

export function buildContactFormVerificationEvidenceFromRuntime(
  input: ContactFormVerificationRuntimeAdapterInput,
): ContactFormVerificationEvidenceCandidate {
  const selectedForm =
    input.mapping.selectedFormOrdinal == null
      ? null
      : input.page.forms.find(
          (form) => form.ordinal === input.mapping.selectedFormOrdinal,
        ) ?? null;

  const semanticSignals =
    selectedForm == null
      ? {
          supportOnly: null,
          salesDemoOnly: null,
        }
      : deriveContactFormSemanticSignals(selectedForm);

  const pureEvidence = deriveContactFormPureEvidence({
    page: {
      pageUrl: input.page.pageUrl,
      pageTitle: input.page.pageTitle,
      forms: [...input.page.forms],
    },
    mapping: {
      result: input.mapping.result,
      selectedFormOrdinal: input.mapping.selectedFormOrdinal,
      selectedFormFingerprint: input.mapping.selectedFormFingerprint,
      mappedFields: input.mapping.mappedFields.map((field) => ({
        semanticField: field.semanticField,
      })),
    },
    submitControls: [...input.submitControls],
    supportSignal: semanticSignals.supportOnly,
    salesDemoOnlySignal: semanticSignals.salesDemoOnly,
  });

  const newsletterOnly =
    input.mapping.blockingReasons.includes("newsletter_only_form_detected");

  return buildContactFormVerificationEvidenceCandidate({
    formCount: input.mapping.formCount,
    selectedFormOrdinal: input.mapping.selectedFormOrdinal,
    mappingResult: input.mapping.result,
    mappedSemanticFields: input.mapping.mappedFields.map(
      (field) => field.semanticField,
    ),
    messageFieldPresent: pureEvidence.message_field_present,
    strictSubmitControlPresent:
      pureEvidence.strict_submit_control_present,
    hasLoginWall: input.pageSignals.hasLoginWall,
    hasPasswordField: input.pageSignals.hasPasswordField,
    newsletterOnly,
    supportOnly: pureEvidence.support_only,
    salesDemoOnly: pureEvidence.sales_demo_only,
  });
}
