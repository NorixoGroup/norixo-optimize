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
  const pageSource = await readFile(
    "app/(default)/dashboard/backlinks/page.tsx",
    "utf8",
  );

  const source = [
    pageSource,
    await readFile(
      "app/(default)/dashboard/backlinks/_utils/backlink-labels.ts",
      "utf8",
    ),
    await readFile(
      "app/(default)/dashboard/backlinks/_components/AssetLifecycleStatusField.tsx",
      "utf8",
    ),
    await readFile(
      "app/(default)/dashboard/backlinks/_components/asset-lifecycle-types.ts",
      "utf8",
    ),
      await readFile(
        "app/(default)/dashboard/backlinks/_components/DiscoveryPreview.tsx",
        "utf8",
      ),
      await readFile(
        "app/(default)/dashboard/backlinks/_components/discovery-preview-types.ts",
        "utf8",
      ),
      await readFile(
        "app/(default)/dashboard/backlinks/_components/PromotionPreview.tsx",
        "utf8",
      ),
      await readFile(
        "app/(default)/dashboard/backlinks/_components/PromotionApplyDialog.tsx",
        "utf8",
      ),
      await readFile(
        "app/(default)/dashboard/backlinks/_components/promotion-preview-types.ts",
        "utf8",
      ),
      await readFile(
        "app/(default)/dashboard/backlinks/_components/AutomationSummary.tsx",
        "utf8",
      ),
      await readFile(
        "app/(default)/dashboard/backlinks/_components/QualificationPreview.tsx",
        "utf8",
      ),
      await readFile(
        "app/(default)/dashboard/backlinks/_components/QualificationApplyDialog.tsx",
        "utf8",
      ),
      await readFile(
        "app/(default)/dashboard/backlinks/_components/CampaignMembershipApplyDialog.tsx",
        "utf8",
      ),
      await readFile(
        "app/(default)/dashboard/backlinks/_components/qualification-preview-types.ts",
        "utf8",
      ),
      await readFile(
        "app/(default)/dashboard/backlinks/_components/AutomationControl.tsx",
        "utf8",
      ),
      await readFile(
        "app/(default)/dashboard/backlinks/_components/OutreachFilters.tsx",
        "utf8",
      ),
  ].join("\n");
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
  const applyHandler = between(
    source,
    "const handleApplyPromotion",
    "const handleRunAutomationNow",
  );

  assert(
    pageSource.indexOf("<AutomationControl") < pageSource.indexOf("Synthèse backlinks"),
    "Automation block must precede summary cards",
  );
  assert(
    pageSource.indexOf("<AutomationControl") < pageSource.indexOf("{editor ?"),
    "Automation block must be outside the editor",
  );
  for (const required of [
    "Dry-run",
    "Mode sécurisé",
    "aucune prise de contact",
    "ni création réelle de backlink",
    "type AutomationWorkspaceControlView",
    "type AutomationWorkspaceControlGetResponse",
    "type AutomationWorkspaceControlPatchResponse",
    "type AutomationTickExecutedView",
    "promotionTaskId: string",
    "type AutomationTickRejectedView",
    "type AutomationDiscoveryPreviewView",
    "type AutomationQualificationPreviewView",
    "type AutomationPromotionPreviewView",
    "discoveryPreview: AutomationDiscoveryPreviewView | null",
    "qualificationPreview: AutomationQualificationPreviewView | null",
    "promotionPreview: AutomationPromotionPreviewView | null",
    "lastIssue: {",
    '"pending_retry"',
    '"failed"',
    "const [automationControl, setAutomationControl] = useState<AutomationWorkspaceControlView | null>(null)",
    "const [automationControlLoading, setAutomationControlLoading] = useState(false)",
    "const [automationSaving, setAutomationSaving] = useState(false)",
    "const [automationRunning, setAutomationRunning] = useState(false)",
    "const [automationError, setAutomationError] = useState<string | null>(null)",
    "useState<AutomationTickResultView | null>(null)",
    "type PromotionApplyDialogState",
    "type PromotionApplyResponse",
    "const [promotionApplyDialog, setPromotionApplyDialog]",
    "const [promotionApplyAssetId, setPromotionApplyAssetId] = useState(\"\")",
    "const [promotionApplySubmitting, setPromotionApplySubmitting] = useState(false)",
    "const [promotionApplyError, setPromotionApplyError] = useState<string | null>(null)",
    "const [promotionApplySuccess, setPromotionApplySuccess]",
    "const [appliedPromotionProposalKeys, setAppliedPromotionProposalKeys]",
    'useState<"all" | "qualified" | "review" | "rejected">("all")',
    'useState<"proposals" | "skipped" | "duplicates">("proposals")',
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
    "setPromotionApplyDialog(null)",
    "setPromotionApplyAssetId(\"\")",
    "setPromotionApplySubmitting(false)",
    "setPromotionApplyError(null)",
    "setPromotionApplySuccess(null)",
    "setAppliedPromotionProposalKeys({})",
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
    "const openPromotionApplyDialog",
    "asset.lifecycle_status === \"active\"",
    "asset.asset_key === proposal.suggestedAssetKey",
    "matchingAsset?.id ?? \"\"",
    "const handleApplyPromotion",
    '"/api/internal/automation/backlinks/promotions/apply"',
    "apiRequest<PromotionApplyResponse>",
    "runId: result.run.id",
    "promotionTaskId: result.promotionTaskId",
    "proposalKey: dialog.proposalKey",
    "assetId: promotionApplyAssetId",
    "workspaceRequestVersionRef.current",
    "await reloadOpportunities(requestVersion)",
    "PROMOTION_ASSET_NOT_FOUND",
    "PROMOTION_ASSET_NOT_ACTIVE",
    "PROMOTION_TASK_NOT_FOUND",
    "PROMOTION_TASK_NOT_COMPLETED",
    "PROMOTION_PROPOSAL_NOT_FOUND",
    "PROMOTION_DOMAIN_ARCHIVED",
    "PROMOTION_APPLICATION_MISMATCH",
  ]) {
    assert(source.includes(required), `Promotion Apply missing ${required}`);
  }
  for (const forbidden of [
    "workspaceId:",
    "actorUserId:",
    "hostname:",
    "targetPageUrl:",
    "opportunityType:",
    "qualificationScore:",
    "suggestedAssetKey:",
  ]) {
    assert(!applyHandler.includes(forbidden), `Apply body must not contain ${forbidden}`);
  }
  const applyBody = applyHandler.match(/body: JSON\.stringify\(\{([\s\S]*?)\}\),/);
  assert(applyBody !== null, "Apply body not found");
  const applyBodyKeys = [...applyBody[1].matchAll(/^\s+(\w+):/gm)].map(
    (match) => match[1],
  );
  assert(
    applyBodyKeys.join(",") ===
      ["runId", "promotionTaskId", "proposalKey", "assetId"].join(","),
    "Apply body must contain exactly four safe fields",
  );
  assert(
    !source.includes("pages.assets.items[0]"),
    "Suggested asset must not default to the first asset",
  );
  assert(
    !source.includes("lifecycleStatus:"),
    "Asset lifecycle request bodies must remain snake_case",
  );
  assert(!source.includes("archived_at:"), "Client must not write archived_at");

  for (const required of [
    "Lancer maintenant",
    "Exécution…",
    "aria-busy={automationRunning}",
    "Exécution terminée",
    "Nouvelle tentative en attente",
    "Exécution échouée",
    "AssetLifecycleStatusField",
    'name="lifecycle_status"',
    'value: "draft", label: "Brouillon"',
    'value: "eligible", label: "Éligible"',
    'value: "active", label: "Actif"',
    'value: "paused", label: "En pause"',
    'value: "archived", label: "Archivé"',
    "assetLifecycleStatusLabel(row.lifecycle_status)",
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
    "Promotion Preview",
    "Résultats Qualification",
    "Éligibles",
    "Propositions",
    "Ignorés",
    "Doublons",
    "Aucune opportunité Backlinks n’a été créée.",
    "Le preview est uniquement une proposition de travail.",
    "promotionFilter",
    'aria-pressed={promotionFilter === filter}',
    "promotionDuplicateItems",
    "promotionSkippedItems",
    "DUPLICATE_CANDIDATE",
    "DUPLICATE_URL",
    "promotionSkipCodeLabel",
    "Aucune proposition de promotion.",
    "Aucun élément ignoré.",
    "Aucun doublon détecté.",
    "Brouillon uniquement",
    "Créer l’opportunité",
    "aria-haspopup=\"dialog\"",
    "Opportunité créée",
    "Opportunité existante",
    "role=\"dialog\"",
    "aria-modal=\"true\"",
    "promotion-apply-title",
    "Asset cible",
    "Sélectionner un asset",
    "Aucun asset actif n’est disponible.",
    "Aucun email ne sera envoyé.",
    "Confirmer la création",
    "Création…",
    "Opportunité créée avec succès.",
    "Cette opportunité existait déjà et a été réutilisée.",
    "Domaine créé automatiquement.",
    "Domaine existant réutilisé.",
    "proposal.targetPageUrl",
    "proposal.opportunityType",
    "proposal.pageType",
    "proposal.priority",
    "proposal.qualificationScore",
    "proposal.qualificationConfidence",
    "proposal.evidenceSummary",
    "proposal.suggestedAssetKey",
    "selectedPromotionSkippedItems.length > 10",
    "éléments supplémentaires non affichés.",
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
    "automationIssueMessage",
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
    "automationIssueTaskLabel",
    "Tâche concernée :",
    "Exécution échouée",
  ]) {
    assert(source.includes(required), `Result UI missing ${required}`);
  }
  assert(!source.includes(">{result.candidateKey}<"), "candidateKey must not be displayed");
  assert(
    !source.includes("{automationLastResult.promotionTaskId}"),
    "promotionTaskId must not be displayed",
  );
  assert(
    !source.includes("setPromotionTaskId"),
    "promotionTaskId must remain inside automationLastResult",
  );
  for (const forbidden of ["sessionStorage", "setPromotionTaskId"]) {
    assert(!source.includes(forbidden), `Forbidden ${forbidden}`);
  }
  assert(
    !source.includes("Brave Search n’est pas configuré ou disponible côté serveur."),
    "Brave message must not be generic",
  );
  assert(
    (source.match(/handleApplyPromotion\(\)/g) ?? []).length === 1,
    "Only the human confirmation may apply a promotion",
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
