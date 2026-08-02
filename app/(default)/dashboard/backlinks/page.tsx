"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getSharedSession } from "@/lib/supabase/sharedAuth";
import { getStoredWorkspaceId } from "@/lib/workspaces/getStoredWorkspaceId";

type BacklinkSection = "opportunities" | "campaigns" | "outreach" | "links" | "assets" | "domains" | "contacts";
type ApiRow = Record<string, string | number | boolean | null> & { id: string };

type ApiPage = {
  items: ApiRow[];
  total: number;
};
type CampaignOpportunityMembership = { campaign_id: string; opportunity_id: string; membership_status: string };
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
  dryRunOnly: true;
  createdAt: string;
  updatedAt: string;
};
type AutomationWorkspaceControlGetResponse = {
  ok: true;
  control: AutomationWorkspaceControlView;
  disposition: "created" | "existing";
};
type AutomationWorkspaceControlPatchResponse = {
  ok: true;
  control: AutomationWorkspaceControlView;
};
type AutomationDiscoveryPreviewView = {
  version: 1;
  kind: "backlinks.discovery.preview";
  dryRun: true;
  provider: "mock" | "brave_search" | "dataforseo_serp";
  skipped?: "no_searches";
  summary: {
    searchesRequested: number;
    resultsReceived: number;
    candidatesAccepted: number;
    candidatesRejected: number;
    truncated: boolean;
  };
  candidates: readonly {
    candidateKey: string;
    hostname: string;
    sourceUrl: string;
    pageTitle: string | null;
    snippet: string | null;
    queryIndex: number;
    rank: number;
    countryCode: string | null;
    languageCode: string | null;
    proposedOpportunityType: string | null;
    proposedPageType: string | null;
    suggestedAssetKey: string | null;
    evidenceSummary: string;
    discoveryScore: number;
  }[];
  rejections: readonly {
    code: string;
    count: number;
  }[];
};
type AutomationExecutionView = {
  kind: "completed" | "pending_retry" | "failed";
  workerInvocations: number;
  completedTasks: number;
  retriedTasks: number;
  deadLetterTasks: number;
  stoppedBecause: "empty" | "max_worker_invocations";
  discoveryPreview: AutomationDiscoveryPreviewView | null;
};
type AutomationTickRejectedView = {
  kind: "rejected";
  reason: "automation_disabled" | "dry_run_required";
};
type AutomationTickExecutedView = {
  kind: "completed" | "pending_retry" | "failed";
  run: { id: string; workspaceId: string };
  preparation: {
    runDisposition: "created" | "existing";
    taskDispositions: readonly [
      "created" | "existing",
      "created" | "existing",
    ];
  };
  execution: AutomationExecutionView;
};
type AutomationTickResultView =
  | AutomationTickRejectedView
  | AutomationTickExecutedView;
type AutomationTickResponse = {
  ok: true;
  result: AutomationTickResultView;
};

type EditorState = {
  section: BacklinkSection;
  row: ApiRow | null;
} | null;

type Field = {
  key: string;
  label: string;
  required?: boolean;
  type?: "text" | "url" | "textarea";
};

function getDiscoveryConfigurationError(
  query: string,
  countryCode: string,
  languageCode: string,
  maxResults: number,
  maxCandidates: number,
): string | null {
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
  contacts: [{ key: "contact_key", label: "Clé contact", required: true }, { key: "domain_id", label: "Domaine", required: true }, { key: "full_name", label: "Nom" }, { key: "email_normalized", label: "Email" }, { key: "role_title", label: "Fonction" }],
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
    { key: "rel_type", label: "Type rel" },
    { key: "link_location", label: "Emplacement du lien" },
    { key: "verification_source", label: "Source de vérification" },
  ],
  assets: [{ key: "display_name", label: "Nom" }, { key: "asset_type", label: "Type" }, { key: "canonical_url", label: "URL", type: "url" }, { key: "lifecycle_status", label: "Statut" }, { key: "description", label: "Description", type: "textarea" }],
  domains: [{ key: "hostname", label: "Domaine" }, { key: "display_name", label: "Nom" }, { key: "country_code", label: "Pays (ISO)" }, { key: "editorial_category", label: "Type" }, { key: "estimated_difficulty", label: "Priorité" }, { key: "lifecycle_status", label: "Statut" }],
  contacts: [{ key: "full_name", label: "Nom" }, { key: "email_normalized", label: "Email" }, { key: "role_title", label: "Fonction" }, { key: "contact_status", label: "Statut" }],
};

function displayValue(value: string | number | boolean | null | undefined) {
  return value == null || value === "" ? "—" : String(value);
}
function formatDate(value: string | number | boolean | null | undefined) {
  if (typeof value !== "string" || !value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("fr-FR");
}
function inputValue(row: ApiRow | null, key: string) {
  const value = row?.[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

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

function outreachStatusLabel(status: string | number | boolean | null | undefined) {
  const labels: Record<string, string> = { draft: "Brouillon", ready: "Prêt", active: "Actif", replied: "Réponse reçue", conversation_open: "Conversation ouverte", declined: "Refusé", no_response: "Sans réponse", paused: "En pause", closed: "Clôturé" };
  return labels[String(status)] ?? displayValue(status).replaceAll("_", " ");
}

function outreachStatusVariant(status: string | number | boolean | null | undefined) {
  const variants: Record<string, string> = { draft: "bg-slate-100 text-slate-700", ready: "bg-emerald-50 text-emerald-700", active: "bg-sky-50 text-sky-700", replied: "bg-teal-50 text-teal-700", conversation_open: "bg-violet-50 text-violet-700", declined: "bg-rose-50 text-rose-700", no_response: "bg-slate-50 text-slate-500", paused: "bg-amber-50 text-amber-700", closed: "bg-slate-200 text-slate-700" };
  return variants[String(status)] ?? "bg-slate-100 text-slate-700";
}

function outreachChannelLabel(channel: string | number | boolean | null | undefined) {
  const labels: Record<string, string> = { email: "Email", linkedin: "LinkedIn", contact_form: "Formulaire de contact", slack: "Slack", discord: "Discord", reddit: "Reddit", other: "Autre" };
  return labels[String(channel)] ?? displayValue(channel).replaceAll("_", " ");
}

function outreachResponseLabel(response: string | number | boolean | null | undefined) {
  const labels: Record<string, string> = { positive: "Positive", negative: "Négative", neutral: "Neutre", bounced: "Adresse invalide", unsubscribed: "Désinscription" };
  return response == null ? "—" : labels[String(response)] ?? displayValue(response).replaceAll("_", " ");
}

function linkStatusLabel(status: string | number | boolean | null | undefined) {
  const labels: Record<string, string> = { active: "Actif", pending_verification: "En attente", lost: "Perdu", removed: "Supprimé" };
  return labels[String(status)] ?? displayValue(status).replaceAll("_", " ");
}

function linkStatusVariant(status: string | number | boolean | null | undefined) {
  const variants: Record<string, string> = { active: "bg-emerald-50 text-emerald-700", pending_verification: "bg-sky-50 text-sky-700", lost: "bg-rose-50 text-rose-700", removed: "bg-slate-200 text-slate-700" };
  return variants[String(status)] ?? "bg-slate-100 text-slate-700";
}

function relTypeBadges(relType: string | number | boolean | null | undefined) {
  const labels: Record<string, string> = { dofollow: "DoFollow", nofollow: "NoFollow", ugc: "UGC", sponsored: "Sponsored" };
  if (relType == null || String(relType).trim() === "") return ["—"];
  return String(relType).trim().split(/[\s,]+/).map((value) => labels[value.toLowerCase()] ?? value.replaceAll("_", " "));
}

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
    return [
      contactLabel(contacts, row.contact_id),
      opportunityLabel(opportunities, domains, row.opportunity_id),
      displayValue(row.status),
      formatDate(row.first_contact_at),
      displayValue(row.last_response_type),
    ];
  }
  if (section === "assets") return [displayValue(row.display_name), displayValue(row.canonical_url), displayValue(row.asset_type), displayValue(row.lifecycle_status)];
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
  outreach: ["Contact", "Domaine", "Statut", "Date d’envoi", "Dernière réponse"],
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
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [verifyingLinkId, setVerifyingLinkId] = useState<string | null>(null);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);
  const [automationControl, setAutomationControl] = useState<AutomationWorkspaceControlView | null>(null);
  const [automationControlLoading, setAutomationControlLoading] = useState(false);
  const [automationSaving, setAutomationSaving] = useState(false);
  const [automationError, setAutomationError] = useState<string | null>(null);
  const [automationRunning, setAutomationRunning] = useState(false);
  const [automationLastResult, setAutomationLastResult] =
    useState<AutomationTickResultView | null>(null);
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
  const discoveryConfigurationError = getDiscoveryConfigurationError(
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
      const message =
        typeof payload === "object" && payload != null && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : "La requête Backlinks a échoué.";
      throw new Error(message);
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
      setAutomationRunning(false);
      setAutomationLastResult(null);
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

  const openEditor = (section: BacklinkSection, row: ApiRow | null) => {
    setFormError(null);
    setOpportunityValues({});
    setOpportunityTouched({});
    setOpportunitySubmitAttempted(false);
    setEditor({ section, row });
    setCampaignOpportunityMemberships([]); setCampaignOpportunityMembershipsError(null); setSelectedCampaignOpportunityId("");
    if (section === "campaigns" && row != null) void loadCampaignOpportunityMemberships(row.id);
  };

  const submitEditor = async (formData: FormData) => {
    if (!editor) return;
    const fields = editor.row == null ? createFields[editor.section] : updateFields[editor.section];
    const body = Object.fromEntries(
      fields
        .map((field) => [field.key, String(formData.get(field.key) ?? "").trim()] as const)
        .filter(([, value]) => value.length > 0),
    );

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
        setVerificationMessage("Une vérification existe déjà pour ce lien aujourd’hui.");
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
              provider: "mock",
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
    } catch {
      if (requestVersion !== workspaceRequestVersionRef.current) return;
      setAutomationError("Impossible de lancer l’automatisation.");
    } finally {
      if (requestVersion !== workspaceRequestVersionRef.current) return;
      setAutomationRunning(false);
    }
  };

  const activeCampaignMemberships = campaignOpportunityMemberships.filter((membership) => membership.membership_status !== "removed");
  const campaignOpportunityLabel = (opportunityId: string) => opportunityLabel(pages.opportunities.items, pages.domains.items, opportunityId);
  const availableCampaignOpportunities = pages.opportunities.items.filter((opportunity) => !activeCampaignMemberships.some((membership) => membership.opportunity_id === opportunity.id));
  const hasDomains = pages.domains.items.length > 0;
  const hasAssets = pages.assets.items.length > 0;
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

  const activeContent = sections[activeSection];
  const activePage = pages[activeSection];
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
  const displayedRows = activeSection === "outreach" ? filteredOutreachRows : activeSection === "links" ? filteredLinkRows : activePage.items;
  const summaryCards = [
    { label: "Opportunités", description: "Domaines et pistes identifiés.", total: pages.opportunities.total },
    { label: "Campagnes", description: "Initiatives d’acquisition organisées.", total: pages.campaigns.total },
    { label: "Outreach", description: "Prises de contact suivies.", total: pages.outreach.total },
    { label: "Liens obtenus", description: "Backlinks enregistrés et vérifiés.", total: pages.links.total },
  ];

  return (
    <div className="space-y-6 text-slate-900">
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-950">Automation Backlinks</h2>
              <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-sky-700">Dry-run</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">Prépare et exécute les tâches Backlinks en mode prévisualisation, sans action externe.</p>
            <p className="mt-2 text-sm font-medium text-slate-700">{automationControlLoading ? "Chargement…" : automationControl == null ? "Indisponible" : automationControl.backlinksEnabled ? "Activée" : "Désactivée"}</p>
            <p className="mt-1 text-xs text-slate-500">Mode sécurisé : aucune prise de contact ni création réelle de backlink.</p>
            {automationError ? <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{automationError}</p> : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => void handleToggleAutomation()} disabled={!workspaceResolved || !activeWorkspaceId?.trim() || automationControlLoading || automationSaving || automationRunning || automationControl == null} aria-busy={automationSaving} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50">{automationSaving ? "Enregistrement…" : automationControl?.backlinksEnabled ? "Désactiver" : "Activer"}</button>
            <button type="button" onClick={() => void handleRunAutomationNow()} disabled={!workspaceResolved || !activeWorkspaceId?.trim() || automationControl == null || !automationControl.backlinksEnabled || automationControlLoading || automationSaving || automationRunning || discoveryConfigurationError !== null} aria-busy={automationRunning} aria-label="Lancer l’automatisation Backlinks maintenant" className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">{automationRunning ? "Exécution…" : "Lancer maintenant"}</button>
          </div>
        </div>
        <div className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-5">
          <div className="md:col-span-2">
            <label htmlFor="automation-discovery-query" className="block text-xs font-semibold text-slate-700">Requête Discovery</label>
            <input id="automation-discovery-query" name="automation-discovery-query" type="text" autoComplete="off" value={discoveryQuery} onChange={(event) => setDiscoveryQuery(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900" />
          </div>
          <div>
            <label htmlFor="automation-discovery-country" className="block text-xs font-semibold text-slate-700">Pays</label>
            <input id="automation-discovery-country" name="automation-discovery-country" type="text" autoComplete="off" value={discoveryCountryCode} onChange={(event) => setDiscoveryCountryCode(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900" />
          </div>
          <div>
            <label htmlFor="automation-discovery-language" className="block text-xs font-semibold text-slate-700">Langue</label>
            <input id="automation-discovery-language" name="automation-discovery-language" type="text" autoComplete="off" value={discoveryLanguageCode} onChange={(event) => setDiscoveryLanguageCode(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900" />
          </div>
          <div>
            <label htmlFor="automation-discovery-max-results" className="block text-xs font-semibold text-slate-700">Résultats maximum</label>
            <input id="automation-discovery-max-results" name="automation-discovery-max-results" type="number" min={1} max={10} value={discoveryMaxResults} onChange={(event) => setDiscoveryMaxResults(Number(event.target.value))} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900" />
          </div>
          <div>
            <label htmlFor="automation-discovery-max-candidates" className="block text-xs font-semibold text-slate-700">Candidats maximum</label>
            <input id="automation-discovery-max-candidates" name="automation-discovery-max-candidates" type="number" min={1} max={50} value={discoveryMaxCandidates} onChange={(event) => setDiscoveryMaxCandidates(Number(event.target.value))} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900" />
          </div>
          <p className="md:col-span-5 text-xs text-slate-500">Provider de test — aucun appel réseau</p>
          {discoveryConfigurationError ? <p role="alert" className="md:col-span-5 text-sm text-rose-700">{discoveryConfigurationError}</p> : null}
        </div>
        {automationLastResult ? (
          <div aria-live="polite" className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Dernière exécution de cette session</p>
            {automationLastResult.kind === "rejected" ? (
              <p className="mt-2 font-semibold text-slate-900">
                {automationLastResult.reason === "automation_disabled"
                  ? "L’automatisation est désactivée pour ce workspace."
                  : "Le mode dry-run est obligatoire."}
              </p>
            ) : (
              <>
                <p className="mt-2 font-semibold text-slate-900">
                  {automationLastResult.kind === "completed"
                    ? "Exécution terminée"
                    : automationLastResult.kind === "pending_retry"
                      ? "Nouvelle tentative en attente"
                      : "Exécution terminée avec échec"}
                </p>
                {automationLastResult.kind === "pending_retry" || automationLastResult.kind === "failed" ? (
                  <p className="mt-2 text-slate-600">Le provider Discovery de test n’est pas configuré côté serveur.</p>
                ) : null}
                <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div><dt className="text-slate-500">Tâches terminées</dt><dd className="font-semibold">{automationLastResult.execution.completedTasks}</dd></div>
                  <div><dt className="text-slate-500">Retries</dt><dd className="font-semibold">{automationLastResult.execution.retriedTasks}</dd></div>
                  <div><dt className="text-slate-500">Dead-letter</dt><dd className="font-semibold">{automationLastResult.execution.deadLetterTasks}</dd></div>
                  <div><dt className="text-slate-500">Invocations Worker</dt><dd className="font-semibold">{automationLastResult.execution.workerInvocations}</dd></div>
                  <div><dt className="text-slate-500">Arrêt</dt><dd className="font-semibold">{automationLastResult.execution.stoppedBecause === "empty" ? "File vide" : "Limite d’invocations atteinte"}</dd></div>
                  <div><dt className="text-slate-500">Run</dt><dd className="font-semibold">{automationLastResult.preparation.runDisposition === "created" ? "Créé" : "Réutilisé"}</dd></div>
                </dl>
                <p className="mt-3 text-slate-600">Tâches : {automationLastResult.preparation.taskDispositions.map((disposition, index) => `Tâche ${index + 1} ${disposition === "created" ? "créée" : "réutilisée"}`).join(" · ")}</p>
                {automationLastResult.execution.discoveryPreview ? (
                  <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4" aria-label="Candidats Discovery">
                    <h3 className="font-semibold text-slate-900">Candidats Discovery</h3>
                    <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div><dt className="text-slate-500">Provider</dt><dd className="font-semibold">{automationLastResult.execution.discoveryPreview.provider}</dd></div>
                      <div><dt className="text-slate-500">Recherches demandées</dt><dd className="font-semibold">{automationLastResult.execution.discoveryPreview.summary.searchesRequested}</dd></div>
                      <div><dt className="text-slate-500">Résultats reçus</dt><dd className="font-semibold">{automationLastResult.execution.discoveryPreview.summary.resultsReceived}</dd></div>
                      <div><dt className="text-slate-500">Candidats retenus</dt><dd className="font-semibold">{automationLastResult.execution.discoveryPreview.summary.candidatesAccepted}</dd></div>
                      <div><dt className="text-slate-500">Candidats rejetés</dt><dd className="font-semibold">{automationLastResult.execution.discoveryPreview.summary.candidatesRejected}</dd></div>
                      <div><dt className="text-slate-500">Tronqué</dt><dd className="font-semibold">{automationLastResult.execution.discoveryPreview.summary.truncated ? "Oui" : "Non"}</dd></div>
                    </dl>
                    {automationLastResult.execution.discoveryPreview.skipped === "no_searches" ? (
                      <p className="mt-3 text-slate-600">Aucune recherche Discovery n’a été demandée.</p>
                    ) : automationLastResult.execution.discoveryPreview.candidates.length === 0 ? (
                      <p className="mt-3 text-slate-600">Aucun candidat Discovery trouvé.</p>
                    ) : (
                      <div className="mt-3 space-y-3">
                        {automationLastResult.execution.discoveryPreview.candidates.slice(0, 10).map((candidate) => (
                          <article key={candidate.candidateKey} className="rounded-lg border border-slate-200 p-3">
                            <p className="font-semibold text-slate-900">{candidate.pageTitle ?? "Sans titre"}</p>
                            <p className="mt-1 text-xs font-medium text-slate-500">{candidate.hostname}</p>
                            <a href={candidate.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 block break-all text-sm text-sky-700 underline">{candidate.sourceUrl}</a>
                            <p className="mt-2 text-xs text-slate-600">Rang : {candidate.rank} · Score technique : {candidate.discoveryScore}</p>
                            {candidate.countryCode || candidate.languageCode ? <p className="mt-1 text-xs text-slate-600">{[candidate.countryCode, candidate.languageCode].filter(Boolean).join(" / ")}</p> : null}
                            {candidate.snippet ? <p className="mt-2 text-sm text-slate-700">{candidate.snippet}</p> : null}
                            <p className="mt-2 text-xs text-slate-600">{candidate.evidenceSummary}</p>
                            {candidate.suggestedAssetKey ? <p className="mt-2 text-xs text-slate-600">Asset suggéré : {candidate.suggestedAssetKey}</p> : null}
                          </article>
                        ))}
                        {automationLastResult.execution.discoveryPreview.candidates.length > 10 ? <p className="text-xs text-slate-500">{automationLastResult.execution.discoveryPreview.candidates.length - 10} candidats supplémentaires non affichés.</p> : null}
                      </div>
                    )}
                  </section>
                ) : null}
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
          {activeSection === "outreach" ? <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><label className="text-sm font-semibold text-slate-700">Rechercher<input value={outreachSearchQuery} onChange={(event) => setOutreachSearchQuery(event.target.value)} placeholder="Rechercher un contact, une campagne ou une opportunité…" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal" /></label><label className="text-sm font-semibold text-slate-700">Campagne<select value={outreachCampaignFilter} onChange={(event) => setOutreachCampaignFilter(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal"><option value="">Toutes les campagnes</option>{pages.campaigns.items.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaignLabel(pages.campaigns.items, campaign.id)}</option>)}</select></label><label className="text-sm font-semibold text-slate-700">Statut<select value={outreachStatusFilter} onChange={(event) => setOutreachStatusFilter(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal"><option value="">Tous les statuts</option>{["draft","ready","active","replied","conversation_open","declined","no_response","paused","closed"].map((status) => <option key={status} value={status}>{outreachStatusLabel(status)}</option>)}</select></label><label className="text-sm font-semibold text-slate-700">Canal<select value={outreachChannelFilter} onChange={(event) => setOutreachChannelFilter(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal"><option value="">Tous les canaux</option>{outreachChannels.map((channel) => <option key={channel} value={channel}>{outreachChannelLabel(channel)}</option>)}</select></label><div className="sm:col-span-2 xl:col-span-4 flex items-center justify-between gap-3 text-sm text-slate-600"><span>{filteredOutreachRows.length} résultat{filteredOutreachRows.length === 1 ? "" : "s"}{outreachFiltersActive ? ` sur ${pages.outreach.items.length}` : ""}</span><button type="button" onClick={() => { setOutreachSearchQuery(""); setOutreachCampaignFilter(""); setOutreachStatusFilter(""); setOutreachChannelFilter(""); }} disabled={!outreachFiltersActive} className="font-semibold underline decoration-slate-300 underline-offset-4 disabled:opacity-50">Réinitialiser</button></div></div> : null}
          {activeSection === "links" ? <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><label className="text-sm font-semibold text-slate-700">Rechercher<input value={linkSearchQuery} onChange={(event) => setLinkSearchQuery(event.target.value)} placeholder="Rechercher une URL, un domaine, un asset ou un outreach…" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal" /></label><label className="text-sm font-semibold text-slate-700">Statut<select value={linkStatusFilter} onChange={(event) => setLinkStatusFilter(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal"><option value="">Tous les statuts</option>{["active","pending_verification","lost","removed"].map((status) => <option key={status} value={status}>{linkStatusLabel(status)}</option>)}</select></label><label className="text-sm font-semibold text-slate-700">Domaine<select value={linkDomainFilter} onChange={(event) => setLinkDomainFilter(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal"><option value="">Tous les domaines</option>{pages.domains.items.map((domain) => <option key={domain.id} value={domain.id}>{domainLabel(pages.domains.items, domain.id)}</option>)}</select></label><label className="text-sm font-semibold text-slate-700">Asset<select value={linkAssetFilter} onChange={(event) => setLinkAssetFilter(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal"><option value="">Tous les assets</option>{pages.assets.items.map((asset) => <option key={asset.id} value={asset.id}>{assetLabel(pages.assets.items, asset.id)}</option>)}</select></label><label className="text-sm font-semibold text-slate-700">Outreach<select value={linkOutreachFilter} onChange={(event) => setLinkOutreachFilter(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal"><option value="">Tous les Outreach</option>{pages.outreach.items.map((outreach) => <option key={outreach.id} value={outreach.id}>{linkOutreachLabel(pages.outreach.items, pages.contacts.items, pages.opportunities.items, pages.domains.items, pages.campaigns.items, outreach.id)}</option>)}</select></label><div className="sm:col-span-2 xl:col-span-5 flex items-center justify-between gap-3 text-sm text-slate-600"><span>{filteredLinkRows.length} résultat{filteredLinkRows.length === 1 ? "" : "s"}{linkFiltersActive ? ` sur ${pages.links.items.length}` : ""}</span><button type="button" onClick={() => { setLinkSearchQuery(""); setLinkStatusFilter(""); setLinkDomainFilter(""); setLinkAssetFilter(""); setLinkOutreachFilter(""); }} disabled={!linkFiltersActive} className="font-semibold underline decoration-slate-300 underline-offset-4 disabled:opacity-50">Réinitialiser</button></div></div> : null}
          {error ? <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800"><p>{error}</p><button type="button" onClick={() => void loadDashboard()} className="mt-2 font-semibold underline underline-offset-4">Réessayer</button></div> : null}
          {activeSection === "links" && verificationMessage ? <p role="status" aria-live="polite" className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{verificationMessage}</p> : null}
          {loading ? <div className="py-12 text-center text-sm text-slate-600">Chargement du cockpit Backlinks…</div> : null}
          {!loading && !error && displayedRows.length === 0 ? <div className="py-12 text-center"><p className="text-lg font-semibold text-slate-950">Aucun élément</p><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">{activeSection === "outreach" && pages.outreach.items.length > 0 && outreachFiltersActive ? <>Aucun Outreach ne correspond à ces filtres. <button type="button" onClick={() => { setOutreachSearchQuery(""); setOutreachCampaignFilter(""); setOutreachStatusFilter(""); setOutreachChannelFilter(""); }} className="font-semibold underline">Réinitialiser les filtres</button></> : activeSection === "links" && pages.links.items.length > 0 && linkFiltersActive ? <>Aucun backlink ne correspond à ces filtres. <button type="button" onClick={() => { setLinkSearchQuery(""); setLinkStatusFilter(""); setLinkDomainFilter(""); setLinkAssetFilter(""); setLinkOutreachFilter(""); }} className="font-semibold underline">Réinitialiser les filtres</button></> : activeContent.emptyState}</p></div> : null}
          {!loading && !error && displayedRows.length > 0 ? <div className="overflow-x-auto rounded-2xl border border-slate-200"><table className="min-w-full divide-y divide-slate-200 text-left text-sm"><thead className="bg-slate-50"><tr>{tableHeaders[activeSection].map((header) => <th key={header} scope="col" className="whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-[0.1em] text-slate-500">{header}</th>)}<th scope="col" className="px-4 py-3 text-right text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Actions</th></tr></thead><tbody className="divide-y divide-slate-100 bg-white">{displayedRows.map((row) => <tr key={row.id}>{rowsFor(activeSection, row, pages.domains.items, pages.assets.items, pages.opportunities.items, pages.contacts.items).map((value, index) => <td key={`${row.id}-${tableHeaders[activeSection][index]}`} className="max-w-64 truncate px-4 py-3 text-slate-700" title={value}>{activeSection === "links" && index === 2 ? <div className="flex flex-wrap gap-1">{relTypeBadges(row.rel_type).map((badge) => <span key={badge} className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{badge}</span>)}</div> : activeSection === "links" && index === 3 ? <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${linkStatusVariant(row.status)}`}>{linkStatusLabel(row.status)}</span> : activeSection === "outreach" && index === 2 ? <div className="flex flex-wrap gap-1"><span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${outreachStatusVariant(row.status)}`}>{outreachStatusLabel(row.status)}</span><span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{outreachChannelLabel(row.channel)}</span></div> : activeSection === "outreach" && index === 4 ? outreachResponseLabel(row.last_response_type) : value}</td>)}<td className="px-4 py-3 text-right"><div className="flex justify-end gap-3"><button type="button" onClick={() => openEditor(activeSection, row)} className="font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-950">Modifier</button>{activeSection === "links" ? <button type="button" onClick={() => void handleVerifyLink(row.id)} disabled={verifyingLinkId !== null} className="font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">{verifyingLinkId === row.id ? "Vérification…" : "Vérifier maintenant"}</button> : null}</div></td></tr>)}</tbody></table></div> : null}
        </div>
      </section>

      {/* eslint-disable-next-line react/no-unescaped-entities */}
      {editor ? <div role="dialog" aria-modal="true" aria-labelledby="backlinks-editor-title" className="fixed inset-0 z-50 flex items-end bg-slate-950/40 p-4 sm:items-center sm:justify-center"><form onSubmit={(event) => { event.preventDefault(); if (editor.section === "opportunities") { setOpportunitySubmitAttempted(true); if (opportunityFormInvalid) return; } void submitEditor(new FormData(event.currentTarget)); }} onChange={(event) => handleOpportunityFieldInteraction(event.target)} onBlur={(event) => handleOpportunityFieldInteraction(event.target)} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-6"><div><h2 id="backlinks-editor-title" className="text-xl font-semibold text-slate-950">{editor.row == null ? "Nouvel élément" : "Modifier l’élément"}</h2><p className="mt-1 text-sm text-slate-600">{sections[editor.section].label}</p></div><button type="button" onClick={() => setEditor(null)} className="rounded-full px-3 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-100">Fermer</button></div>{editor.section === "opportunities" && !hasDomains ? <div className="flex min-h-56 flex-col items-center justify-center text-center"><h3 className="text-lg font-semibold text-slate-950">Aucun domaine disponible</h3><p className="mt-2 max-w-md text-sm text-slate-600">Vous devez créer au moins un domaine avant de pouvoir enregistrer une opportunité de backlink.</p><button type="button" onClick={() => { setEditor(null); setActiveSection("domains"); openEditor("domains", null); }} className="mt-5 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Aller à Domains</button></div> : editor.section === "opportunities" && !hasAssets ? <div className="flex min-h-56 flex-col items-center justify-center text-center"><h3 className="text-lg font-semibold text-slate-950">Aucun asset Norixo disponible</h3><p className="mt-2 max-w-md text-sm text-slate-600">Créez d'abord un asset Norixo afin d'associer cette opportunité à une page de votre site.</p><button type="button" onClick={() => { setEditor(null); setActiveSection("assets"); openEditor("assets", null); }} className="mt-5 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Aller à Assets</button></div> : <><div className="mt-6 grid gap-4 sm:grid-cols-2">{(editor.row == null ? createFields[editor.section] : updateFields[editor.section]).map((field) => <label key={field.key} className={field.type === "textarea" ? "sm:col-span-2" : ""}><span className="mb-1.5 block text-sm font-semibold text-slate-700">{field.label}{field.required ? " *" : ""}</span>{field.key === "outreach_id" && editor.section === "links" ? <select name="outreach_id" required disabled={pages.outreach.items.length === 0} defaultValue={inputValue(editor.row, field.key)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="">{pages.outreach.items.length === 0 ? "Aucune action Outreach" : "Sélectionnez une action Outreach"}</option>{pages.outreach.items.map((outreach) => <option key={outreach.id} value={outreach.id}>{linkOutreachLabel(pages.outreach.items, pages.contacts.items, pages.opportunities.items, pages.domains.items, pages.campaigns.items, outreach.id)}</option>)}</select> : field.key === "opportunity_id" && editor.section === "links" ? <select name="opportunity_id" required disabled={pages.opportunities.items.length === 0} defaultValue={inputValue(editor.row, field.key)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="">{pages.opportunities.items.length === 0 ? "Aucune opportunité" : "Sélectionnez une opportunité"}</option>{pages.opportunities.items.map((opportunity) => <option key={opportunity.id} value={opportunity.id}>{opportunityLabel(pages.opportunities.items, pages.domains.items, opportunity.id)}</option>)}</select> : field.key === "domain_id" && editor.section === "links" ? <select name="domain_id" required disabled={pages.domains.items.length === 0} defaultValue={inputValue(editor.row, field.key)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="">{pages.domains.items.length === 0 ? "Aucun domaine" : "Sélectionnez un domaine"}</option>{pages.domains.items.map((domain) => <option key={domain.id} value={domain.id}>{domainLabel(pages.domains.items, domain.id)}</option>)}</select> : field.key === "asset_id" && editor.section === "links" ? <select name="asset_id" required disabled={pages.assets.items.length === 0} defaultValue={inputValue(editor.row, field.key)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="">{pages.assets.items.length === 0 ? "Aucun asset" : "Sélectionnez un asset"}</option>{pages.assets.items.map((asset) => <option key={asset.id} value={asset.id}>{assetLabel(pages.assets.items, asset.id)}</option>)}</select> : field.key === "campaign_id" && editor.section === "outreach" ? <select name="campaign_id" required disabled={pages.campaigns.items.length === 0} defaultValue={inputValue(editor.row, field.key)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="">{pages.campaigns.items.length === 0 ? "Aucune campagne" : "Sélectionnez une campagne"}</option>{pages.campaigns.items.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaignLabel(pages.campaigns.items, campaign.id)}</option>)}</select> : field.key === "opportunity_id" && editor.section === "outreach" ? <select name="opportunity_id" required disabled={pages.opportunities.items.length === 0} defaultValue={inputValue(editor.row, field.key)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="">{pages.opportunities.items.length === 0 ? "Aucune opportunité" : "Sélectionnez une opportunité"}</option>{pages.opportunities.items.map((opportunity) => <option key={opportunity.id} value={opportunity.id}>{opportunityLabel(pages.opportunities.items, pages.domains.items, opportunity.id)}</option>)}</select> : field.key === "contact_id" && editor.section === "outreach" ? <select name="contact_id" required disabled={pages.contacts.items.length === 0} defaultValue={inputValue(editor.row, field.key)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="">{pages.contacts.items.length === 0 ? "Aucun contact" : "Sélectionnez un contact"}</option>{pages.contacts.items.map((contact) => <option key={contact.id} value={contact.id}>{contactLabel(pages.contacts.items, contact.id)}</option>)}</select> : field.key === "domain_id" && (editor.section === "contacts" || editor.section === "opportunities") ? <select name="domain_id" required disabled={editor.section === "contacts" && editor.row != null || pages.domains.items.length === 0} defaultValue={inputValue(editor.row, field.key)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="">Sélectionnez un domaine</option>{pages.domains.items.map((domain) => <option key={domain.id} value={domain.id}>{displayValue(domain.display_name ?? domain.hostname)}</option>)}</select> : field.key === "asset_id" && editor.section === "opportunities" ? <select name="asset_id" required disabled={pages.assets.items.length === 0} defaultValue={inputValue(editor.row, field.key)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="">Sélectionnez un asset</option>{pages.assets.items.map((asset) => <option key={asset.id} value={asset.id}>{displayValue(asset.display_name ?? asset.canonical_url)}</option>)}</select> : field.key === "opportunity_type" && editor.section === "opportunities" ? <select name="opportunity_type" required defaultValue={inputValue(editor.row, field.key)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="">Sélectionnez un type</option>{inputValue(editor.row, field.key) && !["Guest Post", "Link Insertion", "Resource Page", "Broken Link", "Digital PR", "Partnership", "Directory", "Other"].includes(inputValue(editor.row, field.key)) ? <option value={inputValue(editor.row, field.key)}>{inputValue(editor.row, field.key)}</option> : null}{["Guest Post", "Link Insertion", "Resource Page", "Broken Link", "Digital PR", "Partnership", "Directory", "Other"].map((option) => <option key={option} value={option}>{option}</option>)}</select> : field.key === "page_type" && editor.section === "opportunities" ? <select name="page_type" required defaultValue={inputValue(editor.row, field.key)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="">Sélectionnez un type</option>{inputValue(editor.row, field.key) && !["Blog", "Homepage", "Category", "Guide", "Comparison", "Tool", "Documentation", "Landing Page", "Other"].includes(inputValue(editor.row, field.key)) ? <option value={inputValue(editor.row, field.key)}>{inputValue(editor.row, field.key)}</option> : null}{["Blog", "Homepage", "Category", "Guide", "Comparison", "Tool", "Documentation", "Landing Page", "Other"].map((option) => <option key={option} value={option}>{option}</option>)}</select> : field.type === "textarea" ? <textarea name={field.key} required={field.required} defaultValue={inputValue(editor.row, field.key)} rows={4} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /> : <input name={field.key} type={field.type ?? "text"} required={field.required} defaultValue={inputValue(editor.row, field.key)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />}{editor.section === "opportunities" && (opportunityTouched[field.key] || opportunitySubmitAttempted) && opportunityErrors[field.key] ? <p id={`opportunity-${field.key}-error`} role="alert" className="mt-1.5 text-sm text-rose-800">{opportunityErrors[field.key]}</p> : null}</label>)}</div>{editor.section === "opportunities" && editor.row != null ? <div className="mt-4 grid gap-4 sm:grid-cols-2"><label><span className="mb-1.5 block text-sm font-semibold text-slate-700">Type d’opportunité</span><select name="opportunity_type" defaultValue={inputValue(editor.row, "opportunity_type")} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="">Sélectionnez un type</option>{inputValue(editor.row, "opportunity_type") && !["Guest Post", "Link Insertion", "Resource Page", "Broken Link", "Digital PR", "Partnership", "Directory", "Other"].includes(inputValue(editor.row, "opportunity_type")) ? <option value={inputValue(editor.row, "opportunity_type")}>{inputValue(editor.row, "opportunity_type")}</option> : null}{["Guest Post", "Link Insertion", "Resource Page", "Broken Link", "Digital PR", "Partnership", "Directory", "Other"].map((option) => <option key={option} value={option}>{option}</option>)}</select></label><label><span className="mb-1.5 block text-sm font-semibold text-slate-700">Type de page</span><select name="page_type" defaultValue={inputValue(editor.row, "page_type")} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="">Sélectionnez un type</option>{inputValue(editor.row, "page_type") && !["Blog", "Homepage", "Category", "Guide", "Comparison", "Tool", "Documentation", "Landing Page", "Other"].includes(inputValue(editor.row, "page_type")) ? <option value={inputValue(editor.row, "page_type")}>{inputValue(editor.row, "page_type")}</option> : null}{["Blog", "Homepage", "Category", "Guide", "Comparison", "Tool", "Documentation", "Landing Page", "Other"].map((option) => <option key={option} value={option}>{option}</option>)}</select></label></div> : null}{editor.section === "campaigns" && editor.row != null ? <section className="mt-6 border-t border-slate-200 pt-6"><h3 className="text-sm font-semibold text-slate-950">Opportunités associées</h3>{campaignOpportunityMembershipsLoading ? <p className="mt-4 text-sm text-slate-600">Chargement des opportunités associées…</p> : campaignOpportunityMembershipsError ? <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{campaignOpportunityMembershipsError}</p> : <><div className="mt-4 space-y-2">{activeCampaignMemberships.length === 0 ? <p className="text-sm text-slate-600">Aucune opportunité associée à cette campagne.</p> : activeCampaignMemberships.map((membership) => <div key={membership.opportunity_id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2"><span className="text-sm text-slate-700">{campaignOpportunityLabel(membership.opportunity_id)}</span><button type="button" onClick={() => void detachCampaignOpportunity(membership.opportunity_id)} disabled={detachingCampaignOpportunityId === membership.opportunity_id} className="rounded-full px-3 py-1 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Retirer</button></div>)}</div>{pages.opportunities.items.length === 0 ? <p className="mt-4 text-sm text-slate-600">Aucune opportunité disponible. Créez d’abord une opportunité dans l’onglet Opportunities.</p> : availableCampaignOpportunities.length === 0 ? <p className="mt-4 text-sm text-slate-600">Toutes les opportunités disponibles sont déjà associées à cette campagne.</p> : null}<div className="mt-4 flex flex-col gap-3 sm:flex-row"><select value={selectedCampaignOpportunityId} onChange={(event) => setSelectedCampaignOpportunityId(event.target.value)} disabled={attachingCampaignOpportunity || campaignOpportunityMembershipsLoading || availableCampaignOpportunities.length === 0} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="">Sélectionner une opportunité</option>{availableCampaignOpportunities.map((opportunity) => <option key={opportunity.id} value={opportunity.id}>{campaignOpportunityLabel(opportunity.id)}</option>)}</select><button type="button" onClick={() => void attachCampaignOpportunity()} disabled={campaignOpportunityMembershipsLoading || attachingCampaignOpportunity || !selectedCampaignOpportunityId || availableCampaignOpportunities.length === 0} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{attachingCampaignOpportunity ? "Ajout…" : "Ajouter"}</button></div></>}</section> : null}{formError ? <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{formError}</p> : null}<div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setEditor(null)} disabled={submitting} className="rounded-full px-4 py-2 text-sm font-semibold text-slate-700">Annuler</button><button type="submit" disabled={submitting || Boolean(opportunityFormInvalid) || (editor.section === "opportunities" && editor.row == null && (pages.domains.items.length === 0 || pages.assets.items.length === 0))} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{submitting ? "Enregistrement…" : "Enregistrer"}</button></div></>}</form></div> : null}
    </div>
  );
}
