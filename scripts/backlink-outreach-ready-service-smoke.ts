import {
  buildBacklinkOutreachApprovedInitialAttemptFingerprint,
  buildBacklinkOutreachApprovedInitialAttemptSnapshot,
} from "../lib/backlinks/services/outreachApprovalFingerprint";
import {
  BacklinkOutreachReadyError,
  markBacklinkOutreachReady,
} from "../lib/backlinks/services/outreachReadyService";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

type FixtureOutreach = {
  id: string;
  outreach_key: string;
  campaign_id: string;
  opportunity_id: string;
  contact_id: string;
  channel: string;
  status: string;
  subject: string | null;
  body: string | null;
  current_attempt: number;
  updated_at: string;
  auto_send_approved_at: string | null;
  auto_send_approved_by: string | null;
  auto_send_approval_fingerprint: string | null;
  auto_send_approved_recipient: string | null;
  auto_send_approved_subject: string | null;
  auto_send_approved_body: string | null;
  auto_send_approved_channel: string | null;
  auto_send_approved_target_url: string | null;
  auto_send_approved_contact_id: string | null;
  auto_send_approved_opportunity_id: string | null;
  auto_send_approved_campaign_id: string | null;
};

async function main() {
  let outreach: FixtureOutreach = {
    id: "outreach",
    outreach_key: "BL-OUT-2026-001",
    campaign_id: "campaign",
    opportunity_id: "opportunity",
    contact_id: "contact",
    channel: "email",
    status: "draft",
    subject: "Subject",
    body: "Body",
    current_attempt: 0,
    updated_at: "now",
    auto_send_approved_at: null,
    auto_send_approved_by: null,
    auto_send_approval_fingerprint: null,
    auto_send_approved_recipient: null,
    auto_send_approved_subject: null,
    auto_send_approved_body: null,
    auto_send_approved_channel: null,
    auto_send_approved_target_url: null,
    auto_send_approved_contact_id: null,
    auto_send_approved_opportunity_id: null,
    auto_send_approved_campaign_id: null,
  };

  let update: unknown;
  let eligible = true;
  let conflict = false;
  let attempts: Array<{ id: string }> = [];

  const ready = markBacklinkOutreachReady({
    eligibility: {
      getMembership: async () => ({ campaign_id: "campaign", opportunity_id: "opportunity" }),
      getOpportunity: async () => ({
        id: "opportunity",
        domain_id: "domain",
        asset_id: "asset",
        target_page_url: "https://example.test/target",
      }),
      listContactsByDomain: async () => [
        {
          id: "contact",
          contact_key: "CT",
          full_name: null,
          role_title: null,
          contact_status: eligible ? "verified" : "do_not_contact",
          email_normalized: "x@example.com",
          linkedin_url: "x",
          contact_form_url: "x",
        },
      ],
      listOutreachByOpportunity: async () => [],
    },
    getOutreach: async () => outreach,
    getActiveOutreach: async () =>
      conflict ? { ...outreach, id: "other", status: "ready" } : null,
    listAttemptsForOutreach: async () => attempts,
    updateOutreach: async (_w, _id, value) => {
      update = value;
      outreach = { ...outreach, ...value };
      return outreach;
    },
    now: () => "now",
  });

  const input = { workspaceId: "workspace", actorUserId: "actor", outreachId: "outreach" };
  const snapshot = buildBacklinkOutreachApprovedInitialAttemptSnapshot({
    workspaceId: "workspace",
    campaignId: "campaign",
    outreachId: "outreach",
    opportunityId: "opportunity",
    contactId: "contact",
    recipientEmail: "x@example.com",
    channel: "email",
    subject: "Subject",
    body: "Body",
    targetUrl: "https://example.test/target",
  });
  const expectedApprovalUpdate = {
    status: "ready" as const,
    channel: "email" as const,
    auto_send_approved_at: "now",
    auto_send_approved_by: "actor",
    auto_send_approval_fingerprint:
      buildBacklinkOutreachApprovedInitialAttemptFingerprint(snapshot),
    auto_send_approved_recipient: "x@example.com",
    auto_send_approved_subject: "Subject",
    auto_send_approved_body: "Body",
    auto_send_approved_channel: "email",
    auto_send_approved_target_url: "https://example.test/target",
    auto_send_approved_contact_id: "contact",
    auto_send_approved_opportunity_id: "opportunity",
    auto_send_approved_campaign_id: "campaign",
  };

  let result = await ready(input);
  assert(
    result.disposition === "updated" &&
      result.status === "ready" &&
      JSON.stringify(update) === JSON.stringify({ status: "ready", channel: "email" }),
    "Ordinary draft -> ready must stay unchanged.",
  );

  result = await ready(input);
  assert(result.disposition === "existing", "Ordinary ready retry must be idempotent.");

  outreach = {
    ...outreach,
    status: "ready",
    channel: "contact_form",
    current_attempt: 0,
    auto_send_approved_at: null,
    auto_send_approved_by: null,
    auto_send_approval_fingerprint: null,
    auto_send_approved_recipient: null,
    auto_send_approved_subject: null,
    auto_send_approved_body: null,
    auto_send_approved_channel: null,
    auto_send_approved_target_url: null,
    auto_send_approved_contact_id: null,
    auto_send_approved_opportunity_id: null,
    auto_send_approved_campaign_id: null,
  };
  attempts = [];
  result = await ready(input);
  assert(
    result.disposition === "updated" &&
      result.channel === "email" &&
      JSON.stringify(update) === JSON.stringify({ status: "ready", channel: "email" }),
    "Ordinary ready must keep legacy channel normalization without approval backfill.",
  );

  result = await ready({ ...input, reapprove: true });
  assert(
    result.disposition === "updated" &&
      result.status === "ready" &&
      JSON.stringify(update) === JSON.stringify(expectedApprovalUpdate),
    "Explicit reapprove must persist the full approval snapshot.",
  );

  result = await ready({ ...input, reapprove: true });
  assert(result.disposition === "existing", "Matching explicit reapprove must be idempotent.");

  outreach = {
    ...outreach,
    status: "ready",
    channel: "contact_form",
    current_attempt: 0,
    auto_send_approved_at: null,
    auto_send_approved_by: null,
    auto_send_approval_fingerprint: null,
    auto_send_approved_recipient: null,
    auto_send_approved_subject: null,
    auto_send_approved_body: null,
    auto_send_approved_channel: null,
    auto_send_approved_target_url: null,
    auto_send_approved_contact_id: null,
    auto_send_approved_opportunity_id: null,
    auto_send_approved_campaign_id: null,
  };
  result = await ready({ ...input, reapprove: true });
  assert(result.disposition === "updated" && result.channel === "email", "Reapproval must reconcile a stale ready channel to email.");

  attempts = [{ id: "attempt-1" }];
  try {
    await ready({ ...input, reapprove: true });
    throw new Error("expected attempt rejection");
  } catch (e) {
    assert(
      e instanceof BacklinkOutreachReadyError &&
        e.code === "OUTREACH_REAPPROVAL_NOT_ALLOWED",
      "Existing attempts must block explicit reapproval.",
    );
  }

  attempts = [];
  outreach = { ...outreach, current_attempt: 1 };
  try {
    await ready({ ...input, reapprove: true });
    throw new Error("expected current_attempt rejection");
  } catch (e) {
    assert(
      e instanceof BacklinkOutreachReadyError &&
        e.code === "OUTREACH_REAPPROVAL_NOT_ALLOWED",
      "current_attempt > 0 must block explicit reapproval.",
    );
  }

  outreach = {
    ...outreach,
    current_attempt: 0,
    channel: "email",
    subject: null,
    body: "Body",
    auto_send_approved_at: null,
    auto_send_approved_by: null,
    auto_send_approval_fingerprint: null,
    auto_send_approved_recipient: null,
    auto_send_approved_subject: null,
    auto_send_approved_body: null,
    auto_send_approved_channel: null,
    auto_send_approved_target_url: null,
    auto_send_approved_contact_id: null,
    auto_send_approved_opportunity_id: null,
    auto_send_approved_campaign_id: null,
  };
  try {
    await ready({ ...input, reapprove: true });
    throw new Error("expected content rejection");
  } catch (e) {
    assert(
      e instanceof BacklinkOutreachReadyError &&
        e.code === "CONTACT_OR_CHANNEL_NOT_ELIGIBLE",
      "Missing email subject must block explicit reapproval.",
    );
  }

  outreach = {
    ...outreach,
    subject: "Subject",
    body: "Body",
    status: "active",
  };
  try {
    await ready({ ...input, reapprove: true });
    throw new Error("expected status rejection");
  } catch (e) {
    assert(e instanceof BacklinkOutreachReadyError, "Non-ready outreach must be rejected.");
  }

  outreach = {
    ...outreach,
    status: "ready",
    channel: "contact_form",
    subject: "Subject",
    body: "Body",
    auto_send_approved_at: null,
    auto_send_approved_by: null,
    auto_send_approval_fingerprint: null,
    auto_send_approved_recipient: null,
    auto_send_approved_subject: null,
    auto_send_approved_body: null,
    auto_send_approved_channel: null,
    auto_send_approved_target_url: null,
    auto_send_approved_contact_id: null,
    auto_send_approved_opportunity_id: null,
    auto_send_approved_campaign_id: null,
  };
  eligible = false;
  try {
    await ready({ ...input, reapprove: true });
    throw new Error("expected eligibility rejection");
  } catch (e) {
    assert(e instanceof BacklinkOutreachReadyError, "Suppressed contact must be rejected.");
  }

  eligible = true;
  conflict = true;
  try {
    await ready({ ...input, reapprove: true });
    throw new Error("expected conflict rejection");
  } catch (e) {
    assert(
      e instanceof BacklinkOutreachReadyError &&
        e.code === "OUTREACH_READY_CONFLICT",
      "Active conflict must block explicit reapproval.",
    );
  }

  console.log("PASS — Backlink outreach ready service smoke");
}

void main();
