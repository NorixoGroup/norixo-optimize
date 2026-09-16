import assert from "node:assert/strict";
import fs from "node:fs";

const dialogPath =
  "app/(default)/dashboard/backlinks/_components/OutreachLinkedInInteractionDialog.tsx";
const pagePath =
  "app/(default)/dashboard/backlinks/page.tsx";

const dialog = fs.readFileSync(dialogPath, "utf8");
const page = fs.readFileSync(pagePath, "utf8");

for (const marker of [
  'state === "message_sent"',
  "Réponse reçue sur LinkedIn",
  "<textarea",
  "inboundText",
  "Proposer une réponse avec l’IA",
  "/reply-assistant",
  "textBody",
  "approvalRequired !== true",
  "Proposition uniquement",
  'confirmReply("positive")',
  'confirmReply("negative")',
  'postInteraction("reply-confirmed"',
  "Norixo n’envoie rien automatiquement.",
]) {
  assert.ok(dialog.includes(marker), `missing dialog marker: ${marker}`);
}

for (const marker of [
  'row.channel === "linkedin"',
  'row.status === "draft"',
  'row.status === "active"',
  'row.status === "replied"',
  'row.status === "declined"',
]) {
  assert.ok(page.includes(marker), `missing page gate marker: ${marker}`);
}

assert.ok(
  !dialog.includes("api.linkedin.com"),
  "dialog must not call LinkedIn API",
);

assert.ok(
  !dialog.includes("linkedin.com/messaging"),
  "dialog must not use LinkedIn messaging transport",
);

assert.ok(
  dialog.indexOf("/reply-assistant") !==
    dialog.indexOf("/linkedin-interactions/reply-confirmed"),
  "AI proposal and lifecycle confirmation must remain separate actions",
);

console.log(
  "PASS — LinkedIn manual inbound + AI proposal UI smoke",
);
