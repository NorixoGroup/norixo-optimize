"use client";

import { useState } from "react";
import { DashboardShell } from "@/components/DashboardShell";


function parseOutput(value: unknown): any {
  if (typeof value !== "string") return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}



function copyText(value: unknown) {
  if (typeof navigator === "undefined") return;
  const text =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);

  void navigator.clipboard.writeText(text);
}

function downloadText(filename: string, content: string) {
  if (typeof document === "undefined") return;

  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

function exportMarkdown(result: any) {
  const planner = parseOutput(result?.planner?.output);
  const social = parseOutput(result?.social?.output);
  const creative = parseOutput(result?.creative?.output);
  const video = parseOutput(result?.video?.output);

  return [
    "# Campagne Norixo",
    "",
    "## Planning éditorial",
    ...(planner?.items ?? []).map((item: any) => `- Jour ${item.day} — ${item.channel} / ${item.format}: ${item.topic}`),
    "",
    "## Post social",
    social?.caption ?? "",
    "",
    (social?.hashtags ?? []).join(" "),
    "",
    "## Direction visuelle",
    creative?.gptImagePrompt ?? "",
    "",
    "## Script vidéo",
    ...(video?.scenes ?? []).map((scene: any) => `### Scène ${scene.scene}\nVisuel: ${scene.visual}\nVoix: ${scene.voiceOver}\nTransition: ${scene.transition}`),
  ].join("\n");
}

function SectionTitle({ label, title }: { label: string; title: string }) {




  return (
    <div className="mb-5 flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          {label}
        </p>
        <h2 className="mt-1 text-xl font-semibold text-slate-950">{title}</h2>
      </div>
    </div>
  );
}

function renderPlanner(payload: any) {
  const parsed = parseOutput(payload?.output);
  const items = Array.isArray(parsed?.items) ? parsed.items : [];

  return (
    <section className="nk-card rounded-3xl border border-slate-200 bg-white p-6">
      <SectionTitle label="Planning" title={parsed?.campaign ?? "Planning éditorial"} />

      <div className="overflow-hidden rounded-3xl border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-[0.16em] text-slate-500">
            <tr>
              <th className="px-4 py-3">Jour</th>
              <th className="px-4 py-3">Canal</th>
              <th className="px-4 py-3">Format</th>
              <th className="px-4 py-3">Sujet</th>
              <th className="px-4 py-3">CTA</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item: any, index: number) => (
              <tr key={index} className="bg-white">
                <td className="px-4 py-3 font-semibold text-slate-900">Jour {item.day}</td>
                <td className="px-4 py-3 text-slate-700">{item.channel}</td>
                <td className="px-4 py-3 text-slate-700">{item.format}</td>
                <td className="px-4 py-3 text-slate-700">{item.topic}</td>
                <td className="px-4 py-3 text-slate-700">{item.cta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function renderSocial(payload: any) {
  const parsed = parseOutput(payload?.output);

  return (
    <section className="nk-card rounded-3xl border border-slate-200 bg-white p-6">
      <SectionTitle label="Social" title={parsed?.title ?? "Post social"} />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Hook</p>
          <p className="mt-2 text-base font-semibold text-slate-950">{parsed?.hook}</p>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">CTA</p>
          <p className="mt-2 text-base font-semibold text-slate-950">{parsed?.cta}</p>
        </div>

        <div className="lg:col-span-2 rounded-3xl border border-slate-100 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Caption</p>
            <button onClick={() => copyText(parsed?.caption)} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
              Copier
            </button>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{parsed?.caption}</p>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Hashtags</p>
            <button onClick={() => copyText((parsed?.hashtags ?? []).join(" "))} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
              Copier
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(parsed?.hashtags ?? []).map((tag: string, index: number) => (
              <span key={index} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                {tag.trim()}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Publication</p>
          <p className="mt-2 text-sm text-slate-700">{parsed?.targetPlatform} · {parsed?.recommendedPublishTime}</p>
        </div>

        <div className="lg:col-span-2 rounded-3xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Idée visuelle</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{parsed?.imageIdea}</p>
        </div>

        <div className="lg:col-span-2 rounded-3xl border border-slate-100 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Prompt image</p>
            <button onClick={() => copyText(parsed?.imagePrompt)} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
              Copier
            </button>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-700">{parsed?.imagePrompt}</p>
        </div>

        <div className="lg:col-span-2 rounded-3xl border border-slate-100 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Prompt vidéo</p>
            <button onClick={() => copyText(parsed?.videoPrompt)} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
              Copier
            </button>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-700">{parsed?.videoPrompt}</p>
        </div>
      </div>
    </section>
  );
}

function renderCreative(payload: any) {
  const parsed = parseOutput(payload?.output);

  return (
    <section className="nk-card rounded-3xl border border-slate-200 bg-white p-6">
      <SectionTitle label="Créatif" title="Direction visuelle" />

      <div className="space-y-4">
        {["creativeConcept", "visualStyle", "layout", "mainTextOverlay", "secondaryTextOverlay"].map((key) => (
          <div key={key} className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{key}</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">{parsed?.[key]}</p>
          </div>
        ))}

        <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Prompt GPT Image</p>
            <button onClick={() => copyText(parsed?.gptImagePrompt)} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
              Copier
            </button>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-700">{parsed?.gptImagePrompt}</p>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Checklist marque</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(parsed?.brandChecklist ?? []).map((item: string, index: number) => (
              <span key={index} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function renderVideo(payload: any) {
  const parsed = parseOutput(payload?.output);
  const scenes = Array.isArray(parsed?.scenes) ? parsed.scenes : [];

  return (
    <section className="nk-card rounded-3xl border border-slate-200 bg-white p-6">
      <SectionTitle label="Vidéo" title={parsed?.videoTitle ?? "Script vidéo"} />

      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Durée</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">{parsed?.duration}</p>
        </div>
        <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Format</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">{parsed?.format}</p>
        </div>
        <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">CTA</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">{parsed?.cta}</p>
        </div>
      </div>

      <div className="space-y-4">
        {scenes.map((scene: any, index: number) => (
          <div key={index} className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-950">Scène {scene.scene} · {scene.duration}</p>
              <button onClick={() => copyText(scene)} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                Copier
              </button>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-700"><span className="font-semibold">Visuel :</span> {scene.visual}</p>
            <p className="mt-2 text-sm leading-6 text-slate-700"><span className="font-semibold">Texte écran :</span> {scene.onScreenText}</p>
            <p className="mt-2 text-sm leading-6 text-slate-700"><span className="font-semibold">Voix off :</span> {scene.voiceOver}</p>
            <p className="mt-2 text-sm leading-6 text-slate-700"><span className="font-semibold">Transition :</span> {scene.transition}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-3xl border border-slate-100 bg-slate-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Voix off complète</p>
          <button onClick={() => copyText(parsed?.voiceOver)} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
            Copier
          </button>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-700">{parsed?.voiceOver}</p>
      </div>
    </section>
  );
}

export default function MarketingStudioPage() {
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  async function handleGenerate() {
    setLoading(true);

    try {
      const response = await fetch("/api/admin/marketing-studio/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          objective:
            "Faire découvrir Norixo Optimize aux conciergeries et aux hôtes professionnels.",
          language: "fr",
          timeframe: "7 jours",
          channels: ["Instagram", "Facebook", "LinkedIn", "SEO"],
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Campaign generation failed.");
      }

      setResult(data.result);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegenerate(target: "planner" | "social" | "creative" | "video") {
    setRegenerating(target);

    try {
      const response = await fetch("/api/admin/marketing-studio/regenerate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ target }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Regeneration failed.");
      }

      setResult((current: any) => ({
        ...current,
        [target]: data.result,
      }));
    } finally {
      setRegenerating(null);
    }
  }
  return (
    <DashboardShell>
      <div className="space-y-8">

        <div>
          <h1 className="text-3xl font-bold">Marketing Studio</h1>
          <p className="mt-2 text-slate-600">
            Créez une campagne marketing complète pour Norixo.io avant validation et publication.
          </p>
        </div>

        <section className="nk-card rounded-3xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold">
            Objectif de la campagne
          </h2>

          <textarea
            rows={5}
            className="mt-4 w-full rounded-xl border border-slate-300 p-4"
            defaultValue="Faire découvrir Norixo Optimize aux conciergeries et aux hôtes professionnels."
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-2">

          <div className="nk-card rounded-3xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold">Canaux</h2>

            <div className="mt-5 space-y-3">
              <label className="block"><input type="checkbox" defaultChecked /> Instagram</label>
              <label className="block"><input type="checkbox" defaultChecked /> Facebook</label>
              <label className="block"><input type="checkbox" defaultChecked /> LinkedIn</label>
              <label className="block"><input type="checkbox" defaultChecked /> SEO</label>
            </div>
          </div>

          <div className="nk-card rounded-3xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold">Durée</h2>

            <div className="mt-5 space-y-3">
              <label className="block"><input type="radio" name="duration" defaultChecked /> 7 jours</label>
              <label className="block"><input type="radio" name="duration" /> 14 jours</label>
              <label className="block"><input type="radio" name="duration" /> 30 jours</label>
            </div>
          </div>

        </section>

        <section className="nk-card rounded-3xl border border-slate-200 bg-white p-6">

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white"
          >
            {loading ? "Génération..." : "Générer une campagne"}
          </button>

        </section>

        <section className="nk-card rounded-3xl border border-slate-200 bg-white p-6">

          <h2 className="text-lg font-semibold">
            Pipeline prévu
          </h2>

          <pre className="mt-4 whitespace-pre-wrap text-sm text-slate-600">
{`Marketing Manager
↓
Content Planner
↓
Social Content
↓
Creative Director
↓
Video Script
↓
Validation
↓
Brouillons prêts à publier

Aucune publication automatique ne sera effectuée sans validation humaine.`}
          </pre>

        </section>

      
        {result && (
          <div className="space-y-6">
            <section className="nk-card rounded-3xl border border-slate-200 bg-white p-6">
              <h2 className="text-xl font-semibold text-slate-950">
                Campagne générée
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Contenus préparés par le Marketing Studio. À contrôler avant publication.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <button onClick={() => copyText(result)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                  Copier JSON
                </button>
                <button onClick={() => downloadText("norixo-campaign.json", JSON.stringify(result ?? {}, null, 2))} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                  Export JSON
                </button>
                <button onClick={() => downloadText("norixo-campaign.md", exportMarkdown(result ?? {}))} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                  Export Markdown
                </button>
                <button disabled className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-400">
                  Sauvegarder bientôt
                </button>
              </div>
            </section>

            <div className="flex flex-wrap gap-3">
              <button onClick={() => handleRegenerate("planner")} disabled={regenerating !== null} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                {regenerating === "planner" ? "Régénération..." : "Régénérer planning"}
              </button>
              <button onClick={() => handleRegenerate("social")} disabled={regenerating !== null} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                {regenerating === "social" ? "Régénération..." : "Régénérer post"}
              </button>
              <button onClick={() => handleRegenerate("creative")} disabled={regenerating !== null} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                {regenerating === "creative" ? "Régénération..." : "Régénérer visuel"}
              </button>
              <button onClick={() => handleRegenerate("video")} disabled={regenerating !== null} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                {regenerating === "video" ? "Régénération..." : "Régénérer vidéo"}
              </button>
            </div>

            {renderPlanner(result.planner)}
            {renderSocial(result.social)}
            {renderCreative(result.creative)}
            {renderVideo(result.video)}
          </div>
        )}
</div>
    </DashboardShell>
  );
}
