import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  CONTACT_FORM_SUPPORTED_CONTROL_TYPES,
  CONTACT_FORM_SUPPORTED_SEMANTIC_FIELDS,
  buildContactFormMappingPreview,
  contactFormMappingPreviewToSafeMetadata,
  type ContactFormApprovedContent,
  type ContactFormDiscoveredControl,
  type ContactFormDiscoveredForm,
  type ContactFormDiscoveredSelectOption,
  type ContactFormMappingPreview,
  type ContactFormSupportedSemanticField,
} from "../lib/backlinks/services/contactFormMappingPreview";
import { validateContactFormNavigationUrl } from "../lib/backlinks/services/contactFormNavigationWorker";

type TestCase = { name: string; run: () => Promise<void> | void };
const tests: TestCase[] = [];
function test(name: string, run: TestCase["run"]) {
  tests.push({ name, run });
}

const approvedContent: ContactFormApprovedContent = {
  senderName: "Norixo Operator",
  senderEmail: "outreach@norixo.example",
  senderCompany: "Norixo",
  senderWebsite: "https://norixo.example",
  subject: "Approved backlink outreach subject",
  body: "Approved backlink outreach body",
};
const splitApprovedContent: ContactFormApprovedContent = {
  ...approvedContent,
  senderName: "Test Sender",
  senderFirstName: "Test",
  senderLastName: "Sender",
};

function control(overrides: Partial<ContactFormDiscoveredControl> = {}): ContactFormDiscoveredControl {
  return {
    ordinal: 0,
    tag: "input",
    type: "text",
    name: null,
    id: null,
    autocomplete: null,
    labelText: null,
    ariaLabel: null,
    ariaLabelledbyText: null,
    placeholder: null,
    required: false,
    disabled: false,
    readOnly: false,
    hidden: false,
    visible: true,
    valuePresent: false,
    ...overrides,
  };
}

function textInput(ordinal: number, labelText: string, overrides: Partial<ContactFormDiscoveredControl> = {}): ContactFormDiscoveredControl {
  const normalized = labelText.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || `field_${ordinal}`;
  return control({ ordinal, tag: "input", type: "text", name: normalized, id: normalized, labelText, ...overrides });
}

function emailInput(ordinal = 1, overrides: Partial<ContactFormDiscoveredControl> = {}): ContactFormDiscoveredControl {
  return control({ ordinal, tag: "input", type: "email", name: "email", id: "email", autocomplete: "email", labelText: "Email", required: true, ...overrides });
}

function urlInput(ordinal: number, labelText: string, overrides: Partial<ContactFormDiscoveredControl> = {}): ContactFormDiscoveredControl {
  return control({ ordinal, tag: "input", type: "url", name: "website", id: "website", labelText, ...overrides });
}

function textarea(ordinal = 3, overrides: Partial<ContactFormDiscoveredControl> = {}): ContactFormDiscoveredControl {
  return control({ ordinal, tag: "textarea", type: "textarea", name: "message", id: "message", labelText: "Message", required: true, ...overrides });
}

function button(ordinal = 99, overrides: Partial<ContactFormDiscoveredControl> = {}): ContactFormDiscoveredControl {
  return control({ ordinal, tag: "button", type: "submit", name: null, id: null, labelText: null, required: false, ...overrides });
}

function selectOption(ordinal: number, labelText: string, overrides: Partial<ContactFormDiscoveredSelectOption> = {}): ContactFormDiscoveredSelectOption {
  return { ordinal, labelText, valuePresent: ordinal > 0, disabled: false, selected: ordinal === 0, ...overrides };
}

function selectControl(ordinal: number, labelText: string, options: readonly ContactFormDiscoveredSelectOption[], overrides: Partial<ContactFormDiscoveredControl> = {}): ContactFormDiscoveredControl {
  const normalized = labelText.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || `select_${ordinal}`;
  return control({ ordinal, tag: "select", type: "select", name: normalized, id: normalized, labelText, required: true, optionsCount: options.length, options, ...overrides });
}

function contactForm(overrides: Partial<ContactFormDiscoveredForm> = {}): ContactFormDiscoveredForm {
  return {
    ordinal: 0,
    action: "/contact",
    method: "post",
    labelText: "Contact us",
    legendText: null,
    buttonText: "Send message",
    controls: [
      textInput(0, "Your name", { autocomplete: "name", required: true }),
      emailInput(1),
      textInput(2, "Subject"),
      textarea(3),
      button(4),
    ],
    ...overrides,
  };
}

function preview(forms: readonly ContactFormDiscoveredForm[], options: { content?: ContactFormApprovedContent; pageSignals?: { hasCaptcha?: boolean; hasLoginWall?: boolean; hasPasswordField?: boolean }; pageTitle?: string } = {}): ContactFormMappingPreview {
  return buildContactFormMappingPreview({
    page: { pageUrl: "https://publisher.example/contact", pageTitle: options.pageTitle ?? "Contact", forms },
    approvedContent: options.content ?? approvedContent,
    pageSignals: options.pageSignals,
  });
}

function expectMapped(result: ContactFormMappingPreview): Map<ContactFormSupportedSemanticField, ContactFormMappingPreview["mappedFields"][number]> {
  assert.equal(result.result, "mapped");
  assert.ok(result.mappingFingerprint);
  return new Map(result.mappedFields.map((field) => [field.semanticField, field]));
}

function expectReason(result: ContactFormMappingPreview, reason: string) {
  assert.ok(result.blockingReasons.includes(reason), `${reason} missing from ${JSON.stringify(result.blockingReasons)}`);
}

function workerSource(): string {
  return readFileSync(join(process.cwd(), "lib/backlinks/services/contactFormNavigationWorker.ts"), "utf8");
}

function mappingSource(): string {
  return readFileSync(join(process.cwd(), "lib/backlinks/services/contactFormMappingPreview.ts"), "utf8");
}

function submissionSource(): string {
  return readFileSync(join(process.cwd(), "lib/backlinks/services/contactFormSubmission.ts"), "utf8");
}

async function expectNavigationUrlRejected(rawUrl: string) {
  const result = await validateContactFormNavigationUrl(rawUrl, async () => [{ address: "93.184.216.34", family: 4 }]);
  assert.equal(result.ok, false, rawUrl);
}

test("T01 simple name/email/subject/message form maps correctly", () => {
  const fields = expectMapped(preview([contactForm()]));
  assert.deepEqual([...fields.keys()], ["sender_name", "sender_email", "subject", "message"]);
  assert.equal(fields.get("sender_name")?.assignmentType, "field_value");
});

test("T02 company + website optional fields map correctly", () => {
  const result = preview([
    contactForm({
      controls: [
        textInput(0, "Your name", { required: true }),
        emailInput(1),
        textInput(2, "Company"),
        urlInput(3, "Website"),
        textInput(4, "Subject"),
        textarea(5),
      ],
    }),
  ]);
  const fields = expectMapped(result);
  assert.equal(fields.has("sender_company"), true);
  assert.equal(fields.has("sender_website"), true);
});

test("T03 label-for mapping", () => {
  const fields = expectMapped(preview([contactForm({ controls: [control({ ordinal: 0, tag: "input", type: "text", name: null, id: "full-name", labelText: "Your name", required: true }), emailInput(1), textarea(2)] })]));
  assert.equal(fields.get("sender_name")?.locator.id, "full-name");
});

test("T04 aria-label mapping", () => {
  const fields = expectMapped(preview([contactForm({ controls: [control({ ordinal: 0, tag: "input", type: "text", ariaLabel: "Your name", required: true }), emailInput(1), textarea(2)] })]));
  assert.equal(fields.get("sender_name")?.locator.controlOrdinal, 0);
});

test("T05 aria-labelledby mapping", () => {
  const fields = expectMapped(preview([contactForm({ controls: [control({ ordinal: 0, tag: "input", type: "text", ariaLabelledbyText: "Your name", required: true }), emailInput(1), textarea(2)] })]));
  assert.equal(fields.get("sender_name")?.semanticField, "sender_name");
});

test("T06 autocomplete mapping", () => {
  const fields = expectMapped(
    preview([
      contactForm({
        controls: [
          control({ ordinal: 0, tag: "input", type: "text", autocomplete: "name", required: true }),
          control({ ordinal: 1, tag: "input", type: "text", autocomplete: "email", required: true }),
          textarea(2),
        ],
      }),
    ]),
  );
  assert.equal(fields.has("sender_name"), true);
  assert.equal(fields.has("sender_email"), true);
});

test("T07 placeholder weak-signal behavior", () => {
  const result = preview([contactForm({ controls: [control({ ordinal: 0, tag: "input", type: "text", placeholder: "Your name", required: true }), control({ ordinal: 1, tag: "input", type: "text", placeholder: "Email", required: true }), textarea(2, { placeholder: "Message" })] })]);
  assert.equal(result.result, "manual_review");
  expectReason(result, "required_unsupported_field");
});

test("T08 input type=email strong signal", () => {
  const fields = expectMapped(preview([contactForm({ controls: [textInput(0, "Your name", { required: true }), control({ ordinal: 1, tag: "input", type: "email", required: true }), textarea(2)] })]));
  assert.equal(fields.get("sender_email")?.controlType, "email");
});

test("T09 textarea message mapping", () => {
  const fields = expectMapped(preview([contactForm()]));
  assert.equal(fields.get("message")?.controlType, "textarea");
});

test("T10 subject mapping", () => {
  const fields = expectMapped(preview([contactForm()]));
  assert.equal(fields.get("subject")?.classification, "SUPPORTED_OPTIONAL");
});

test("T11 hidden fields ignored", () => {
  const result = preview([contactForm({ controls: [control({ ordinal: 0, tag: "input", type: "hidden", name: "csrf", hidden: true, visible: false, required: true, valuePresent: true }), textInput(1, "Your name", { required: true }), emailInput(2), textarea(3)] })]);
  const fields = expectMapped(result);
  assert.equal(fields.has("sender_name"), true);
  assert.equal(result.discoveredFields.find((field) => field.name === "csrf")?.classification, "IGNORED_SAFE");
});

test("T12 disabled fields ignored/block as appropriate", () => {
  const result = preview([contactForm({ controls: [textInput(0, "Your name", { required: true }), emailInput(1, { disabled: true }), textarea(2)] })]);
  assert.equal(result.result, "manual_review");
  expectReason(result, "required_non_writable_control");
});

test("T13 readonly fields not writable candidates", () => {
  const result = preview([contactForm({ controls: [textInput(0, "Your name", { required: true, readOnly: true }), emailInput(1), textarea(2)] })]);
  assert.equal(result.result, "manual_review");
  expectReason(result, "required_non_writable_control");
});

test("T14 duplicate semantic candidates -> ambiguous/manual review", () => {
  const result = preview([contactForm({ controls: [textInput(0, "Your name", { required: true }), emailInput(1), emailInput(2, { name: "alt_email", id: "alt_email" }), textarea(3)] })]);
  assert.equal(result.result, "manual_review");
  expectReason(result, "ambiguous_sender_email");
});

test("T15 same DOM field cannot receive two semantic mappings", () => {
  const result = preview([contactForm()]);
  const ordinals = result.mappedFields.map((field) => field.locator.controlOrdinal);
  assert.equal(new Set(ordinals).size, ordinals.length);
});

test("T16 unsupported required field -> manual review", () => {
  const result = preview([contactForm({ controls: [textInput(0, "Your name", { required: true }), emailInput(1), textarea(2), textInput(3, "Phone number", { required: true })] })]);
  assert.equal(result.result, "manual_review");
  expectReason(result, "required_unsupported_field");
});

test("T17 required checkbox -> blocked/manual review", () => {
  const result = preview([contactForm({ controls: [textInput(0, "Your name", { required: true }), emailInput(1), textarea(2), control({ ordinal: 3, tag: "input", type: "checkbox", labelText: "I agree to the terms", required: true })] })]);
  assert.equal(result.result, "blocked_policy");
  expectReason(result, "required_consent_control");
});

test("T18 required radio -> blocked/manual review", () => {
  const result = preview([contactForm({ controls: [textInput(0, "Your name", { required: true }), emailInput(1), textarea(2), control({ ordinal: 3, tag: "input", type: "radio", labelText: "Contact preference", required: true })] })]);
  assert.equal(result.result, "manual_review");
  expectReason(result, "required_choice_control");
});

test("T19 required subject select with exactly one Other maps deterministic select intent", () => {
  const result = preview([contactForm({ controls: [textInput(0, "Your name", { required: true }), emailInput(1), selectControl(2, "Subject *", [selectOption(0, "Select a topic...", { valuePresent: false, selected: true }), selectOption(1, "Other", { valuePresent: true, selected: false })]), textarea(3)] })]);
  const fields = expectMapped(result);
  const subject = fields.get("subject");
  assert.equal(subject?.controlType, "select");
  assert.equal(subject?.assignmentType, "select_option");
  assert.equal(subject?.selectOption?.normalizedLabel, "other");
  assert.equal(subject?.selectOption?.valuePresent, true);
  assert.equal(result.blockingReasons.includes("required_select_control"), false);
});

test("T19a required subject select with exactly one General Inquiry maps deterministic select intent", () => {
  const result = preview([contactForm({ controls: [textInput(0, "Your name", { required: true }), emailInput(1), selectControl(2, "Topic", [selectOption(0, "Choose one", { valuePresent: false, selected: true }), selectOption(1, "General Inquiry", { valuePresent: true, selected: false })]), textarea(3)] })]);
  const fields = expectMapped(result);
  assert.equal(fields.get("subject")?.selectOption?.normalizedLabel, "general inquiry");
});

test("T19b required select placeholder only remains manual review", () => {
  const result = preview([contactForm({ controls: [textInput(0, "Your name", { required: true }), emailInput(1), selectControl(2, "Subject", [selectOption(0, "Select a topic...", { valuePresent: false, selected: true })]), textarea(3)] })]);
  assert.equal(result.result, "manual_review");
  expectReason(result, "required_select_no_safe_option");
});

test("T19c required select without safe generic option remains manual review", () => {
  const result = preview([contactForm({ controls: [textInput(0, "Your name", { required: true }), emailInput(1), selectControl(2, "Subject", [selectOption(0, "Select a topic...", { valuePresent: false, selected: true }), selectOption(1, "Membership question", { valuePresent: true, selected: false }), selectOption(2, "Compliance / regulatory question", { valuePresent: true, selected: false })]), textarea(3)] })]);
  assert.equal(result.result, "manual_review");
  expectReason(result, "required_select_no_safe_option");
});

test("T19d disabled Other remains manual review", () => {
  const result = preview([contactForm({ controls: [textInput(0, "Your name", { required: true }), emailInput(1), selectControl(2, "Subject", [selectOption(0, "Select a topic...", { valuePresent: false, selected: true }), selectOption(1, "Other", { valuePresent: true, disabled: true, selected: false })]), textarea(3)] })]);
  assert.equal(result.result, "manual_review");
  expectReason(result, "required_select_no_safe_option");
});

test("T19e multiple safe generic select options remain manual review", () => {
  const result = preview([contactForm({ controls: [textInput(0, "Your name", { required: true }), emailInput(1), selectControl(2, "Subject", [selectOption(0, "Select a topic...", { valuePresent: false, selected: true }), selectOption(1, "Other", { valuePresent: true, selected: false }), selectOption(2, "General Inquiry", { valuePresent: true, selected: false })]), textarea(3)] })]);
  assert.equal(result.result, "manual_review");
  expectReason(result, "required_select_ambiguous_safe_option");
});

test("T19f partnership and sponsorship are not automatically selected", () => {
  const result = preview([contactForm({ controls: [textInput(0, "Your name", { required: true }), emailInput(1), selectControl(2, "Subject", [selectOption(0, "Select a topic...", { valuePresent: false, selected: true }), selectOption(1, "Partnership or sponsorship", { valuePresent: true, selected: false })]), textarea(3)] })]);
  assert.equal(result.result, "manual_review");
  expectReason(result, "required_select_no_safe_option");
});

test("T19g media is not automatically selected", () => {
  const result = preview([contactForm({ controls: [textInput(0, "Your name", { required: true }), emailInput(1), selectControl(2, "Subject", [selectOption(0, "Select a topic...", { valuePresent: false, selected: true }), selectOption(1, "Media inquiry", { valuePresent: true, selected: false })]), textarea(3)] })]);
  assert.equal(result.result, "manual_review");
  expectReason(result, "required_select_no_safe_option");
});

test("T19h select metadata is bounded and contains safe option fingerprints only", () => {
  const longLabel = `General Inquiry ${"very ".repeat(40)}`;
  const options = Array.from({ length: 60 }, (_, index) => selectOption(index, index === 1 ? longLabel : `Topic ${index}`, { valuePresent: index > 0, selected: index === 0 }));
  const result = preview([contactForm({ controls: [textInput(0, "Your name", { required: true }), emailInput(1), selectControl(2, "Subject", options), textarea(3)] })]);
  const selectField = result.discoveredFields.find((field) => field.controlOrdinal === 2);
  const metadata = JSON.stringify(contactFormMappingPreviewToSafeMetadata(result));
  assert.equal(selectField?.selectOptions?.length, 50);
  assert.equal(selectField?.selectOptions?.[1]?.labelText.length, 80);
  assert.ok(selectField?.selectOptions?.every((option) => option.optionFingerprint.startsWith("sha256:")));
  assert.doesNotMatch(metadata, /<option|<\/option>|value="/i);
});

test("T19i Host Alaska shape loses select blocker but remains manual review for split sender name", () => {
  const result = preview([
    contactForm({
      controls: [
        textInput(0, "First Name", { required: true, autocomplete: "given-name" }),
        textInput(1, "Last Name", { required: true, autocomplete: "family-name" }),
        emailInput(2),
        selectControl(3, "Subject *", [
          selectOption(0, "Select a topic...", { valuePresent: false, selected: true }),
          selectOption(1, "Membership question", { valuePresent: true, selected: false }),
          selectOption(2, "I want to join", { valuePresent: true, selected: false }),
          selectOption(3, "Compliance / regulatory question", { valuePresent: true, selected: false }),
          selectOption(4, "Interested in Steering Committee", { valuePresent: true, selected: false }),
          selectOption(5, "Media inquiry", { valuePresent: true, selected: false }),
          selectOption(6, "Report a regulatory change", { valuePresent: true, selected: false }),
          selectOption(7, "Partnership or sponsorship", { valuePresent: true, selected: false }),
          selectOption(8, "Other", { valuePresent: true, selected: false }),
        ]),
        textarea(4),
      ],
    }),
  ]);
  assert.equal(result.result, "manual_review");
  assert.equal(result.blockingReasons.includes("required_select_control"), false);
  expectReason(result, "required_split_sender_name");
});

test("T19j required First Name plus Last Name with only unsplit sender_name remains manual review", () => {
  const result = preview([contactForm({ controls: [textInput(0, "First Name", { required: true, autocomplete: "given-name" }), textInput(1, "Last Name", { required: true, autocomplete: "family-name" }), emailInput(2), textarea(3)] })]);
  const metadata = JSON.stringify(contactFormMappingPreviewToSafeMetadata(result));
  assert.equal(result.result, "manual_review");
  expectReason(result, "required_split_sender_name");
  assert.equal(result.mappedFields.some((field) => field.semanticField === "sender_name"), false);
  assert.doesNotMatch(metadata, /Norixo Operator/);
});

test("T19k Host Alaska shape maps with explicit approved split identity", () => {
  const result = preview(
    [
      contactForm({
        controls: [
          textInput(0, "First Name", { required: true, autocomplete: "given-name" }),
          textInput(1, "Last Name", { required: true, autocomplete: "family-name" }),
          emailInput(2),
          selectControl(3, "Subject *", [
            selectOption(0, "Select a topic...", { valuePresent: false, selected: true }),
            selectOption(1, "Membership question", { valuePresent: true, selected: false }),
            selectOption(2, "I want to join", { valuePresent: true, selected: false }),
            selectOption(3, "Compliance / regulatory question", { valuePresent: true, selected: false }),
            selectOption(4, "Interested in Steering Committee", { valuePresent: true, selected: false }),
            selectOption(5, "Media inquiry", { valuePresent: true, selected: false }),
            selectOption(6, "Report a regulatory change", { valuePresent: true, selected: false }),
            selectOption(7, "Partnership or sponsorship", { valuePresent: true, selected: false }),
            selectOption(8, "Other", { valuePresent: true, selected: false }),
          ]),
          textarea(4),
        ],
      }),
    ],
    { content: splitApprovedContent },
  );
  const fields = expectMapped(result);
  assert.equal(fields.get("sender_first_name")?.locator.controlOrdinal, 0);
  assert.equal(fields.get("sender_last_name")?.locator.controlOrdinal, 1);
  assert.equal(fields.get("subject")?.assignmentType, "select_option");
  assert.equal(fields.get("subject")?.selectOption?.normalizedLabel, "other");
  assert.equal(fields.get("message")?.locator.controlOrdinal, 4);
  assert.equal(fields.has("sender_name"), false);
  assert.equal(result.blockingReasons.includes("required_split_sender_name"), false);
});

test("T19l full-name field still uses sender_name even when split identity exists", () => {
  const fields = expectMapped(preview([contactForm()], { content: splitApprovedContent }));
  assert.equal(fields.get("sender_name")?.locator.controlOrdinal, 0);
  assert.equal(fields.has("sender_first_name"), false);
  assert.equal(fields.has("sender_last_name"), false);
});

test("T19m required first-only field needs explicit sender_first_name", () => {
  const result = preview([contactForm({ controls: [textInput(0, "First Name", { required: true, autocomplete: "given-name" }), emailInput(1), textarea(2)] })]);
  assert.equal(result.result, "manual_review");
  expectReason(result, "missing_sender_first_name");
});

test("T19n required first-only field maps only sender_first_name when present", () => {
  const fields = expectMapped(preview([contactForm({ controls: [textInput(0, "First Name", { required: true, autocomplete: "given-name" }), emailInput(1), textarea(2)] })], { content: { ...approvedContent, senderFirstName: "Test" } }));
  assert.equal(fields.get("sender_first_name")?.locator.controlOrdinal, 0);
  assert.equal(fields.has("sender_name"), false);
});

test("T19o required last-only field needs explicit sender_last_name", () => {
  const result = preview([contactForm({ controls: [textInput(0, "Last Name", { required: true, autocomplete: "family-name" }), emailInput(1), textarea(2)] })]);
  assert.equal(result.result, "manual_review");
  expectReason(result, "missing_sender_last_name");
});

test("T19p required last-only field maps only sender_last_name when present", () => {
  const fields = expectMapped(preview([contactForm({ controls: [textInput(0, "Last Name", { required: true, autocomplete: "family-name" }), emailInput(1), textarea(2)] })], { content: { ...approvedContent, senderLastName: "Sender" } }));
  assert.equal(fields.get("sender_last_name")?.locator.controlOrdinal, 0);
  assert.equal(fields.has("sender_name"), false);
});

test("T19q split-name mapping does not parse or derive from sender_name", () => {
  const result = preview([contactForm({ controls: [textInput(0, "First Name", { required: true, autocomplete: "given-name" }), textInput(1, "Last Name", { required: true, autocomplete: "family-name" }), emailInput(2), textarea(3)] })], { content: { ...approvedContent, senderName: "Test Sender" } });
  assert.equal(result.result, "manual_review");
  expectReason(result, "required_split_sender_name");
});

test("T19r required Full Name plus First Name maps both approved identity sources", () => {
  const fields = expectMapped(preview([contactForm({ controls: [textInput(0, "Full Name", { required: true, autocomplete: "name" }), textInput(1, "First Name", { required: true, autocomplete: "given-name" }), emailInput(2), textarea(3)] })], { content: { ...approvedContent, senderFirstName: "Test" } }));
  assert.equal(fields.get("sender_name")?.locator.controlOrdinal, 0);
  assert.equal(fields.get("sender_first_name")?.locator.controlOrdinal, 1);
});

test("T19s required Full Name plus Last Name maps both approved identity sources", () => {
  const fields = expectMapped(preview([contactForm({ controls: [textInput(0, "Full Name", { required: true, autocomplete: "name" }), textInput(1, "Last Name", { required: true, autocomplete: "family-name" }), emailInput(2), textarea(3)] })], { content: { ...approvedContent, senderLastName: "Sender" } }));
  assert.equal(fields.get("sender_name")?.locator.controlOrdinal, 0);
  assert.equal(fields.get("sender_last_name")?.locator.controlOrdinal, 1);
});

test("T19t required Full Name plus First Name plus Last Name maps all approved identity sources", () => {
  const fields = expectMapped(preview([contactForm({ controls: [textInput(0, "Full Name", { required: true, autocomplete: "name" }), textInput(1, "First Name", { required: true, autocomplete: "given-name" }), textInput(2, "Last Name", { required: true, autocomplete: "family-name" }), emailInput(3), textarea(4)] })], { content: splitApprovedContent }));
  assert.equal(fields.get("sender_name")?.locator.controlOrdinal, 0);
  assert.equal(fields.get("sender_first_name")?.locator.controlOrdinal, 1);
  assert.equal(fields.get("sender_last_name")?.locator.controlOrdinal, 2);
});

test("T19u required Full Name plus First Name blocks when explicit first name is missing", () => {
  const result = preview([contactForm({ controls: [textInput(0, "Full Name", { required: true, autocomplete: "name" }), textInput(1, "First Name", { required: true, autocomplete: "given-name" }), emailInput(2), textarea(3)] })]);
  assert.equal(result.result, "manual_review");
  expectReason(result, "missing_sender_first_name");
});

test("T19v required Full Name plus Last Name blocks when explicit last name is missing", () => {
  const result = preview([contactForm({ controls: [textInput(0, "Full Name", { required: true, autocomplete: "name" }), textInput(1, "Last Name", { required: true, autocomplete: "family-name" }), emailInput(2), textarea(3)] })]);
  assert.equal(result.result, "manual_review");
  expectReason(result, "missing_sender_last_name");
});

test("T19w duplicate required Full Name controls fail closed", () => {
  const result = preview([contactForm({ controls: [textInput(0, "Full Name", { required: true, autocomplete: "name" }), textInput(1, "Your Name", { required: true, autocomplete: "name" }), emailInput(2), textarea(3)] })]);
  assert.equal(result.result, "manual_review");
  expectReason(result, "ambiguous_sender_name");
});

test("T19x duplicate required First Name controls fail closed", () => {
  const result = preview([contactForm({ controls: [textInput(0, "First Name", { required: true, autocomplete: "given-name" }), textInput(1, "Given Name", { required: true, autocomplete: "given-name" }), emailInput(2), textarea(3)] })], { content: { ...approvedContent, senderFirstName: "Test" } });
  assert.equal(result.result, "manual_review");
  expectReason(result, "ambiguous_sender_first_name");
});

test("T19y duplicate required Last Name controls fail closed", () => {
  const result = preview([contactForm({ controls: [textInput(0, "Last Name", { required: true, autocomplete: "family-name" }), textInput(1, "Surname", { required: true, autocomplete: "family-name" }), emailInput(2), textarea(3)] })], { content: { ...approvedContent, senderLastName: "Sender" } });
  assert.equal(result.result, "manual_review");
  expectReason(result, "ambiguous_sender_last_name");
});

test("T19z required Full Name only keeps legacy sender_name behavior", () => {
  const fields = expectMapped(preview([contactForm({ controls: [textInput(0, "Full Name", { required: true, autocomplete: "name" }), emailInput(1), textarea(2)] })]));
  assert.equal(fields.get("sender_name")?.locator.controlOrdinal, 0);
  assert.equal(fields.has("sender_first_name"), false);
  assert.equal(fields.has("sender_last_name"), false);
});

for (const [caseName, nameControl] of [
  ["First Name label", textInput(0, "First Name", { required: true })],
  ["first_name name/id", control({ ordinal: 0, tag: "input", type: "text", name: "first_name", id: "first_name", labelText: "Contact field", required: true })],
  ["firstname name/id", control({ ordinal: 0, tag: "input", type: "text", name: "firstname", id: "firstname", labelText: "Contact field", required: true })],
  ["Given Name label", textInput(0, "Given Name", { required: true })],
  ["autocomplete given-name", textInput(0, "Contact field", { required: true, autocomplete: "given-name" })],
] as const) {
  test(`T19aa positive first-name classification: ${caseName}`, () => {
    const fields = expectMapped(preview([contactForm({ controls: [nameControl, emailInput(1), textarea(2)] })], { content: { ...approvedContent, senderFirstName: "Test" } }));
    assert.equal(fields.get("sender_first_name")?.locator.controlOrdinal, 0);
    assert.equal(fields.has("sender_name"), false);
  });
}

for (const [caseName, nameControl] of [
  ["Last Name label", textInput(0, "Last Name", { required: true })],
  ["last_name name/id", control({ ordinal: 0, tag: "input", type: "text", name: "last_name", id: "last_name", labelText: "Contact field", required: true })],
  ["lastname name/id", control({ ordinal: 0, tag: "input", type: "text", name: "lastname", id: "lastname", labelText: "Contact field", required: true })],
  ["Family Name label", textInput(0, "Family Name", { required: true })],
  ["Surname label", textInput(0, "Surname", { required: true })],
  ["autocomplete family-name", textInput(0, "Contact field", { required: true, autocomplete: "family-name" })],
] as const) {
  test(`T19ab positive last-name classification: ${caseName}`, () => {
    const fields = expectMapped(preview([contactForm({ controls: [nameControl, emailInput(1), textarea(2)] })], { content: { ...approvedContent, senderLastName: "Sender" } }));
    assert.equal(fields.get("sender_last_name")?.locator.controlOrdinal, 0);
    assert.equal(fields.has("sender_name"), false);
  });
}

for (const label of ["First", "First choice", "First option", "First preference", "First visit", "First available", "First response", "First contact", "First booking"]) {
  test(`T19ac negative first-name false positive rejected: ${label}`, () => {
    const result = preview([contactForm({ controls: [textInput(0, label, { required: true }), emailInput(1), textarea(2)] })], { content: { ...approvedContent, senderFirstName: "Test" } });
    assert.equal(result.result, "manual_review");
    assert.equal(result.mappedFields.some((field) => field.semanticField === "sender_first_name"), false);
    assert.ok(result.blockingReasons.length > 0);
  });
}

for (const label of ["Last", "Last updated", "Last booking", "Last visit", "Last response", "Last contact", "Last available", "Last option"]) {
  test(`T19ad negative last-name false positive rejected: ${label}`, () => {
    const result = preview([contactForm({ controls: [textInput(0, label, { required: true }), emailInput(1), textarea(2)] })], { content: { ...approvedContent, senderLastName: "Sender" } });
    assert.equal(result.result, "manual_review");
    assert.equal(result.mappedFields.some((field) => field.semanticField === "sender_last_name"), false);
    assert.ok(result.blockingReasons.length > 0);
  });
}

test("T19ae name inside another word does not classify as full name", () => {
  const result = preview([contactForm({ controls: [textInput(0, "Username", { required: true, autocomplete: null }), emailInput(1), textarea(2)] })]);
  assert.equal(result.result, "manual_review");
  assert.equal(result.mappedFields.some((field) => field.semanticField === "sender_name"), false);
  expectReason(result, "required_unsupported_field");
});

test("T20 file upload -> manual review", () => {
  const result = preview([contactForm({ controls: [textInput(0, "Your name", { required: true }), emailInput(1), textarea(2), control({ ordinal: 3, tag: "input", type: "file", labelText: "Attachment" })] })]);
  assert.equal(result.result, "manual_review");
  expectReason(result, "file_upload_control");
});

test("T21 password/login form rejected", () => {
  const result = preview([contactForm({ labelText: "Login to contact support", controls: [emailInput(0), control({ ordinal: 1, tag: "input", type: "password", labelText: "Password", required: true })] })]);
  assert.equal(result.result, "manual_review");
  expectReason(result, "login_form_detected");
});

test("T22 registration form rejected", () => {
  const result = preview([contactForm({ labelText: "Create account", buttonText: "Register", controls: [textInput(0, "Your name", { required: true }), emailInput(1), textarea(2)] })]);
  assert.equal(result.result, "manual_review");
  expectReason(result, "registration_form_detected");
});

test("T23 newsletter-only form rejected", () => {
  const result = preview([contactForm({ labelText: "Newsletter signup", buttonText: "Subscribe", controls: [emailInput(0)] })]);
  assert.equal(result.result, "manual_review");
  expectReason(result, "newsletter_only_form_detected");
});

test("T24 checkout/payment form rejected", () => {
  const result = preview([contactForm({ labelText: "Checkout payment", controls: [textInput(0, "Card number", { required: true }), emailInput(1), textarea(2)] })]);
  assert.equal(result.result, "manual_review");
  expectReason(result, "checkout_form_detected");
});

test("T25 booking form rejected", () => {
  const result = preview([contactForm({ labelText: "Reservation request", controls: [textInput(0, "Your name", { required: true }), emailInput(1), textarea(2)] })]);
  assert.equal(result.result, "manual_review");
  expectReason(result, "booking_form_detected");
});

test("T26 job application form rejected", () => {
  const result = preview([contactForm({ labelText: "Career application", controls: [textInput(0, "Your name", { required: true }), emailInput(1), textarea(2, { labelText: "Cover letter" })] })]);
  assert.equal(result.result, "manual_review");
  expectReason(result, "job_application_form_detected");
});

test("T27 zero forms", () => {
  const result = preview([]);
  assert.equal(result.result, "manual_review");
  expectReason(result, "no_candidate_form");
});

test("T28 multiple plausible forms -> ambiguous", () => {
  const result = preview([contactForm({ ordinal: 0 }), contactForm({ ordinal: 1, action: "/contact-two" })]);
  assert.equal(result.result, "manual_review");
  expectReason(result, "multiple_plausible_contact_forms");
});

test("T29 one contact form among unrelated forms selected", () => {
  const result = preview([contactForm({ ordinal: 0, labelText: "Newsletter signup", buttonText: "Subscribe", controls: [emailInput(0)] }), contactForm({ ordinal: 1, action: "/contact-editorial" })]);
  assert.equal(result.result, "mapped");
  assert.equal(result.selectedFormOrdinal, 1);
});

test("T30 reCAPTCHA detected", () => {
  const result = preview([contactForm({ labelText: "Contact us reCAPTCHA" })]);
  assert.equal(result.result, "blocked_captcha");
});

test("T31 hCaptcha detected", () => {
  const result = preview([contactForm({ labelText: "Contact us hCaptcha" })]);
  assert.equal(result.result, "blocked_captcha");
});

test("T32 Turnstile detected", () => {
  const result = preview([contactForm({ controls: [...contactForm().controls, control({ ordinal: 5, tag: "input", type: "hidden", name: "cf-turnstile-response", hidden: true, visible: false })] })]);
  assert.equal(result.result, "blocked_captcha");
});

test("T33 generic CAPTCHA detected", () => {
  const result = preview([contactForm({ legendText: "Verify you are human before contacting us" })]);
  assert.equal(result.result, "blocked_captcha");
});

test("T34 login/auth wall detected", () => {
  const result = preview([contactForm()], { pageSignals: { hasLoginWall: true, hasPasswordField: true } });
  assert.equal(result.result, "manual_review");
  expectReason(result, "login_wall_detected");
});

test("T35 required terms consent detected", () => {
  const result = preview([contactForm({ controls: [...contactForm().controls, control({ ordinal: 5, tag: "input", type: "checkbox", labelText: "I accept the privacy policy", required: true })] })]);
  assert.equal(result.result, "blocked_policy");
});

test("T36 optional newsletter checkbox not automatically mapped", () => {
  const result = preview([contactForm({ controls: [...contactForm().controls, control({ ordinal: 5, tag: "input", type: "checkbox", labelText: "Subscribe to newsletter" })] })]);
  const fields = expectMapped(result);
  assert.equal(fields.size, result.mappedFields.length);
  assert.equal(result.discoveredFields.find((field) => field.controlOrdinal === 5)?.classification, "IGNORED_SAFE");
});

test("T37 passive privacy text does not falsely imply consent", () => {
  const result = preview([contactForm({ labelText: "Contact us. We respect your privacy." })]);
  assert.equal(result.result, "mapped");
});

test("T38 GET form metadata handled", () => {
  const result = preview([contactForm({ method: "get" })]);
  assert.equal(result.result, "mapped");
  assert.equal(result.formMethod, "GET");
});

test("T39 POST form metadata may be inspected but no POST emitted", () => {
  const result = preview([contactForm({ method: "post" })]);
  assert.equal(result.result, "mapped");
  assert.equal(result.formMethod, "POST");
});

test("T40 external form action metadata handled safely without navigation", () => {
  const result = preview([contactForm({ action: "https://forms.partner.example/contact?tracking=1" })]);
  assert.equal(result.result, "mapped");
  assert.equal(result.formActionOrigin, "https://forms.partner.example");
  assert.equal(result.formActionPath, "/contact");
});

test("T41 form fingerprint deterministic", () => {
  const first = preview([contactForm()]);
  const second = preview([contactForm()]);
  assert.equal(first.mappingFingerprint, second.mappingFingerprint);
});

test("T42 fingerprint changes on structural field drift", () => {
  const first = preview([contactForm()]);
  const second = preview([contactForm({ controls: [textInput(0, "Your name", { required: true }), emailInput(1), textInput(2, "Subject", { required: true }), textarea(3)] })]);
  assert.notEqual(first.mappingFingerprint, second.mappingFingerprint);
});

test("T43 fingerprint stable against irrelevant cosmetic DOM changes", () => {
  const first = preview([contactForm({ buttonText: "Send message" })], { pageTitle: "Contact" });
  const second = preview([contactForm({ buttonText: "Submit now" })], { pageTitle: "Contact our team" });
  assert.equal(first.mappingFingerprint, second.mappingFingerprint);
});

test("T44 mapping preview does not contain raw secret data", () => {
  const metadata = JSON.stringify(
    contactFormMappingPreviewToSafeMetadata(
      preview([contactForm()], {
        content: { ...approvedContent, senderEmail: "private-person@example.invalid", body: "SECRET APPROVED BODY TOKEN" },
      }),
    ),
  );
  assert.doesNotMatch(metadata, /private-person@example\.invalid|SECRET APPROVED BODY TOKEN|Approved backlink outreach body/);
});

test("T45 full HTML not persisted", () => {
  const metadata = JSON.stringify(contactFormMappingPreviewToSafeMetadata(preview([contactForm()])));
  assert.match(metadata, /"full_html_persisted":false/);
  assert.doesNotMatch(metadata, /<html|<\/form>|<input/i);
});

test("T46 bounded evidence truncation", () => {
  const longLabel = `Your name ${"very ".repeat(40)}`;
  const result = preview([contactForm({ controls: [textInput(0, longLabel, { required: true }), emailInput(1), textarea(2)] })]);
  assert.equal(result.discoveredFields.find((field) => field.controlOrdinal === 0)?.labelText?.length, 80);
});

test("T47 mapped state reachable after safe mapping", () => {
  const source = workerSource();
  assert.match(source, /nextState:\s*"mapped"/);
  assert.match(source, /form_mapping_previewed/);
});

test("T48 C4 mapping preview remains independent from filled state", () => {
  assert.doesNotMatch(mappingSource(), /nextState:\s*"filled"/);
});

test("T49 C4 mapping preview remains independent from pre_submit_validated state", () => {
  assert.doesNotMatch(mappingSource(), /nextState:\s*"pre_submit_validated"/);
});

test("T50 C4 mapping preview remains independent from submitting state", () => {
  assert.doesNotMatch(mappingSource(), /nextState:\s*"submitting"/);
});

test("T51 C4 mapping preview remains independent from submission_confirmed state", () => {
  assert.doesNotMatch(mappingSource(), /nextState:\s*"submission_confirmed"/);
});

test("T52 accepted initial creation remains delegated outside C4 mapping preview", () => {
  assert.doesNotMatch(mappingSource(), /backlink_outreach_attempts|accepted_initial|submission_confirmed/);
});

test("T53 no outreach activation", () => {
  assert.doesNotMatch(workerSource(), /status\s*=\s*["']active|current_attempt\s*=\s*1|activate/i);
});

test("T54 C4 mapping preview does not fill/type/select/check", () => {
  assert.doesNotMatch(mappingSource(), /\.(?:fill|type|selectOption|check|uncheck|setInputFiles)\(/);
});

test("T55 C4 mapping preview does not click submit", () => {
  assert.doesNotMatch(mappingSource(), /\.click\(/);
});

test("T56 no form.submit/requestSubmit", () => {
  assert.doesNotMatch(`${workerSource()}\n${mappingSource()}`, /requestSubmit|form\.submit\(/);
});

test("T57 no synthetic input/change/submit events", () => {
  assert.doesNotMatch(`${workerSource()}\n${mappingSource()}`, /dispatchEvent|InputEvent|SubmitEvent|ChangeEvent/);
});

test("T58 C3 POST/PUT/PATCH/DELETE browser request guards remain active", () => {
  const source = workerSource();
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) assert.match(source, new RegExp(`"${method}"`));
  assert.match(source, /CONTACT_FORM_TARGET_MUTATION_BLOCKED/);
});

test("T59 C3 SSRF/DNS/redirect protections regressions PASS", async () => {
  await expectNavigationUrlRejected("http://publisher.example/contact");
  await expectNavigationUrlRejected("https://user:pass@publisher.example/contact");
  await expectNavigationUrlRejected("https://127.0.0.1/contact");
  const mixed = await validateContactFormNavigationUrl("https://publisher.example/contact", async () => [
    { address: "93.184.216.34", family: 4 },
    { address: "10.0.0.1", family: 4 },
  ]);
  assert.equal(mixed.ok, false);
});

test("T60 lease loss during discovery/mapping fails closed", () => {
  const source = workerSource();
  assert.match(source, /await keepLease\(\);\n\s*const mapping = buildContactFormMappingPreview/);
  assert.match(source, /kind:\s*"lease_lost"/);
});

test("T61 stale approval before mapping fails closed", () => {
  const source = workerSource();
  assert.ok(source.indexOf("const revalidation = revalidateContactFormExecutionContext(context)") < source.indexOf("const mapping = buildContactFormMappingPreview"));
  assert.match(submissionSource(), /CONTACT_FORM_APPROVAL_STALE/);
});

test("T62 DNC before mapping fails closed", () => {
  const source = workerSource();
  assert.ok(source.indexOf("const revalidation = revalidateContactFormExecutionContext(context)") < source.indexOf("const mapping = buildContactFormMappingPreview"));
  assert.match(submissionSource(), /CONTACT_FORM_CONTACT_SUPPRESSED/);
});

test("T63 deterministic repeated fixture result", () => {
  assert.deepEqual(preview([contactForm()]), preview([contactForm()]));
});

test("T64 browser context cleanup", () => {
  const source = workerSource();
  assert.match(source, /finally/);
  assert.match(source, /await session\.close\(\)/);
});

test("T65 no external network target in test suite", () => {
  const urls = readFileSync(join(process.cwd(), "scripts/contact-form-mapping-preview.test.ts"), "utf8").match(/https:\/\/[^\s"',)]+/g) ?? [];
  assert.deepEqual(
    urls.filter((url) => !url.includes(".example") && !url.includes("127.0.0.1")),
    [],
  );
});

test("supported semantic field allowlist includes explicit split identity only", () => {
  assert.deepEqual([...CONTACT_FORM_SUPPORTED_SEMANTIC_FIELDS], ["sender_name", "sender_first_name", "sender_last_name", "sender_email", "sender_company", "sender_website", "subject", "message"]);
});

test("supported writable control type allowlist is text/email/url/textarea only", () => {
  assert.deepEqual([...CONTACT_FORM_SUPPORTED_CONTROL_TYPES], ["text", "email", "url", "textarea"]);
});

test("mapping implementation does not use LLM or external AI calls", () => {
  assert.doesNotMatch(mappingSource(), /openai|anthropic|llm|chat\.completions|responses\.create|fetch\(/i);
});

async function main() {
  let passed = 0;
  for (const current of tests) {
    await current.run();
    passed += 1;
  }
  console.log(`contact-form mapping preview tests passed: ${passed}/${tests.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
