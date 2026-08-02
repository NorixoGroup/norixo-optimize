import { readFile } from "node:fs/promises";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function between(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);
  assert(startIndex !== -1 && endIndex !== -1, `Unable to read ${start}`);
  return source.slice(startIndex, endIndex);
}

async function main(): Promise<void> {
  const source = await readFile(
    "app/(default)/dashboard/backlinks/page.tsx",
    "utf8",
  );
  const controlLoader = between(
    source,
    "const loadAutomationControl",
    "const loadCampaignOpportunityMemberships",
  );
  const toggleHandler = between(
    source,
    "const handleToggleAutomation",
    "const handleRunAutomationNow",
  );
  const runHandler = between(
    source,
    "const handleRunAutomationNow",
    "const activeCampaignMemberships",
  );

  assert(source.indexOf("Automation Backlinks") < source.indexOf("Synthèse backlinks"), "Automation block must precede summary cards");
  assert(source.indexOf("Automation Backlinks") < source.indexOf("{editor ?"), "Automation block must be outside the editor");
  for (const required of [
    "Dry-run",
    "Mode sécurisé",
    "aucune prise de contact",
    "ni création réelle de backlink",
    "type AutomationWorkspaceControlView",
    "type AutomationWorkspaceControlGetResponse",
    "type AutomationWorkspaceControlPatchResponse",
    "type AutomationTickExecutedView",
    "type AutomationTickRejectedView",
    '"pending_retry"',
    '"failed"',
    "const [automationControl, setAutomationControl] = useState<AutomationWorkspaceControlView | null>(null)",
    "const [automationControlLoading, setAutomationControlLoading] = useState(false)",
    "const [automationSaving, setAutomationSaving] = useState(false)",
    "const [automationRunning, setAutomationRunning] = useState(false)",
    "const [automationError, setAutomationError] = useState<string | null>(null)",
    "useState<AutomationTickResultView | null>(null)",
  ]) {
    assert(source.includes(required), `Missing ${required}`);
  }

  for (const required of [
    '"/api/internal/automation/workspace-control"',
    "apiRequest<AutomationWorkspaceControlGetResponse>",
    "workspaceRequestVersionRef.current",
    "Impossible de charger les paramètres d’automatisation.",
    "setAutomationControl(response.control)",
  ]) {
    assert(controlLoader.includes(required), `Control loader missing ${required}`);
  }
  assert(!controlLoader.includes("workspaceId:"), "Control loader must not send workspaceId");

  for (const required of [
    'method: "PATCH"',
    "backlinksEnabled: !automationControl.backlinksEnabled",
    "apiRequest<AutomationWorkspaceControlPatchResponse>",
    "workspaceRequestVersionRef.current",
    "setAutomationControl(response.control)",
    "Impossible de modifier l’automatisation.",
  ]) {
    assert(toggleHandler.includes(required), `Toggle handler missing ${required}`);
  }
  assert(!toggleHandler.includes("workspaceId:"), "Toggle must not send workspaceId");
  assert(!toggleHandler.includes("dryRunOnly"), "Toggle must not send dryRunOnly");
  assert(
    toggleHandler.indexOf("const response = await") < toggleHandler.indexOf("setAutomationControl(response.control)"),
    "Toggle must not update optimistically",
  );

  for (const required of [
    "setAutomationControl(null)",
    "setAutomationControlLoading(false)",
    "setAutomationSaving(false)",
    "setAutomationRunning(false)",
    "setAutomationError(null)",
    "setAutomationLastResult(null)",
    "workspaceRequestVersionRef.current += 1",
  ]) {
    assert(source.includes(required), `Workspace change reset missing ${required}`);
  }

  for (const required of [
    '"/api/internal/automation/backlinks/tick"',
    'method: "POST"',
    "const idempotencyKey = `manual-ui:${crypto.randomUUID()}`",
    "const scheduledAt = new Date().toISOString()",
    "discoveryInput:",
    'source: "manual_dashboard"',
    'requestedScope: "preview"',
    "qualificationInput:",
    "setAutomationLastResult(response.result)",
    "Impossible de lancer l’automatisation.",
  ]) {
    assert(runHandler.includes(required), `Run handler missing ${required}`);
  }
  for (const forbidden of [
    "workspaceId:",
    "requestedBy:",
    "workerId:",
    "triggerSource:",
    "leaseDurationSeconds:",
    "maxWorkerInvocations:",
    "startedAt:",
    "attemptedAt:",
    "completedAt:",
    "failedAt:",
    "mode:",
    "system:",
    "runKind:",
  ]) {
    assert(!runHandler.includes(forbidden), `Run payload must not contain ${forbidden}`);
  }
  assert((runHandler.match(/new Date\(\)\.toISOString\(\)/g) ?? []).length === 1, "Run must create exactly one scheduledAt date");

  for (const required of [
    "Lancer maintenant",
    "Exécution…",
    "aria-busy={automationRunning}",
    "Exécution terminée",
    "Nouvelle tentative en attente",
    "Exécution terminée avec échec",
    "L’automatisation est désactivée pour ce workspace.",
    "Le mode dry-run est obligatoire.",
    "workerInvocations",
    "completedTasks",
    "retriedTasks",
    "deadLetterTasks",
    "stoppedBecause",
    "File vide",
    "Limite d’invocations atteinte",
    "Dernière exécution de cette session",
  ]) {
    assert(source.includes(required), `Result UI missing ${required}`);
  }

  for (const forbidden of [
    "setTimeout",
    "setInterval",
    "polling",
    "cron",
    "localStorage",
    ".stack",
    ".cause",
    "sql",
    "provider",
  ]) {
    assert(!source.includes(forbidden), `Forbidden ${forbidden}`);
  }
  assert((source.match(/fetch\(/g) ?? []).length === 1, "Only apiRequest may fetch");

  console.log("PASS — Automation Backlinks UI smoke");
}

void main();
