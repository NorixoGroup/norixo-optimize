import assert from "node:assert/strict";
import fs from "node:fs/promises";

const dashboardFile = "app/(default)/dashboard/backlinks/page.tsx";

async function main(): Promise<void> {
  const source = await fs.readFile(dashboardFile, "utf8");

  assert.match(source, /getSharedSession/);
  assert.match(source, /fetch\(path/);
  assert.match(source, /\/api\/backlinks\/opportunities/);
  assert.match(source, /\/api\/backlinks\/campaigns/);
  assert.match(source, /\/api\/backlinks\/outreach/);
  assert.match(source, /\/api\/backlinks\/links/);
  assert.match(source, /activeSection === "campaigns" \? <button type="button" onClick=\{\(\) => openEditor\(activeSection, row\)\} className="rounded-full border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700">Modifier<\/button> : null/);
  assert.match(source, /editor\.section === "campaigns" && editor\.row != null \?/);
  assert.match(source, /Opportunités associées/);
  assert.match(source, /activeCampaignMemberships\.map\(\(membership\) => <div key=\{membership\.opportunity_id\}/);
  assert.match(source, /campaignOpportunityLabel\(membership\.opportunity_id\)/);
  assert.match(source, /openOutreachDraftDialog\(String\(editor\.row\?\.id\), membership\.opportunity_id\)/);
  assert.match(source, /Retirer/);
  assert.match(source, /method: editor\.row == null \? "POST" : "PATCH"/);
  assert.match(source, /Chargement du cockpit Backlinks/);
  assert.match(source, /backlinks nécessitent votre attention/);
  assert.match(source, /link\.status === "lost" \|\| link\.status === "changed"/);
  assert.match(source, /Aucun élément/);
  assert.match(source, /role="alert"/);
  assert.match(source, /role="dialog"/);

  assert.doesNotMatch(
    source,
    /repositories\/|\.from\(|createSupabase|SUPABASE_SERVICE_ROLE_KEY|service_role|\/api\/admin\//,
  );

  console.info("Backlink dashboard smoke passed.");
}

void main();
