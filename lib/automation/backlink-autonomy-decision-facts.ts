import { BacklinkRepositoryError } from "@/lib/backlinks/repositories/errors";
import type { ContactFormVerificationContact } from "@/lib/backlinks/repositories/contactFormAutomationRepository";
import { hasCurrentBacklinkContactChannelEvidence } from "@/lib/backlinks/services/contactValidationService";
import { evaluateBacklinkOutreachRateEligibility, type BacklinkOutreachRateEligibilityDependencies } from "@/lib/backlinks/services/outreachRateEligibilityService";

type Channel = "email" | "linkedin" | "contact_form";
type Outreach = { id: string; workspace_id: string; campaign_id: string; opportunity_id: string; contact_id: string; channel: string; status: string; subject: string | null; body: string | null; current_attempt: number; max_attempts: number };
type Domain = { id: string; workspace_id: string; hostname: string; archived_at: string | null };
type Opportunity = { id: string; workspace_id: string; domain_id: string; lifecycle_status: string; closed_at: string | null; archived_at: string | null };
type Contact = ContactFormVerificationContact & { id: string; workspace_id: string; domain_id: string; contact_status: string; email_normalized: string | null; linkedin_url: string | null; source_reference: string | null; archived_at?: string | null; do_not_contact_at?: string | null };
type Campaign = { id: string; workspace_id: string; status: string; archived_at: string | null };

export type BacklinkAutonomyDecisionFactDependencies = {
  getOutreach: (workspaceId: string, outreachId: string) => Promise<Outreach>;
  getDomain: (workspaceId: string, domainId: string) => Promise<Domain>;
  getOpportunity: (workspaceId: string, opportunityId: string) => Promise<Opportunity>;
  getContact: (workspaceId: string, contactId: string) => Promise<Contact>;
  getCampaign: (workspaceId: string, campaignId: string) => Promise<Campaign>;
  getMembership: (workspaceId: string, campaignId: string, opportunityId: string) => Promise<{ campaign_id: string; opportunity_id: string; membership_status: string } | null>;
  hasCurrentContactFormEvidence: (workspaceId: string, contact: Contact) => Promise<boolean>;
  hasInboundReplyStop: (workspaceId: string, outreachId: string) => Promise<boolean>;
  hasComplaintOrBounceStop: (workspaceId: string, outreachId: string) => Promise<boolean>;
  getOpenAttempt: (workspaceId: string, outreachId: string) => Promise<unknown | null>;
  getWorkspaceControl: (workspaceId: string) => Promise<{ backlinksEnabled: boolean; backlinkAutonomyEnabled: boolean; dryRunOnly: boolean; disabledReason: string | null } | null>;
  rateEligibility: BacklinkOutreachRateEligibilityDependencies;
  now?: () => string;
};

export type BacklinkAutonomyDecisionFacts = {
  backlinksEnabled: boolean; liveAutomationEnabled: boolean; evidenceBackedContact: boolean; contactStatus: string; channel: Channel;
  validOpportunity: boolean; validCampaign: boolean; validDraft: boolean; inboundReplyStop: boolean; complaintOrBounceStop: boolean;
  conflictingOpenAttempt: boolean; rateLimitEligible: boolean; maxAttemptEligible: boolean; contactFormVerified?: boolean;
};

function channel(value: string): Channel { return value === "email" || value === "linkedin" || value === "contact_form" ? value : "email"; }
function blankFacts(): BacklinkAutonomyDecisionFacts { return { backlinksEnabled: false, liveAutomationEnabled: false, evidenceBackedContact: false, contactStatus: "unverified", channel: "email", validOpportunity: false, validCampaign: false, validDraft: false, inboundReplyStop: true, complaintOrBounceStop: true, conflictingOpenAttempt: true, rateLimitEligible: false, maxAttemptEligible: false, contactFormVerified: false }; }
function expectedDraft(channelValue: Channel, outreach: Outreach): boolean {
  if (outreach.status !== "draft") return false;
  const body = outreach.body?.trim() ?? "";
  if (channelValue === "linkedin") return body.length > 0;
  return body.length > 0 && (outreach.subject?.trim() ?? "").length > 0;
}
function missing(error: unknown): boolean { return error instanceof BacklinkRepositoryError && error.code === "NOT_FOUND"; }

/** Assembles a current, read-only snapshot; atomic email reservation is intentionally elsewhere. */
export function assembleBacklinkAutonomyDecisionFacts(deps: BacklinkAutonomyDecisionFactDependencies) {
  return async (input: { workspaceId: string; outreachId: string }): Promise<BacklinkAutonomyDecisionFacts> => {
    let outreach: Outreach;
    try { outreach = await deps.getOutreach(input.workspaceId, input.outreachId); } catch (error) { if (missing(error)) return blankFacts(); throw error; }
    const selectedChannel = channel(outreach.channel);
    try {
      const [domain, opportunity, contact, campaign, control] = await Promise.all([
        deps.getDomain(input.workspaceId, (await deps.getOpportunity(input.workspaceId, outreach.opportunity_id)).domain_id),
        deps.getOpportunity(input.workspaceId, outreach.opportunity_id), deps.getContact(input.workspaceId, outreach.contact_id), deps.getCampaign(input.workspaceId, outreach.campaign_id), deps.getWorkspaceControl(input.workspaceId),
      ]);
      const membership = await deps.getMembership(input.workspaceId, campaign.id, opportunity.id);
      const contactFormVerified = selectedChannel === "contact_form" && await deps.hasCurrentContactFormEvidence(input.workspaceId, contact);
      const evidenceBackedContact = contact.contact_status === "verified" && (selectedChannel === "contact_form" ? contactFormVerified : hasCurrentBacklinkContactChannelEvidence({ domainHostname: domain.hostname, channel: selectedChannel, email: contact.email_normalized, linkedinUrl: contact.linkedin_url, sourceReference: contact.source_reference }));
      const validOpportunity = outreach.workspace_id === input.workspaceId && domain.workspace_id === input.workspaceId && opportunity.workspace_id === input.workspaceId && contact.workspace_id === input.workspaceId && outreach.opportunity_id === opportunity.id && outreach.contact_id === contact.id && opportunity.domain_id === domain.id && contact.domain_id === domain.id && domain.archived_at == null && opportunity.lifecycle_status === "active" && opportunity.closed_at == null && opportunity.archived_at == null;
      const validCampaign = campaign.workspace_id === input.workspaceId && outreach.campaign_id === campaign.id && campaign.status === "draft" && campaign.archived_at == null && membership?.campaign_id === campaign.id && membership.opportunity_id === opportunity.id && membership.membership_status !== "removed";
      const [inboundReplyStop, complaintOrBounceStop, openAttempt, rate] = await Promise.all([
        deps.hasInboundReplyStop(input.workspaceId, outreach.id), deps.hasComplaintOrBounceStop(input.workspaceId, outreach.id), deps.getOpenAttempt(input.workspaceId, outreach.id),
        evaluateBacklinkOutreachRateEligibility(deps.rateEligibility, { workspaceId: input.workspaceId, contactId: contact.id, domainId: domain.id, now: (deps.now ?? (() => new Date().toISOString()))() }),
      ]);
      return { backlinksEnabled: control?.backlinksEnabled === true, liveAutomationEnabled: control?.backlinksEnabled === true && control.backlinkAutonomyEnabled === true && control.dryRunOnly === false && control.disabledReason == null, evidenceBackedContact, contactStatus: contact.contact_status, channel: selectedChannel, validOpportunity, validCampaign, validDraft: outreach.workspace_id === input.workspaceId && expectedDraft(selectedChannel, outreach), inboundReplyStop, complaintOrBounceStop, conflictingOpenAttempt: openAttempt != null, rateLimitEligible: rate.allowed, maxAttemptEligible: outreach.current_attempt < outreach.max_attempts, contactFormVerified };
    } catch (error) { if (missing(error)) return { ...blankFacts(), channel: selectedChannel }; throw error; }
  };
}
