import { getBacklinkOutreachDraftEligibilityForMembership } from "../lib/backlinks/services/outreachDraftEligibilityService";

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

async function main() {
  let mutations = 0;
  const result = await getBacklinkOutreachDraftEligibilityForMembership({
    getMembership: async () => ({ campaign_id: "campaign", opportunity_id: "opportunity" }),
    getOpportunity: async () => ({ id: "opportunity", domain_id: "domain-a", asset_id: "asset" }),
    listContactsByDomain: async (_workspace, domainId) => {
      assert(domainId === "domain-a", "Contacts must be scoped to the opportunity domain.");
      return [
        { id: "verified", contact_key: "CT-000001", full_name: "Verified", role_title: null, contact_status: "verified", email_normalized: "v@example.com", linkedin_url: "https://linkedin.com/in/v", contact_form_url: null },
        { id: "unverified", contact_key: "CT-000002", full_name: null, role_title: "Editor", contact_status: "unverified", email_normalized: "u@example.com", linkedin_url: null, contact_form_url: "https://example.com/contact" },
        { id: "blocked", contact_key: "CT-000003", full_name: null, role_title: null, contact_status: "do_not_contact", email_normalized: "b@example.com", linkedin_url: null, contact_form_url: null },
        { id: "archived", contact_key: "CT-000004", full_name: null, role_title: null, contact_status: "archived", email_normalized: null, linkedin_url: null, contact_form_url: null },
      ];
    },
    listOutreachByOpportunity: async () => [{ contact_id: "verified", channel: "email", status: "draft" }],
  }, { workspaceId: "workspace", campaignId: "campaign", opportunityId: "opportunity" });
  assert(result.contacts.length === 4 && result.domainId === "domain-a", "Expected all contacts for the domain.");
  const verified = result.contacts[0];
  assert(verified.eligibleChannels.includes("linkedin") && !verified.eligibleChannels.includes("email"), "Active outreach must occupy only its channel.");
  const unverified = result.contacts[1];
  assert(unverified.eligibleChannels.includes("email") && unverified.eligibleChannels.includes("contact_form"), "Unverified contacts can prepare drafts from available channels.");
  assert(result.contacts[2].eligibleChannels.length === 0 && result.contacts[2].unavailableReasons.includes("CONTACT_DO_NOT_CONTACT"), "Do-not-contact must be blocked.");
  assert(result.contacts[3].eligibleChannels.length === 0 && result.contacts[3].unavailableReasons.includes("CONTACT_ARCHIVED"), "Archived contacts must be blocked.");
  assert(mutations === 0, "Read-side must not mutate.");
  console.log("PASS — Backlink outreach draft eligibility smoke");
}

void main();
