import assert from "node:assert/strict";

import {
  createBacklinkOutreachReplyAssistantRouteService,
  type BacklinkOutreachReplyAssistantRouteDependencies,
} from "../lib/backlinks/services/outreachReplyAssistantRouteService";
import type { BacklinkRepositoryClient } from "../lib/backlinks/repositories/repositoryClient";
import type { BacklinkOutreachReplyAssistantContext } from "../lib/backlinks/services/outreachReplyAssistant";

async function main() {
  const calls: string[] = [];
  let capturedContext: BacklinkOutreachReplyAssistantContext | null = null;

  const fakeClient = {} as BacklinkRepositoryClient;

  const dependencies = {
    getOutreach: async (_client, workspaceId, outreachId) => {
      calls.push(`outreach:${workspaceId}:${outreachId}`);

      return {
        id: outreachId,
        workspace_id: workspaceId,
        channel: "linkedin",
        campaign_id: "campaign-1",
        opportunity_id: "opportunity-1",
        contact_id: "contact-1",
      } as Awaited<
        ReturnType<BacklinkOutreachReplyAssistantRouteDependencies["getOutreach"]>
      >;
    },

    getCampaign: async (_client, workspaceId, campaignId) => {
      calls.push(`campaign:${workspaceId}:${campaignId}`);

      return {
        id: campaignId,
        workspace_id: workspaceId,
        name: "Norixo backlink campaign",
        objective: "Earn a relevant editorial backlink",
      } as Awaited<
        ReturnType<BacklinkOutreachReplyAssistantRouteDependencies["getCampaign"]>
      >;
    },

    getContact: async (_client, workspaceId, contactId) => {
      calls.push(`contact:${workspaceId}:${contactId}`);

      return {
        id: contactId,
        workspace_id: workspaceId,
        full_name: "Alex Example",
        role_title: "Editor",
      } as Awaited<
        ReturnType<BacklinkOutreachReplyAssistantRouteDependencies["getContact"]>
      >;
    },

    getOpportunity: async (_client, workspaceId, opportunityId) => {
      calls.push(`opportunity:${workspaceId}:${opportunityId}`);

      return {
        id: opportunityId,
        workspace_id: workspaceId,
        domain_id: "domain-1",
        asset_id: "asset-1",
        target_page_title: "Vacation rental guide",
        target_page_url: "https://example.com/guide",
        opportunity_type: "resource_link",
        page_type: "guide",
        evidence_summary: "Relevant resource page for vacation-rental hosts.",
      } as Awaited<
        ReturnType<
          BacklinkOutreachReplyAssistantRouteDependencies["getOpportunity"]
        >
      >;
    },

    getDomain: async (_client, workspaceId, domainId) => {
      calls.push(`domain:${workspaceId}:${domainId}`);

      return {
        id: domainId,
        workspace_id: workspaceId,
        hostname: "example.com",
      } as Awaited<
        ReturnType<BacklinkOutreachReplyAssistantRouteDependencies["getDomain"]>
      >;
    },

    getAsset: async (_client, workspaceId, assetId) => {
      calls.push(`asset:${workspaceId}:${assetId}`);

      return {
        id: assetId,
        workspace_id: workspaceId,
        display_name: "Norixo",
        canonical_url: "https://norixo.io",
      } as Awaited<
        ReturnType<BacklinkOutreachReplyAssistantRouteDependencies["getAsset"]>
      >;
    },

    generateProposal: async (context) => {
      capturedContext = context;

      return {
        proposal: {
          reply: "Thanks for getting back to us.",
          tone: "professional",
          language: "en",
          approvalRequired: true,
          warnings: [],
        },
        providerId: "openai",
        model: "fake-model",
        status: "success",
      };
    },
  } satisfies Partial<BacklinkOutreachReplyAssistantRouteDependencies>;

  const propose = createBacklinkOutreachReplyAssistantRouteService(
    fakeClient,
    dependencies,
  );

  const result = await propose({
    workspaceId: "workspace-1",
    outreachId: "outreach-1",
    inbound: {
      sender: "Alex Example",
      subject: null,
      textBody: "Thanks for reaching out. Can you send me more details?",
    },
  });

  assert.equal(result.status, "success");
  assert.equal(result.proposal.approvalRequired, true);
  assert.equal(result.providerId, "openai");
  assert.equal(result.model, "fake-model");

  assert.deepEqual(calls, [
    "outreach:workspace-1:outreach-1",
    "campaign:workspace-1:campaign-1",
    "contact:workspace-1:contact-1",
    "opportunity:workspace-1:opportunity-1",
    "domain:workspace-1:domain-1",
    "asset:workspace-1:asset-1",
  ]);

  assert.ok(capturedContext);

  const context =
    capturedContext as BacklinkOutreachReplyAssistantContext;

  assert.equal(context.channel, "linkedin");
  assert.equal(context.campaign.name, "Norixo backlink campaign");
  assert.equal(context.contact.fullName, "Alex Example");
  assert.equal(context.contact.roleTitle, "Editor");
  assert.equal(context.domain.hostname, "example.com");
  assert.equal(
    context.opportunity.targetPageUrl,
    "https://example.com/guide",
  );
  assert.equal(context.asset.displayName, "Norixo");
  assert.equal(context.asset.canonicalUrl, "https://norixo.io");
  assert.equal(
    context.inbound.textBody,
    "Thanks for reaching out. Can you send me more details?",
  );

  console.log("PASS — Backlink reply assistant route orchestration smoke");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
