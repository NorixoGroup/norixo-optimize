import { readFile } from "node:fs/promises";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(String(message));
}

async function main(): Promise<void> {
  const source = await readFile("app/(default)/dashboard/backlinks/page.tsx", "utf8");

  // Basic presence
  assert(source.includes("Apply selected memberships"), "Apply button text must be present");
  assert(source.includes("const canShowApplyButton"), "Guard variable for apply button is required");
  assert(source.includes('preview.summary.selected') || source.includes('previewSelected'), "Preview selected extraction must be present");

  // Preview gating
  assert(source.includes('previewKind === "completed"'), "Apply button must be gated by previewKind === 'completed'");

  // Safe extraction of ids
  for (const key of ["previewRunId", "previewTaskId", "previewCampaignId"]) {
    assert(source.includes(key), `Missing safe extraction for ${key}`);
  }

  // Modal open must not fetch
  const openFuncMatch = source.match(/const openCampaignMembershipApplyDialog\s*=\s*\([^)]*\)\s*:\s*void\s*=>\s*\{([\s\S]*?)\}\s*;/m);
  assert(openFuncMatch, "openCampaignMembershipApplyDialog function not found");
  const openFuncBody = openFuncMatch![1];
  assert(openFuncBody.includes("setCampaignMembershipApplyDialogOpen(true)"), "open handler must open the dialog");
  assert(!/fetch\(/.test(openFuncBody), "Opening the confirmation modal must not perform a fetch");
  assert(!/\/api\/internal\/automation\/backlinks\/campaigns\/apply/.test(openFuncBody), "Opening the modal must not reference the apply endpoint");
  assert(!/confirm\s*:\s*true/.test(openFuncBody), "Opening the modal must not include confirm: true");

  // Confirm handler must call the exact endpoint and send only the four safe keys.
  // Use stable source boundaries instead of a fragile nested-generic regex.
  const confirmStart = source.indexOf(
    "const handleConfirmCampaignMembershipApply = async (): Promise<void> => {",
  );
  const confirmEnd = source.indexOf(
    "const handleRunAutomationNow = async (): Promise<void> => {",
    confirmStart,
  );

  assert(confirmStart >= 0, "Confirm handler missing");
  assert(confirmEnd > confirmStart, "Confirm handler end boundary missing");

  const confirmFunc = source.slice(confirmStart, confirmEnd);
  assert(confirmFunc.includes('/api/internal/automation/backlinks/campaigns/apply'), "Confirm handler must call the apply endpoint");
  assert(!/opportunityIds/.test(confirmFunc), "Confirm handler must not send opportunityIds");
  assert(!/workspaceId\b/.test(confirmFunc), "Confirm handler must not send workspaceId");
  assert(/body:\s*JSON\.stringify\(\{([\s\S]*?)\}\)/.test(confirmFunc), "Confirm handler must stringify a JSON body");
  const bodyMatch = confirmFunc.match(/body:\s*JSON\.stringify\(\{([\s\S]*?)\}\)/);
  assert(bodyMatch, "Apply body not found");
  const bodyProperties = bodyMatch[1]
    .split(",")
    .map((property) => property.trim())
    .filter(Boolean);

  const keys = bodyProperties.map((property) => {
    const separatorIndex = property.indexOf(":");
    return separatorIndex >= 0
      ? property.slice(0, separatorIndex).trim()
      : property;
  });

  assert(
    keys.join(",") === ["runId", "taskId", "campaignId", "confirm"].join(","),
    `Apply body keys must be exactly runId,taskId,campaignId,confirm (got: ${keys.join(",")})`,
  );

  assert(
    bodyProperties[3] === "confirm: true",
    "Apply body confirm must be strictly true",
  );

  // Loading and double-click prevention
  assert(source.includes("campaignMembershipApplySubmitting"), "Confirm handler and buttons must use campaignMembershipApplySubmitting guard");
  assert(source.includes("Applying") || source.includes("Applying…") , "Loading text must be present during submission");
  assert(source.includes("campaignApplyRequestIdRef"), "Concurrency guard (request id ref) must be present");

  // Success summary and targeted reload
  assert(source.includes("Selections applied"), "Success summary block must be present");
  assert(source.includes("Reactivated"), "Success summary must show reactivated count");
  assert(source.includes("Created"), "Success summary must show created count");
  assert(source.includes("Existing"), "Success summary must show existing count");
  assert(source.includes("loadCampaignOpportunityMemberships("), "Membership reload must be triggered after apply");

  // No automatic apply after preview.
  // Inspect only the real Preview handler body, not everything before its name.
  const previewHandlerStart = source.indexOf(
    "const handleRunCampaignPreview = async (): Promise<void> => {",
  );
  const previewHandlerEnd = source.indexOf(
    "const campaignPreviewResultRecord =",
    previewHandlerStart,
  );

  assert(previewHandlerStart >= 0, "Campaign Preview handler missing");
  assert(
    previewHandlerEnd > previewHandlerStart,
    "Campaign Preview handler end boundary missing",
  );

  const previewHandlerBody = source.slice(
    previewHandlerStart,
    previewHandlerEnd,
  );

  assert(
    !previewHandlerBody.includes(
      "/api/internal/automation/backlinks/campaigns/apply",
    ),
    "Preview run must not call apply automatically",
  );
  assert(
    !previewHandlerBody.includes("confirm: true"),
    "Preview run must not confirm apply automatically",
  );

  console.log("PASS — Campaign membership apply UI smoke");
}

void main();
