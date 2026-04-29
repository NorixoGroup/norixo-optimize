"use client";

import { useEffect, useRef } from "react";

type AuditLaunchOverlayProps = {
  currentStep: string;
  /** Si défini, barre proportionnelle (ex. 100 % à la fin). Sinon barre « indéterminée » sans pourcentage trompeur. */
  progress?: number;
  steps: string[];
  stepIndex: number;
  /** Sous-texte factuel optionnel (heartbeat informationnel). */
  statusHint?: string;
  /** Verrou écran : actif uniquement pendant le chargement. */
  isAuditLoading?: boolean;
  /** Titre principal (ex. reprise après navigation). */
  leadTitle?: string;
  /** Sous-titre sous le titre. */
  leadSubtitle?: string;
  /** Note discrète (ex. navigation autorisée). */
  backgroundNote?: string;
};

export function AuditLaunchOverlay({
  currentStep,
  progress,
  steps,
  stepIndex,
  statusHint,
  isAuditLoading = true,
  leadTitle = "Audit en cours",
  leadSubtitle = "Merci de patienter pendant l’analyse.",
  backgroundNote = "⚡ Votre écran restera actif pendant l’analyse",
}: AuditLaunchOverlayProps) {
  const indeterminate = typeof progress !== "number";
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const isAuditLoadingRef = useRef(isAuditLoading);

  useEffect(() => {
    isAuditLoadingRef.current = isAuditLoading;
  }, [isAuditLoading]);

  useEffect(() => {
    if (typeof navigator === "undefined" || typeof navigator.wakeLock === "undefined") {
      return;
    }
    const wakeLockApi = navigator.wakeLock;

    async function acquireWakeLock() {
      if (!isAuditLoadingRef.current) return;
      try {
        try {
          await wakeLockRef.current?.release();
        } catch {
          /* déjà relâché ou indisponible */
        }
        wakeLockRef.current = null;
        wakeLockRef.current = await wakeLockApi.request("screen");
      } catch (err) {
        console.warn("Wake lock", err);
      }
    }

    function releaseWakeLock() {
      try {
        void wakeLockRef.current?.release();
        wakeLockRef.current = null;
      } catch {
        /* ignore */
      }
    }

    if (!isAuditLoading) {
      releaseWakeLock();
      return;
    }

    void acquireWakeLock();

    function onVisibilityChange() {
      if (document.visibilityState === "visible" && isAuditLoadingRef.current) {
        void acquireWakeLock();
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      releaseWakeLock();
    };
  }, [isAuditLoading]);

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center rounded-3xl bg-black/60 backdrop-blur-md">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-neutral-900/95 p-6 shadow-2xl shadow-black/40">
        <div className="mb-5 flex items-center gap-4">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center">
            <div
              className="absolute inset-0 rounded-full bg-orange-500/20 blur-xl motion-safe:animate-pulse"
              aria-hidden
            />
            <div className="relative flex h-11 w-11 items-center justify-center rounded-full border border-orange-500/20 bg-orange-500/10">
              <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-orange-500/25 border-t-orange-400" />
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-white">{leadTitle}</p>
            <p className="text-xs text-neutral-400">{leadSubtitle}</p>
          </div>
        </div>

        {backgroundNote ? (
          <p className="mb-5 text-center text-xs text-neutral-500">{backgroundNote}</p>
        ) : null}

        <div className="mb-3 flex items-center justify-between gap-3 text-xs">
          <span className="min-w-0 flex-1 text-neutral-300">{currentStep}</span>
          <span className="shrink-0 font-medium tabular-nums text-orange-400">
            {indeterminate
              ? `Étape ${Math.min(stepIndex + 1, steps.length)}/${steps.length}`
              : `${progress}%`}
          </span>
        </div>

        {statusHint ? (
          <p className="mb-3 text-[11px] leading-relaxed text-neutral-500 motion-safe:transition-opacity motion-safe:duration-300">
            {statusHint}
          </p>
        ) : null}

        <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
          {indeterminate ? (
            <div
              className="h-full w-full rounded-full bg-orange-400/35 motion-safe:animate-pulse"
              aria-hidden
            />
          ) : (
            <div
              className="h-full rounded-full bg-orange-400 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          )}
        </div>

        <div className="mt-5 space-y-2">
          {steps.map((step, index) => {
            const isDone = index < stepIndex;
            const isCurrent = index === stepIndex;

            return (
              <div
                key={step}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                  isCurrent
                    ? "bg-orange-500/10 text-orange-300"
                    : isDone
                    ? "text-neutral-300"
                    : "text-neutral-500"
                }`}
              >
                <div
                  className={`h-2.5 w-2.5 rounded-full ${
                    isCurrent
                      ? "bg-orange-400 motion-safe:animate-pulse"
                      : isDone
                      ? "bg-orange-700"
                      : "bg-neutral-700"
                  }`}
                />
                <span>{step}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
