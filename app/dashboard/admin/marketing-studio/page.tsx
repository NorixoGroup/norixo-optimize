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
  "Calendrier éditorial",
  "Facebook",
  "Instagram",
  "LinkedIn",
  "Prompts image",
  "Prompts video",
  "11 langues",
  "Validation humaine",
];
const TIMELINE_STEPS = [
  { key: "campaign", label: "Campagne" },
  { key: "memory", label: "Memoire" },
  { key: "planner", label: "Planning" },
  { key: "social", label: "Social" },
  { key: "creative", label: "Creative" },
  { key: "video", label: "Video" },
  { key: "localization", label: "Localisation" },
  { key: "community", label: "Communautés" },
  { key: "review", label: "Revue" },
  { key: "approval", label: "Validation" },
  { key: "publisher", label: "Publication" },
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
// Client-side fallback until a dedicated read-only API exposes the real server media configuration.
const MEDIA_CONFIGURATION_FALLBACK = {
  imageProvider: "fake",
  videoProvider: "fake",
  storageProvider: "none",
  uploadEnabled: false,
  pollingEnabled: false,
} as const;

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
        helperText: "Meta connecté en lecture seule. Aucune publication possible.",
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
        alert: "La lecture des Pages Facebook a échoué. Vérifiez vos permissions Meta.",
      };
    case "instagram_error":
      return {
        statusLabel: "erreur instagram",
        statusTone: "amber" as const,
        oauthLabel: "connecte en lecture seule",
        facebookValue: "Pages Facebook detectees",
        instagramValue: "Lecture Instagram indisponible",
        helperText: "Les Pages ont ete detectees, mais pas le compte Instagram Business.",
        alert:
          "La détection Instagram Business a échoué. Les Pages Facebook restent en lecture seule.",
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
    return "Aperçu uniquement";
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
    return "Pret pour validation";
  }

  if (value === "missing_asset") {
    return "Media manquant";
  }

  if (value === "blocked") {
    return "Bloque";
  }

  if (value === "approved") {
    return "Valide";
  }

  return value;
}

function formatApprovalStatus(value: string | null | undefined) {
  if (value === "pending_review") {
    return "En attente de validation";
  }

  if (value === "approved") {
    return "Valide";
  }

  if (value === "rejected") {
    return "Refuse";
  }

  return value ?? "-";
}

function formatAssetKind(value: string) {
  if (value === "cover") {
    return "Couverture";
  }

  if (value === "thumbnail") {
    return "Miniature";
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
    return "En attente de génération";
  }

  if (value === "queued") {
    return "En file d'attente";
  }

  if (value === "generating") {
    return "Génération en cours";
  }

  if (value === "generated") {
    return "Genere";
  }

  if (value === "approved") {
    return "Valide";
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
    return "Image hero";
  }

  if (asset.platform === "instagram" && asset.kind === "reel") {
    return "Reel Instagram";
  }

  if (asset.platform === "facebook" && asset.kind === "image") {
    return "Image Facebook";
  }

  if (asset.platform === "linkedin" && asset.kind === "cover") {
    return "Couverture LinkedIn";
  }

  if (asset.kind === "thumbnail") {
    return "Miniature video";
  }

  return asset.title ?? `${formatPlatformLabel(asset.platform)} ${formatAssetKind(asset.kind)}`;
}

function formatMediaAssetPlatform(value: string) {
  if (value === "generic") {
    return "Generique";
  }

  return formatPlatformLabel(value);
}

function getChannelMonogram(title: string) {
  if (title.toLowerCase().includes("facebook")) {
    return "F";
  }

  if (title.toLowerCase().includes("instagram")) {
    return "I";
  }

  if (title.toLowerCase().includes("linkedin")) {
    return "L";
  }

  if (title.toLowerCase().includes("twitter")) {
    return "X";
  }

  if (title.toLowerCase().includes("tiktok")) {
    return "T";
  }

  if (title.toLowerCase().includes("pinterest")) {
    return "P";
  }

  return title.slice(0, 1).toUpperCase();
}

async function copyTextToClipboard(value: string) {
  if (!value.trim()) {
    return false;
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return true;
  }

  if (typeof document === "undefined") {
    return false;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();

  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  return copied;
}

function pickWorkspaceMediaAsset(
  assets: BundleMediaAsset[],
  platform: ActiveChannel,
  preferredKinds: string[],
) {
  return (
    assets.find(
      (asset) =>
        asset.platform === platform && preferredKinds.includes(asset.kind),
    ) ??
    assets.find(
      (asset) =>
        asset.platform === "generic" && preferredKinds.includes(asset.kind),
    ) ??
    null
  );
}

function resolveMediaPreviewLabel(asset: BundleMediaAsset) {
  if (asset.kind === "video" || asset.kind === "reel") {
    return "Aperçu vidéo";
  }

  return "Aperçu image";
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
    <section
      className={`rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] p-4 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.35)] backdrop-blur-sm lg:p-5 ${className}`.trim()}
    >
      {eyebrow ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-700">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-1 text-[1.45rem] font-semibold tracking-tight text-slate-950">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
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
      ? "border-emerald-200/90 bg-[linear-gradient(180deg,rgba(236,253,245,1),rgba(220,252,231,0.86))]"
      : tone === "amber"
      ? "border-amber-200/90 bg-[linear-gradient(180deg,rgba(255,251,235,1),rgba(254,243,199,0.78))]"
      : "border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(248,250,252,0.95))]";

  return (
    <div
      className={`rounded-[22px] border p-3.5 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.35)] ${toneClass}`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700">
        {label}
      </p>
      <p className="mt-1.5 whitespace-pre-wrap text-sm font-semibold text-slate-950">
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
      ? "border-sky-200/90 bg-[linear-gradient(180deg,rgba(240,249,255,1),rgba(224,242,254,0.82))]"
      : tone === "emerald"
        ? "border-emerald-200/90 bg-[linear-gradient(180deg,rgba(236,253,245,1),rgba(220,252,231,0.82))]"
        : tone === "amber"
          ? "border-amber-200/90 bg-[linear-gradient(180deg,rgba(255,251,235,1),rgba(254,243,199,0.78))]"
          : "border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))]";

  return (
    <div
      className={`min-w-[146px] rounded-[20px] border px-3.5 py-2.5 shadow-[0_12px_24px_-22px_rgba(15,23,42,0.3)] ${toneClass}`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700">
        {label}
      </p>
      <p className="mt-1.5 text-sm font-semibold text-slate-950">{value}</p>
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
      className={`group relative w-full overflow-hidden rounded-[28px] border p-4 text-left transition-all duration-200 ${
        disabled
          ? "cursor-not-allowed border-dashed border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(241,245,249,0.96))] text-slate-500 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.25)]"
          : active
          ? "border-sky-200 bg-[linear-gradient(180deg,rgba(248,252,255,0.98),rgba(239,246,255,0.96))] text-slate-900 shadow-[0_24px_44px_-30px_rgba(14,165,233,0.45)] ring-1 ring-sky-100"
          : "border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] text-slate-900 shadow-[0_18px_34px_-28px_rgba(15,23,42,0.35)] hover:border-slate-300 hover:shadow-[0_22px_38px_-28px_rgba(15,23,42,0.35)]"
      }`}
    >
      {!disabled ? (
        <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-r from-sky-100/60 via-white/10 to-cyan-100/30" />
      ) : null}

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border text-sm font-semibold uppercase tracking-[0.16em] ${
              disabled
                ? "border-slate-300 bg-white/80 text-slate-500"
                : active
                  ? "border-sky-200 bg-white text-sky-700 shadow-sm"
                  : "border-slate-200 bg-slate-50 text-slate-700"
            }`}
          >
            {getChannelMonogram(title)}
          </div>
          <div>
            <p className="text-[1.05rem] font-semibold">{title}</p>
            <p className="mt-1 text-xs text-slate-500">
              {disabled ? "Canal en preparation" : "Canal actif pour les brouillons du studio"}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <p
            className={`text-[11px] uppercase tracking-[0.18em] ${
              disabled ? "text-slate-500" : active ? "text-sky-700" : "text-slate-500"
            }`}
          >
            {disabled ? "bientot" : active ? "active" : "desactive"}
          </p>
          <span
            className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase ${
              disabled
                ? "border border-slate-200 bg-white text-slate-500"
                : active
                  ? "bg-sky-600 text-white shadow-sm"
                  : "border border-slate-200 bg-slate-50 text-slate-600"
            }`}
          >
            brouillon uniquement
          </span>
        </div>
      </div>

      <div className="relative mt-3 rounded-2xl border border-slate-200/80 bg-white/70 p-3.5">
        <div className="space-y-1.5 text-sm leading-6">
        {lines.map((line) => (
            <p key={`${title}-${line}`}>{line}</p>
        ))}
        </div>
      </div>

      {disabled ? (
        <div className="relative mt-3 rounded-2xl border border-slate-200 bg-white/75 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
            Disponible prochainement
          </p>
          <p className="mt-1.5 text-sm leading-6 text-slate-600">
            Ce canal restera en brouillon tant que l&apos;activation n&apos;est pas ouverte.
          </p>
        </div>
      ) : null}

      <div className="relative mt-3 flex flex-wrap gap-2">
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
    status === "done" ? "pret" : status === "running" ? "en cours" : "en attente";

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

function CopyActionButton({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        void copyTextToClipboard(value)
          .then((success) => {
            if (!success) {
              return;
            }

            setCopied(true);
            window.setTimeout(() => setCopied(false), 1400);
          })
          .catch(() => undefined);
      }}
      className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
    >
      {copied ? "Copié" : label}
    </button>
  );
}

function WorkspaceMediaSlot({
  label,
  asset,
  fallbackPrompt,
}: {
  label: string;
  asset: BundleMediaAsset | null;
  fallbackPrompt?: string | null;
}) {
  const displayPrompt = asset?.prompt ?? fallbackPrompt ?? null;
  const isPlaceholder = !asset || asset.status === "missing";

  return (
    <div className="rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.94))] p-3.5 shadow-sm shadow-slate-200/40">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-950">{label}</p>
        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase text-slate-600">
          {asset ? formatAssetKind(asset.kind) : "placeholder"}
        </span>
      </div>
      <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50/90 p-4 text-center">
        <p className="text-sm font-semibold text-slate-900">
          {isPlaceholder ? "En attente de génération" : formatMediaAssetStatus(asset.status)}
        </p>
        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
          {asset ? formatMediaAssetPlatform(asset.platform) : "Aucun média généré"}
        </p>
      </div>
      <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
        {displayPrompt ?? "Aucun prompt disponible pour ce slot."}
      </p>
    </div>
  );
}

function PlatformWorkspaceCard({
  platform,
  status,
  caption,
  cta,
  hashtags,
  title,
  heroImage,
  reel,
  story,
  carousel,
  imagePrompt,
  videoPrompt,
  previewPrompt,
  platformNotes,
  warnings,
  metadata,
}: {
  platform: ActiveChannel;
  status: string;
  caption: string;
  cta: string;
  hashtags: string[];
  title: string;
  heroImage: BundleMediaAsset | null;
  reel: BundleMediaAsset | null;
  story: BundleMediaAsset | null;
  carousel: BundleMediaAsset | null;
  imagePrompt?: string | null;
  videoPrompt?: string | null;
  previewPrompt?: string | null;
  platformNotes: string[];
  warnings: string[];
  metadata: Record<string, unknown>;
}) {
  return (
    <div className="rounded-[30px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] p-5 shadow-[0_24px_44px_-32px_rgba(15,23,42,0.35)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-200 bg-sky-50 text-sm font-semibold uppercase tracking-[0.16em] text-sky-700">
            {getChannelMonogram(platform)}
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-950">
              {formatPlatformLabel(platform)}
            </p>
            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
              Aperçu du contenu
            </p>
          </div>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase text-slate-700">
          {formatPreviewStatus(status)}
        </span>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white/80 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Titre
        </p>
        <p className="mt-2 text-sm font-semibold text-slate-950">{title}</p>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Texte
          </p>
          <CopyActionButton label="Copier le texte" value={caption} />
        </div>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
          {caption}
        </p>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            CTA
          </p>
          <CopyActionButton label="Copier le CTA" value={cta} />
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-800">{cta}</p>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Hashtags
          </p>
          <CopyActionButton label="Copier les hashtags" value={hashtags.join(" ")} />
        </div>
        <div className="mt-3">
          <BadgeList values={hashtags.map((tag) => tag.trim())} />
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-950">Medias</p>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase text-slate-600">
            placeholders ou assets
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <WorkspaceMediaSlot
            label="Image hero"
            asset={heroImage}
            fallbackPrompt={imagePrompt ?? previewPrompt}
          />
          <WorkspaceMediaSlot
            label="Reel"
            asset={reel}
            fallbackPrompt={videoPrompt ?? previewPrompt}
          />
          <WorkspaceMediaSlot
            label="Story"
            asset={story}
            fallbackPrompt={imagePrompt}
          />
          <WorkspaceMediaSlot
            label="Carousel"
            asset={carousel}
            fallbackPrompt={imagePrompt}
          />
        </div>
      </div>

      <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-950">
          Details IA
        </summary>
        <div className="mt-4 space-y-4">
          <MetricTile label="Prompt image" value={imagePrompt ?? "-"} />
          <MetricTile label="Prompt video" value={videoPrompt ?? "-"} />
          <MetricTile label="Prompt d’aperçu" value={previewPrompt ?? "-"} />
          <MetricTile
            label="Notes plateforme"
            value={platformNotes.length ? platformNotes.join("\n") : "Aucune note"}
          />
          <MetricTile
            label="Alertes"
            value={warnings.length ? warnings.join("\n") : "Aucune alerte"}
          />
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Métadonnées
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

function CompactMediaStatus({
  label,
  asset,
}: {
  label: string;
  asset: BundleMediaAsset | null;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-1.5 text-sm font-semibold text-slate-900">
        {asset ? formatMediaAssetStatus(asset.status) : "Placeholder pret"}
      </p>
    </div>
  );
}

function ApprovalWorkspaceCard({
  platform,
  caption,
  cta,
  hashtags,
  heroImage,
  reel,
  story,
  carousel,
}: {
  platform: ActiveChannel;
  caption: string;
  cta: string;
  hashtags: string[];
  heroImage: BundleMediaAsset | null;
  reel: BundleMediaAsset | null;
  story: BundleMediaAsset | null;
  carousel: BundleMediaAsset | null;
}) {
  const textReady = Boolean(caption.trim());
  const hashtagsReady = hashtags.length > 0;
  const ctaReady = Boolean(cta.trim());
  const mediaReady = Boolean(heroImage || reel || story || carousel || textReady);
  const readyCount = [textReady, hashtagsReady, ctaReady, mediaReady].filter(Boolean).length;
  const isReady = readyCount === 4;

  return (
    <div className="rounded-[30px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(248,250,252,0.96))] p-5 shadow-[0_24px_44px_-32px_rgba(15,23,42,0.35)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-200 bg-sky-50 text-sm font-semibold uppercase tracking-[0.16em] text-sky-700">
            {getChannelMonogram(platform)}
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-950">
              {formatPlatformLabel(platform)}
            </p>
            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
              Validation finale
            </p>
          </div>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase ${
            isReady
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border border-amber-200 bg-amber-50 text-amber-700"
          }`}
        >
          {isReady ? "Pret" : "A completer"}
        </span>
      </div>

      <div className="mt-4 grid gap-2.5">
        <div className="rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3 text-sm font-semibold text-slate-800">
          {textReady ? "✓" : "○"} Texte pret
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3 text-sm font-semibold text-slate-800">
          {hashtagsReady ? "✓" : "○"} Hashtags prets
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3 text-sm font-semibold text-slate-800">
          {ctaReady ? "✓" : "○"} CTA pret
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3 text-sm font-semibold text-slate-800">
          {mediaReady ? "✓" : "○"} Media disponible / Placeholder
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <CopyActionButton label="Copier le texte" value={caption} />
        <CopyActionButton label="Copier les hashtags" value={hashtags.join(" ")} />
        <CopyActionButton label="Copier le CTA" value={cta} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <CompactMediaStatus label="Image" asset={heroImage} />
        <CompactMediaStatus label="Reel" asset={reel} />
        <CompactMediaStatus label="Story" asset={story} />
        <CompactMediaStatus label="Carousel" asset={carousel} />
      </div>

      <button
        type="button"
        disabled
        className="mt-4 w-full cursor-not-allowed rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-400"
      >
        Marquer comme valide
      </button>
    </div>
  );
}

function PublisherDestinationCard({
  platform,
  mode,
}: {
  platform: ActiveChannel;
  mode: string;
}) {
  return (
    <div className="rounded-[26px] border border-slate-200 bg-white/85 p-4 shadow-sm shadow-slate-200/40">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-sm font-semibold uppercase tracking-[0.16em] text-slate-700">
          {getChannelMonogram(platform)}
        </div>
        <div>
          <p className="text-base font-semibold text-slate-950">
            {formatPlatformLabel(platform)}
          </p>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
            Destination
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
          Brouillon uniquement
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
          Publication désactivée
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
          OAuth requis
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
          Validation requise
        </div>
      </div>

      <p className="mt-3 text-xs uppercase tracking-[0.16em] text-slate-500">
        {formatModeLabel(mode)}
      </p>
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
  const isGenerated = asset.status === "generated";
  const isPending = asset.status === "queued" || asset.status === "generating";
  const hasPreview = Boolean(asset.previewUrl);
  const hasDownload = Boolean(asset.downloadUrl);
  const statusTone = isGenerated ? "emerald" : "amber";
  const statusBadgeClass = isGenerated
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-amber-200 bg-amber-50 text-amber-700";
  const previewLabel =
    asset.status === "missing"
      ? "Aucun média généré pour le moment"
      : isPending
        ? "En attente de génération"
        : resolveMediaPreviewLabel(asset);
  const previewHelperText =
    asset.status === "missing"
      ? "Le slot est pret pour accueillir un visuel, un reel ou une miniature."
      : isGenerated
        ? asset.previewUrl
          ? "Le rendu a ete genere. L'aperçu complet apparaitra ici lorsqu'il sera disponible."
          : "Aucun aperçu réel disponible pour le moment."
        : "Le rendu sera visible ici des qu'un asset sera disponible.";

  return (
    <div className="rounded-[30px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] p-5 shadow-[0_24px_44px_-32px_rgba(15,23,42,0.35)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-950 text-xs font-semibold uppercase tracking-[0.16em] text-white shadow-sm">
            {asset.kind === "video" || asset.kind === "reel" ? "VID" : "IMG"}
          </div>
        <div>
            <p className="text-lg font-semibold text-slate-950">
              {formatMediaAssetTitle(asset)}
            </p>
            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
              {formatAssetKind(asset.kind)} · {formatMediaAssetPlatform(asset.platform)}
            </p>
          </div>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase ${statusBadgeClass}`}
        >
          {formatMediaAssetStatus(asset.status)}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <MetricTile label="Type" value={formatAssetKind(asset.kind)} />
        <MetricTile label="Plateforme" value={formatMediaAssetPlatform(asset.platform)} />
        <MetricTile label="Ratio" value={asset.ratio} />
        <MetricTile label="Langue" value={asset.language ?? fallbackLanguage} />
        <MetricTile label="Statut" value={formatMediaAssetStatus(asset.status)} tone={statusTone} />
        <MetricTile label="Identifiant" value={asset.id} />
      </div>

      <div className="mt-4 rounded-[24px] border border-dashed border-slate-300 bg-gradient-to-br from-slate-50 via-white to-sky-50 p-5 text-center">
        {hasPreview ? (
          <div className="space-y-3">
            <img
              src={asset.previewUrl ?? ""}
              alt={formatMediaAssetTitle(asset)}
              className="h-[220px] w-full rounded-[20px] object-cover"
            />
            <p className="text-sm font-semibold text-slate-950">Média généré par le moteur média.</p>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Provider {asset.generationProvider ?? "fake"}
            </p>
          </div>
        ) : (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
              {asset.kind === "video" || asset.kind === "reel" ? "VID" : "IMG"}
            </div>
            <p className="mt-4 text-sm font-semibold text-slate-950">{previewLabel}</p>
            <p className="mt-2 text-sm text-slate-600">
              {isGenerated ? "Média généré par le moteur média." : previewHelperText}
            </p>
            {isGenerated ? (
              <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">
                {hasPreview
                  ? `Provider ${asset.generationProvider ?? "fake"}`
                  : "Aucun aperçu réel disponible pour le moment."}
              </p>
            ) : null}
          </>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {hasDownload ? (
          <a
            href={asset.downloadUrl ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700 shadow-[0_12px_22px_-20px_rgba(15,23,42,0.35)] transition hover:border-sky-200 hover:text-sky-700"
          >
            Telecharger
          </a>
        ) : (
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-400 opacity-80"
          >
            Telecharger
          </button>
        )}
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-400 opacity-80"
        >
          Regenerer
        </button>
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-400 opacity-80"
        >
          Nouvelle variante
        </button>
      </div>

      <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-950">
          Details IA
        </summary>
        <div className="mt-4 space-y-4">
          <MetricTile label="Prompt" value={asset.prompt ?? "-"} />
          <MetricTile label="Prompt négatif" value={asset.negativePrompt ?? "-"} />
          <MetricTile
            label="Alertes"
            value={warnings.length ? warnings.join("\n") : "Aucune alerte"}
          />
          <MetricTile
            label="Provider"
            value={asset.generationProvider ?? "Non généré"}
          />
          {typeof metadata.model === "string" && metadata.model.trim().length > 0 ? (
            <MetricTile label="Modele" value={metadata.model} />
          ) : null}
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
    ? "Génération en cours"
    : approval?.status === "approved"
      ? "Campagne approuvée"
      : bundle
        ? "Campagne prête à valider"
        : "Nouvelle campagne marketing";
  const controlCenterTitle = bundle
    ? campaign?.name ?? "Campagne prête à valider"
    : "Studio créatif IA personnel pour Norixo";
  const controlCenterDescription = bundle
    ? "Les contenus, médias et brouillons sont prêts pour une validation humaine avant publication."
    : "Configurez une campagne, générez les contenus, préparez les médias et validez avant publication.";
  const mediaConfiguration = MEDIA_CONFIGURATION_FALLBACK;
  const campaignProgressLabel =
    campaignProgress === 0
      ? "En attente"
      : campaignProgress === 100
      ? "Validation complète"
      : "Campagne prête";
  const campaignProgressItems = [
    { label: "Planner", done: Boolean(bundle?.planning) },
    { label: "Social", done: Boolean(bundle?.social) },
    { label: "Creative", done: Boolean(bundle?.creative) },
    { label: "Video", done: Boolean(bundle?.video) },
    { label: "Localisation", done: Boolean(bundle?.localization) },
    { label: "Publication", done: Boolean(bundle?.publisher) },
    { label: "Aperçu avant publication", done: Boolean(metaPreview?.previews.length) },
    { label: "Validation humaine", done: approval?.status === "approved" },
  ];

  const contentWorkspaceCards =
    publisher && metaPreview
      ? submittedChannels
          .filter(
            (channel): channel is ActiveChannel =>
              ACTIVE_CHANNELS.includes(channel as ActiveChannel),
          )
          .map((channel) => {
            const publisherChannel = publisher.channels[channel];
            const preview = metaPreview.previews.find(
              (item) => item.platform === channel,
            );
            const heroImage = pickWorkspaceMediaAsset(mediaAssets, channel, [
              "image",
              "cover",
            ]);
            const reel = pickWorkspaceMediaAsset(mediaAssets, channel, [
              "reel",
              "video",
            ]);
            const story = pickWorkspaceMediaAsset(mediaAssets, channel, ["story"]);
            const carousel = pickWorkspaceMediaAsset(mediaAssets, channel, [
              "carousel",
            ]);

            return {
              key: channel,
              platform: channel,
              status: publisherChannel.status,
              caption:
                preview?.caption ?? publisherChannel.publisherOutput?.finalCaption ?? publisherChannel.caption,
              cta: preview?.cta ?? publisherChannel.publisherOutput?.finalCta ?? publisherChannel.copy,
              hashtags:
                preview?.hashtags ??
                publisherChannel.publisherOutput?.finalHashtags ??
                publisherChannel.hashtags,
              title:
                preview?.title ??
                publisherChannel.publisherOutput?.finalTitle ??
                formatPlatformLabel(channel),
              heroImage,
              reel,
              story,
              carousel,
              imagePrompt: publisherChannel.assetPrompt,
              videoPrompt: publisherChannel.videoPrompt,
              previewPrompt: preview?.asset.prompt,
              platformNotes: preview?.platformNotes ?? [],
              warnings: [
                ...(preview?.warnings ?? []),
                ...(publisherChannel.publisherOutput?.warnings ?? []),
              ],
              metadata: {
                heroImage: heroImage?.metadata ?? null,
                reel: reel?.metadata ?? null,
                story: story?.metadata ?? null,
                carousel: carousel?.metadata ?? null,
              } satisfies Record<string, unknown>,
            };
          })
      : [];
  const technicalNotes = [
    ...(bundle?.review?.notes ?? []),
    ...(bundle?.approval?.notes ?? []),
  ];
  const approvalWorkspaceSummary = {
    platforms: contentWorkspaceCards.length,
    contents: contentWorkspaceCards.length * 5,
    media: expectedMediaCount,
    languages: localizationCount,
  };

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
      <div className="space-y-3">
        <section className="relative overflow-hidden rounded-[32px] border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,rgba(186,230,253,0.28),transparent_28%),radial-gradient(circle_at_top_right,rgba(125,211,252,0.2),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.97))] p-5 shadow-[0_28px_54px_-38px_rgba(15,23,42,0.42)] backdrop-blur-sm lg:p-6">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-200/80 to-transparent" />
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-4xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-slate-200 bg-white/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-700">
                  Marketing Studio
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
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

              <h1 className="mt-2.5 text-[2rem] font-semibold tracking-tight text-slate-950 lg:text-[2.25rem]">
                {controlCenterTitle}
              </h1>
              <p className="mt-2.5 max-w-3xl text-[15px] leading-6 text-slate-700">
                {controlCenterDescription}
              </p>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {bundle ? (
                  <BadgeList
                    values={[
                      `${platformCount} plateforme${platformCount > 1 ? "s" : ""}`,
                      `${localizationCount} langue${localizationCount > 1 ? "s" : ""}`,
                      `${expectedMediaCount} média${expectedMediaCount > 1 ? "s" : ""}`,
                      `${communityCount} communauté${communityCount > 1 ? "s" : ""}`,
                      "Validation humaine",
                      "Publication désactivée",
                    ]}
                  />
                ) : (
                  <BadgeList values={HERO_BADGES} />
                )}
              </div>
            </div>

            <div className="w-full max-w-sm rounded-[26px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(248,250,252,0.97))] p-3.5 shadow-[0_22px_42px_-34px_rgba(15,23,42,0.38)] backdrop-blur-sm">
              <div className="grid gap-2.5 sm:grid-cols-2">
                <MetricTile
                  label="Statut"
                  value={controlCenterStatus}
                  tone={bundle ? "emerald" : "slate"}
                />
                <MetricTile
                  label="Validation"
                  value={bundle ? "Mohamed requis" : "A préparer"}
                  tone="amber"
                />
              </div>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading}
                className="mt-3.5 w-full rounded-2xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-sky-700 disabled:opacity-60"
              >
                {loading ? "Génération en cours..." : "Générer ma campagne IA"}
              </button>
              <p className="mt-2.5 text-sm leading-6 text-slate-700">
                {bundle
                  ? "Le studio reste en brouillon jusqu'à validation humaine."
                  : "Configurez votre campagne puis lancez la génération quand vous êtes prêt."}
              </p>

              {error ? (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="overflow-x-auto rounded-[26px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] p-3 shadow-[0_18px_34px_-30px_rgba(15,23,42,0.34)] backdrop-blur-sm">
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
                  label="Communautés"
                  value={`${communityCount}`}
                />
                <KpiStripItem
                  label="Publication"
                  value="Désactivée"
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
        <section className="space-y-2.5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-700">
              Configuration
            </p>
            <h2 className="mt-1 text-[1.95rem] font-semibold tracking-tight text-slate-950">
              Configuration de la campagne
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-700">
              Définissez les paramètres avant la génération.
            </p>
          </div>

          <SectionCard eyebrow="Configuration" title="Campagne">
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Nom de la campagne</span>
                <input
                  value={form.name ?? ""}
                  onChange={(event) => updateField("name", event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300/90 bg-white/95 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm shadow-slate-200/30"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Audience</span>
                <input
                  value={form.audience ?? ""}
                  onChange={(event) => updateField("audience", event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300/90 bg-white/95 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm shadow-slate-200/30"
                />
              </label>

              <label className="block lg:col-span-2">
                <span className="text-sm font-semibold text-slate-700">Objectif</span>
                <textarea
                  rows={4}
                  value={form.objective}
                  onChange={(event) => updateField("objective", event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300/90 bg-white/95 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm shadow-slate-200/30"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Marche</span>
                <input
                  value={form.targetMarket}
                  onChange={(event) => updateField("targetMarket", event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300/90 bg-white/95 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm shadow-slate-200/30"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Langue principale</span>
                <select
                  value={form.language ?? "fr"}
                  onChange={(event) => updateField("language", event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300/90 bg-white/95 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm shadow-slate-200/30"
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
                  className="mt-1.5 w-full rounded-xl border border-slate-300/90 bg-white/95 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm shadow-slate-200/30"
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
                  className="mt-1.5 w-full rounded-xl border border-slate-300/90 bg-white/95 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm shadow-slate-200/30"
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
                  className="mt-1.5 w-full rounded-xl border border-slate-300/90 bg-white/95 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm shadow-slate-200/30"
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
        </section>

        {bundle && submittedForm ? (
          <div className="space-y-4">
            <SectionCard eyebrow="Résumé" title="Résumé de la campagne">
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
                <MetricTile label="Synthèse review" value={bundle.review?.summary ?? "-"} />
                <MetricTile
                  label="Statut de validation"
                  value={formatApprovalStatus(approval?.status)}
                  tone="amber"
                />
                <MetricTile
                  label="Validation humaine"
                  value={approval?.requiresHumanValidation ? "Validation humaine requise" : "non"}
                  tone="emerald"
                />
              </div>

              <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-[28px] border border-slate-300/70 bg-gradient-to-br from-sky-50 via-white to-emerald-50 p-5 shadow-sm shadow-slate-200/45">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-5xl font-semibold text-slate-950">
                        {campaignProgress}%
                      </p>
                      <p className="mt-2 text-sm text-slate-600">
                        Le bundle est pret pour une validation humaine avant toute publication.
                      </p>
                    </div>
                    <div className="rounded-full border border-slate-300/70 bg-white/95 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600 shadow-sm">
                      bundle actif
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

                <div className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-emerald-50 to-slate-50 p-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Score de campagne
                  </p>
                  <p className="mt-3 text-5xl font-semibold text-slate-950">
                    {resolvedScore}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    Score visuel non bloquant après génération.
                  </p>
                </div>
              </div>

              <div className="mt-6 overflow-x-auto">
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

            <SectionCard eyebrow="Studio média" title="Studio Média">
              <p className="mb-5 text-sm leading-6 text-slate-700">
                Préparez les visuels, reels et miniatures de la campagne.
              </p>
              <div className="mb-5 rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.08),_transparent_45%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] p-5 shadow-[0_18px_50px_-28px_rgba(15,23,42,0.28)]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-2xl">
                    <h3 className="text-sm font-semibold text-slate-950">Configuration média</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Cette configuration est pilotée par les variables serveur. Les
                      réglages modifiables arriveront plus tard.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-700">
                        Lecture seule
                      </span>
                      <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-700">
                        Configuration locale de prévisualisation
                      </span>
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700">
                        Non connecté au backend
                      </span>
                    </div>
                  </div>
                  <BadgeList
                    values={[
                      mediaConfiguration.uploadEnabled
                        ? "Upload automatique activé"
                        : "Upload automatique désactivé",
                      mediaConfiguration.pollingEnabled
                        ? "Polling activé"
                        : "Polling désactivé",
                    ]}
                  />
                </div>
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/90 px-4 py-3 text-sm text-slate-700">
                  <span className="font-semibold text-slate-900">Préparation UI — non actif</span>
                  <span className="ml-2">
                    Cette zone prépare les futurs réglages admin sans activer de connexion,
                    de sauvegarde ou d’automatisation.
                  </span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <MetricTile
                    label="Provider image"
                    value={mediaConfiguration.imageProvider}
                    tone="slate"
                  />
                  <MetricTile
                    label="Provider vidéo"
                    value={mediaConfiguration.videoProvider}
                    tone="slate"
                  />
                  <MetricTile
                    label="Stockage"
                    value={mediaConfiguration.storageProvider}
                    tone="slate"
                  />
                  <MetricTile
                    label="Upload automatique"
                    value={mediaConfiguration.uploadEnabled ? "Activé" : "Désactivé"}
                    tone={mediaConfiguration.uploadEnabled ? "emerald" : "amber"}
                  />
                  <MetricTile
                    label="Polling"
                    value={mediaConfiguration.pollingEnabled ? "Activé" : "Désactivé"}
                    tone={mediaConfiguration.pollingEnabled ? "emerald" : "amber"}
                  />
                </div>
                <div className="mt-5 rounded-[24px] border border-slate-200/90 bg-white/90 p-4">
                  <div className="mb-4 flex flex-col gap-1">
                    <h4 className="text-sm font-semibold text-slate-950">
                      Configuration future
                    </h4>
                    <p className="text-sm leading-6 text-slate-600">
                      Ces paramètres seront configurables dans une prochaine étape. Pour
                      l’instant, la configuration média reste en lecture seule.
                    </p>
                  </div>
                  <div className="grid gap-4 xl:grid-cols-3">
                    <div className="rounded-[20px] border border-slate-200 bg-slate-50/80 p-4">
                      <div className="mb-4">
                        <h5 className="text-sm font-semibold text-slate-950">Providers</h5>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          Sélection future des moteurs image et vidéo.
                        </p>
                      </div>
                      <div className="grid gap-4">
                        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                          Provider image
                          <select
                            disabled
                            value={mediaConfiguration.imageProvider}
                            aria-label="Provider image"
                            className="h-11 rounded-2xl border border-slate-200 bg-slate-100 px-3 text-sm font-medium normal-case tracking-normal text-slate-700 opacity-100 disabled:cursor-not-allowed"
                          >
                            <option value="fake">fake</option>
                            <option value="openai">openai</option>
                            <option value="fal">fal</option>
                            <option value="replicate">replicate</option>
                          </select>
                        </label>
                        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                          Provider vidéo
                          <select
                            disabled
                            value={mediaConfiguration.videoProvider}
                            aria-label="Provider vidéo"
                            className="h-11 rounded-2xl border border-slate-200 bg-slate-100 px-3 text-sm font-medium normal-case tracking-normal text-slate-700 opacity-100 disabled:cursor-not-allowed"
                          >
                            <option value="fake">fake</option>
                            <option value="runway">runway</option>
                            <option value="replicate">replicate</option>
                          </select>
                        </label>
                      </div>
                    </div>
                    <div className="rounded-[20px] border border-slate-200 bg-slate-50/80 p-4">
                      <div className="mb-4">
                        <h5 className="text-sm font-semibold text-slate-950">Stockage</h5>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          Prépare le futur raccordement au provider de stockage.
                        </p>
                      </div>
                      <div className="grid gap-4">
                        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                          Provider stockage
                          <select
                            disabled
                            value={mediaConfiguration.storageProvider}
                            aria-label="Stockage média"
                            className="h-11 rounded-2xl border border-slate-200 bg-slate-100 px-3 text-sm font-medium normal-case tracking-normal text-slate-700 opacity-100 disabled:cursor-not-allowed"
                          >
                            <option value="none">none</option>
                            <option value="supabase">supabase</option>
                          </select>
                        </label>
                        <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-700">
                          <span className="font-medium">Upload automatique</span>
                          <input
                            type="checkbox"
                            disabled
                            checked={mediaConfiguration.uploadEnabled}
                            aria-label="Upload automatique"
                            className="h-4 w-4 cursor-not-allowed rounded border-slate-300 text-sky-600"
                            readOnly
                          />
                        </label>
                      </div>
                    </div>
                    <div className="rounded-[20px] border border-slate-200 bg-slate-50/80 p-4">
                      <div className="mb-4">
                        <h5 className="text-sm font-semibold text-slate-950">Exécution</h5>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          Contrôle futur du polling et des modes d’exécution.
                        </p>
                      </div>
                      <div className="grid gap-4">
                        <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-700">
                          <span className="font-medium">Polling</span>
                          <input
                            type="checkbox"
                            disabled
                            checked={mediaConfiguration.pollingEnabled}
                            aria-label="Polling"
                            className="h-4 w-4 cursor-not-allowed rounded border-slate-300 text-sky-600"
                            readOnly
                          />
                        </label>
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-700">
                          <span className="font-medium text-slate-900">
                            Statut lecture seule / non actif
                          </span>
                          <p className="mt-1 leading-6 text-slate-600">
                            Aucun réglage n’est connecté au backend pour le moment.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {mediaAssets.length ? (
                <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
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
                  Aucun média disponible dans le bundle pour le moment.
                </div>
              )}
            </SectionCard>

            {contentWorkspaceCards.length ? (
              <SectionCard eyebrow="Contenus" title="Contenus">
                <p className="mb-5 text-sm leading-6 text-slate-700">
                  Préparez vos publications avant validation.
                </p>
                <div className="grid gap-6 xl:grid-cols-3">
                  {contentWorkspaceCards.map((card) => (
                    <PlatformWorkspaceCard
                      key={card.key}
                      platform={card.platform}
                      status={card.status}
                      caption={card.caption}
                      cta={card.cta}
                      hashtags={card.hashtags}
                      title={card.title}
                      heroImage={card.heroImage}
                      reel={card.reel}
                      story={card.story}
                      carousel={card.carousel}
                      imagePrompt={card.imagePrompt}
                      videoPrompt={card.videoPrompt}
                      previewPrompt={card.previewPrompt}
                      platformNotes={card.platformNotes}
                      warnings={card.warnings}
                      metadata={card.metadata}
                    />
                  ))}
                </div>
              </SectionCard>
            ) : null}

            <SectionCard eyebrow="Planning" title="Calendrier éditorial">
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

            {bundle.communityDiscovery ? (
              <SectionCard eyebrow="Communautés" title="Communautés">
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

            {bundle.localization ? (
              <SectionCard eyebrow="Localisation" title="Localisation">
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

            <SectionCard eyebrow="Validation" title="Validation finale">
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                  <MetricTile
                    label="Plateformes"
                    value={`${approvalWorkspaceSummary.platforms}`}
                    tone="slate"
                  />
                  <MetricTile
                    label="Contenus"
                    value={`${approvalWorkspaceSummary.contents}`}
                    tone="slate"
                  />
                  <MetricTile
                    label="Medias"
                    value={`${approvalWorkspaceSummary.media}`}
                  />
                  <MetricTile
                    label="Langues"
                    value={`${approvalWorkspaceSummary.languages}`}
                  />
                  <MetricTile
                    label="Validation"
                    value="Pret pour validation humaine"
                    tone="emerald"
                  />
                </div>

                {contentWorkspaceCards.length ? (
                  <div className="grid gap-6 xl:grid-cols-3">
                    {contentWorkspaceCards.map((card) => (
                      <ApprovalWorkspaceCard
                        key={`approval-${card.key}`}
                        platform={card.platform}
                        caption={card.caption}
                        cta={card.cta}
                        hashtags={card.hashtags}
                        heroImage={card.heroImage}
                        reel={card.reel}
                        story={card.story}
                        carousel={card.carousel}
                      />
                    ))}
                  </div>
                ) : null}

                <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                  <div className="rounded-[26px] border border-slate-200 bg-white/85 p-4 shadow-sm shadow-slate-200/40">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                      Validation humaine
                    </p>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <MetricTile
                        label="Approbateur"
                        value={bundle.approval?.requiredApprover ?? "Mohamed"}
                      />
                      <MetricTile
                        label="Etat"
                        value={formatApprovalStatus(bundle.approval?.status)}
                        tone="amber"
                      />
                      <MetricTile
                        label="Date"
                        value={bundle.approval?.approvedAt ?? "-"}
                      />
                      <MetricTile label="Mode" value="Validation manuelle" tone="emerald" />
                    </div>
                  </div>

                  <div className="rounded-[26px] border border-slate-200 bg-white/85 p-4 shadow-sm shadow-slate-200/40">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                      Statut global
                    </p>
                    <div className="mt-4 space-y-3">
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                        Génération terminée
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                        Publication manuelle uniquement
                      </div>
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                        Validation finale requise avant publication
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard eyebrow="Publication" title="Publication">
              <div className="space-y-6">
                {publisher ? (
                  <div className="rounded-[28px] border border-slate-300/80 bg-white/95 p-5 shadow-lg shadow-slate-200/55 backdrop-blur-sm">
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                          Publication
                        </p>
                        <h3 className="mt-1 text-xl font-semibold text-slate-950">
                          Destinations de publication
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-slate-700">
                          Brouillon uniquement, publication désactivée et validation requise sur chaque canal.
                        </p>
                      </div>
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase text-slate-600">
                        {formatModeLabel(publisher.mode)}
                      </span>
                    </div>

                    <div className="mt-5 grid gap-4 xl:grid-cols-3">
                      {submittedChannels
                        .filter(
                          (channel): channel is ActiveChannel =>
                            ACTIVE_CHANNELS.includes(channel as ActiveChannel),
                        )
                        .map((channel) => (
                          <PublisherDestinationCard
                            key={`publisher-destination-${channel}`}
                            platform={channel}
                            mode={publisher.mode}
                          />
                        ))}
                    </div>
                  </div>
                ) : null}

                <div className="rounded-[28px] border border-slate-300/80 bg-white/95 p-5 shadow-lg shadow-slate-200/55 backdrop-blur-sm">
                  <div className="mb-5">
                    <BadgeList values={["Lecture seule", "Publication désactivée", "Validation humaine requise"]} />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <MetricTile
                      label="Statut"
                      value={metaUi.statusLabel}
                      tone={metaUi.statusTone}
                    />
                    <MetricTile label="Mode" value="Lecture seule" />
                    <MetricTile
                      label="Publication automatique"
                      value="Publication désactivée"
                      tone="amber"
                    />
                    <MetricTile label="OAuth" value={metaUi.oauthLabel} />
                    <MetricTile
                      label="Validation humaine"
                      value="Validation humaine requise"
                      tone="emerald"
                    />
                    <MetricTile label="Tokens" value="Jamais affichés" />
                  </div>

                  <a
                    href="/api/admin/marketing-studio/meta/login"
                    className="mt-6 inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Connecter Meta
                  </a>

                  {metaUi.alert ? (
                    <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                      {metaUi.alert}
                    </div>
                  ) : null}

                  <p className="mt-4 text-sm leading-6 text-slate-600">{metaUi.helperText}</p>

                  <div className="mt-6 grid gap-4 lg:grid-cols-3">
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
                </div>

                {metaPreview ? (
                  <div className="rounded-[28px] border border-slate-300/80 bg-white/95 p-5 shadow-lg shadow-slate-200/55 backdrop-blur-sm">
                    <div className="mb-5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                        Aperçu avant publication
                      </p>
                      <h3 className="mt-1 text-xl font-semibold text-slate-950">
                        Aperçu avant publication
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-slate-700">
                        Vérifiez le rendu final par plateforme avant toute publication manuelle.
                      </p>
                    </div>

                    <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                      <MetricTile label="Mode" value={formatModeLabel(metaPreview.mode)} />
                      <MetricTile
                        label="Publication"
                        value={metaPreview.canPublish ? "Activée" : "Publication désactivée"}
                        tone="amber"
                      />
                      <MetricTile
                        label="Validation"
                        value={metaPreview.requiresApproval ? "Validation humaine requise" : "non"}
                        tone="emerald"
                      />
                      <MetricTile
                        label="Validation"
                        value={formatApprovalStatus(metaPreview.approvalStatus)}
                      />
                      <MetricTile label="Mis à jour" value={metaPreview.updatedAt} />
                    </div>

                    <div className="grid gap-6 xl:grid-cols-3">
                      {metaPreview.previews.map((preview) => (
                        <div
                          key={preview.platform}
                          className="rounded-[28px] border border-slate-300/80 bg-white/95 p-5 shadow-lg shadow-slate-200/60 backdrop-blur-sm"
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
                                  Norixo · Aperçu
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
                              value="Publication désactivée"
                              tone="amber"
                            />
                            <MetricTile label="Action" value={formatPublishAction(preview.publishAction)} />
                            <MetricTile label="Asset" value={formatAssetKind(preview.asset.kind)} />
                          </div>

                          <div className="mt-5 space-y-4">
                            <div className="rounded-2xl border border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-sky-50 p-5">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-slate-950">Aperçu média</p>
                                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                                    {formatAssetKind(preview.asset.kind)}
                                  </p>
                                </div>
                                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase text-slate-600">
                                  brouillon
                                </span>
                              </div>
                              <p className="mt-4 text-sm leading-6 text-slate-700">
                                {preview.asset.prompt ?? "Prompt image / video a venir"}
                              </p>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                Titre
                              </p>
                              <p className="mt-2 text-sm font-semibold text-slate-900">
                                {preview.title}
                              </p>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                Texte
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
                                  Prompt media
                                </p>
                                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                                  {preview.asset.prompt}
                                </p>
                              </div>
                            ) : null}

                            {preview.platformNotes.length ? (
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                  Notes plateforme
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
                                  Alertes
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
                  </div>
                ) : null}
              </div>
            </SectionCard>

            <section className="rounded-[28px] border border-slate-200/80 bg-white/95 p-5 shadow-lg shadow-slate-200/60 backdrop-blur-sm">
              <details>
                <summary className="cursor-pointer text-lg font-semibold text-slate-950">
                  Données techniques
                </summary>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  Informations avancées pour diagnostic et contrôle du bundle.
                </p>

                <div className="mt-5 space-y-6">
                  {technicalNotes.length ? (
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Notes système
                      </p>
                      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
                        {technicalNotes.map((note) => (
                          <li key={note}>{note}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {bundle.creative ? (
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Direction creative
                      </p>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <MetricTile label="Concept créatif" value={bundle.creative.creativeConcept} />
                        <MetricTile label="Style visuel" value={bundle.creative.visualStyle} />
                        <MetricTile label="Layout" value={bundle.creative.layout} />
                        <MetricTile label="Overlays" value={bundle.creative.overlays.join(" | ")} />
                        <MetricTile label="Image prompt" value={bundle.creative.imagePrompt} />
                        <MetricTile label="Prompt négatif" value={bundle.creative.negativePrompt} />
                        <MetricTile label="Prompt vidéo" value={bundle.creative.videoPrompt} />
                      </div>
                    </div>
                  ) : null}

                  {bundle.video ? (
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Plan vidéo
                      </p>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <MetricTile label="Storyboard" value={bundle.video.storyboard} />
                        <MetricTile label="Script" value={bundle.video.script} />
                        <MetricTile label="Timeline" value={bundle.video.timeline} />
                        <MetricTile label="Voix" value={bundle.video.voice} />
                        <MetricTile label="Transitions" value={bundle.video.transitions.join(" | ")} />
                        <MetricTile label="Sous-titres" value={bundle.video.captions} />
                        <MetricTile label="Prompt vidéo" value={bundle.video.videoPrompt} />
                      </div>
                    </div>
                  ) : null}

                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Bundle complet
                    </p>
                    <div className="mt-4 max-h-[520px] overflow-auto rounded-2xl border border-slate-200 bg-white p-4">
                      <pre className="font-mono text-xs leading-6 text-slate-700">
                        {JSON.stringify(bundle, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              </details>
            </section>
          </div>
        ) : null}
      </div>
    </DashboardShell>
  );
}
