"use client";

import { useMemo, useState, type ReactNode } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import type { MarketingCampaignBundle } from "@/lib/marketing-ai/bundle/marketingCampaignBundle";
import type {
  MarketingStudioOrchestratorV2Input,
  MarketingStudioOrchestratorV2Result,
} from "@/lib/marketing-ai/orchestrator/marketingStudioOrchestratorV2";

type ActiveChannel = "facebook" | "instagram" | "linkedin";
type ResultTab =
  | "summary"
  | "planning"
  | "creative"
  | "video"
  | "localization"
  | "communities"
  | "publisher"
  | "json";
type TimelineStatus = "neutral" | "running" | "done";

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
  "Campaign",
  "Memory",
  "Planner",
  "Social",
  "Creative",
  "Video",
  "Localization",
  "Community",
  "Review",
  "Approval",
  "Publisher",
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
    <section className={`rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm ${className}`.trim()}>
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
              ? "border border-slate-200 bg-slate-50 text-slate-400"
              : "border border-slate-200 bg-white text-slate-700"
          }`}
        >
          {value}
        </span>
      ))}
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
          ? "cursor-not-allowed border-dashed border-slate-200 bg-slate-50 text-slate-400"
          : active
          ? "border-slate-950 bg-slate-950 text-white shadow-lg shadow-slate-200"
          : "border-slate-200 bg-white text-slate-900 hover:border-slate-300"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold">{title}</p>
          <p className={`mt-1 text-xs uppercase tracking-[0.16em] ${disabled ? "text-slate-400" : active ? "text-slate-300" : "text-slate-500"}`}>
            {disabled ? "bientot" : active ? "active" : "desactive"}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase ${
            disabled
              ? "border border-slate-200 bg-white text-slate-400"
              : active
              ? "bg-white/10 text-white"
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
          className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
            disabled
              ? "border border-slate-200 bg-white text-slate-400"
              : active
              ? "bg-emerald-400/15 text-emerald-100"
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
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "running"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-slate-200 bg-white text-slate-500";

  const dotClasses =
    status === "done"
      ? "bg-emerald-500"
      : status === "running"
      ? "bg-amber-500"
      : "bg-slate-300";

  return (
    <div className={`flex min-w-[132px] items-center gap-3 rounded-2xl border px-4 py-3 ${classes}`}>
      <span className={`h-2.5 w-2.5 rounded-full ${dotClasses}`} />
      <span className="text-sm font-semibold">{label}</span>
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
          ? "bg-slate-950 text-white"
          : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"
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
    <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-semibold text-slate-950">{title}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
            Draft preview
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase text-slate-700">
            Statut : {channel.status}
          </span>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase text-amber-700">
            Validation : obligatoire
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <MetricTile label="Publication" value="desactivee" />
        <MetricTile label="Action" value={channel.publishAction} />
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
  const campaign = bundle?.campaign;
  const approval = bundle?.approval;
  const publisher = bundle?.publisher;
  const localizationEntries = Object.entries(bundle?.localization ?? {});
  const monthlyPreview = buildMonthlyPreview(bundle?.planning);
  const estimatedScore = estimateQualityScore(form);
  const resolvedScore = resolveQualityScore(bundle);
  const qualityLabel = bundle ? "Campaign Quality Score" : "Estimation qualite";
  const timelineStatus: TimelineStatus = result ? "done" : loading ? "running" : "neutral";

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
        <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-8 text-white shadow-xl shadow-slate-200">
          <div className="max-w-4xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">
              Marketing Studio AI
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">
              Votre equipe marketing IA pour Norixo.
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
              Creez une campagne marketing complete en quelques minutes :
              planning editorial, posts sociaux, prompts image, prompts video,
              traductions, communautes et brouillons prets a valider.
            </p>
            <div className="mt-6">
              <BadgeList values={HERO_BADGES} />
            </div>
          </div>
        </section>

        <SectionCard eyebrow="Timeline IA" title="Pipeline Marketing Studio">
          <div className="flex flex-wrap gap-3">
            {TIMELINE_STEPS.map((step) => (
              <TimelineStep key={step} label={step} status={timelineStatus} />
            ))}
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
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Audience</span>
                  <input
                    value={form.audience ?? ""}
                    onChange={(event) => updateField("audience", event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                  />
                </label>

                <label className="block lg:col-span-2">
                  <span className="text-sm font-semibold text-slate-700">Objectif</span>
                  <textarea
                    rows={4}
                    value={form.objective}
                    onChange={(event) => updateField("objective", event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Marche</span>
                  <input
                    value={form.targetMarket}
                    onChange={(event) => updateField("targetMarket", event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Langue principale</span>
                  <select
                    value={form.language ?? "fr"}
                    onChange={(event) => updateField("language", event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
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
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
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
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
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
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
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
                            ? "bg-slate-950 text-white"
                            : "border border-slate-200 bg-white text-slate-600"
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
                            ? "bg-slate-950 text-white"
                            : "border border-slate-200 bg-white text-slate-600"
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
                            ? "bg-slate-950 text-white"
                            : "border border-slate-200 bg-white text-slate-600"
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

            <SectionCard eyebrow="Calendrier editorial" title="Preview mensuelle">
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
                className="mt-6 w-full rounded-2xl bg-slate-950 px-5 py-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {loading ? "Generation en cours..." : "🚀 Generer ma campagne IA"}
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
          </div>
        </div>

        {bundle && submittedForm ? (
          <div className="space-y-6">
            <SectionCard eyebrow="Resultats" title="Bundle marketing studio">
              <div className="flex flex-wrap gap-3">
                <TabButton label="Resume" active={activeTab === "summary"} onClick={() => setActiveTab("summary")} />
                <TabButton label="Planning" active={activeTab === "planning"} onClick={() => setActiveTab("planning")} />
                <TabButton label="Creative" active={activeTab === "creative"} onClick={() => setActiveTab("creative")} />
                <TabButton label="Video" active={activeTab === "video"} onClick={() => setActiveTab("video")} />
                <TabButton label="Localization" active={activeTab === "localization"} onClick={() => setActiveTab("localization")} />
                <TabButton label="Communities" active={activeTab === "communities"} onClick={() => setActiveTab("communities")} />
                <TabButton label="Publisher" active={activeTab === "publisher"} onClick={() => setActiveTab("publisher")} />
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
                  <MetricTile label="Approval status" value={approval?.status ?? "-"} tone="amber" />
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
                  {bundle.communityDiscovery.communities.map((community) => (
                    <div key={community.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
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

            {activeTab === "json" ? (
              <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <details open={false}>
                  <summary className="cursor-pointer text-lg font-semibold text-slate-950">
                    Details techniques du bundle
                  </summary>
                  <pre className="mt-4 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
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
