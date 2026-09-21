import { evaluateBacklinkAutonomyDownstreamDecision, type BacklinkAutonomyDecisionResult } from "./backlink-autonomy-pipeline";
import { BacklinkOutreachDraftError } from "@/lib/backlinks/services/outreachDraftService";

type Channel = "email" | "contact_form" | "linkedin";
type ScopedDomain = { id: string; workspace_id?: string; archived_at?: string | null };
type ScopedOpportunity = { id: string; workspace_id?: string; domain_id: string; archived_at?: string | null };
type ScopedContact = { id: string; workspace_id?: string; domain_id: string; contact_status: string };

function invalidScope(domain: ScopedDomain, opportunity: ScopedOpportunity, contact: ScopedContact, input: { workspaceId: string; domainId: string; opportunityId: string; contactId: string }): boolean {
  return domain.id !== input.domainId || opportunity.id !== input.opportunityId || contact.id !== input.contactId ||
    opportunity.domain_id !== domain.id || contact.domain_id !== domain.id || domain.archived_at != null || opportunity.archived_at != null ||
    (domain.workspace_id != null && domain.workspace_id !== input.workspaceId) ||
    (opportunity.workspace_id != null && opportunity.workspace_id !== input.workspaceId) ||
    (contact.workspace_id != null && contact.workspace_id !== input.workspaceId);
}

export type CampaignPrepareTaskInput = { workspaceId: string; domainId: string; opportunityId: string; contactId: string; actorUserId: string; campaignPreparationConfirmed?: boolean };
export type CampaignPrepareTaskDependencies = {
  getDomain: (workspaceId: string, domainId: string) => Promise<ScopedDomain>;
  getOpportunity: (workspaceId: string, opportunityId: string) => Promise<ScopedOpportunity>;
  getContact: (workspaceId: string, contactId: string) => Promise<ScopedContact>;
  findCampaignMembership: (input: { workspaceId: string; opportunityId: string }) => Promise<{ campaignId: string; membershipStatus: string } | null>;
  /** Adapter for canonical campaign creation/membership apply; never supplied by production composition here. */
  prepareCampaign: (input: { workspaceId: string; actorUserId: string; opportunityId: string; contactId: string; confirm: true }) => Promise<{ campaignId: string; disposition: "created" | "existing"; membershipStatus: string }>;
};
export type CampaignPrepareTaskResult = { outcome: "completed" | "manual_review" | "blocked"; campaignId: string | null; membershipStatus: string | null; reasons: readonly string[] };

export async function executeBacklinkCampaignPrepareTask(deps: CampaignPrepareTaskDependencies, input: CampaignPrepareTaskInput): Promise<CampaignPrepareTaskResult> {
  const [domain, opportunity, contact] = await Promise.all([deps.getDomain(input.workspaceId, input.domainId), deps.getOpportunity(input.workspaceId, input.opportunityId), deps.getContact(input.workspaceId, input.contactId)]);
  if (invalidScope(domain, opportunity, contact, input)) return { outcome: "blocked", campaignId: null, membershipStatus: null, reasons: ["WORKSPACE_OR_RELATIONSHIP_INVALID"] };
  if (contact.contact_status === "do_not_contact" || contact.contact_status === "archived") return { outcome: "blocked", campaignId: null, membershipStatus: null, reasons: ["CONTACT_SUPPRESSED"] };
  const existing = await deps.findCampaignMembership({ workspaceId: input.workspaceId, opportunityId: input.opportunityId });
  if (existing != null) return { outcome: "completed", campaignId: existing.campaignId, membershipStatus: existing.membershipStatus, reasons: ["EXISTING_CAMPAIGN_MEMBERSHIP"] };
  if (input.campaignPreparationConfirmed !== true) return { outcome: "manual_review", campaignId: null, membershipStatus: null, reasons: ["CAMPAIGN_APPLY_CONFIRMATION_REQUIRED"] };
  const prepared = await deps.prepareCampaign({ workspaceId: input.workspaceId, actorUserId: input.actorUserId, opportunityId: input.opportunityId, contactId: input.contactId, confirm: true });
  return { outcome: "completed", campaignId: prepared.campaignId, membershipStatus: prepared.membershipStatus, reasons: [prepared.disposition === "created" ? "CAMPAIGN_PREPARED" : "EXISTING_CAMPAIGN_MEMBERSHIP"] };
}

export type DraftPrepareTaskInput = { workspaceId: string; domainId: string; opportunityId: string; contactId: string; campaignId: string; actorUserId: string; channel: Channel };
export type DraftPrepareTaskDependencies = {
  getDomain: (workspaceId: string, domainId: string) => Promise<ScopedDomain>;
  getOpportunity: (workspaceId: string, opportunityId: string) => Promise<ScopedOpportunity>;
  getContact: (workspaceId: string, contactId: string) => Promise<ScopedContact>;
  getCampaign: (workspaceId: string, campaignId: string) => Promise<{ id: string; workspace_id?: string; lifecycle_status?: string }>;
  getActiveOutreach: (input: { workspaceId: string; opportunityId: string; contactId: string; channel: Channel }) => Promise<{ id: string; status: string } | null>;
  /** Adapter for createBacklinkOutreachDraftService, the sole outreach owner. */
  createDraft: (input: { workspaceId: string; actorUserId: string; campaignId: string; opportunityId: string; contactId: string; channel: Channel }) => Promise<{ outreachId: string; disposition: "created" | "existing"; status: string }>;
};
export type DraftPrepareTaskResult = { outcome: "completed" | "blocked"; campaignId: string; outreachId: string | null; outreachStatus: string | null; reasons: readonly string[] };

export async function executeBacklinkDraftPrepareTask(deps: DraftPrepareTaskDependencies, input: DraftPrepareTaskInput): Promise<DraftPrepareTaskResult> {
  const [domain, opportunity, contact, campaign] = await Promise.all([deps.getDomain(input.workspaceId, input.domainId), deps.getOpportunity(input.workspaceId, input.opportunityId), deps.getContact(input.workspaceId, input.contactId), deps.getCampaign(input.workspaceId, input.campaignId)]);
  if (invalidScope(domain, opportunity, contact, input) || campaign.id !== input.campaignId || (campaign.workspace_id != null && campaign.workspace_id !== input.workspaceId) || campaign.lifecycle_status === "archived") return { outcome: "blocked", campaignId: input.campaignId, outreachId: null, outreachStatus: null, reasons: ["WORKSPACE_OR_RELATIONSHIP_INVALID"] };
  if (contact.contact_status === "do_not_contact" || contact.contact_status === "archived") return { outcome: "blocked", campaignId: input.campaignId, outreachId: null, outreachStatus: null, reasons: ["CONTACT_SUPPRESSED"] };
  const existing = await deps.getActiveOutreach({ workspaceId: input.workspaceId, opportunityId: input.opportunityId, contactId: input.contactId, channel: input.channel });
  if (existing != null) return { outcome: "completed", campaignId: input.campaignId, outreachId: existing.id, outreachStatus: existing.status, reasons: ["EXISTING_OUTREACH"] };
  try {
    const draft = await deps.createDraft(input);
    return { outcome: "completed", campaignId: input.campaignId, outreachId: draft.outreachId, outreachStatus: draft.status, reasons: [draft.disposition === "created" ? "DRAFT_CREATED" : "EXISTING_OUTREACH"] };
  } catch (error) {
    if (error instanceof BacklinkOutreachDraftError && (error.code === "CONTACT_NOT_ELIGIBLE" || error.code === "CHANNEL_NOT_ELIGIBLE")) {
      return { outcome: "blocked", campaignId: input.campaignId, outreachId: null, outreachStatus: null, reasons: [error.code] };
    }
    throw error;
  }
}

export type OutreachDecisionTaskDependencies = {
  getFacts: (input: { workspaceId: string; outreachId: string }) => Promise<Omit<Parameters<typeof evaluateBacklinkAutonomyDownstreamDecision>[0], "workspaceId" | "outreachId" | "liveAutomationEnabled"> & { liveAutomationEnabled?: boolean; contactFormCaptchaOrManualReview?: boolean }>;
};

/** Default-false live autonomy gate; this handler cannot invoke an executor. */
export async function executeBacklinkOutreachDecisionTask(deps: OutreachDecisionTaskDependencies, input: { workspaceId: string; outreachId: string }): Promise<BacklinkAutonomyDecisionResult> {
  const facts = await deps.getFacts(input);
  if (facts.contactFormCaptchaOrManualReview) return { outcome: "manual_review", reasons: ["CONTACT_FORM_MANUAL_REVIEW_REQUIRED"], execution: null };
  return evaluateBacklinkAutonomyDownstreamDecision({ ...facts, workspaceId: input.workspaceId, outreachId: input.outreachId, liveAutomationEnabled: facts.liveAutomationEnabled === true });
}
