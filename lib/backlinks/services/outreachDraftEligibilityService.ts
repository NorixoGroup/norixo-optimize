export type OutreachDraftChannel = "email" | "linkedin" | "contact_form";
export type OutreachDraftEligibilityReason = "CONTACT_DO_NOT_CONTACT" | "CONTACT_ARCHIVED" | "OUTREACH_ALREADY_ACTIVE";
type Contact = { id: string; contact_key: string; full_name: string | null; role_title: string | null; contact_status: string; email_normalized: string | null; linkedin_url: string | null; contact_form_url: string | null };
type Outreach = { id: string; contact_id: string; channel: string; status: string };
type Opportunity = { id: string; domain_id: string; asset_id: string; target_page_url: string };
export type ContactFormVerificationContact = Pick<Contact, "contact_form_url" | "id">;

export type BacklinkOutreachChannelEvidence = {
  contact_status: string;
  email_normalized: string | null;
  linkedin_url?: string | null;
  contact_form_url?: string | null;
  contact_form_verified?: boolean;
};

export function isEligibleContactFormUrl(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim() === value && /^https:\/\/[^\s\\]+$/.test(value);
}

export function resolveBacklinkOutreachChannels(
  contact: BacklinkOutreachChannelEvidence,
): OutreachDraftChannel[] {
  const available = contact.contact_status !== "do_not_contact" && contact.contact_status !== "archived";
  const channels: OutreachDraftChannel[] = [];
  if (available && contact.email_normalized) channels.push("email");
  if (available && contact.linkedin_url) channels.push("linkedin");
  if (available && contact.contact_form_verified === true && isEligibleContactFormUrl(contact.contact_form_url)) channels.push("contact_form");
  return channels;
}

export function resolveBacklinkOutreachPreferredChannel(
  contact: BacklinkOutreachChannelEvidence,
): OutreachDraftChannel | null {
  return resolveBacklinkOutreachChannels(contact)[0] ?? null;
}

export type OutreachDraftEligibilityDependencies = {
  getMembership: (input: { workspaceId: string; campaignId: string; opportunityId: string }) => Promise<{ campaign_id: string; opportunity_id: string }>;
  getOpportunity: (workspaceId: string, opportunityId: string) => Promise<Opportunity>;
  listContactsByDomain: (workspaceId: string, domainId: string) => Promise<readonly Contact[]>;
  listOutreachByOpportunity: (workspaceId: string, opportunityId: string) => Promise<readonly Outreach[]>;
  listCurrentVerifiedContactFormEvidenceContactIds?: (workspaceId: string, contacts: readonly ContactFormVerificationContact[]) => Promise<ReadonlySet<string>>;
};

export async function getBacklinkOutreachDraftEligibilityForMembership(deps: OutreachDraftEligibilityDependencies, input: { workspaceId: string; campaignId: string; opportunityId: string; excludeOutreachId?: string }) {
  const membership = await deps.getMembership(input);
  const opportunity = await deps.getOpportunity(input.workspaceId, membership.opportunity_id);
  const [contacts, outreach] = await Promise.all([deps.listContactsByDomain(input.workspaceId, opportunity.domain_id), deps.listOutreachByOpportunity(input.workspaceId, opportunity.id)]);
  const verifiedContactFormContactIds = deps.listCurrentVerifiedContactFormEvidenceContactIds == null
    ? new Set<string>()
    : await deps.listCurrentVerifiedContactFormEvidenceContactIds(input.workspaceId, contacts);
  const activeStatuses = new Set(["draft", "ready", "active", "replied", "conversation_open", "paused"]);
  return { campaignId: membership.campaign_id, opportunityId: opportunity.id, domainId: opportunity.domain_id, assetId: opportunity.asset_id, targetPageUrl: opportunity.target_page_url, contacts: contacts.map((contact) => {
    const unavailableReasons: OutreachDraftEligibilityReason[] = [];
    if (contact.contact_status === "do_not_contact") unavailableReasons.push("CONTACT_DO_NOT_CONTACT");
    if (contact.contact_status === "archived") unavailableReasons.push("CONTACT_ARCHIVED");
    const channels = resolveBacklinkOutreachChannels({ ...contact, contact_form_verified: verifiedContactFormContactIds.has(contact.id) });
    const eligibleChannels = channels.filter((channel) => {
      const occupied = outreach.some((item) => item.id !== input.excludeOutreachId && item.contact_id === contact.id && item.channel === channel && activeStatuses.has(item.status));
      if (occupied) unavailableReasons.push("OUTREACH_ALREADY_ACTIVE");
      return !occupied;
    });
    return { contactId: contact.id, contactKey: contact.contact_key, label: contact.full_name ?? contact.role_title ?? contact.contact_key, contactStatus: contact.contact_status, emailNormalized: contact.email_normalized, eligibleChannels, unavailableReasons: [...new Set(unavailableReasons)] };
  }) };
}
