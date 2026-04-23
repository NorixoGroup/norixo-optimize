"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { listUserWorkspaces, type UserWorkspace } from "@/lib/workspaces/listUserWorkspaces";
import { getStoredWorkspaceId } from "@/lib/workspaces/getStoredWorkspaceId";
import { setStoredWorkspaceId } from "@/lib/workspaces/setStoredWorkspaceId";

export function WorkspaceSwitcher() {
  const [workspaces, setWorkspaces] = useState<UserWorkspace[] | null>(null);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);

      try {
        const { data, error } = await supabase.auth.getUser();

        if (!active) return;

        if (error || !data?.user) {
          setWorkspaces([]);
          setCurrentWorkspaceId(null);
          setLoading(false);
          return;
        }

        const user = data.user;
        const all = await listUserWorkspaces(user.id, supabase);

        if (!active) return;

        if (!all.length) {
          setWorkspaces([]);
          setCurrentWorkspaceId(null);
          setLoading(false);
          return;
        }

        const storedId = getStoredWorkspaceId();
        const stored = storedId ? all.find((w) => w.id === storedId) : undefined;
        const effective = stored ?? all[0];

        if (!stored) {
          setStoredWorkspaceId(effective.id);
        }

        setWorkspaces(all);
        setCurrentWorkspaceId(effective.id);
      } catch (e) {
        console.warn("WorkspaceSwitcher load error", e);
        if (active) {
          setWorkspaces([]);
          setCurrentWorkspaceId(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  if (loading) return null;
  if (!workspaces || workspaces.length <= 1 || !currentWorkspaceId) return null;

  const current =
    workspaces.find((w) => w.id === currentWorkspaceId) ?? workspaces[0] ?? null;

  if (!current) return null;

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextId = event.target.value;
    if (!nextId || nextId === currentWorkspaceId) return;

    setCurrentWorkspaceId(nextId);
    setStoredWorkspaceId(nextId);
    window.dispatchEvent(new CustomEvent("norixo:active-workspace-changed"));

    // Trigger a refresh so server components can pick up the new selection logic
    router.refresh();
  }

  return (
    <div className="relative hidden h-9 w-9 shrink-0 items-center justify-center md:inline-flex">
      <select
        aria-label="Changer d’espace de travail"
        value={current.id}
        onChange={handleChange}
        className="absolute inset-0 z-10 h-full w-full cursor-pointer appearance-none border-0 bg-transparent p-0 opacity-0"
      >
        {workspaces.map((ws) => (
          <option key={ws.id} value={ws.id} className="bg-white text-slate-800">
            {ws.name}
          </option>
        ))}
      </select>
      <span
        className="pointer-events-none flex h-full w-full items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm"
        aria-hidden
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m7 15 5 5 5-5" />
          <path d="m7 9 5-5 5 5" />
        </svg>
      </span>
    </div>
  );
}
