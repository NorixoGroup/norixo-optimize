import fs from "fs";
import path from "path";

const p = path.join(process.cwd(), "app/(default)/dashboard/backlinks/page.tsx");
const content = fs.readFileSync(p, "utf8");
if (!content.includes("Prévisualisation de campagne")) {
  console.error("Smoke failed: Campaign Preview UI not found in page.tsx");
  process.exit(2);
}
for (const required of [
  'function readPreviewSelected',
  'const previewSelected = readPreviewSelected(campaignPreviewNestedResult)',
  'const previewTaskId = readNonEmptyString(campaignPreviewNestedResult, "taskId")',
  'const previewRunId = readNonEmptyString(campaignPreviewNestedResult, "runId")',
  'const previewCampaignId = readNonEmptyString(campaignPreviewNestedResult, "campaignId")',
  'const canShowApplyButton',
  'Apply selected memberships',
  'previewKind === "completed"',
  'previewSelected > 0',
]) {
  if (!content.includes(required)) {
    console.error(`Smoke failed: missing ${required} in Campaign Preview UI`);
    process.exit(2);
  }
}

console.log("PASS — Campaign preview UI smoke");
process.exit(0);
