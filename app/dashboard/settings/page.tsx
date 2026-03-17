"use client";

import { useEffect, useMemo, useState } from "react";
import { WorkspaceTeamSection } from "@/components/WorkspaceTeamSection";
import { supabase } from "@/lib/supabase";
import { getCurrentWorkspace } from "@/lib/workspaces/getCurrentWorkspace";

type WorkspaceData = {
  id: string;
  name: string;
  slug: string | null;
  owner_user_id: string;
  created_at: string;
  updated_at: string;
} | null;

export default function SettingsPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceData>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadSettingsData() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!mounted) return;

        if (!user) {
          setEmail(null);
          setWorkspace(null);
          setLoading(false);
          return;
        }

        setEmail(user.email ?? null);

        const currentWorkspace = await getCurrentWorkspace(user.id);

        if (!mounted) return;

        setWorkspace(currentWorkspace);
      } catch (error) {
        console.warn("Failed to load settings data", error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadSettingsData();

    return () => {
      mounted = false;
    };
  }, []);

  const workspaceName = workspace?.name ?? "No workspace";
  const workspaceSlug = workspace?.slug ?? "—";
  const workspaceIdShort = workspace?.id ? workspace.id.slice(0, 12) : "—";
  const displayEmail = email ?? "No authenticated user";
  const roleLabel = workspace ? "Workspace owner" : "Not connected";

  const ownerInfo = useMemo(() => {
    if (!workspace?.owner_user_id) return "—";
    return workspace.owner_user_id.slice(0, 12);
  }, [workspace?.owner_user_id]);

  return (
    <div className="space-y-8 text-sm">
      <div className="nk-card nk-card-hover nk-page-header-card px-6 py-7 md:px-8">
        <div className="max-w-3xl space-y-3">
          <p className="nk-kicker-muted">Workspace</p>
          <h1 className="nk-heading-xl text-2xl font-semibold text-slate-900 md:text-3xl lg:text-4xl">
            Workspace settings
          </h1>
          <p className="nk-body-muted text-[15px] leading-relaxed text-slate-700">
            Manage your workspace configuration, integrations and technical environment before
            plugging in Supabase, Stripe, OpenAI and Bright Data.
          </p>
        </div>
      </div>

      <div className="nk-card nk-card-hover p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="nk-section-title">Workspace profile</p>
            <h2 className="mt-2 text-base font-semibold text-slate-900 md:text-lg">
              Identity and owner information
            </h2>
            <p className="mt-2 max-w-xl text-[13px] leading-6 text-slate-700">
              This is the workspace used to run listing audits, store results and connect your
              integrations.
            </p>
          </div>

          <div className="mt-2 flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[11px] text-slate-700 md:mt-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-900">
                {loading ? "Loading workspace..." : workspaceName}
              </span>
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                {workspace ? "Active" : "Pending"}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-xs text-slate-500">Workspace ID</span>
              <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-[11px] text-slate-50">
                {workspaceIdShort}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-xs text-slate-500">Slug</span>
              <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-[11px] text-slate-50">
                {workspaceSlug}
              </span>
            </div>

            <p className="text-xs text-slate-500">
              Owner ID: <span className="font-medium text-slate-800">{ownerInfo}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)]">
        <div className="nk-card nk-card-hover p-6">
          <p className="nk-section-title">Account</p>
          <h2 className="mt-2 text-base font-semibold text-slate-900">User identity</h2>
          <p className="mt-2 text-[13px] leading-6 text-slate-700">
            This section now reflects the authenticated user instead of a hardcoded demo account.
          </p>

          <div className="mt-4 space-y-3 text-[13px]">
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Email
                </p>
                <p className="mt-1 font-medium text-slate-900">
                  {loading ? "Loading..." : displayEmail}
                </p>
              </div>
              <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-slate-50">
                {roleLabel}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Role
                </p>
                <p className="mt-1 font-medium text-slate-900">
                  {workspace ? "Owner" : "—"}
                </p>
              </div>
              <p className="text-[11px] text-slate-500">
                Authenticated user identity pulled from Supabase Auth.
              </p>
            </div>
          </div>
        </div>

        <WorkspaceTeamSection />
      </div>

      <div className="nk-card nk-card-hover p-6">
        <p className="nk-section-title">Integrations</p>
        <h2 className="mt-2 text-base font-semibold text-slate-900">Connect your stack</h2>
        <p className="mt-2 text-[13px] leading-6 text-slate-700">
          These integrations are currently mocked. Once wired, this section becomes the place
          where you review connection status and rotate keys.
        </p>

        <ul className="mt-4 space-y-3 text-[13px] text-slate-900">
          <li className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
            <div>
              <p className="font-medium text-slate-900">Supabase</p>
              <p className="text-[11px] text-slate-600">Project URL &amp; anon key</p>
            </div>
            <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
              To configure
            </span>
          </li>
          <li className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
            <div>
              <p className="font-medium text-slate-900">Stripe</p>
              <p className="text-[11px] text-slate-600">Publishable &amp; secret keys</p>
            </div>
            <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
              To configure
            </span>
          </li>
          <li className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
            <div>
              <p className="font-medium text-slate-900">OpenAI</p>
              <p className="text-[11px] text-slate-600">API key</p>
            </div>
            <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
              To configure
            </span>
          </li>
          <li className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
            <div>
              <p className="font-medium text-slate-900">Bright Data</p>
              <p className="text-[11px] text-slate-600">Scraping / browser API access</p>
            </div>
            <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
              To configure
            </span>
          </li>
        </ul>

        <p className="mt-5 text-[12px] leading-6 text-slate-600">
          Remplace les placeholders du fichier
          <span className="mx-1 rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[11px] text-slate-50">
            .env.local
          </span>
          puis branche les vrais clients dans les dossiers
          <span className="mx-1 rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[11px] text-slate-50">
            auth
          </span>
          ,
          <span className="mx-1 rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[11px] text-slate-50">
            stripe
          </span>
          et
          <span className="ml-1 rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[11px] text-slate-50">
            ai
          </span>
          .
        </p>
      </div>

      <div className="nk-card nk-card-hover p-6">
        <p className="nk-section-title">Preferences &amp; configuration</p>
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Language
            </p>
            <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[13px] font-medium text-slate-900">
              French (mock)
            </p>
            <p className="text-[11px] text-slate-500">
              Géré côté produit pour l’instant. Les préférences seront stockées côté API.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Currency
            </p>
            <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[13px] font-medium text-slate-900">
              EUR (mock)
            </p>
            <p className="text-[11px] text-slate-500">
              Utilisée pour l’affichage des estimations de revenus dans les audits.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Notifications
            </p>
            <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[13px] font-medium text-slate-900">
              Résumés d’audit par email (mock)
            </p>
            <p className="text-[11px] text-slate-500">
              Future option pour choisir quels événements déclenchent un email.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}