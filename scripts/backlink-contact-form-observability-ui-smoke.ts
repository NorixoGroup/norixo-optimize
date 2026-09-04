import fs from "node:fs";
import assert from "node:assert/strict";

const page = fs.readFileSync(
  "app/(default)/dashboard/backlinks/page.tsx",
  "utf8",
);

const dialog = fs.readFileSync(
  "app/(default)/dashboard/backlinks/_components/OutreachContactFormAutomationDialog.tsx",
  "utf8",
);

assert.match(
  page,
  /row\.channel === "contact_form"[\s\S]{0,500}Suivi formulaire/,
);

assert.match(
  page,
  /openOutreachContactFormAutomation\(row\)/,
);

assert.match(
  page,
  /\/api\/backlinks\/outreach\/\$\{outreach\.id\}\/contact-form/,
);

assert.match(
  page,
  /<OutreachContactFormAutomationDialog/,
);

assert.match(
  dialog,
  /Vue d’observabilité uniquement/,
);

assert.match(
  dialog,
  /n’approuve/,
);

assert.match(
  dialog,
  /n’envoie aucun formulaire/,
);

assert.match(
  dialog,
  /delivery_state/,
);

assert.match(
  dialog,
  /reply_state/,
);

assert.match(
  dialog,
  /backlink_state/,
);

assert.match(
  dialog,
  /Elle ne prouve ni la[\s\S]*livraison au destinataire[\s\S]*ni une réponse[\s\S]*ni la publication[\s\S]*d’un backlink/,
);

for (const forbidden of [
  'method: "POST"',
  'method: "PATCH"',
  'method: "PUT"',
  'method: "DELETE"',
  "onConfirm",
  "Approuver",
  "Mettre en file",
  "Soumettre",
]) {
  assert.equal(
    dialog.includes(forbidden),
    false,
    `forbidden mutation/action found in observability dialog: ${forbidden}`,
  );
}

console.log("BACKLINK_CONTACT_FORM_OBSERVABILITY_UI_SMOKE=PASS");
