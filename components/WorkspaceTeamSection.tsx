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
      <div className="nk-card nk-card-hover rounded-2xl p-6 shadow-[0_14px_34px_rgba(15,23,42,0.08),0_1px_0_rgba(255,255,255,0.62)_inset] md:p-8">
        <p className="nk-section-title">Équipe &amp; accès</p>
        <p className="mt-3 text-[13px] leading-6 text-slate-600">
          Chargement de l’équipe du workspace…
        </p>
      </div>
    );
  }

  if (!userId || !currentWorkspace) {
    return (
      <div className="nk-card nk-card-hover rounded-2xl p-6 shadow-[0_14px_34px_rgba(15,23,42,0.08),0_1px_0_rgba(255,255,255,0.62)_inset] md:p-8">
        <p className="nk-section-title">Équipe &amp; accès</p>
        <p className="mt-3 text-[13px] leading-6 text-slate-600">
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
      setStatus("Seuls les propriétaires et administrateurs peuvent inviter des collaborateurs.");
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
    <div className="nk-card nk-card-hover rounded-2xl p-6 shadow-[0_14px_34px_rgba(15,23,42,0.08),0_1px_0_rgba(255,255,255,0.62)_inset] md:p-8">
      <div className="border-b border-slate-200/70 pb-5">
        <p className="nk-section-title">Équipe &amp; accès</p>
        <h2 className="mt-2 text-lg font-semibold text-slate-900">Inviter des collaborateurs</h2>
        <p className="mt-2 text-[13px] leading-6 text-slate-600">
          Invitez des collaborateurs dans le workspace actuel pour qu’ils puissent consulter les
          annonces, lancer des audits et gérer les paramètres. Seuls les propriétaires et
          administrateurs peuvent envoyer des invitations.
        </p>
      </div>

      <div className="nk-card-soft mt-6 rounded-2xl border border-slate-200/60 p-4 md:p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Workspace actuel
        </p>
        <p className="mt-2 text-base font-semibold text-slate-900">{currentWorkspace.name}</p>
        <p className="mt-2 text-xs text-slate-600">
          Votre rôle :{" "}
          <span className="font-semibold text-slate-900">{currentWorkspace.role}</span>
        </p>
      </div>

      {!canManage ? (
        <p className="mt-5 text-[13px] leading-6 text-slate-600">
          Vous êtes membre de ce workspace. Seuls les propriétaires et administrateurs peuvent
          inviter de nouveaux collaborateurs.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4 text-[13px]">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              E-mail du collaborateur
            </label>
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="collegue@exemple.com"
              className="nk-form-field w-full"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Rôle
            </label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as InvitationRole)}
              className="nk-form-select w-full"
            >
              <option value="member">Membre – peut lancer des audits</option>
              <option value="admin">Administrateur – peut gérer le workspace</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="nk-primary-btn px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] shadow-[0_14px_32px_rgba(15,23,42,0.18)] transition-all duration-200 hover:scale-[1.02] hover:brightness-105 disabled:pointer-events-none disabled:opacity-60"
          >
            {submitting ? "Envoi…" : "Envoyer l’invitation"}
          </button>

          {status && (
            <p className="text-[13px] leading-6 text-slate-700">{status}</p>
          )}

          {lastInviteUrl && (
            <div className="mt-2 space-y-2 rounded-2xl border border-slate-200/80 bg-slate-50/90 p-4 text-[11px] text-slate-600">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">
                Lien d’invitation de test
              </p>
              <p className="break-all rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 font-mono text-[11px] text-slate-800">
                {lastInviteUrl}
              </p>
              <p className="text-xs leading-relaxed text-slate-500">
                En production, ce lien serait envoyé par e-mail. Pour l’instant, ouvrez-le dans une
                autre session pour accepter l’invitation.
              </p>
            </div>
          )}
        </form>
      )}

      {userEmail && (
        <p className="mt-6 border-t border-slate-200/70 pt-5 text-xs text-slate-500">
          Connecté en tant que <span className="font-medium text-slate-800">{userEmail}</span>
        </p>
      )}
    </div>
  );
}
