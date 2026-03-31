"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { listUserWorkspaces, type UserWorkspace } from "@/lib/workspaces/listUserWorkspaces";
import { getStoredWorkspaceId } from "@/lib/workspaces/getStoredWorkspaceId";
import { setStoredWorkspaceId } from "@/lib/workspaces/setStoredWorkspaceId";
import {
  createWorkspaceInvitation,
  type InvitationRole,
} from "@/lib/invitations/createWorkspaceInvitation";

export function WorkspaceTeamSection() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentWorkspace, setCurrentWorkspace] = useState<UserWorkspace | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<InvitationRole>("member");
  const [status, setStatus] = useState<string | null>(null);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setStatus(null);

      try {
        const { data, error } = await supabase.auth.getUser();

        if (!active) return;

        if (error || !data?.user) {
          setLoading(false);
          return;
        }

        const user = data.user;
        setUserEmail(user.email ?? null);
        setUserId(user.id);

        const all = await listUserWorkspaces(user.id, supabase);
        if (!active) return;

        if (!all.length) {
          setCurrentWorkspace(null);
          setLoading(false);
          return;
        }

        const storedId = getStoredWorkspaceId();
        const stored = storedId ? all.find((w) => w.id === storedId) : undefined;
        const effective = stored ?? all[0];

        if (!stored) {
          setStoredWorkspaceId(effective.id);
        }

        setCurrentWorkspace(effective);
      } catch (e) {
        console.warn("WorkspaceTeamSection load error", e);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="nk-card nk-card-hover p-6">
        <p className="nk-section-title">Équipe</p>
        <p className="mt-2 text-[13px] text-slate-700">
          Chargement de l’équipe du workspace…
        </p>
      </div>
    );
  }

  if (!userId || !currentWorkspace) {
    return (
      <div className="nk-card nk-card-hover p-6">
        <p className="nk-section-title">Équipe</p>
        <p className="mt-2 text-[13px] text-slate-700">
          Les invitations d’équipe seront disponibles dès que l’authentification et le workspace
          actif seront correctement chargés.
        </p>
      </div>
    );
  }

  const canManage =
    currentWorkspace.role === "owner" || currentWorkspace.role === "admin";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!currentWorkspace || !userId) {
      setStatus("Le contexte du workspace est indisponible.");
      return;
    }

    if (!canManage) {
      setStatus("Seuls les owners et admins peuvent inviter des collaborateurs.");
      return;
    }

    if (!inviteEmail) {
      setStatus("Veuillez renseigner une adresse email.");
      return;
    }

    setSubmitting(true);
    setStatus(null);
    setLastInviteUrl(null);

    try {
      const result = await createWorkspaceInvitation({
        workspaceId: currentWorkspace.id,
        email: inviteEmail,
        role: inviteRole,
        invitedByUserId: userId,
      });

      const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
      const url = baseUrl ? `${baseUrl}/invite/${result.token}` : `/invite/${result.token}`;

      setStatus("Invitation créée. Partagez le lien ci-dessous avec votre collaborateur.");
      setLastInviteUrl(url);
      setInviteEmail("");
      setInviteRole("member");
    } catch (e) {
      console.warn("WorkspaceTeamSection invite error", e);
      setStatus("Impossible de créer l’invitation pour le moment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="nk-card nk-card-hover p-6">
      <p className="nk-section-title">Équipe</p>
      <h2 className="mt-2 text-base font-semibold text-slate-900">
        Inviter des collaborateurs
      </h2>
      <p className="mt-2 text-[13px] leading-6 text-slate-700">
        Invitez des collaborateurs dans le workspace actuel pour qu’ils puissent consulter les
        annonces, lancer des audits et gérer les paramètres. Seuls les owners et admins peuvent
        envoyer des invitations.
      </p>

      <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-[11px] text-slate-600">
        <p className="font-medium text-slate-900">Workspace actuel</p>
        <p className="mt-1 text-[13px] text-slate-800">{currentWorkspace.name}</p>
        <p className="mt-1 text-[11px] text-slate-500">
          Votre rôle : <span className="font-semibold text-slate-900">{currentWorkspace.role}</span>
        </p>
      </div>

      {!canManage ? (
        <p className="mt-4 text-[12px] text-slate-600">
          Vous êtes membre de ce workspace. Seuls les owners et admins peuvent inviter de nouveaux
          collaborateurs.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3 text-[13px]">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Email du collaborateur
            </label>
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="collegue@exemple.com"
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-emerald-400"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Rôle
            </label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as InvitationRole)}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 outline-none focus:border-emerald-400"
            >
              <option value="member">Membre – peut lancer des audits</option>
              <option value="admin">Admin – peut gérer le workspace</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center rounded-md bg-emerald-500 px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.18em] text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-60"
          >
            {submitting ? "Envoi..." : "Envoyer l’invitation"}
          </button>

          {status && <p className="text-[12px] text-slate-600">{status}</p>}

          {lastInviteUrl && (
            <div className="mt-2 space-y-1 text-[11px] text-slate-600">
              <p className="font-semibold text-slate-900">Lien d’invitation de test</p>
              <p className="break-all rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-800">
                {lastInviteUrl}
              </p>
              <p className="text-[11px] text-slate-500">
                En production, ce lien serait envoyé par email. Pour l’instant, ouvrez-le dans une
                autre session pour accepter l’invitation.
              </p>
            </div>
          )}
        </form>
      )}

      {userEmail && (
        <p className="mt-4 text-[11px] text-slate-500">
          Connecté en tant que <span className="font-medium text-slate-900">{userEmail}</span>
        </p>
      )}
    </div>
  );
}
