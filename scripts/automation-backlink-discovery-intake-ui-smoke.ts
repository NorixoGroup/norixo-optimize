import { readFile } from "node:fs/promises";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main(): Promise<void> {
  const [page, preview, dialog] = await Promise.all([
    readFile("app/(default)/dashboard/backlinks/page.tsx", "utf8"),
    readFile("app/(default)/dashboard/backlinks/_components/DiscoveryPreview.tsx", "utf8"),
    readFile("app/(default)/dashboard/backlinks/_components/DiscoveryOpportunityIntakeDialog.tsx", "utf8"),
  ]);

  for (const required of [
    "onRequestIntake?:",
    'candidate.intakeEligibility?.status === "eligible" && onRequestIntake',
    "onRequestIntake(candidate)",
    "Ajouter aux opportunités",
  ]) {
    assert(preview.includes(required), `Discovery Preview is missing ${required}`);
  }
  for (const forbidden of ["review_only", "apiRequest", "workspaceId", "requestedBy", "/discovery/apply"]) {
    assert(!preview.includes(forbidden), `Discovery Preview must not contain ${forbidden}`);
  }

  for (const required of [
    'role="dialog"',
    'aria-modal="true"',
    "discovery-opportunity-intake-title",
    "discovery-opportunity-intake-asset",
    "Asset cible",
    "assets.length === 0",
    "submitting || success !== null || !assetId || assets.length === 0",
    'success.opportunityDisposition === "created"',
    'success.domainDisposition === "created"',
    "Opportunité créée avec succès.",
    "Cette opportunité existait déjà et a été réutilisée.",
  ]) {
    assert(dialog.includes(required), `Discovery Intake dialog is missing ${required}`);
  }
  for (const forbidden of ["apiRequest", "workspaceId", "requestedBy", "/discovery/apply"]) {
    assert(!dialog.includes(forbidden), `Discovery Intake dialog must not contain ${forbidden}`);
  }

  for (const required of [
    "const [discoveryIntakeDialog, setDiscoveryIntakeDialog]",
    "const [discoveryIntakeAssetId, setDiscoveryIntakeAssetId] = useState(\"\")",
    "const [discoveryIntakeSubmitting, setDiscoveryIntakeSubmitting] = useState(false)",
    "const [discoveryIntakeError, setDiscoveryIntakeError] = useState<string | null>(null)",
    "const [discoveryIntakeSuccess, setDiscoveryIntakeSuccess]",
    "const openDiscoveryIntakeDialog",
    "result.execution.discoveryPreviewTaskId",
    "candidate.intakeEligibility?.status !== \"eligible\"",
    "const handleConfirmDiscoveryOpportunityIntake",
    "if (discoveryIntakeSubmitting) return",
    "currentRunId !== dialog.runId || currentTaskId !== dialog.taskId",
    "item.candidateKey === dialog.candidateKey",
    "candidate?.intakeEligibility?.status !== \"eligible\"",
    '"/api/internal/automation/backlinks/discovery/apply"',
    "runId: dialog.runId",
    "taskId: dialog.taskId",
    "candidateKey: dialog.candidateKey",
    "assetId: discoveryIntakeAssetId",
    "await reloadOpportunities(requestVersion)",
    "const activeDiscoveryIntakeAssets = pages.assets.items",
    'asset.lifecycle_status === "active"',
    "<DiscoveryOpportunityIntakeDialog",
    "onRequestIntake={openDiscoveryIntakeDialog}",
  ]) {
    assert(page.includes(required), `Discovery Intake parent wiring is missing ${required}`);
  }
  const handlerStart = page.indexOf("const handleConfirmDiscoveryOpportunityIntake");
  const handlerEnd = page.indexOf("const openCampaignMembershipApplyDialog", handlerStart);
  assert(handlerStart !== -1 && handlerEnd !== -1, "Unable to isolate Discovery Intake handler");
  const handler = page.slice(handlerStart, handlerEnd);
  for (const forbidden of [
    "workspaceId:",
    "requestedBy:",
    "hostname:",
    "sourceUrl:",
    "opportunityType:",
    "pageType:",
    "qualifications/apply",
    "promotions/apply",
    "campaigns/apply",
    "outreach",
  ]) {
    assert(!handler.includes(forbidden), `Discovery Intake body or handler must not contain ${forbidden}`);
  }

  console.log("PASS — Automation backlink discovery intake UI smoke");
}

void main();
