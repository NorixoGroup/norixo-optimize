import {
  BacklinkOutreachDraftError,
  createBacklinkOutreachDraftService,
} from "../lib/backlinks/services/outreachDraftService";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

type StoredOutreach = {
  id: string;
  outreach_key: string;
  campaign_id: string;
  opportunity_id: string;
  contact_id: string;
  channel: string;
  status: string;
  subject: string | null;
  body: string | null;
};

function createFixture() {
  const outreach: StoredOutreach[] = [];
  let nextKey = 1;
  let lastCreateInput: { workspaceId: string; actorUserId: string } | null = null;
  const contacts = new Map([
    ["email", { id: "email", domain_id: "domain", full_name: "Alex", role_title: "Editor", contact_status: "verified", email_normalized: "alex@example.com", linkedin_url: null, contact_form_url: null, contact_key: "CT-EMAIL" }],
    ["linkedin", { id: "linkedin", domain_id: "domain", full_name: null, role_title: "Publisher", contact_status: "verified", email_normalized: null, linkedin_url: "https://linkedin.example/alex", contact_form_url: null, contact_key: "CT-LINKEDIN" }],
    ["form", { id: "form", domain_id: "domain", full_name: "Sam", role_title: null, contact_status: "verified", email_normalized: null, linkedin_url: null, contact_form_url: "https://example.com/contact", contact_key: "CT-FORM" }],
    ["blocked", { id: "blocked", domain_id: "domain", full_name: null, role_title: null, contact_status: "do_not_contact", email_normalized: "blocked@example.com", linkedin_url: null, contact_form_url: null, contact_key: "CT-BLOCKED" }],
    ["archived", { id: "archived", domain_id: "domain", full_name: null, role_title: null, contact_status: "archived", email_normalized: "archived@example.com", linkedin_url: null, contact_form_url: null, contact_key: "CT-ARCHIVED" }],
    ["wrong-domain", { id: "wrong-domain", domain_id: "other-domain", full_name: null, role_title: null, contact_status: "verified", email_normalized: "wrong@example.com", linkedin_url: null, contact_form_url: null, contact_key: "CT-WRONG" }],
  ]);
  const service = createBacklinkOutreachDraftService({
    eligibility: {
      getMembership: async () => ({ campaign_id: "campaign", opportunity_id: "opportunity" }),
      getOpportunity: async () => ({ id: "opportunity", domain_id: "domain", asset_id: "asset", target_page_url: "https://example.com/resources" }),
      listContactsByDomain: async () => [...contacts.values()].filter((contact) => contact.domain_id === "domain"),
      listOutreachByOpportunity: async () => outreach,
      listCurrentVerifiedContactFormEvidenceContactIds: async () => new Set(["form"]),
    },
    getCampaign: async () => ({ name: "Editorial partnerships", objective: "relevant resource references" }),
    getContact: async (_workspaceId, contactId) => {
      const contact = contacts.get(contactId);
      if (contact == null) throw new Error("CONTACT_NOT_FOUND");
      return contact;
    },
    getDomain: async () => ({ hostname: "example.com" }),
    getOpportunity: async () => ({ id: "opportunity", asset_id: "asset", target_page_title: "Resource guide", target_page_url: "https://example.com/resources", opportunity_type: "resource_page", page_type: "guide", evidence_summary: "The page lists relevant resources." }),
    getAsset: async () => ({ display_name: "Norixo guide", canonical_url: "https://norixo.example/guide" }),
    getActiveOutreach: async (input) => outreach.find((item) => item.opportunity_id === input.opportunityId && item.contact_id === input.contactId && item.channel === input.channel && ["draft", "ready", "active", "replied", "conversation_open", "paused"].includes(item.status)) ?? null,
    reserveOutreachKey: async () => `BL-OUT-2026-${String(nextKey++).padStart(3, "0")}`,
    createOutreach: async (input) => {
      lastCreateInput = { workspaceId: input.workspaceId, actorUserId: input.actorUserId };
      const record: StoredOutreach = { id: `outreach-${outreach.length + 1}`, outreach_key: input.outreachKey, campaign_id: input.campaignId, opportunity_id: input.opportunityId, contact_id: input.contactId, channel: input.channel, status: input.status, subject: input.subject, body: input.body };
      outreach.push(record);
      return record;
    },
  });
  return { outreach, service, getLastCreateInput: () => lastCreateInput };
}

async function expectError(action: () => Promise<unknown>, code: string) {
  try {
    await action();
  } catch (error) {
    assert(error instanceof BacklinkOutreachDraftError && error.code === code, `Expected ${code}.`);
    return;
  }
  throw new Error(`Expected ${code}.`);
}

async function main() {
  const { outreach, service, getLastCreateInput } = createFixture();
  const base = { workspaceId: "workspace", actorUserId: "actor", campaignId: "campaign", opportunityId: "opportunity" };
  const email = await service({ ...base, contactId: "email", channel: "email" });
  assert(email.disposition === "created" && email.status === "draft" && email.subject != null && email.body?.includes("Resource guide"), "Email must create a deterministic draft.");
  assert(getLastCreateInput()?.workspaceId === "workspace" && getLastCreateInput()?.actorUserId === "actor", "Draft creation must preserve workspace and actor scope.");
  const linkedin = await service({ ...base, contactId: "linkedin", channel: "linkedin" });
  const form = await service({ ...base, contactId: "form", channel: "contact_form" });
  assert(linkedin.subject === null && form.subject === null, "LinkedIn and contact-form drafts must not invent subjects.");
  const retry = await service({ ...base, contactId: "email", channel: "email" });
  assert(retry.disposition === "existing" && retry.subject === email.subject && retry.body === email.body && outreach.length === 3, "Retry must preserve the persisted draft.");
  await expectError(() => service({ ...base, contactId: "blocked", channel: "email" }), "CHANNEL_NOT_ELIGIBLE");
  await expectError(() => service({ ...base, contactId: "archived", channel: "email" }), "CHANNEL_NOT_ELIGIBLE");
  await expectError(() => service({ ...base, contactId: "wrong-domain", channel: "email" }), "CONTACT_NOT_ELIGIBLE");
  await expectError(() => service({ ...base, contactId: "form", channel: "email" }), "CHANNEL_NOT_ELIGIBLE");
  console.log("PASS — Backlink outreach draft service smoke");
}

void main();
