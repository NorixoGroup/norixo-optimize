"use client";

import { useCallback, useEffect, useState } from "react";

import { getSharedSession } from "@/lib/supabase/sharedAuth";

type BacklinkSection = "opportunities" | "campaigns" | "outreach" | "links" | "assets" | "domains" | "contacts";
type ApiRow = Record<string, string | number | boolean | null> & { id: string };

type ApiPage = {
  items: ApiRow[];
  total: number;
};
type CampaignOpportunityMembership = { campaign_id: string; opportunity_id: string; membership_status: string };

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

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const { data } = await getSharedSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("Session administrateur introuvable.");

  const response = await fetch(path, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init?.headers,
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
}

function domainLabel(domains: ApiRow[], domainId: string | number | boolean | null | undefined) {
  const domain = domains.find((candidate) => candidate.id === domainId);
  return domain == null ? "—" : displayValue(domain.display_name ?? domain.hostname);
}

function assetLabel(assets: ApiRow[], assetId: string | number | boolean | null | undefined) {
  const asset = assets.find((candidate) => candidate.id === assetId);
  return asset == null ? "—" : displayValue(asset.display_name ?? asset.canonical_url);
}

function rowsFor(section: BacklinkSection, row: ApiRow, domains: ApiRow[], assets: ApiRow[]) {
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
      displayValue(row.contact_id),
      "—",
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
    displayValue(row.domain_id),
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [campaignOpportunityMemberships, setCampaignOpportunityMemberships] = useState<CampaignOpportunityMembership[]>([]);
  const [campaignOpportunityMembershipsLoading, setCampaignOpportunityMembershipsLoading] = useState(false);
  const [campaignOpportunityMembershipsError, setCampaignOpportunityMembershipsError] = useState<string | null>(null);
  const [selectedCampaignOpportunityId, setSelectedCampaignOpportunityId] = useState("");
  const [attachingCampaignOpportunity, setAttachingCampaignOpportunity] = useState(false);
  const [detachingCampaignOpportunityId, setDetachingCampaignOpportunityId] = useState<string | null>(null);

  const loadCampaignOpportunityMemberships = useCallback(async (campaignId: string) => {
    setCampaignOpportunityMembershipsLoading(true); setCampaignOpportunityMembershipsError(null);
    try { const page = await apiRequest<{ items: CampaignOpportunityMembership[] }>(`/api/backlinks/campaigns/${campaignId}/opportunities`); setCampaignOpportunityMemberships(page.items); }
    catch (membershipError) { setCampaignOpportunityMembershipsError(membershipError instanceof Error ? membershipError.message : "Impossible de charger les opportunités associées."); }
    finally { setCampaignOpportunityMembershipsLoading(false); }
  }, []);

  const loadDashboard = useCallback(async () => {
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
      setPages({ opportunities, campaigns, outreach, links, assets, domains, contacts });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger le cockpit Backlinks.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const openEditor = (section: BacklinkSection, row: ApiRow | null) => {
    setFormError(null);
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

  const activeCampaignMemberships = campaignOpportunityMemberships.filter((membership) => membership.membership_status !== "removed");
  const opportunityLabel = (opportunityId: string) => { const opportunity = pages.opportunities.items.find((item) => item.id === opportunityId); if (!opportunity) return "Opportunité"; return displayValue(opportunity.target_page_title ?? domainLabel(pages.domains.items, opportunity.domain_id) ?? opportunity.opportunity_type); };
  const availableCampaignOpportunities = pages.opportunities.items.filter((opportunity) => !activeCampaignMemberships.some((membership) => membership.opportunity_id === opportunity.id));
  const attachCampaignOpportunity = async () => { if (!editor?.row || !selectedCampaignOpportunityId || attachingCampaignOpportunity) return; setAttachingCampaignOpportunity(true); setCampaignOpportunityMembershipsError(null); try { await apiRequest(`/api/backlinks/campaigns/${editor.row.id}/opportunities`, { method: "POST", body: JSON.stringify({ opportunity_id: selectedCampaignOpportunityId }) }); setSelectedCampaignOpportunityId(""); await loadCampaignOpportunityMemberships(editor.row.id); } catch (attachError) { setCampaignOpportunityMembershipsError(attachError instanceof Error ? attachError.message : "Impossible d’ajouter l’opportunité."); } finally { setAttachingCampaignOpportunity(false); } };
  const detachCampaignOpportunity = async (opportunityId: string) => { if (!editor?.row || detachingCampaignOpportunityId) return; setDetachingCampaignOpportunityId(opportunityId); setCampaignOpportunityMembershipsError(null); try { await apiRequest(`/api/backlinks/campaigns/${editor.row.id}/opportunities/${opportunityId}`, { method: "DELETE" }); await loadCampaignOpportunityMemberships(editor.row.id); } catch (detachError) { setCampaignOpportunityMembershipsError(detachError instanceof Error ? detachError.message : "Impossible de retirer l’opportunité."); } finally { setDetachingCampaignOpportunityId(null); } };

  const activeContent = sections[activeSection];
  const activePage = pages[activeSection];
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
          {error ? <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800"><p>{error}</p><button type="button" onClick={() => void loadDashboard()} className="mt-2 font-semibold underline underline-offset-4">Réessayer</button></div> : null}
          {loading ? <div className="py-12 text-center text-sm text-slate-600">Chargement du cockpit Backlinks…</div> : null}
          {!loading && !error && activePage.items.length === 0 ? <div className="py-12 text-center"><p className="text-lg font-semibold text-slate-950">Aucun élément</p><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">{activeContent.emptyState}</p></div> : null}
          {!loading && !error && activePage.items.length > 0 ? <div className="overflow-x-auto rounded-2xl border border-slate-200"><table className="min-w-full divide-y divide-slate-200 text-left text-sm"><thead className="bg-slate-50"><tr>{tableHeaders[activeSection].map((header) => <th key={header} scope="col" className="whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-[0.1em] text-slate-500">{header}</th>)}<th scope="col" className="px-4 py-3 text-right text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Actions</th></tr></thead><tbody className="divide-y divide-slate-100 bg-white">{activePage.items.map((row) => <tr key={row.id}>{rowsFor(activeSection, row, pages.domains.items, pages.assets.items).map((value, index) => <td key={`${row.id}-${tableHeaders[activeSection][index]}`} className="max-w-64 truncate px-4 py-3 text-slate-700" title={value}>{value}</td>)}<td className="px-4 py-3 text-right"><button type="button" onClick={() => openEditor(activeSection, row)} className="font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-950">Modifier</button></td></tr>)}</tbody></table></div> : null}
        </div>
      </section>

      {editor ? <div role="dialog" aria-modal="true" aria-labelledby="backlinks-editor-title" className="fixed inset-0 z-50 flex items-end bg-slate-950/40 p-4 sm:items-center sm:justify-center"><form onSubmit={(event) => { event.preventDefault(); void submitEditor(new FormData(event.currentTarget)); }} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-6"><div><h2 id="backlinks-editor-title" className="text-xl font-semibold text-slate-950">{editor.row == null ? "Nouvel élément" : "Modifier l’élément"}</h2><p className="mt-1 text-sm text-slate-600">{sections[editor.section].label}</p></div><button type="button" onClick={() => setEditor(null)} className="rounded-full px-3 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-100">Fermer</button></div>{editor.section === "opportunities" && editor.row == null && (pages.domains.items.length === 0 || pages.assets.items.length === 0) ? <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{pages.domains.items.length === 0 ? "Aucun domaine disponible. Créez d’abord un domaine dans l’onglet Domains." : "Aucun asset disponible. Créez d’abord un asset dans l’onglet Assets."}</p> : null}<div className="mt-6 grid gap-4 sm:grid-cols-2">{(editor.row == null ? createFields[editor.section] : updateFields[editor.section]).map((field) => <label key={field.key} className={field.type === "textarea" ? "sm:col-span-2" : ""}><span className="mb-1.5 block text-sm font-semibold text-slate-700">{field.label}{field.required ? " *" : ""}</span>{field.key === "domain_id" && (editor.section === "contacts" || editor.section === "opportunities") ? <select name="domain_id" required disabled={editor.section === "contacts" && editor.row != null || pages.domains.items.length === 0} defaultValue={inputValue(editor.row, field.key)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="">Sélectionnez un domaine</option>{pages.domains.items.map((domain) => <option key={domain.id} value={domain.id}>{displayValue(domain.display_name ?? domain.hostname)}</option>)}</select> : field.key === "asset_id" && editor.section === "opportunities" ? <select name="asset_id" required disabled={pages.assets.items.length === 0} defaultValue={inputValue(editor.row, field.key)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="">Sélectionnez un asset</option>{pages.assets.items.map((asset) => <option key={asset.id} value={asset.id}>{displayValue(asset.display_name ?? asset.canonical_url)}</option>)}</select> : field.type === "textarea" ? <textarea name={field.key} required={field.required} defaultValue={inputValue(editor.row, field.key)} rows={4} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /> : <input name={field.key} type={field.type ?? "text"} required={field.required} defaultValue={inputValue(editor.row, field.key)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />}</label>)}</div>{editor.section === "campaigns" && editor.row != null ? <section className="mt-6 border-t border-slate-200 pt-6"><h3 className="text-sm font-semibold text-slate-950">Opportunités associées</h3>{campaignOpportunityMembershipsLoading ? <p className="mt-4 text-sm text-slate-600">Chargement des opportunités associées…</p> : campaignOpportunityMembershipsError ? <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{campaignOpportunityMembershipsError}</p> : <><div className="mt-4 space-y-2">{activeCampaignMemberships.length === 0 ? <p className="text-sm text-slate-600">Aucune opportunité associée à cette campagne.</p> : activeCampaignMemberships.map((membership) => <div key={membership.opportunity_id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2"><span className="text-sm text-slate-700">{opportunityLabel(membership.opportunity_id)}</span><button type="button" onClick={() => void detachCampaignOpportunity(membership.opportunity_id)} disabled={detachingCampaignOpportunityId === membership.opportunity_id} className="rounded-full px-3 py-1 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Retirer</button></div>)}</div>{pages.opportunities.items.length === 0 ? <p className="mt-4 text-sm text-slate-600">Aucune opportunité disponible. Créez d’abord une opportunité dans l’onglet Opportunities.</p> : availableCampaignOpportunities.length === 0 ? <p className="mt-4 text-sm text-slate-600">Toutes les opportunités disponibles sont déjà associées à cette campagne.</p> : null}<div className="mt-4 flex flex-col gap-3 sm:flex-row"><select value={selectedCampaignOpportunityId} onChange={(event) => setSelectedCampaignOpportunityId(event.target.value)} disabled={attachingCampaignOpportunity || campaignOpportunityMembershipsLoading || availableCampaignOpportunities.length === 0} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="">Sélectionner une opportunité</option>{availableCampaignOpportunities.map((opportunity) => <option key={opportunity.id} value={opportunity.id}>{opportunityLabel(opportunity.id)}</option>)}</select><button type="button" onClick={() => void attachCampaignOpportunity()} disabled={campaignOpportunityMembershipsLoading || attachingCampaignOpportunity || !selectedCampaignOpportunityId || availableCampaignOpportunities.length === 0} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{attachingCampaignOpportunity ? "Ajout…" : "Ajouter"}</button></div></>}</section> : null}{formError ? <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{formError}</p> : null}<div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setEditor(null)} disabled={submitting} className="rounded-full px-4 py-2 text-sm font-semibold text-slate-700">Annuler</button><button type="submit" disabled={submitting || (editor.section === "opportunities" && editor.row == null && (pages.domains.items.length === 0 || pages.assets.items.length === 0))} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{submitting ? "Enregistrement…" : "Enregistrer"}</button></div></form></div> : null}
    </div>
  );
}
