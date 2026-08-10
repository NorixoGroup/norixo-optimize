import { readFile } from "node:fs/promises";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function main() {
  const [page, historyDialog, resolutionDialog] = await Promise.all([
    readFile("app/(default)/dashboard/backlinks/page.tsx", "utf8"),
    readFile("app/(default)/dashboard/backlinks/_components/OutreachAttemptHistoryDialog.tsx", "utf8"),
    readFile("app/(default)/dashboard/backlinks/_components/OutreachUnknownResolutionDialog.tsx", "utf8"),
  ]);

  const openStart = page.indexOf("const openOutreachUnknownResolutionDialog");
  const openHandler = page.slice(openStart, page.indexOf("const closeOutreachUnknownResolutionDialog", openStart));
  const submitStart = page.indexOf("const handleResolveUnknownAttempt");
  const submitHandler = page.slice(submitStart, page.indexOf("const toggleCampaignPreviewOpportunity", submitStart));
  const payloadStart = submitHandler.indexOf("const payload");
  const payload = submitHandler.slice(payloadStart, submitHandler.indexOf("if (!payload)", payloadStart));

  assert(openStart >= 0 && submitStart >= 0, "Missing Unknown Resolution parent handlers");
  for (const value of [
    "onRequestResolve={openOutreachUnknownResolutionDialog}",
    "outreachUnknownResolutionDialog",
    "outreachUnknownResolutionKind",
    "outreachUnknownProviderMessageId",
    "outreachUnknownErrorCode",
    "outreachUnknownErrorMessage",
    "outreachUnknownSubmitting",
    "outreachUnknownError",
    "outreachUnknownSuccess",
    "<OutreachUnknownResolutionDialog",
  ]) assert(page.includes(value), `Missing parent wiring: ${value}`);

  for (const value of [
    'attempt.status === "unknown"',
    "onRequestResolve",
    "Résoudre",
  ]) assert(historyDialog.includes(value), `Missing History resolve entry point: ${value}`);
  for (const status of ["requested", "accepted", "failed"]) assert(!historyDialog.includes(`attempt.status === "${status}" && onRequestResolve`), `Resolve must be absent for ${status}`);

  for (const value of [
    'currentAttempt?.status !== "unknown"',
    "setOutreachUnknownResolutionDialog(currentAttempt)",
    "setOutreachUnknownResolutionKind(null)",
    "setOutreachUnknownProviderMessageId(currentAttempt.providerMessageId ?? \"\")",
    "setOutreachUnknownErrorCode(currentAttempt.errorCode ?? \"\")",
    "setOutreachUnknownErrorMessage(currentAttempt.errorMessage ?? \"\")",
  ]) assert(openHandler.includes(value), `Missing open behavior: ${value}`);

  for (const value of [
    'outreachUnknownResolutionKind === "accepted"',
    'resolution: "accepted"',
    "providerMessageId: outreachUnknownProviderMessageId.trim() === \"\" ? null : outreachUnknownProviderMessageId.trim()",
    'resolution: "failed"',
    "const errorCode = outreachUnknownErrorCode.trim()",
    "const errorMessage = outreachUnknownErrorMessage.trim()",
    "if (!payload)",
    "setOutreachUnknownSubmitting(true)",
    "JSON.stringify(payload)",
    "/api/backlinks/outreach/${outreach.id}/attempts/${attempt.id}/resolve",
    "await reloadOutreachAttemptHistory(String(outreach.id))",
    "await loadDashboard()",
    '"updated" | "existing" | "reconciled"',
  ]) assert(submitHandler.includes(value), `Missing submit behavior: ${value}`);
  for (const forbidden of ["workspaceId", "actorUserId", "idempotencyKey", "recipient", "provider", "channel", "subject", "body", "status", "outreachId", "attemptId"]) assert(!new RegExp(`\\b${forbidden}\\s*:`).test(payload), `Forbidden Resolve payload field: ${forbidden}`);
  for (const forbidden of ["/send", "crypto.randomUUID", "Resend", "outreachEmailProvider", "Retry", "Resend", "createBacklinkOutreachAttempt"]) assert(!submitHandler.includes(forbidden), `Forbidden Resolve UI behavior: ${forbidden}`);

  for (const value of [
    "Confirmer comme envoyé",
    "Confirmer comme échoué",
    "Provider message ID (optionnel)",
    "Code d’erreur",
    "Message d’erreur",
    "Cette action ne renverra aucun email.",
    "Cette tentative a été confirmée comme envoyée.",
    "Cette tentative a été confirmée comme échouée.",
    "L’état de l’Outreach a été réconcilié.",
  ]) assert(resolutionDialog.includes(value), `Missing Resolution dialog content: ${value}`);
  for (const forbidden of ["fetch(", "apiRequest", "Envoyer", "Renvoyer", "Réessayer", "Retry", "Resend", "idempotencyKey", "outreachEmailProvider"]) assert(!resolutionDialog.includes(forbidden), `Forbidden Resolution dialog behavior: ${forbidden}`);

  console.log("PASS — Backlink outreach unknown resolution UI smoke");
}

void main();
