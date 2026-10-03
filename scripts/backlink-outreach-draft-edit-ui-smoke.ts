import { readFile } from "node:fs/promises";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function main() {
  const [page, dialog] = await Promise.all([
    readFile("app/(default)/dashboard/backlinks/page.tsx", "utf8"),
    readFile("app/(default)/dashboard/backlinks/_components/OutreachDraftEditDialog.tsx", "utf8"),
  ]);
  const rowAction = 'activeSection === "outreach" && row.status === "draft" && row.channel === "email" ? <button type="button" onClick={() => void openOutreachDraftEditDialog(row)}';
  for (const value of [
    "openOutreachDraftEditDialog",
    "setOutreachDraftEditContactId(contactId)",
    "setOutreachDraftEditChannel(channel)",
    "setOutreachDraftEditSubject",
    "setOutreachDraftEditBody",
    "/api/backlinks/outreach/${outreachDraftEditDialog.id}/draft",
    "await loadDashboard()",
    "outreachDraftEditSubmitting",
  ]) assert(page.includes(value), `Missing ${value}`);
  assert(dialog.includes("Modifier le brouillon"), "Draft editor dialog must expose its title.");
  assert(!page.includes('pages.outreach.items.filter((outreach) => outreach.status === "draft" && outreach.channel === "email")'), "Global draft-message action must be absent.");
  assert(page.includes(rowAction), "Only email drafts must expose the row message editor action.");
  assert(page.includes(">Modifier le message</button>"), "Row message editor action label must be explicit.");
  assert(page.includes('onClick={() => openEditor(activeSection, row)}'), "Generic edit action must remain unchanged.");
  assert(page.includes("setOutreachReadyDialog(row)"), "Ready action must remain unchanged.");
  assert(page.includes('JSON.stringify({ subject: outreachDraftEditSubject || null, body: outreachDraftEditBody || null, contactId: outreachDraftEditContactId, channel: outreachDraftEditChannel })'), "PATCH payload must be exact.");
  for (const forbidden of ["Send", "Ready", "template", "apiRequest"]) assert(!dialog.includes(forbidden), `Forbidden UI ${forbidden}`);
  console.log("PASS — Backlink outreach draft edit UI smoke");
}

void main();
