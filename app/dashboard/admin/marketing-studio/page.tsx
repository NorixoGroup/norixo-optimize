"use client";

import { useState } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import type { MarketingCampaignBundle } from "@/lib/marketing-ai/bundle/marketingCampaignBundle";
import type {
  MarketingStudioOrchestratorV2Input,
  MarketingStudioOrchestratorV2Result,
} from "@/lib/marketing-ai/orchestrator/marketingStudioOrchestratorV2";

const DEFAULT_INPUT: MarketingStudioOrchestratorV2Input = {
  name: "Campagne test Marketing Studio V2",
  objective:
    "Faire découvrir Norixo Optimize aux conciergeries et aux hôtes professionnels.",
  audience: "Hôtes et conciergeries",
  language: "fr",
  channels: ["facebook", "instagram"],
};

type RunResponse = {
  ok: boolean;
  result?: MarketingStudioOrchestratorV2Result;
  error?: string;
};

function PrettyJson({
  title,
  value,
}: {
  title: string;
  value: unknown;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <pre className="mt-4 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
        {JSON.stringify(value, null, 2)}
      </pre>
    </section>
  );
}

function StatusPill({
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
      <p className="mt-2 text-sm font-semibold text-slate-950">{value}</p>
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
    <section className="rounded-3xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Publisher Draft
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">
            {platform}
          </h2>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase text-slate-700">
            {channel.status}
          </span>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase text-amber-700">
            {channel.publishAction}
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <StatusPill
          label="Approval Required"
          value={String(channel.approvalRequired)}
        />
        <StatusPill label="Platform" value={channel.platform} />
      </div>

      <div className="mt-5 space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Copy
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
            {channel.copy}
          </p>
        </div>

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
          <div className="mt-3 flex flex-wrap gap-2">
            {channel.hashtags.map((tag) => (
              <span
                key={`${platform}-${tag}`}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
              >
                {tag.trim()}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function MarketingStudioPage() {
  const [input, setInput] = useState(DEFAULT_INPUT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MarketingStudioOrchestratorV2Result | null>(
    null,
  );

  const bundle = result?.bundle;
  const approval = bundle?.approval;
  const publisher = bundle?.publisher;

  async function handleGenerate() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/marketing-studio/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });
      const data = (await response.json()) as RunResponse;

      if (!response.ok || !data.ok || !data.result) {
        throw new Error(data.error ?? "Campaign generation failed.");
      }

      setResult(data.result);
    } catch (caughtError) {
      setResult(null);
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
        <section className="rounded-3xl border border-slate-200 bg-white p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Marketing Studio V2
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">
            Lancement manuel et lecture du bundle
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            Cette page lance manuellement le pipeline V2 puis affiche le bundle
            complet en lecture seule. Aucune publication, aucune persistance et
            aucune automatisation ne sont actives.
          </p>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-950">
            Campagne test
          </h2>

          <div className="mt-5 grid gap-4">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">
                Nom
              </span>
              <input
                value={input.name ?? ""}
                onChange={(event) =>
                  setInput((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">
                Objectif
              </span>
              <textarea
                rows={4}
                value={input.objective}
                onChange={(event) =>
                  setInput((current) => ({
                    ...current,
                    objective: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
              />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {loading ? "Génération..." : "Générer une campagne test"}
            </button>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
              Exécution manuelle uniquement
            </span>
          </div>

          {error ? (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-950">
            Pipeline V2
          </h2>
          <pre className="mt-4 whitespace-pre-wrap rounded-2xl bg-slate-950 p-4 text-sm leading-7 text-slate-100">
{`Campaign
↓
Campaign Memory
↓
Planner
↓
Social
↓
Creative
↓
Video
↓
Localization
↓
Community Discovery
↓
Review
↓
Approval
↓
Publisher Draft`}
          </pre>
        </section>

        {bundle ? (
          <div className="space-y-8">
            <section className="rounded-3xl border border-slate-200 bg-white p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Bundle Security
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-950">
                    Contrôles manuels obligatoires
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase text-amber-700">
                    approval.status = {approval?.status ?? "missing"}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase text-slate-700">
                    publisher.mode = {publisher?.mode ?? "missing"}
                  </span>
                  <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold uppercase text-rose-700">
                    publisher.canPublish = {String(publisher?.canPublish)}
                  </span>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <StatusPill
                  label="Approval Status"
                  value={approval?.status ?? "missing"}
                />
                <StatusPill
                  label="Requires Human Validation"
                  value={String(approval?.requiresHumanValidation)}
                />
                <StatusPill
                  label="Publisher Ready"
                  value={String(approval?.publisherReady)}
                />
              </div>
            </section>

            <PrettyJson title="bundle.campaign" value={bundle.campaign} />
            <PrettyJson
              title="bundle.campaignMemory"
              value={bundle.campaignMemory ?? null}
            />
            <PrettyJson title="bundle.planning" value={bundle.planning ?? null} />
            <PrettyJson title="bundle.social" value={bundle.social ?? null} />
            <PrettyJson title="bundle.creative" value={bundle.creative ?? null} />
            <PrettyJson title="bundle.video" value={bundle.video ?? null} />
            <PrettyJson
              title="bundle.localization"
              value={bundle.localization ?? null}
            />
            <PrettyJson
              title="bundle.communityDiscovery"
              value={bundle.communityDiscovery ?? null}
            />
            <PrettyJson title="bundle.review" value={bundle.review ?? null} />
            <PrettyJson title="bundle.approval" value={bundle.approval ?? null} />

            {publisher ? (
              <div className="space-y-6">
                <PrettyJson title="bundle.publisher" value={publisher} />

                <div className="grid gap-6 xl:grid-cols-3">
                  <PublisherChannelCard
                    platform="Facebook"
                    channel={publisher.channels.facebook}
                  />
                  <PublisherChannelCard
                    platform="Instagram"
                    channel={publisher.channels.instagram}
                  />
                  <PublisherChannelCard
                    platform="LinkedIn"
                    channel={publisher.channels.linkedin}
                  />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </DashboardShell>
  );
}
