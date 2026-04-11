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

    // Trigger a refresh so server components can pick up the new selection logic
    router.refresh();
  }

  return (
    <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 md:inline-flex">
      <span className="uppercase tracking-[0.18em] text-slate-500">Workspace</span>
      <select
        value={current.id}
        onChange={handleChange}
        className="ml-2 bg-transparent text-[12px] font-semibold text-slate-800 outline-none"
      >
        {workspaces.map((ws) => (
          <option key={ws.id} value={ws.id} className="bg-white text-slate-800">
            {ws.name}
          </option>
        ))}
      </select>
    </div>
  );
}
