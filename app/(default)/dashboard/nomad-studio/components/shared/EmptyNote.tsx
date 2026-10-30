import type { ReactNode } from "react";

export function EmptyNote({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="nk-card-soft border-dashed px-4 py-6 text-center">
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {children ? <p className="mt-1 text-sm text-slate-600">{children}</p> : null}
    </div>
  );
}
