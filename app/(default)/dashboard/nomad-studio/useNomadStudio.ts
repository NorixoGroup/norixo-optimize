"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { getSharedSession } from "@/lib/supabase/sharedAuth";
import type { OverviewResponse } from "@/lib/youtube-agent/types";

import { COPY } from "./copy";

const API_BASE = "/api/admin/youtube-agent";

// Garde admin côté client (la vraie garde est dans la route API) et chargement
// de la vue d'ensemble. Aucune logique métier.
export function useNomadStudio() {
  const router = useRouter();
  const [granted, setGranted] = useState(false);
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTechnical, setShowTechnicalState] = useState(false);
  const tokenRef = useRef<string | null>(null);

  const load = useCallback(async (withTechnical: boolean) => {
    if (!tokenRef.current) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/overview${withTechnical ? "?include_tests=1" : ""}`, {
        headers: { Authorization: `Bearer ${tokenRef.current}` },
        cache: "no-store",
      });

      if (!res.ok) throw new Error(res.status === 401 || res.status === 403 ? COPY.errors.denied : COPY.errors.server);

      setOverview((await res.json()) as OverviewResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : COPY.errors.unexpected);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function boot() {
      try {
        const { data } = await getSharedSession();
        const token = data.session?.access_token;

        if (!token) {
          router.replace("/dashboard");
          return;
        }

        const res = await fetch("/api/admin/me", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        const body = res.ok ? await res.json() : null;

        if (!active) return;

        if (!body?.isAdminPrivate) {
          router.replace("/dashboard");
          return;
        }

        tokenRef.current = token;
        setGranted(true);
        void load(false);
      } catch {
        if (active) router.replace("/dashboard");
      }
    }

    void boot();

    return () => {
      active = false;
    };
  }, [load, router]);

  const setShowTechnical = useCallback(
    (value: boolean) => {
      setShowTechnicalState(value);
      void load(value);
    },
    [load],
  );

  // Connexion Google : l'agent construit l'URL, le navigateur y est envoyé tel quel.
  const connectGoogle = useCallback(async () => {
    if (!tokenRef.current) return;

    setError(null);

    try {
      const res = await fetch(`${API_BASE}/youtube_login`, {
        headers: { Authorization: `Bearer ${tokenRef.current}` },
        cache: "no-store",
      });
      const body = res.ok ? ((await res.json()) as { result?: { ok: boolean; data?: { authorizeUrl?: string } } }) : null;
      const url = body?.result?.ok ? body.result.data?.authorizeUrl : undefined;

      if (!url) throw new Error(COPY.settings.googleFailed);

      window.location.assign(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : COPY.errors.unexpected);
    }
  }, []);

  return { granted, overview, loading, error, showTechnical, setShowTechnical, reload: () => load(showTechnical), connectGoogle };
}
