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
    "type AutomationDiscoveryPreviewView",
    "type AutomationQualificationPreviewView",
    "discoveryPreview: AutomationDiscoveryPreviewView | null",
    "qualificationPreview: AutomationQualificationPreviewView | null",
    "lastIssue: {",
    '"pending_retry"',
    '"failed"',
    "const [automationControl, setAutomationControl] = useState<AutomationWorkspaceControlView | null>(null)",
    "const [automationControlLoading, setAutomationControlLoading] = useState(false)",
    "const [automationSaving, setAutomationSaving] = useState(false)",
    "const [automationRunning, setAutomationRunning] = useState(false)",
    "const [automationError, setAutomationError] = useState<string | null>(null)",
    "useState<AutomationTickResultView | null>(null)",
    'useState<"all" | "qualified" | "review" | "rejected">("all")',
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
    "Exécution échouée",
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
    "Candidats Discovery",
    "Provider",
    "Recherches demandées",
    "Résultats reçus",
    "Candidats retenus",
    "Candidats rejetés",
    "Tronqué",
    'target="_blank"',
    'rel="noreferrer"',
    "Rang :",
    "Score technique :",
    "candidate.snippet",
    "candidate.evidenceSummary",
    "slice(0, 10)",
    "candidats supplémentaires non affichés.",
    "Aucune recherche Discovery n’a été demandée.",
    "Aucun candidat Discovery trouvé.",
    "Qualification des candidats",
    "Candidats évalués",
    "Qualifiés",
    "À revoir",
    "Rejetés",
    "Policy version",
    "discoveryCandidatesByKey",
    "candidateKey",
    'aria-pressed={qualificationFilter === filter}',
    "qualificationScore",
    "Confiance :",
    "Décision :",
    "Type d’opportunité :",
    "qualificationPageTypeLabel",
    "Flags :",
    "Impact :",
    "reason.evidence",
    "visibleQualificationResults",
    "filteredQualificationResults.length > 10",
    "résultats supplémentaires non affichés.",
    "Aucun candidat à qualifier.",
    "Aucun résultat pour ce filtre.",
    "Candidat non disponible dans cette session",
    "function automationIssueMessage",
    "BACKLINK_DISCOVERY_PROVIDER_NOT_CONFIGURED",
    "PROVIDER_CONFIGURATION_ERROR",
    "PROVIDER_QUOTA_EXCEEDED",
    "PROVIDER_TRANSIENT_ERROR",
    "PROVIDER_INVALID_RESPONSE",
    "BACKLINK_DISCOVERY_BRAVE_LIMIT_EXCEEDED",
    "AUTOMATION_TASK_HANDLER_FAILED",
    "BACKLINK_QUALIFICATION_DEPENDENCY_NOT_FOUND",
    "Le quota du provider Discovery est atteint.",
    "Le provider Discovery est temporairement indisponible.",
    "La configuration du provider Discovery est invalide.",
    "Le provider Discovery sélectionné n’est pas configuré côté serveur.",
    "Les limites demandées dépassent la configuration serveur Brave.",
    "Une tâche Automation n’a pas pu être exécutée.",
    "function automationIssueTaskLabel",
    "Tâche concernée :",
    "Exécution échouée",
  ]) {
    assert(source.includes(required), `Result UI missing ${required}`);
  }
  assert(!source.includes(">{result.candidateKey}<"), "candidateKey must not be displayed");
  assert(
    !source.includes("Brave Search n’est pas configuré ou disponible côté serveur."),
    "Brave message must not be generic",
  );

  for (const forbidden of [
    "setTimeout",
    "setInterval",
    "polling",
    "cron",
    "localStorage",
    ".stack",
    ".cause",
    "sql",
  ]) {
    assert(!source.includes(forbidden), `Forbidden ${forbidden}`);
  }
  assert((source.match(/fetch\(/g) ?? []).length === 1, "Only apiRequest may fetch");

  console.log("PASS — Automation Backlinks UI smoke");
}

void main();
