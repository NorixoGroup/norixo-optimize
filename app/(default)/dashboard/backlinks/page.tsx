"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  assetLifecycleStatusLabel,
  qualificationDecisionLabel,
  promotionSkipCodeLabel,
  automationIssueMessage,
  automationIssueTaskLabel,
  outreachStatusLabel,
  outreachStatusVariant,
  outreachChannelLabel,
  outreachResponseLabel,
  linkStatusLabel,
  linkStatusVariant,
  relTypeBadges,
} from "./_utils/backlink-labels";

import { displayValue, formatDate, inputValue } from "./_utils/backlink-formatters";

import { isRecord, readNonEmptyString, readPreviewSelected, readPreviewRequestedLimits } from "./_utils/backlink-preview-utils";

import { getSharedSession } from "@/lib/supabase/sharedAuth";
import { getStoredWorkspaceId } from "@/lib/workspaces/getStoredWorkspaceId";
import AssetLifecycleStatusField from "./_components/AssetLifecycleStatusField";
import DiscoveryPreview from "./_components/DiscoveryPreview";
import PromotionPreview from "./_components/PromotionPreview";
import AutomationControl from "./_components/AutomationControl";
import type { AutomationPromotionPreviewView } from "./_components/promotion-preview-types";
import type { BacklinkAssetLifecycleStatus } from "./_components/asset-lifecycle-types";
import { isBacklinkAssetLifecycleStatus } from "./_components/asset-lifecycle-types";
import AutomationSummary from "./_components/AutomationSummary";
import QualificationPreview from "./_components/QualificationPreview";
import CampaignPreview from "./_components/CampaignPreview";
import PromotionApplyDialog from "./_components/PromotionApplyDialog";
import DiscoveryOpportunityIntakeDialog from "./_components/DiscoveryOpportunityIntakeDialog";
import QualificationApplyDialog from "./_components/QualificationApplyDialog";
import QualificationBatchApplyDialog from "./_components/QualificationBatchApplyDialog";
import CampaignMembershipApplyDialog from "./_components/CampaignMembershipApplyDialog";
import OutreachFilters from "./_components/OutreachFilters";
import LinkFilters from "./_components/LinkFilters";
import OutreachDraftPreparationDialog from "./_components/OutreachDraftPreparationDialog";
import OutreachDraftEditDialog from "./_components/OutreachDraftEditDialog";
import OutreachFollowUpPrepareDialog from "./_components/OutreachFollowUpPrepareDialog";
import OutreachFollowUpDraftDialog, { type OutreachFollowUpDraftDialogDraft } from "./_components/OutreachFollowUpDraftDialog";
import OutreachReadyDialog from "./_components/OutreachReadyDialog";
import OutreachFinalNoResponseDialog from "./_components/OutreachFinalNoResponseDialog";
import OutreachSendDialog from "./_components/OutreachSendDialog";
import OutreachAttemptHistoryDialog, { type OutreachAttemptHistoryItem, type OutreachDeliveryEventHistoryItem } from "./_components/OutreachAttemptHistoryDialog";
import OutreachUnknownResolutionDialog from "./_components/OutreachUnknownResolutionDialog";
import OutreachResponseDialog from "./_components/OutreachResponseDialog";
import OutreachLifecycleActionDialog from "./_components/OutreachLifecycleActionDialog";
import OutreachInboundRepliesDialog, { type OutreachInboundReplyItem, type OutreachInboundReplyConfirmation } from "./_components/OutreachInboundRepliesDialog";
import type { AutomationQualificationPreviewView } from "./_components/qualification-preview-types";
import type { AutomationDiscoveryPreviewView } from "./_components/discovery-preview-types";

type BacklinkSection = "opportunities" | "campaigns" | "outreach" | "links" | "assets" | "domains" | "contacts";
type ApiRow = Record<string, string | number | boolean | null> & { id: string };
function inboundReplySummary(row: Record<string, unknown>) { const value = row.inboundReplySummary; if (typeof value !== "object" || value == null || Array.isArray(value)) return { correlatedCount: 0, unclassifiedCount: 0, latestReceivedAt: null }; const summary = value as { correlatedCount?: unknown; unclassifiedCount?: unknown; latestReceivedAt?: unknown }; return { correlatedCount: typeof summary.correlatedCount === "number" && summary.correlatedCount > 0 ? summary.correlatedCount : 0, unclassifiedCount: typeof summary.unclassifiedCount === "number" && summary.unclassifiedCount > 0 ? summary.unclassifiedCount : 0, latestReceivedAt: typeof summary.latestReceivedAt === "string" ? summary.latestReceivedAt : null }; }
type ApiPage = { items: ApiRow[]; total: number };
type OutreachAttemptSummary = { latestStatus: "prepared" | "requested" | "accepted" | "failed" | "unknown" | null; hasOpenAttempt: boolean };
type OutreachFollowUpSummary = { state: "none" | "scheduled" | "due" | "prepared" | "requested" | "unknown" | "final_response"; nextFollowUpAt: string | null; responseDeadlineAt: string | null; attemptId: string | null; finalNoResponseEligible: boolean };
type OutreachSendMode = "initial_send" | "failed_retry";
type OutreachLifecycleAction = "mark_no_response" | "open_conversation" | "mark_backlink_obtained" | "close";
type CampaignOpportunityMembership = { campaign_id: string; opportunity_id: string; membership_status: string };
type OutreachFollowUpDraftState = { outreach: ApiRow; attemptId: string; draft: OutreachFollowUpDraftDialogDraft | null };
type OutreachEligibilityContact = { contactId: string; label: string; eligibleChannels: ("email" | "linkedin" | "contact_form")[] };
type OutreachContactRow = { id: string; email_normalized: string | null; contact_status: string };

function outreachAttemptSummary(row: ApiRow): OutreachAttemptSummary | null { const value: unknown = row.attemptSummary; if (typeof value !== "object" || value == null || !("latestStatus" in value) || !("hasOpenAttempt" in value)) return null; const { latestStatus, hasOpenAttempt } = value; return (latestStatus === null || latestStatus === "prepared" || latestStatus === "requested" || latestStatus === "accepted" || latestStatus === "failed" || latestStatus === "unknown") && typeof hasOpenAttempt === "boolean" ? { latestStatus, hasOpenAttempt } : null; }
function outreachFollowUpSummary(row: ApiRow): OutreachFollowUpSummary | null { const value: unknown = row.followUpSummary; if (typeof value !== "object" || value == null || !("state" in value) || !("nextFollowUpAt" in value) || !("responseDeadlineAt" in value) || !("attemptId" in value) || !("finalNoResponseEligible" in value)) return null; const summary = value as { state?: unknown; nextFollowUpAt?: unknown; responseDeadlineAt?: unknown; attemptId?: unknown; finalNoResponseEligible?: unknown }; return (summary.state === "none" || summary.state === "scheduled" || summary.state === "due" || summary.state === "prepared" || summary.state === "requested" || summary.state === "unknown" || summary.state === "final_response") && (typeof summary.nextFollowUpAt === "string" || summary.nextFollowUpAt === null) && (typeof summary.responseDeadlineAt === "string" || summary.responseDeadlineAt === null) && (typeof summary.attemptId === "string" || summary.attemptId === null) && typeof summary.finalNoResponseEligible === "boolean" ? { state: summary.state, nextFollowUpAt: summary.nextFollowUpAt, responseDeadlineAt: summary.responseDeadlineAt, attemptId: summary.attemptId, finalNoResponseEligible: summary.finalNoResponseEligible } : null; }
function outreachSendAction(row: ApiRow, contact: OutreachContactRow | null): "initial_send" | "failed_retry" | "send_in_progress" | "resolution_required" | null { if (row.status !== "ready") return null; const summary = outreachAttemptSummary(row); if (summary == null) return null; if (summary.hasOpenAttempt) return summary.latestStatus === "unknown" ? "resolution_required" : "send_in_progress"; if (summary.latestStatus !== null && summary.latestStatus !== "failed") return null; const canReconcileToEmail = row.channel !== "email" && row.current_attempt === 0 && contact != null && contact.contact_status !== "do_not_contact" && contact.contact_status !== "archived" && typeof contact.email_normalized === "string" && contact.email_normalized.trim().length > 0; if (row.channel !== "email" && !canReconcileToEmail) return null; if (summary.latestStatus === null) return "initial_send"; return "failed_retry"; }

type VerifyLinkResponse = {
  ok: true;
  enqueue: { kind: "created" | "existing" };
  execution:
    | { kind: "completed" }
    | { kind: "failed" }
    | { kind: "rejected"; reason: "not_updated" };
};

type AutomationWorkspaceControlView = {
  workspaceId: string;
  backlinksEnabled: boolean;
  backlinkOutreachScheduleApplyEnabled: boolean;
  dryRunOnly: boolean;
  createdAt: string;
  updatedAt: string;
};
type AutomationWorkspaceControlGetResponse = { ok: true; control: AutomationWorkspaceControlView; disposition: "created" | "existing" };
type AutomationWorkspaceControlPatchResponse = { ok: true; control: AutomationWorkspaceControlView };

type DiscoveryProviderOption = "mock" | "brave_search";

// AutomationPromotionPreviewView is defined in _components/promotion-preview-types.ts

type AutomationExecutionView = {
  kind: "completed" | "pending_retry" | "failed";
  workerInvocations: number;
  completedTasks: number;
  retriedTasks: number;
  deadLetterTasks: number;
  stoppedBecause: "empty" | "max_worker_invocations";
  discoveryPreview: AutomationDiscoveryPreviewView | null;
  discoveryPreviewTaskId: string | null;
  qualificationPreview: AutomationQualificationPreviewView | null;
  qualificationPreviewTaskId: string | null;
  promotionPreview: AutomationPromotionPreviewView | null;
  lastIssue: { taskKind: string; code: string; message: string } | null;
};

type AutomationTickRejectedView = { kind: "rejected"; reason: "automation_disabled" | "dry_run_required" };
type AutomationTickExecutedView = {
  kind: "completed" | "pending_retry" | "failed";
  run: { id: string; workspaceId: string };
  promotionTaskId: string;
  preparation: { runDisposition: "created" | "existing"; taskDispositions: readonly ["created" | "existing", "created" | "existing", "created" | "existing"] };
  execution: AutomationExecutionView;
};
type AutomationTickResultView = AutomationTickRejectedView | AutomationTickExecutedView;
type AutomationTickResponse = { ok: true; result: AutomationTickResultView };

type PromotionApplyDialogState = { proposalKey: string; targetPageTitle: string; hostname: string; opportunityType: string; priority: string; suggestedAssetKey: string | null } | null;
type PromotionApplyResponse = { ok: true; result: { kind: "applied"; disposition: "created" | "existing"; domainDisposition: "created" | "existing" } };
type DiscoveryIntakeDialogState = { candidateKey: string; pageTitle: string | null; hostname: string; sourceUrl: string; runId: string; taskId: string } | null;
type DiscoveryIntakeResponse = { ok: true; result: { opportunityDisposition: "created" | "existing"; domainDisposition: "created" | "existing" } };

type CampaignMembershipApplyLimitedResult = { campaignId: string; runId: string; taskId: string; summary: { selected: number; created: number; existing: number; reactivated: number } };

class ApiRequestError extends Error {
  readonly code: string | null;
  constructor(message: string, code: string | null) {
    super(message);
    this.code = code;
  }
}

function promotionApplyErrorMessage(error: unknown): string {
  const code = error instanceof ApiRequestError ? error.code : null;
  switch (code) {
    case "PROMOTION_ASSET_NOT_FOUND":
      return "L’asset sélectionné est introuvable.";
    case "PROMOTION_ASSET_NOT_ACTIVE":
      return "L’asset sélectionné n’est plus actif.";
    case "PROMOTION_TASK_NOT_FOUND":
      return "Le résultat Promotion n’est plus disponible. Relancez l’analyse.";
    case "PROMOTION_TASK_NOT_COMPLETED":
      return "Le résultat Promotion n’est pas encore disponible.";
    case "PROMOTION_PROPOSAL_NOT_FOUND":
      return "Cette proposition n’est plus disponible dans le résultat Promotion.";
    case "PROMOTION_DOMAIN_ARCHIVED":
      return "Le domaine existe mais il est archivé. Réactivez-le avant de continuer.";
    case "PROMOTION_APPLICATION_MISMATCH":
      return "Cette proposition a déjà été appliquée avec des informations différentes.";
    default:
      return "La création de l’opportunité a échoué.";
  }
}

type EditorState = {
  section: BacklinkSection;
  row: ApiRow | null;
  initialValues: Record<string, string>;
} | null;

type Field = {
  key: string;
  label: string;
  required?: boolean;
  type?: "text" | "url" | "textarea";
};

function getDiscoveryConfigurationError(
  provider: string,
  query: string,
  countryCode: string,
  languageCode: string,
  maxResults: number,
  maxCandidates: number,
): string | null {
  if (provider !== "mock" && provider !== "brave_search") {
    return "Le provider Discovery sélectionné n’est pas pris en charge.";
  }
  if (query.trim().length === 0) {
    return "La requête Discovery est obligatoire.";
  }
  if (!/^[A-Z]{2}$/.test(countryCode.trim())) {
    return "Le pays Discovery doit être un code ISO de deux lettres majuscules.";
  }
  if (!/^[a-z][a-z0-9-]*$/.test(languageCode.trim())) {
    return "La langue Discovery doit être renseignée en minuscules.";
  }
  if (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > 10) {
    return "Le nombre de résultats Discovery doit être compris entre 1 et 10.";
  }
  if (!Number.isInteger(maxCandidates) || maxCandidates < 1 || maxCandidates > 50) {
    return "Le nombre de candidats Discovery doit être compris entre 1 et 50.";
  }

  return null;
}

function isDiscoveryProviderOption(value: string): value is DiscoveryProviderOption {
  return value === "mock" || value === "brave_search";
}

// preview utils extracted to ./_utils/backlink-preview-utils

// qualification & automation issue helpers extracted to ./_utils/backlink-labels

const sections: Record<BacklinkSection, { label: string; title: string; emptyState: string; endpoint: string }> = {
  opportunities: {
    label: "Opportunités",
    title: "Opportunités de backlinks",
    emptyState: "Aucune opportunité n’est encore enregistrée dans ce workspace.",
    endpoint: "/api/backlinks/opportunities",
  },
  campaigns: {
    label: "Campagnes",
    title: "Campagnes d’acquisition",
    emptyState: "Aucune campagne n’est encore enregistrée dans ce workspace.",
    endpoint: "/api/backlinks/campaigns",
  },
  outreach: {
    label: "Outreach",
    title: "Suivi de l’outreach",
    emptyState: "Aucun outreach n’est encore enregistré dans ce workspace.",
    endpoint: "/api/backlinks/outreach",
  },
  links: {
    label: "Liens",
    title: "Liens obtenus",
    emptyState: "Aucun backlink obtenu n’est encore enregistré dans ce workspace.",
    endpoint: "/api/backlinks/links",
  },
  assets: { label: "Assets", title: "Assets Norixo", emptyState: "Aucun asset n’est encore enregistré.", endpoint: "/api/backlinks/assets" },
  domains: { label: "Domains", title: "Domaines", emptyState: "Aucun domaine n’est encore enregistré.", endpoint: "/api/backlinks/domains" },
  contacts: { label: "Contacts", title: "Contacts", emptyState: "Aucun contact n’est encore enregistré.", endpoint: "/api/backlinks/contacts" },
};

const createFields: Record<BacklinkSection, Field[]> = {
  opportunities: [
    { key: "opportunity_key", label: "Clé d’opportunité", required: true },
    { key: "domain_id", label: "Domaine", required: true },
    { key: "asset_id", label: "Asset Norixo", required: true },
    { key: "opportunity_type", label: "Type d’opportunité", required: true },
    { key: "target_page_url", label: "URL cible", required: true, type: "url" },
    { key: "target_page_title", label: "Titre de la page", required: true },
    { key: "page_type", label: "Type de page", required: true },
    { key: "evidence_summary", label: "Preuve / résumé", required: true, type: "textarea" },
  ],
  campaigns: [
    { key: "campaign_key", label: "Clé de campagne", required: true },
    { key: "name", label: "Nom", required: true },
    { key: "objective", label: "Objectif", required: true, type: "textarea" },
  ],
  outreach: [
    { key: "outreach_key", label: "Clé d’outreach", required: true },
    { key: "campaign_id", label: "ID de campagne", required: true },
    { key: "opportunity_id", label: "ID d’opportunité", required: true },
    { key: "contact_id", label: "ID du contact", required: true },
    { key: "channel", label: "Canal", required: true },
  ],
  links: [
    { key: "backlink_key", label: "Clé du backlink", required: true },
    { key: "outreach_id", label: "ID d’outreach", required: true },
    { key: "opportunity_id", label: "ID d’opportunité", required: true },
    { key: "domain_id", label: "ID du domaine", required: true },
    { key: "asset_id", label: "ID de l’actif Norixo", required: true },
    { key: "source_url", label: "URL source", required: true, type: "url" },
    { key: "target_url", label: "URL Norixo cible", required: true, type: "url" },
    { key: "acquired_at", label: "Date d’acquisition (ISO)", required: true },
  ],
  assets: [{ key: "asset_key", label: "Clé asset", required: true }, { key: "display_name", label: "Nom", required: true }, { key: "asset_type", label: "Type", required: true }, { key: "canonical_url", label: "URL", type: "url" }, { key: "description", label: "Description", type: "textarea" }],
  domains: [{ key: "domain_key", label: "Clé domaine", required: true }, { key: "hostname", label: "Domaine", required: true }, { key: "display_name", label: "Nom" }, { key: "country_code", label: "Pays (ISO)" }, { key: "editorial_category", label: "Type" }, { key: "estimated_difficulty", label: "Priorité" }, { key: "lifecycle_status", label: "Statut" }],
  contacts: [{ key: "contact_key", label: "Clé contact", required: true }, { key: "domain_id", label: "Domaine", required: true }, { key: "full_name", label: "Nom" }, { key: "email_normalized", label: "Email" }, { key: "source_type", label: "Source type" }, { key: "source_reference", label: "Source reference" }, { key: "role_title", label: "Fonction" }],
};

const updateFields: Record<BacklinkSection, Field[]> = {
  opportunities: [
    { key: "domain_id", label: "Domaine" },
    { key: "asset_id", label: "Asset Norixo" },
    { key: "priority", label: "Priorité" },
    { key: "qualification_status", label: "Statut de qualification" },
    { key: "editorial_status", label: "Statut éditorial" },
    { key: "editorial_angle", label: "Angle éditorial", type: "textarea" },
  ],
  campaigns: [
    { key: "name", label: "Nom" },
    { key: "objective", label: "Objectif", type: "textarea" },
    { key: "status", label: "Statut" },
    { key: "start_at", label: "Date de début (ISO)" },
    { key: "end_at", label: "Date de fin (ISO)" },
  ],
  outreach: [
    { key: "campaign_id", label: "Campagne" },
    { key: "opportunity_id", label: "Opportunité" },
    { key: "contact_id", label: "Contact" },
    { key: "status", label: "Statut" },
    { key: "last_response_type", label: "Dernière réponse" },
    { key: "next_follow_up_at", label: "Prochaine relance (ISO)" },
    { key: "stop_reason", label: "Motif d’arrêt", type: "textarea" },
  ],
  links: [
    { key: "status", label: "Statut" },
    { key: "anchor_text", label: "Ancre" },
    { key: "target_url", label: "URL Norixo cible", type: "url" },
    { key: "rel_type", label: "Type rel" },
    { key: "link_location", label: "Emplacement du lien" },
    { key: "verification_source", label: "Source de vérification" },
  ],
  assets: [{ key: "display_name", label: "Nom" }, { key: "asset_type", label: "Type" }, { key: "canonical_url", label: "URL", type: "url" }, { key: "description", label: "Description", type: "textarea" }],
  domains: [{ key: "hostname", label: "Domaine" }, { key: "display_name", label: "Nom" }, { key: "country_code", label: "Pays (ISO)" }, { key: "editorial_category", label: "Type" }, { key: "estimated_difficulty", label: "Priorité" }, { key: "lifecycle_status", label: "Statut" }],
  contacts: [{ key: "full_name", label: "Nom" }, { key: "email_normalized", label: "Email" }, { key: "source_type", label: "Source type" }, { key: "source_reference", label: "Source reference" }, { key: "role_title", label: "Fonction" }, { key: "contact_status", label: "Statut" }],
};

// formatters extracted to ./_utils/backlink-formatters

function domainLabel(domains: ApiRow[], domainId: string | number | boolean | null | undefined) {
  const domain = domains.find((candidate) => candidate.id === domainId);
  return domain == null ? "—" : displayValue(domain.display_name ?? domain.hostname);
}

function assetLabel(assets: ApiRow[], assetId: string | number | boolean | null | undefined) {
  const asset = assets.find((candidate) => candidate.id === assetId);
  return asset == null ? "—" : displayValue(asset.display_name ?? asset.canonical_url);
}

function campaignLabel(campaigns: ApiRow[], campaignId: string | number | boolean | null | undefined) {
  const campaign = campaigns.find((candidate) => candidate.id === campaignId);
  return campaign == null ? "—" : displayValue(campaign.name ?? campaign.campaign_key);
}

function opportunityLabel(opportunities: ApiRow[], domains: ApiRow[], opportunityId: string | number | boolean | null | undefined) {
  const opportunity = opportunities.find((candidate) => candidate.id === opportunityId);
  return opportunity == null ? "—" : domainLabel(domains, opportunity.domain_id) !== "—" ? domainLabel(domains, opportunity.domain_id) : displayValue(opportunity.target_page_title ?? opportunity.opportunity_key);
}

function contactLabel(contacts: ApiRow[], contactId: string | number | boolean | null | undefined) {
  const contact = contacts.find((candidate) => candidate.id === contactId);
  return contact == null ? "—" : displayValue(contact.full_name ?? contact.email_normalized ?? contact.contact_key);
}

function linkOutreachLabel(outreachRows: ApiRow[], contacts: ApiRow[], opportunities: ApiRow[], domains: ApiRow[], campaigns: ApiRow[], outreachId: string | number | boolean | null | undefined) {
  const outreach = outreachRows.find((candidate) => candidate.id === outreachId);
  if (outreach == null) return "—";
  const contact = contactLabel(contacts, outreach.contact_id);
  const opportunity = opportunityLabel(opportunities, domains, outreach.opportunity_id);
  const campaign = campaignLabel(campaigns, outreach.campaign_id);
  return [contact, opportunity, campaign].filter((value) => value !== "—").join(" — ") || displayValue(outreach.outreach_key ?? outreach.id);
}

// outreach and link label helpers extracted to ./_utils/backlink-labels

function rowsFor(section: BacklinkSection, row: ApiRow, domains: ApiRow[], assets: ApiRow[], opportunities: ApiRow[], contacts: ApiRow[]) {
  if (section === "opportunities") {
    return [
      domainLabel(domains, row.domain_id),
      displayValue(row.opportunity_type),
      displayValue(row.priority),
      displayValue(row.editorial_status),
      assetLabel(assets, row.asset_id),
      formatDate(row.updated_at),
    ];
  }
  if (section === "campaigns") {
    return [displayValue(row.name), displayValue(row.status), "—", formatDate(row.start_at ?? row.created_at)];
  }
  if (section === "outreach") {
    const followUp = outreachFollowUpSummary(row);
    const followUpLabel =
      followUp == null || followUp.state === "none"
        ? "—"
        : followUp.state === "scheduled"
          ? `Relance prévue ${formatDate(followUp.nextFollowUpAt)}`
          : followUp.state === "due"
            ? `Relance due ${formatDate(followUp.nextFollowUpAt)}`
            : followUp.state === "prepared"
              ? "Relance préparée"
              : followUp.state === "requested"
                ? "Envoi en cours"
                : followUp.state === "unknown"
                  ? "Résultat d’envoi à vérifier"
                  : followUp.responseDeadlineAt != null && Date.parse(followUp.responseDeadlineAt) <= Date.now()
                    ? `Délai de réponse expiré ${formatDate(followUp.responseDeadlineAt)}`
                    : `En attente de réponse jusqu’au ${formatDate(followUp.responseDeadlineAt)}`;
    return [
      contactLabel(contacts, row.contact_id),
      opportunityLabel(opportunities, domains, row.opportunity_id),
      displayValue(row.status),
      formatDate(row.first_contact_at),
      displayValue(row.last_response_type),
      followUpLabel,
    ];
  }
  if (section === "assets") return [displayValue(row.display_name), displayValue(row.canonical_url), displayValue(row.asset_type), assetLifecycleStatusLabel(row.lifecycle_status)];
  if (section === "domains") return [displayValue(row.hostname), displayValue(row.editorial_category), displayValue(row.country_code), displayValue(row.estimated_difficulty), displayValue(row.lifecycle_status)];
  if (section === "contacts") return [displayValue(row.full_name), displayValue(row.email_normalized), displayValue(row.role_title), domainLabel(domains, row.domain_id)];
  return [
    displayValue(row.source_url),
    domainLabel(domains, row.domain_id),
    displayValue(row.rel_type),
    displayValue(row.status),
    formatDate(row.acquired_at),
  ];
}

const tableHeaders: Record<BacklinkSection, string[]> = {
  opportunities: ["Domaine", "Type", "Priorité", "Statut", "Asset", "Dernière mise à jour"],
  campaigns: ["Nom", "Statut", "Opportunités", "Date"],
  outreach: ["Contact", "Domaine", "Statut", "Date d’envoi", "Dernière réponse", "Relance"],
  links: ["URL", "Domaine", "Type", "Statut", "Date"],
  assets: ["Nom", "URL", "Type", "Statut"],
  domains: ["Domaine", "Type", "Pays", "Priorité", "Statut"],
  contacts: ["Nom", "Email", "Fonction", "Domaine"],
};

export default function BacklinksPage() {
  const [activeSection, setActiveSection] = useState<BacklinkSection>("opportunities");
  const [pages, setPages] = useState<Record<BacklinkSection, ApiPage>>({
    opportunities: { items: [], total: 0 },
    campaigns: { items: [], total: 0 },
    outreach: { items: [], total: 0 },
    links: { items: [], total: 0 },
    assets: { items: [], total: 0 },
    domains: { items: [], total: 0 },
    contacts: { items: [], total: 0 },
  });
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [workspaceResolved, setWorkspaceResolved] = useState(false);
  const workspaceRequestVersionRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState>(null);
  const [editorFieldValues, setEditorFieldValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [assetLifecycleStatus, setAssetLifecycleStatus] = useState<BacklinkAssetLifecycleStatus>("draft");
  const [verifyingLinkId, setVerifyingLinkId] = useState<string | null>(null);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);
  const [automationControl, setAutomationControl] = useState<AutomationWorkspaceControlView | null>(null);
  const [automationControlLoading, setAutomationControlLoading] = useState(false);
  const [automationSaving, setAutomationSaving] = useState(false);
  const [automationDryRunSaving, setAutomationDryRunSaving] = useState(false);
  const [automationError, setAutomationError] = useState<string | null>(null);
  const [automationRunning, setAutomationRunning] = useState(false);
  const [automationLastResult, setAutomationLastResult] =
    useState<AutomationTickResultView | null>(null);
  const [promotionApplyDialog, setPromotionApplyDialog] =
    useState<PromotionApplyDialogState>(null);
  const [promotionApplyAssetId, setPromotionApplyAssetId] = useState("");
  const [promotionApplySubmitting, setPromotionApplySubmitting] = useState(false);
  const [promotionApplyError, setPromotionApplyError] = useState<string | null>(null);
  const [promotionApplySuccess, setPromotionApplySuccess] = useState<{
    disposition: "created" | "existing";
    domainDisposition: "created" | "existing";
  } | null>(null);
  const [discoveryIntakeDialog, setDiscoveryIntakeDialog] = useState<DiscoveryIntakeDialogState>(null);
  const [discoveryIntakeAssetId, setDiscoveryIntakeAssetId] = useState("");
  const [discoveryIntakeSubmitting, setDiscoveryIntakeSubmitting] = useState(false);
  const [discoveryIntakeError, setDiscoveryIntakeError] = useState<string | null>(null);
  const [discoveryIntakeSuccess, setDiscoveryIntakeSuccess] = useState<{
    opportunityDisposition: "created" | "existing";
    domainDisposition: "created" | "existing";
  } | null>(null);
  const [qualificationApplyDialog, setQualificationApplyDialog] = useState<{
    runId: string;
    taskId: string;
    opportunityId: string;
    decision: AutomationQualificationPreviewView["results"][number]["decision"];
    opportunityLabel: string;
  } | null>(null);
  const [qualificationApplySubmitting, setQualificationApplySubmitting] = useState(false);
  const [qualificationApplyError, setQualificationApplyError] = useState<string | null>(null);
  const [qualificationApplyResult, setQualificationApplyResult] = useState<{
    opportunityId: string;
    runId: string;
    taskId: string;
    decision: string;
    previousQualificationStatus: string | null;
    qualificationStatus: string | null;
    disposition: "updated" | "existing" | "not_applicable";
  } | null>(null);
  const [qualificationBatchSelectedCandidateKeys, setQualificationBatchSelectedCandidateKeys] = useState<string[]>([]);
  const [qualificationBatchDialogOpen, setQualificationBatchDialogOpen] = useState(false);
  const [qualificationBatchSubmitting, setQualificationBatchSubmitting] = useState(false);
  const [qualificationBatchError, setQualificationBatchError] = useState<string | null>(null);
  const [qualificationBatchResult, setQualificationBatchResult] = useState<{ updated: number; existing: number; notApplicable: number; failed: number } | null>(null);
  const [recentlyQualifiedOpportunityIds, setRecentlyQualifiedOpportunityIds] = useState<string[]>([]);
  const [discoveryIntakeMappings, setDiscoveryIntakeMappings] = useState<readonly { candidateKey: string; opportunityId: string; assetId: string; discoveryTaskId: string }[]>([]);
  const qualificationApplyRequestIdRef = useRef(0);
  const previousQualificationTaskIdRef = useRef<string | null>(null);
  const [campaignPreviewCampaignId, setCampaignPreviewCampaignId] = useState("");
  const [campaignPreviewSelectedOpportunityIds, setCampaignPreviewSelectedOpportunityIds] = useState<string[]>([]);
  const [campaignPreviewMaxSelectedOpportunities, setCampaignPreviewMaxSelectedOpportunities] = useState<number>(50);
  const [campaignPreviewMaxPerDomain, setCampaignPreviewMaxPerDomain] = useState<number>(3);
  const [campaignPreviewLoading, setCampaignPreviewLoading] = useState(false);
  const [campaignPreviewError, setCampaignPreviewError] = useState<string | null>(null);
  const [campaignPreviewResult, setCampaignPreviewResult] = useState<unknown | null>(null);
  const [campaignMembershipApplyDialogOpen, setCampaignMembershipApplyDialogOpen] = useState(false);
  const [campaignMembershipApplySubmitting, setCampaignMembershipApplySubmitting] = useState(false);
  const [campaignMembershipApplyError, setCampaignMembershipApplyError] = useState<string | null>(null);
  const [campaignMembershipApplyResult, setCampaignMembershipApplyResult] = useState<CampaignMembershipApplyLimitedResult | null>(null);
  const [campaignMembershipApplyToast, setCampaignMembershipApplyToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const campaignApplyRequestIdRef = useRef(0);
  const [appliedPromotionProposalKeys, setAppliedPromotionProposalKeys] =
    useState<Readonly<Record<string, "created" | "existing">>>({});
  const [qualificationFilter, setQualificationFilter] = useState<"all" | "qualified" | "review" | "rejected">("all");
  const [promotionFilter, setPromotionFilter] = useState<"proposals" | "skipped" | "duplicates">("proposals");
  const [discoveryProvider, setDiscoveryProvider] =
    useState<DiscoveryProviderOption>("mock");
  const [discoveryQuery, setDiscoveryQuery] = useState("airbnb host resources");
  const [discoveryCountryCode, setDiscoveryCountryCode] = useState("US");
  const [discoveryLanguageCode, setDiscoveryLanguageCode] = useState("en");
  const [discoveryMaxResults, setDiscoveryMaxResults] = useState(10);
  const [discoveryMaxCandidates, setDiscoveryMaxCandidates] = useState(20);
  const [outreachSearchQuery, setOutreachSearchQuery] = useState("");
  const [outreachCampaignFilter, setOutreachCampaignFilter] = useState("");
  const [outreachStatusFilter, setOutreachStatusFilter] = useState("");
  const [outreachChannelFilter, setOutreachChannelFilter] = useState("");
  const [linkSearchQuery, setLinkSearchQuery] = useState("");
  const [linkStatusFilter, setLinkStatusFilter] = useState("");
  const [linkDomainFilter, setLinkDomainFilter] = useState("");
  const [linkAssetFilter, setLinkAssetFilter] = useState("");
  const [linkOutreachFilter, setLinkOutreachFilter] = useState("");
  const [opportunityValues, setOpportunityValues] = useState<Record<string, string>>({});
  const [opportunityTouched, setOpportunityTouched] = useState<Record<string, boolean>>({});
  const [opportunitySubmitAttempted, setOpportunitySubmitAttempted] = useState(false);
  const [campaignOpportunityMemberships, setCampaignOpportunityMemberships] = useState<CampaignOpportunityMembership[]>([]);
  const [campaignOpportunityMembershipsLoading, setCampaignOpportunityMembershipsLoading] = useState(false);
  const [campaignOpportunityMembershipsError, setCampaignOpportunityMembershipsError] = useState<string | null>(null);
  const [selectedCampaignOpportunityId, setSelectedCampaignOpportunityId] = useState("");
  const [attachingCampaignOpportunity, setAttachingCampaignOpportunity] = useState(false);
  const [detachingCampaignOpportunityId, setDetachingCampaignOpportunityId] = useState<string | null>(null);
  const [outreachDraftDialog, setOutreachDraftDialog] = useState<{ campaignId: string; opportunityId: string } | null>(null);
  const [outreachEligibility, setOutreachEligibility] = useState<{ contacts: OutreachEligibilityContact[] } | null>(null);
  const [outreachEligibilityLoading, setOutreachEligibilityLoading] = useState(false);
  const [outreachDraftContactId, setOutreachDraftContactId] = useState("");
  const [outreachDraftChannel, setOutreachDraftChannel] = useState<"email" | "linkedin" | "contact_form" | "">("");
  const [outreachDraftPreview, setOutreachDraftPreview] = useState<{ subject: string | null; body: string } | null>(null);
  const [outreachDraftPreviewLoading, setOutreachDraftPreviewLoading] = useState(false);
  const [outreachDraftSubmitting, setOutreachDraftSubmitting] = useState(false);
  const [outreachDraftError, setOutreachDraftError] = useState<string | null>(null);
  const [outreachDraftSuccess, setOutreachDraftSuccess] = useState<string | null>(null);
  const [outreachDraftEditDialog, setOutreachDraftEditDialog] = useState<ApiRow | null>(null);
  const [outreachDraftEditContactId, setOutreachDraftEditContactId] = useState("");
  const [outreachDraftEditChannel, setOutreachDraftEditChannel] = useState<"email" | "linkedin" | "contact_form" | "">("");
  const [outreachDraftEditSubject, setOutreachDraftEditSubject] = useState("");
  const [outreachDraftEditBody, setOutreachDraftEditBody] = useState("");
  const [outreachDraftEditSubmitting, setOutreachDraftEditSubmitting] = useState(false);
  const [outreachDraftEditError, setOutreachDraftEditError] = useState<string | null>(null);
  const [outreachDraftEditSuccess, setOutreachDraftEditSuccess] = useState<string | null>(null);
  const [outreachReadyDialog, setOutreachReadyDialog] = useState<ApiRow | null>(null);
  const [outreachReadySubmitting, setOutreachReadySubmitting] = useState(false);
  const [outreachReadyError, setOutreachReadyError] = useState<string | null>(null);
  const [outreachReadySuccess, setOutreachReadySuccess] = useState<string | null>(null);
  const [outreachReapproveDialog, setOutreachReapproveDialog] = useState<ApiRow | null>(null);
  const [outreachReapproveSubmitting, setOutreachReapproveSubmitting] = useState(false);
  const [outreachReapproveError, setOutreachReapproveError] = useState<string | null>(null);
  const [outreachReapproveSuccess, setOutreachReapproveSuccess] = useState<string | null>(null);
  const [outreachSendDialog, setOutreachSendDialog] = useState<ApiRow | null>(null);
  const [outreachSendMode, setOutreachSendMode] = useState<OutreachSendMode>("initial_send");
  const [outreachSendIdempotencyKey, setOutreachSendIdempotencyKey] = useState<string | null>(null);
  const [outreachSendSubmitting, setOutreachSendSubmitting] = useState(false);
  const [outreachSendError, setOutreachSendError] = useState<string | null>(null);
  const [outreachSendResult, setOutreachSendResult] = useState<string | null>(null);
  const [outreachResponseDialog, setOutreachResponseDialog] = useState<ApiRow | null>(null);
  const [outreachResponseKind, setOutreachResponseKind] = useState<"positive" | "negative" | null>(null);
  const [outreachResponseStopReason, setOutreachResponseStopReason] = useState("");
  const [outreachResponseSubmitting, setOutreachResponseSubmitting] = useState(false);
  const [outreachResponseError, setOutreachResponseError] = useState<string | null>(null);
  const [outreachResponseSuccess, setOutreachResponseSuccess] = useState<string | null>(null);
  const [outreachLifecycleActionDialog, setOutreachLifecycleActionDialog] = useState<ApiRow | null>(null);
  const [outreachLifecycleAction, setOutreachLifecycleAction] = useState<OutreachLifecycleAction | null>(null);
  const [outreachLifecycleStopReason, setOutreachLifecycleStopReason] = useState("");
  const [outreachLifecycleSubmitting, setOutreachLifecycleSubmitting] = useState(false);
  const [outreachLifecycleError, setOutreachLifecycleError] = useState<string | null>(null);
  const [outreachLifecycleSuccess, setOutreachLifecycleSuccess] = useState<string | null>(null);
  const [outreachFinalNoResponseDialog, setOutreachFinalNoResponseDialog] = useState<ApiRow | null>(null);
  const [outreachFinalNoResponseSubmitting, setOutreachFinalNoResponseSubmitting] = useState(false);
  const [outreachFinalNoResponseError, setOutreachFinalNoResponseError] = useState<string | null>(null);
  const [outreachFinalNoResponseSuccess, setOutreachFinalNoResponseSuccess] = useState<string | null>(null);
  const [outreachAttemptHistoryDialog, setOutreachAttemptHistoryDialog] = useState<ApiRow | null>(null);
  const [outreachAttemptHistoryLoading, setOutreachAttemptHistoryLoading] = useState(false);
  const [outreachAttemptHistoryError, setOutreachAttemptHistoryError] = useState<string | null>(null);
  const [outreachAttemptHistoryAttempts, setOutreachAttemptHistoryAttempts] = useState<OutreachAttemptHistoryItem[]>([]);
  const [outreachAttemptHistoryDeliveryEvents, setOutreachAttemptHistoryDeliveryEvents] = useState<OutreachDeliveryEventHistoryItem[]>([]);
  const [inboundRepliesDialogOutreach, setInboundRepliesDialogOutreach] = useState<ApiRow | null>(null);
  const [inboundReplies, setInboundReplies] = useState<OutreachInboundReplyItem[]>([]);
  const [inboundRepliesLoading, setInboundRepliesLoading] = useState(false);
  const [inboundRepliesLoadError, setInboundRepliesLoadError] = useState<string | null>(null);
  const [inboundReplySubmittingMessageId, setInboundReplySubmittingMessageId] = useState<string | null>(null);
  const [inboundReplyClassificationError, setInboundReplyClassificationError] = useState<string | null>(null);
  const [inboundReplyClassificationSuccess, setInboundReplyClassificationSuccess] = useState<string | null>(null);
  const [inboundReplyPendingConfirmation, setInboundReplyPendingConfirmation] = useState<OutreachInboundReplyConfirmation>(null);
  const [outreachUnknownResolutionDialog, setOutreachUnknownResolutionDialog] = useState<OutreachAttemptHistoryItem | null>(null);
  const [outreachUnknownResolutionKind, setOutreachUnknownResolutionKind] = useState<"accepted" | "failed" | null>(null);
  const [outreachUnknownProviderMessageId, setOutreachUnknownProviderMessageId] = useState("");
  const [outreachUnknownErrorCode, setOutreachUnknownErrorCode] = useState("");
  const [outreachUnknownErrorMessage, setOutreachUnknownErrorMessage] = useState("");
  const [outreachUnknownSubmitting, setOutreachUnknownSubmitting] = useState(false);
  const [outreachUnknownError, setOutreachUnknownError] = useState<string | null>(null);
  const [outreachUnknownSuccess, setOutreachUnknownSuccess] = useState<"updated" | "existing" | "reconciled" | null>(null);
  const [outreachFollowUpPrepareDialog, setOutreachFollowUpPrepareDialog] = useState<ApiRow | null>(null);
  const [outreachFollowUpPrepareIdempotencyKey, setOutreachFollowUpPrepareIdempotencyKey] = useState<string | null>(null);
  const [outreachFollowUpPrepareSubmitting, setOutreachFollowUpPrepareSubmitting] = useState(false);
  const [outreachFollowUpPrepareError, setOutreachFollowUpPrepareError] = useState<string | null>(null);
  const [outreachFollowUpPrepareSuccess, setOutreachFollowUpPrepareSuccess] = useState<string | null>(null);
  const [outreachFollowUpDraftDialog, setOutreachFollowUpDraftDialog] = useState<OutreachFollowUpDraftState | null>(null);
  const [outreachFollowUpDraftLoading, setOutreachFollowUpDraftLoading] = useState(false);
  const [outreachFollowUpDraftSubject, setOutreachFollowUpDraftSubject] = useState("");
  const [outreachFollowUpDraftBody, setOutreachFollowUpDraftBody] = useState("");
  const [outreachFollowUpDraftSubmitting, setOutreachFollowUpDraftSubmitting] = useState(false);
  const [outreachFollowUpDraftError, setOutreachFollowUpDraftError] = useState<string | null>(null);
  const [outreachFollowUpDraftSuccess, setOutreachFollowUpDraftSuccess] = useState<string | null>(null);
  const [outreachFollowUpDraftSendConfirmationOpen, setOutreachFollowUpDraftSendConfirmationOpen] = useState(false);
  const [outreachFollowUpDraftSendSubmitting, setOutreachFollowUpDraftSendSubmitting] = useState(false);
  const [outreachFollowUpDraftSendError, setOutreachFollowUpDraftSendError] = useState<string | null>(null);
  const [outreachFollowUpDraftSendSuccess, setOutreachFollowUpDraftSendSuccess] = useState<string | null>(null);
  const discoveryConfigurationError = getDiscoveryConfigurationError(
    discoveryProvider,
    discoveryQuery,
    discoveryCountryCode,
    discoveryLanguageCode,
    discoveryMaxResults,
    discoveryMaxCandidates,
  );

  const apiRequest = useCallback(async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const { data } = await getSharedSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) throw new Error("Session administrateur introuvable.");

    const workspaceId = activeWorkspaceId?.trim();
    const response = await fetch(path, {
      ...init,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...init?.headers,
        ...(workspaceId ? { "X-Norixo-Workspace-Id": workspaceId } : {}),
      },
    });
    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const error =
        typeof payload === "object" && payload != null && "error" in payload
          ? payload.error
          : null;
      const message =
        typeof error === "string"
          ? error
          : typeof error === "object" && error != null && "message" in error && typeof error.message === "string"
            ? error.message
            : "La requête Backlinks a échoué.";
      const code =
        typeof error === "object" && error != null && "code" in error && typeof error.code === "string"
          ? error.code
          : null;
      throw new ApiRequestError(message, code);
    }

    return payload as T;
  }, [activeWorkspaceId]);

  const loadAutomationControl = useCallback(async (requestVersion: number) => {
    if (!workspaceResolved || !activeWorkspaceId?.trim()) {
      if (requestVersion !== workspaceRequestVersionRef.current) return;
      setAutomationControl(null);
      return;
    }

    setAutomationControlLoading(true);
    setAutomationError(null);
    try {
      const response = await apiRequest<AutomationWorkspaceControlGetResponse>(
        "/api/internal/automation/workspace-control",
      );
      if (requestVersion !== workspaceRequestVersionRef.current) return;
      if (response.ok !== true) return;
      setAutomationControl(response.control);
    } catch {
      if (requestVersion !== workspaceRequestVersionRef.current) return;
      setAutomationControl(null);
      setAutomationError("Impossible de charger les paramètres d’automatisation.");
    } finally {
      if (requestVersion !== workspaceRequestVersionRef.current) return;
      setAutomationControlLoading(false);
    }
  }, [activeWorkspaceId, apiRequest, workspaceResolved]);

  const loadCampaignOpportunityMemberships = useCallback(async (campaignId: string) => {
    setCampaignOpportunityMembershipsLoading(true); setCampaignOpportunityMembershipsError(null);
    try { const page = await apiRequest<{ items: CampaignOpportunityMembership[] }>(`/api/backlinks/campaigns/${campaignId}/opportunities`); setCampaignOpportunityMemberships(page.items); }
    catch (membershipError) { setCampaignOpportunityMembershipsError(membershipError instanceof Error ? membershipError.message : "Impossible de charger les opportunités associées."); }
    finally { setCampaignOpportunityMembershipsLoading(false); }
  }, [apiRequest]);

  const loadDashboard = useCallback(async () => {
    if (!workspaceResolved) return;
    const workspaceRequestVersion = workspaceRequestVersionRef.current;
    setLoading(true);
    setError(null);
    try {
      const [opportunities, campaigns, outreach, links, assets, domains, contacts] = await Promise.all([
        apiRequest<ApiPage>(sections.opportunities.endpoint),
        apiRequest<ApiPage>(sections.campaigns.endpoint),
        apiRequest<ApiPage>(sections.outreach.endpoint),
        apiRequest<ApiPage>(sections.links.endpoint),
        apiRequest<ApiPage>(sections.assets.endpoint),
        apiRequest<ApiPage>(sections.domains.endpoint),
        apiRequest<ApiPage>(sections.contacts.endpoint),
      ]);
      if (workspaceRequestVersion !== workspaceRequestVersionRef.current) return;
      setPages({ opportunities, campaigns, outreach, links, assets, domains, contacts });
    } catch (loadError) {
      if (workspaceRequestVersion !== workspaceRequestVersionRef.current) return;
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger le cockpit Backlinks.");
    } finally {
      if (workspaceRequestVersion !== workspaceRequestVersionRef.current) return;
      setLoading(false);
    }
  }, [apiRequest, workspaceResolved]);

  const reloadOpportunities = useCallback(async (requestVersion: number) => {
    if (!workspaceResolved) return;
    try {
      const opportunities = await apiRequest<ApiPage>(sections.opportunities.endpoint);
      if (requestVersion !== workspaceRequestVersionRef.current) return;
      setPages((current) => ({ ...current, opportunities }));
    } catch {
      if (requestVersion !== workspaceRequestVersionRef.current) return;
      setError("Impossible de recharger les opportunités.");
    }
  }, [apiRequest, workspaceResolved]);

  useEffect(() => {
    const syncWorkspace = () => {
      workspaceRequestVersionRef.current += 1;
      setLoading(true);
      setPages({
        opportunities: { items: [], total: 0 },
        campaigns: { items: [], total: 0 },
        outreach: { items: [], total: 0 },
        links: { items: [], total: 0 },
        assets: { items: [], total: 0 },
        domains: { items: [], total: 0 },
        contacts: { items: [], total: 0 },
      });
      setAutomationControl(null);
      setAutomationError(null);
      setAutomationControlLoading(false);
      setAutomationSaving(false);
      setAutomationDryRunSaving(false);
      setAutomationRunning(false);
      setAutomationLastResult(null);
      setDiscoveryIntakeMappings([]);
      previousQualificationTaskIdRef.current = null;
      setPromotionApplyDialog(null);
      setPromotionApplyAssetId("");
      setPromotionApplySubmitting(false);
      setPromotionApplyError(null);
      setPromotionApplySuccess(null);
      setDiscoveryIntakeDialog(null);
      setDiscoveryIntakeAssetId("");
      setDiscoveryIntakeSubmitting(false);
      setDiscoveryIntakeError(null);
      setDiscoveryIntakeSuccess(null);
      setAppliedPromotionProposalKeys({});
      setCampaignMembershipApplyDialogOpen(false);
      setCampaignMembershipApplySubmitting(false);
      setCampaignMembershipApplyError(null);
      setCampaignMembershipApplyResult(null);
      setQualificationFilter("all");
      setPromotionFilter("proposals");
      setActiveWorkspaceId(getStoredWorkspaceId());
      setWorkspaceResolved(true);
    };

    syncWorkspace();
    window.addEventListener("norixo:active-workspace-changed", syncWorkspace);

    return () => {
      window.removeEventListener("norixo:active-workspace-changed", syncWorkspace);
    };
  }, []);

  useEffect(() => {
    if (!workspaceResolved) return;
    void loadDashboard();
    void loadAutomationControl(workspaceRequestVersionRef.current);
  }, [loadAutomationControl, loadDashboard, workspaceResolved]);

  const openEditor = (section: BacklinkSection, row: ApiRow | null, initialValues: Record<string, string> = {}) => {
    setFormError(null);
    setEditorFieldValues(initialValues);
    setOpportunityValues({});
    setOpportunityTouched({});
    setOpportunitySubmitAttempted(false);
    if (section === "assets") {
      const lifecycleStatus = row == null ? "draft" : inputValue(row, "lifecycle_status");
      if (!isBacklinkAssetLifecycleStatus(lifecycleStatus)) {
        setFormError("Le statut sélectionné est invalide.");
      } else {
        setAssetLifecycleStatus(lifecycleStatus);
      }
    }
    setEditor({ section, row, initialValues });
    setCampaignOpportunityMemberships([]); setCampaignOpportunityMembershipsError(null); setSelectedCampaignOpportunityId("");
    if (section === "campaigns") {
      // Opening another campaign resets any previous Apply result
      setCampaignMembershipApplyResult(null);
    }
    if (section === "campaigns" && row != null) void loadCampaignOpportunityMemberships(row.id);
  };

  const editorFieldValue = (fieldKey: string): string => {
    if (editorFieldValues[fieldKey] !== undefined) {
      return editorFieldValues[fieldKey];
    }
    if (editor?.row == null) {
      return editor?.initialValues?.[fieldKey] ?? "";
    }
    return inputValue(editor.row, fieldKey);
  };

  const handleEditorFieldInteraction = (target: EventTarget | null) => {
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) {
      setEditorFieldValues((values) => ({ ...values, [target.name]: target.value }));
    }
    handleOpportunityFieldInteraction(target);
  };

  const getConversationOpenLinkPrefill = (outreach: ApiRow): Record<string, string> | null => {
    if (outreach.status !== "conversation_open" || outreach.last_response_type !== "positive") return null;
    const opportunityId = typeof outreach.opportunity_id === "string" ? outreach.opportunity_id : "";
    if (!opportunityId) return null;
    const opportunity = pages.opportunities.items.find((candidate) => candidate.id === opportunityId);
    const domainId = typeof opportunity?.domain_id === "string" ? opportunity.domain_id : "";
    const assetId = typeof opportunity?.asset_id === "string" ? opportunity.asset_id : "";
    if (!domainId || !assetId) return null;
    return {
      outreach_id: String(outreach.id),
      opportunity_id: opportunityId,
      domain_id: domainId,
      asset_id: assetId,
    };
  };

  const hasActiveConversationOpenBacklink = (outreach: ApiRow): boolean => (
    outreach.status === "conversation_open"
    && outreach.last_response_type === "positive"
    && pages.links.items.some(
      (link) => link.workspace_id === outreach.workspace_id && link.outreach_id === outreach.id && link.status === "active",
    )
  );

  const openConversationOpenLinkEditor = (outreach: ApiRow): void => {
    const prefill = getConversationOpenLinkPrefill(outreach);
    if (prefill == null) return;
    openEditor("links", null, prefill);
  };
  const submitEditor = async (formData: FormData) => {
    if (!editor) return;
    if (editor.section === "assets" && !isBacklinkAssetLifecycleStatus(assetLifecycleStatus)) {
      setFormError("Le statut sélectionné est invalide.");
      return;
    }
    const fields = editor.row == null ? createFields[editor.section] : updateFields[editor.section];
    const body = Object.fromEntries(
      fields
        .map((field) => [field.key, String(formData.get(field.key) ?? "").trim()] as const)
        .filter(([, value]) => value.length > 0),
    );
    if (editor.section === "assets" && editor.row != null) {
      body.lifecycle_status = assetLifecycleStatus;
    }

    if (editor.section === "contacts") {
      const contactEvidencePresent =
        ["email_normalized", "linkedin_url", "contact_form_url"].some((field) =>
          String(body[field] ?? "").trim().length > 0,
        );
      if (contactEvidencePresent) {
        const sourceType = String(body.source_type ?? "").trim();
        const sourceReference = String(body.source_reference ?? "").trim();
        if (!sourceType || !sourceReference) {
          setFormError("Renseignez la source et la référence d’origine lorsque vous saisissez une preuve de canal.");
          return;
        }
      }
    }

    if (Object.keys(body).length === 0) {
      setFormError("Renseignez au moins un champ à modifier.");
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const path = editor.row == null ? sections[editor.section].endpoint : `${sections[editor.section].endpoint}/${editor.row.id}`;
      await apiRequest(path, {
        method: editor.row == null ? "POST" : "PATCH",
        body: JSON.stringify(body),
      });
      setEditor(null);
      await loadDashboard();
    } catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : "Impossible d’enregistrer cet élément.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyLink = async (linkId: string): Promise<void> => {
    setVerificationMessage(null);
    setVerifyingLinkId(linkId);
    try {
      const response = await apiRequest<VerifyLinkResponse>(
        `/api/backlinks/links/${linkId}/verify`,
        { method: "POST", body: JSON.stringify({}) },
      );
      if (response.execution.kind === "completed") {
        setVerificationMessage("Vérification terminée.");
      } else if (response.execution.kind === "failed") {
        setVerificationMessage("La vérification a été exécutée mais le job s’est terminé en échec.");
      } else {
        setVerificationMessage("Une nouvelle vérification a été déclenchée pour ce lien.");
      }
      await loadDashboard();
    } catch (verificationError) {
      setVerificationMessage(
        verificationError instanceof Error
          ? verificationError.message
          : "Impossible de vérifier ce lien.",
      );
    } finally {
      setVerifyingLinkId(null);
    }
  };

  const handleToggleAutomation = async (): Promise<void> => {
    if (
      automationControl == null ||
      !activeWorkspaceId?.trim() ||
      !workspaceResolved ||
      automationSaving
    ) {
      return;
    }

    const requestVersion = workspaceRequestVersionRef.current;
    setAutomationSaving(true);
    setAutomationError(null);
    try {
      const response = await apiRequest<AutomationWorkspaceControlPatchResponse>(
        "/api/internal/automation/workspace-control",
        {
          method: "PATCH",
          body: JSON.stringify({
            backlinksEnabled: !automationControl.backlinksEnabled,
          }),
        },
      );
      if (requestVersion !== workspaceRequestVersionRef.current) return;
      if (response.ok !== true) return;
      setAutomationControl(response.control);
    } catch {
      if (requestVersion !== workspaceRequestVersionRef.current) return;
      setAutomationError("Impossible de modifier l’automatisation.");
    } finally {
      if (requestVersion !== workspaceRequestVersionRef.current) return;
      setAutomationSaving(false);
    }
  };

  const handleToggleDryRunOnly = async (): Promise<void> => {
    if (
      automationControl == null ||
      !activeWorkspaceId?.trim() ||
      !workspaceResolved ||
      automationSaving ||
      automationDryRunSaving ||
      automationControlLoading
    ) {
      return;
    }

    const nextDryRunOnly = !automationControl.dryRunOnly;
    if (!nextDryRunOnly) {
      const confirmed = window.confirm(
        "Passer ce workspace en LIVE autorisera l’envoi réel d’e-mails via le fournisseur configuré. Continuer ?",
      );
      if (!confirmed) return;
    }

    const requestVersion = workspaceRequestVersionRef.current;
    setAutomationDryRunSaving(true);
    setAutomationError(null);
    try {
      const response = await apiRequest<AutomationWorkspaceControlPatchResponse>(
        "/api/internal/automation/workspace-control",
        {
          method: "PATCH",
          body: JSON.stringify({
            dryRunOnly: nextDryRunOnly,
          }),
        },
      );
      if (requestVersion !== workspaceRequestVersionRef.current) return;
      if (response.ok !== true) return;
      setAutomationControl(response.control);
    } catch {
      if (requestVersion !== workspaceRequestVersionRef.current) return;
      setAutomationError("Impossible de modifier le mode d’envoi des emails.");
    } finally {
      if (requestVersion !== workspaceRequestVersionRef.current) return;
      setAutomationDryRunSaving(false);
    }
  };

  const handleToggleOutreachScheduleApply = async (): Promise<void> => {
    if (
      automationControl == null ||
      !activeWorkspaceId?.trim() ||
      !workspaceResolved ||
      automationSaving ||
      automationControlLoading
    ) {
      return;
    }

    const nextEnabled = !automationControl.backlinkOutreachScheduleApplyEnabled;
    if (nextEnabled) {
      const confirmed = window.confirm(
        "Activer la planification automatique des relances pour ce workspace ?\n\nNorixo pourra créer automatiquement les échéances de relance et de réponse finale lorsqu’un Outreach devient éligible.\n\nAucun email ne sera envoyé automatiquement et aucun Outreach ne sera automatiquement marqué sans réponse.",
      );
      if (!confirmed) return;
    }

    const requestVersion = workspaceRequestVersionRef.current;
    setAutomationSaving(true);
    setAutomationError(null);
    try {
      const response = await apiRequest<AutomationWorkspaceControlPatchResponse>(
        "/api/internal/automation/workspace-control",
        {
          method: "PATCH",
          body: JSON.stringify({
            backlinkOutreachScheduleApplyEnabled: nextEnabled,
          }),
        },
      );
      if (requestVersion !== workspaceRequestVersionRef.current) return;
      if (response.ok !== true) return;
      setAutomationControl(response.control);
    } catch {
      if (requestVersion !== workspaceRequestVersionRef.current) return;
      setAutomationError("Impossible de modifier la planification automatique des relances.");
    } finally {
      if (requestVersion !== workspaceRequestVersionRef.current) return;
      setAutomationSaving(false);
    }
  };

  const closePromotionApplyDialog = (): void => {
    if (promotionApplySubmitting) return;
    setPromotionApplyDialog(null);
    setPromotionApplyAssetId("");
    setPromotionApplyError(null);
    setPromotionApplySuccess(null);
  };

  const openPromotionApplyDialog = (
    proposal: AutomationPromotionPreviewView["proposals"][number],
  ): void => {
    if (automationLastResult == null || automationLastResult.kind === "rejected") return;
    const matchingAsset = proposal.suggestedAssetKey == null
      ? null
      : pages.assets.items.find(
          (asset) =>
            asset.lifecycle_status === "active" &&
            asset.asset_key === proposal.suggestedAssetKey,
        ) ?? null;
    setPromotionApplyDialog({
      proposalKey: proposal.proposalKey,
      targetPageTitle: proposal.targetPageTitle,
      hostname: proposal.hostname,
      opportunityType: proposal.opportunityType,
      priority: proposal.priority,
      suggestedAssetKey: proposal.suggestedAssetKey,
    });
    setPromotionApplyAssetId(matchingAsset?.id ?? "");
    setPromotionApplyError(null);
    setPromotionApplySuccess(null);
  };

  const handleApplyPromotion = async (): Promise<void> => {
    if (promotionApplySubmitting) return;
    const result = automationLastResult;
    const dialog = promotionApplyDialog;
    if (
      result == null ||
      result.kind === "rejected" ||
      !result.promotionTaskId ||
      !result.run.id ||
      dialog == null ||
      !dialog.proposalKey ||
      !promotionApplyAssetId
    ) {
      setPromotionApplyError("Le résultat Promotion n’est plus disponible. Relancez l’analyse.");
      return;
    }

    const requestVersion = workspaceRequestVersionRef.current;
    setPromotionApplySubmitting(true);
    setPromotionApplyError(null);
    setPromotionApplySuccess(null);
    try {
      const response = await apiRequest<PromotionApplyResponse>(
        "/api/internal/automation/backlinks/promotions/apply",
        {
          method: "POST",
          body: JSON.stringify({
            runId: result.run.id,
            promotionTaskId: result.promotionTaskId,
            proposalKey: dialog.proposalKey,
            assetId: promotionApplyAssetId,
          }),
        },
      );
      if (requestVersion !== workspaceRequestVersionRef.current) return;
      if (response.ok !== true || response.result.kind !== "applied") {
        setPromotionApplyError("La création de l’opportunité a échoué.");
        return;
      }
      setPromotionApplySuccess({
        disposition: response.result.disposition,
        domainDisposition: response.result.domainDisposition,
      });
      setAppliedPromotionProposalKeys((current) => ({
        ...current,
        [dialog.proposalKey]: response.result.disposition,
      }));
      await reloadOpportunities(requestVersion);
    } catch (applyError) {
      if (requestVersion !== workspaceRequestVersionRef.current) return;
      setPromotionApplyError(promotionApplyErrorMessage(applyError));
    } finally {
      if (requestVersion !== workspaceRequestVersionRef.current) return;
      setPromotionApplySubmitting(false);
    }
  };

  const closeDiscoveryIntakeDialog = (): void => {
    if (discoveryIntakeSubmitting) return;
    setDiscoveryIntakeDialog(null);
    setDiscoveryIntakeAssetId("");
    setDiscoveryIntakeError(null);
    setDiscoveryIntakeSuccess(null);
  };

  const openDiscoveryIntakeDialog = (
    candidate: AutomationDiscoveryPreviewView["candidates"][number],
  ): void => {
    const result = automationLastResult;
    const taskId = result == null || result.kind === "rejected"
      ? null
      : result.execution.discoveryPreviewTaskId;
    if (
      result == null ||
      result.kind === "rejected" ||
      !result.run.id ||
      !taskId ||
      candidate.intakeEligibility?.status !== "eligible"
    ) {
      return;
    }
    setDiscoveryIntakeDialog({
      candidateKey: candidate.candidateKey,
      pageTitle: candidate.pageTitle,
      hostname: candidate.hostname,
      sourceUrl: candidate.sourceUrl,
      runId: result.run.id,
      taskId,
    });
    setDiscoveryIntakeAssetId("");
    setDiscoveryIntakeError(null);
    setDiscoveryIntakeSuccess(null);
  };

  const handleConfirmDiscoveryOpportunityIntake = async (): Promise<void> => {
    if (discoveryIntakeSubmitting) return;
    const dialog = discoveryIntakeDialog;
    if (dialog == null || !discoveryIntakeAssetId) {
      setDiscoveryIntakeError("Sélectionnez un asset actif avant de continuer.");
      return;
    }
    if (automationLastResult == null || automationLastResult.kind === "rejected") {
      setDiscoveryIntakeError("Le résultat Discovery n’est plus disponible. Relancez la prévisualisation.");
      return;
    }
    const currentRunId = automationLastResult.run.id;
    const currentTaskId = automationLastResult.execution.discoveryPreviewTaskId;
    if (currentRunId !== dialog.runId || currentTaskId !== dialog.taskId) {
      setDiscoveryIntakeError("Le résultat Discovery a changé. Fermez et relancez la prévisualisation.");
      return;
    }
    const candidate = automationLastResult.execution.discoveryPreview?.candidates.find(
      (item) => item.candidateKey === dialog.candidateKey,
    );
    if (candidate?.intakeEligibility?.status !== "eligible") {
      setDiscoveryIntakeError("Ce candidat n’est plus éligible à l’ajout aux opportunités.");
      return;
    }

    const requestVersion = workspaceRequestVersionRef.current;
    setDiscoveryIntakeSubmitting(true);
    setDiscoveryIntakeError(null);
    setDiscoveryIntakeSuccess(null);
    try {
      const response = await apiRequest<DiscoveryIntakeResponse>(
        "/api/internal/automation/backlinks/discovery/apply",
        {
          method: "POST",
          body: JSON.stringify({
            runId: dialog.runId,
            taskId: dialog.taskId,
            candidateKey: dialog.candidateKey,
            assetId: discoveryIntakeAssetId,
          }),
        },
      );
      if (requestVersion !== workspaceRequestVersionRef.current) return;
      if (response.ok !== true) {
        setDiscoveryIntakeError("L’ajout de l’opportunité a échoué.");
        return;
      }
      setDiscoveryIntakeSuccess({
        opportunityDisposition: response.result.opportunityDisposition,
        domainDisposition: response.result.domainDisposition,
      });
      await reloadOpportunities(requestVersion);
      const mappings = await apiRequest<{ items: readonly { candidateKey: string; opportunityId: string; assetId: string; discoveryTaskId: string }[] }>(`/api/backlinks/discovery-intake-applications?discoveryTaskId=${dialog.taskId}`);
      if (requestVersion !== workspaceRequestVersionRef.current) return;
      setDiscoveryIntakeMappings(mappings.items);
    } catch (intakeError) {
      if (requestVersion !== workspaceRequestVersionRef.current) return;
      setDiscoveryIntakeError(
        intakeError instanceof ApiRequestError || intakeError instanceof Error
          ? intakeError.message
          : "L’ajout de l’opportunité a échoué.",
      );
    } finally {
      if (requestVersion !== workspaceRequestVersionRef.current) return;
      setDiscoveryIntakeSubmitting(false);
    }
  };

  const openCampaignMembershipApplyDialog = (): void => {
    setCampaignMembershipApplyError(null);
    setCampaignMembershipApplyDialogOpen(true);
  };

  const closeCampaignMembershipApplyDialog = (): void => {
    if (campaignMembershipApplySubmitting) return;
    setCampaignMembershipApplyDialogOpen(false);
    setCampaignMembershipApplyError(null);
  };

  const handleConfirmCampaignMembershipApply = async (): Promise<void> => {
    if (campaignMembershipApplySubmitting) return;
    const runId = previewRunId;
    const taskId = previewTaskId;
    const campaignId = previewCampaignId;
    if (!runId || !taskId || !campaignId) {
      setCampaignMembershipApplyError("Les données du preview sont manquantes.");
      return;
    }

    const requestVersion = workspaceRequestVersionRef.current;
    campaignApplyRequestIdRef.current += 1;
    const thisApplyId = campaignApplyRequestIdRef.current;

    setCampaignMembershipApplySubmitting(true);
    setCampaignMembershipApplyError(null);
    try {
      const response = await apiRequest<{
        ok: true;
        result: CampaignMembershipApplyLimitedResult;
      }>(
        "/api/internal/automation/backlinks/campaigns/apply",
        {
          method: "POST",
          body: JSON.stringify({ runId, taskId, campaignId, confirm: true }),
        },
      );

      if (requestVersion !== workspaceRequestVersionRef.current) return;
      if (thisApplyId !== campaignApplyRequestIdRef.current) return; // a new apply started

      // ensure the preview that started the apply hasn't changed
      if (
        campaignPreviewNestedResult == null ||
        previewTaskId !== taskId ||
        previewRunId !== runId ||
        previewCampaignId !== campaignId
      ) {
        return;
      }

      setCampaignMembershipApplyResult(response.result);
      setCampaignMembershipApplyDialogOpen(false);
      // show a short-lived success toast and refresh memberships
      setCampaignMembershipApplyToast({ type: "success", message: "Campaign memberships successfully applied." });
      await loadCampaignOpportunityMemberships(response.result.campaignId);
    } catch (applyError) {
      if (requestVersion !== workspaceRequestVersionRef.current) return;
      setCampaignMembershipApplyError(
        applyError instanceof ApiRequestError
          ? applyError.message
          : applyError instanceof Error
          ? applyError.message
          : "L’application des sélections a échoué.",
      );
    } finally {
      if (requestVersion !== workspaceRequestVersionRef.current) return;
      setCampaignMembershipApplySubmitting(false);
    }
  };

  const handleRunAutomationNow = async (): Promise<void> => {
    if (
      !workspaceResolved ||
      !activeWorkspaceId?.trim() ||
      automationControl == null ||
      !automationControl.backlinksEnabled ||
      automationControlLoading ||
      automationSaving ||
      automationRunning ||
      discoveryConfigurationError !== null
    ) {
      if (discoveryConfigurationError !== null) {
        setAutomationError(discoveryConfigurationError);
      }
      return;
    }

    const requestVersion = workspaceRequestVersionRef.current;
    const idempotencyKey = `manual-ui:${crypto.randomUUID()}`;
    const scheduledAt = new Date().toISOString();
    setAutomationRunning(true);
    setAutomationError(null);
    setAutomationLastResult(null);
    previousQualificationTaskIdRef.current = null;
    setPromotionApplyDialog(null);
    setPromotionApplyAssetId("");
    setPromotionApplyError(null);
    setPromotionApplySuccess(null);
    setDiscoveryIntakeDialog(null);
    setDiscoveryIntakeAssetId("");
    setDiscoveryIntakeError(null);
    setDiscoveryIntakeSuccess(null);
    setAppliedPromotionProposalKeys({});
    setQualificationFilter("all");
    setPromotionFilter("proposals");
    try {
      const response = await apiRequest<AutomationTickResponse>(
        "/api/internal/automation/backlinks/tick",
        {
          method: "POST",
          body: JSON.stringify({
            idempotencyKey,
            scheduledAt,
            discoveryInput: {
              version: 1,
              source: "manual_dashboard",
              provider: discoveryProvider,
              searches: [
                {
                  query: discoveryQuery.trim(),
                  countryCode: discoveryCountryCode.trim().toUpperCase(),
                  languageCode: discoveryLanguageCode.trim().toLowerCase(),
                },
              ],
              maxResultsPerSearch: discoveryMaxResults,
              maxCandidates: discoveryMaxCandidates,
            },
            qualificationInput: {
              source: "manual_dashboard",
              requestedScope: "preview",
            },
          }),
        },
      );
      if (requestVersion !== workspaceRequestVersionRef.current) return;
      if (response.ok !== true) return;
      setAutomationLastResult(response.result);
      if (response.result.kind !== "rejected" && response.result.execution.discoveryPreviewTaskId) {
        const mappings = await apiRequest<{ items: readonly { candidateKey: string; opportunityId: string; assetId: string; discoveryTaskId: string }[] }>(`/api/backlinks/discovery-intake-applications?discoveryTaskId=${response.result.execution.discoveryPreviewTaskId}`);
        if (requestVersion !== workspaceRequestVersionRef.current) return;
        setDiscoveryIntakeMappings(mappings.items);
      }
    } catch {
      if (requestVersion !== workspaceRequestVersionRef.current) return;
      setAutomationError("Impossible de lancer l’automatisation.");
    } finally {
      if (requestVersion !== workspaceRequestVersionRef.current) return;
      setAutomationRunning(false);
    }
  };

  const closeQualificationApplyDialog = (): void => {
    if (qualificationApplySubmitting) return;
    setQualificationApplyDialog(null);
    setQualificationApplyError(null);
    setQualificationApplyResult(null);
  };

  const handleConfirmQualificationApply = async (): Promise<void> => {
    if (qualificationApplySubmitting) return;
    const dialog = qualificationApplyDialog;
    if (!dialog) {
      setQualificationApplyError("Les données du preview sont manquantes.");
      return;
    }

    const requestVersion = workspaceRequestVersionRef.current;
    qualificationApplyRequestIdRef.current += 1;
    const thisApplyId = qualificationApplyRequestIdRef.current;

    setQualificationApplySubmitting(true);
    setQualificationApplyError(null);
    try {
      // ensure the automation preview that produced this dialog is still the latest
      if (automationLastResult == null || automationLastResult.kind === "rejected") {
        setQualificationApplyError("Le résultat d'automatisation n'est plus disponible. Relancez la prévisualisation.");
        return;
      }
      const currentRunId = automationLastResult.run?.id ?? "";
      const currentTaskId = automationLastResult.execution?.qualificationPreviewTaskId ?? "";
      if (currentRunId !== dialog.runId || currentTaskId !== dialog.taskId) {
        setQualificationApplyError("Le résultat d'automatisation a changé. Fermez et relancez la prévisualisation.");
        return;
      }
      const response = await apiRequest<{ ok: true; result: { opportunityId: string; runId: string; taskId: string; decision: string; previousQualificationStatus: string | null; qualificationStatus: string | null; disposition: "updated" | "existing" | "not_applicable"; }; }>(
        "/api/internal/automation/backlinks/qualifications/apply",
        {
          method: "POST",
          body: JSON.stringify({ runId: dialog.runId, taskId: dialog.taskId, opportunityId: dialog.opportunityId, confirm: true }),
        },
      );

      if (requestVersion !== workspaceRequestVersionRef.current) return;
      if (thisApplyId !== qualificationApplyRequestIdRef.current) return; // another apply started

      setQualificationApplyResult(response.result);
      setQualificationApplyDialog(null);

      // targeted refresh of the opportunity list
      await reloadOpportunities(requestVersion);
    } catch (applyError) {
      if (requestVersion !== workspaceRequestVersionRef.current) return;
      setQualificationApplyError(applyError instanceof ApiRequestError ? applyError.message : applyError instanceof Error ? applyError.message : "Qualification could not be applied.");
    } finally {
      if (requestVersion !== workspaceRequestVersionRef.current) return;
      setQualificationApplySubmitting(false);
    }
  };

  const closeQualificationBatchDialog = (): void => {
    if (qualificationBatchSubmitting) return;
    setQualificationBatchDialogOpen(false);
    setQualificationBatchError(null);
    setQualificationBatchResult(null);
  };

  const handleApplyQualificationBatch = async (): Promise<void> => {
    if (qualificationBatchSubmitting) return;
    const selected = qualificationBatchSelectedCandidateKeys
      .map((candidateKey) => qualificationBatchEligibleByCandidateKey.get(candidateKey))
      .filter((value): value is { opportunityId: string } => value !== undefined);
    const opportunityIds = selected.map((value) => value.opportunityId);
    const runId = automationLastExecutedResult?.run.id ?? "";
    const taskId = automationLastExecutedResult?.execution.qualificationPreviewTaskId ?? "";
    if (!runId || !taskId || opportunityIds.length === 0 || opportunityIds.length > 50 || opportunityIds.length !== qualificationBatchSelectedCandidateKeys.length) {
      setQualificationBatchError("La sélection Qualification n’est plus applicable. Relancez le preview.");
      return;
    }
    const requestVersion = workspaceRequestVersionRef.current;
    setQualificationBatchSubmitting(true);
    setQualificationBatchError(null);
    try {
      const response = await apiRequest<{ ok: true; result: { updated: number; existing: number; notApplicable: number; failed: number; items: { opportunityId: string; candidateKey: string | null; decision: string | null; qualificationStatus: string | null; disposition: string }[] } }>(
        "/api/internal/automation/backlinks/qualifications/batch-apply",
        { method: "POST", body: JSON.stringify({ runId, taskId, opportunityIds, confirm: true }) },
      );
      if (requestVersion !== workspaceRequestVersionRef.current) return;
      setQualificationBatchResult(response.result);
      setQualificationBatchSelectedCandidateKeys(response.result.items.filter((item) => item.disposition === "failed" && item.candidateKey !== null).map((item) => item.candidateKey as string));
      setRecentlyQualifiedOpportunityIds(response.result.items.filter((item) => item.decision === "qualified" && (item.disposition === "updated" || item.disposition === "existing") && item.qualificationStatus === "Qualified").map((item) => item.opportunityId).slice(0, 50));
      await reloadOpportunities(requestVersion);
    } catch (error) {
      if (requestVersion !== workspaceRequestVersionRef.current) return;
      setQualificationBatchError(error instanceof Error ? error.message : "La qualification groupée a échoué.");
    } finally {
      if (requestVersion !== workspaceRequestVersionRef.current) return;
      setQualificationBatchSubmitting(false);
    }
  };

  const handlePrepareCampaignFromQualificationBatch = (): void => {
    setCampaignPreviewSelectedOpportunityIds(recentlyQualifiedOpportunityIds.slice(0, 50));
  };

  const activeCampaignMemberships = campaignOpportunityMemberships.filter((membership) => membership.membership_status !== "removed");
  const campaignOpportunityLabel = (opportunityId: string) => opportunityLabel(pages.opportunities.items, pages.domains.items, opportunityId);
  const availableCampaignOpportunities = pages.opportunities.items.filter((opportunity) => !activeCampaignMemberships.some((membership) => membership.opportunity_id === opportunity.id));
  const hasDomains = pages.domains.items.length > 0;
  const hasAssets = pages.assets.items.length > 0;
  const activePromotionAssets = pages.assets.items.filter(
    (asset) => asset.lifecycle_status === "active",
  );
  const activeDiscoveryIntakeAssets = pages.assets.items
    .filter((asset) => asset.lifecycle_status === "active")
    .map((asset) => ({
      id: asset.id,
      label: `${displayValue(asset.display_name)} — ${displayValue(asset.asset_key)}${asset.canonical_url ? ` · ${asset.canonical_url}` : ""}`,
    }));
  const visibleOpportunityFields = editor?.section === "opportunities" ? (editor.row == null ? createFields.opportunities : updateFields.opportunities) : [];
  const opportunityValue = (field: Field) => opportunityValues[field.key] ?? inputValue(editor?.row ?? null, field.key);
  const opportunityFieldError = (field: Field) => {
    const value = opportunityValue(field).trim();
    if (field.required && !value) return field.key === "domain_id" ? "Veuillez sélectionner un domaine." : field.key === "asset_id" ? "Veuillez sélectionner un asset." : field.key === "target_page_url" ? "Veuillez saisir une URL valide." : "Ce champ est obligatoire.";
    if (field.key === "target_page_url" && value) {
      try { const parsed = new URL(value); if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "Veuillez saisir une URL valide."; } catch { return "Veuillez saisir une URL valide."; }
    }
    return null;
  };
  const opportunityErrors = Object.fromEntries(visibleOpportunityFields.map((field) => [field.key, opportunityFieldError(field)]));
  const opportunityFormInvalid = editor?.section === "opportunities" && Object.values(opportunityErrors).some(Boolean);
  const handleOpportunityFieldInteraction = (target: EventTarget | null) => {
    if (editor?.section !== "opportunities" || !(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) return;
    setOpportunityValues((values) => ({ ...values, [target.name]: target.value }));
    setOpportunityTouched((touched) => ({ ...touched, [target.name]: true }));
  };
  const attachCampaignOpportunity = async () => { if (!editor?.row || !selectedCampaignOpportunityId || attachingCampaignOpportunity) return; setAttachingCampaignOpportunity(true); setCampaignOpportunityMembershipsError(null); try { await apiRequest(`/api/backlinks/campaigns/${editor.row.id}/opportunities`, { method: "POST", body: JSON.stringify({ opportunity_id: selectedCampaignOpportunityId }) }); setSelectedCampaignOpportunityId(""); await loadCampaignOpportunityMemberships(editor.row.id); } catch (attachError) { setCampaignOpportunityMembershipsError(attachError instanceof Error ? attachError.message : "Impossible d’ajouter l’opportunité."); } finally { setAttachingCampaignOpportunity(false); } };
  const detachCampaignOpportunity = async (opportunityId: string) => { if (!editor?.row || detachingCampaignOpportunityId) return; setDetachingCampaignOpportunityId(opportunityId); setCampaignOpportunityMembershipsError(null); try { await apiRequest(`/api/backlinks/campaigns/${editor.row.id}/opportunities/${opportunityId}`, { method: "DELETE" }); await loadCampaignOpportunityMemberships(editor.row.id); } catch (detachError) { setCampaignOpportunityMembershipsError(detachError instanceof Error ? detachError.message : "Impossible de retirer l’opportunité."); } finally { setDetachingCampaignOpportunityId(null); } };
  const openOutreachDraftDialog = async (campaignId: string, opportunityId: string) => { setOutreachDraftDialog({ campaignId, opportunityId }); setOutreachEligibility(null); setOutreachDraftContactId(""); setOutreachDraftChannel(""); setOutreachDraftPreview(null); setOutreachDraftError(null); setOutreachDraftSuccess(null); setOutreachEligibilityLoading(true); try { const eligibility = await apiRequest<{ contacts: OutreachEligibilityContact[] }>(`/api/backlinks/campaigns/${campaignId}/opportunities/${opportunityId}/outreach-eligibility`); setOutreachEligibility({ contacts: eligibility.contacts.filter((contact) => contact.eligibleChannels.length > 0) }); } catch (error) { setOutreachDraftError(error instanceof Error ? error.message : "Impossible de charger les contacts éligibles."); } finally { setOutreachEligibilityLoading(false); } };
  const openOutreachDraftEditDialog = async (outreach: ApiRow) => { const campaignId = typeof outreach.campaign_id === "string" ? outreach.campaign_id : ""; const opportunityId = typeof outreach.opportunity_id === "string" ? outreach.opportunity_id : ""; const contactId = typeof outreach.contact_id === "string" ? outreach.contact_id : ""; const channel = outreach.channel === "email" || outreach.channel === "linkedin" || outreach.channel === "contact_form" ? outreach.channel : ""; if (outreach.status !== "draft" || !campaignId || !opportunityId || !contactId || !channel) return; setOutreachDraftEditDialog(outreach); setOutreachDraftEditContactId(contactId); setOutreachDraftEditChannel(channel); setOutreachDraftEditSubject(typeof outreach.subject === "string" ? outreach.subject : ""); setOutreachDraftEditBody(typeof outreach.body === "string" ? outreach.body : ""); setOutreachDraftEditError(null); setOutreachDraftEditSuccess(null); setOutreachEligibilityLoading(true); try { const result = await apiRequest<{ contacts: OutreachEligibilityContact[] }>(`/api/backlinks/campaigns/${campaignId}/opportunities/${opportunityId}/outreach-eligibility?excludeOutreachId=${encodeURIComponent(String(outreach.id))}`); setOutreachEligibility({ contacts: result.contacts.filter((contact) => contact.eligibleChannels.length > 0) }); } catch { setOutreachDraftEditError("Impossible de charger les contacts éligibles."); } finally { setOutreachEligibilityLoading(false); } };
  const previewOutreachDraft = async () => { if (!outreachDraftDialog || !outreachDraftContactId || !outreachDraftChannel || outreachDraftPreviewLoading || outreachDraftSubmitting) return; setOutreachDraftPreviewLoading(true); setOutreachDraftError(null); try { const response = await apiRequest<{ result: { subject: string | null; body: string } }>("/api/internal/automation/backlinks/outreach/draft-preview", { method: "POST", body: JSON.stringify({ ...outreachDraftDialog, contactId: outreachDraftContactId, channel: outreachDraftChannel }) }); setOutreachDraftPreview(response.result); } catch (error) { setOutreachDraftError(error instanceof Error ? error.message : "Prévisualisation impossible."); } finally { setOutreachDraftPreviewLoading(false); } };
  const applyOutreachDraft = async () => { if (!outreachDraftDialog || !outreachDraftContactId || !outreachDraftChannel || !outreachDraftPreview || outreachDraftSubmitting) return; setOutreachDraftSubmitting(true); setOutreachDraftError(null); try { const response = await apiRequest<{ result: { disposition: "created" | "existing"; subject: string | null; body: string } }>("/api/internal/automation/backlinks/outreach/drafts/apply", { method: "POST", body: JSON.stringify({ ...outreachDraftDialog, contactId: outreachDraftContactId, channel: outreachDraftChannel, confirm: true }) }); setOutreachDraftPreview({ subject: response.result.subject, body: response.result.body }); setOutreachDraftSuccess(response.result.disposition === "created" ? "Brouillon créé." : "Brouillon déjà existant."); await loadDashboard(); } catch (error) { setOutreachDraftError(error instanceof Error ? error.message : "Création du brouillon impossible."); } finally { setOutreachDraftSubmitting(false); } };
  const closeOutreachDraftEditDialog = () => { if (outreachDraftEditSubmitting) return; setOutreachDraftEditDialog(null); setOutreachDraftEditError(null); setOutreachDraftEditSuccess(null); };
  const getOutreachDraftEditContacts = (): OutreachEligibilityContact[] => {
    if (!outreachDraftEditDialog) return [];
    const contacts = [...(outreachEligibility?.contacts ?? [])];
    const currentContactId = typeof outreachDraftEditDialog.contact_id === "string" ? outreachDraftEditDialog.contact_id : "";
    if (!currentContactId) return contacts;
    const currentChannel = outreachDraftEditChannel === "" ? null : outreachDraftEditChannel;
    const existing = contacts.find((item) => item.contactId === currentContactId);
    const currentLabel = contactLabel(pages.contacts.items, currentContactId);
    const label = currentLabel === "—" ? currentContactId : currentLabel;
    if (existing == null) {
      return [{ contactId: currentContactId, label, eligibleChannels: currentChannel == null ? [] : [currentChannel] }, ...contacts];
    }
    if (currentChannel != null && !existing.eligibleChannels.includes(currentChannel)) {
      return contacts.map((item) => item.contactId === currentContactId ? { ...item, eligibleChannels: [...item.eligibleChannels, currentChannel] } : item);
    }
    return contacts;
  };
  const handleOutreachDraftEditContactChange = (contactId: string) => { setOutreachDraftEditContactId(contactId); const contact = getOutreachDraftEditContacts().find((item) => item.contactId === contactId); if (!contact?.eligibleChannels.includes(outreachDraftEditChannel as "email" | "linkedin" | "contact_form")) setOutreachDraftEditChannel(""); };
  const handleSaveOutreachDraftEdit = async () => { if (!outreachDraftEditDialog || outreachDraftEditSubmitting || !outreachDraftEditContactId || !outreachDraftEditChannel) return; const contact = getOutreachDraftEditContacts().find((item) => item.contactId === outreachDraftEditContactId); if (!contact?.eligibleChannels.includes(outreachDraftEditChannel)) { setOutreachDraftEditError("Le contact ou le canal n’est plus éligible."); return; } setOutreachDraftEditSubmitting(true); setOutreachDraftEditError(null); try { await apiRequest(`/api/backlinks/outreach/${outreachDraftEditDialog.id}/draft`, { method: "PATCH", body: JSON.stringify({ subject: outreachDraftEditSubject || null, body: outreachDraftEditBody || null, contactId: outreachDraftEditContactId, channel: outreachDraftEditChannel }) }); setOutreachDraftEditSuccess("Brouillon enregistré."); await loadDashboard(); } catch (error) { setOutreachDraftEditError(error instanceof Error ? error.message : "Impossible d’enregistrer le brouillon."); } finally { setOutreachDraftEditSubmitting(false); } };

  const handleMarkOutreachReady = async () => { if (!outreachReadyDialog || outreachReadySubmitting) { return; } setOutreachReadySubmitting(true); setOutreachReadyError(null); try { await apiRequest(`/api/backlinks/outreach/${outreachReadyDialog.id}/ready`, { method: "POST", body: JSON.stringify({ confirm: true }) }); setOutreachReadySuccess("Brouillon marqué comme prêt."); await loadDashboard(); } catch (error) { setOutreachReadyError(error instanceof Error ? error.message : "Impossible de marquer le brouillon comme prêt."); } finally { setOutreachReadySubmitting(false); } };
  const handleReapproveOutreach = async () => { if (!outreachReapproveDialog || outreachReapproveSubmitting) { return; } setOutreachReapproveSubmitting(true); setOutreachReapproveError(null); try { await apiRequest(`/api/backlinks/outreach/${outreachReapproveDialog.id}/ready`, { method: "POST", body: JSON.stringify({ confirm: true, reapprove: true }) }); setOutreachReapproveSuccess("Outreach réapprouvé. Aucun email n’a été envoyé."); await loadDashboard(); } catch (error) { setOutreachReapproveError(error instanceof Error ? error.message : "Impossible de réapprouver l’outreach."); } finally { setOutreachReapproveSubmitting(false); } };
  const closeOutreachResponseDialog = () => { if (outreachResponseSubmitting) return; setOutreachResponseDialog(null); setOutreachResponseKind(null); setOutreachResponseStopReason(""); setOutreachResponseSubmitting(false); setOutreachResponseError(null); setOutreachResponseSuccess(null); };
  const openOutreachResponseDialog = (outreach: ApiRow) => { if (outreach.status !== "active") return; setOutreachResponseDialog(outreach); setOutreachResponseKind(null); setOutreachResponseStopReason(""); setOutreachResponseSubmitting(false); setOutreachResponseError(null); setOutreachResponseSuccess(null); };
  const handleOutreachResponse = async () => {
    const outreach = outreachResponseDialog;
    if (!outreach || outreachResponseSubmitting || outreach.status !== "active" || !outreachResponseKind) return;
    const stopReason = outreachResponseStopReason.trim();
    if (outreachResponseKind === "negative" && !stopReason) { setOutreachResponseError("Un motif est requis pour confirmer le refus."); return; }
    setOutreachResponseSubmitting(true);
    setOutreachResponseError(null);
    try {
      if (outreachResponseKind === "positive") {
        await apiRequest(`/api/backlinks/outreach/${outreach.id}/lifecycle`, { method: "POST", body: JSON.stringify({ confirm: true, action: "mark_replied", responseType: "positive" }) });
        setOutreachResponseSuccess("La réponse positive a été enregistrée.");
      } else {
        await apiRequest(`/api/backlinks/outreach/${outreach.id}/lifecycle`, { method: "POST", body: JSON.stringify({ confirm: true, action: "decline", stopReason }) });
        setOutreachResponseSuccess("Le refus a été enregistré.");
      }
      await loadDashboard();
    } catch (error) {
      if (error instanceof Error && error.message === "Outreach lifecycle transition unavailable.") { setOutreachResponseError("L’Outreach a changé. Le dashboard a été rechargé."); await loadDashboard(); }
      else setOutreachResponseError("La mise à jour du lifecycle est indisponible.");
    } finally { setOutreachResponseSubmitting(false); }
  };
  const closeOutreachLifecycleActionDialog = () => { if (outreachLifecycleSubmitting) return; setOutreachLifecycleActionDialog(null); setOutreachLifecycleAction(null); setOutreachLifecycleStopReason(""); setOutreachLifecycleSubmitting(false); setOutreachLifecycleError(null); setOutreachLifecycleSuccess(null); };
  const openOutreachLifecycleActionDialog = (outreach: ApiRow, action: OutreachLifecycleAction) => {
    const noResponseEligible = outreach.status === "active" && outreach.current_attempt === outreach.max_attempts;
    const conversationEligible = outreach.status === "replied" && outreach.last_response_type === "positive";
    const backlinkObtainedEligible = hasActiveConversationOpenBacklink(outreach);
    const closeEligible = outreach.status === "active";
    if ((action === "mark_no_response" && !noResponseEligible) || (action === "open_conversation" && !conversationEligible) || (action === "mark_backlink_obtained" && !backlinkObtainedEligible) || (action === "close" && !closeEligible)) return;
    setOutreachLifecycleActionDialog(outreach);
    setOutreachLifecycleAction(action);
    setOutreachLifecycleStopReason("");
    setOutreachLifecycleSubmitting(false);
    setOutreachLifecycleError(null);
    setOutreachLifecycleSuccess(null);
  };
  const handleOutreachLifecycleAction = async () => {
    const outreach = outreachLifecycleActionDialog;
    const action = outreachLifecycleAction;
    if (!outreach || !action || outreachLifecycleSubmitting) return;
    const noResponseEligible = outreach.status === "active" && outreach.current_attempt === outreach.max_attempts;
    const conversationEligible = outreach.status === "replied" && outreach.last_response_type === "positive";
    const backlinkObtainedEligible = hasActiveConversationOpenBacklink(outreach);
    const closeEligible = outreach.status === "active";
    const stopReason = outreachLifecycleStopReason.trim();
    if ((action === "mark_no_response" && !noResponseEligible) || (action === "open_conversation" && !conversationEligible) || (action === "mark_backlink_obtained" && !backlinkObtainedEligible) || (action === "close" && !closeEligible)) { setOutreachLifecycleError("Cette action n’est plus disponible. Le dashboard a été rechargé."); await loadDashboard(); return; }
    if (action === "close" && !stopReason) { setOutreachLifecycleError("Un motif est requis pour clôturer l’outreach."); return; }
    setOutreachLifecycleSubmitting(true);
    setOutreachLifecycleError(null);
    try {
      if (action === "mark_no_response") {
        await apiRequest(`/api/backlinks/outreach/${outreach.id}/lifecycle`, { method: "POST", body: JSON.stringify({ confirm: true, action: "mark_no_response" }) });
        setOutreachLifecycleSuccess("L’absence de réponse a été enregistrée.");
      } else if (action === "open_conversation") {
        await apiRequest(`/api/backlinks/outreach/${outreach.id}/lifecycle`, { method: "POST", body: JSON.stringify({ confirm: true, action: "open_conversation" }) });
        setOutreachLifecycleSuccess("La conversation a été ouverte.");
      } else if (action === "mark_backlink_obtained") {
        await apiRequest(`/api/backlinks/outreach/${outreach.id}/lifecycle`, { method: "POST", body: JSON.stringify({ confirm: true, action: "mark_backlink_obtained" }) });
        setOutreachLifecycleSuccess("Le backlink a été obtenu et l’outreach a été clôturé.");
      } else {
        await apiRequest(`/api/backlinks/outreach/${outreach.id}/lifecycle`, { method: "POST", body: JSON.stringify({ confirm: true, action: "close", stopReason }) });
        setOutreachLifecycleSuccess("L’outreach a été clôturé.");
      }
      await loadDashboard();
    } catch (error) {
      if (error instanceof Error && error.message === "Outreach lifecycle transition unavailable.") { setOutreachLifecycleError("L’Outreach a changé. Le dashboard a été rechargé."); await loadDashboard(); }
      else setOutreachLifecycleError("La mise à jour du lifecycle est indisponible.");
    } finally { setOutreachLifecycleSubmitting(false); }
  };
  const closeOutreachFinalNoResponseDialog = () => { if (outreachFinalNoResponseSubmitting) return; setOutreachFinalNoResponseDialog(null); setOutreachFinalNoResponseError(null); setOutreachFinalNoResponseSuccess(null); };
  const openOutreachFinalNoResponseDialog = (outreach: ApiRow) => { if (outreach.status !== "active" || outreach.finalNoResponseEligible !== true) return; setOutreachFinalNoResponseDialog(outreach); setOutreachFinalNoResponseError(null); setOutreachFinalNoResponseSuccess(null); };
  const handleOutreachFinalNoResponse = async () => {
    const outreach = outreachFinalNoResponseDialog;
    if (!outreach || outreachFinalNoResponseSubmitting || outreach.status !== "active" || outreach.finalNoResponseEligible !== true) return;
    setOutreachFinalNoResponseSubmitting(true);
    setOutreachFinalNoResponseError(null);
    try {
      const response = await apiRequest<{ result: { disposition: "applied" | "existing" } }>(`/api/backlinks/outreach/${outreach.id}/final-no-response`, { method: "POST", body: JSON.stringify({ confirm: true }) });
      setOutreachFinalNoResponseSuccess(response.result.disposition === "existing" ? "Cette réponse sans réponse avait déjà été enregistrée." : "L’absence de réponse a été enregistrée.");
      await loadDashboard();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cette action n’est plus disponible.";
      setOutreachFinalNoResponseError(message === "Final no-response confirmation unavailable." ? "Cet Outreach ne peut plus être marqué sans réponse dans son état actuel." : message);
      await loadDashboard();
    } finally {
      setOutreachFinalNoResponseSubmitting(false);
    }
  };
  const handleSendOutreachEmail = async () => { if (!outreachSendDialog || outreachSendSubmitting || !outreachSendIdempotencyKey || outreachSendDialog.status !== "ready") return; setOutreachSendSubmitting(true); setOutreachSendError(null); try { const response = await apiRequest<{ result: { disposition: string; attemptStatus: string } }>(`/api/backlinks/outreach/${outreachSendDialog.id}/send`, { method: "POST", body: JSON.stringify({ confirm: true, idempotencyKey: outreachSendIdempotencyKey }) }); if (response.result.attemptStatus === "unknown") { setOutreachSendResult("unknown"); await loadDashboard(); } else if (response.result.disposition === "existing") { setOutreachSendResult("Cet envoi avait déjà été confirmé."); await loadDashboard(); } else if (response.result.disposition === "sent" || response.result.disposition === "reconciled") { setOutreachSendResult("Email envoyé"); await loadDashboard(); } else if (response.result.disposition === "failed") { setOutreachSendError(outreachSendMode === "failed_retry" ? "Cette nouvelle tentative a échoué." : "L’envoi a échoué."); await loadDashboard(); } else setOutreachSendError("L’envoi n’a pas été accepté."); } catch (error) { if (error instanceof ApiRequestError && error.code === "OUTREACH_SEND_DISABLED_BY_DRY_RUN") { setOutreachSendError("L’envoi réel d’e-mails est désactivé tant que Backlinks est en mode DRY-RUN."); return; } const message = error instanceof Error ? error.message : "Impossible d’envoyer l’email."; if (message === "An outreach send attempt is already in progress.") { setOutreachSendError("Une tentative d’envoi est déjà en cours."); await loadDashboard(); } else if (message === "Resolve the uncertain outreach attempt before sending again.") { setOutreachSendError("Une tentative précédente a un statut incertain et doit être résolue avant tout nouvel envoi."); await loadDashboard(); } else setOutreachSendError(message); } finally { setOutreachSendSubmitting(false); } };
  const reloadOutreachAttemptHistory = async (outreachId: string) => { setOutreachAttemptHistoryError(null); setOutreachAttemptHistoryLoading(true); try { const response = await apiRequest<{ attempts: OutreachAttemptHistoryItem[]; deliveryEvents: OutreachDeliveryEventHistoryItem[] }>(`/api/backlinks/outreach/${outreachId}/attempts`); setOutreachAttemptHistoryAttempts(response.attempts); setOutreachAttemptHistoryDeliveryEvents(response.deliveryEvents); } catch { setOutreachAttemptHistoryError("Impossible de charger l’historique des tentatives."); } finally { setOutreachAttemptHistoryLoading(false); } };
  const openOutreachAttemptHistory = async (outreach: ApiRow) => { setOutreachAttemptHistoryDialog(outreach); setOutreachAttemptHistoryAttempts([]); setOutreachAttemptHistoryDeliveryEvents([]); await reloadOutreachAttemptHistory(String(outreach.id)); };
  const closeOutreachAttemptHistory = () => { setOutreachAttemptHistoryDialog(null); setOutreachAttemptHistoryAttempts([]); setOutreachAttemptHistoryDeliveryEvents([]); setOutreachAttemptHistoryError(null); setOutreachAttemptHistoryLoading(false); };
  const getTerminalSuccessContext = (outreach: ApiRow): { statusLabel: string; resultLabel: string; closedAtLabel: string; links: { sourceUrl: string; targetUrl: string; statusLabel: string }[] } | null => {
    if (outreach.status !== "closed" || outreach.stop_reason !== "backlink_obtained") return null;
    const snapshotSourceUrl = typeof outreach.success_source_url === "string" ? outreach.success_source_url : null;
    const snapshotTargetUrl = typeof outreach.success_target_url === "string" ? outreach.success_target_url : null;
    const snapshotLinkStatus = typeof outreach.success_link_status === "string" ? outreach.success_link_status : null;
    const snapshotVerifiedAt = typeof outreach.success_verified_at === "string" ? outreach.success_verified_at : null;
    if (snapshotSourceUrl && snapshotTargetUrl && snapshotLinkStatus && snapshotVerifiedAt) {
      return {
        statusLabel: "Clôturé",
        resultLabel: "Backlink obtenu",
        closedAtLabel: formatDate(outreach.closed_at),
        links: [{ sourceUrl: snapshotSourceUrl, targetUrl: snapshotTargetUrl, statusLabel: linkStatusLabel(snapshotLinkStatus) }],
      };
    }
    return {
      statusLabel: "Clôturé",
      resultLabel: "Backlink obtenu",
      closedAtLabel: formatDate(outreach.closed_at),
      links: pages.links.items.filter((link): link is typeof link & { source_url: string; target_url: string; status: string } => link.outreach_id === outreach.id && typeof link.source_url === "string" && typeof link.target_url === "string" && typeof link.status === "string").map((link) => ({ sourceUrl: link.source_url, targetUrl: link.target_url, statusLabel: linkStatusLabel(link.status) })),
    };
  };
  const reloadInboundReplies = async (outreachId: string) => { setInboundRepliesLoading(true); setInboundRepliesLoadError(null); try { const response = await apiRequest<{ replies?: unknown }>(`/api/backlinks/outreach/${outreachId}/inbound`); if (!Array.isArray(response.replies)) throw new Error("Invalid replies"); setInboundReplies(response.replies.filter((value): value is OutreachInboundReplyItem => typeof value === "object" && value != null && typeof (value as OutreachInboundReplyItem).id === "string" && typeof (value as OutreachInboundReplyItem).sender === "string" && typeof (value as OutreachInboundReplyItem).occurredAt === "string" && typeof (value as OutreachInboundReplyItem).effectApplied === "boolean")); } catch { setInboundReplies([]); setInboundRepliesLoadError("Impossible de charger les réponses reçues."); } finally { setInboundRepliesLoading(false); } };
  const handleOpenInboundReplies = async (outreach: ApiRow) => { if (!outreach?.id) return; setInboundRepliesDialogOutreach(outreach); setInboundReplies([]); setInboundReplyClassificationError(null); setInboundReplyClassificationSuccess(null); setInboundReplyPendingConfirmation(null); await reloadInboundReplies(String(outreach.id)); };
  const handleCloseInboundReplies = () => { if (inboundReplySubmittingMessageId != null) return; setInboundRepliesDialogOutreach(null); setInboundReplies([]); setInboundRepliesLoading(false); setInboundRepliesLoadError(null); setInboundReplySubmittingMessageId(null); setInboundReplyClassificationError(null); setInboundReplyClassificationSuccess(null); setInboundReplyPendingConfirmation(null); };
  const handleConfirmInboundReplyClassification = async () => { const outreach = inboundRepliesDialogOutreach; const pending = inboundReplyPendingConfirmation; if (!outreach || !pending || !pending.messageId || inboundReplySubmittingMessageId != null || (pending.classification !== "positive" && pending.classification !== "negative")) return; setInboundReplySubmittingMessageId(pending.messageId); setInboundReplyClassificationError(null); setInboundReplyClassificationSuccess(null); try { const response = await apiRequest<{ result?: { disposition?: unknown; classification?: unknown } }>(`/api/backlinks/outreach/${outreach.id}/inbound/${pending.messageId}/classify`, { method: "POST", body: JSON.stringify({ confirm: true, classification: pending.classification }) }); const result = response.result; if (!result || (result.disposition !== "applied" && result.disposition !== "existing") || (result.classification !== "positive" && result.classification !== "negative")) throw new Error("Invalid classification result"); setInboundReplyClassificationSuccess(result.disposition === "existing" ? "Cette réponse avait déjà été classifiée." : result.classification === "positive" ? "Réponse classifiée comme positive." : "Réponse classifiée comme négative."); await Promise.all([reloadInboundReplies(String(outreach.id)), loadDashboard()]); } catch { setInboundReplyClassificationError("Cette réponse ne peut plus être classifiée dans l’état actuel de l’outreach."); await Promise.all([reloadInboundReplies(String(outreach.id)), loadDashboard()]); } finally { setInboundReplyPendingConfirmation(null); setInboundReplySubmittingMessageId(null); } };
  const openOutreachUnknownResolutionDialog = (attempt: OutreachAttemptHistoryItem) => { const currentAttempt = outreachAttemptHistoryAttempts.find((item) => item.id === attempt.id); if (!outreachAttemptHistoryDialog || currentAttempt?.status !== "unknown") return; setOutreachUnknownResolutionDialog(currentAttempt); setOutreachUnknownResolutionKind(null); setOutreachUnknownProviderMessageId(currentAttempt.providerMessageId ?? ""); setOutreachUnknownErrorCode(currentAttempt.errorCode ?? ""); setOutreachUnknownErrorMessage(currentAttempt.errorMessage ?? ""); setOutreachUnknownSubmitting(false); setOutreachUnknownError(null); setOutreachUnknownSuccess(null); };
  const closeOutreachUnknownResolutionDialog = () => { if (outreachUnknownSubmitting) return; setOutreachUnknownResolutionDialog(null); setOutreachUnknownResolutionKind(null); setOutreachUnknownProviderMessageId(""); setOutreachUnknownErrorCode(""); setOutreachUnknownErrorMessage(""); setOutreachUnknownSubmitting(false); setOutreachUnknownError(null); setOutreachUnknownSuccess(null); };
  const handleResolveUnknownAttempt = async () => {
    const outreach = outreachAttemptHistoryDialog;
    const attempt = outreachUnknownResolutionDialog;
    const currentAttempt = attempt ? outreachAttemptHistoryAttempts.find((item) => item.id === attempt.id) : undefined;
    if (!outreach || !attempt || outreachUnknownSubmitting || !outreachUnknownResolutionKind || currentAttempt?.status !== "unknown") {
      setOutreachUnknownError("Cette tentative n’est plus disponible pour résolution.");
      return;
    }

    setOutreachUnknownError(null);
    setOutreachUnknownSuccess(null);

    const payload = outreachUnknownResolutionKind === "accepted"
      ? {
          confirm: true,
          resolution: "accepted" as const,
          providerMessageId: outreachUnknownProviderMessageId.trim() === "" ? null : outreachUnknownProviderMessageId.trim(),
        }
      : (() => {
          const errorCode = outreachUnknownErrorCode.trim();
          const errorMessage = outreachUnknownErrorMessage.trim();
          return errorCode && errorMessage
            ? { confirm: true, resolution: "failed" as const, errorCode, errorMessage }
            : null;
        })();

    if (!payload) {
      setOutreachUnknownError("Un code et un message d’erreur sont requis pour confirmer l’échec.");
      return;
    }

    setOutreachUnknownSubmitting(true);
    try {
      const response = await apiRequest<{ result: { disposition: "updated" | "existing" | "reconciled" } }>(`/api/backlinks/outreach/${outreach.id}/attempts/${attempt.id}/resolve`, { method: "POST", body: JSON.stringify(payload) });
      setOutreachUnknownSuccess(response.result.disposition);
      await reloadOutreachAttemptHistory(String(outreach.id));
      await loadDashboard();
    } catch {
      setOutreachUnknownError("La résolution est indisponible ou a déjà été effectuée. L’historique a été rechargé.");
      await reloadOutreachAttemptHistory(String(outreach.id));
    } finally {
      setOutreachUnknownSubmitting(false);
    }
  };
  const handleRecoverRequestedAttempt = async (attempt: OutreachAttemptHistoryItem) => {
    const outreach = outreachAttemptHistoryDialog;
    const currentAttempt = outreachAttemptHistoryAttempts.find((item) => item.id === attempt.id);
    if (!outreach || !currentAttempt || currentAttempt.status !== "requested") return;
    try {
      const response = await apiRequest<{ result?: { disposition?: unknown } }>(`/api/backlinks/outreach/${outreach.id}/attempts/${attempt.id}/recover-requested`, { method: "POST", body: JSON.stringify({ confirm: true }) });
      if (!response.result || (response.result.disposition !== "updated" && response.result.disposition !== "existing")) throw new Error("Invalid recovery result");
      await reloadOutreachAttemptHistory(String(outreach.id));
      await loadDashboard();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setOutreachAttemptHistoryError(message === "Requested attempt recovery is not available yet." ? "Cette tentative est encore dans sa période de grâce. Réessayez plus tard." : "La récupération de la tentative est indisponible. L’historique a été rechargé.");
      await reloadOutreachAttemptHistory(String(outreach.id));
      await loadDashboard();
    }
  };
  const openOutreachFollowUpPrepareDialog = (outreach: ApiRow) => {
    const summary = outreachFollowUpSummary(outreach);
    if (summary?.state !== "due") return;
    setOutreachFollowUpPrepareDialog(outreach);
    setOutreachFollowUpPrepareIdempotencyKey(crypto.randomUUID());
    setOutreachFollowUpPrepareSubmitting(false);
    setOutreachFollowUpPrepareError(null);
    setOutreachFollowUpPrepareSuccess(null);
  };
  const closeOutreachFollowUpPrepareDialog = () => {
    if (outreachFollowUpPrepareSubmitting) return;
    setOutreachFollowUpPrepareDialog(null);
    setOutreachFollowUpPrepareIdempotencyKey(null);
    setOutreachFollowUpPrepareSubmitting(false);
    setOutreachFollowUpPrepareError(null);
    setOutreachFollowUpPrepareSuccess(null);
  };
  const handlePrepareOutreachFollowUp = async () => {
    const outreach = outreachFollowUpPrepareDialog;
    const summary = outreach ? outreachFollowUpSummary(outreach) : null;
    if (!outreach || !outreachFollowUpPrepareIdempotencyKey || outreachFollowUpPrepareSubmitting || summary?.state !== "due") return;
    setOutreachFollowUpPrepareSubmitting(true);
    setOutreachFollowUpPrepareError(null);
    setOutreachFollowUpPrepareSuccess(null);
    try {
      const response = await apiRequest<{ result: { disposition: "prepared" | "existing" } }>(`/api/backlinks/outreach/${outreach.id}/follow-up/prepare`, { method: "POST", body: JSON.stringify({ confirm: true, idempotencyKey: outreachFollowUpPrepareIdempotencyKey }) });
      if (response.result.disposition !== "prepared" && response.result.disposition !== "existing") throw new Error("Invalid follow-up preparation result.");
      setOutreachFollowUpPrepareSuccess("Relance préparée. Vous pouvez maintenant relire le brouillon avant envoi.");
      await loadDashboard();
    } catch {
      setOutreachFollowUpPrepareError("Cette relance ne peut plus être préparée dans l’état actuel.");
      await loadDashboard();
    } finally {
      setOutreachFollowUpPrepareSubmitting(false);
    }
  };
  const closeOutreachFollowUpDraftDialog = () => {
    if (outreachFollowUpDraftSubmitting || outreachFollowUpDraftSendSubmitting) return;
    setOutreachFollowUpDraftDialog(null);
    setOutreachFollowUpDraftLoading(false);
    setOutreachFollowUpDraftSubject("");
    setOutreachFollowUpDraftBody("");
    setOutreachFollowUpDraftSubmitting(false);
    setOutreachFollowUpDraftError(null);
    setOutreachFollowUpDraftSuccess(null);
    setOutreachFollowUpDraftSendConfirmationOpen(false);
    setOutreachFollowUpDraftSendSubmitting(false);
    setOutreachFollowUpDraftSendError(null);
    setOutreachFollowUpDraftSendSuccess(null);
  };
  const openOutreachFollowUpDraftDialog = async (outreach: ApiRow) => {
    const summary = outreachFollowUpSummary(outreach);
    if (summary?.state !== "prepared" || !summary.attemptId) return;
    setOutreachFollowUpDraftDialog({ outreach, attemptId: summary.attemptId, draft: null });
    setOutreachFollowUpDraftLoading(true);
    setOutreachFollowUpDraftSubject("");
    setOutreachFollowUpDraftBody("");
    setOutreachFollowUpDraftSubmitting(false);
    setOutreachFollowUpDraftError(null);
    setOutreachFollowUpDraftSuccess(null);
    setOutreachFollowUpDraftSendConfirmationOpen(false);
    setOutreachFollowUpDraftSendSubmitting(false);
    setOutreachFollowUpDraftSendError(null);
    setOutreachFollowUpDraftSendSuccess(null);
    try {
      const response = await apiRequest<{ ok?: boolean; result?: unknown }>(`/api/backlinks/outreach/${outreach.id}/attempts/${summary.attemptId}/follow-up-draft`);
      const draft = response.result;
      if (typeof draft !== "object" || draft == null || Array.isArray(draft)) throw new Error("Invalid follow-up draft result");
      const record = draft as Record<string, unknown>;
      if (typeof record.attemptId !== "string" || typeof record.followUpNumber !== "number" || typeof record.subject !== "string" || typeof record.body !== "string" || typeof record.preparedAt !== "string" || typeof record.updatedAt !== "string") throw new Error("Invalid follow-up draft result");
      setOutreachFollowUpDraftDialog({ outreach, attemptId: summary.attemptId, draft: { attemptId: record.attemptId, followUpNumber: record.followUpNumber, subject: record.subject, body: record.body, preparedAt: record.preparedAt, updatedAt: record.updatedAt } });
      setOutreachFollowUpDraftSubject(record.subject);
      setOutreachFollowUpDraftBody(record.body);
    } catch {
      setOutreachFollowUpDraftError("Le brouillon de relance est indisponible.");
    } finally {
      setOutreachFollowUpDraftLoading(false);
    }
  };
  const handleSaveOutreachFollowUpDraft = async () => {
    const dialog = outreachFollowUpDraftDialog;
    const draft = dialog?.draft;
    if (!dialog || !draft || outreachFollowUpDraftLoading || outreachFollowUpDraftSubmitting) return;
    const subject = outreachFollowUpDraftSubject.trim();
    const body = outreachFollowUpDraftBody.trim();
    if (!subject || !body) {
      setOutreachFollowUpDraftError("Le sujet et le corps de la relance sont requis.");
      return;
    }
    setOutreachFollowUpDraftSubmitting(true);
    setOutreachFollowUpDraftError(null);
    setOutreachFollowUpDraftSuccess(null);
    setOutreachFollowUpDraftSendError(null);
    setOutreachFollowUpDraftSendSuccess(null);
    try {
      const response = await apiRequest<{ ok?: boolean; result?: { attemptId?: unknown; followUpNumber?: unknown; subject?: unknown; body?: unknown; preparedAt?: unknown; updatedAt?: unknown } }>(`/api/backlinks/outreach/${dialog.outreach.id}/attempts/${dialog.attemptId}/follow-up-draft`, {
        method: "PATCH",
        body: JSON.stringify({ subject, body, expectedUpdatedAt: draft.updatedAt }),
      });
      const result = response.result;
      if (!result || typeof result.attemptId !== "string" || typeof result.followUpNumber !== "number" || typeof result.subject !== "string" || typeof result.body !== "string" || typeof result.preparedAt !== "string" || typeof result.updatedAt !== "string") throw new Error("Invalid follow-up draft result");
      setOutreachFollowUpDraftDialog({ outreach: dialog.outreach, attemptId: dialog.attemptId, draft: { attemptId: result.attemptId, followUpNumber: result.followUpNumber, subject: result.subject, body: result.body, preparedAt: result.preparedAt, updatedAt: result.updatedAt } });
      setOutreachFollowUpDraftSubject(result.subject);
      setOutreachFollowUpDraftBody(result.body);
      setOutreachFollowUpDraftSuccess("Le brouillon de relance a été enregistré.");
      await loadDashboard();
    } catch (error) {
      setOutreachFollowUpDraftError(error instanceof Error && error.message === "Le brouillon a été modifié ailleurs. Rechargez la version la plus récente." ? error.message : "Le brouillon de relance est indisponible.");
      await loadDashboard();
    } finally {
      setOutreachFollowUpDraftSubmitting(false);
    }
  };
  const handleRequestOutreachFollowUpSend = () => {
    const dialog = outreachFollowUpDraftDialog;
    const draft = dialog?.draft;
    if (!dialog || !draft || outreachFollowUpDraftLoading || outreachFollowUpDraftSubmitting || outreachFollowUpDraftSendSubmitting) return;
    if (draft.subject.trim() === "" || draft.body.trim() === "") {
      setOutreachFollowUpDraftSendError("Le sujet et le corps doivent être remplis avant l’envoi.");
      return;
    }
    if (outreachFollowUpDraftSubject.trim() !== draft.subject.trim() || outreachFollowUpDraftBody.trim() !== draft.body.trim()) {
      setOutreachFollowUpDraftSendError("Enregistrez les modifications avant l’envoi.");
      return;
    }
    setOutreachFollowUpDraftSendError(null);
    setOutreachFollowUpDraftSendSuccess(null);
    setOutreachFollowUpDraftSendConfirmationOpen(true);
  };
  const handleCancelOutreachFollowUpSendConfirmation = () => {
    if (outreachFollowUpDraftSendSubmitting) return;
    setOutreachFollowUpDraftSendConfirmationOpen(false);
  };
  const handleConfirmOutreachFollowUpSend = async () => {
    const dialog = outreachFollowUpDraftDialog;
    const draft = dialog?.draft;
    if (!dialog || !draft || outreachFollowUpDraftLoading || outreachFollowUpDraftSubmitting || outreachFollowUpDraftSendSubmitting) return;
    if (outreachFollowUpDraftSubject.trim() !== draft.subject.trim() || outreachFollowUpDraftBody.trim() !== draft.body.trim()) {
      setOutreachFollowUpDraftSendError("Enregistrez les modifications avant l’envoi.");
      setOutreachFollowUpDraftSendConfirmationOpen(false);
      return;
    }
    setOutreachFollowUpDraftSendSubmitting(true);
    setOutreachFollowUpDraftSendError(null);
    setOutreachFollowUpDraftSendSuccess(null);
    try {
      const response = await apiRequest<{ ok?: boolean; result?: { disposition?: unknown } }>(`/api/backlinks/outreach/${dialog.outreach.id}/attempts/${dialog.attemptId}/follow-up-send`, {
        method: "POST",
        body: JSON.stringify({ confirm: true }),
      });
      const disposition = response.result?.disposition;
      if (disposition !== "accepted" && disposition !== "failed" && disposition !== "unknown" && disposition !== "existing") throw new Error("Invalid follow-up send result");
      if (disposition === "accepted") {
        setOutreachFollowUpDraftSendSuccess("Relance envoyée.");
        await loadDashboard();
        return;
      }
      if (disposition === "existing") {
        setOutreachFollowUpDraftSendError("Cette relance n’est plus disponible pour envoi.");
      } else if (disposition === "failed") {
        setOutreachFollowUpDraftSendError("L’envoi de la relance a échoué.");
      } else {
        setOutreachFollowUpDraftSendError("Le résultat de l’envoi doit être vérifié.");
      }
      await loadDashboard();
    } catch {
      setOutreachFollowUpDraftSendError("Cette relance n’est plus disponible pour envoi.");
      await loadDashboard();
    } finally {
      setOutreachFollowUpDraftSendConfirmationOpen(false);
      setOutreachFollowUpDraftSendSubmitting(false);
    }
  };
  const toggleCampaignPreviewOpportunity = (opportunityId: string) => {
    setCampaignPreviewSelectedOpportunityIds((current) => {
      if (current.includes(opportunityId)) return current.filter((id) => id !== opportunityId);
      if (current.length >= 100) return current; // limit enforced by server
      return [...current, opportunityId];
    });
  };

  const selectAllCampaignOpportunities = () => {
    const available = pages.opportunities.items.slice(0, 100).map((o) => String(o.id));
    setCampaignPreviewSelectedOpportunityIds(available);
  };

  const clearCampaignPreviewSelection = () => setCampaignPreviewSelectedOpportunityIds([]);

  const handleRunCampaignPreview = async (): Promise<void> => {
    const editedCampaignId =
      editor?.section === "campaigns" && editor.row != null
        ? editor.row.id
        : campaignPreviewCampaignId;
    const opportunityIds =
      editor?.section === "campaigns" && editor.row != null
        ? activeCampaignMemberships.map((membership) => membership.opportunity_id)
        : campaignPreviewSelectedOpportunityIds;

    if (!workspaceResolved || !activeWorkspaceId?.trim() || editedCampaignId.trim() === "") {
      setCampaignPreviewError("Aucune campagne sélectionnée.");
      return;
    }
    if (opportunityIds.length > 100) {
      setCampaignPreviewError("Vous pouvez utiliser au maximum 100 opportunités.");
      return;
    }
    if (
      !Number.isInteger(campaignPreviewMaxSelectedOpportunities) ||
      !Number.isInteger(campaignPreviewMaxPerDomain) ||
      campaignPreviewMaxSelectedOpportunities < 1 ||
      campaignPreviewMaxSelectedOpportunities > 100 ||
      campaignPreviewMaxPerDomain < 1 ||
      campaignPreviewMaxPerDomain > 100 ||
      campaignPreviewMaxPerDomain > campaignPreviewMaxSelectedOpportunities
    ) {
      setCampaignPreviewError("Les limites du preview sont invalides.");
      return;
    }

    const campaignId = editedCampaignId;
    const idempotencyKey = `campaign-preview:${campaignId}:${Date.now()}`;
    const requestVersion = workspaceRequestVersionRef.current;
    setCampaignPreviewLoading(true);
    setCampaignPreviewError(null);
    setCampaignPreviewResult(null);
    setCampaignMembershipApplyResult(null);
    try {
      const response = await apiRequest<unknown>(
        "/api/internal/automation/backlinks/campaigns/preview",
        {
          method: "POST",
          body: JSON.stringify({
            campaignId,
            opportunityIds,
            requestedLimits: {
              maxSelectedOpportunities: campaignPreviewMaxSelectedOpportunities,
              maxPerDomain: campaignPreviewMaxPerDomain,
            },
            idempotencyKey,
          }),
        },
      );
      if (requestVersion !== workspaceRequestVersionRef.current) return;
      setCampaignPreviewResult(response);

    } catch (runError) {
      if (requestVersion !== workspaceRequestVersionRef.current) return;
      setCampaignPreviewError(runError instanceof Error ? runError.message : "La prévisualisation a échoué.");
    } finally {
      if (requestVersion !== workspaceRequestVersionRef.current) return;
      setCampaignPreviewLoading(false);
    }
  };

  const campaignPreviewResultRecord =
    isRecord(campaignPreviewResult) ? campaignPreviewResult : null;

  const campaignPreviewNestedResult =
    campaignPreviewResultRecord !== null &&
    "result" in campaignPreviewResultRecord &&
    isRecord(campaignPreviewResultRecord.result)
      ? campaignPreviewResultRecord.result
      : null;

  const previewKind =
    campaignPreviewNestedResult !== null &&
    "kind" in campaignPreviewNestedResult &&
    typeof campaignPreviewNestedResult.kind === "string"
      ? campaignPreviewNestedResult.kind
      : null;

  const previousCampaignPreviewTaskIdRef = useRef<string | null>(null);

  // Safely extract ids and selected count from the preview result
  const previewRunId = readNonEmptyString(campaignPreviewNestedResult, "runId");
  const previewTaskId = readNonEmptyString(campaignPreviewNestedResult, "taskId");
  const previewCampaignId = readNonEmptyString(campaignPreviewNestedResult, "campaignId");
  const previewSelected = readPreviewSelected(campaignPreviewNestedResult);
  const previewRequestedLimits = readPreviewRequestedLimits(campaignPreviewNestedResult);
  const previewMaxSelected = previewRequestedLimits.maxSelectedOpportunities ?? campaignPreviewMaxSelectedOpportunities;
  const previewMaxPerDomain = previewRequestedLimits.maxPerDomain ?? campaignPreviewMaxPerDomain;

  useEffect(() => {
    if (previousCampaignPreviewTaskIdRef.current !== null && previewTaskId !== previousCampaignPreviewTaskIdRef.current) {
      setCampaignMembershipApplyResult(null);
    }
    previousCampaignPreviewTaskIdRef.current = previewTaskId;
  }, [previewTaskId]);

  const canShowApplyButton =
    previewKind === "completed" &&
    typeof previewRunId === "string" &&
    previewRunId.trim() &&
    typeof previewTaskId === "string" &&
    previewTaskId.trim() &&
    typeof previewCampaignId === "string" &&
    previewCampaignId.trim() &&
    Number.isInteger(previewSelected) &&
    previewSelected > 0 &&
    !campaignMembershipApplySubmitting;

  const activeContent = sections[activeSection];
  const activePage = pages[activeSection];
  const automationExecution = automationLastResult?.kind === "rejected"
    ? null
    : automationLastResult?.execution ?? null;
  const qualificationPreview = automationExecution?.qualificationPreview ?? null;
  const promotionPreview = automationExecution?.promotionPreview ?? null;
  const discoveryCandidatesByKey = new Map(
    (automationExecution?.discoveryPreview?.candidates ?? []).map((candidate) => [
      candidate.candidateKey,
      candidate,
    ]),
  );
  const filteredQualificationResults = qualificationPreview?.results.filter(
    (result) => qualificationFilter === "all" || result.decision === qualificationFilter,
  ) ?? [];
  const visibleQualificationResults = filteredQualificationResults.slice(0, 10);
  const automationLastExecutedResult = automationLastResult?.kind === "rejected" ? null : automationLastResult;
  const qualificationApplyAvailabilityByCandidateKey = new Map(
    visibleQualificationResults.flatMap((result) => {
      const mappings = discoveryIntakeMappings.filter((mapping) => mapping.candidateKey === result.candidateKey && mapping.discoveryTaskId === automationExecution?.discoveryPreviewTaskId);
      if (mappings.length !== 1) return [];
      const matchedOpportunity = pages.opportunities.items.find((opportunity) => opportunity.id === mappings[0].opportunityId);
      const runId = automationLastExecutedResult?.run.id ?? "";
      const taskIdFromExecution = automationLastExecutedResult?.execution.qualificationPreviewTaskId ?? "";
      if (previousQualificationTaskIdRef.current === null) {
        previousQualificationTaskIdRef.current = taskIdFromExecution ?? "";
      }
      const taskId = previousQualificationTaskIdRef.current ?? taskIdFromExecution;
      const opportunityId = matchedOpportunity?.id ?? null;
      const canApply = automationLastExecutedResult != null
        && typeof runId === "string" && runId.trim()
        && typeof taskIdFromExecution === "string" && taskIdFromExecution.trim()
        && opportunityId != null
        && !qualificationApplySubmitting;
      return canApply ? [[result.candidateKey, { runId, taskId, opportunityId: String(opportunityId) }] as const] : [];
    }),
  );
  const qualificationBatchEligibleByCandidateKey = new Map(
    (qualificationPreview?.results ?? []).flatMap((result) => {
      if (result.decision !== "qualified") return [];
      const mappings = discoveryIntakeMappings.filter((mapping) => mapping.candidateKey === result.candidateKey && mapping.discoveryTaskId === automationExecution?.discoveryPreviewTaskId);
      if (mappings.length !== 1) return [];
      const opportunity = pages.opportunities.items.find((item) => item.id === mappings[0].opportunityId);
      if (opportunity == null || opportunity.qualification_status === "Blocked" || opportunity.qualification_status === "Not Suitable") return [];
      return [[result.candidateKey, { opportunityId: opportunity.id }] as const];
    }),
  );
  const qualificationBatchEligibleCandidateKeys = new Set(qualificationBatchEligibleByCandidateKey.keys());
  const qualificationTaskId = automationLastExecutedResult?.execution.qualificationPreviewTaskId ?? null;
  useEffect(() => {
    setQualificationBatchSelectedCandidateKeys([]);
    setQualificationBatchDialogOpen(false);
    setQualificationBatchError(null);
    setQualificationBatchResult(null);
    setRecentlyQualifiedOpportunityIds([]);
  }, [qualificationTaskId]);
  const toggleQualificationBatchCandidate = (candidateKey: string): void => {
    if (qualificationBatchSubmitting || !qualificationBatchEligibleByCandidateKey.has(candidateKey)) return;
    setQualificationBatchSelectedCandidateKeys((current) => current.includes(candidateKey) ? current.filter((value) => value !== candidateKey) : current.length >= 50 ? current : [...current, candidateKey]);
  };
  const selectAllQualificationBatchEligible = (): void => {
    if (qualificationBatchSubmitting) return;
    setQualificationBatchSelectedCandidateKeys([...qualificationBatchEligibleCandidateKeys].slice(0, 50));
  };
  const handleRequestQualificationApply = (result: AutomationQualificationPreviewView["results"][number]) => {
    const availability = qualificationApplyAvailabilityByCandidateKey.get(result.candidateKey);
    if (!availability) return;
    setQualificationApplyError(null);
    setQualificationApplyDialog({
      runId: availability.runId,
      taskId: availability.taskId,
      opportunityId: availability.opportunityId,
      decision: result.decision,
      opportunityLabel: opportunityLabel(pages.opportunities.items, pages.domains.items, availability.opportunityId),
    });
  };
  const promotionDuplicateItems = promotionPreview?.skippedItems.filter(
    (item) => item.skipCode === "DUPLICATE_CANDIDATE" || item.skipCode === "DUPLICATE_URL",
  ) ?? [];
  const promotionSkippedItems = promotionPreview?.skippedItems.filter(
    (item) => item.skipCode !== "DUPLICATE_CANDIDATE" && item.skipCode !== "DUPLICATE_URL",
  ) ?? [];
  const visiblePromotionProposals = (promotionPreview?.proposals ?? []).slice(0, 10);
  const selectedPromotionSkippedItems = promotionFilter === "duplicates"
    ? promotionDuplicateItems
    : promotionSkippedItems;
  const visiblePromotionSkippedItems = selectedPromotionSkippedItems.slice(0, 10);
  const normalizedOutreachSearch = outreachSearchQuery.trim().toLocaleLowerCase();
  const outreachChannels = [...new Set(pages.outreach.items.map((row) => String(row.channel)).filter(Boolean))];
  const filteredOutreachRows = pages.outreach.items.filter((row) => {
    const searchable = [campaignLabel(pages.campaigns.items, row.campaign_id), opportunityLabel(pages.opportunities.items, pages.domains.items, row.opportunity_id), contactLabel(pages.contacts.items, row.contact_id), outreachStatusLabel(row.status), outreachChannelLabel(row.channel), displayValue(row.outreach_key)].join(" ").toLocaleLowerCase();
    return (!normalizedOutreachSearch || searchable.includes(normalizedOutreachSearch)) && (!outreachCampaignFilter || row.campaign_id === outreachCampaignFilter) && (!outreachStatusFilter || row.status === outreachStatusFilter) && (!outreachChannelFilter || row.channel === outreachChannelFilter);
  });
  const outreachFiltersActive = Boolean(outreachSearchQuery || outreachCampaignFilter || outreachStatusFilter || outreachChannelFilter);
  const normalizedLinkSearch = linkSearchQuery.trim().toLocaleLowerCase();
  const filteredLinkRows = pages.links.items.filter((row) => {
    const searchable = [row.source_url, row.target_url, row.anchor_text, row.backlink_key, domainLabel(pages.domains.items, row.domain_id), assetLabel(pages.assets.items, row.asset_id), opportunityLabel(pages.opportunities.items, pages.domains.items, row.opportunity_id), linkOutreachLabel(pages.outreach.items, pages.contacts.items, pages.opportunities.items, pages.domains.items, pages.campaigns.items, row.outreach_id), linkStatusLabel(row.status), row.rel_type].map((value) => displayValue(value)).join(" ").toLocaleLowerCase();
    return (!normalizedLinkSearch || searchable.includes(normalizedLinkSearch)) && (!linkStatusFilter || row.status === linkStatusFilter) && (!linkDomainFilter || row.domain_id === linkDomainFilter) && (!linkAssetFilter || row.asset_id === linkAssetFilter) && (!linkOutreachFilter || row.outreach_id === linkOutreachFilter);
  });
  const linkFiltersActive = Boolean(linkSearchQuery || linkStatusFilter || linkDomainFilter || linkAssetFilter || linkOutreachFilter);
  const degradedLinkCount = pages.links.items.reduce((count, link) => count + (link.status === "lost" || link.status === "changed" ? 1 : 0), 0);
  const lostLinkCount = pages.links.items.reduce((count, link) => count + (link.status === "lost" ? 1 : 0), 0);
  const changedLinkCount = degradedLinkCount - lostLinkCount;
  const displayedRows = activeSection === "outreach" ? filteredOutreachRows : activeSection === "links" ? filteredLinkRows : activePage.items;
  const summaryCards = [
    { label: "Opportunités", description: "Domaines et pistes identifiés.", total: pages.opportunities.total },
    { label: "Campagnes", description: "Initiatives d’acquisition organisées.", total: pages.campaigns.total },
    { label: "Outreach", description: "Prises de contact suivies.", total: pages.outreach.total },
    { label: "Liens obtenus", description: "Backlinks enregistrés et vérifiés.", total: pages.links.total },
  ];

  return (
    <div className="space-y-6 text-slate-900">
      {campaignMembershipApplyToast ? (
        <div role="status" aria-live="polite" className="fixed right-4 top-6 z-50 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg">
          {campaignMembershipApplyToast.message}
        </div>
      ) : null}
      <section className="nk-card overflow-hidden rounded-3xl border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.11),transparent_34%),radial-gradient(circle_at_90%_10%,rgba(16,185,129,0.10),transparent_30%),linear-gradient(135deg,#ffffff_0%,#f8fafc_48%,#eef6ff_100%)] p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08),0_1px_0_rgba(255,255,255,0.75)_inset] md:p-8">
        <div className="max-w-3xl space-y-3">
          <span className="inline-flex rounded-full border border-slate-300 bg-white/80 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">Admin privé</span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">Pilotage des backlinks</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">Centralisez les opportunités, les campagnes d’outreach et les liens obtenus pour développer l’autorité SEO de Norixo.</p>
          </div>
        </div>
      </section>

      <section className="nk-card rounded-3xl border border-slate-200/80 bg-white/95 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.07),0_1px_0_rgba(255,255,255,0.75)_inset] md:p-6">
        <AutomationControl
          automationControlLoading={automationControlLoading}
          automationControlPresent={automationControl != null}
          automationControlBacklinksEnabled={automationControl?.backlinksEnabled ?? false}
          automationControlBacklinkOutreachScheduleApplyEnabled={automationControl?.backlinkOutreachScheduleApplyEnabled ?? false}
          automationControlDryRunOnly={automationControl?.dryRunOnly ?? true}
          automationError={automationError}
          workspaceResolved={workspaceResolved}
          activeWorkspaceId={activeWorkspaceId}
          automationSaving={automationSaving}
          automationDryRunSaving={automationDryRunSaving}
          automationScheduleApplySaving={automationSaving}
          automationRunning={automationRunning}
          discoveryProvider={discoveryProvider}
          discoveryQuery={discoveryQuery}
          discoveryCountryCode={discoveryCountryCode}
          discoveryLanguageCode={discoveryLanguageCode}
          discoveryMaxResults={discoveryMaxResults}
          discoveryMaxCandidates={discoveryMaxCandidates}
          discoveryConfigurationError={discoveryConfigurationError}
          onToggleAutomation={() => void handleToggleAutomation()}
          onToggleDryRunOnly={() => void handleToggleDryRunOnly()}
          onToggleOutreachScheduleApply={() => void handleToggleOutreachScheduleApply()}
          onRunAutomationNow={() => void handleRunAutomationNow()}
          onDiscoveryProviderChange={(value) => { const provider = value; if (isDiscoveryProviderOption(provider)) setDiscoveryProvider(provider); }}
          onDiscoveryQueryChange={(value) => setDiscoveryQuery(value)}
          onDiscoveryCountryCodeChange={(value) => setDiscoveryCountryCode(value)}
          onDiscoveryLanguageChange={(value) => setDiscoveryLanguageCode(value)}
          onDiscoveryMaxResultsChange={(value) => setDiscoveryMaxResults(value)}
          onDiscoveryMaxCandidatesChange={(value) => setDiscoveryMaxCandidates(value)}
        />
        {automationLastResult ? (
          <div aria-live="polite" className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            {automationLastResult.kind === "rejected" ? (
              <>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Dernière exécution de cette session</p>
                <p className="mt-2 font-semibold text-slate-900">
                  {automationLastResult.reason === "automation_disabled"
                    ? "L’automatisation est désactivée pour ce workspace."
                    : "Le mode dry-run est obligatoire."}
                </p>
              </>
            ) : (
              <>
                <AutomationSummary
                  heading="Dernière exécution de cette session"
                  statusLabel={automationLastResult.kind === "completed" ? "Exécution terminée" : (automationLastResult.kind === "pending_retry" ? "Nouvelle tentative en attente" : "Exécution échouée")}
                  issueMessage={(automationLastResult.kind === "pending_retry" || automationLastResult.kind === "failed") ? automationIssueMessage(automationLastResult.execution.lastIssue) : null}
                  issueTaskLabel={(automationLastResult.kind === "pending_retry" || automationLastResult.kind === "failed") && automationLastResult.execution.lastIssue ? automationIssueTaskLabel(automationLastResult.execution.lastIssue.taskKind) : null}
                  completedTasks={automationLastResult.execution.completedTasks}
                  retriedTasks={automationLastResult.execution.retriedTasks}
                  deadLetterTasks={automationLastResult.execution.deadLetterTasks}
                  workerInvocations={automationLastResult.execution.workerInvocations}
                  stoppedBecauseLabel={automationLastResult.execution.stoppedBecause === "empty" ? "File vide" : "Limite d’invocations atteinte"}
                  runDispositionLabel={automationLastResult.preparation.runDisposition === "created" ? "Créé" : "Réutilisé"}
                  taskDispositionLabels={automationLastResult.preparation.taskDispositions.map((disposition, index) => `Tâche ${index + 1} ${disposition === "created" ? "créée" : "réutilisée"}`)}
                />
                {automationLastResult.execution.discoveryPreview ? (
                  <DiscoveryPreview discoveryPreview={automationLastResult.execution.discoveryPreview} onRequestIntake={openDiscoveryIntakeDialog} />
                ) : null}
                {qualificationPreview ? (
                  <QualificationPreview
                    qualificationPreview={qualificationPreview}
                    qualificationFilter={qualificationFilter}
                    visibleQualificationResults={visibleQualificationResults}
                    filteredQualificationResults={filteredQualificationResults}
                    discoveryCandidatesByKey={discoveryCandidatesByKey}
                    qualificationApplySubmitting={qualificationApplySubmitting}
                    selectedCandidateKeys={qualificationBatchSelectedCandidateKeys}
                    batchEligibleCandidateKeys={qualificationBatchEligibleCandidateKeys}
                    batchSubmitting={qualificationBatchSubmitting}
                    onQualificationFilterChange={setQualificationFilter}
                    canRequestApply={(candidateKey) => qualificationApplyAvailabilityByCandidateKey.has(candidateKey)}
                    onRequestApply={handleRequestQualificationApply}
                    onToggleBatchCandidate={toggleQualificationBatchCandidate}
                    onSelectAllEligible={selectAllQualificationBatchEligible}
                    onClearSelection={() => setQualificationBatchSelectedCandidateKeys([])}
                    onRequestBatchApply={() => { setQualificationBatchError(null); setQualificationBatchResult(null); setQualificationBatchDialogOpen(true); }}
                  />
                ) : null}
                <PromotionPreview
                  promotionPreview={promotionPreview}
                  promotionFilter={promotionFilter}
                  setPromotionFilter={setPromotionFilter}
                  visiblePromotionProposals={visiblePromotionProposals}
                  selectedPromotionSkippedItems={selectedPromotionSkippedItems}
                  visiblePromotionSkippedItems={visiblePromotionSkippedItems}
                  appliedPromotionProposalKeys={appliedPromotionProposalKeys}
                  promotionApplySubmitting={promotionApplySubmitting}
                  onOpenPromotionApplyDialog={openPromotionApplyDialog}
                  promotionTaskId={automationLastResult?.promotionTaskId}
                  discoveryCandidatesByKey={discoveryCandidatesByKey}
                />
              <CampaignPreview
                campaigns={pages.campaigns.items.map((campaign) => ({ id: campaign.id, label: displayValue(campaign.name ?? campaign.campaign_key) }))}
                campaignId={campaignPreviewCampaignId}
                maxSelectedOpportunities={campaignPreviewMaxSelectedOpportunities}
                maxPerDomain={campaignPreviewMaxPerDomain}
                opportunities={pages.opportunities.items.slice(0, 50).map((opportunity) => ({ id: opportunity.id, label: `${opportunityLabel(pages.opportunities.items, pages.domains.items, opportunity.id)} — ${displayValue(opportunity.target_page_title ?? opportunity.opportunity_key)}` }))}
                totalOpportunities={pages.opportunities.items.length}
                selectedOpportunityIds={campaignPreviewSelectedOpportunityIds}
                error={campaignPreviewError}
                loading={campaignPreviewLoading}
                result={campaignPreviewResult}
                onCampaignChange={setCampaignPreviewCampaignId}
                onMaxSelectedOpportunitiesChange={(value) => setCampaignPreviewMaxSelectedOpportunities(Number(value) || 1)}
                onMaxPerDomainChange={(value) => setCampaignPreviewMaxPerDomain(Number(value) || 1)}
                onSelectAll={selectAllCampaignOpportunities}
                onClearSelection={clearCampaignPreviewSelection}
                onToggleOpportunity={toggleCampaignPreviewOpportunity}
                onReset={() => { setCampaignPreviewError(null); setCampaignPreviewResult(null); }}
                onRun={() => void handleRunCampaignPreview()}
              />
              </>
            )}
          </div>
        ) : null}
      </section>

      <section aria-label="Synthèse backlinks" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <article key={card.label} className="nk-card rounded-3xl border border-slate-200/80 bg-white/95 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.08),0_1px_0_rgba(255,255,255,0.62)_inset]">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{card.label}</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{loading ? "…" : card.total}</p>
            <p className="mt-3 text-sm leading-5 text-slate-600">{card.description}</p>
          </article>
        ))}
      </section>

      <section className="nk-card rounded-3xl border border-slate-200/80 bg-white/95 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.07),0_1px_0_rgba(255,255,255,0.75)_inset] md:p-6">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div role="tablist" aria-label="Sections backlinks" className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {(Object.keys(sections) as BacklinkSection[]).map((section) => {
              const isActive = activeSection === section;
              return <button key={section} type="button" role="tab" aria-selected={isActive} aria-controls={`backlinks-panel-${section}`} id={`backlinks-tab-${section}`} onClick={() => setActiveSection(section)} className={`rounded-full px-3.5 py-2 text-xs font-bold uppercase tracking-[0.12em] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600 ${isActive ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}>{sections[section].label}</button>;
            })}
          </div>
          <button type="button" onClick={() => openEditor(activeSection, null)} className="rounded-full bg-slate-900 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600">{activeSection === "assets" ? "Nouvel asset" : activeSection === "domains" ? "Nouveau domaine" : activeSection === "contacts" ? "Nouveau contact" : "Nouveau"}</button>
        </div>

        <div id={`backlinks-panel-${activeSection}`} role="tabpanel" aria-labelledby={`backlinks-tab-${activeSection}`} className="pt-6">
          <div className="mb-4 flex items-center justify-between gap-4"><div><h2 className="text-lg font-semibold text-slate-950">{activeContent.title}</h2><p className="mt-1 text-sm text-slate-600">Données lues depuis la couche API Backlinks.</p></div><button type="button" onClick={() => void loadDashboard()} disabled={loading} className="text-sm font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">Actualiser</button></div>
          {activeSection === "outreach" ? <OutreachFilters searchQuery={outreachSearchQuery} campaignFilter={outreachCampaignFilter} statusFilter={outreachStatusFilter} channelFilter={outreachChannelFilter} campaigns={pages.campaigns.items.map((campaign) => ({ id: campaign.id, label: campaignLabel(pages.campaigns.items, campaign.id) }))} channels={outreachChannels} onSearchQueryChange={setOutreachSearchQuery} onCampaignFilterChange={setOutreachCampaignFilter} onStatusFilterChange={setOutreachStatusFilter} onChannelFilterChange={setOutreachChannelFilter} onReset={() => { setOutreachSearchQuery(""); setOutreachCampaignFilter(""); setOutreachStatusFilter(""); setOutreachChannelFilter(""); }} resetDisabled={!outreachFiltersActive} resultCount={filteredOutreachRows.length} totalCount={pages.outreach.items.length} filtersActive={outreachFiltersActive} statusLabel={outreachStatusLabel} channelLabel={outreachChannelLabel} /> : null}
          {activeSection === "links" ? <LinkFilters searchQuery={linkSearchQuery} statusFilter={linkStatusFilter} domainFilter={linkDomainFilter} assetFilter={linkAssetFilter} outreachFilter={linkOutreachFilter} domains={pages.domains.items.map((item) => ({ id: item.id, label: domainLabel(pages.domains.items, item.id) }))} assets={pages.assets.items.map((item) => ({ id: item.id, label: assetLabel(pages.assets.items, item.id) }))} outreach={pages.outreach.items.map((item) => ({ id: item.id, label: linkOutreachLabel(pages.outreach.items, pages.contacts.items, pages.opportunities.items, pages.domains.items, pages.campaigns.items, item.id) }))} resultCount={filteredLinkRows.length} totalCount={pages.links.items.length} filtersActive={linkFiltersActive} onSearchQueryChange={setLinkSearchQuery} onStatusFilterChange={setLinkStatusFilter} onDomainFilterChange={setLinkDomainFilter} onAssetFilterChange={setLinkAssetFilter} onOutreachFilterChange={setLinkOutreachFilter} onReset={() => { setLinkSearchQuery(""); setLinkStatusFilter(""); setLinkDomainFilter(""); setLinkAssetFilter(""); setLinkOutreachFilter(""); }} statusLabel={linkStatusLabel} /> : null}
          {activeSection === "links" && degradedLinkCount > 0 ? <div role="status" aria-live="polite" className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p className="font-semibold">{degradedLinkCount === 1 ? "1 backlink nécessite votre attention." : `${degradedLinkCount} backlinks nécessitent votre attention.`}</p><p className="mt-1">{lostLinkCount > 0 ? `${lostLinkCount} perdu${lostLinkCount > 1 ? "s" : ""}` : null}{lostLinkCount > 0 && changedLinkCount > 0 ? " · " : ""}{changedLinkCount > 0 ? `${changedLinkCount} modifié${changedLinkCount > 1 ? "s" : ""}` : null}</p></div> : null}
          {error ? <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800"><p>{error}</p><button type="button" onClick={() => void loadDashboard()} className="mt-2 font-semibold underline underline-offset-4">Réessayer</button></div> : null}
          {activeSection === "links" && verificationMessage ? <p role="status" aria-live="polite" className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{verificationMessage}</p> : null}
          {loading ? <div className="py-12 text-center text-sm text-slate-600">Chargement du cockpit Backlinks…</div> : null}
          {!loading && !error && displayedRows.length === 0 ? <div className="py-12 text-center"><p className="text-lg font-semibold text-slate-950">Aucun élément</p><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">{activeSection === "outreach" && pages.outreach.items.length > 0 && outreachFiltersActive ? <>Aucun Outreach ne correspond à ces filtres. <button type="button" onClick={() => { setOutreachSearchQuery(""); setOutreachCampaignFilter(""); setOutreachStatusFilter(""); setOutreachChannelFilter(""); }} className="font-semibold underline">Réinitialiser les filtres</button></> : activeSection === "links" && pages.links.items.length > 0 && linkFiltersActive ? <>Aucun backlink ne correspond à ces filtres. <button type="button" onClick={() => { setLinkSearchQuery(""); setLinkStatusFilter(""); setLinkDomainFilter(""); setLinkAssetFilter(""); setLinkOutreachFilter(""); }} className="font-semibold underline">Réinitialiser les filtres</button></> : activeContent.emptyState}</p></div> : null}
          {!loading && !error && displayedRows.length > 0 ? <div className="overflow-x-auto rounded-2xl border border-slate-200"><table className="min-w-full divide-y divide-slate-200 text-left text-sm"><thead className="bg-slate-50"><tr>{tableHeaders[activeSection].map((header) => <th key={header} scope="col" className="whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-[0.1em] text-slate-500">{header}</th>)}<th scope="col" className="px-4 py-3 text-right text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Actions</th></tr></thead><tbody className="divide-y divide-slate-100 bg-white">{displayedRows.map((row) => { const contact = activeSection === "outreach" ? (pages.contacts.items.find((item) => item.id === row.contact_id) as OutreachContactRow | undefined) ?? null : null; const sendAction = activeSection === "outreach" ? outreachSendAction(row, contact) : null; return <tr key={row.id}>{rowsFor(activeSection, row, pages.domains.items, pages.assets.items, pages.opportunities.items, pages.contacts.items).map((value, index) => <td key={`${row.id}-${tableHeaders[activeSection][index]}`} className="max-w-64 truncate px-4 py-3 text-slate-700" title={value}>{activeSection === "links" && index === 2 ? <div className="flex flex-wrap gap-1">{relTypeBadges(row.rel_type).map((badge) => <span key={badge} className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{badge}</span>)}</div> : activeSection === "links" && index === 3 ? <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${linkStatusVariant(row.status)}`}>{linkStatusLabel(row.status)}</span> : activeSection === "outreach" && index === 2 ? <div className="flex flex-wrap gap-1"><span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${outreachStatusVariant(row.status)}`}>{outreachStatusLabel(row.status)}</span><span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{outreachChannelLabel(row.channel)}</span></div> : activeSection === "outreach" && index === 4 ? outreachResponseLabel(row.last_response_type) : value}</td>)}<td className="px-4 py-3 text-right"><div className="flex justify-end gap-3">{activeSection === "campaigns" ? <button type="button" onClick={() => openEditor(activeSection, row)} className="rounded-full border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700">Modifier</button> : null}{activeSection === "links" ? <button type="button" onClick={() => openEditor(activeSection, row)} className="rounded-full border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700">Modifier</button> : null}{activeSection === "outreach" && row.status === "draft" ? <button type="button" onClick={() => openEditor(activeSection, row)} className="font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-950">Modifier</button> : null}{activeSection === "outreach" && sendAction === "failed_retry" ? <button type="button" onClick={() => { setOutreachSendDialog(row); setOutreachSendMode("failed_retry"); setOutreachSendIdempotencyKey(crypto.randomUUID()); setOutreachSendError(null); setOutreachSendResult(null); }} className="rounded-full border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700">Nouvelle tentative</button> : null}{activeSection === "outreach" && sendAction === "initial_send" ? <button type="button" onClick={() => { setOutreachSendDialog(row); setOutreachSendMode("initial_send"); setOutreachSendIdempotencyKey(crypto.randomUUID()); setOutreachSendError(null); setOutreachSendResult(null); }} className="rounded-full border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700">Envoyer</button> : null}{activeSection === "outreach" ? <button type="button" onClick={() => void openOutreachAttemptHistory(row)} className="font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-950">Historique</button> : null}{activeSection === "outreach" && outreachFollowUpSummary(row)?.state === "due" ? <button type="button" onClick={() => openOutreachFollowUpPrepareDialog(row)} className="rounded-full border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700">Préparer la relance</button> : null}{activeSection === "outreach" && outreachFollowUpSummary(row)?.state === "prepared" ? <button type="button" onClick={() => void openOutreachFollowUpDraftDialog(row)} className="rounded-full border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700">Relire la relance</button> : null}{activeSection === "links" ? <button type="button" onClick={() => void handleVerifyLink(row.id)} disabled={verifyingLinkId !== null} className="font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">{verifyingLinkId === row.id ? "Vérification…" : "Vérifier maintenant"}</button> : null}</div></td></tr>;})}</tbody></table></div> : null}
        </div>
      </section>

      {activeSection === "outreach" ? <div className="mt-3 flex flex-wrap gap-2">{pages.outreach.items.filter((outreach) => outreach.status === "draft").map((outreach) => <button key={`draft-edit-${outreach.id}`} type="button" onClick={() => void openOutreachDraftEditDialog(outreach)} className="rounded-full border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700">Modifier le brouillon</button>)}</div> : null}
      {activeSection === "outreach" ? <div className="mt-3 flex flex-wrap gap-2">{pages.outreach.items.filter((outreach) => outreach.status === "draft").map((outreach) => <button key={`ready-${outreach.id}`} type="button" onClick={() => { setOutreachReadySubmitting(false); setOutreachReadyDialog(outreach); setOutreachReadyError(null); setOutreachReadySuccess(null); }} className="rounded-full border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700">Marquer comme prêt</button>)}</div> : null}
      {activeSection === "outreach" ? <div className="mt-3 flex flex-wrap gap-2">{pages.outreach.items.map((outreach) => { const contact = pages.contacts.items.find((item) => item.id === outreach.contact_id) as OutreachContactRow | undefined ?? null; const action = outreachSendAction(outreach, contact); if (action === "send_in_progress") return <span key={`send-progress-${outreach.id}`} className="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-600">Envoi en cours</span>; if (action === "resolution_required") return <span key={`send-resolution-${outreach.id}`} className="rounded-full border border-amber-200 px-3 py-1 text-sm font-semibold text-amber-800">Résolution requise</span>; if (action !== "initial_send") return null; return <button key={`send-${outreach.id}`} type="button" onClick={() => { setOutreachSendDialog(outreach); setOutreachSendMode(action); setOutreachSendIdempotencyKey(crypto.randomUUID()); setOutreachSendError(null); setOutreachSendResult(null); }} className="rounded-full border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700">Envoyer</button>; })}</div> : null}
      {activeSection === "outreach" ? <div className="mt-3 flex flex-wrap gap-2">{pages.outreach.items.map((outreach) => { const summary = inboundReplySummary(outreach); if (summary.correlatedCount === 0) return null; const pendingLabel = summary.unclassifiedCount > 0 ? outreach.status === "active" ? `${summary.unclassifiedCount} à classer` : `${summary.unclassifiedCount} non classifiée${summary.unclassifiedCount > 1 ? "s" : ""}` : `${summary.correlatedCount} réponse${summary.correlatedCount > 1 ? "s" : ""}`; return <div key={`inbound-${outreach.id}`} className="flex items-center gap-2"><button type="button" onClick={() => void handleOpenInboundReplies(outreach)} className="rounded-full border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700">Réponses reçues</button><span className="text-sm text-slate-600">{pendingLabel}</span></div>; })}</div> : null}
      {activeSection === "outreach" ? <div className="mt-3 flex flex-wrap gap-2">{pages.outreach.items.map((outreach) => { const conversationOpenLinkPrefill = getConversationOpenLinkPrefill(outreach); const canReapprove = outreach.status === "ready" && typeof outreach.current_attempt === "number" && outreach.current_attempt === 0 && typeof outreach.attempt_count === "number" && outreach.attempt_count === 0; return <div key={`lifecycle-outreach-${outreach.id}`} className="flex flex-wrap gap-2">{canReapprove ? <button type="button" onClick={() => { setOutreachReapproveSubmitting(false); setOutreachReapproveDialog(outreach); setOutreachReapproveError(null); setOutreachReapproveSuccess(null); }} className="rounded-full border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700">Réapprouver</button> : null}{outreach.status === "active" ? <><button type="button" onClick={() => openOutreachResponseDialog(outreach)} className="rounded-full border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700">Réponse reçue</button>{outreach.finalNoResponseEligible === true ? <button type="button" onClick={() => openOutreachFinalNoResponseDialog(outreach)} className="rounded-full border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700">Marquer sans réponse</button> : null}<button type="button" onClick={() => openOutreachLifecycleActionDialog(outreach, "close")} className="rounded-full border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700">Clôturer</button></> : outreach.status === "replied" && outreach.last_response_type === "positive" ? <button type="button" onClick={() => openOutreachLifecycleActionDialog(outreach, "open_conversation")} className="rounded-full border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700">Ouvrir la conversation</button> : conversationOpenLinkPrefill != null || hasActiveConversationOpenBacklink(outreach) ? <>{conversationOpenLinkPrefill != null ? <button type="button" onClick={() => openConversationOpenLinkEditor(outreach)} className="rounded-full border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700">Enregistrer le backlink</button> : null}{hasActiveConversationOpenBacklink(outreach) ? <button type="button" onClick={() => openOutreachLifecycleActionDialog(outreach, "mark_backlink_obtained")} className="rounded-full border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700">Backlink obtenu</button> : null}</> : null}</div>; })}</div> : null}
      {outreachReadyDialog ? <OutreachReadyDialog outreach={{ contact: contactLabel(pages.contacts.items, outreachReadyDialog.contact_id), channel: String(outreachReadyDialog.channel), subject: typeof outreachReadyDialog.subject === "string" ? outreachReadyDialog.subject : null, body: typeof outreachReadyDialog.body === "string" ? outreachReadyDialog.body : null }} submitting={outreachReadySubmitting} error={outreachReadyError} success={outreachReadySuccess} onClose={() => { if (!outreachReadySubmitting) setOutreachReadyDialog(null); }} onConfirm={() => void handleMarkOutreachReady()} /> : null}
      {outreachReapproveDialog ? <div role="dialog" aria-modal="true" aria-labelledby="outreach-reapprove-title" className="fixed inset-0 z-50 bg-slate-950/40 p-4"><div className="mx-auto mt-12 max-w-xl rounded-3xl bg-white p-6"><h2 id="outreach-reapprove-title">Réapprouver l’outreach</h2><p className="mt-1 text-sm text-slate-600">{contactLabel(pages.contacts.items, outreachReapproveDialog.contact_id)} · {String(outreachReapproveDialog.channel)}</p><p className="mt-3 text-sm text-slate-600">Cette action reconstruit l’approbation d’un outreach déjà prêt, sans envoyer d’email.</p><p className="mt-4 text-sm font-semibold text-slate-700">Sujet</p><p>{typeof outreachReapproveDialog.subject === "string" ? outreachReapproveDialog.subject : "Sans objet"}</p><p className="mt-4 text-sm font-semibold text-slate-700">Contenu</p><pre className="whitespace-pre-wrap">{typeof outreachReapproveDialog.body === "string" ? outreachReapproveDialog.body : ""}</pre>{outreachReapproveError ? <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{outreachReapproveError}</p> : null}{outreachReapproveSuccess ? <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{outreachReapproveSuccess}</p> : null}<div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => { if (!outreachReapproveSubmitting) setOutreachReapproveDialog(null); }} disabled={outreachReapproveSubmitting} className="rounded-full px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">Annuler</button><button type="button" onClick={() => void handleReapproveOutreach()} disabled={outreachReapproveSubmitting} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{outreachReapproveSubmitting ? "Validation…" : "Réapprouver"}</button></div></div></div> : null}
      {outreachFinalNoResponseDialog ? <OutreachFinalNoResponseDialog outreachLabel={String(outreachFinalNoResponseDialog.outreach_key ?? outreachFinalNoResponseDialog.id)} responseDeadlineAt={typeof outreachFinalNoResponseDialog.response_deadline_at === "string" ? outreachFinalNoResponseDialog.response_deadline_at : null} currentAttempt={typeof outreachFinalNoResponseDialog.current_attempt === "number" ? outreachFinalNoResponseDialog.current_attempt : 0} maxAttempts={typeof outreachFinalNoResponseDialog.max_attempts === "number" ? outreachFinalNoResponseDialog.max_attempts : 0} submitting={outreachFinalNoResponseSubmitting} error={outreachFinalNoResponseError} success={outreachFinalNoResponseSuccess} onClose={closeOutreachFinalNoResponseDialog} onConfirm={() => void handleOutreachFinalNoResponse()} /> : null}
      {outreachDraftEditDialog ? <OutreachDraftEditDialog contacts={getOutreachDraftEditContacts()} contactId={outreachDraftEditContactId} channel={outreachDraftEditChannel} subject={outreachDraftEditSubject || null} body={outreachDraftEditBody || null} submitting={outreachDraftEditSubmitting} error={outreachDraftEditError} onClose={closeOutreachDraftEditDialog} onContactChange={handleOutreachDraftEditContactChange} onChannelChange={setOutreachDraftEditChannel} onSubjectChange={setOutreachDraftEditSubject} onBodyChange={setOutreachDraftEditBody} onSave={() => void handleSaveOutreachDraftEdit()} /> : null}
      {outreachSendDialog ? <OutreachSendDialog mode={outreachSendMode} outreach={{ recipient: contactLabel(pages.contacts.items, outreachSendDialog.contact_id), channel: String(outreachSendDialog.channel), subject: typeof outreachSendDialog.subject === "string" ? outreachSendDialog.subject : null, body: typeof outreachSendDialog.body === "string" ? outreachSendDialog.body : null }} submitting={outreachSendSubmitting} error={outreachSendError} result={outreachSendResult === "unknown" ? null : outreachSendResult} blocked={outreachSendResult === "unknown"} onClose={() => { if (outreachSendSubmitting) return; setOutreachSendDialog(null); setOutreachSendIdempotencyKey(null); setOutreachSendMode("initial_send"); setOutreachSendError(null); setOutreachSendResult(null); }} onConfirm={() => void handleSendOutreachEmail()} /> : null}
      {outreachFollowUpPrepareDialog ? <OutreachFollowUpPrepareDialog outreachLabel={String(outreachFollowUpPrepareDialog.outreach_key ?? outreachFollowUpPrepareDialog.id)} followUpLabel={`Prochaine relance : ${outreachFollowUpSummary(outreachFollowUpPrepareDialog)?.nextFollowUpAt ?? "à déterminer"}`} submitting={outreachFollowUpPrepareSubmitting} error={outreachFollowUpPrepareError} success={outreachFollowUpPrepareSuccess} onClose={closeOutreachFollowUpPrepareDialog} onConfirm={() => void handlePrepareOutreachFollowUp()} /> : null}
      {outreachFollowUpDraftDialog ? <OutreachFollowUpDraftDialog outreachLabel={String(outreachFollowUpDraftDialog.outreach.outreach_key ?? outreachFollowUpDraftDialog.outreach.id)} draft={outreachFollowUpDraftDialog.draft} loading={outreachFollowUpDraftLoading} dirty={outreachFollowUpDraftDialog.draft != null && (outreachFollowUpDraftSubject !== outreachFollowUpDraftDialog.draft.subject || outreachFollowUpDraftBody !== outreachFollowUpDraftDialog.draft.body)} submitting={outreachFollowUpDraftSubmitting} sendSubmitting={outreachFollowUpDraftSendSubmitting} sendConfirmationOpen={outreachFollowUpDraftSendConfirmationOpen} error={outreachFollowUpDraftError} success={outreachFollowUpDraftSuccess} sendError={outreachFollowUpDraftSendError} sendSuccess={outreachFollowUpDraftSendSuccess} onClose={closeOutreachFollowUpDraftDialog} onSubjectChange={setOutreachFollowUpDraftSubject} onBodyChange={setOutreachFollowUpDraftBody} onSave={() => void handleSaveOutreachFollowUpDraft()} onRequestSend={handleRequestOutreachFollowUpSend} onCancelSendConfirmation={handleCancelOutreachFollowUpSendConfirmation} onConfirmSend={() => void handleConfirmOutreachFollowUpSend()} /> : null}
      {outreachResponseDialog ? <OutreachResponseDialog outreach={{ id: String(outreachResponseDialog.id), outreachKey: String(outreachResponseDialog.outreach_key ?? outreachResponseDialog.id), contact: contactLabel(pages.contacts.items, outreachResponseDialog.contact_id), channel: String(outreachResponseDialog.channel) }} responseKind={outreachResponseKind} stopReason={outreachResponseStopReason} submitting={outreachResponseSubmitting} error={outreachResponseError} success={outreachResponseSuccess} onClose={closeOutreachResponseDialog} onResponseKindChange={setOutreachResponseKind} onStopReasonChange={setOutreachResponseStopReason} onConfirm={() => void handleOutreachResponse()} /> : null}
      {outreachLifecycleActionDialog && outreachLifecycleAction ? <OutreachLifecycleActionDialog outreach={{ id: String(outreachLifecycleActionDialog.id), outreachKey: String(outreachLifecycleActionDialog.outreach_key ?? outreachLifecycleActionDialog.id), status: String(outreachLifecycleActionDialog.status), currentAttempt: typeof outreachLifecycleActionDialog.current_attempt === "number" ? outreachLifecycleActionDialog.current_attempt : 0, maxAttempts: typeof outreachLifecycleActionDialog.max_attempts === "number" ? outreachLifecycleActionDialog.max_attempts : 0, closedAt: typeof outreachLifecycleActionDialog.closed_at === "string" ? outreachLifecycleActionDialog.closed_at : null, stopReason: typeof outreachLifecycleActionDialog.stop_reason === "string" ? outreachLifecycleActionDialog.stop_reason : null }} action={outreachLifecycleAction} stopReason={outreachLifecycleStopReason} submitting={outreachLifecycleSubmitting} error={outreachLifecycleError} success={outreachLifecycleSuccess} onClose={closeOutreachLifecycleActionDialog} onStopReasonChange={setOutreachLifecycleStopReason} onConfirm={() => void handleOutreachLifecycleAction()} /> : null}
      {outreachAttemptHistoryDialog ? <OutreachAttemptHistoryDialog outreachLabel={String(outreachAttemptHistoryDialog.outreach_key ?? outreachAttemptHistoryDialog.id)} attempts={outreachAttemptHistoryAttempts} deliveryEvents={outreachAttemptHistoryDeliveryEvents} loading={outreachAttemptHistoryLoading} error={outreachAttemptHistoryError} terminalSuccess={getTerminalSuccessContext(outreachAttemptHistoryDialog)} onClose={closeOutreachAttemptHistory} onRequestResolve={openOutreachUnknownResolutionDialog} onRequestRecoverRequested={handleRecoverRequestedAttempt} /> : null}
      <OutreachInboundRepliesDialog open={inboundRepliesDialogOutreach != null} outreachLabel={String(inboundRepliesDialogOutreach?.outreach_key ?? inboundRepliesDialogOutreach?.id ?? "")} outreachStatus={String(inboundRepliesDialogOutreach?.status ?? "")} outreachLastResponseType={typeof inboundRepliesDialogOutreach?.last_response_type === "string" ? inboundRepliesDialogOutreach.last_response_type : null} outreachClosedAt={typeof inboundRepliesDialogOutreach?.closed_at === "string" ? inboundRepliesDialogOutreach.closed_at : null} outreachStopReason={typeof inboundRepliesDialogOutreach?.stop_reason === "string" ? inboundRepliesDialogOutreach.stop_reason : null} outreachNextFollowUpAt={typeof inboundRepliesDialogOutreach?.next_follow_up_at === "string" ? inboundRepliesDialogOutreach.next_follow_up_at : null} replies={inboundReplies} loading={inboundRepliesLoading} loadError={inboundRepliesLoadError} submittingMessageId={inboundReplySubmittingMessageId} classificationError={inboundReplyClassificationError} classificationSuccess={inboundReplyClassificationSuccess} pendingConfirmation={inboundReplyPendingConfirmation} onClose={handleCloseInboundReplies} onRequestClassification={(messageId, classification) => setInboundReplyPendingConfirmation({ messageId, classification })} onConfirmClassification={() => void handleConfirmInboundReplyClassification()} onCancelClassification={() => setInboundReplyPendingConfirmation(null)} />
      {outreachUnknownResolutionDialog ? <OutreachUnknownResolutionDialog attempt={outreachUnknownResolutionDialog} resolutionKind={outreachUnknownResolutionKind} providerMessageId={outreachUnknownProviderMessageId} errorCode={outreachUnknownErrorCode} errorMessage={outreachUnknownErrorMessage} submitting={outreachUnknownSubmitting} error={outreachUnknownError} success={outreachUnknownSuccess} onClose={closeOutreachUnknownResolutionDialog} onResolutionKindChange={setOutreachUnknownResolutionKind} onProviderMessageIdChange={setOutreachUnknownProviderMessageId} onErrorCodeChange={setOutreachUnknownErrorCode} onErrorMessageChange={setOutreachUnknownErrorMessage} onConfirm={() => void handleResolveUnknownAttempt()} /> : null}
      {promotionApplyDialog ? (
        <PromotionApplyDialog
          dialog={promotionApplyDialog}
          assets={activePromotionAssets.map((asset) => ({ id: asset.id, label: `${displayValue(asset.display_name)} — ${displayValue(asset.asset_key)}${asset.canonical_url ? ` · ${asset.canonical_url}` : ""}` }))}
          assetId={promotionApplyAssetId}
          submitting={promotionApplySubmitting}
          error={promotionApplyError}
          success={promotionApplySuccess}
          onClose={closePromotionApplyDialog}
          onAssetChange={setPromotionApplyAssetId}
          onConfirm={() => void handleApplyPromotion()}
        />
      ) : null}
      {discoveryIntakeDialog ? (
        <DiscoveryOpportunityIntakeDialog
          dialog={discoveryIntakeDialog}
          assets={activeDiscoveryIntakeAssets}
          assetId={discoveryIntakeAssetId}
          submitting={discoveryIntakeSubmitting}
          error={discoveryIntakeError}
          success={discoveryIntakeSuccess}
          onClose={closeDiscoveryIntakeDialog}
          onAssetChange={setDiscoveryIntakeAssetId}
          onConfirm={() => void handleConfirmDiscoveryOpportunityIntake()}
        />
      ) : null}
      {qualificationApplyDialog ? (
        <QualificationApplyDialog dialog={qualificationApplyDialog} decisionLabel={qualificationDecisionLabel(qualificationApplyDialog.decision)} submitting={qualificationApplySubmitting} error={qualificationApplyError} result={qualificationApplyResult} onClose={closeQualificationApplyDialog} onConfirm={() => void handleConfirmQualificationApply()} />
      ) : null}
      {qualificationBatchDialogOpen ? (
        <QualificationBatchApplyDialog count={qualificationBatchSelectedCandidateKeys.length} submitting={qualificationBatchSubmitting} error={qualificationBatchError} result={qualificationBatchResult} handoffCount={recentlyQualifiedOpportunityIds.length} onClose={closeQualificationBatchDialog} onConfirm={() => void handleApplyQualificationBatch()} onPrepareCampaign={handlePrepareCampaignFromQualificationBatch} />
      ) : null}
      {campaignMembershipApplyDialogOpen ? (
        <CampaignMembershipApplyDialog selected={previewSelected} submitting={campaignMembershipApplySubmitting} error={campaignMembershipApplyError} onClose={closeCampaignMembershipApplyDialog} onConfirm={() => void handleConfirmCampaignMembershipApply()} />
      ) : null}
      {editor?.section === "assets" && editor.row != null ? (
        <AssetLifecycleStatusField
          value={assetLifecycleStatus}
          disabled={submitting}
          onChange={(value) => {
            if (!isBacklinkAssetLifecycleStatus(value)) {
              setFormError("Le statut sélectionné est invalide.");
              return;
            }
            setAssetLifecycleStatus(value);
          }}
        />
      ) : null}
          {editor ? <div role="dialog" aria-modal="true" aria-labelledby="backlinks-editor-title" className="fixed inset-0 z-50 flex items-end bg-slate-950/40 p-4 sm:items-center sm:justify-center"><form onSubmit={(event) => { event.preventDefault(); if (editor.section === "opportunities") {
        setOpportunitySubmitAttempted(true);
        if (opportunityFormInvalid)
            return;
    } void submitEditor(new FormData(event.currentTarget)); }} onChange={(event) => handleEditorFieldInteraction(event.target)} onBlur={(event) => handleEditorFieldInteraction(event.target)} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-6"><div><h2 id="backlinks-editor-title" className="text-xl font-semibold text-slate-950">{editor.row == null ? "Nouvel élément" : "Modifier l’élément"}</h2><p className="mt-1 text-sm text-slate-600">{sections[editor.section].label}</p></div><button type="button" onClick={() => setEditor(null)} className="rounded-full px-3 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-100">Fermer</button></div>{editor.section === "opportunities" && !hasDomains ? <div className="flex min-h-56 flex-col items-center justify-center text-center"><h3 className="text-lg font-semibold text-slate-950">Aucun domaine disponible</h3><p className="mt-2 max-w-md text-sm text-slate-600">Vous devez créer au moins un domaine avant de pouvoir enregistrer une opportunité de backlink.</p><button type="button" onClick={() => { setEditor(null); setActiveSection("domains"); openEditor("domains", null); }} className="mt-5 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Aller à Domains</button></div> : editor.section === "opportunities" && !hasAssets ? <div className="flex min-h-56 flex-col items-center justify-center text-center"><h3 className="text-lg font-semibold text-slate-950">Aucun asset Norixo disponible</h3><p className="mt-2 max-w-md text-sm text-slate-600">Créez d’abord un asset Norixo afin d’associer cette opportunité à une page de votre site.</p><button type="button" onClick={() => { setEditor(null); setActiveSection("assets"); openEditor("assets", null); }} className="mt-5 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Aller à Assets</button></div> : <><div className="mt-6 grid gap-4 sm:grid-cols-2">{(editor.row == null ? createFields[editor.section] : updateFields[editor.section]).map((field) => <label key={field.key} className={field.type === "textarea" ? "sm:col-span-2" : ""}><span className="mb-1.5 block text-sm font-semibold text-slate-700">{field.label}{field.required ? " *" : ""}</span>{field.key === "outreach_id" && editor.section === "links" ? <select name="outreach_id" required disabled={pages.outreach.items.length === 0} value={editorFieldValue(field.key)} onChange={(event) => handleEditorFieldInteraction(event.target)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="">{pages.outreach.items.length === 0 ? "Aucune action Outreach" : "Sélectionnez une action Outreach"}</option>{pages.outreach.items.map((outreach) => <option key={outreach.id} value={outreach.id}>{linkOutreachLabel(pages.outreach.items, pages.contacts.items, pages.opportunities.items, pages.domains.items, pages.campaigns.items, outreach.id)}</option>)}</select> : field.key === "opportunity_id" && editor.section === "links" ? <select name="opportunity_id" required disabled={pages.opportunities.items.length === 0} value={editorFieldValue(field.key)} onChange={(event) => handleEditorFieldInteraction(event.target)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="">{pages.opportunities.items.length === 0 ? "Aucune opportunité" : "Sélectionnez une opportunité"}</option>{pages.opportunities.items.map((opportunity) => <option key={opportunity.id} value={opportunity.id}>{opportunityLabel(pages.opportunities.items, pages.domains.items, opportunity.id)}</option>)}</select> : field.key === "domain_id" && editor.section === "links" ? <select name="domain_id" required disabled={pages.domains.items.length === 0} value={editorFieldValue(field.key)} onChange={(event) => handleEditorFieldInteraction(event.target)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="">{pages.domains.items.length === 0 ? "Aucun domaine" : "Sélectionnez un domaine"}</option>{pages.domains.items.map((domain) => <option key={domain.id} value={domain.id}>{domainLabel(pages.domains.items, domain.id)}</option>)}</select> : field.key === "asset_id" && editor.section === "links" ? <select name="asset_id" required disabled={pages.assets.items.length === 0} value={editorFieldValue(field.key)} onChange={(event) => handleEditorFieldInteraction(event.target)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="">{pages.assets.items.length === 0 ? "Aucun asset" : "Sélectionnez un asset"}</option>{pages.assets.items.map((asset) => <option key={asset.id} value={asset.id}>{assetLabel(pages.assets.items, asset.id)}</option>)}</select> : field.key === "campaign_id" && editor.section === "outreach" ? <select name="campaign_id" required disabled={pages.campaigns.items.length === 0} value={editorFieldValue(field.key)} onChange={(event) => handleEditorFieldInteraction(event.target)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="">{pages.campaigns.items.length === 0 ? "Aucune campagne" : "Sélectionnez une campagne"}</option>{pages.campaigns.items.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaignLabel(pages.campaigns.items, campaign.id)}</option>)}</select> : field.key === "opportunity_id" && editor.section === "outreach" ? <select name="opportunity_id" required disabled={pages.opportunities.items.length === 0} value={editorFieldValue(field.key)} onChange={(event) => handleEditorFieldInteraction(event.target)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="">{pages.opportunities.items.length === 0 ? "Aucune opportunité" : "Sélectionnez une opportunité"}</option>{pages.opportunities.items.map((opportunity) => <option key={opportunity.id} value={opportunity.id}>{opportunityLabel(pages.opportunities.items, pages.domains.items, opportunity.id)}</option>)}</select> : field.key === "contact_id" && editor.section === "outreach" ? <select name="contact_id" required disabled={pages.contacts.items.length === 0} value={editorFieldValue(field.key)} onChange={(event) => handleEditorFieldInteraction(event.target)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="">{pages.contacts.items.length === 0 ? "Aucun contact" : "Sélectionnez un contact"}</option>{pages.contacts.items.map((contact) => <option key={contact.id} value={contact.id}>{contactLabel(pages.contacts.items, contact.id)}</option>)}</select> : field.key === "domain_id" && (editor.section === "contacts" || editor.section === "opportunities") ? <select name="domain_id" required disabled={editor.section === "contacts" && editor.row != null || pages.domains.items.length === 0} value={editorFieldValue(field.key)} onChange={(event) => handleEditorFieldInteraction(event.target)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="">Sélectionnez un domaine</option>{pages.domains.items.map((domain) => <option key={domain.id} value={domain.id}>{displayValue(domain.display_name ?? domain.hostname)}</option>)}</select> : field.key === "asset_id" && editor.section === "opportunities" ? <select name="asset_id" required disabled={pages.assets.items.length === 0} value={editorFieldValue(field.key)} onChange={(event) => handleEditorFieldInteraction(event.target)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="">Sélectionnez un asset</option>{pages.assets.items.map((asset) => <option key={asset.id} value={asset.id}>{displayValue(asset.display_name ?? asset.canonical_url)}</option>)}</select> : field.key === "opportunity_type" && editor.section === "opportunities" ? <select name="opportunity_type" required value={editorFieldValue(field.key)} onChange={(event) => handleEditorFieldInteraction(event.target)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="">Sélectionnez un type</option>{inputValue(editor.row, field.key) && !["Guest Post", "Link Insertion", "Resource Page", "Broken Link", "Digital PR", "Partnership", "Directory", "Other"].includes(inputValue(editor.row, field.key)) ? <option value={inputValue(editor.row, field.key)}>{inputValue(editor.row, field.key)}</option> : null}{["Guest Post", "Link Insertion", "Resource Page", "Broken Link", "Digital PR", "Partnership", "Directory", "Other"].map((option) => <option key={option} value={option}>{option}</option>)}</select> : field.key === "page_type" && editor.section === "opportunities" ? <select name="page_type" required value={editorFieldValue(field.key)} onChange={(event) => handleEditorFieldInteraction(event.target)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="">Sélectionnez un type</option>{inputValue(editor.row, field.key) && !["Blog", "Homepage", "Category", "Guide", "Comparison", "Tool", "Documentation", "Landing Page", "Other"].includes(inputValue(editor.row, field.key)) ? <option value={inputValue(editor.row, field.key)}>{inputValue(editor.row, field.key)}</option> : null}{["Blog", "Homepage", "Category", "Guide", "Comparison", "Tool", "Documentation", "Landing Page", "Other"].map((option) => <option key={option} value={option}>{option}</option>)}</select> : field.type === "textarea" ? <textarea name={field.key} required={field.required} defaultValue={editorFieldValue(field.key)} rows={4} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"/> : <input name={field.key} type={field.type ?? "text"} required={field.required} defaultValue={editorFieldValue(field.key)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"/>}{editor.section === "opportunities" && (opportunityTouched[field.key] || opportunitySubmitAttempted) && opportunityErrors[field.key] ? <p id={`opportunity-${field.key}-error`} role="alert" className="mt-1.5 text-sm text-rose-800">{opportunityErrors[field.key]}</p> : null}</label>)}</div>{editor.section === "opportunities" && editor.row != null ? <div className="mt-4 grid gap-4 sm:grid-cols-2"><label><span className="mb-1.5 block text-sm font-semibold text-slate-700">Type d’opportunité</span><select name="opportunity_type" value={editorFieldValue("opportunity_type")} onChange={(event) => handleEditorFieldInteraction(event.target)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="">Sélectionnez un type</option>{inputValue(editor.row, "opportunity_type") && !["Guest Post", "Link Insertion", "Resource Page", "Broken Link", "Digital PR", "Partnership", "Directory", "Other"].includes(inputValue(editor.row, "opportunity_type")) ? <option value={inputValue(editor.row, "opportunity_type")}>{inputValue(editor.row, "opportunity_type")}</option> : null}{["Guest Post", "Link Insertion", "Resource Page", "Broken Link", "Digital PR", "Partnership", "Directory", "Other"].map((option) => <option key={option} value={option}>{option}</option>)}</select></label><label><span className="mb-1.5 block text-sm font-semibold text-slate-700">Type de page</span><select name="page_type" value={editorFieldValue("page_type")} onChange={(event) => handleEditorFieldInteraction(event.target)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="">Sélectionnez un type</option>{inputValue(editor.row, "page_type") && !["Blog", "Homepage", "Category", "Guide", "Comparison", "Tool", "Documentation", "Landing Page", "Other"].includes(inputValue(editor.row, "page_type")) ? <option value={inputValue(editor.row, "page_type")}>{inputValue(editor.row, "page_type")}</option> : null}{["Blog", "Homepage", "Category", "Guide", "Comparison", "Tool", "Documentation", "Landing Page", "Other"].map((option) => <option key={option} value={option}>{option}</option>)}</select></label></div> : null}{editor.section === "campaigns" && editor.row != null ? <section className="mt-6 border-t border-slate-200 pt-6"><h3 className="text-sm font-semibold text-slate-950">Opportunités associées</h3>{campaignOpportunityMembershipsLoading ? <p className="mt-4 text-sm text-slate-600">Chargement des opportunités associées…</p> : campaignOpportunityMembershipsError ? <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{campaignOpportunityMembershipsError}</p> : <><div className="mt-4 space-y-2">{activeCampaignMemberships.length === 0 ? <p className="text-sm text-slate-600">Aucune opportunité associée à cette campagne.</p> : activeCampaignMemberships.map((membership) => <div key={membership.opportunity_id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2"><span className="text-sm text-slate-700">{campaignOpportunityLabel(membership.opportunity_id)}</span><div className="flex items-center gap-2"><button type="button" onClick={() => void openOutreachDraftDialog(String(editor.row?.id), membership.opportunity_id)} className="rounded-full border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700">Préparer un outreach</button><button type="button" onClick={() => void detachCampaignOpportunity(membership.opportunity_id)} disabled={detachingCampaignOpportunityId === membership.opportunity_id} className="rounded-full px-3 py-1 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Retirer</button></div></div>)}</div>{pages.opportunities.items.length === 0 ? <p className="mt-4 text-sm text-slate-600">Aucune opportunité disponible. Créez d’abord une opportunité dans l’onglet Opportunities.</p> : availableCampaignOpportunities.length === 0 ? <p className="mt-4 text-sm text-slate-600">Toutes les opportunités disponibles sont déjà associées à cette campagne.</p> : null}<div className="mt-4 flex flex-col gap-3 sm:flex-row"><select value={selectedCampaignOpportunityId} onChange={(event) => setSelectedCampaignOpportunityId(event.target.value)} disabled={attachingCampaignOpportunity || campaignOpportunityMembershipsLoading || availableCampaignOpportunities.length === 0} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="">Sélectionner une opportunité</option>{availableCampaignOpportunities.map((opportunity) => <option key={opportunity.id} value={opportunity.id}>{campaignOpportunityLabel(opportunity.id)}</option>)}</select><button type="button" onClick={() => void attachCampaignOpportunity()} disabled={campaignOpportunityMembershipsLoading || attachingCampaignOpportunity || !selectedCampaignOpportunityId || availableCampaignOpportunities.length === 0} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{attachingCampaignOpportunity ? "Ajout…" : "Ajouter"}</button></div></>}
            <div className="mt-6 border-t border-slate-200 pt-6" aria-busy={campaignPreviewLoading}>
  <h3 className="text-sm font-semibold text-slate-950">Campaign Preview</h3>
  <p className="mt-1 text-sm text-slate-600">
    Prévisualisez la sélection sans créer de membership ni lancer d’outreach.
  </p>

  <div className="mt-4 grid gap-4 sm:grid-cols-2">
    <label htmlFor="campaign-preview-max-selected">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">
        Maximum sélectionnées
      </span>
      <input id="campaign-preview-max-selected" type="number" min={1} max={100} value={campaignPreviewMaxSelectedOpportunities} onChange={(event) => {
                    setCampaignPreviewMaxSelectedOpportunities(Number(event.target.value));
                    setCampaignPreviewResult(null);
                    setCampaignPreviewError(null);
                }} disabled={campaignPreviewLoading} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"/>
    </label>

    <label htmlFor="campaign-preview-max-domain">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">
        Maximum par domaine
      </span>
      <input id="campaign-preview-max-domain" type="number" min={1} max={100} value={campaignPreviewMaxPerDomain} onChange={(event) => {
                    setCampaignPreviewMaxPerDomain(Number(event.target.value));
                    setCampaignPreviewResult(null);
                    setCampaignPreviewError(null);
                }} disabled={campaignPreviewLoading} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"/>
    </label>
  </div>

  <p className="mt-3 text-xs text-slate-500">
    Opportunités utilisées : {activeCampaignMemberships.length}
  </p>

  <div aria-live="polite">
    {campaignPreviewError ? (<p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">
        {campaignPreviewError}
      </p>) : null}

    {previewKind === "completed" && (<>
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <p className="font-semibold">Campaign Preview completed</p>
          <p className="mt-2">Selected opportunities : {previewSelected}</p>
          <p className="mt-1">Maximum selected : {previewMaxSelected}</p>
          <p className="mt-1">Maximum per domain : {previewMaxPerDomain}</p>
        </div>

        {campaignMembershipApplyResult && previewCampaignId && previewTaskId && campaignMembershipApplyResult.campaignId === previewCampaignId && campaignMembershipApplyResult.taskId === previewTaskId ? (<div role="status" aria-live="polite" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            <p className="font-semibold">Selections applied</p>
            <dl className="mt-2 grid gap-2 sm:grid-cols-2">
              <div><dt className="text-emerald-700">Selected</dt><dd className="font-semibold">{campaignMembershipApplyResult.summary.selected}</dd></div>
              <div><dt className="text-emerald-700">Created</dt><dd className="font-semibold">{campaignMembershipApplyResult.summary.created}</dd></div>
              <div><dt className="text-emerald-700">Existing</dt><dd className="font-semibold">{campaignMembershipApplyResult.summary.existing}</dd></div>
              <div><dt className="text-emerald-700">Reactivated</dt><dd className="font-semibold">{campaignMembershipApplyResult.summary.reactivated}</dd></div>
            </dl>
          </div>) : null}

        {canShowApplyButton ? (<div className="mt-4 flex justify-end">
            <button type="button" aria-haspopup="dialog" onClick={openCampaignMembershipApplyDialog} disabled={campaignMembershipApplySubmitting} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
              Apply selected memberships
            </button>
          </div>) : null}
      </>)}

    {previewKind === "pending_retry" && (<div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <p className="font-semibold">Preview en attente</p>
        <p className="mt-1">
          La campagne est acceptée mais nécessite une nouvelle tentative.
        </p>
      </div>)}

    {previewKind === "queued" && (<div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
        <p className="font-semibold">Preview en file d’attente</p>
        <p className="mt-1">
          Le traitement va démarrer automatiquement.
        </p>
      </div>)}

    {previewKind === "failed" && (<div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
        <p className="font-semibold">Preview échoué</p>
        <p className="mt-1">
          Consultez les détails de l’erreur.
        </p>
      </div>)}
  </div>
            </div>
            </section> : null}{formError ? <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{formError}</p> : null}<div className="mt-6 flex flex-wrap justify-end gap-3">{editor.section === "campaigns" && editor.row != null ? <button type="button" onClick={() => void handleRunCampaignPreview()} disabled={submitting || campaignPreviewLoading || campaignOpportunityMembershipsLoading} className="rounded-full border border-slate-900 px-4 py-2 text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-50">{campaignPreviewLoading ? "Preview en cours…" : "Lancer le preview"}</button> : null}<button type="button" onClick={() => setEditor(null)} disabled={submitting || campaignPreviewLoading} className="rounded-full px-4 py-2 text-sm font-semibold text-slate-700">Annuler</button><button type="submit" disabled={submitting || Boolean(opportunityFormInvalid) || (editor.section === "opportunities" && editor.row == null && (pages.domains.items.length === 0 || pages.assets.items.length === 0))} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{submitting ? "Enregistrement…" : "Enregistrer"}</button></div></>}</form></div> : null}
      {outreachDraftDialog ? <OutreachDraftPreparationDialog opportunityLabel={campaignOpportunityLabel(outreachDraftDialog.opportunityId)} contacts={outreachEligibility?.contacts ?? []} contactId={outreachDraftContactId} channel={outreachDraftChannel} loading={outreachEligibilityLoading} previewLoading={outreachDraftPreviewLoading} submitting={outreachDraftSubmitting} preview={outreachDraftPreview} success={outreachDraftSuccess} error={outreachDraftError} onClose={() => { if (!outreachDraftSubmitting) setOutreachDraftDialog(null); }} onContactChange={(contactId) => { setOutreachDraftContactId(contactId); setOutreachDraftChannel(""); setOutreachDraftPreview(null); setOutreachDraftSuccess(null); }} onChannelChange={(channel) => { setOutreachDraftChannel(channel); setOutreachDraftPreview(null); setOutreachDraftSuccess(null); }} onPreview={() => void previewOutreachDraft()} onApply={() => void applyOutreachDraft()} /> : null}
    </div>
  );
}
