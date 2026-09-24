import assert from "node:assert/strict";
import { buildContactResolutionTask } from "../lib/automation/backlink-autonomy-foundation";
import { buildEvidenceBackedContactInput, persistEvidenceBackedResolvedContact, resolveBacklinkContacts } from "../lib/backlinks/services/contactResolutionService";
import { evaluateAutonomousOutreachPolicy } from "../lib/backlinks/services/autonomousOutreachPolicy";

const home = "https://example.com/";
const pages: Record<string, string> = {
  home: '<a href="mailto:Editor@Example.com">Email</a><a href="/contact">Contact</a><a href="https://www.linkedin.com/company/example/">LinkedIn</a>',
  contact: '<p>news@example.com</p><form action="/send"></form>',
};
async function fetchPage(url: string) {
  const key = new URL(url).pathname === "/contact" ? "contact" : "home";
  return { url, status: 200, contentType: "text/html", body: pages[key]! };
}
async function main() {
  const resolved = await resolveBacklinkContacts({ homepageUrl: home, domainHostname: "example.com", fetchPage });
  assert.equal(resolved.status, "resolved");
  assert.equal(resolved.inspectedUrls.length, 2);
  assert(resolved.candidates.some((candidate) => candidate.email === "editor@example.com" && candidate.evidence[0]?.kind === "mailto"));
  assert(resolved.candidates.some((candidate) => candidate.email === "news@example.com"));
  assert(resolved.candidates.some((candidate) => candidate.contactFormUrl === "https://example.com/contact"));
  assert(resolved.candidates.some((candidate) => candidate.linkedinUrl?.includes("linkedin.com/company/example")));
  const duplicate = await resolveBacklinkContacts({ homepageUrl: home, domainHostname: "example.com", fetchPage: async (url) => ({ url, status: 200, contentType: "text/html", body: '<a href="mailto:editor@example.com">Email</a><p>EDITOR@example.com</p>' }) });
  assert.equal(duplicate.candidates.length, 1);
  assert.equal(duplicate.candidates[0]?.evidence.length, 2); // Normalized evidence is retained, not just the candidate value.
  assert.deepEqual(duplicate, await resolveBacklinkContacts({ homepageUrl: home, domainHostname: "example.com", fetchPage: async (url) => ({ url, status: 200, contentType: "text/html", body: '<a href="mailto:editor@example.com">Email</a><p>EDITOR@example.com</p>' }) }));
  const persistenceInput = buildEvidenceBackedContactInput({ domainId: "domain-1", contactKey: "CT-100", candidate: duplicate.candidates[0]! });
  assert.equal(persistenceInput?.email_normalized, "editor@example.com");
  assert.equal(persistenceInput?.contact_status, "unverified");
  assert.equal(JSON.parse(persistenceInput?.source_reference ?? "[]").length, 2);
  let persisted = 0;
  await persistEvidenceBackedResolvedContact(async (input) => { persisted += 1; return input; }, persistenceInput);
  assert.equal(persisted, 1); // The caller can pass existing createContact; the resolver owns no repository/client.
  const noContact = await resolveBacklinkContacts({ homepageUrl: home, domainHostname: "example.com", fetchPage: async (url) => ({ url, status: 200, contentType: "text/html", body: "<p>nothing here</p>" }) });
  assert.equal(noContact.status, "no_contact_found");
  const unsafe = await resolveBacklinkContacts({ homepageUrl: "javascript:alert(1)", domainHostname: "example.com", fetchPage });
  assert.equal(unsafe.status, "blocked");
  let boundedFetches = 0;
  const bounded = await resolveBacklinkContacts({ homepageUrl: home, domainHostname: "example.com", maxPages: 1, fetchPage: async (url) => { boundedFetches += 1; return { url, status: 200, contentType: "text/html", body: '<a href="/contact">Contact</a>' }; } });
  assert.equal(bounded.inspectedUrls.length, 1); assert.equal(boundedFetches, 1);
  const ambiguous = await resolveBacklinkContacts({ homepageUrl: home, domainHostname: "example.com", fetchPage: async (url) => ({ url, status: 200, contentType: "text/html", body: "<form></form><form></form>" }) });
  assert.equal(ambiguous.status, "ambiguous");
  const outside = await resolveBacklinkContacts({ homepageUrl: home, domainHostname: "example.com", fetchPage: async (url) => ({ url, status: 200, contentType: "text/html", body: "contact evil@elsewhere.test <a href=\"https://elsewhere.test/contact\">x</a>" }) });
  assert.equal(outside.candidates.length, 0); // third-party addresses are never made sendable evidence.
  const guessed = await resolveBacklinkContacts({ homepageUrl: home, domainHostname: "example.com", fetchPage: async (url) => ({ url, status: 200, contentType: "text/html", body: "Try editor [at] example [dot] com" }) });
  assert.equal(guessed.candidates.length, 0); // The resolver recognizes explicit addresses only; it never synthesizes one.
  const policyInput = { backlinksEnabled: true, liveAutomationEnabled: true, evidenceBackedContact: true, contactStatus: "verified", channel: "email" as const, validOpportunity: true, validCampaign: true, validDraft: true, inboundReplyStop: false, complaintOrBounceStop: false, conflictingOpenAttempt: false, rateLimitEligible: true, maxAttemptEligible: true };
  assert.equal(evaluateAutonomousOutreachPolicy(policyInput).kind, "eligible_for_email_sender");
  assert.equal(evaluateAutonomousOutreachPolicy({ ...policyInput, contactStatus: "unverified" }).kind, "manual_review");
  assert.equal(evaluateAutonomousOutreachPolicy({ ...policyInput, contactStatus: "do_not_contact" }).kind, "manual_review");
  assert.equal(evaluateAutonomousOutreachPolicy({ ...policyInput, contactStatus: "archived" }).kind, "manual_review");
  assert.equal(evaluateAutonomousOutreachPolicy({ ...policyInput, contactStatus: "unexpected_status" }).kind, "manual_review");
  const manual = evaluateAutonomousOutreachPolicy({ ...policyInput, liveAutomationEnabled: false });
  assert.equal(manual.kind, "manual_review");
  assert.equal(evaluateAutonomousOutreachPolicy({ ...policyInput, channel: "linkedin" }).kind, "manual_action_required");
  assert.equal(evaluateAutonomousOutreachPolicy({ ...policyInput, channel: "linkedin", contactStatus: "do_not_contact" }).kind, "manual_review");
  assert.equal(evaluateAutonomousOutreachPolicy({ ...policyInput, channel: "linkedin", inboundReplyStop: true }).kind, "manual_review");
  assert.equal(evaluateAutonomousOutreachPolicy({ ...policyInput, channel: "linkedin", complaintOrBounceStop: true }).kind, "manual_review");
  assert.equal(evaluateAutonomousOutreachPolicy({ ...policyInput, channel: "contact_form", contactFormVerified: true }).kind, "eligible_for_contact_form_worker");
  assert.equal(evaluateAutonomousOutreachPolicy({ ...policyInput, channel: "contact_form" }).kind, "manual_review");
  assert.equal(evaluateAutonomousOutreachPolicy({ ...policyInput, inboundReplyStop: true }).kind, "manual_review");
  assert.equal(evaluateAutonomousOutreachPolicy({ ...policyInput, complaintOrBounceStop: true }).kind, "manual_review");
  const task = buildContactResolutionTask({ workspaceId: "00000000-0000-4000-8000-000000000001", runId: "00000000-0000-4000-8000-000000000002", dependsOnTaskId: "00000000-0000-4000-8000-000000000003", domainId: "00000000-0000-4000-8000-000000000004", opportunityId: "00000000-0000-4000-8000-000000000005", actorUserId: "00000000-0000-4000-8000-000000000006", scheduledAt: "2026-09-21T00:00:00.000Z" });
  assert.equal(task.taskKind, "backlinks.contact_resolution"); assert.equal(task.dependsOnTaskId, "00000000-0000-4000-8000-000000000003"); assert.equal((task.input as { actorUserId: string }).actorUserId, "00000000-0000-4000-8000-000000000006");
  console.log("PASS — Backlink autonomy foundation smoke");
}
void main();
