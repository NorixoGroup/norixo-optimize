import type { OutreachDraftChannel } from "./outreachDraftEligibilityService";

export type BacklinkOutreachDraftTemplateInput = {
  mode?: "initial" | "follow_up";
  followUpNumber?: number;
  channel: OutreachDraftChannel;
  campaign: { name: string; objective: string };
  contact: { fullName: string | null; roleTitle: string | null };
  domain: { hostname: string };
  opportunity: {
    targetPageTitle: string;
    targetPageUrl: string;
    opportunityType: string;
    pageType: string;
    evidenceSummary: string;
  };
  asset: { displayName: string; canonicalUrl: string | null };
};

export type BacklinkOutreachDraftTemplate = { subject: string | null; body: string };

function contactGreeting(contact: BacklinkOutreachDraftTemplateInput["contact"]): string {
  return contact.fullName ?? contact.roleTitle ?? "there";
}

export function createBacklinkOutreachDraftTemplate(
  input: BacklinkOutreachDraftTemplateInput,
): BacklinkOutreachDraftTemplate {
  const assetReference = input.asset.canonicalUrl
    ? `${input.asset.displayName} (${input.asset.canonicalUrl})`
    : input.asset.displayName;
  const followUp = input.mode === "follow_up";
  const subject = input.channel === "email"
    ? `${input.campaign.name}: ${input.asset.displayName}`
    : null;
  if (followUp) {
    const followUpNumber = input.followUpNumber ?? 1;
    const body = followUpNumber === 1
      ? [`Hello ${contactGreeting(input.contact)},`, "", `I wanted to follow up on my note about ${input.opportunity.targetPageTitle} on ${input.domain.hostname}.`, `If it is not relevant, no action is needed. The asset is ${assetReference}.`, "", "Would you be open to a quick review?"].join("\n")
      : [`Hello ${contactGreeting(input.contact)},`, "", `This is a final short follow-up regarding ${input.opportunity.targetPageTitle} on ${input.domain.hostname}.`, "If this is not relevant, please feel free to disregard this message.", "", "Thank you for your time."].join("\n");
    return { subject: input.channel === "email" ? `Follow-up: ${input.campaign.name}` : null, body };
  }
  const body = [
    `Hello ${contactGreeting(input.contact)},`,
    "",
    `I am reaching out about ${input.opportunity.targetPageTitle} on ${input.domain.hostname}.`,
    `The opportunity is recorded as ${input.opportunity.opportunityType} for a ${input.opportunity.pageType} page: ${input.opportunity.targetPageUrl}`,
    `Our campaign “${input.campaign.name}” is focused on ${input.campaign.objective}. The asset is ${assetReference}.`,
    input.opportunity.evidenceSummary,
    "",
    "Would you be open to reviewing whether it is relevant for your site?",
  ].join("\n");

  return { subject, body };
}
