export function ProgressBar({ percent, tone = "green", label }: { percent: number; tone?: "green" | "amber" | "rose" | "slate"; label: string }) {
  const bar = { green: "bg-emerald-500", amber: "bg-amber-500", rose: "bg-rose-500", slate: "bg-slate-500" }[tone];
  const value = Math.max(0, Math.min(100, percent));

  return (
    <div role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
      <div className={`h-full rounded-full ${bar}`} style={{ width: `${value}%` }} />
    </div>
  );
}
