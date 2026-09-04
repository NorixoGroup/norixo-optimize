import fs from "node:fs";
import assert from "node:assert/strict";

const page = fs.readFileSync("app/(default)/dashboard/backlinks/page.tsx", "utf8");
const component = fs.readFileSync(
  "app/(default)/dashboard/backlinks/_components/ContactFormCampaignReportDialog.tsx",
  "utf8",
);
const route = fs.readFileSync(
  "app/api/backlinks/campaigns/[id]/contact-form-report/route.ts",
  "utf8",
);
const service = fs.readFileSync(
  "lib/backlinks/services/contactFormCampaignReportingService.ts",
  "utf8",
);

function requireText(source: string, value: string, label: string) {
  if (!source.includes(value)) throw new Error(`Missing ${label}: ${value}`);
}

function forbid(source: string, pattern: RegExp, label: string) {
  if (pattern.test(source)) throw new Error(`Forbidden ${label}: ${pattern}`);
}

function requireSafeSubmissionCompleteLabel(source: string) {
  const match = source.match(/submission_complete:\s*"([^"]+)"/);
  assert.ok(match, "submission_complete next action label is present");
  assert.equal(
    match[1],
    "Soumission confirmée — aucune action automatique suivante",
  );
  assert.doesNotMatch(match[1], /livr|reçu|répon|backlink|obtenu|succès complet/i);
}

requireText(page, "Reporting formulaires", "campaign reporting action");
requireText(page, "openContactFormCampaignReport", "campaign report handler");
requireText(page, "/contact-form-report", "campaign report GET endpoint");
requireText(page, "ContactFormCampaignReportDialog", "campaign report dialog");

requireText(component, "Vue de reporting uniquement", "read-only UI boundary");
requireText(component, "ni la livraison au destinataire", "delivery proof boundary");
requireText(component, "ni une réponse", "reply proof boundary");
requireText(component, "ni la publication d’un backlink", "backlink proof boundary");
requireText(component, "nextActionLabel(item.next_action)", "human-readable next action rendering");
requireSafeSubmissionCompleteLabel(component);

requireText(route, "export async function GET", "GET route");
requireText(route, 'code === "NOT_FOUND"', "404 not-found contract");
requireText(route, "status: 404", "404 response");
forbid(route, /export async function (POST|PUT|PATCH|DELETE)/, "mutation route");

requireText(
  service,
  "await getCampaign(client, normalizedWorkspaceId, normalizedCampaignId);",
  "campaign existence validation",
);
requireText(service, '.eq("workspace_id", normalizedWorkspaceId)', "workspace scope");
requireText(service, '.eq("campaign_id", normalizedCampaignId)', "campaign scope");
requireText(service, '.eq("channel", "contact_form")', "contact form scope");
requireText(service, 'delivery_state: "unknown"', "delivery independence");
requireText(service, 'reply_state: "unknown"', "reply independence");
requireText(service, 'backlink_state: "unknown"', "backlink independence");
requireText(service, 'next_action: history.dashboard.next_action', "report item carries dashboard next action");
requireText(service, 'submission_confirmed: countRunState("submission_confirmed")', "submission confirmed counted separately");
requireText(service, 'manual_review: countRunState("manual_review")', "manual review counted separately");

for (const [label, source] of [
  ["service", service],
  ["route", route],
  ["component", component],
] as const) {
  forbid(source, /approveContactFormInitial/, `${label} approval mutation`);
  forbid(source, /queueContactFormRun/, `${label} queue mutation`);
  forbid(source, /claimNextContactFormRun/, `${label} worker claim`);
  forbid(source, /transitionContactFormRun/, `${label} worker transition`);
  forbid(source, /confirmContactFormSubmission/, `${label} submission mutation`);
  forbid(source, /retryContactFormPreSubmitRun/, `${label} retry mutation`);
}

console.log("BACKLINK_CONTACT_FORM_CAMPAIGN_REPORTING_SMOKE=PASS");
