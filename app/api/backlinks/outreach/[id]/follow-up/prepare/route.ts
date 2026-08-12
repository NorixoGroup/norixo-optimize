import { NextRequest, NextResponse } from "next/server";

import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { getBacklinkAssetById } from "@/lib/backlinks/repositories/assetsRepository";
import { getBacklinkCampaignById } from "@/lib/backlinks/repositories/campaignsRepository";
import { getBacklinkContactById } from "@/lib/backlinks/repositories/contactsRepository";
import { getBacklinkDomainById } from "@/lib/backlinks/repositories/domainsRepository";
import { getBacklinkOpportunityById } from "@/lib/backlinks/repositories/opportunitiesRepository";
import { getBacklinkOutreachById } from "@/lib/backlinks/repositories/outreachRepository";
import { getBacklinkOutreachAttemptById, listBacklinkOutreachAttemptsForOutreach, reserveBacklinkOutreachFollowUpAttempt } from "@/lib/backlinks/repositories/outreachAttemptsRepository";
import { getBacklinkOutreachFollowUpDraftByAttemptId, prepareBacklinkOutreachFollowUpDraft as prepareBacklinkOutreachFollowUpDraftRpc, type BacklinkOutreachFollowUpDraftProjection, type BacklinkOutreachFollowUpDraftRow } from "@/lib/backlinks/repositories/outreachFollowUpDraftsRepository";
import { prepareBacklinkOutreachFollowUpDraft } from "@/lib/backlinks/services/outreachFollowUpDraftService";
import { getBacklinkOutreachReplyTokenKeyring } from "@/lib/backlinks/services/outreachReplyCorrelationIdentity";
import { prepareBacklinkOutreachFollowUp } from "@/lib/backlinks/services/outreachFollowUpPreparationService";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";

type ParseResult = { idempotencyKey: string } | null;

function parse(value: unknown): ParseResult {
  if (typeof value !== "object" || value == null || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (Object.keys(body).length !== 2 || body.confirm !== true || typeof body.idempotencyKey !== "string") return null;
  const idempotencyKey = body.idempotencyKey.trim();
  return idempotencyKey && idempotencyKey.length <= 255 ? { idempotencyKey } : null;
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await getRequestUserAndWorkspace(request);
  if (auth.status === "unauthenticated") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.status === "workspace_forbidden" || !isAdminPrivateEmail(auth.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const input = parse(await request.json().catch(() => null));
  if (!input) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const { id } = await context.params;
  const getTemplateData = async (workspaceId: string, outreach: { campaign_id: string; contact_id: string; opportunity_id: string }) => {
    const [campaign, contact, opportunity] = await Promise.all([
      getBacklinkCampaignById(auth.client, workspaceId, outreach.campaign_id),
      getBacklinkContactById(auth.client, workspaceId, outreach.contact_id),
      getBacklinkOpportunityById(auth.client, workspaceId, outreach.opportunity_id),
    ]);
    const [domain, asset] = await Promise.all([
      getBacklinkDomainById(auth.client, workspaceId, contact.domain_id),
      getBacklinkAssetById(auth.client, workspaceId, opportunity.asset_id),
    ]);
    return {
      campaign: { name: campaign.name, objective: campaign.objective },
      contact: { fullName: contact.full_name, roleTitle: contact.role_title },
      domain: { hostname: domain.hostname },
      opportunity: {
        targetPageTitle: opportunity.target_page_title,
        targetPageUrl: opportunity.target_page_url,
        opportunityType: opportunity.opportunity_type,
        pageType: opportunity.page_type,
        evidenceSummary: opportunity.evidence_summary,
      },
      asset: { displayName: asset.display_name, canonicalUrl: asset.canonical_url },
    };
  };
  const mapDraftRow = (draft: BacklinkOutreachFollowUpDraftRow): BacklinkOutreachFollowUpDraftProjection => ({
    id: draft.id,
    outreachId: draft.outreach_id,
    attemptId: draft.attempt_id,
    followUpNumber: draft.follow_up_number,
    subject: draft.subject,
    body: draft.body,
    preparedAt: draft.prepared_at,
    updatedAt: draft.updated_at,
    updatedBy: draft.updated_by,
  });

  try {
    const prepareDraft = prepareBacklinkOutreachFollowUpDraft({
      getAttempt: (workspaceId, attemptId) => getBacklinkOutreachAttemptById(auth.client, workspaceId, attemptId),
      getOutreach: (workspaceId, outreachId) => getBacklinkOutreachById(auth.client, workspaceId, outreachId),
      listAttempts: (workspaceId, outreachId) => listBacklinkOutreachAttemptsForOutreach(auth.client, workspaceId, outreachId),
      getTemplateData,
      getDraft: async (workspaceId, attemptId) => {
        const draft = await getBacklinkOutreachFollowUpDraftByAttemptId(auth.client, workspaceId, attemptId);
        return draft == null ? null : mapDraftRow(draft);
      },
      prepare: (value) => prepareBacklinkOutreachFollowUpDraftRpc(auth.client, value),
      now: () => new Date().toISOString(),
    });

    const result = await prepareBacklinkOutreachFollowUp({
      reserveAttempt: (value) => reserveBacklinkOutreachFollowUpAttempt(auth.client, value),
      prepareDraft,
      replyTokenKeyring: getBacklinkOutreachReplyTokenKeyring(),
      now: () => new Date().toISOString(),
    })({
      workspaceId: auth.workspace.id,
      actorUserId: auth.user.id,
      outreachId: id,
      idempotencyKey: input.idempotencyKey,
    });

    return NextResponse.json({ ok: true, result });
  } catch {
    return NextResponse.json({ error: "Cette relance ne peut plus être préparée dans l’état actuel." }, { status: 409 });
  }
}
