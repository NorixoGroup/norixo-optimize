import { displayValue } from "./backlink-formatters";
import { isRecord } from "./backlink-preview-utils";

export function assetLifecycleStatusLabel(value: string | number | boolean | null | undefined): string {
  if (typeof value !== "string") return "Statut inconnu";
  switch (value) {
    case "draft":
      return "Brouillon";
    case "eligible":
      return "Éligible";
    case "active":
      return "Actif";
    case "paused":
      return "En pause";
    case "archived":
      return "Archivé";
    default:
      return "Statut inconnu";
  }
}

export function qualificationDecisionLabel(decision: string): string {
  return decision === "qualified" ? "Qualifié" : decision === "review" ? "À revoir" : "Rejeté";
}

export function qualificationConfidenceLabel(confidence: string): string {
  return confidence === "low" ? "Faible" : "Moyenne";
}

export function qualificationPageTypeLabel(pageType: string): string {
  const labels: Record<string, string> = {
    resource_page: "Page de ressources",
    guide: "Guide",
    tools_list: "Liste d’outils",
    comparison: "Comparatif",
    directory: "Annuaire",
    blog_post: "Article de blog",
    support_page: "Page de support",
    unknown: "Type inconnu",
  };
  return labels[pageType] ?? "Type inconnu";
}

export function promotionSkipCodeLabel(skipCode: string): string {
  const labels: Record<string, string> = {
    QUALIFICATION_NOT_INCLUDED: "Qualification non incluse",
    QUALIFICATION_REJECTED: "Qualification rejetée",
    QUALIFICATION_REVIEW_REQUIRED: "Revue humaine requise",
    DISCOVERY_CANDIDATE_NOT_FOUND: "Candidat Discovery introuvable",
    DUPLICATE_CANDIDATE: "Candidat en double",
    DUPLICATE_URL: "URL en double",
    UNSUPPORTED_OPPORTUNITY_TYPE: "Type d’opportunité non supporté",
    UNSUPPORTED_PAGE_TYPE: "Type de page non supporté",
    MISSING_PAGE_TITLE: "Titre de page manquant",
    MISSING_ASSET_SUGGESTION: "Asset suggéré manquant",
    INSUFFICIENT_PROMOTION_EVIDENCE: "Preuves insuffisantes",
    PROPOSAL_LIMIT_REACHED: "Limite de propositions atteinte",
  };
  return labels[skipCode] ?? "Motif de promotion non reconnu";
}

export function automationIssueMessage(issue: unknown): string {
  if (issue === null) return "Une tâche Automation n’a pas pu être exécutée.";
  if (!isRecord(issue)) return "Une tâche Automation n’a pas pu être exécutée.";
  const messages: Record<string, string> = {
    BACKLINK_DISCOVERY_PROVIDER_NOT_CONFIGURED: "Le provider Discovery sélectionné n’est pas configuré côté serveur.",
    PROVIDER_CONFIGURATION_ERROR: "La configuration du provider Discovery est invalide.",
    PROVIDER_QUOTA_EXCEEDED: "Le quota du provider Discovery est atteint. Réessayez après réinitialisation du quota.",
    PROVIDER_TRANSIENT_ERROR: "Le provider Discovery est temporairement indisponible.",
    PROVIDER_INVALID_RESPONSE: "Le provider Discovery a renvoyé une réponse invalide.",
    BACKLINK_DISCOVERY_BRAVE_LIMIT_EXCEEDED: "Les limites demandées dépassent la configuration serveur Brave.",
    AUTOMATION_TASK_HANDLER_FAILED: "Une tâche Automation a échoué pendant son exécution.",
    BACKLINK_QUALIFICATION_TASK_INVALID: "La tâche Qualification est invalide.",
    BACKLINK_QUALIFICATION_DEPENDENCY_NOT_FOUND: "La dépendance Discovery de Qualification est introuvable.",
    BACKLINK_QUALIFICATION_DEPENDENCY_NOT_COMPLETED: "La dépendance Discovery doit être terminée avant Qualification.",
    BACKLINK_QUALIFICATION_DEPENDENCY_OUTPUT_INVALID: "Le résultat Discovery nécessaire à Qualification est invalide.",
  };
  const record =
    typeof issue === "object" && issue !== null
      ? issue as Record<string, unknown>
      : null;
  const code =
    record !== null && typeof record.code === "string"
      ? record.code
      : undefined;
  const message =
    record !== null && typeof record.message === "string"
      ? record.message
      : "";
  return messages[code as string] ?? (message.trim() || "Une tâche Automation n’a pas pu être exécutée.");
}

export function automationIssueTaskLabel(taskKind: string): string {
  if (taskKind === "backlinks.discovery.preview") return "Discovery";
  if (taskKind === "backlinks.qualification.preview") return "Qualification";
  return "Automation";
}

export function outreachStatusLabel(status: string | number | boolean | null | undefined) {
  const labels: Record<string, string> = { draft: "Brouillon", ready: "Prêt", active: "Actif", replied: "Réponse reçue", conversation_open: "Conversation ouverte", declined: "Refusé", no_response: "Sans réponse", paused: "En pause", closed: "Clôturé" };
  return labels[String(status)] ?? displayValue(status).replaceAll("_", " ");
}

export function outreachStatusVariant(status: string | number | boolean | null | undefined) {
  const variants: Record<string, string> = { draft: "bg-slate-100 text-slate-700", ready: "bg-emerald-50 text-emerald-700", active: "bg-sky-50 text-sky-700", replied: "bg-teal-50 text-teal-700", conversation_open: "bg-violet-50 text-violet-700", declined: "bg-rose-50 text-rose-700", no_response: "bg-slate-50 text-slate-500", paused: "bg-amber-50 text-amber-700", closed: "bg-slate-200 text-slate-700" };
  return variants[String(status)] ?? "bg-slate-100 text-slate-700";
}

export function outreachChannelLabel(channel: string | number | boolean | null | undefined) {
  const labels: Record<string, string> = { email: "Email", linkedin: "LinkedIn", contact_form: "Formulaire de contact", slack: "Slack", discord: "Discord", reddit: "Reddit", other: "Autre" };
  return labels[String(channel)] ?? displayValue(channel).replaceAll("_", " ");
}

export function outreachResponseLabel(response: string | number | boolean | null | undefined) {
  const labels: Record<string, string> = { positive: "Positive", negative: "Négative", neutral: "Neutre", bounced: "Adresse invalide", unsubscribed: "Désinscription" };
  return response == null ? "—" : labels[String(response)] ?? displayValue(response).replaceAll("_", " ");
}

export function linkStatusLabel(status: string | number | boolean | null | undefined) {
  const labels: Record<string, string> = { active: "Actif", pending_verification: "En attente", lost: "Perdu", removed: "Supprimé" };
  return labels[String(status)] ?? displayValue(status).replaceAll("_", " ");
}

export function linkStatusVariant(status: string | number | boolean | null | undefined) {
  const variants: Record<string, string> = { active: "bg-emerald-50 text-emerald-700", pending_verification: "bg-sky-50 text-sky-700", lost: "bg-rose-50 text-rose-700", removed: "bg-slate-200 text-slate-700" };
  return variants[String(status)] ?? "bg-slate-100 text-slate-700";
}

export function relTypeBadges(relType: string | number | boolean | null | undefined) {
  const labels: Record<string, string> = { dofollow: "DoFollow", nofollow: "NoFollow", ugc: "UGC", sponsored: "Sponsored" };
  if (relType == null || String(relType).trim() === "") return ["—"];
  return String(relType).trim().split(/[\s,]+/).map((value) => labels[value.toLowerCase()] ?? value.replaceAll("_", " "));
}
