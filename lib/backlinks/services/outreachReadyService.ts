import {
  buildBacklinkOutreachApprovedInitialAttemptFingerprint,
  buildBacklinkOutreachApprovedInitialAttemptSnapshot,
} from "./outreachApprovalFingerprint";
import {
  getBacklinkOutreachDraftEligibilityForMembership,
  type OutreachDraftEligibilityDependencies,
} from "./outreachDraftEligibilityService";

type Outreach = {
  id: string;
  outreach_key: string;
  campaign_id: string;
  opportunity_id: string;
  contact_id: string;
  channel: string;
  status: string;
  subject: string | null;
  body: string | null;
  current_attempt: number;
  updated_at: string;
  auto_send_approved_at: string | null;
  auto_send_approved_by: string | null;
  auto_send_approval_fingerprint: string | null;
  auto_send_approved_recipient: string | null;
  auto_send_approved_subject: string | null;
  auto_send_approved_body: string | null;
  auto_send_approved_channel: string | null;
  auto_send_approved_target_url: string | null;
  auto_send_approved_contact_id: string | null;
  auto_send_approved_opportunity_id: string | null;
  auto_send_approved_campaign_id: string | null;
};

type ReadyUpdate = {
  status: "ready";
  channel: "email" | "linkedin" | "contact_form";
  auto_send_approved_at: string;
  auto_send_approved_by: string | null;
  auto_send_approval_fingerprint: string;
  auto_send_approved_recipient: string;
  auto_send_approved_subject: string;
  auto_send_approved_body: string;
  auto_send_approved_channel: string;
  auto_send_approved_target_url: string;
  auto_send_approved_contact_id: string;
  auto_send_approved_opportunity_id: string;
  auto_send_approved_campaign_id: string;
};

type ReadyContact = {
  contactId: string;
  contactKey: string;
  label: string;
  contactStatus: string;
  emailNormalized: string | null;
  eligibleChannels: readonly ("email" | "linkedin" | "contact_form")[];
  unavailableReasons: readonly string[];
};

type AttemptRow = { id: string };

export class BacklinkOutreachReadyError extends Error {
  constructor(
    public readonly code:
      | "OUTREACH_NOT_READY_ELIGIBLE"
      | "OUTREACH_DRAFT_CONTENT_INCOMPLETE"
      | "CONTACT_OR_CHANNEL_NOT_ELIGIBLE"
      | "OUTREACH_READY_CONFLICT"
      | "OUTREACH_REAPPROVAL_NOT_ALLOWED",
  ) {
    super(code);
    this.name = "BacklinkOutreachReadyError";
  }
}

function isReadyApprovalCurrent(
  outreach: Outreach,
  snapshot: ReturnType<typeof buildBacklinkOutreachApprovedInitialAttemptSnapshot>,
): boolean {
  return (
    outreach.auto_send_approved_at != null &&
    outreach.auto_send_approved_by != null &&
    outreach.auto_send_approval_fingerprint ===
      buildBacklinkOutreachApprovedInitialAttemptFingerprint(snapshot) &&
    outreach.auto_send_approved_recipient === snapshot.recipientEmail &&
    outreach.auto_send_approved_subject === snapshot.subject &&
    outreach.auto_send_approved_body === snapshot.body &&
    outreach.auto_send_approved_channel === snapshot.channel &&
    outreach.auto_send_approved_target_url === snapshot.targetUrl &&
    outreach.auto_send_approved_contact_id === snapshot.contactId &&
    outreach.auto_send_approved_opportunity_id === snapshot.opportunityId &&
    outreach.auto_send_approved_campaign_id === snapshot.campaignId &&
    outreach.status === "ready"
  );
}

function buildReadyUpdate(
  snapshot: ReturnType<typeof buildBacklinkOutreachApprovedInitialAttemptSnapshot>,
  approvedBy: string,
  approvedAt: string,
): ReadyUpdate {
  return {
    status: "ready",
    channel: snapshot.channel as ReadyUpdate["channel"],
    auto_send_approved_at: approvedAt,
    auto_send_approved_by: approvedBy,
    auto_send_approval_fingerprint:
      buildBacklinkOutreachApprovedInitialAttemptFingerprint(snapshot),
    auto_send_approved_recipient: snapshot.recipientEmail,
    auto_send_approved_subject: snapshot.subject,
    auto_send_approved_body: snapshot.body,
    auto_send_approved_channel: snapshot.channel,
    auto_send_approved_target_url: snapshot.targetUrl,
    auto_send_approved_contact_id: snapshot.contactId,
    auto_send_approved_opportunity_id: snapshot.opportunityId,
    auto_send_approved_campaign_id: snapshot.campaignId,
  };
}

function selectReadyContact(
  contacts: readonly ReadyContact[],
  outreachContactId: string,
): ReadyContact | null {
  return contacts.find((item) => item.contactId === outreachContactId) ?? null;
}

export function markBacklinkOutreachReady(deps: {
  eligibility: OutreachDraftEligibilityDependencies;
  getOutreach(workspaceId: string, outreachId: string): Promise<Outreach>;
  getActiveOutreach(input: {
    workspaceId: string;
    opportunityId: string;
    contactId: string;
    channel: string;
  }): Promise<Outreach | null>;
  listAttemptsForOutreach(workspaceId: string, outreachId: string): Promise<AttemptRow[]>;
  updateOutreach(
    workspaceId: string,
    outreachId: string,
    input: ReadyUpdate | { status: "ready"; channel?: "email" | "linkedin" | "contact_form" },
  ): Promise<Outreach>;
  now?: () => string;
}) {
  return async (input: {
    workspaceId: string;
    actorUserId: string;
    outreachId: string;
    reapprove?: boolean;
  }) => {
    const outreach = await deps.getOutreach(input.workspaceId, input.outreachId);
    const eligibility = await getBacklinkOutreachDraftEligibilityForMembership(
      deps.eligibility,
      {
        workspaceId: input.workspaceId,
        campaignId: outreach.campaign_id,
        opportunityId: outreach.opportunity_id,
        excludeOutreachId: outreach.id,
      },
    );
    const contact = selectReadyContact(eligibility.contacts, outreach.contact_id);
    const readyPreferredChannel = (contact?.eligibleChannels[0] ??
      outreach.channel) as ReadyUpdate["channel"] | null;

    if (outreach.status === "ready") {
      if (input.reapprove === true) {
        if (outreach.current_attempt > 0) {
          throw new BacklinkOutreachReadyError("OUTREACH_REAPPROVAL_NOT_ALLOWED");
        }
        const attempts = await deps.listAttemptsForOutreach(
          input.workspaceId,
          input.outreachId,
        );
        if (attempts.length > 0) {
          throw new BacklinkOutreachReadyError("OUTREACH_REAPPROVAL_NOT_ALLOWED");
        }
        if (
          contact == null ||
          !contact.eligibleChannels.includes("email") ||
          !contact.emailNormalized?.trim() ||
          !outreach.subject?.trim() ||
          !outreach.body?.trim() ||
          !eligibility.targetPageUrl?.trim()
        ) {
          throw new BacklinkOutreachReadyError("CONTACT_OR_CHANNEL_NOT_ELIGIBLE");
        }

        const snapshot = buildBacklinkOutreachApprovedInitialAttemptSnapshot({
          workspaceId: input.workspaceId,
          campaignId: outreach.campaign_id,
          outreachId: outreach.id,
          opportunityId: outreach.opportunity_id,
          contactId: outreach.contact_id,
          recipientEmail: contact.emailNormalized,
          channel: "email",
          subject: outreach.subject,
          body: outreach.body,
          targetUrl: eligibility.targetPageUrl,
        });

        if (isReadyApprovalCurrent(outreach, snapshot)) {
          return {
            outreachId: outreach.id,
            outreachKey: outreach.outreach_key,
            disposition: "existing" as const,
            status: "ready" as const,
            contactId: outreach.contact_id,
            channel: outreach.channel,
            subject: outreach.subject,
            body: outreach.body,
            updatedAt: outreach.updated_at,
          };
        }

        const conflict = await deps.getActiveOutreach({
          workspaceId: input.workspaceId,
          opportunityId: outreach.opportunity_id,
          contactId: outreach.contact_id,
          channel: "email",
        });
        if (conflict != null && conflict.id !== outreach.id) {
          throw new BacklinkOutreachReadyError("OUTREACH_READY_CONFLICT");
        }

        const approvedAt = (deps.now ?? (() => new Date().toISOString()))();
        const updated = await deps.updateOutreach(
          input.workspaceId,
          input.outreachId,
          buildReadyUpdate(snapshot, input.actorUserId, approvedAt),
        );
        return {
          outreachId: updated.id,
          outreachKey: updated.outreach_key,
          disposition: "updated" as const,
          status: "ready" as const,
          contactId: updated.contact_id,
          channel: updated.channel,
          subject: updated.subject,
          body: updated.body,
          updatedAt: updated.updated_at,
        };
      }

      const preferredChannel = (contact?.eligibleChannels[0] ?? null) as
        | "email"
        | "linkedin"
        | "contact_form"
        | null;
      if (
        outreach.current_attempt === 0 &&
        preferredChannel != null &&
        outreach.channel !== preferredChannel
      ) {
        const conflict = await deps.getActiveOutreach({
          workspaceId: input.workspaceId,
          opportunityId: outreach.opportunity_id,
          contactId: outreach.contact_id,
          channel: preferredChannel,
        });
        if (conflict != null && conflict.id !== outreach.id) {
          throw new BacklinkOutreachReadyError("OUTREACH_READY_CONFLICT");
        }
        const updated = await deps.updateOutreach(input.workspaceId, input.outreachId, {
          status: "ready",
          channel: preferredChannel,
        });
        return {
          outreachId: updated.id,
          outreachKey: updated.outreach_key,
          disposition: "updated" as const,
          status: "ready" as const,
          contactId: updated.contact_id,
          channel: updated.channel,
          subject: updated.subject,
          body: updated.body,
          updatedAt: updated.updated_at,
        };
      }

      return {
        outreachId: outreach.id,
        outreachKey: outreach.outreach_key,
        disposition: "existing" as const,
        status: "ready" as const,
        contactId: outreach.contact_id,
        channel: outreach.channel,
        subject: outreach.subject,
        body: outreach.body,
        updatedAt: outreach.updated_at,
      };
    }

    if (outreach.status !== "draft") {
      throw new BacklinkOutreachReadyError("OUTREACH_NOT_READY_ELIGIBLE");
    }

    const body = outreach.body?.trim();
    const targetChannel = (contact?.eligibleChannels[0] ?? outreach.channel) as
      | "email"
      | "linkedin"
      | "contact_form";
    if (!body || (targetChannel === "email" && !outreach.subject?.trim())) {
      throw new BacklinkOutreachReadyError("OUTREACH_DRAFT_CONTENT_INCOMPLETE");
    }
    if (targetChannel == null || !contact?.eligibleChannels.includes(targetChannel)) {
      throw new BacklinkOutreachReadyError("CONTACT_OR_CHANNEL_NOT_ELIGIBLE");
    }
    const conflict = await deps.getActiveOutreach({
      workspaceId: input.workspaceId,
      opportunityId: outreach.opportunity_id,
      contactId: outreach.contact_id,
      channel: targetChannel,
    });
    if (conflict != null && conflict.id !== outreach.id) {
      throw new BacklinkOutreachReadyError("OUTREACH_READY_CONFLICT");
    }
    const updated = await deps.updateOutreach(input.workspaceId, input.outreachId, {
      status: "ready",
      channel: targetChannel,
    });
    return {
      outreachId: updated.id,
      outreachKey: updated.outreach_key,
      disposition: "updated" as const,
      status: "ready" as const,
      contactId: updated.contact_id,
      channel: updated.channel,
      subject: updated.subject,
      body: updated.body,
      updatedAt: updated.updated_at,
    };
  };
}
