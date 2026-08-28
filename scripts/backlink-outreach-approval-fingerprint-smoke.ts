import {
  buildBacklinkOutreachApprovedInitialAttemptFingerprint,
  buildBacklinkOutreachApprovedInitialAttemptSnapshot,
} from "../lib/backlinks/services/outreachApprovalFingerprint";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main(): Promise<void> {
  const base = buildBacklinkOutreachApprovedInitialAttemptSnapshot({
    workspaceId: "workspace",
    campaignId: "campaign",
    outreachId: "outreach",
    opportunityId: "opportunity",
    contactId: "contact",
    recipientEmail: "contact@example.com",
    channel: "email",
    subject: "Subject",
    body: "Body",
    targetUrl: "https://example.com/page",
  });
  const same = buildBacklinkOutreachApprovedInitialAttemptSnapshot({
    workspaceId: " workspace ",
    campaignId: "campaign",
    outreachId: "outreach",
    opportunityId: "opportunity",
    contactId: "contact",
    recipientEmail: "contact@example.com",
    channel: "email",
    subject: "Subject",
    body: "Body",
    targetUrl: "https://example.com/page",
  });
  const changed = buildBacklinkOutreachApprovedInitialAttemptSnapshot({
    workspaceId: "workspace",
    campaignId: "campaign",
    outreachId: "outreach",
    opportunityId: "opportunity",
    contactId: "contact",
    recipientEmail: "other@example.com",
    channel: "email",
    subject: "Subject",
    body: "Body",
    targetUrl: "https://example.com/page",
  });

  const fingerprint = buildBacklinkOutreachApprovedInitialAttemptFingerprint(base);
  assert(fingerprint.startsWith("bl1_"), "Approved fingerprint must be versioned.");
  assert(
    fingerprint === buildBacklinkOutreachApprovedInitialAttemptFingerprint(same),
    "Approved fingerprint must normalize whitespace deterministically.",
  );
  assert(
    fingerprint !== buildBacklinkOutreachApprovedInitialAttemptFingerprint(changed),
    "Approved fingerprint must change when the recipient changes.",
  );

  console.log("PASS — Backlink outreach approval fingerprint smoke");
}

void main();
