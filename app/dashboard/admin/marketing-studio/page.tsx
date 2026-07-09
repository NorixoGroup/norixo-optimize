"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import type { MarketingCampaignBundle } from "@/lib/marketing-ai/bundle/marketingCampaignBundle";
import { buildMetaPreviewModel } from "@/lib/marketing-ai/meta/metaPreviewBuilder";
import type {
  MarketingStudioOrchestratorV2Input,
  MarketingStudioOrchestratorV2Result,
} from "@/lib/marketing-ai/orchestrator/marketingStudioOrchestratorV2";
import {
  buildMarketingStudioSubmissionFingerprint,
  clearMarketingStudioPendingSubmission,
  resolveMarketingStudioPendingSubmission,
} from "@/lib/marketing-ai/runs/marketingStudioPendingSubmission";
import { getSharedSession } from "@/lib/supabase/sharedAuth";

type ActiveChannel = "facebook" | "instagram" | "linkedin" | "tiktok";
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
type LinkedInUiStatus =
  | "not_connected"
  | "connected"
  | "organization_error"
  | "oauth_error";
type TikTokUiStatus =
  | "not_connected"
  | "connected"
  | "oauth_error";

type CampaignFormState = MarketingStudioOrchestratorV2Input & {
  targetMarket: string;
  durationLabel: string;
  budget: string;
  personas: string[];
  frequency: string[];
};

type RunResponse = {
  ok: boolean;
  requestId?: string;
  runId?: string;
  campaignId?: string;
  runStatus?: GenerationRunStatus;
  wasCreated?: boolean;
  error?: string;
};

type GenerationRunStatus = "queued" | "running" | "completed" | "failed";

type RunStatusResponse = {
  ok: boolean;
  run?: {
    id: string;
    campaignId: string;
    requestId: string;
    status: GenerationRunStatus;
    errorMessage: string | null;
    startedAt: string | null;
    completedAt: string | null;
    failedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  error?: string;
};

type MetaStatusResponse = {
  ok: boolean;
  connection?: {
    provider: "meta";
    connected: boolean;
    status: "not_connected" | "connected" | "no_pages" | "error";
    facebookPage: {
      id: string;
      name: string;
    } | null;
    instagramBusinessAccount: {
      id: string;
      username: string;
    } | null;
    grantedScopes: string[];
    updatedAt: string | null;
  };
  error?: string;
};

type MetaLoginResponse = {
  ok: boolean;
  url?: string;
  error?: string;
};

type LinkedInStatusResponse = {
  ok: boolean;
  connection?: {
    provider: "linkedin";
    connected: boolean;
    status: "not_connected" | "connected" | "error";
    organization: {
      urn: string;
      id: string | null;
    } | null;
    grantedScopes: string[];
    expiresAt: string | null;
    updatedAt: string | null;
  };
  error?: string;
};

type LinkedInLoginResponse = {
  ok: boolean;
  url?: string;
  error?: string;
};

type TikTokStatusResponse = {
  ok: boolean;
  connection?: {
    provider: "tiktok";
    connected: boolean;
    status: "not_connected" | "connected" | "error";
    openId: string | null;
    grantedScopes: string[];
    expiresAt: string | null;
    refreshExpiresAt: string | null;
    updatedAt: string | null;
  };
  error?: string;
};

type TikTokLoginResponse = {
  ok: boolean;
  url?: string;
  error?: string;
};

type SaveCampaignResponse = {
  ok: boolean;
  mode?: "created" | "updated";
  campaign?: {
    id: string;
    created_at: string;
    updated_at: string;
  };
  error?: string;
};

type LoadCampaignResponse = {
  ok: boolean;
  campaign?: {
    id: string;
    status: string;
    created_at: string;
    updated_at: string;
  };
  result?: MarketingStudioOrchestratorV2Result | null;
  error?: string;
};

type ApproveCampaignResponse = {
  ok: boolean;
  campaign?: {
    id: string;
    status: string;
  };
  result?: MarketingStudioOrchestratorV2Result;
  error?: string;
};

type PublishFacebookResponse = {
  ok: boolean;
  campaign?: {
    id: string;
    status: string;
  };
  facebook?: {
    postId: string;
  };
  result?: MarketingStudioOrchestratorV2Result;
  error?: string;
};

type PublishLinkedInResponse = {
  ok: boolean;
  campaign?: {
    id: string;
    status: string;
  };
  linkedin?: {
    postId: string;
  };
  result?: MarketingStudioOrchestratorV2Result;
  error?: string;
};

type UploadTikTokResponse = {
  ok: boolean;
  campaign?: {
    id: string;
    status: string;
  };
  tiktok?: {
    publishId: string;
    uploadStatus: string;
  };
  result?: MarketingStudioOrchestratorV2Result;
  error?: string;
};

const ACTIVE_CHANNELS: ActiveChannel[] = [
  "facebook",
  "instagram",
  "linkedin",
  "tiktok",
];
const HERO_BADGES = [
  "Calendrier éditorial",
  "Facebook",
  "Instagram",
  "LinkedIn",
  "TikTok",
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
  channels: ["facebook", "instagram", "linkedin", "tiktok"],
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

function buildRestoredCampaignForm(
  result: MarketingStudioOrchestratorV2Result,
): CampaignFormState {
  const campaign = result.bundle.campaign;
  const channels = campaign.platforms.filter((channel): channel is ActiveChannel =>
    ACTIVE_CHANNELS.includes(channel as ActiveChannel),
  );

  return {
    ...DEFAULT_FORM,
    name: campaign.name || DEFAULT_FORM.name,
    objective: campaign.objective || DEFAULT_FORM.objective,
    audience: campaign.audience || DEFAULT_FORM.audience,
    language: campaign.language || DEFAULT_FORM.language,
    channels: channels.length ? channels : DEFAULT_FORM.channels,
    tone: campaign.tone || DEFAULT_FORM.tone,
    cta: campaign.cta || DEFAULT_FORM.cta,
    durationDays:
      typeof campaign.durationDays === "number"
        ? campaign.durationDays
        : DEFAULT_FORM.durationDays,
    durationLabel:
      campaign.durationDays && campaign.durationDays >= 30 ? "1 mois" : "2 semaines",
  };
}

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

function resolveLinkedInUiStatus(value: string | null): LinkedInUiStatus {
  if (
    value === "connected" ||
    value === "organization_error" ||
    value === "oauth_error"
  ) {
    return value;
  }

  return "not_connected";
}

function buildLinkedInUiContent(status: LinkedInUiStatus) {
  switch (status) {
    case "connected":
      return {
        statusLabel: "connecte",
        statusTone: "emerald" as const,
        oauthLabel: "connecte et persiste",
        organizationValue: "Page entreprise Norixo detectee",
        helperText:
          "Connexion LinkedIn persistée côté serveur. Publication texte-only manuelle disponible après validation humaine.",
        alert: null,
      };
    case "organization_error":
      return {
        statusLabel: "organisation introuvable",
        statusTone: "amber" as const,
        oauthLabel: "connexion a verifier",
        organizationValue: "URN organisation indisponible",
        helperText:
          "LinkedIn a accepté l'OAuth mais l'organisation n'a pas pu être résolue. Vérifiez le rôle admin de la Page entreprise Norixo.",
        alert:
          "La Page entreprise LinkedIn n'a pas pu être résolue. Vérifiez le rôle admin et les permissions serveur sans partager de token.",
      };
    case "oauth_error":
      return {
        statusLabel: "erreur oauth",
        statusTone: "amber" as const,
        oauthLabel: "connexion a relancer",
        organizationValue: "Connexion LinkedIn indisponible",
        helperText:
          "Une erreur est survenue pendant la connexion LinkedIn.",
        alert:
          "Connexion LinkedIn indisponible pour le moment. Reessayez sans partager de token.",
      };
    case "not_connected":
    default:
      return {
        statusLabel: "non connecte",
        statusTone: "amber" as const,
        oauthLabel: "pret a connecter",
        organizationValue: "Aucune Page entreprise connectee",
        helperText:
          "OAuth LinkedIn prêt à connecter. Publication texte-only désactivée tant que la connexion n'est pas persistée.",
        alert: null,
      };
  }
}

function resolveTikTokUiStatus(value: string | null): TikTokUiStatus {
  if (value === "connected" || value === "oauth_error") {
    return value;
  }

  return "not_connected";
}

function buildTikTokUiContent(status: TikTokUiStatus) {
  switch (status) {
    case "connected":
      return {
        statusLabel: "connecte",
        statusTone: "emerald" as const,
        oauthLabel: "connecte et persiste",
        accountValue: "Compte TikTok connecte",
        helperText:
          "Connexion TikTok persistee cote serveur. Upload manuel FILE_UPLOAD disponible apres validation humaine. La publication finale doit etre terminee dans TikTok.",
        alert: null,
      };
    case "oauth_error":
      return {
        statusLabel: "erreur oauth",
        statusTone: "amber" as const,
        oauthLabel: "connexion a relancer",
        accountValue: "Connexion TikTok indisponible",
        helperText:
          "Une erreur est survenue pendant la connexion TikTok.",
        alert:
          "Connexion TikTok indisponible pour le moment. Reessayez sans partager de token.",
      };
    case "not_connected":
    default:
      return {
        statusLabel: "non connecte",
        statusTone: "amber" as const,
        oauthLabel: "pret a connecter",
        accountValue: "Aucun compte TikTok connecte",
        helperText:
          "OAuth TikTok pret a connecter. Upload video desactive tant que la connexion n'est pas persistée.",
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

  if (value === "tiktok") {
    return "TikTok";
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

function formatPublishedAt(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function formatPreviewStatus(value: string) {
  if (value === "draft") {
    return "Brouillon";
  }

  if (value === "ready_for_review") {
    return "Pret pour validation";
  }

  if (value === "publishing") {
    return "Publication en cours";
  }

  if (value === "awaiting_tiktok_completion") {
    return "A terminer dans TikTok";
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

  if (value === "published") {
    return "Publie";
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

function formatGenerationRunStatus(value: GenerationRunStatus | null) {
  if (value === "queued") {
    return "Génération en file d'attente";
  }

  if (value === "running") {
    return "Génération en cours";
  }

  if (value === "completed") {
    return "Génération terminée";
  }

  if (value === "failed") {
    return "Génération échouée";
  }

  return null;
}

type BundleMediaAsset = NonNullable<
  NonNullable<MarketingCampaignBundle["media"]>["assets"]
>[number];

function isVideoLikeAsset(asset: BundleMediaAsset) {
  return asset.kind === "video" || asset.kind === "reel";
}

function hasNarratedMuxedAsset(asset: BundleMediaAsset) {
  return isVideoLikeAsset(asset) && asset.metadata?.hasMuxedNarration === true;
}

function isNarrationFailedAsset(asset: BundleMediaAsset) {
  return (
    isVideoLikeAsset(asset) &&
    asset.metadata?.hasMuxedNarration !== true &&
    (asset.warnings ?? []).some((warning) => /narration|mux/i.test(warning))
  );
}

function formatMediaAssetDisplayStatus(asset: BundleMediaAsset) {
  if (isNarrationFailedAsset(asset)) {
    return "Narration échouée / vidéo non prête";
  }

  return formatMediaAssetStatus(asset.status);
}

function pickPreferredWorkspaceAsset(
  assets: BundleMediaAsset[],
  preferredKinds: string[],
) {
  const matchingAssets = assets.filter((asset) => preferredKinds.includes(asset.kind));

  if (preferredKinds.includes("reel") || preferredKinds.includes("video")) {
    return (
      matchingAssets.find(hasNarratedMuxedAsset) ??
      matchingAssets.find(isNarrationFailedAsset) ??
      matchingAssets[0] ??
      null
    );
  }

  return matchingAssets[0] ?? null;
}

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

  if (asset.platform === "tiktok" && asset.kind === "reel") {
    return "Reel TikTok";
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
  if (platform === "tiktok") {
    return (
      pickPreferredWorkspaceAsset(
        assets.filter((asset) => asset.platform === "tiktok"),
        preferredKinds,
      ) ??
      pickPreferredWorkspaceAsset(
        assets.filter((asset) => asset.platform === "instagram"),
        preferredKinds,
      ) ??
      pickPreferredWorkspaceAsset(
        assets.filter((asset) => asset.platform === "generic"),
        preferredKinds,
      ) ??
      null
    );
  }

  return (
    pickPreferredWorkspaceAsset(
      assets.filter((asset) => asset.platform === platform),
      preferredKinds,
    ) ??
    pickPreferredWorkspaceAsset(
      assets.filter((asset) => asset.platform === "generic"),
      preferredKinds,
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
          {isPlaceholder ? "En attente de génération" : formatMediaAssetDisplayStatus(asset)}
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
        {asset ? formatMediaAssetDisplayStatus(asset) : "Placeholder pret"}
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
  status,
  publishedAt,
}: {
  platform: ActiveChannel;
  mode: string;
  status?: string | null;
  publishedAt?: string | null;
}) {
  const publishedAtLabel = formatPublishedAt(publishedAt);
  const isPublished = platform === "facebook" && status === "published";
  const isAwaitingTikTokCompletion =
    platform === "tiktok" && status === "awaiting_tiktok_completion";

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
        {isPublished ? (
          <>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
              Publié
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
              Publication effectuée
            </div>
            <div className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-800">
              Connecté à Meta
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
              Validé
            </div>
          </>
        ) : isAwaitingTikTokCompletion ? (
          <>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
              Upload envoye
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
              Terminer dans TikTok
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
              FILE_UPLOAD
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
              Validation Norixo conservee
            </div>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>

      <p className="mt-3 text-xs uppercase tracking-[0.16em] text-slate-500">
        {formatModeLabel(mode)}
      </p>
      {isPublished && publishedAtLabel ? (
        <p className="mt-2 text-xs text-slate-500">
          Publié le {publishedAtLabel}
        </p>
      ) : null}
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
  const storageMetadata = metadata as { storageProvider?: string };
  const warnings = asset.warnings ?? [];
  const isGenerated = asset.status === "generated";
  const isPending = asset.status === "queued" || asset.status === "generating";
  const isVideoAsset = isVideoLikeAsset(asset);
  const isNarrationFailedVideo = isNarrationFailedAsset(asset);
  const hasPreview = Boolean(asset.previewUrl);
  const hasDownload = Boolean(asset.downloadUrl);
  const storageProvider =
    typeof storageMetadata.storageProvider === "string" &&
    storageMetadata.storageProvider.trim().length > 0
      ? storageMetadata.storageProvider
      : "Non disponible";
  const statusTone = isGenerated && !isNarrationFailedVideo ? "emerald" : "amber";
  const statusBadgeClass = isNarrationFailedVideo
    ? "border-rose-200 bg-rose-50 text-rose-700"
    : isGenerated
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-amber-200 bg-amber-50 text-amber-700";
  const previewLabel =
    isNarrationFailedVideo
      ? "Narration échouée / vidéo non prête"
      : asset.status === "missing"
      ? "Aucun média généré pour le moment"
      : isPending
        ? "En attente de génération"
        : resolveMediaPreviewLabel(asset);
  const previewHelperText =
    isNarrationFailedVideo
      ? "Le rendu visuel existe, mais la narration ou le mux a échoué. Regénérez avant validation ou publication."
      : asset.status === "missing"
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
          {formatMediaAssetDisplayStatus(asset)}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <MetricTile label="Type" value={formatAssetKind(asset.kind)} />
        <MetricTile label="Plateforme" value={formatMediaAssetPlatform(asset.platform)} />
        <MetricTile label="Ratio" value={asset.ratio} />
        <MetricTile label="Langue" value={asset.language ?? fallbackLanguage} />
        <MetricTile label="Statut" value={formatMediaAssetDisplayStatus(asset)} tone={statusTone} />
        <MetricTile label="Identifiant" value={asset.id} />
        <MetricTile
          label="Provider génération"
          value={asset.generationProvider ?? "Non généré"}
          tone={asset.generationProvider === "openai" ? "emerald" : "slate"}
        />
        <MetricTile
          label="Aperçu"
          value={hasPreview ? "Présente" : "Absente"}
          tone={hasPreview ? "emerald" : "amber"}
        />
        <MetricTile
          label="Téléchargement"
          value={hasDownload ? "Présente" : "Absente"}
          tone={hasDownload ? "emerald" : "amber"}
        />
        <MetricTile label="Stockage" value={storageProvider} tone="slate" />
      </div>

      <div className="mt-4 rounded-[24px] border border-dashed border-slate-300 bg-gradient-to-br from-slate-50 via-white to-sky-50 p-5 text-center">
        {hasPreview && !isNarrationFailedVideo ? (
          <div className="space-y-3">
            {isVideoAsset ? (
              <video
                src={asset.previewUrl ?? ""}
                controls
                playsInline
                className="h-[220px] w-full rounded-[20px] object-cover"
              />
            ) : (
              <img
                src={asset.previewUrl ?? ""}
                alt={formatMediaAssetTitle(asset)}
                className="h-[220px] w-full rounded-[20px] object-cover"
              />
            )}
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

const IS_NON_PRODUCTION = process.env.NODE_ENV !== "production";
const RUN_STATUS_POLL_INTERVAL_MS = 2000;
const RUN_STATUS_POLL_ERROR_THRESHOLD = 3;
const RUN_STATUS_TEMPORARY_ERROR_MESSAGE =
  "Suivi de génération temporairement indisponible. Le suivi continue automatiquement.";

export default function MarketingStudioPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const skipCampaignRestoreRef = useRef(false);
  const [form, setForm] = useState<CampaignFormState>(DEFAULT_FORM);
  const [submittedForm, setSubmittedForm] = useState<CampaignFormState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MarketingStudioOrchestratorV2Result | null>(null);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [generationRunId, setGenerationRunId] = useState<string | null>(null);
  const [generationRunStatus, setGenerationRunStatus] =
    useState<GenerationRunStatus | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [approveLoading, setApproveLoading] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [publishLoading, setPublishLoading] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [linkedInPublishLoading, setLinkedInPublishLoading] = useState(false);
  const [linkedInPublishError, setLinkedInPublishError] = useState<string | null>(
    null,
  );
  const [metaConnection, setMetaConnection] =
    useState<MetaStatusResponse["connection"] | null>(null);
  const [metaConnectionLoading, setMetaConnectionLoading] = useState(true);
  const [metaLoginLoading, setMetaLoginLoading] = useState(false);
  const [metaLoginError, setMetaLoginError] = useState<string | null>(null);
  const [linkedInConnection, setLinkedInConnection] =
    useState<LinkedInStatusResponse["connection"] | null>(null);
  const [linkedInConnectionLoading, setLinkedInConnectionLoading] =
    useState(true);
  const [linkedInLoginLoading, setLinkedInLoginLoading] = useState(false);
  const [linkedInLoginError, setLinkedInLoginError] = useState<string | null>(null);
  const [tikTokConnection, setTikTokConnection] =
    useState<TikTokStatusResponse["connection"] | null>(null);
  const [tikTokConnectionLoading, setTikTokConnectionLoading] = useState(true);
  const [tikTokLoginLoading, setTikTokLoginLoading] = useState(false);
  const [tikTokLoginError, setTikTokLoginError] = useState<string | null>(null);
  const [tikTokUploadLoading, setTikTokUploadLoading] = useState(false);
  const [tikTokUploadError, setTikTokUploadError] = useState<string | null>(null);

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
  const facebookPublishStatus = publisher?.channels.facebook.status ?? null;
  const facebookPlatformPostId =
    publisher?.channels.facebook.platformPostId ?? null;
  const linkedInPublishStatus = publisher?.channels?.linkedin?.status ?? null;
  const linkedInPlatformPostId =
    publisher?.channels?.linkedin?.platformPostId ?? null;
  const tikTokUploadStatus = publisher?.channels?.tiktok?.status ?? null;
  const tikTokPublishId =
    publisher?.channels?.tiktok?.platformPublishId ?? null;
  const tikTokUploadPlatformStatus =
    publisher?.channels?.tiktok?.platformUploadStatus ?? null;
  const mediaAssets = bundle?.media?.assets ?? [];
  const tikTokFinalAsset = pickWorkspaceMediaAsset(mediaAssets, "tiktok", [
    "reel",
    "video",
  ]);
  const hasTikTokFinalMuxedAsset =
    tikTokFinalAsset?.metadata?.hasMuxedNarration === true;
  const localizationEntries = Object.entries(bundle?.localization ?? {});
  const monthlyPreview = buildMonthlyPreview(bundle?.planning);
  const estimatedScore = estimateQualityScore(form);
  const resolvedScore = resolveQualityScore(bundle);
  const metaUiStatus = resolveMetaUiStatus(searchParams.get("meta"));
  const metaUi = buildMetaUiContent(metaUiStatus);
  const linkedInUiStatus = resolveLinkedInUiStatus(searchParams.get("linkedin"));
  const linkedInUi = buildLinkedInUiContent(linkedInUiStatus);
  const tikTokUiStatus = resolveTikTokUiStatus(searchParams.get("tiktok"));
  const tikTokUi = buildTikTokUiContent(tikTokUiStatus);
  const plannerItems = bundle?.planning?.items ?? [];
  const campaignProgress = approval?.status === "approved" ? 100 : bundle ? 85 : 0;
  const expectedMediaCount = bundle ? mediaAssets.length : estimateExpectedMediaCount(activeChannels);
  const localizationCount = bundle ? localizationEntries.length : 1;
  const communityCount = bundle?.communityDiscovery?.communities.length ?? 0;
  const platformCount = bundle?.campaign.platforms.length ?? activeChannels.length;
  const generatedContentCount = bundle ? plannerItems.length : 0;
  const generationRunStatusLabel = formatGenerationRunStatus(generationRunStatus);
  const controlCenterStatus = loading
    ? generationRunStatusLabel ?? "Génération en cours"
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
    : loading && generationRunStatusLabel
      ? "La campagne est en cours de traitement asynchrone. Vous pouvez recharger la page sans perdre le job."
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
  const isAnyPublishLoading =
    publishLoading || linkedInPublishLoading || tikTokUploadLoading;

  const contentWorkspaceCards =
    publisher && metaPreview
      ? submittedChannels
          .filter(
            (channel): channel is ActiveChannel =>
              ACTIVE_CHANNELS.includes(channel as ActiveChannel),
          )
          .map((channel) => {
            const publisherChannel = publisher.channels?.[channel];
            if (!publisherChannel) {
              return null;
            }
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
          .filter((card) => card !== null)
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

  useEffect(() => {
    let mounted = true;

    async function loadMetaStatus() {
      setMetaConnectionLoading(true);

      try {
        const {
          data: { session },
        } = await getSharedSession();

        if (!session?.access_token) {
          if (mounted) {
            setMetaConnection(null);
            setMetaConnectionLoading(false);
          }
          return;
        }

        const response = await fetch("/api/admin/marketing-studio/meta/status", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          cache: "no-store",
        });
        const body = (await response.json().catch(() => null)) as
          | MetaStatusResponse
          | null;

        if (!mounted) {
          return;
        }

        if (response.ok && body?.ok) {
          setMetaConnection(body.connection ?? null);
        } else {
          setMetaConnection(null);
        }
      } catch {
        if (mounted) {
          setMetaConnection(null);
        }
      } finally {
        if (mounted) {
          setMetaConnectionLoading(false);
        }
      }
    }

    void loadMetaStatus();

    return () => {
      mounted = false;
    };
  }, [metaUiStatus]);

  useEffect(() => {
    let mounted = true;

    async function loadLinkedInStatus() {
      setLinkedInConnectionLoading(true);

      try {
        const {
          data: { session },
        } = await getSharedSession();

        if (!session?.access_token) {
          if (mounted) {
            setLinkedInConnection(null);
            setLinkedInConnectionLoading(false);
          }
          return;
        }

        const response = await fetch("/api/admin/marketing-studio/linkedin/status", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          cache: "no-store",
        });
        const body = (await response.json().catch(() => null)) as
          | LinkedInStatusResponse
          | null;

        if (!mounted) {
          return;
        }

        if (response.ok && body?.ok) {
          setLinkedInConnection(body.connection ?? null);
        } else {
          setLinkedInConnection(null);
        }
      } catch {
        if (mounted) {
          setLinkedInConnection(null);
        }
      } finally {
        if (mounted) {
          setLinkedInConnectionLoading(false);
        }
      }
    }

    void loadLinkedInStatus();

    return () => {
      mounted = false;
    };
  }, [linkedInUiStatus]);

  useEffect(() => {
    let mounted = true;

    async function loadTikTokStatus() {
      setTikTokConnectionLoading(true);

      try {
        const {
          data: { session },
        } = await getSharedSession();

        if (!session?.access_token) {
          if (mounted) {
            setTikTokConnection(null);
            setTikTokConnectionLoading(false);
          }
          return;
        }

        const response = await fetch("/api/admin/marketing-studio/tiktok/status", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          cache: "no-store",
        });
        const body = (await response.json().catch(() => null)) as
          | TikTokStatusResponse
          | null;

        if (!mounted) {
          return;
        }

        if (response.ok && body?.ok) {
          setTikTokConnection(body.connection ?? null);
        } else {
          setTikTokConnection(null);
        }
      } catch {
        if (mounted) {
          setTikTokConnection(null);
        }
      } finally {
        if (mounted) {
          setTikTokConnectionLoading(false);
        }
      }
    }

    void loadTikTokStatus();

    return () => {
      mounted = false;
    };
  }, [tikTokUiStatus]);

  useEffect(() => {
    const campaignParam = searchParams.get("campaign")?.trim() ?? "";
    const runParam = searchParams.get("run")?.trim() ?? "";

    if (skipCampaignRestoreRef.current) {
      if (!campaignParam) {
        skipCampaignRestoreRef.current = false;
      }
      return;
    }

    if (runParam && !result) {
      return;
    }

    if (!campaignParam || (campaignId === campaignParam && result)) {
      return;
    }

    let mounted = true;

    async function loadCampaign() {
      try {
        const {
          data: { session },
        } = await getSharedSession();

        if (!session?.access_token) {
          return;
        }

        const response = await fetch(
          `/api/admin/marketing-studio/campaigns/${campaignParam}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          },
        );
        const body = (await response.json().catch(() => null)) as
          | LoadCampaignResponse
          | null;

        if (!response.ok || !body?.ok || !body.campaign?.id) {
          throw new Error(body?.error ?? "Chargement de la campagne impossible.");
        }

        if (!mounted) {
          return;
        }

        setCampaignId(body.campaign.id);
        if (body.result) {
          const restoredForm = buildRestoredCampaignForm(body.result);
          setResult(body.result);
          setSubmittedForm(restoredForm);
          setForm(restoredForm);
        }
      } catch (caughtError) {
        if (!mounted) {
          return;
        }

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Chargement de la campagne impossible.",
        );
      }
    }

    void loadCampaign();

    return () => {
      mounted = false;
    };
  }, [campaignId, result, searchParams]);

  useEffect(() => {
    const runParam = searchParams.get("run")?.trim() ?? "";
    const campaignParam = searchParams.get("campaign")?.trim() ?? "";

    if (!runParam) {
      setGenerationRunId(null);
      setGenerationRunStatus(null);
      return;
    }

    if (campaignParam) {
      setCampaignId(campaignParam);
    }

    let mounted = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let consecutivePollingErrors = 0;

    async function pollRun() {
      try {
        const {
          data: { session },
        } = await getSharedSession();

        if (!session?.access_token) {
          throw new Error("Session introuvable.");
        }

        const response = await fetch(
          `/api/admin/marketing-studio/runs/${runParam}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
            cache: "no-store",
          },
        );
        const body = (await response.json().catch(() => null)) as
          | RunStatusResponse
          | null;

        if (!response.ok || !body?.ok || !body.run?.id) {
          throw new Error(body?.error ?? "Suivi de génération impossible.");
        }

        if (!mounted) {
          return;
        }

        consecutivePollingErrors = 0;
        setError((current) =>
          current === RUN_STATUS_TEMPORARY_ERROR_MESSAGE ? null : current,
        );
        setGenerationRunId(body.run.id);
        setGenerationRunStatus(body.run.status);

        if (body.run.status === "completed") {
          setError(null);
          setLoading(false);
          const nextSearchParams = new URLSearchParams(searchParams.toString());
          nextSearchParams.delete("run");
          nextSearchParams.set("campaign", body.run.campaignId);
          skipCampaignRestoreRef.current = false;
          router.replace(
            `/dashboard/admin/marketing-studio?${nextSearchParams.toString()}`,
          );
          return;
        }

        if (body.run.status === "failed") {
          setLoading(false);
          setError(
            body.run.errorMessage ??
              "La génération asynchrone a échoué côté serveur.",
          );
          return;
        }

        timeoutId = setTimeout(() => {
          void pollRun();
        }, RUN_STATUS_POLL_INTERVAL_MS);
      } catch (caughtError) {
        if (!mounted) {
          return;
        }

        consecutivePollingErrors += 1;
        if (consecutivePollingErrors >= RUN_STATUS_POLL_ERROR_THRESHOLD) {
          setError(RUN_STATUS_TEMPORARY_ERROR_MESSAGE);
        }
        timeoutId = setTimeout(() => {
          void pollRun();
        }, RUN_STATUS_POLL_INTERVAL_MS);
      }
    }

    setLoading(true);
    void pollRun();

    return () => {
      mounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [router, searchParams]);

  const metaConnectionStatusLabel = metaConnectionLoading
    ? "verification"
    : metaConnection?.connected
      ? "connecte"
      : "non connecte";
  const metaConnectionStatusTone = metaConnection?.connected ? "emerald" : "amber";
  const metaFacebookValue = metaConnectionLoading
    ? "Verification en cours"
    : metaConnection?.facebookPage?.name ?? "Aucune Page Facebook detectee";
  const metaInstagramValue = metaConnectionLoading
    ? "Verification en cours"
    : metaConnection?.instagramBusinessAccount?.username
      ? `@${metaConnection.instagramBusinessAccount.username}`
      : "Aucun compte Instagram lie";
  const metaConnectLabel = metaConnection?.connected
    ? "Reconnecter Meta"
    : "Connecter Meta";
  const metaOAuthValue = metaConnection?.connected
    ? "connecte et persiste"
    : metaUi.oauthLabel;
  const metaHelperText = metaConnection?.connected
    ? "Connexion Meta persistee cote serveur. Aucune publication n'est active dans cette phase."
    : metaUi.helperText;
  const resolvedMetaAlert = metaLoginError ?? metaUi.alert;
  const linkedInConnectionStatusLabel = linkedInConnectionLoading
    ? "verification"
    : linkedInConnection?.connected
      ? "connecte"
      : linkedInUi.statusLabel;
  const linkedInConnectionStatusTone = linkedInConnection?.connected
    ? "emerald"
    : linkedInUi.statusTone;
  const linkedInOrganizationValue = linkedInConnectionLoading
    ? "Verification en cours"
    : linkedInConnection?.organization?.id
      ? `urn:li:organization:${linkedInConnection.organization.id}`
      : linkedInConnection?.organization?.urn ?? linkedInUi.organizationValue;
  const linkedInConnectLabel = linkedInConnection?.connected
    ? "Reconnecter LinkedIn"
    : "Connecter LinkedIn";
  const linkedInOAuthValue = linkedInConnection?.connected
    ? "connecte et persiste"
    : linkedInUi.oauthLabel;
  const linkedInHelperText = linkedInConnection?.connected
    ? "Connexion LinkedIn persistee cote serveur. Publication texte-only manuelle disponible apres validation humaine."
    : linkedInUi.helperText;
  const resolvedLinkedInAlert = linkedInLoginError ?? linkedInUi.alert;
  const tikTokConnectionStatusLabel = tikTokConnectionLoading
    ? "verification"
    : tikTokConnection?.connected
      ? "connecte"
      : tikTokUi.statusLabel;
  const tikTokConnectionStatusTone = tikTokConnection?.connected
    ? "emerald"
    : tikTokUi.statusTone;
  const tikTokAccountValue = tikTokConnectionLoading
    ? "Verification en cours"
    : tikTokConnection?.openId
      ? `open_id ${tikTokConnection.openId}`
      : tikTokUi.accountValue;
  const tikTokConnectLabel = tikTokConnection?.connected
    ? "Reconnecter TikTok"
    : "Connecter TikTok";
  const tikTokOAuthValue = tikTokConnection?.connected
    ? "connecte et persiste"
    : tikTokUi.oauthLabel;
  const tikTokHelperText = tikTokConnection?.connected
    ? "Connexion TikTok persistee cote serveur. Upload FILE_UPLOAD disponible apres validation humaine. La publication finale doit etre terminee dans TikTok."
    : tikTokUi.helperText;
  const resolvedTikTokAlert = tikTokLoginError ?? tikTokUi.alert;

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

    const nextSearchParams = new URLSearchParams(searchParams.toString());
    const submissionFingerprint = buildMarketingStudioSubmissionFingerprint({
      ...form,
      channels: activeChannels,
    });
    const pendingSubmissionStorage =
      typeof window !== "undefined" ? window.sessionStorage : null;
    const pendingSubmission = pendingSubmissionStorage
      ? resolveMarketingStudioPendingSubmission({
          storage: pendingSubmissionStorage,
          fingerprint: submissionFingerprint,
        })
      : null;
    const submissionKey = pendingSubmission?.submissionKey ?? crypto.randomUUID();

    setLoading(true);
    setError(null);
    setSaveError(null);
    setApproveError(null);
    setPublishError(null);
    setGenerationRunId(null);
    setGenerationRunStatus("queued");
    let keepLoadingAfterEnqueue = false;

    try {
      const {
        data: { session },
      } = await getSharedSession();

      if (!session?.access_token) {
        throw new Error("Session introuvable.");
      }

      if (IS_NON_PRODUCTION) {
        console.info("[MARKETING STUDIO RUN CLIENT] request started");
      }

      const response = await fetch("/api/admin/marketing-studio/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          ...form,
          channels: activeChannels,
          submissionKey,
        }),
      });
      const responseRequestId =
        response.headers.get("x-marketing-studio-request-id")?.trim() || null;

      if (IS_NON_PRODUCTION) {
        console.info("[MARKETING STUDIO RUN CLIENT] response headers received", {
          requestId: responseRequestId,
          status: response.status,
        });
      }

      const data = (await response.json()) as RunResponse;
      const requestId = data.requestId ?? responseRequestId ?? null;

      if (IS_NON_PRODUCTION) {
        console.info("[MARKETING STUDIO RUN CLIENT] json parsed", {
          requestId,
          ok: data.ok,
        });
      }

      if (!response.ok || !data.ok || !data.runId || !data.campaignId) {
        throw new Error(data.error ?? "Campaign generation failed.");
      }

      setSubmittedForm({
        ...form,
        channels: [...activeChannels],
      });
      setResult(null);
      setCampaignId(data.campaignId);
      setGenerationRunId(data.runId);
      setGenerationRunStatus(data.runStatus ?? "queued");
      keepLoadingAfterEnqueue = true;

      if (IS_NON_PRODUCTION) {
        console.info("[MARKETING STUDIO RUN CLIENT] result applied", {
          requestId,
        });
      }

      nextSearchParams.set("campaign", data.campaignId);
      nextSearchParams.set("run", data.runId);
      skipCampaignRestoreRef.current = false;
      router.replace(
        `/dashboard/admin/marketing-studio?${nextSearchParams.toString()}`,
      );
      if (pendingSubmissionStorage) {
        clearMarketingStudioPendingSubmission(pendingSubmissionStorage);
      }
    } catch (caughtError) {
      if (IS_NON_PRODUCTION) {
        console.info("[MARKETING STUDIO RUN CLIENT] request failed", {
          errorName:
            caughtError instanceof Error ? caughtError.name : "UnknownError",
          errorMessage:
            caughtError instanceof Error
              ? caughtError.message
              : "Campaign generation failed.",
        });
      }

      setResult(null);
      setSubmittedForm(null);
      setGenerationRunId(null);
      setGenerationRunStatus(null);
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Campaign generation failed.",
      );
    } finally {
      if (!keepLoadingAfterEnqueue) {
        setLoading(false);
      }
    }
  }

  async function handleSaveDraft() {
    if (!result) {
      setSaveError("Aucune campagne a sauvegarder.");
      return;
    }

    setSaveLoading(true);
    setSaveError(null);
    setApproveError(null);
    setPublishError(null);

    try {
      const {
        data: { session },
      } = await getSharedSession();

      if (!session?.access_token) {
        throw new Error("Session introuvable.");
      }

      const response = await fetch("/api/admin/marketing-studio/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          campaignId,
          name: campaign?.name ?? form.name,
          objective: campaign?.objective ?? form.objective,
          language: campaign?.language ?? form.language,
          timeframe: campaign?.durationDays
            ? `${campaign.durationDays} jours`
            : form.durationLabel,
          channels:
            submittedChannels.length > 0 ? submittedChannels : activeChannels,
          result,
        }),
      });
      const body = (await response.json().catch(() => null)) as
        | SaveCampaignResponse
        | null;

      if (!response.ok || !body?.ok || !body.campaign?.id) {
        throw new Error(body?.error ?? "Sauvegarde impossible.");
      }

      setCampaignId(body.campaign.id);
      const nextSearchParams = new URLSearchParams(searchParams.toString());
      nextSearchParams.set("campaign", body.campaign.id);
      router.replace(
        `/dashboard/admin/marketing-studio?${nextSearchParams.toString()}`,
      );
    } catch (caughtError) {
      setSaveError(
        caughtError instanceof Error
          ? caughtError.message
          : "Sauvegarde impossible.",
      );
    } finally {
      setSaveLoading(false);
    }
  }

  async function handleApproveCampaign() {
    if (!campaignId) {
      setApproveError("Enregistrez d'abord la campagne.");
      return;
    }

    setApproveLoading(true);
    setApproveError(null);
    setSaveError(null);
    setPublishError(null);

    try {
      const {
        data: { session },
      } = await getSharedSession();

      if (!session?.access_token) {
        throw new Error("Session introuvable.");
      }

      const response = await fetch("/api/admin/marketing-studio/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          campaignId,
        }),
      });
      const body = (await response.json().catch(() => null)) as
        | ApproveCampaignResponse
        | null;

      if (!response.ok || !body?.ok || !body.result) {
        throw new Error(body?.error ?? "Approbation impossible.");
      }

      setResult(body.result);
    } catch (caughtError) {
      setApproveError(
        caughtError instanceof Error
          ? caughtError.message
          : "Approbation impossible.",
      );
    } finally {
      setApproveLoading(false);
    }
  }

  async function handlePublishFacebook() {
    if (!campaignId) {
      setPublishError("Enregistrez d'abord la campagne.");
      return;
    }

    setPublishLoading(true);
    setPublishError(null);
    setSaveError(null);
    setApproveError(null);
    setLinkedInPublishError(null);

    try {
      const {
        data: { session },
      } = await getSharedSession();

      if (!session?.access_token) {
        throw new Error("Session introuvable.");
      }

      const response = await fetch(
        "/api/admin/marketing-studio/meta/publish-facebook",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            campaignId,
          }),
        },
      );
      const body = (await response.json().catch(() => null)) as
        | PublishFacebookResponse
        | null;

      if (!response.ok || !body?.ok || !body.result) {
        throw new Error(body?.error ?? "Publication Facebook impossible.");
      }

      setResult(body.result);
    } catch (caughtError) {
      setPublishError(
        caughtError instanceof Error
          ? caughtError.message
          : "Publication Facebook impossible.",
      );
    } finally {
      setPublishLoading(false);
    }
  }

  async function handleMetaConnect() {
    setMetaLoginError(null);
    setMetaLoginLoading(true);

    try {
      const {
        data: { session },
      } = await getSharedSession();

      if (!session?.access_token) {
        throw new Error("Session introuvable.");
      }

      const response = await fetch("/api/admin/marketing-studio/meta/login", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "x-meta-oauth-mode": "json",
        },
        cache: "no-store",
      });
      const body = (await response.json().catch(() => null)) as
        | MetaLoginResponse
        | null;

      if (!response.ok || !body?.ok || !body.url) {
        throw new Error(body?.error ?? "Connexion Meta indisponible.");
      }

      window.location.href = body.url;
    } catch (caughtError) {
      setMetaLoginError(
        caughtError instanceof Error
          ? caughtError.message
          : "Connexion Meta indisponible.",
      );
      setMetaLoginLoading(false);
    }
  }

  async function handlePublishLinkedIn() {
    if (!campaignId) {
      setLinkedInPublishError("Enregistrez d'abord la campagne.");
      return;
    }

    setLinkedInPublishLoading(true);
    setLinkedInPublishError(null);
    setPublishError(null);
    setSaveError(null);
    setApproveError(null);

    try {
      const {
        data: { session },
      } = await getSharedSession();

      if (!session?.access_token) {
        throw new Error("Session introuvable.");
      }

      const response = await fetch(
        "/api/admin/marketing-studio/linkedin/publish-post",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            campaignId,
          }),
        },
      );
      const body = (await response.json().catch(() => null)) as
        | PublishLinkedInResponse
        | null;

      if (!response.ok || !body?.ok || !body.result) {
        throw new Error(body?.error ?? "Publication LinkedIn impossible.");
      }

      setResult(body.result);
    } catch (caughtError) {
      setLinkedInPublishError(
        caughtError instanceof Error
          ? caughtError.message
          : "Publication LinkedIn impossible.",
      );
    } finally {
      setLinkedInPublishLoading(false);
    }
  }

  async function handleUploadTikTok() {
    if (!campaignId) {
      setTikTokUploadError("Enregistrez d'abord la campagne.");
      return;
    }

    setTikTokUploadLoading(true);
    setTikTokUploadError(null);
    setLinkedInPublishError(null);
    setPublishError(null);
    setSaveError(null);
    setApproveError(null);

    try {
      const {
        data: { session },
      } = await getSharedSession();

      if (!session?.access_token) {
        throw new Error("Session introuvable.");
      }

      const response = await fetch(
        "/api/admin/marketing-studio/tiktok/upload-video",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            campaignId,
          }),
        },
      );
      const body = (await response.json().catch(() => null)) as
        | UploadTikTokResponse
        | null;

      if (!response.ok || !body?.ok || !body.result) {
        throw new Error(body?.error ?? "Upload TikTok impossible.");
      }

      setResult(body.result);
    } catch (caughtError) {
      setTikTokUploadError(
        caughtError instanceof Error
          ? caughtError.message
          : "Upload TikTok impossible.",
      );
    } finally {
      setTikTokUploadLoading(false);
    }
  }

  async function handleLinkedInConnect() {
    setLinkedInLoginError(null);
    setLinkedInLoginLoading(true);

    try {
      const {
        data: { session },
      } = await getSharedSession();

      if (!session?.access_token) {
        throw new Error("Session introuvable.");
      }

      const response = await fetch(
        "/api/admin/marketing-studio/linkedin/login",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "x-linkedin-oauth-mode": "json",
          },
          cache: "no-store",
        },
      );
      const body = (await response.json().catch(() => null)) as
        | LinkedInLoginResponse
        | null;

      if (!response.ok || !body?.ok || !body.url) {
        throw new Error(body?.error ?? "Connexion LinkedIn indisponible.");
      }

      window.location.href = body.url;
    } catch (caughtError) {
      setLinkedInLoginError(
        caughtError instanceof Error
          ? caughtError.message
          : "Connexion LinkedIn indisponible.",
      );
      setLinkedInLoginLoading(false);
    }
  }

  async function handleTikTokConnect() {
    setTikTokLoginError(null);
    setTikTokLoginLoading(true);

    try {
      const {
        data: { session },
      } = await getSharedSession();

      if (!session?.access_token) {
        throw new Error("Session introuvable.");
      }

      const response = await fetch("/api/admin/marketing-studio/tiktok/login", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "x-tiktok-oauth-mode": "json",
        },
        cache: "no-store",
      });
      const body = (await response.json().catch(() => null)) as
        | TikTokLoginResponse
        | null;

      if (!response.ok || !body?.ok || !body.url) {
        throw new Error(body?.error ?? "Connexion TikTok indisponible.");
      }

      window.location.href = body.url;
    } catch (caughtError) {
      setTikTokLoginError(
        caughtError instanceof Error
          ? caughtError.message
          : "Connexion TikTok indisponible.",
      );
      setTikTokLoginLoading(false);
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
              <button
                type="button"
                onClick={() => router.push("/dashboard/admin/marketing-studio/campaigns")}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Voir les campagnes sauvegardées
              </button>
              <p className="mt-2.5 text-sm leading-6 text-slate-700">
                {bundle
                  ? "Le studio reste en brouillon jusqu'à validation humaine."
                  : "Configurez votre campagne puis lancez la génération quand vous êtes prêt."}
              </p>

              {generationRunId ? (
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Run asynchrone actif : {generationRunId}
                </p>
              ) : null}

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
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-200/90">
              Configuration
            </p>
            <h2 className="mt-1 text-[1.95rem] font-semibold tracking-tight text-white">
              Configuration de la campagne
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-300">
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
            <div className="grid gap-4 xl:grid-cols-4">
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
              <ChannelCard
                title="TikTok"
                lines={["Videos verticales", "Narration FR", "Upload inbox"]}
                active={activeChannels.includes("tiktok")}
                onToggle={() => toggleChannel("tiktok")}
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

          <SectionCard eyebrow="Meta" title="Connexion Meta">
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricTile
                  label="Statut"
                  value={metaConnectionStatusLabel}
                  tone={metaConnectionStatusTone}
                />
                <MetricTile label="OAuth" value={metaOAuthValue} />
                <MetricTile label="Mode" value="Lecture seule" />
                <MetricTile
                  label="Publication automatique"
                  value="Publication désactivée"
                  tone="amber"
                />
              </div>

              <button
                type="button"
                onClick={handleMetaConnect}
                disabled={metaLoginLoading}
                className="inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {metaLoginLoading ? "Connexion Meta..." : metaConnectLabel}
              </button>

              {resolvedMetaAlert ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                  {resolvedMetaAlert}
                </div>
              ) : null}

              <p className="text-sm leading-6 text-slate-600">{metaHelperText}</p>

              <div className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Facebook Page
                  </p>
                  <p className="mt-2 text-sm text-slate-700">{metaFacebookValue}</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Instagram Business
                  </p>
                  <p className="mt-2 text-sm text-slate-700">{metaInstagramValue}</p>
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
          </SectionCard>

          <SectionCard eyebrow="TikTok" title="Connexion TikTok">
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricTile
                  label="Statut"
                  value={tikTokConnectionStatusLabel}
                  tone={tikTokConnectionStatusTone}
                />
                <MetricTile label="OAuth" value={tikTokOAuthValue} />
                <MetricTile label="Scope" value="video.upload" />
                <MetricTile
                  label="Mode"
                  value="Upload inbox uniquement"
                  tone="amber"
                />
              </div>

              <button
                type="button"
                onClick={handleTikTokConnect}
                disabled={tikTokLoginLoading}
                className="inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {tikTokLoginLoading ? "Connexion TikTok..." : tikTokConnectLabel}
              </button>

              {resolvedTikTokAlert ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                  {resolvedTikTokAlert}
                </div>
              ) : null}

              <p className="text-sm leading-6 text-slate-600">{tikTokHelperText}</p>

              <div className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Compte
                  </p>
                  <p className="mt-2 text-sm text-slate-700">{tikTokAccountValue}</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Flow
                  </p>
                  <p className="mt-2 text-sm text-slate-700">
                    Upload FILE_UPLOAD puis finalisation dans TikTok
                  </p>
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
                  <p className="mt-1 text-sm text-emerald-800">
                    Aucun token affiche
                  </p>
                </div>
              </div>
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
                    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-3 text-sm leading-6 text-amber-900">
                      Les clés providers et les paramètres sensibles resteront gérés côté serveur.
                      Cette interface ne les expose pas au client.
                    </div>
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
                            <option value="fal">fal</option>
                            <option value="replicate">replicate</option>
                          </select>
                        </label>
                        <p className="text-sm leading-6 text-slate-600">
                          Les providers image et vidéo seront configurables plus tard depuis
                          cette interface.
                        </p>
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
                        <p className="text-sm leading-6 text-slate-600">
                          Le stockage média pourra être activé une fois le backend connecté.
                        </p>
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
                        <p className="text-sm leading-6 text-slate-600">
                          L’upload automatique et le polling restent désactivés tant que la
                          configuration n’est pas persistée.
                        </p>
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

                <div className="rounded-[26px] border border-slate-200 bg-white/85 p-4 shadow-sm shadow-slate-200/40">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                        Actions de validation
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">
                        Enregistrez d'abord le brouillon, puis validez manuellement la campagne.
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        {campaignId
                          ? `Campagne sauvegardee : ${campaignId}`
                          : "Aucune campagne sauvegardee pour le moment."}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={handleSaveDraft}
                        disabled={
                          saveLoading ||
                          approveLoading ||
                          isAnyPublishLoading ||
                          loading ||
                          !bundle ||
                          approval?.status === "approved"
                        }
                        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {approval?.status === "approved"
                          ? "Brouillon verrouille"
                          : saveLoading
                          ? "Sauvegarde..."
                          : campaignId
                            ? "Mettre a jour le brouillon"
                            : "Enregistrer le brouillon"}
                      </button>
                      <button
                        type="button"
                        onClick={handleApproveCampaign}
                        disabled={
                          approveLoading ||
                          saveLoading ||
                          isAnyPublishLoading ||
                          loading ||
                          !bundle ||
                          !campaignId ||
                          approval?.status === "approved"
                        }
                        className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {approveLoading
                          ? "Approbation..."
                          : approval?.status === "approved"
                            ? "Campagne approuvee"
                            : "Approuver"}
                      </button>
                      <button
                        type="button"
                        onClick={handlePublishFacebook}
                        disabled={
                          publishLoading ||
                          linkedInPublishLoading ||
                          approveLoading ||
                          saveLoading ||
                          loading ||
                          !bundle ||
                          !campaignId ||
                          approval?.status !== "approved" ||
                          facebookPublishStatus === "published" ||
                          facebookPublishStatus === "publishing"
                        }
                        className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {publishLoading
                          ? "Publication Facebook..."
                          : facebookPublishStatus === "publishing"
                            ? "Publication Facebook en cours"
                          : facebookPublishStatus === "published"
                            ? "Publié sur Facebook"
                            : "Publier sur Facebook"}
                      </button>
                      <button
                        type="button"
                        onClick={handlePublishLinkedIn}
                        disabled={
                          linkedInPublishLoading ||
                          publishLoading ||
                          approveLoading ||
                          saveLoading ||
                          loading ||
                          !bundle ||
                          !campaignId ||
                          !linkedInConnection?.connected ||
                          approval?.status !== "approved" ||
                          linkedInPublishStatus === "published" ||
                          linkedInPublishStatus === "publishing"
                        }
                        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {linkedInPublishLoading
                          ? "Publication LinkedIn..."
                          : linkedInPublishStatus === "publishing"
                            ? "Publication LinkedIn en cours"
                            : linkedInPublishStatus === "published"
                              ? "Publié sur LinkedIn"
                              : "Publier sur LinkedIn"}
                      </button>
                      <button
                        type="button"
                        onClick={handleUploadTikTok}
                        disabled={
                          tikTokUploadLoading ||
                          linkedInPublishLoading ||
                          publishLoading ||
                          approveLoading ||
                          saveLoading ||
                          loading ||
                          !bundle ||
                          !campaignId ||
                          !tikTokConnection?.connected ||
                          !hasTikTokFinalMuxedAsset ||
                          approval?.status !== "approved" ||
                          tikTokUploadStatus === "publishing" ||
                          tikTokUploadStatus === "awaiting_tiktok_completion"
                        }
                        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {tikTokUploadLoading
                          ? "Envoi TikTok..."
                          : tikTokUploadStatus === "publishing"
                            ? "Envoi TikTok en cours"
                            : tikTokUploadStatus === "awaiting_tiktok_completion"
                              ? "A terminer dans TikTok"
                              : "Envoyer vers TikTok"}
                      </button>
                    </div>
                  </div>

                  {saveError ? (
                    <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                      {saveError}
                    </div>
                  ) : null}

                  {approveError ? (
                    <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                      {approveError}
                    </div>
                  ) : null}

                  {publishError ? (
                    <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                      {publishError}
                    </div>
                  ) : null}

                  {linkedInPublishError ? (
                    <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                      {linkedInPublishError}
                    </div>
                  ) : null}

                  {tikTokUploadError ? (
                    <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                      {tikTokUploadError}
                    </div>
                  ) : null}

                  {facebookPublishStatus === "publishing" ? (
                    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                      Publication Facebook en cours ou a verifier manuellement.
                    </div>
                  ) : null}

                  {facebookPublishStatus === "published" ? (
                    <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                      Publication Facebook effectuée.
                      {facebookPlatformPostId
                        ? ` Post ID : ${facebookPlatformPostId}`
                        : ""}
                    </div>
                  ) : null}

                  {linkedInPublishStatus === "publishing" ? (
                    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                      Publication LinkedIn en cours ou a verifier manuellement.
                    </div>
                  ) : null}

                  {linkedInPublishStatus === "published" ? (
                    <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                      Publication LinkedIn effectuée.
                      {linkedInPlatformPostId
                        ? ` Post ID : ${linkedInPlatformPostId}`
                        : ""}
                    </div>
                  ) : null}

                  {tikTokUploadStatus === "publishing" ? (
                    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                      Upload TikTok en cours.
                    </div>
                  ) : null}

                  {tikTokUploadStatus === "awaiting_tiktok_completion" ? (
                    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                      Vidéo envoyée à TikTok. Terminez la publication depuis la notification TikTok.
                      {tikTokPublishId ? ` Publish ID : ${tikTokPublishId}` : ""}
                      {tikTokUploadPlatformStatus
                        ? ` Statut upload : ${tikTokUploadPlatformStatus}`
                        : ""}
                    </div>
                  ) : null}
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
                            status={publisher.channels[channel]?.status ?? null}
                            publishedAt={publisher.channels[channel]?.publishedAt ?? null}
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
                      value={metaConnectionStatusLabel}
                      tone={metaConnectionStatusTone}
                    />
                    <MetricTile label="Mode" value="Lecture seule" />
                    <MetricTile
                      label="Publication automatique"
                      value="Publication désactivée"
                      tone="amber"
                    />
                    <MetricTile label="OAuth" value={metaOAuthValue} />
                    <MetricTile
                      label="Validation humaine"
                      value="Validation humaine requise"
                      tone="emerald"
                    />
                    <MetricTile label="Tokens" value="Jamais affichés" />
                  </div>

                  <button
                    type="button"
                    onClick={handleMetaConnect}
                    disabled={metaLoginLoading}
                    className="mt-6 inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {metaLoginLoading ? "Connexion Meta..." : metaConnectLabel}
                  </button>

                  {resolvedMetaAlert ? (
                    <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                      {resolvedMetaAlert}
                    </div>
                  ) : null}

                  <p className="mt-4 text-sm leading-6 text-slate-600">{metaHelperText}</p>

                  <div className="mt-6 grid gap-4 lg:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Facebook Page
                      </p>
                      <p className="mt-2 text-sm text-slate-700">{metaFacebookValue}</p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Instagram Business
                      </p>
                      <p className="mt-2 text-sm text-slate-700">{metaInstagramValue}</p>
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

                <div className="rounded-[28px] border border-slate-300/80 bg-white/95 p-5 shadow-lg shadow-slate-200/55 backdrop-blur-sm">
                  <div className="mb-5">
                    <BadgeList
                      values={[
                        "Texte-only",
                        "Page entreprise",
                        "Validation humaine requise",
                      ]}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <MetricTile
                      label="Statut"
                      value={linkedInConnectionStatusLabel}
                      tone={linkedInConnectionStatusTone}
                    />
                    <MetricTile label="Mode" value="Texte-only manuel" />
                    <MetricTile
                      label="Publication automatique"
                      value="Publication désactivée"
                      tone="amber"
                    />
                    <MetricTile label="OAuth" value={linkedInOAuthValue} />
                    <MetricTile
                      label="Validation humaine"
                      value="Validation humaine requise"
                      tone="emerald"
                    />
                    <MetricTile label="Tokens" value="Jamais affichés" />
                  </div>

                  <button
                    type="button"
                    onClick={handleLinkedInConnect}
                    disabled={linkedInLoginLoading}
                    className="mt-6 inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {linkedInLoginLoading
                      ? "Connexion LinkedIn..."
                      : linkedInConnectLabel}
                  </button>

                  {resolvedLinkedInAlert ? (
                    <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                      {resolvedLinkedInAlert}
                    </div>
                  ) : null}

                  <p className="mt-4 text-sm leading-6 text-slate-600">
                    {linkedInHelperText}
                  </p>

                  <div className="mt-6 grid gap-4 lg:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Organization URN
                      </p>
                      <p className="mt-2 text-sm text-slate-700">
                        {linkedInOrganizationValue}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Scope
                      </p>
                      <p className="mt-2 text-sm text-slate-700">
                        {linkedInConnection?.grantedScopes?.join(", ") ||
                          "w_organization_social"}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                        Securite
                      </p>
                      <p className="mt-2 text-sm text-emerald-800">
                        Publication entreprise uniquement
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
