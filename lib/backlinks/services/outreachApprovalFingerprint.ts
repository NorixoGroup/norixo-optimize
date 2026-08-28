import { createHash } from "node:crypto";

export type BacklinkOutreachApprovedInitialAttemptSnapshot = Readonly<{
  version: "bl1";
  workspaceId: string;
  campaignId: string;
  outreachId: string;
  opportunityId: string;
  contactId: string;
  recipientEmail: string;
  channel: string;
  subject: string;
  body: string;
  targetUrl: string;
}>;

function normalize(value: string): string {
  return value.trim();
}

export function buildBacklinkOutreachApprovedInitialAttemptSnapshot(input: {
  workspaceId: string;
  campaignId: string;
  outreachId: string;
  opportunityId: string;
  contactId: string;
  recipientEmail: string;
  channel: string;
  subject: string;
  body: string;
  targetUrl: string;
}): BacklinkOutreachApprovedInitialAttemptSnapshot {
  return {
    version: "bl1",
    workspaceId: normalize(input.workspaceId),
    campaignId: normalize(input.campaignId),
    outreachId: normalize(input.outreachId),
    opportunityId: normalize(input.opportunityId),
    contactId: normalize(input.contactId),
    recipientEmail: normalize(input.recipientEmail),
    channel: normalize(input.channel),
    subject: normalize(input.subject),
    body: normalize(input.body),
    targetUrl: normalize(input.targetUrl),
  };
}

export function buildBacklinkOutreachApprovedInitialAttemptFingerprint(
  snapshot: BacklinkOutreachApprovedInitialAttemptSnapshot,
): string {
  return `bl1_${createHash("sha256")
    .update(
      JSON.stringify([
        snapshot.version,
        snapshot.workspaceId,
        snapshot.campaignId,
        snapshot.outreachId,
        snapshot.opportunityId,
        snapshot.contactId,
        snapshot.recipientEmail,
        snapshot.channel,
        snapshot.subject,
        snapshot.body,
        snapshot.targetUrl,
      ]),
    )
    .digest("hex")}`;
}
