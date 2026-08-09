import {
  getBacklinkOutreachDraftEligibilityForMembership,
  type OutreachDraftChannel,
  type OutreachDraftEligibilityDependencies,
} from "./outreachDraftEligibilityService";
import {
  createBacklinkOutreachDraftTemplate,
  type BacklinkOutreachDraftTemplate,
} from "./outreachDraftTemplate";

type DraftOutreach = {
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

export type CreateBacklinkOutreachDraftInput = {
  workspaceId: string;
  actorUserId: string;
  campaignId: string;
  opportunityId: string;
  contactId: string;
  channel: OutreachDraftChannel;
};

export type CreateBacklinkOutreachDraftResult = {
  outreachId: string;
  outreachKey: string;
  disposition: "created" | "existing";
  campaignId: string;
  opportunityId: string;
  contactId: string;
  channel: OutreachDraftChannel;
  status: string;
  subject: string | null;
  body: string | null;
};

export class BacklinkOutreachDraftError extends Error {
  constructor(
    public readonly code:
      | "CONTACT_NOT_ELIGIBLE"
      | "CHANNEL_NOT_ELIGIBLE"
      | "OUTREACH_CREATE_FAILED",
  ) {
    super(code);
  }
}

export type BacklinkOutreachDraftDependencies = {
  eligibility: OutreachDraftEligibilityDependencies;
  getCampaign: (workspaceId: string, campaignId: string) => Promise<{ name: string; objective: string }>;
  getContact: (workspaceId: string, contactId: string) => Promise<{
    id: string;
    domain_id: string;
    full_name: string | null;
    role_title: string | null;
  }>;
  getDomain: (workspaceId: string, domainId: string) => Promise<{ hostname: string }>;
  getOpportunity: (workspaceId: string, opportunityId: string) => Promise<{
    id: string;
    asset_id: string;
    target_page_title: string;
    target_page_url: string;
    opportunity_type: string;
    page_type: string;
    evidence_summary: string;
  }>;
  getAsset: (workspaceId: string, assetId: string) => Promise<{
    display_name: string;
    canonical_url: string | null;
  }>;
  getActiveOutreach: (input: {
    workspaceId: string;
    opportunityId: string;
    contactId: string;
    channel: OutreachDraftChannel;
  }) => Promise<DraftOutreach | null>;
  reserveOutreachKey: (workspaceId: string) => Promise<string>;
  createOutreach: (input: {
    workspaceId: string;
    actorUserId: string;
    campaignId: string;
    opportunityId: string;
    contactId: string;
    outreachKey: string;
    channel: OutreachDraftChannel;
    status: "draft";
    subject: string | null;
    body: string;
  }) => Promise<DraftOutreach>;
};

function resultFromOutreach(
  outreach: DraftOutreach,
  disposition: "created" | "existing",
): CreateBacklinkOutreachDraftResult {
  if (
    outreach.channel !== "email" &&
    outreach.channel !== "linkedin" &&
    outreach.channel !== "contact_form"
  ) {
    throw new BacklinkOutreachDraftError("OUTREACH_CREATE_FAILED");
  }
  return {
    outreachId: outreach.id,
    outreachKey: outreach.outreach_key,
    disposition,
    campaignId: outreach.campaign_id,
    opportunityId: outreach.opportunity_id,
    contactId: outreach.contact_id,
    channel: outreach.channel,
    status: outreach.status,
    subject: outreach.subject,
    body: outreach.body,
  };
}

function buildTemplateInput(
  campaign: { name: string; objective: string },
  contact: { full_name: string | null; role_title: string | null },
  domain: { hostname: string },
  opportunity: {
    target_page_title: string;
    target_page_url: string;
    opportunity_type: string;
    page_type: string;
    evidence_summary: string;
  },
  asset: { display_name: string; canonical_url: string | null },
  channel: OutreachDraftChannel,
): BacklinkOutreachDraftTemplate {
  return createBacklinkOutreachDraftTemplate({
    channel,
    campaign,
    contact: { fullName: contact.full_name, roleTitle: contact.role_title },
    domain,
    opportunity: {
      targetPageTitle: opportunity.target_page_title,
      targetPageUrl: opportunity.target_page_url,
      opportunityType: opportunity.opportunity_type,
      pageType: opportunity.page_type,
      evidenceSummary: opportunity.evidence_summary,
    },
    asset: { displayName: asset.display_name, canonicalUrl: asset.canonical_url },
  });
}

export function createBacklinkOutreachDraftService(deps: BacklinkOutreachDraftDependencies) {
  return async function createBacklinkOutreachDraft(
    input: CreateBacklinkOutreachDraftInput,
  ): Promise<CreateBacklinkOutreachDraftResult> {
    const eligibility = await getBacklinkOutreachDraftEligibilityForMembership(deps.eligibility, input);
    const eligibleContact = eligibility.contacts.find((contact) => contact.contactId === input.contactId);
    if (eligibleContact == null) {
      throw new BacklinkOutreachDraftError("CONTACT_NOT_ELIGIBLE");
    }

    const contact = await deps.getContact(input.workspaceId, input.contactId);
    if (contact.domain_id !== eligibility.domainId) {
      throw new BacklinkOutreachDraftError("CONTACT_NOT_ELIGIBLE");
    }

    const existing = await deps.getActiveOutreach({
      workspaceId: input.workspaceId,
      opportunityId: eligibility.opportunityId,
      contactId: input.contactId,
      channel: input.channel,
    });
    if (existing != null) {
      return resultFromOutreach(existing, "existing");
    }
    if (!eligibleContact.eligibleChannels.includes(input.channel)) {
      throw new BacklinkOutreachDraftError("CHANNEL_NOT_ELIGIBLE");
    }

    const [campaign, domain, opportunity] = await Promise.all([
      deps.getCampaign(input.workspaceId, eligibility.campaignId),
      deps.getDomain(input.workspaceId, eligibility.domainId),
      deps.getOpportunity(input.workspaceId, eligibility.opportunityId),
    ]);
    const asset = await deps.getAsset(input.workspaceId, opportunity.asset_id);
    const draft = buildTemplateInput(campaign, contact, domain, opportunity, asset, input.channel);
    const outreachKey = await deps.reserveOutreachKey(input.workspaceId);

    try {
      const created = await deps.createOutreach({
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        campaignId: eligibility.campaignId,
        opportunityId: eligibility.opportunityId,
        contactId: input.contactId,
        outreachKey,
        channel: input.channel,
        status: "draft",
        subject: draft.subject,
        body: draft.body,
      });
      return resultFromOutreach(created, "created");
    } catch {
      const concurrent = await deps.getActiveOutreach({
        workspaceId: input.workspaceId,
        opportunityId: eligibility.opportunityId,
        contactId: input.contactId,
        channel: input.channel,
      });
      if (concurrent != null) {
        return resultFromOutreach(concurrent, "existing");
      }
      throw new BacklinkOutreachDraftError("OUTREACH_CREATE_FAILED");
    }
  };
}
