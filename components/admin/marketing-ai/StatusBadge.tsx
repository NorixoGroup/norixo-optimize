type StatusBadgeProps = {
  children: React.ReactNode;
  tone?: "slate" | "sky" | "emerald" | "amber" | "violet";
};

const toneClasses: Record<NonNullable<StatusBadgeProps["tone"]>, string> = {
  slate: "border-slate-200 bg-slate-100 text-slate-700",
  sky: "border-sky-200 bg-sky-50 text-sky-700",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  violet: "border-violet-200 bg-violet-50 text-violet-700",
};

export function StatusBadge({ children, tone = "slate" }: StatusBadgeProps) {
  return (
    <span
      className={[
        "inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
        toneClasses[tone],
      ].join(" ")}
    >
      {children}
    </span>
  );
}
