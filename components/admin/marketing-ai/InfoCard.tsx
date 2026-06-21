type InfoCardProps = {
  title: string;
  children: React.ReactNode;
  tone?: "sky" | "amber" | "emerald";
};

const toneClasses: Record<NonNullable<InfoCardProps["tone"]>, string> = {
  sky: "border-sky-100 bg-sky-50/70",
  amber: "border-amber-100 bg-amber-50/70",
  emerald: "border-emerald-100 bg-emerald-50/70",
};

export function InfoCard({ title, children, tone = "sky" }: InfoCardProps) {
  return (
    <section className={`rounded-3xl border p-5 ${toneClasses[tone]}`}>
      <p className="text-sm font-semibold text-slate-950">{title}</p>
      <div className="mt-2 text-sm leading-6 text-slate-700">{children}</div>
    </section>
  );
}
