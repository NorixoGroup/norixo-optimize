import { readFile } from "node:fs/promises";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main(): Promise<void> {
  const page = await readFile("app/(default)/dashboard/backlinks/page.tsx", "utf8");
  const preview = await readFile("app/(default)/dashboard/backlinks/_components/QualificationPreview.tsx", "utf8");
  const dialog = await readFile("app/(default)/dashboard/backlinks/_components/QualificationBatchApplyDialog.tsx", "utf8");
  for (const value of [
    "qualificationBatchSelectedCandidateKeys",
    "qualificationBatchSubmitting",
    "qualificationBatchError",
    "qualificationBatchResult",
    'result.decision !== "qualified"',
    'opportunity.qualification_status === "Blocked"',
    'opportunity.qualification_status === "Not Suitable"',
    "mappings.length !== 1",
    "slice(0, 50)",
    '"/api/internal/automation/backlinks/qualifications/batch-apply"',
    "JSON.stringify({ runId, taskId, opportunityIds, confirm: true })",
    "await reloadOpportunities(requestVersion)",
    'item.disposition === "failed"',
  ]) assert(page.includes(value), `Missing ${value}.`);
  for (const value of [
    "batchEligibleCandidateKeys.has(result.candidateKey)",
    "Sélectionner les qualifiables",
    "Appliquer la sélection",
    "onToggleBatchCandidate",
  ]) assert(preview.includes(value), `Missing ${value}.`);
  for (const value of ["Mises à jour", "Déjà appliquées", "Non applicables", "Échecs", "Application partielle"]) assert(dialog.includes(value), `Missing ${value}.`);
  assert(!page.includes("body: JSON.stringify({ runId, taskId, opportunityIds, candidateKey"), "candidateKey must not be sent in the batch payload.");
  console.log("PASS — Backlink qualification batch UI smoke");
}

void main();
