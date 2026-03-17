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
  const [workspaces, setWorkspaces] = useState<UserWorkspace[]>([]);
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

        setWorkspaces(all);

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
        <p className="nk-section-title">Team</p>
        <p className="mt-2 text-[13px] text-slate-700">Loading workspace team…</p>
      </div>
    );
  }

  if (!userId || !currentWorkspace) {
    return (
      <div className="nk-card nk-card-hover p-6">
        <p className="nk-section-title">Team</p>
        <p className="mt-2 text-[13px] text-slate-700">
          Team invitations are available once real authentication and workspaces are wired.
        </p>
      </div>
    );
  }

  const canManage =
    currentWorkspace.role === "owner" || currentWorkspace.role === "admin";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!currentWorkspace || !userId) {
      setStatus("Workspace context is not available.");
      return;
    }

    if (!canManage) {
      setStatus("Only workspace owners and admins can invite teammates.");
      return;
    }

    if (!inviteEmail) {
      setStatus("Please enter an email address.");
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

      setStatus("Invitation created. Share the link below with your teammate.");
      setLastInviteUrl(url);
      setInviteEmail("");
      setInviteRole("member");
    } catch (e) {
      console.warn("WorkspaceTeamSection invite error", e);
      setStatus("Failed to create invitation. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="nk-card nk-card-hover p-6">
      <p className="nk-section-title">Team</p>
      <h2 className="mt-2 text-base font-semibold text-slate-900">Invite teammates</h2>
      <p className="mt-2 text-[13px] leading-6 text-slate-700">
        Invite collaborators to the current workspace so they can see listings, run audits and
        manage settings. Only owners and admins can send invitations.
      </p>

      <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-[11px] text-slate-600">
        <p className="font-medium text-slate-900">Current workspace</p>
        <p className="mt-1 text-[13px] text-slate-800">{currentWorkspace.name}</p>
        <p className="mt-1 text-[11px] text-slate-500">
          Your role: <span className="font-semibold text-slate-900">{currentWorkspace.role}</span>
        </p>
      </div>

      {!canManage ? (
        <p className="mt-4 text-[12px] text-slate-600">
          You are a member in this workspace. Only owners and admins can invite new teammates.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3 text-[13px]">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Teammate email
            </label>
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="teammate@example.com"
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-emerald-400"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Role
            </label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as InvitationRole)}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 outline-none focus:border-emerald-400"
            >
              <option value="member">Member – can run audits</option>
              <option value="admin">Admin – can manage workspace</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center rounded-md bg-emerald-500 px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.18em] text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-60"
          >
            {submitting ? "Sending…" : "Send invite"}
          </button>

          {status && <p className="text-[12px] text-slate-600">{status}</p>}

          {lastInviteUrl && (
            <div className="mt-2 space-y-1 text-[11px] text-slate-600">
              <p className="font-semibold text-slate-900">Test invitation link</p>
              <p className="break-all rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-800">
                {lastInviteUrl}
              </p>
              <p className="text-[11px] text-slate-500">
                In production this would be emailed. For now, open it in a new session to
                accept the invite.
              </p>
            </div>
          )}
        </form>
      )}

      {userEmail && (
        <p className="mt-4 text-[11px] text-slate-500">
          Signed in as <span className="font-medium text-slate-900">{userEmail}</span>
        </p>
      )}
    </div>
  );
}
