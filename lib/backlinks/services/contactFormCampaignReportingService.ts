import type { BacklinkRepositoryClient } from "@/lib/backlinks/repositories/repositoryClient";
import { getCampaign } from "@/lib/backlinks/services/campaignService";
import { getContactFormAutomationHistory } from "@/lib/backlinks/services/contactFormAutomationService";

export type ContactFormCampaignReportItem = {
  outreach_id: string;
  outreach_key: string;
  outreach_status: string;
  approval_state: string;
  run_state: string;
  submit_state: string;
  evidence_state: string;
  delivery_state: "unknown";
  reply_state: "unknown";
  backlink_state: "unknown";
  block_reason: string | null;
  next_action: string;
  updated_at: string | null;
};

export type ContactFormCampaignReport = {
  campaign_id: string;
  generated_at: string;
  semantics: {
    submission_confirmed: string;
    delivery: string;
    reply: string;
    backlink: string;
  };
  summary: {
    total: number;
    approved: number;
    not_approved: number;
    not_queued: number;
    submission_confirmed: number;
    submission_ambiguous: number;
    blocked_captcha: number;
    blocked_policy: number;
    failed_pre_submit: number;
    manual_review: number;
    other_active: number;
  };
  items: ContactFormCampaignReportItem[];
};

export async function getContactFormCampaignReport(
  client: BacklinkRepositoryClient,
  workspaceId: string,
  campaignId: string,
): Promise<ContactFormCampaignReport> {
  const normalizedWorkspaceId = workspaceId.trim();
  const normalizedCampaignId = campaignId.trim();

  if (!normalizedWorkspaceId) throw new Error("Missing workspace id.");
  if (!normalizedCampaignId) throw new Error("Missing campaign id.");

  await getCampaign(client, normalizedWorkspaceId, normalizedCampaignId);

  const { data: outreachRows, error } = await client
    .from("backlink_outreach")
    .select("id,outreach_key,status")
    .eq("workspace_id", normalizedWorkspaceId)
    .eq("campaign_id", normalizedCampaignId)
    .eq("channel", "contact_form")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error != null) throw error;

  const histories = await Promise.all(
    (outreachRows ?? []).map(async (outreach) => ({
      outreach,
      history: await getContactFormAutomationHistory(
        client,
        normalizedWorkspaceId,
        outreach.id,
      ),
    })),
  );

  const items: ContactFormCampaignReportItem[] = histories.map(({ outreach, history }) => ({
    outreach_id: outreach.id,
    outreach_key: outreach.outreach_key,
    outreach_status: outreach.status,
    approval_state: history.dashboard.approval_state,
    run_state: history.dashboard.run_state,
    submit_state: history.dashboard.submit_state,
    evidence_state: history.dashboard.evidence_state,
    delivery_state: "unknown",
    reply_state: "unknown",
    backlink_state: "unknown",
    block_reason: history.dashboard.block_reason,
    next_action: history.dashboard.next_action,
    updated_at: history.dashboard.updated_at,
  }));

  const countRunState = (state: string) =>
    items.filter((item) => item.run_state === state).length;

  const terminalStates = new Set([
    "submission_confirmed",
    "submission_ambiguous",
    "blocked_captcha",
    "blocked_policy",
    "failed_pre_submit",
    "manual_review",
    "not_queued",
  ]);

  return {
    campaign_id: normalizedCampaignId,
    generated_at: new Date().toISOString(),
    semantics: {
      submission_confirmed:
        "Explicit semantic submission evidence observed by the automation only.",
      delivery:
        "Unknown unless independently established by a separate delivery fact source.",
      reply:
        "Unknown unless independently established by a separate reply fact source.",
      backlink:
        "Unknown unless independently established by a separate backlink verification fact source.",
    },
    summary: {
      total: items.length,
      approved: items.filter((item) => item.approval_state === "approved").length,
      not_approved: items.filter((item) => item.approval_state === "not_approved").length,
      not_queued: countRunState("not_queued"),
      submission_confirmed: countRunState("submission_confirmed"),
      submission_ambiguous: countRunState("submission_ambiguous"),
      blocked_captcha: countRunState("blocked_captcha"),
      blocked_policy: countRunState("blocked_policy"),
      failed_pre_submit: countRunState("failed_pre_submit"),
      manual_review: countRunState("manual_review"),
      other_active: items.filter(
        (item) => !terminalStates.has(item.run_state),
      ).length,
    },
    items,
  };
}
