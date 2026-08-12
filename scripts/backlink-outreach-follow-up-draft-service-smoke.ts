import { BacklinkOutreachFollowUpDraftError, prepareBacklinkOutreachFollowUpDraft, updateBacklinkOutreachFollowUpDraft } from "../lib/backlinks/services/outreachFollowUpDraftService";

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }

async function main() {
  let status = "prepared";
  let draft: { id: string; attempt_id: string; follow_up_number: number; subject: string; body: string; prepared_at: string; updated_at: string; updated_by: string } | null = null;
  const deps = {
    getAttempt: async () => ({ id: "attempt", outreach_id: "outreach", attempt_kind: "follow_up", status, created_at: "2026-08-12T10:00:00.000Z" }),
    getOutreach: async () => ({ id: "outreach", campaign_id: "campaign", contact_id: "contact" }),
    listAttempts: async () => [
      { id: "cancelled", outreach_id: "outreach", attempt_kind: "follow_up", status: "cancelled", created_at: "2026-08-12T09:00:00.000Z" },
      { id: "attempt", outreach_id: "outreach", attempt_kind: "follow_up", status: "prepared", created_at: "2026-08-12T10:00:00.000Z" },
    ],
    getTemplateData: async () => ({ campaign: { name: "Campaign", objective: "Earn links" }, contact: { fullName: "Alex", roleTitle: null }, domain: { hostname: "example.com" }, opportunity: { targetPageTitle: "Guide", targetPageUrl: "https://example.com/guide", opportunityType: "resource", pageType: "article", evidenceSummary: "Evidence" }, asset: { displayName: "Asset", canonicalUrl: null } }),
    getDraft: async () => draft,
    prepare: async (value: { subject: string; body: string; preparedAt: string; actorUserId: string; attemptId: string }) => {
      if (draft) return { ...draft, disposition: "existing" as const };
      draft = { id: "draft", attempt_id: value.attemptId, follow_up_number: 2, subject: value.subject, body: value.body, prepared_at: value.preparedAt, updated_at: value.preparedAt, updated_by: value.actorUserId };
      return { ...draft, disposition: "created" as const };
    },
    update: async (value: { subject: string; body: string; updatedAt: string; actorUserId: string; expectedUpdatedAt: string }) => {
      assert(draft != null && value.expectedUpdatedAt === draft.updated_at, "Stale version must not update.");
      draft = { ...draft, subject: value.subject, body: value.body, updated_at: value.updatedAt, updated_by: value.actorUserId };
      return draft;
    },
    now: () => "2026-08-12T10:01:00.000Z",
  };
  const base = { workspaceId: "workspace", outreachId: "outreach", attemptId: "attempt", actorUserId: "actor" };
  const created = await prepareBacklinkOutreachFollowUpDraft(deps)(base);
  assert(created.disposition === "created" && created.follow_up_number === 2, "Cancelled prior Attempt must count and preparation must create once.");
  assert((await prepareBacklinkOutreachFollowUpDraft(deps)(base)).disposition === "existing", "Prepare must not regenerate a canonical draft.");
  const updated = await updateBacklinkOutreachFollowUpDraft(deps)({ ...base, subject: " Subject ", body: " Body ", expectedUpdatedAt: created.updated_at });
  assert(updated.subject === "Subject" && updated.body === "Body" && updated.prepared_at === created.prepared_at, "Edit must trim and preserve prepared_at.");
  status = "cancelled";
  try { await updateBacklinkOutreachFollowUpDraft(deps)({ ...base, subject: "Other", body: "Other", expectedUpdatedAt: updated.updated_at }); throw new Error("Expected prepared guard."); } catch (error) { assert(error instanceof BacklinkOutreachFollowUpDraftError && error.code === "FOLLOW_UP_DRAFT_ATTEMPT_NOT_PREPARED", "Cancelled Attempt must be immutable."); }
  console.log("PASS — Backlink follow-up draft service smoke");
}

void main();
