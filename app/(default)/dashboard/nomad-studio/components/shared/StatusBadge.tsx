import type { ReactNode } from "react";

export type BadgeTone = "green" | "amber" | "rose" | "slate" | "blue";

const TONES: Record<BadgeTone, string> = {
  green: "border-emerald-300 bg-emerald-50 text-emerald-800",
  amber: "border-amber-300 bg-amber-50 text-amber-900",
  rose: "border-rose-300 bg-rose-50 text-rose-800",
  slate: "border-slate-300 bg-slate-50 text-slate-700",
  blue: "border-blue-300 bg-blue-50 text-blue-800",
};

// Le statut est toujours porté par un texte, jamais par la couleur seule.
export function StatusBadge({ tone, children, className = "" }: { tone: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${TONES[tone]} ${className}`}>
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}
