import assert from "node:assert/strict";

import {
  BacklinkContactResolutionTaskError,
  executeBacklinkContactResolutionTask,
} from "../lib/automation/backlink-contact-resolution-task-handler";
import type { ContactResolutionResult } from "../lib/backlinks/services/contactResolutionService";

const task = {
  workspaceId: "workspace",
  domainId: "domain",
  opportunityId: "opportunity",
  actorUserId: "actor",
};

const resolved = (candidates: ContactResolutionResult["candidates"]): ContactResolutionResult => ({
  status: "resolved",
  inspectedUrls: ["https://example.com/"],
  candidates,
  reasons: [],
});

function candidate(kind: "mailto" | "contact_form" | "linkedin", value: string) {
  return {
    email: kind === "mailto" ? value : null,
    contactFormUrl: kind === "contact_form" ? value : null,
    linkedinUrl: kind === "linkedin" ? value : null,
    evidence: [{ kind, value, sourceUrl: "https://example.com/contact", confidence: kind === "mailto" ? "strong" : "medium" }],
  } as const;
}

function dependencies(result: ContactResolutionResult) {
  const contacts: Array<{ id: string; contact_status: string; email_normalized: string | null; linkedin_url: string | null; contact_form_url: string | null }> = [];
  let keys = 0;
  const created: Array<Record<string, unknown>> = [];
  return {
    contacts,
    created,
    deps: {
      getDomain: async () => ({ id: "domain", workspace_id: "workspace", hostname: "example.com", lifecycle_status: "active", archived_at: null }),
      getOpportunity: async () => ({ id: "opportunity", workspace_id: "workspace", domain_id: "domain", lifecycle_status: "active", archived_at: null }),
      listContactsByDomain: async () => contacts,
      allocateContactKey: async () => `CT-${String(++keys).padStart(6, "0")}`,
      createContact: async (_workspaceId: string, _actorUserId: string, input: Record<string, unknown>) => {
        const id = `contact-${created.length + 1}`;
        created.push(input);
        contacts.push({ id, contact_status: String(input.contact_status), email_normalized: input.email_normalized as string | null, linkedin_url: input.linkedin_url as string | null, contact_form_url: input.contact_form_url as string | null });
        return { id };
      },
      resolve: async () => result,
    },
  };
}

async function main() {
  const email = dependencies(resolved([candidate("mailto", "editor@example.com")]));
  const first = await executeBacklinkContactResolutionTask(email.deps, task);
  assert.deepEqual(first.createdContactIds, ["contact-1"]);
  assert.equal(email.created[0]?.contact_status, "unverified");
  assert.equal(email.created[0]?.email_normalized, "editor@example.com");
  assert.equal(typeof email.created[0]?.source_reference, "string");
  const retry = await executeBacklinkContactResolutionTask(email.deps, task);
  assert.deepEqual(retry.existingContactIds, ["contact-1"]);
  assert.equal(email.created.length, 1);

  const verified = dependencies(resolved([candidate("mailto", "verified@example.com")]));
  verified.contacts.push({ id: "verified", contact_status: "verified", email_normalized: "verified@example.com", linkedin_url: null, contact_form_url: null });
  const verifiedResult = await executeBacklinkContactResolutionTask(verified.deps, task);
  assert.deepEqual(verifiedResult.existingContactIds, ["verified"]);
  assert.equal(verified.created.length, 0);

  for (const value of [candidate("contact_form", "https://example.com/contact/"), candidate("linkedin", "https://www.linkedin.com/company/example/")]) {
    const channel = dependencies(resolved([value]));
    const channelResult = await executeBacklinkContactResolutionTask(channel.deps, task);
    assert.equal(channelResult.createdContactIds.length, 1);
    const repeated = await executeBacklinkContactResolutionTask(channel.deps, task);
    assert.equal(repeated.existingContactIds.length, 1);
  }

  for (const status of ["ambiguous", "blocked", "no_contact_found"] as const) {
    const terminal = dependencies({ status, inspectedUrls: [], candidates: [], reasons: [status.toUpperCase()] });
    const terminalResult = await executeBacklinkContactResolutionTask(terminal.deps, task);
    assert.equal(terminal.created.length, 0);
    assert.equal(terminalResult.manualReviewRequired, status !== "no_contact_found");
  }
  const failed = dependencies({ status: "failed", inspectedUrls: [], candidates: [], reasons: ["FETCH_FAILED"] });
  await assert.rejects(() => executeBacklinkContactResolutionTask(failed.deps, task), (error: unknown) => error instanceof BacklinkContactResolutionTaskError && error.code === "CONTACT_RESOLUTION_FETCH_FAILED");

  const mismatch = dependencies(resolved([candidate("mailto", "editor@example.com")]));
  mismatch.deps.getOpportunity = async () => ({ id: "opportunity", workspace_id: "workspace", domain_id: "other-domain", lifecycle_status: "active", archived_at: null });
  const mismatchResult = await executeBacklinkContactResolutionTask(mismatch.deps, task);
  assert.equal(mismatchResult.status, "blocked");
  assert.equal(mismatch.created.length, 0);
  assert(!JSON.stringify(first).includes("<html"));
  console.log("PASS — Backlink contact resolution task smoke");
}

void main();
