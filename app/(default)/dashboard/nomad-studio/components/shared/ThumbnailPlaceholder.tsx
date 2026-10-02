import { Clapperboard } from "lucide-react";

import { COPY } from "../../copy";

// Placeholder élégant tant qu'aucune miniature n'existe (le moteur de miniatures n'est pas branché).
export function ThumbnailPlaceholder() {
  return (
    <div
      role="img"
      aria-label={COPY.productions.thumbnail}
      className="relative flex aspect-video w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-[radial-gradient(circle_at_0_0,rgba(251,146,60,0.14),transparent_60%),radial-gradient(circle_at_100%_100%,rgba(16,185,129,0.12),transparent_55%),linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)]"
    >
      <Clapperboard aria-hidden="true" className="h-7 w-7 text-slate-500" strokeWidth={1.6} />
      <span className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">{COPY.productions.thumbnail}</span>
    </div>
  );
}
