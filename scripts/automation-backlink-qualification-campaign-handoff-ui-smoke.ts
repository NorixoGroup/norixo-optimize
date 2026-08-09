import { readFile } from "node:fs/promises";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main(): Promise<void> {
  const page = await readFile("app/(default)/dashboard/backlinks/page.tsx", "utf8");
  const dialog = await readFile("app/(default)/dashboard/backlinks/_components/QualificationBatchApplyDialog.tsx", "utf8");
  for (const required of [
    "recentlyQualifiedOpportunityIds",
    'item.decision === "qualified"',
    'item.disposition === "updated" || item.disposition === "existing"',
    'item.qualificationStatus === "Qualified"',
    "setCampaignPreviewSelectedOpportunityIds(recentlyQualifiedOpportunityIds.slice(0, 50))",
    "handlePrepareCampaignFromQualificationBatch",
    "handleRunCampaignPreview",
  ]) assert(page.includes(required), `Missing ${required}.`);
  assert(dialog.includes("Préparer une campagne"), "Handoff action is required.");
  assert(dialog.includes("handoffCount > 0"), "Handoff action must require qualified opportunities.");
  const handoffStart = page.indexOf("const handlePrepareCampaignFromQualificationBatch");
  const handoffEnd = page.indexOf("const activeCampaignMemberships", handoffStart);
  const handoff = page.slice(handoffStart, handoffEnd);
  for (const forbidden of ["handleRunCampaignPreview()", "handleConfirmCampaignMembershipApply", "Outreach", "apiRequest("]) assert(!handoff.includes(forbidden), `Handoff must not trigger ${forbidden}.`);
  console.log("PASS — Backlink qualification Campaign handoff UI smoke");
}

void main();
