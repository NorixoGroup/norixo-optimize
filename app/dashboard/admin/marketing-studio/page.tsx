"use client";

import { useMemo, useState, type ReactNode } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import type { MarketingCampaignBundle } from "@/lib/marketing-ai/bundle/marketingCampaignBundle";
import type {
  MarketingStudioOrchestratorV2Input,
  MarketingStudioOrchestratorV2Result,
} from "@/lib/marketing-ai/orchestrator/marketingStudioOrchestratorV2";

type ActiveChannel = "facebook" | "instagram" | "linkedin";

type CampaignFormState = MarketingStudioOrchestratorV2Input & {
  targetMarket: string;
  durationLabel: string;
};

type RunResponse = {
  ok: boolean;
  result?: MarketingStudioOrchestratorV2Result;
  error?: string;
};

const ACTIVE_CHANNELS: ActiveChannel[] = [
  "facebook",
  "instagram",
  "linkedin",
];

const UPCOMING_CHANNELS = [
  "X / Twitter — bientot",
  "TikTok — bientot",
  "Pinterest — bientot",
];

const MONTHLY_EDITORIAL_SKELETON = [
  {
    week: "Semaine 1",
    posts: [
      "Post decouverte Norixo",
      "Post probleme client",
      "Reel court",
    ],
  },
  {
    week: "Semaine 2",
    posts: [
      "Post benefice",
      "Post preuve / exemple",
      "Post CTA audit",
    ],
  },
  {
    week: "Semaine 3",
    posts: [
      "Post educatif",
      "Reel demonstration",
      "Post objection client",
    ],
  },
  {
    week: "Semaine 4",
    posts: [
      "Post recapitulatif",
      "Post communaute",
      "Post conversion",
    ],
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
};

function SectionCard({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6">
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

function Field({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
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
}: {
  values: string[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <span
          key={value}
          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
        >
          {value}
        </span>
      ))}
    </div>
  );
}

function PublisherChannelCard({
  platform,
  channel,
}: {
  platform: string;
  channel: NonNullable<MarketingCampaignBundle["publisher"]>["channels"]["facebook"];
}) {
  return (
    <SectionCard title={platform} eyebrow="Publisher Draft">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Statut" value={channel.status} />
        <Field label="Action" value={channel.publishAction} />
      </div>

      <div className="mt-4 space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Texte / caption
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
    </SectionCard>
  );
}

function groupMonthlyPlanning(
  planning: MarketingCampaignBundle["planning"],
) {
  return MONTHLY_EDITORIAL_SKELETON.map((week, index) => {
    const startDay = index * 7 + 1;
    const endDay = startDay + 6;
    const plannedItems =
      planning?.items
        .filter((item) => item.day >= startDay && item.day <= endDay)
        .map((item) => `${item.channel} · ${item.format} · ${item.topic}`) ?? [];

    return {
      week: week.week,
      posts: plannedItems.length > 0 ? plannedItems : [...week.posts],
    };
  });
}

export default function MarketingStudioPage() {
  const [form, setForm] = useState<CampaignFormState>(DEFAULT_FORM);
  const [submittedForm, setSubmittedForm] = useState<CampaignFormState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MarketingStudioOrchestratorV2Result | null>(
    null,
  );

  const activeChannels = useMemo(
    () =>
      ACTIVE_CHANNELS.filter((channel) => form.channels?.includes(channel)),
    [form.channels],
  );

  const bundle = result?.bundle;
  const approval = bundle?.approval;
  const publisher = bundle?.publisher;
  const campaign = bundle?.campaign;
  const monthlyPlanning = groupMonthlyPlanning(bundle?.planning);
  const localizationEntries = Object.entries(bundle?.localization ?? {});
  const visiblePublisherCards = publisher
    ? activeChannels.map((channel) => ({
        key: channel,
        label:
          channel === "facebook"
            ? "Facebook"
            : channel === "instagram"
            ? "Instagram"
            : "LinkedIn",
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
      <div className="space-y-8">
        <SectionCard
          eyebrow="Marketing Studio V2"
          title="Nouvelle campagne marketing"
        >
          <p className="max-w-3xl text-sm leading-6 text-slate-600">
            Preparez une campagne mensuelle complete en brouillon uniquement.
            Aucune publication, aucune base de donnees, aucune automatisation.
          </p>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">
                Nom de la campagne
              </span>
              <input
                value={form.name ?? ""}
                onChange={(event) => updateField("name", event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">
                Audience cible
              </span>
              <input
                value={form.audience ?? ""}
                onChange={(event) => updateField("audience", event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
              />
            </label>

            <label className="block lg:col-span-2">
              <span className="text-sm font-semibold text-slate-700">
                Objectif
              </span>
              <textarea
                rows={4}
                value={form.objective}
                onChange={(event) => updateField("objective", event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">
                Pays / marche cible
              </span>
              <input
                value={form.targetMarket}
                onChange={(event) =>
                  updateField("targetMarket", event.target.value)
                }
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">
                Langue principale
              </span>
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
              <span className="text-sm font-semibold text-slate-700">
                Ton de communication
              </span>
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
              <span className="text-sm font-semibold text-slate-700">
                CTA principal
              </span>
              <input
                value={form.cta ?? ""}
                onChange={(event) => updateField("cta", event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">
                Duree de campagne
              </span>
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

        <SectionCard eyebrow="Canaux" title="Selection des canaux">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              {ACTIVE_CHANNELS.map((channel) => (
                <label
                  key={channel}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800"
                >
                  <input
                    type="checkbox"
                    checked={form.channels?.includes(channel) ?? false}
                    onChange={() => toggleChannel(channel)}
                  />
                  {channel === "facebook"
                    ? "Facebook"
                    : channel === "instagram"
                    ? "Instagram"
                    : "LinkedIn"}
                </label>
              ))}
            </div>

            <div className="space-y-3">
              {UPCOMING_CHANNELS.map((channel) => (
                <label
                  key={channel}
                  className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-400"
                >
                  <input type="checkbox" disabled />
                  {channel}
                </label>
              ))}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Calendrier editorial"
          title="Calendrier editorial - 1 mois"
        >
          <div className="grid gap-4 xl:grid-cols-4">
            {MONTHLY_EDITORIAL_SKELETON.map((week) => (
              <div
                key={week.week}
                className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
              >
                <h3 className="text-base font-semibold text-slate-950">
                  {week.week}
                </h3>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
                  {week.posts.map((post) => (
                    <li key={`${week.week}-${post}`}>- {post}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Securite publication"
          title="Controles obligatoires"
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Mode" value="brouillon uniquement" />
            <Field label="Publication automatique" value="desactivee" />
            <Field label="Validation humaine" value="obligatoire" />
            <Field label="Approbateur" value="Mohamed" />
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {loading ? "Generation..." : "Generer la campagne marketing"}
            </button>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
              Execution manuelle uniquement
            </span>
          </div>

          {error ? (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
        </SectionCard>

        {bundle && submittedForm ? (
          <div className="space-y-8">
            <SectionCard eyebrow="Resume campagne" title="Campagne generee">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Nom" value={campaign?.name ?? submittedForm.name ?? "-"} />
                <Field label="Objectif" value={submittedForm.objective} />
                <Field label="Audience" value={submittedForm.audience ?? "-"} />
                <Field label="Marche" value={submittedForm.targetMarket} />
                <Field label="Langue principale" value={submittedForm.language ?? "fr"} />
                <Field label="Duree" value={submittedForm.durationLabel} />
                <Field
                  label="Canaux selectionnes"
                  value={(submittedForm.channels ?? []).join(", ")}
                />
                <Field label="CTA" value={submittedForm.cta ?? "-"} />
              </div>
            </SectionCard>

            <SectionCard eyebrow="Planning mensuel" title="Lecture du mois">
              <div className="grid gap-4 xl:grid-cols-4">
                {monthlyPlanning.map((week) => (
                  <div
                    key={week.week}
                    className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                  >
                    <h3 className="text-base font-semibold text-slate-950">
                      {week.week}
                    </h3>
                    <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
                      {week.posts.map((post) => (
                        <li key={`${week.week}-${post}`}>- {post}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </SectionCard>

            {bundle.social ? (
              <SectionCard eyebrow="Social" title="Brouillon social">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Titre" value={bundle.social.title} />
                  <Field label="Plateforme cible" value={bundle.social.targetPlatform} />
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Caption
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {bundle.social.caption}
                  </p>
                </div>

                <div className="mt-4">
                  <BadgeList values={bundle.social.hashtags.map((tag) => tag.trim())} />
                </div>
              </SectionCard>
            ) : null}

            {bundle.creative ? (
              <SectionCard eyebrow="Creative" title="Direction creative">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Concept creatif" value={bundle.creative.creativeConcept} />
                  <Field label="Style visuel" value={bundle.creative.visualStyle} />
                  <Field label="Layout" value={bundle.creative.layout} />
                  <Field
                    label="Overlays"
                    value={bundle.creative.overlays.join(" | ")}
                  />
                </div>

                <div className="mt-4 space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Image prompt
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {bundle.creative.imagePrompt}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Negative prompt
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {bundle.creative.negativePrompt}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Video prompt
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {bundle.creative.videoPrompt}
                    </p>
                  </div>

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

            {bundle.video ? (
              <SectionCard eyebrow="Video" title="Plan video">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Storyboard" value={bundle.video.storyboard} />
                  <Field label="Script" value={bundle.video.script} />
                  <Field label="Timeline" value={bundle.video.timeline} />
                  <Field label="Voice" value={bundle.video.voice} />
                  <Field
                    label="Transitions"
                    value={bundle.video.transitions.join(" | ")}
                  />
                  <Field label="Captions" value={bundle.video.captions} />
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Scenes
                  </p>
                  <div className="mt-3 space-y-3">
                    {bundle.video.scenes.map((scene) => (
                      <div
                        key={`scene-${scene.scene}`}
                        className="rounded-2xl border border-slate-200 bg-white p-4"
                      >
                        <p className="text-sm font-semibold text-slate-950">
                          Scene {scene.scene} · {scene.duration}
                        </p>
                        <p className="mt-2 text-sm text-slate-700">
                          {scene.visual}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {scene.onScreenText}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Video prompt
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {bundle.video.videoPrompt}
                  </p>
                </div>
              </SectionCard>
            ) : null}

            {bundle.localization ? (
              <SectionCard eyebrow="Localization" title="11 langues preparees">
                <div className="flex flex-wrap gap-2">
                  {localizationEntries.map(([language]) => (
                    <span
                      key={language}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase text-slate-700"
                    >
                      {language}
                    </span>
                  ))}
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  {localizationEntries.map(([language, localization]) => (
                    <div
                      key={`localization-${language}`}
                      className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
                    >
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

            {bundle.communityDiscovery ? (
              <SectionCard
                eyebrow="Community Discovery"
                title="Communautes suggerees"
              >
                <div className="space-y-4">
                  {bundle.communityDiscovery.communities.map((community) => (
                    <div
                      key={community.id}
                      className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                    >
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                        <Field label="Communaute" value={community.name} />
                        <Field label="Pays" value={community.country} />
                        <Field label="Plateforme" value={community.platform} />
                        <Field label="Audience" value={community.audience} />
                        <Field label="Pertinence" value={community.relevance} />
                      </div>
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Raison
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-700">
                          {community.recommendationReason}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            ) : null}

            <SectionCard eyebrow="Review + Approval" title="Validation humaine">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Review summary" value={bundle.review?.summary ?? "-"} />
                <Field label="Approval status" value={approval?.status ?? "-"} />
                <Field
                  label="Publisher ready"
                  value={String(approval?.publisherReady)}
                />
                <Field
                  label="Validation humaine"
                  value={approval?.requiresHumanValidation ? "obligatoire" : "non"}
                />
              </div>
            </SectionCard>

            {publisher ? (
              <SectionCard eyebrow="Publisher" title="Brouillons Publisher">
                <div className="grid gap-6 xl:grid-cols-3">
                  {visiblePublisherCards.map((publisherCard) => (
                    <PublisherChannelCard
                      key={publisherCard.key}
                      platform={publisherCard.label}
                      channel={publisherCard.value}
                    />
                  ))}
                </div>
              </SectionCard>
            ) : null}

            <section className="rounded-3xl border border-slate-200 bg-white p-6">
              <details>
                <summary className="cursor-pointer text-lg font-semibold text-slate-950">
                  Details techniques du bundle
                </summary>
                <pre className="mt-4 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                  {JSON.stringify(bundle, null, 2)}
                </pre>
              </details>
            </section>
          </div>
        ) : null}
      </div>
    </DashboardShell>
  );
}
