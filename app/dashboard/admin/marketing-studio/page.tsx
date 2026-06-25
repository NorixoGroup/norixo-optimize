"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import type { MarketingCampaignBundle } from "@/lib/marketing-ai/bundle/marketingCampaignBundle";
import { buildMetaPreviewModel } from "@/lib/marketing-ai/meta/metaPreviewBuilder";
import type {
  MarketingStudioOrchestratorV2Input,
  MarketingStudioOrchestratorV2Result,
} from "@/lib/marketing-ai/orchestrator/marketingStudioOrchestratorV2";

type ActiveChannel = "facebook" | "instagram" | "linkedin";
type ResultTab =
  | "summary"
  | "planning"
  | "creative"
  | "media"
  | "video"
  | "localization"
  | "communities"
  | "publisher"
  | "metaPreview"
  | "json";
type TimelineStatus = "neutral" | "running" | "done";
type MetaUiStatus =
  | "not_connected"
  | "callback_received"
  | "pages_detected"
  | "instagram_detected"
  | "no_pages"
  | "oauth_error"
  | "pages_error"
  | "instagram_error";

type CampaignFormState = MarketingStudioOrchestratorV2Input & {
  targetMarket: string;
  durationLabel: string;
  budget: string;
  personas: string[];
  frequency: string[];
};

type RunResponse = {
  ok: boolean;
  result?: MarketingStudioOrchestratorV2Result;
  error?: string;
};

const ACTIVE_CHANNELS: ActiveChannel[] = ["facebook", "instagram", "linkedin"];
const HERO_BADGES = [
  "Planning editorial",
  "Facebook",
  "Instagram",
  "LinkedIn",
  "Prompts image",
  "Prompts video",
  "11 langues",
  "Validation humaine",
];
const TIMELINE_STEPS = [
  { key: "campaign", label: "Campaign" },
  { key: "memory", label: "Memory" },
  { key: "planner", label: "Planner" },
  { key: "social", label: "Social" },
  { key: "creative", label: "Creative" },
  { key: "video", label: "Video" },
  { key: "localization", label: "Localization" },
  { key: "community", label: "Community" },
  { key: "review", label: "Review" },
  { key: "approval", label: "Approval" },
  { key: "publisher", label: "Publisher" },
] as const;
const BUDGET_OPTIONS = ["Gratuit", "100 EUR", "250 EUR", "500 EUR", "Personnalise"];
const PERSONA_OPTIONS = [
  "Hotes Airbnb",
  "Conciergeries",
  "Property Managers",
  "Investisseurs",
  "Digital Nomads",
  "Agences",
  "Hotels",
];
const FREQUENCY_OPTIONS = [
  "3 posts / semaine",
  "2 reels / semaine",
  "1 carousel / semaine",
  "Stories legeres",
];
const UPCOMING_CHANNELS = [
  "X / Twitter - bientot",
  "TikTok - bientot",
  "Pinterest - bientot",
];
const MONTH_SLOTS = [
  {
    week: "Semaine 1",
    slots: ["Lundi - Instagram Reel", "Mercredi - Facebook Post", "Vendredi - LinkedIn Post"],
  },
  {
    week: "Semaine 2",
    slots: ["Lundi - Post benefice", "Mercredi - Reel demonstration", "Vendredi - LinkedIn insight"],
  },
  {
    week: "Semaine 3",
    slots: ["Lundi - Post educatif", "Mercredi - Facebook objection client", "Vendredi - Instagram carousel"],
  },
  {
    week: "Semaine 4",
    slots: ["Lundi - Post recapitulatif", "Mercredi - Community post", "Vendredi - Conversion CTA"],
  },
] as const;
const DEFAULT_FORM: CampaignFormState = {
  name: "Campagne marketing mensuelle Norixo",
  objective:
    "Faire decouvrir Norixo Optimize aux conciergeries et aux hotes professionnels.",
  audience: "Hotes et conciergeries",
  language: "fr",
  channels: ["facebook", "instagram", "linkedin"],
  tone: "professional",
  cta: "Demander un audit Norixo",
  durationDays: 30,
  targetMarket: "France",
  durationLabel: "1 mois",
  budget: "250 EUR",
  personas: ["Hotes Airbnb", "Conciergeries", "Property Managers"],
  frequency: ["3 posts / semaine", "2 reels / semaine", "Stories legeres"],
};

function resolveMetaUiStatus(value: string | null): MetaUiStatus {
  if (
    value === "callback_received" ||
    value === "pages_detected" ||
    value === "instagram_detected" ||
    value === "no_pages" ||
    value === "oauth_error" ||
    value === "pages_error" ||
    value === "instagram_error"
  ) {
    return value;
  }

  return "not_connected";
}

function buildMetaUiContent(status: MetaUiStatus) {
  switch (status) {
    case "callback_received":
      return {
        statusLabel: "oauth recu",
        statusTone: "emerald" as const,
        oauthLabel: "recu, lecture seule",
        facebookValue: "Pages non encore affichees",
        instagramValue: "En attente de detection",
        helperText: "OAuth recu. Aucune publication possible.",
        alert: null,
      };
    case "pages_detected":
      return {
        statusLabel: "pages detectees",
        statusTone: "emerald" as const,
        oauthLabel: "connecte en lecture seule",
        facebookValue: "Pages Facebook detectees",
        instagramValue: "Non detecte ou non lie",
        helperText: "Pages detectees. Instagram Business non detecte ou non lie.",
        alert: null,
      };
    case "instagram_detected":
      return {
        statusLabel: "instagram detecte",
        statusTone: "emerald" as const,
        oauthLabel: "connecte en lecture seule",
        facebookValue: "Pages Facebook detectees",
        instagramValue: "Compte Instagram Business lie detecte",
        helperText: "Meta connecte en lecture seule. Aucune publication possible.",
        alert: null,
      };
    case "no_pages":
      return {
        statusLabel: "aucune page detectee",
        statusTone: "amber" as const,
        oauthLabel: "connecte en lecture seule",
        facebookValue: "Aucune Page Facebook detectee",
        instagramValue: "Aucun compte lie",
        helperText: "Verifier les permissions et le role admin de la Page.",
        alert: null,
      };
    case "oauth_error":
      return {
        statusLabel: "erreur oauth",
        statusTone: "amber" as const,
        oauthLabel: "connexion a relancer",
        facebookValue: "Lecture des Pages indisponible",
        instagramValue: "Lecture Instagram indisponible",
        helperText: "Une erreur est survenue pendant la connexion Meta.",
        alert: "Connexion Meta indisponible pour le moment. Reessayez sans partager de token.",
      };
    case "pages_error":
      return {
        statusLabel: "erreur pages",
        statusTone: "amber" as const,
        oauthLabel: "connecte en lecture seule",
        facebookValue: "Lecture des Pages indisponible",
        instagramValue: "Non verifie",
        helperText: "Impossible de confirmer les Pages Facebook detectees.",
        alert: "La lecture des Pages Facebook a echoue. Verifiez vos permissions Meta.",
      };
    case "instagram_error":
      return {
        statusLabel: "erreur instagram",
        statusTone: "amber" as const,
        oauthLabel: "connecte en lecture seule",
        facebookValue: "Pages Facebook detectees",
        instagramValue: "Lecture Instagram indisponible",
        helperText: "Les Pages ont ete detectees, mais pas le compte Instagram Business.",
        alert: "La detection Instagram Business a echoue. Les Pages Facebook restent en lecture seule.",
      };
    case "not_connected":
    default:
      return {
        statusLabel: "non connecte",
        statusTone: "amber" as const,
        oauthLabel: "pret a connecter",
        facebookValue: "Aucune Page connectee",
        instagramValue: "Aucun compte lie",
        helperText: "OAuth pret a connecter. Aucune publication possible.",
        alert: null,
      };
  }
}

function formatPlatformLabel(value: string) {
  if (value === "facebook") {
    return "Facebook";
  }

  if (value === "instagram") {
    return "Instagram";
  }

  if (value === "linkedin") {
    return "LinkedIn";
  }

  return value;
}

function formatLanguageLabel(value: string) {
  if (value === "fr") {
    return "Francais";
  }

  if (value === "en") {
    return "English";
  }

  if (value === "es") {
    return "Espanol";
  }

  if (value === "de") {
    return "Deutsch";
  }

  if (value === "it") {
    return "Italiano";
  }

  if (value === "pt") {
    return "Portugues";
  }

  if (value === "nl") {
    return "Nederlands";
  }

  if (value === "ja") {
    return "Japanese";
  }

  if (value === "zh") {
    return "Chinese";
  }

  if (value === "ko") {
    return "Korean";
  }

  if (value === "ar") {
    return "Arabic";
  }

  return value.toUpperCase();
}

function formatPublishAction(value: string) {
  return value === "manual_review_required"
    ? "Validation manuelle requise"
    : value;
}

function formatModeLabel(value: string) {
  if (value === "preview_only") {
    return "Previsualisation uniquement";
  }

  if (value === "draft_only") {
    return "Brouillon uniquement";
  }

  return value;
}

function formatPreviewStatus(value: string) {
  if (value === "draft") {
    return "Brouillon";
  }

  if (value === "ready_for_review") {
    return "Pret pour review";
  }

  if (value === "missing_asset") {
    return "Asset manquant";
  }

  if (value === "blocked") {
    return "Bloque";
  }

  if (value === "approved") {
    return "Approuve";
  }

  return value;
}

function formatApprovalStatus(value: string | null | undefined) {
  if (value === "pending_review") {
    return "En attente de validation";
  }

  if (value === "approved") {
    return "Approuve";
  }

  if (value === "rejected") {
    return "Refuse";
  }

  return value ?? "-";
}

function formatAssetKind(value: string) {
  if (value === "cover") {
    return "Cover";
  }

  if (value === "thumbnail") {
    return "Thumbnail";
  }

  if (value === "story") {
    return "Story";
  }

  if (value === "text_only") {
    return "Texte";
  }

  if (value === "carousel") {
    return "Carousel";
  }

  if (value === "reel") {
    return "Reel";
  }

  if (value === "video") {
    return "Video";
  }

  if (value === "image") {
    return "Image";
  }

  return value;
}

function formatMediaAssetStatus(value: string) {
  if (value === "missing") {
    return "Manquant";
  }

  if (value === "queued") {
    return "En file";
  }

  if (value === "generating") {
    return "Generation";
  }

  if (value === "generated") {
    return "Genere";
  }

  if (value === "approved") {
    return "Approuve";
  }

  if (value === "rejected") {
    return "Refuse";
  }

  if (value === "downloaded") {
    return "Telecharge";
  }

  if (value === "published") {
    return "Publie";
  }

  if (value === "failed") {
    return "Echec";
  }

  return value;
}

type BundleMediaAsset = NonNullable<
  NonNullable<MarketingCampaignBundle["media"]>["assets"]
>[number];

function formatMediaAssetTitle(asset: BundleMediaAsset) {
  if (asset.platform === "generic" && asset.kind === "image") {
    return "Hero Image";
  }

  if (asset.platform === "instagram" && asset.kind === "reel") {
    return "Instagram Reel";
  }

  if (asset.platform === "facebook" && asset.kind === "image") {
    return "Facebook Image";
  }

  if (asset.platform === "linkedin" && asset.kind === "cover") {
    return "LinkedIn Cover";
  }

  if (asset.kind === "thumbnail") {
    return "Thumbnail";
  }

  return asset.title ?? `${formatPlatformLabel(asset.platform)} ${formatAssetKind(asset.kind)}`;
}

function formatMediaAssetPlatform(value: string) {
  if (value === "generic") {
    return "Generic";
  }

  return formatPlatformLabel(value);
}

function resolveMediaPreviewLabel(asset: BundleMediaAsset) {
  if (asset.kind === "video" || asset.kind === "reel") {
    return "Video Preview";
  }

  return "Image Preview";
}

function estimateExpectedMediaCount(channels: ActiveChannel[]) {
  return 2 + channels.length;
}

function resolveTimelineStepStatus(
  stepKey: (typeof TIMELINE_STEPS)[number]["key"],
  bundle: MarketingCampaignBundle | null,
  loading: boolean,
): TimelineStatus {
  if (!bundle) {
    return loading ? "running" : "neutral";
  }

  if (stepKey === "campaign") {
    return bundle.campaign ? "done" : "neutral";
  }

  if (stepKey === "memory") {
    return bundle.campaignMemory ? "done" : "neutral";
  }

  if (stepKey === "planner") {
    return bundle.planning ? "done" : "neutral";
  }

  if (stepKey === "social") {
    return bundle.social ? "done" : "neutral";
  }

  if (stepKey === "creative") {
    return bundle.creative ? "done" : "neutral";
  }

  if (stepKey === "video") {
    return bundle.video ? "done" : "neutral";
  }

  if (stepKey === "localization") {
    return bundle.localization ? "done" : "neutral";
  }

  if (stepKey === "community") {
    return bundle.communityDiscovery ? "done" : "neutral";
  }

  if (stepKey === "review") {
    return bundle.review ? "done" : "neutral";
  }

  if (stepKey === "approval") {
    return bundle.approval ? "done" : "neutral";
  }

  if (stepKey === "publisher") {
    return bundle.publisher ? "done" : "neutral";
  }

  return "neutral";
}

function SectionCard({
  title,
  eyebrow,
  children,
  className = "",
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-[28px] border border-slate-200 bg-white p-6 shadow-md ${className}`.trim()}>
      {eyebrow ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-1 text-xl font-semibold text-slate-950">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function MetricTile({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "slate" | "emerald" | "amber";
}) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50"
      : tone === "amber"
      ? "border-amber-200 bg-amber-50"
      : "border-slate-200 bg-slate-50";

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 whitespace-pre-wrap text-sm font-semibold text-slate-950">
        {value}
      </p>
    </div>
  );
}

function BadgeList({
  values,
  muted = false,
}: {
  values: string[];
  muted?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <span
          key={value}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            muted
              ? "border border-slate-200 bg-slate-50 text-slate-500"
              : "border border-sky-200 bg-sky-100/90 text-sky-950"
          }`}
        >
          {value}
        </span>
      ))}
    </div>
  );
}

function KpiStripItem({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "slate" | "sky" | "emerald" | "amber";
}) {
  const toneClass =
    tone === "sky"
      ? "border-sky-200 bg-sky-50"
      : tone === "emerald"
        ? "border-emerald-200 bg-emerald-50"
        : tone === "amber"
          ? "border-amber-200 bg-amber-50"
          : "border-slate-200 bg-white";

  return (
    <div className={`min-w-[150px] rounded-2xl border px-4 py-3 ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function ChannelCard({
  title,
  lines,
  active,
  onToggle,
  disabled = false,
}: {
  title: string;
  lines: string[];
  active: boolean;
  onToggle?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`w-full rounded-[28px] border p-5 text-left transition ${
        disabled
          ? "cursor-not-allowed border-dashed border-slate-200 bg-slate-50 text-slate-500"
          : active
          ? "border-sky-500 bg-sky-50 text-slate-900 shadow-lg ring-2 ring-sky-200"
          : "border-slate-200 bg-white text-slate-900 hover:border-slate-300"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold">{title}</p>
          <p className={`mt-1 text-xs uppercase tracking-[0.16em] ${disabled ? "text-slate-500" : active ? "text-slate-600" : "text-slate-500"}`}>
            {disabled ? "bientot" : active ? "active" : "desactive"}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase ${
            disabled
              ? "border border-slate-200 bg-white text-slate-500"
              : active
              ? "bg-sky-600 text-white"
              : "border border-slate-200 bg-slate-50 text-slate-600"
          }`}
        >
          brouillon uniquement
        </span>
      </div>

      <div className="mt-4 space-y-2 text-sm leading-6">
        {lines.map((line) => (
          <p key={`${title}-${line}`}>{line}</p>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <span
          className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
            disabled
              ? "border border-slate-200 bg-white text-slate-500"
              : active
              ? "border border-emerald-200 bg-emerald-100 text-emerald-700"
              : "border border-slate-200 bg-slate-50 text-slate-600"
          }`}
        >
          validation requise
        </span>
      </div>
    </button>
  );
}

function TimelineStep({
  label,
  status,
}: {
  label: string;
  status: TimelineStatus;
}) {
  const classes =
    status === "done"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm"
      : status === "running"
      ? "border-amber-200 bg-amber-50 text-amber-700 shadow-sm"
      : "border-slate-200 bg-white text-slate-500";

  const dotClasses =
    status === "done"
      ? "bg-emerald-500"
      : status === "running"
      ? "bg-amber-500"
      : "bg-slate-300";

  const badgeLabel =
    status === "done" ? "done" : status === "running" ? "running" : "waiting";

  return (
    <div className={`flex min-w-[148px] items-center gap-3 rounded-2xl border px-4 py-3 ${classes}`}>
      <span className={`h-2.5 w-2.5 rounded-full ${dotClasses}`} />
      <div className="min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-[11px] uppercase tracking-[0.16em] opacity-80">
          {badgeLabel}
        </p>
      </div>
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
        active
          ? "border border-sky-600 bg-sky-600 text-white shadow-sm"
          : "border border-slate-300 bg-white text-slate-600 hover:border-sky-300 hover:bg-sky-50"
      }`}
    >
      {label}
    </button>
  );
}

function PublisherDraftCard({
  title,
  channel,
}: {
  title: string;
  channel: NonNullable<MarketingCampaignBundle["publisher"]>["channels"]["facebook"];
}) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-semibold text-slate-950">{title}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
            Draft preview
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase text-slate-700">
            Statut : {formatPreviewStatus(channel.status)}
          </span>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase text-amber-700">
            Validation : obligatoire
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <MetricTile label="Publication" value="Publication desactivee" />
        <MetricTile label="Action" value={formatPublishAction(channel.publishAction)} />
        <MetricTile label="Mode" value="brouillon uniquement" />
      </div>

      <div className="mt-5 space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Caption
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
            {channel.caption}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Hashtags
          </p>
          <div className="mt-3">
            <BadgeList values={channel.hashtags.map((tag) => tag.trim())} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Prompt image
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
            {channel.assetPrompt}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Prompt video
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
            {channel.videoPrompt}
          </p>
        </div>
      </div>
    </div>
  );
}

function MediaAssetPlaceholderCard({
  asset,
  fallbackLanguage,
}: {
  asset: BundleMediaAsset;
  fallbackLanguage: string;
}) {
  const metadata = asset.metadata ?? {};
  const warnings = asset.warnings ?? [];
  const previewLabel = resolveMediaPreviewLabel(asset);

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-xs font-semibold uppercase tracking-[0.16em] text-white">
            {asset.kind === "video" || asset.kind === "reel" ? "VID" : "IMG"}
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-950">
              {formatMediaAssetTitle(asset)}
            </p>
            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
              {asset.id}
            </p>
          </div>
        </div>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase text-amber-700">
          {formatMediaAssetStatus(asset.status)}
        </span>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase text-slate-700">
          Status: {formatMediaAssetStatus(asset.status)}
        </span>
        <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase text-sky-700">
          Platform: {formatMediaAssetPlatform(asset.platform)}
        </span>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase text-slate-700">
          Ratio: {asset.ratio}
        </span>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase text-slate-700">
          Kind: {formatAssetKind(asset.kind)}
        </span>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <MetricTile label="Plateforme" value={formatMediaAssetPlatform(asset.platform)} />
        <MetricTile label="Ratio" value={asset.ratio} />
        <MetricTile label="Statut" value={formatMediaAssetStatus(asset.status)} tone="amber" />
        <MetricTile label="Langue" value={asset.language ?? fallbackLanguage} />
      </div>

      <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-sky-50 p-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
          {asset.kind === "video" || asset.kind === "reel" ? "VID" : "IMG"}
        </div>
        <p className="mt-4 text-sm font-semibold text-slate-950">{previewLabel}</p>
        <p className="mt-2 text-sm text-slate-600">Coming Soon</p>
      </div>

      {asset.status === "missing" ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          Aucun media genere
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          disabled
          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-400"
        >
          Telecharger
        </button>
        <button
          type="button"
          disabled
          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-400"
        >
          Regenerer
        </button>
        <button
          type="button"
          disabled
          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-400"
        >
          Nouvelle variante
        </button>
      </div>

      <details className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-950">
          Details IA
        </summary>
        <div className="mt-4 space-y-4">
          <MetricTile label="Prompt" value={asset.prompt ?? "-"} />
          <MetricTile label="Negative prompt" value={asset.negativePrompt ?? "-"} />
          <MetricTile
            label="Warnings"
            value={warnings.length ? warnings.join("\n") : "Aucun warning"}
          />
          <MetricTile
            label="Provider"
            value={asset.generationProvider ?? "Not generated"}
          />
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Metadata
            </p>
            <pre className="mt-3 overflow-x-auto text-xs leading-6 text-slate-700">
              {JSON.stringify(metadata, null, 2)}
            </pre>
          </div>
        </div>
      </details>
    </div>
  );
}

function buildMonthlyPreview(
  planning: MarketingCampaignBundle["planning"],
) {
  return MONTH_SLOTS.map((week, weekIndex) => {
    const startDay = weekIndex * 7 + 1;
    const endDay = startDay + 6;
    const items =
      planning?.items.filter((item) => item.day >= startDay && item.day <= endDay) ?? [];

    const slots = week.slots.map((slot, slotIndex) => {
      const item = items[slotIndex];

      return item
        ? `${slot.split(" - ")[0]} - ${item.channel} ${item.format} - ${item.topic}`
        : slot;
    });

    return {
      week: week.week,
      slots,
    };
  });
}

function estimateQualityScore(form: CampaignFormState) {
  const channelScore = (form.channels?.length ?? 0) * 4;
  const personaScore = Math.min(form.personas.length, 4) * 2;
  const frequencyScore = Math.min(form.frequency.length, 4) * 2;
  return Math.min(89, 68 + channelScore + personaScore + frequencyScore);
}

function resolveQualityScore(bundle: MarketingCampaignBundle | null) {
  if (!bundle) {
    return null;
  }

  const sectionCount = [
    bundle.planning,
    bundle.social,
    bundle.creative,
    bundle.video,
    bundle.localization,
    bundle.communityDiscovery,
    bundle.review,
    bundle.approval,
    bundle.publisher,
  ].filter(Boolean).length;

  return Math.min(96, 78 + sectionCount * 2);
}

export default function MarketingStudioPage() {
  const searchParams = useSearchParams();
  const [form, setForm] = useState<CampaignFormState>(DEFAULT_FORM);
  const [submittedForm, setSubmittedForm] = useState<CampaignFormState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MarketingStudioOrchestratorV2Result | null>(null);
  const [activeTab, setActiveTab] = useState<ResultTab>("summary");

  const activeChannels = useMemo(
    () => ACTIVE_CHANNELS.filter((channel) => form.channels?.includes(channel)),
    [form.channels],
  );
  const submittedChannels = submittedForm?.channels ?? [];
  const bundle = result?.bundle ?? null;
  const metaPreview = bundle ? buildMetaPreviewModel(bundle) : null;
  const campaign = bundle?.campaign;
  const approval = bundle?.approval;
  const publisher = bundle?.publisher;
  const mediaAssets = bundle?.media?.assets ?? [];
  const localizationEntries = Object.entries(bundle?.localization ?? {});
  const monthlyPreview = buildMonthlyPreview(bundle?.planning);
  const estimatedScore = estimateQualityScore(form);
  const resolvedScore = resolveQualityScore(bundle);
  const qualityLabel = bundle ? "Campaign Quality Score" : "Estimation qualite";
  const metaUiStatus = resolveMetaUiStatus(searchParams.get("meta"));
  const metaUi = buildMetaUiContent(metaUiStatus);
  const plannerItems = bundle?.planning?.items ?? [];
  const campaignProgress = approval?.status === "approved" ? 100 : bundle ? 85 : 0;
  const expectedMediaCount = bundle ? mediaAssets.length : estimateExpectedMediaCount(activeChannels);
  const localizationCount = bundle ? localizationEntries.length : 1;
  const communityCount = bundle?.communityDiscovery?.communities.length ?? 0;
  const platformCount = bundle?.campaign.platforms.length ?? activeChannels.length;
  const generatedContentCount = bundle ? plannerItems.length : 0;
  const controlCenterStatus = loading
    ? "Generation en cours"
    : approval?.status === "approved"
      ? "Campagne approuvee"
      : bundle
        ? "Campagne prete a valider"
        : "Nouvelle campagne marketing";
  const controlCenterTitle = bundle
    ? campaign?.name ?? "Campagne prete a valider"
    : "Studio creatif IA personnel pour Norixo";
  const controlCenterDescription = bundle
    ? "Les contenus, medias et brouillons sont prets pour une validation humaine avant publication."
    : "Configurez une campagne, generez les contenus, preparez les medias et validez avant publication.";
  const campaignProgressLabel =
    campaignProgress === 0
      ? "En attente"
      : campaignProgress === 100
      ? "Validation complete"
      : "Campagne prete";
  const campaignProgressItems = [
    { label: "Planner", done: Boolean(bundle?.planning) },
    { label: "Social", done: Boolean(bundle?.social) },
    { label: "Creative", done: Boolean(bundle?.creative) },
    { label: "Video", done: Boolean(bundle?.video) },
    { label: "Localization", done: Boolean(bundle?.localization) },
    { label: "Publisher", done: Boolean(bundle?.publisher) },
    { label: "Meta Preview", done: Boolean(metaPreview?.previews.length) },
    { label: "Validation Mohamed", done: approval?.status === "approved" },
  ];

  const publisherCards = publisher
    ? submittedChannels
        .filter((channel): channel is ActiveChannel => ACTIVE_CHANNELS.includes(channel as ActiveChannel))
        .map((channel) => ({
          key: channel,
          label:
            channel === "facebook"
              ? "Facebook Draft"
              : channel === "instagram"
              ? "Instagram Draft"
              : "LinkedIn Draft",
          value: publisher.channels[channel],
        }))
    : [];

  function updateField<Key extends keyof CampaignFormState>(
    key: Key,
    value: CampaignFormState[Key],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function toggleChannel(channel: ActiveChannel) {
    setForm((current) => {
      const currentChannels = current.channels ?? [];
      const nextChannels = currentChannels.includes(channel)
        ? currentChannels.filter((value) => value !== channel)
        : [...currentChannels, channel];

      return {
        ...current,
        channels: nextChannels,
      };
    });
  }

  function toggleUiListItem(key: "personas" | "frequency", value: string) {
    setForm((current) => {
      const list = current[key];
      const next = list.includes(value)
        ? list.filter((item) => item !== value)
        : [...list, value];

      return {
        ...current,
        [key]: next,
      };
    });
  }

  async function handleGenerate() {
    if (!activeChannels.length) {
      setError("Selectionnez au moins un canal actif.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/marketing-studio/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          channels: activeChannels,
        }),
      });
      const data = (await response.json()) as RunResponse;

      if (!response.ok || !data.ok || !data.result) {
        throw new Error(data.error ?? "Campaign generation failed.");
      }

      setSubmittedForm({
        ...form,
        channels: [...activeChannels],
      });
      setResult(data.result);
      setActiveTab("summary");
    } catch (caughtError) {
      setResult(null);
      setSubmittedForm(null);
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Campaign generation failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardShell>
      <div className="space-y-8">
        <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-sky-50 p-8 shadow-lg shadow-slate-200/60">
          <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-4xl">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                  Marketing Studio
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                    loading
                      ? "border border-amber-200 bg-amber-50 text-amber-700"
                      : bundle
                        ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border border-sky-200 bg-sky-50 text-sky-700"
                  }`}
                >
                  {controlCenterStatus}
                </span>
              </div>

              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">
                {controlCenterTitle}
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
                {controlCenterDescription}
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {bundle ? (
                  <BadgeList
                    values={[
                      `${platformCount} plateforme${platformCount > 1 ? "s" : ""}`,
                      `${localizationCount} langue${localizationCount > 1 ? "s" : ""}`,
                      `${expectedMediaCount} media${expectedMediaCount > 1 ? "s" : ""}`,
                      `${communityCount} communaute${communityCount > 1 ? "s" : ""}`,
                      "Validation Mohamed",
                      "Publication desactivee",
                    ]}
                  />
                ) : (
                  <BadgeList values={HERO_BADGES} />
                )}
              </div>
            </div>

            <div className="w-full max-w-sm rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <MetricTile
                  label="Statut"
                  value={controlCenterStatus}
                  tone={bundle ? "emerald" : "slate"}
                />
                <MetricTile
                  label="Validation"
                  value={bundle ? "Mohamed requis" : "A preparer"}
                  tone="amber"
                />
              </div>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading}
                className="mt-4 w-full rounded-2xl bg-sky-600 px-5 py-4 text-sm font-semibold text-white shadow-md transition hover:bg-sky-700 disabled:opacity-60"
              >
                {loading ? "Generation en cours..." : "Generer ma campagne IA"}
              </button>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {bundle
                  ? "Le studio reste en brouillon jusqu'a validation humaine."
                  : "Configurez votre campagne puis lancez la generation quand vous etes pret."}
              </p>

              {error ? (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="overflow-x-auto rounded-[28px] border border-slate-200 bg-white p-4 shadow-md">
          <div className="flex min-w-max gap-3">
            {bundle ? (
              <>
                <KpiStripItem
                  label="Contenus generes"
                  value={`${generatedContentCount}`}
                  tone="sky"
                />
                <KpiStripItem
                  label="Medias"
                  value={`${expectedMediaCount}`}
                  tone="sky"
                />
                <KpiStripItem
                  label="Plateformes"
                  value={`${platformCount}`}
                />
                <KpiStripItem
                  label="Langues"
                  value={`${localizationCount}`}
                />
                <KpiStripItem
                  label="Communautes"
                  value={`${communityCount}`}
                />
                <KpiStripItem
                  label="Publication"
                  value="Desactivee"
                  tone="amber"
                />
                <KpiStripItem
                  label="Validation"
                  value="Mohamed"
                  tone="emerald"
                />
              </>
            ) : (
              <>
                <KpiStripItem
                  label="Plateformes selectionnees"
                  value={activeChannels.map(formatPlatformLabel).join(", ") || "Aucune"}
                  tone="sky"
                />
                <KpiStripItem
                  label="Langue principale"
                  value={formatLanguageLabel(form.language ?? "fr")}
                />
                <KpiStripItem label="Duree" value={form.durationLabel} />
                <KpiStripItem
                  label="Medias attendus"
                  value={`${expectedMediaCount}`}
                />
                <KpiStripItem
                  label="Validation"
                  value="Mohamed"
                  tone="amber"
                />
              </>
            )}
          </div>
        </section>

        <SectionCard eyebrow="Timeline IA" title="Pipeline Marketing Studio">
          <div className="overflow-x-auto">
            <div className="flex min-w-max items-center gap-2 rounded-[28px] border border-slate-200 bg-gradient-to-r from-slate-50 via-white to-sky-50 p-4">
              {TIMELINE_STEPS.map((step, index) => (
                <div key={step.key} className="flex items-center gap-2">
                  <TimelineStep
                    label={step.label}
                    status={resolveTimelineStepStatus(step.key, bundle, loading)}
                  />
                  {index < TIMELINE_STEPS.length - 1 ? (
                    <span className="text-slate-300">→</span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </SectionCard>

        <div className="grid gap-8 xl:grid-cols-[1.6fr_0.9fr]">
          <div className="space-y-8">
            <SectionCard eyebrow="Configuration" title="Campagne">
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Nom de la campagne</span>
                  <input
                    value={form.name ?? ""}
                    onChange={(event) => updateField("name", event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Audience</span>
                  <input
                    value={form.audience ?? ""}
                    onChange={(event) => updateField("audience", event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400"
                  />
                </label>

                <label className="block lg:col-span-2">
                  <span className="text-sm font-semibold text-slate-700">Objectif</span>
                  <textarea
                    rows={4}
                    value={form.objective}
                    onChange={(event) => updateField("objective", event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Marche</span>
                  <input
                    value={form.targetMarket}
                    onChange={(event) => updateField("targetMarket", event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Langue principale</span>
                  <select
                    value={form.language ?? "fr"}
                    onChange={(event) => updateField("language", event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400"
                  >
                    <option value="fr">Francais</option>
                    <option value="en">English</option>
                    <option value="es">Espanol</option>
                    <option value="de">Deutsch</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Ton</span>
                  <select
                    value={form.tone ?? "professional"}
                    onChange={(event) => updateField("tone", event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400"
                  >
                    <option value="professional">Professionnel</option>
                    <option value="educational">Pedagogique</option>
                    <option value="confident">Assure</option>
                    <option value="friendly">Accessible</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">CTA</span>
                  <input
                    value={form.cta ?? ""}
                    onChange={(event) => updateField("cta", event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Duree</span>
                  <select
                    value={form.durationLabel}
                    onChange={(event) => {
                      const value = event.target.value;
                      updateField("durationLabel", value);
                      updateField("durationDays", value === "1 mois" ? 30 : 14);
                    }}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400"
                  >
                    <option value="1 mois">1 mois</option>
                    <option value="2 semaines">2 semaines</option>
                  </select>
                </label>
              </div>
            </SectionCard>

            <SectionCard eyebrow="Configuration moderne" title="Budget, personas et frequence">
              <div className="grid gap-6 lg:grid-cols-3">
                <div>
                  <p className="text-sm font-semibold text-slate-700">Budget test</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {BUDGET_OPTIONS.map((budget) => (
                      <button
                        key={budget}
                        type="button"
                        onClick={() => updateField("budget", budget)}
                        className={`rounded-full px-4 py-2 text-sm font-semibold ${
                          form.budget === budget
                            ? "border border-sky-600 bg-sky-600 text-white shadow-sm"
                            : "border border-slate-300 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50"
                        }`}
                      >
                        {budget}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-slate-700">Personas</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {PERSONA_OPTIONS.map((persona) => (
                      <button
                        key={persona}
                        type="button"
                        onClick={() => toggleUiListItem("personas", persona)}
                        className={`rounded-full px-4 py-2 text-sm font-semibold ${
                          form.personas.includes(persona)
                            ? "border border-sky-600 bg-sky-600 text-white shadow-sm"
                            : "border border-slate-300 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50"
                        }`}
                      >
                        {persona}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-slate-700">Frequence de publication</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {FREQUENCY_OPTIONS.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => toggleUiListItem("frequency", item)}
                        className={`rounded-full px-4 py-2 text-sm font-semibold ${
                          form.frequency.includes(item)
                            ? "border border-sky-600 bg-sky-600 text-white shadow-sm"
                            : "border border-slate-300 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50"
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard eyebrow="Canaux" title="Canaux de diffusion">
              <div className="grid gap-4 xl:grid-cols-3">
                <ChannelCard
                  title="Facebook"
                  lines={["Posts", "Stories", "Groupes plus tard"]}
                  active={activeChannels.includes("facebook")}
                  onToggle={() => toggleChannel("facebook")}
                />
                <ChannelCard
                  title="Instagram"
                  lines={["Reels", "Carousels", "Stories"]}
                  active={activeChannels.includes("instagram")}
                  onToggle={() => toggleChannel("instagram")}
                />
                <ChannelCard
                  title="LinkedIn"
                  lines={["Posts professionnels", "Articles plus tard"]}
                  active={activeChannels.includes("linkedin")}
                  onToggle={() => toggleChannel("linkedin")}
                />
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                {UPCOMING_CHANNELS.map((channel) => (
                  <ChannelCard
                    key={channel}
                    title={channel}
                    lines={["Activation plus tard", "Toujours en brouillon", "Validation requise"]}
                    active={false}
                    disabled
                  />
                ))}
              </div>
            </SectionCard>
          </div>

          <div className="space-y-8">
            <SectionCard eyebrow="Progression" title={campaignProgressLabel}>
              <div className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-sky-50 via-white to-emerald-50 p-6">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-5xl font-semibold text-slate-950">
                      {campaignProgress}%
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      {bundle
                        ? "Le bundle est pret pour une validation humaine avant toute publication."
                        : "Aucune generation lancee pour le moment."}
                    </p>
                  </div>
                  <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                    {bundle ? "bundle actif" : "workflow en attente"}
                  </div>
                </div>

                <div className="mt-5 h-3 rounded-full bg-slate-200">
                  <div
                    className="h-3 rounded-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-all"
                    style={{ width: `${campaignProgress}%` }}
                  />
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {campaignProgressItems.map((item) => (
                    <div
                      key={item.label}
                      className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
                        item.done
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border-slate-200 bg-white text-slate-500"
                      }`}
                    >
                      {item.done ? "✓" : "○"} {item.label}
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>

            <SectionCard eyebrow="Campaign Quality Score" title={qualityLabel}>
              <div className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-emerald-50 to-slate-50 p-6">
                <p className="text-5xl font-semibold text-slate-950">
                  {bundle ? resolvedScore : estimatedScore}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  {bundle
                    ? "Score visuel non bloquant apres generation."
                    : "Estimation UI avant generation, basee sur la configuration choisie."}
                </p>
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="Calendrier editorial"
              title={plannerItems.length ? "Planning reel du planner" : "Preview mensuelle"}
            >
              {plannerItems.length ? (
                <div className="space-y-4">
                  {plannerItems.map((item) => (
                    <div
                      key={`planner-side-${item.day}-${item.channel}-${item.topic}`}
                      className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase text-slate-700">
                          Jour {item.day}
                        </span>
                        <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase text-sky-700">
                          {formatPlatformLabel(item.channel)}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase text-slate-700">
                          {item.format}
                        </span>
                      </div>
                      <p className="mt-4 text-base font-semibold text-slate-950">{item.topic}</p>
                      <p className="mt-2 text-sm text-slate-600">{item.goal}</p>
                      <p className="mt-3 text-sm leading-6 text-slate-700">{item.cta}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {MONTH_SLOTS.map((week) => (
                    <div
                      key={week.week}
                      className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                    >
                      <p className="text-base font-semibold text-slate-950">{week.week}</p>
                      <div className="mt-4 space-y-2 text-sm leading-6 text-slate-700">
                        {week.slots.map((slot) => (
                          <p key={`${week.week}-${slot}`}>{slot}</p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard eyebrow="Securite publication" title="Toujours en brouillon">
              <div className="grid gap-4">
                <MetricTile label="Mode" value="brouillon uniquement" tone="amber" />
                <MetricTile
                  label="Publication automatique"
                  value="desactivee"
                  tone="amber"
                />
                <MetricTile
                  label="Validation humaine"
                  value="obligatoire"
                  tone="emerald"
                />
                <MetricTile label="Approbateur" value="Mohamed" />
              </div>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading}
                className="mt-6 w-full rounded-2xl bg-sky-600 px-5 py-4 text-sm font-semibold text-white shadow-md transition hover:bg-sky-700 disabled:opacity-60"
              >
                {loading ? "Generation en cours..." : "Generer ma campagne IA"}
              </button>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Aucune publication automatique. Tout reste en brouillon jusqu'a validation.
              </p>

              {error ? (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}
            </SectionCard>

            <SectionCard eyebrow="Meta read-only" title="Comptes Meta">
              <div className="mb-5">
                <BadgeList values={["READ ONLY", "NO PUBLISH", "HUMAN APPROVAL"]} />
              </div>

              <div className="grid gap-4">
                <MetricTile
                  label="Statut"
                  value={metaUi.statusLabel}
                  tone={metaUi.statusTone}
                />
                <MetricTile label="Mode" value="lecture seule" />
                <MetricTile
                  label="Publication automatique"
                  value="Publication desactivee"
                  tone="amber"
                />
                <MetricTile label="OAuth" value={metaUi.oauthLabel} />
                <MetricTile label="Validation humaine" value="obligatoire" tone="emerald" />
                <MetricTile label="Tokens" value="jamais affiches" />
              </div>

              <a
                href="/api/admin/marketing-studio/meta/login"
                className="mt-6 block w-full rounded-2xl bg-slate-950 px-5 py-4 text-center text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Connecter Meta
              </a>

              {metaUi.alert ? (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                  {metaUi.alert}
                </div>
              ) : null}

              <p className="mt-4 text-sm leading-6 text-slate-600">{metaUi.helperText}</p>

              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Facebook Page
                  </p>
                  <p className="mt-2 text-sm text-slate-700">{metaUi.facebookValue}</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Instagram Business
                  </p>
                  <p className="mt-2 text-sm text-slate-700">{metaUi.instagramValue}</p>
                </div>

                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                    Securite
                  </p>
                  <p className="mt-2 text-sm text-emerald-800">
                    Aucune publication automatique
                  </p>
                  <p className="mt-1 text-sm text-emerald-800">
                    Validation humaine obligatoire
                  </p>
                  <p className="mt-1 text-sm text-emerald-800">Aucun token affiche</p>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>

        {bundle && submittedForm ? (
          <div className="space-y-6">
            <SectionCard eyebrow="Resultats" title="Bundle marketing studio">
              <div className="flex flex-wrap gap-3">
                <TabButton label="Resume" active={activeTab === "summary"} onClick={() => setActiveTab("summary")} />
                <TabButton label="Planning" active={activeTab === "planning"} onClick={() => setActiveTab("planning")} />
                <TabButton label="Creative" active={activeTab === "creative"} onClick={() => setActiveTab("creative")} />
                <TabButton label="AI Media Assets" active={activeTab === "media"} onClick={() => setActiveTab("media")} />
                <TabButton label="Video" active={activeTab === "video"} onClick={() => setActiveTab("video")} />
                <TabButton label="Localization" active={activeTab === "localization"} onClick={() => setActiveTab("localization")} />
                <TabButton label="Communities" active={activeTab === "communities"} onClick={() => setActiveTab("communities")} />
                <TabButton label="Publisher" active={activeTab === "publisher"} onClick={() => setActiveTab("publisher")} />
                <TabButton label="Meta Preview" active={activeTab === "metaPreview"} onClick={() => setActiveTab("metaPreview")} />
                <TabButton label="JSON" active={activeTab === "json"} onClick={() => setActiveTab("json")} />
              </div>
            </SectionCard>

            {activeTab === "summary" ? (
              <SectionCard eyebrow="Resume" title="Campagne generee">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <MetricTile label="Nom" value={campaign?.name ?? submittedForm.name ?? "-"} />
                  <MetricTile label="Objectif" value={submittedForm.objective} />
                  <MetricTile label="Audience" value={submittedForm.audience ?? "-"} />
                  <MetricTile label="Marche" value={submittedForm.targetMarket} />
                  <MetricTile label="Langue" value={submittedForm.language ?? "fr"} />
                  <MetricTile label="Duree" value={submittedForm.durationLabel} />
                  <MetricTile label="Canaux" value={submittedChannels.join(", ")} />
                  <MetricTile label="CTA" value={submittedForm.cta ?? "-"} />
                  <MetricTile label="Budget test" value={submittedForm.budget} />
                  <MetricTile label="Review summary" value={bundle.review?.summary ?? "-"} />
                  <MetricTile
                    label="Approval status"
                    value={formatApprovalStatus(approval?.status)}
                    tone="amber"
                  />
                  <MetricTile
                    label="Validation humaine"
                    value={approval?.requiresHumanValidation ? "obligatoire" : "non"}
                    tone="emerald"
                  />
                </div>
              </SectionCard>
            ) : null}

            {activeTab === "planning" ? (
              <SectionCard eyebrow="Planning" title="Calendrier editorial mensuel">
                {plannerItems.length ? (
                  <div className="grid gap-4 xl:grid-cols-2">
                    {plannerItems.map((item) => (
                      <div
                        key={`planner-tab-${item.day}-${item.channel}-${item.topic}`}
                        className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase text-slate-700">
                            Jour {item.day}
                          </span>
                          <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase text-sky-700">
                            {formatPlatformLabel(item.channel)}
                          </span>
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase text-slate-700">
                            {item.format}
                          </span>
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase text-emerald-700">
                            {item.goal}
                          </span>
                        </div>
                        <p className="mt-4 text-lg font-semibold text-slate-950">{item.topic}</p>
                        <p className="mt-3 text-sm leading-6 text-slate-700">{item.notes}</p>
                        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            CTA
                          </p>
                          <p className="mt-2 text-sm text-slate-700">{item.cta}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid gap-4 xl:grid-cols-4">
                    {monthlyPreview.map((week) => (
                      <div
                        key={week.week}
                        className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                      >
                        <p className="text-base font-semibold text-slate-950">{week.week}</p>
                        <div className="mt-4 space-y-2 text-sm leading-6 text-slate-700">
                          {week.slots.map((slot) => (
                            <p key={`${week.week}-${slot}`}>{slot}</p>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            ) : null}

            {activeTab === "creative" && bundle.creative ? (
              <SectionCard eyebrow="Creative" title="Direction creative">
                <div className="grid gap-4 md:grid-cols-2">
                  <MetricTile label="Concept creatif" value={bundle.creative.creativeConcept} />
                  <MetricTile label="Style visuel" value={bundle.creative.visualStyle} />
                  <MetricTile label="Layout" value={bundle.creative.layout} />
                  <MetricTile label="Overlays" value={bundle.creative.overlays.join(" | ")} />
                </div>

                <div className="mt-4 space-y-4">
                  <MetricTile label="Image prompt" value={bundle.creative.imagePrompt} />
                  <MetricTile label="Negative prompt" value={bundle.creative.negativePrompt} />
                  <MetricTile label="Video prompt" value={bundle.creative.videoPrompt} />
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Checklist marque
                    </p>
                    <div className="mt-3">
                      <BadgeList values={bundle.creative.brandChecklist} />
                    </div>
                  </div>
                </div>
              </SectionCard>
            ) : null}

            {activeTab === "media" ? (
              <SectionCard eyebrow="AI Media Assets" title="Placeholders prets pour les futurs generateurs">
                {mediaAssets.length ? (
                  <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {mediaAssets.map((asset) => (
                      <MediaAssetPlaceholderCard
                        key={asset.id}
                        asset={asset}
                        fallbackLanguage={campaign?.language ?? submittedForm.language ?? "fr"}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm leading-6 text-slate-700">
                    Aucun media disponible dans le bundle pour le moment.
                  </div>
                )}
              </SectionCard>
            ) : null}

            {activeTab === "video" && bundle.video ? (
              <SectionCard eyebrow="Video" title="Plan video">
                <div className="grid gap-4 md:grid-cols-2">
                  <MetricTile label="Storyboard" value={bundle.video.storyboard} />
                  <MetricTile label="Script" value={bundle.video.script} />
                  <MetricTile label="Timeline" value={bundle.video.timeline} />
                  <MetricTile label="Voice" value={bundle.video.voice} />
                  <MetricTile label="Transitions" value={bundle.video.transitions.join(" | ")} />
                  <MetricTile label="Captions" value={bundle.video.captions} />
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Scenes
                  </p>
                  <div className="mt-3 space-y-3">
                    {bundle.video.scenes.map((scene) => (
                      <div key={`scene-${scene.scene}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-sm font-semibold text-slate-950">
                          Scene {scene.scene} · {scene.duration}
                        </p>
                        <p className="mt-2 text-sm text-slate-700">{scene.visual}</p>
                        <p className="mt-1 text-sm text-slate-600">{scene.onScreenText}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <MetricTile label="Video prompt" value={bundle.video.videoPrompt} />
                </div>
              </SectionCard>
            ) : null}

            {activeTab === "localization" && bundle.localization ? (
              <SectionCard eyebrow="Localization" title="11 langues preparees">
                <div className="mb-5">
                  <BadgeList values={localizationEntries.map(([language]) => language.toUpperCase())} />
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  {localizationEntries.map(([language, localization]) => (
                    <div key={`localization-${language}`} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-semibold uppercase text-slate-950">
                        {language}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-800">
                        {localization.adaptedTitle}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">
                        {localization.adaptedCaption}
                      </p>
                    </div>
                  ))}
                </div>
              </SectionCard>
            ) : null}

            {activeTab === "communities" && bundle.communityDiscovery ? (
              <SectionCard eyebrow="Community Discovery" title="Communautes suggerees">
                <div className="space-y-4">
                  {bundle.communityDiscovery.communities.map((community, index) => (
                    <div
                      key={`${community.id}-${community.platform}-${community.name}-${index}`}
                      className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                    >
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                        <MetricTile label="Communaute" value={community.name} />
                        <MetricTile label="Pays" value={community.country} />
                        <MetricTile label="Plateforme" value={community.platform} />
                        <MetricTile label="Audience" value={community.audience} />
                        <MetricTile label="Pertinence" value={community.relevance} />
                      </div>
                      <div className="mt-4">
                        <MetricTile label="Raison" value={community.recommendationReason} />
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            ) : null}

            {activeTab === "publisher" && publisher ? (
              <SectionCard eyebrow="Publisher" title="Brouillons a valider">
                <div className="grid gap-6 xl:grid-cols-3">
                  {publisherCards.map((publisherCard) => (
                    <PublisherDraftCard
                      key={publisherCard.key}
                      title={publisherCard.label}
                      channel={publisherCard.value}
                    />
                  ))}
                </div>
              </SectionCard>
            ) : null}

            {activeTab === "metaPreview" && metaPreview ? (
              <SectionCard eyebrow="Meta Preview" title="Previews Facebook / Instagram / LinkedIn">
                <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                  <MetricTile label="Mode" value={formatModeLabel(metaPreview.mode)} />
                  <MetricTile
                    label="Publication"
                    value={metaPreview.canPublish ? "activee" : "Publication desactivee"}
                    tone="amber"
                  />
                  <MetricTile
                    label="Validation"
                    value={metaPreview.requiresApproval ? "obligatoire" : "non"}
                    tone="emerald"
                  />
                  <MetricTile
                    label="Approval"
                    value={formatApprovalStatus(metaPreview.approvalStatus)}
                  />
                  <MetricTile label="Updated at" value={metaPreview.updatedAt} />
                </div>

                <div className="grid gap-6 xl:grid-cols-3">
                  {metaPreview.previews.map((preview) => (
                    <div
                      key={preview.platform}
                      className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-md"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-sky-600 text-sm font-semibold text-white">
                            N
                          </div>
                          <div>
                            <p className="text-lg font-semibold text-slate-950">
                              {formatPlatformLabel(preview.platform)}
                            </p>
                            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                              Norixo · Meta preview
                            </p>
                          </div>
                        </div>
                        <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase text-sky-700">
                          {formatModeLabel(metaPreview.mode)}
                        </span>
                      </div>

                      <div className="mt-5 grid gap-3">
                        <MetricTile label="Statut" value={formatPreviewStatus(preview.status)} />
                        <MetricTile
                          label="Publication"
                          value="Publication desactivee"
                          tone="amber"
                        />
                        <MetricTile label="Action" value={formatPublishAction(preview.publishAction)} />
                        <MetricTile label="Asset" value={formatAssetKind(preview.asset.kind)} />
                      </div>

                      <div className="mt-5 space-y-4">
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-sky-50 p-5">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-950">Asset preview</p>
                              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                                {formatAssetKind(preview.asset.kind)}
                              </p>
                            </div>
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase text-slate-600">
                              no publish
                            </span>
                          </div>
                          <p className="mt-4 text-sm leading-6 text-slate-700">
                            {preview.asset.prompt ?? "Prompt image / video a venir"}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Title
                          </p>
                          <p className="mt-2 text-sm font-semibold text-slate-900">
                            {preview.title}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Caption
                          </p>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                            {preview.caption}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            CTA
                          </p>
                          <p className="mt-2 text-sm text-slate-700">{preview.cta}</p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Hashtags
                          </p>
                          <div className="mt-3">
                            <BadgeList values={preview.hashtags.map((tag) => tag.trim())} />
                          </div>
                        </div>

                        {preview.asset.prompt ? (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                              Asset prompt
                            </p>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                              {preview.asset.prompt}
                            </p>
                          </div>
                        ) : null}

                        {preview.platformNotes.length ? (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                              Platform notes
                            </p>
                            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">
                              {preview.platformNotes.map((note) => (
                                <li key={`${preview.platform}-note-${note}`}>{note}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        {preview.manualPublishChecklist.length ? (
                          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                              Checklist manuelle
                            </p>
                            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-emerald-800">
                              {preview.manualPublishChecklist.map((item) => (
                                <li key={`${preview.platform}-check-${item}`}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        {preview.warnings.length ? (
                          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                              Warnings
                            </p>
                            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-amber-800">
                              {preview.warnings.map((warning) => (
                                <li key={`${preview.platform}-warning-${warning}`}>
                                  {warning}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            ) : null}

            {activeTab === "json" ? (
              <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-md">
                <details open={false}>
                  <summary className="cursor-pointer text-lg font-semibold text-slate-950">
                    Details techniques du bundle
                  </summary>
                  <pre className="mt-4 overflow-x-auto rounded-2xl border border-sky-100 bg-sky-50 p-4 text-xs leading-6 text-slate-700">
                    {JSON.stringify(bundle, null, 2)}
                  </pre>
                </details>
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
    </DashboardShell>
  );
}
