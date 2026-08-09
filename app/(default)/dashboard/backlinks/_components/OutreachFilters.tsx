import React from "react";

type Props = {
  searchQuery: string;
  campaignFilter: string;
  statusFilter: string;
  channelFilter: string;
  campaigns: readonly { id: string; label: string }[];
  channels: readonly string[];
  onSearchQueryChange: (value: string) => void;
  onCampaignFilterChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onChannelFilterChange: (value: string) => void;
  onReset: () => void;
  resetDisabled: boolean;
  resultCount: number;
  totalCount: number;
  filtersActive: boolean;
  statusLabel: (value: string) => string;
  channelLabel: (value: string) => string;
};

export default function OutreachFilters({ searchQuery, campaignFilter, statusFilter, channelFilter, campaigns, channels, onSearchQueryChange, onCampaignFilterChange, onStatusFilterChange, onChannelFilterChange, onReset, resetDisabled, resultCount, totalCount, filtersActive, statusLabel, channelLabel }: Props) {
  return <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><label className="text-sm font-semibold text-slate-700">Rechercher<input value={searchQuery} onChange={(event) => onSearchQueryChange(event.target.value)} placeholder="Rechercher un contact, une campagne ou une opportunité…" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal" /></label><label className="text-sm font-semibold text-slate-700">Campagne<select value={campaignFilter} onChange={(event) => onCampaignFilterChange(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal"><option value="">Toutes les campagnes</option>{campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.label}</option>)}</select></label><label className="text-sm font-semibold text-slate-700">Statut<select value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal"><option value="">Tous les statuts</option>{["draft","ready","active","replied","conversation_open","declined","no_response","paused","closed"].map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></label><label className="text-sm font-semibold text-slate-700">Canal<select value={channelFilter} onChange={(event) => onChannelFilterChange(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal"><option value="">Tous les canaux</option>{channels.map((channel) => <option key={channel} value={channel}>{channelLabel(channel)}</option>)}</select></label><div className="sm:col-span-2 xl:col-span-4 flex items-center justify-between gap-3 text-sm text-slate-600"><span>{resultCount} résultat{resultCount === 1 ? "" : "s"}{filtersActive ? ` sur ${totalCount}` : ""}</span><button type="button" onClick={onReset} disabled={resetDisabled} className="font-semibold underline decoration-slate-300 underline-offset-4 disabled:opacity-50">Réinitialiser</button></div></div>;
}
