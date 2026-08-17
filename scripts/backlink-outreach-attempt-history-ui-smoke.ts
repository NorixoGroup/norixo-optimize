import { readFile } from "node:fs/promises";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function main() {
  const [page, dialog] = await Promise.all([
    readFile("app/(default)/dashboard/backlinks/page.tsx", "utf8"),
    readFile("app/(default)/dashboard/backlinks/_components/OutreachAttemptHistoryDialog.tsx", "utf8"),
  ]);

  const start = page.indexOf("const openOutreachAttemptHistory");
  const handler = page.slice(start, page.indexOf("const closeOutreachAttemptHistory", start));

  for (const value of [
    "Historique",
    "openOutreachAttemptHistory",
    "/api/backlinks/outreach/${outreach.id}/attempts",
    "setOutreachAttemptHistoryLoading(true)",
    "setOutreachAttemptHistoryAttempts",
    "setOutreachAttemptHistoryDeliveryEvents",
    "deliveryEvents: OutreachDeliveryEventHistoryItem[]",
    "closeOutreachAttemptHistory",
    "terminalSuccess={outreachAttemptHistoryDialog.status === \"closed\" && outreachAttemptHistoryDialog.stop_reason === \"backlink_obtained\" ? {",
    "statusLabel: \"Clôturé\"",
    "resultLabel: \"Backlink obtenu\"",
    "closedAtLabel: formatDate(outreachAttemptHistoryDialog.closed_at)",
    "linkStatusLabel(link.status)",
  ]) assert(page.includes(value), `Missing ${value}`);

  for (const forbidden of ["method: \"POST\"", "method: \"PATCH\"", "method: \"DELETE\"", "idempotencyKey", "retry", "resolve", "resend", "/api/backlinks/outreach/${outreach.id}/links"]) {
    assert(!handler.includes(forbidden), `Forbidden history handler behavior: ${forbidden}`);
  }

  for (const value of [
    "Résultat de l’outreach",
    "Statut :",
    "Résultat :",
    "Clôturé le :",
    "Backlink",
    "URL cible",
    "Statut du lien",
    "Chargement…",
    "Aucune tentative d’envoi.",
    "En cours",
    "Accepté",
    "Échec",
    "Statut incertain",
    "Ne renvoyez pas automatiquement le message.",
    "attempt.recipient",
    "attempt.provider",
    "attempt.providerMessageId",
    "attempt.errorCode",
    "attempt.status === \"unknown\"",
    "onRequestResolve(attempt)",
    "Résoudre",
    "Événements de livraison",
    "email.delivered",
    "Livré",
    "Livraison retardée",
    "Rejeté / Bounce",
    "Plainte signalée",
    "Le fournisseur a signalé un échec de livraison.",
    "Le fournisseur a signalé une plainte liée à cet email.",
    "deliveryEventsByAttempt",
    "event.attemptId",
    "event.occurredAt",
    "Fermer",
  ]) assert(dialog.includes(value), `Missing dialog ${value}`);

  for (const forbidden of ["idempotencyKey", "actorUserId", "workspaceId", "providerEventId", "Retry", "Envoyer", "fetch(", "apiRequest"]) {
    assert(!dialog.includes(forbidden), `Forbidden dialog ${dialog}`);
  }

  console.log("PASS — Backlink outreach attempt history UI smoke");
}

void main();
