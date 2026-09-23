import assert from "node:assert/strict";

import { buildContactValidationTask, buildContactValidationTasksForResolution } from "../lib/automation/backlink-autonomy-foundation";
import { executeBacklinkContactValidationTask } from "../lib/automation/backlink-contact-validation-task-handler";
import { isActionableLinkedInProfileUrl, validateBacklinkContact } from "../lib/backlinks/services/contactValidationService";

const domain = "example.com";
const evidence = (kind: string, value: string) => JSON.stringify([{ kind, value, sourceUrl: "https://example.com/contact", confidence: kind === "mailto" ? "strong" : "medium" }]);
const base = { domainHostname: domain, contactStatus: "unverified", email: null, contactFormUrl: null, linkedinUrl: null, sourceReference: null };

function dependencies(contact: Record<string, unknown>) {
  return {
    getDomain: async () => ({ id: "domain", workspace_id: "workspace", hostname: domain, archived_at: null }),
    getOpportunity: async () => ({ id: "opportunity", workspace_id: "workspace", domain_id: "domain", archived_at: null }),
    getContact: async () => ({ id: "contact", workspace_id: "workspace", domain_id: "domain", contact_status: "unverified", email_normalized: null, contact_form_url: null, linkedin_url: null, source_reference: null, ...contact }),
    getContactFormSafety: async () => ({ ambiguous: false, captchaOrManualReview: false }),
    hasMxRecords: async () => true,
  };
}

async function main() {
  assert.equal(validateBacklinkContact({ ...base, email: "bad email", sourceReference: evidence("mailto", "bad email") }).email, "invalid");
  assert.equal(validateBacklinkContact({ ...base, email: "guessed@example.com", sourceReference: null }).email, "unverified");
  assert.equal(validateBacklinkContact({ ...base, email: "editor@third-party.test", sourceReference: evidence("mailto", "editor@third-party.test") }).email, "invalid");
  for (const kind of ["mailto", "visible_email"] as const) {
    const result = validateBacklinkContact({ ...base, email: "editor@example.com", sourceReference: evidence(kind, "editor@example.com"), hasMxRecords: true });
    assert.equal(result.email, "unverified"); // Explicit evidence and MX cannot establish a mailbox.
  }
  assert.equal(validateBacklinkContact({ ...base, email: "editor@example.com", sourceReference: null }).email, "unverified");
  assert.equal(validateBacklinkContact({ ...base, contactStatus: "verified", email: "editor@example.com" }).overall, "verified");
  assert.equal(validateBacklinkContact({ ...base, contactStatus: "do_not_contact" }).overall, "manual_review");
  assert.equal(validateBacklinkContact({ ...base, contactStatus: "archived" }).overall, "manual_review");
  assert.equal(validateBacklinkContact({ ...base, contactStatus: "unknown" }).overall, "manual_review");

  const form = "https://example.com/contact";
  assert.equal(validateBacklinkContact({ ...base, contactFormUrl: form, sourceReference: evidence("contact_form", form) }).contactForm, "unverified");
  assert.equal(validateBacklinkContact({ ...base, contactFormUrl: form, sourceReference: evidence("contact_form", form), contactFormAmbiguous: true }).contactForm, "manual_review");
  assert.equal(validateBacklinkContact({ ...base, contactFormUrl: "https://elsewhere.test/contact", sourceReference: evidence("contact_form", "https://elsewhere.test/contact") }).contactForm, "invalid");
  assert.equal(validateBacklinkContact({ ...base, contactFormUrl: form, sourceReference: evidence("contact_form", form), contactFormCaptchaOrManualReview: true }).contactForm, "manual_review");
  const linkedin = "https://www.linkedin.com/company/example/";
  assert.equal(validateBacklinkContact({ ...base, linkedinUrl: linkedin, sourceReference: evidence("linkedin", linkedin) }).linkedin, "manual_action_required");
  assert.equal(validateBacklinkContact({ ...base, linkedinUrl: "https://example.com/in/example", sourceReference: evidence("linkedin", "https://example.com/in/example") }).linkedin, "invalid");
  for (const value of ["https://linkedin.com/in/editor", "https://www.linkedin.com/in/editor/", "https://linkedin.com/in/editor?trk=public_profile"]) {
    assert.equal(isActionableLinkedInProfileUrl(value), true, `Expected actionable LinkedIn profile: ${value}`);
  }
  for (const value of [linkedin, "http://linkedin.com/in/editor", "https://sub.linkedin.com/in/editor", "https://linkedin.com/in/", "https://linkedin.com/in/editor#about", " https://linkedin.com/in/editor", "https://example.com/in/editor", "not a url"]) {
    assert.equal(isActionableLinkedInProfileUrl(value), false, `Expected non-actionable LinkedIn value: ${value}`);
  }

  const descriptor = buildContactValidationTask({ workspaceId: "workspace", runId: "run", dependsOnTaskId: "resolution", domainId: "domain", opportunityId: "opportunity", contactId: "contact", scheduledAt: "2026-09-21T00:00:00.000Z" });
  assert.equal(descriptor.taskKind, "backlinks.contact_validation");
  assert.equal(descriptor.taskKey, "contact-validation:opportunity:contact");
  assert.equal(descriptor.dependsOnTaskId, "resolution");
  const handoff = buildContactValidationTasksForResolution({ workspaceId: "workspace", runId: "run", resolutionTaskId: "resolution", domainId: "domain", opportunityId: "opportunity", contactIds: ["contact", "contact"], scheduledAt: "2026-09-21T00:00:00.000Z" });
  assert.equal(handoff.length, 1);

  const input = { workspaceId: "workspace", domainId: "domain", opportunityId: "opportunity", contactId: "contact" };
  const assessed = await executeBacklinkContactValidationTask(dependencies({ email_normalized: "editor@example.com", source_reference: evidence("mailto", "editor@example.com") }), input);
  assert.equal(assessed.status, "unverified");
  assert.equal(assessed.statusTransition, "none");
  assert(!JSON.stringify(assessed).includes("<html"));
  const preserved = await executeBacklinkContactValidationTask(dependencies({ contact_status: "verified", email_normalized: "editor@example.com" }), input);
  assert.equal(preserved.statusTransition, "preserved");
  const mismatchDeps = dependencies({});
  mismatchDeps.getContact = async () => ({ id: "contact", workspace_id: "workspace", domain_id: "other-domain", contact_status: "unverified", email_normalized: null, contact_form_url: null, linkedin_url: null, source_reference: null });
  assert.equal((await executeBacklinkContactValidationTask(mismatchDeps, input)).status, "blocked");
  console.log("PASS — Backlink contact validation task smoke");
}

void main();
