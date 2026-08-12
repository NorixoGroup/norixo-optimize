import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function main() {
  const [page, dialog] = await Promise.all([
    readFile("app/(default)/dashboard/backlinks/page.tsx", "utf8"),
    readFile("app/(default)/dashboard/backlinks/_components/OutreachFollowUpPrepareDialog.tsx", "utf8"),
  ]);

  for (const value of [
    "OutreachFollowUpPrepareDialog",
    "outreachFollowUpPrepareDialog",
    "outreachFollowUpPrepareIdempotencyKey",
    "openOutreachFollowUpPrepareDialog",
    "closeOutreachFollowUpPrepareDialog",
    "handlePrepareOutreachFollowUp",
    'outreachFollowUpSummary(row)?.state === "due"',
    'JSON.stringify({ confirm: true, idempotencyKey: outreachFollowUpPrepareIdempotencyKey })',
    "/api/backlinks/outreach/${outreach.id}/follow-up/prepare",
    "Préparer la relance",
    "Relance préparée. Vous pouvez maintenant relire le brouillon avant envoi.",
    "Cette relance ne peut plus être préparée dans l’état actuel.",
    "crypto.randomUUID()",
    "await loadDashboard()",
  ]) {
    assert(page.includes(value), `Missing follow-up prepare UI invariant: ${value}`);
  }

  const followUpBlockStart = page.indexOf("const openOutreachFollowUpPrepareDialog");
  const followUpBlockEnd = page.indexOf("const toggleCampaignPreviewOpportunity", followUpBlockStart);
  const followUpBlock = page.slice(followUpBlockStart, followUpBlockEnd);
  for (const forbidden of ["provider", "scheduler"]) {
    assert(!followUpBlock.includes(forbidden), `Forbidden follow-up prepare behavior: ${forbidden}`);
  }

  for (const value of [
    "role=\"dialog\"",
    "Préparer la relance",
    "Préparer cette relance créera une nouvelle tentative et un brouillon à relire. Aucun email ne sera envoyé.",
    "disabled={submitting}",
  ]) {
    assert(dialog.includes(value), `Missing follow-up prepare dialog invariant: ${value}`);
  }
  for (const forbidden of ["Renvoyer", "Retry", "Resend", "provider", "sendEmail"]) {
    assert(!dialog.includes(forbidden), `Forbidden dialog content: ${forbidden}`);
  }

  console.log("PASS — Backlink follow-up prepare UI smoke");
}

void main();
