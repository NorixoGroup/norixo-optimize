export type OutreachDraftChannel = "email" | "linkedin" | "contact_form";
export type OutreachDraftEligibilityReason = "CONTACT_DO_NOT_CONTACT" | "CONTACT_ARCHIVED" | "OUTREACH_ALREADY_ACTIVE";
type Contact = { id: string; contact_key: string; full_name: string | null; role_title: string | null; contact_status: string; email_normalized: string | null; linkedin_url: string | null; contact_form_url: string | null };
type Outreach = { contact_id: string; channel: string; status: string };
type Opportunity = { id: string; domain_id: string; asset_id: string };

export type OutreachDraftEligibilityDependencies = {
  getMembership: (input: { workspaceId: string; campaignId: string; opportunityId: string }) => Promise<{ campaign_id: string; opportunity_id: string }>;
  getOpportunity: (workspaceId: string, opportunityId: string) => Promise<Opportunity>;
  listContactsByDomain: (workspaceId: string, domainId: string) => Promise<readonly Contact[]>;
  listOutreachByOpportunity: (workspaceId: string, opportunityId: string) => Promise<readonly Outreach[]>;
};

export async function getBacklinkOutreachDraftEligibilityForMembership(deps: OutreachDraftEligibilityDependencies, input: { workspaceId: string; campaignId: string; opportunityId: string }) {
  const membership = await deps.getMembership(input);
  const opportunity = await deps.getOpportunity(input.workspaceId, membership.opportunity_id);
  const [contacts, outreach] = await Promise.all([deps.listContactsByDomain(input.workspaceId, opportunity.domain_id), deps.listOutreachByOpportunity(input.workspaceId, opportunity.id)]);
  const activeStatuses = new Set(["draft", "ready", "active", "replied", "conversation_open", "paused"]);
  return { campaignId: membership.campaign_id, opportunityId: opportunity.id, domainId: opportunity.domain_id, assetId: opportunity.asset_id, contacts: contacts.map((contact) => {
    const unavailableReasons: OutreachDraftEligibilityReason[] = [];
    if (contact.contact_status === "do_not_contact") unavailableReasons.push("CONTACT_DO_NOT_CONTACT");
    if (contact.contact_status === "archived") unavailableReasons.push("CONTACT_ARCHIVED");
    const available = contact.contact_status !== "do_not_contact" && contact.contact_status !== "archived";
    const channels: OutreachDraftChannel[] = [];
    if (available && contact.email_normalized) channels.push("email");
    if (available && contact.linkedin_url) channels.push("linkedin");
    if (available && contact.contact_form_url) channels.push("contact_form");
    const eligibleChannels = channels.filter((channel) => {
      const occupied = outreach.some((item) => item.contact_id === contact.id && item.channel === channel && activeStatuses.has(item.status));
      if (occupied) unavailableReasons.push("OUTREACH_ALREADY_ACTIVE");
      return !occupied;
    });
    return { contactId: contact.id, contactKey: contact.contact_key, label: contact.full_name ?? contact.role_title ?? contact.contact_key, contactStatus: contact.contact_status, eligibleChannels, unavailableReasons: [...new Set(unavailableReasons)] };
  }) };
}
