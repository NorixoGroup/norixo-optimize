import { readFile } from "node:fs/promises";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main(): Promise<void> {
  const [preview, dialog] = await Promise.all([
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

  console.log("PASS — Automation backlink discovery intake UI smoke");
}

void main();
