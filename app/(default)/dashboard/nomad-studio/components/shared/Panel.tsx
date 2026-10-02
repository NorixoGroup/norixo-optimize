import type { ReactNode } from "react";

import { KICKER } from "./styles";

// Surface de section : mêmes classes nk-* que les pages admin existantes.
export function Panel({
  id,
  title,
  kicker,
  description,
  aside,
  children,
  className = "",
}: {
  id?: string;
  title: string;
  kicker?: string;
  description?: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const titleId = id ? `${id}-title` : undefined;

  return (
    <section id={id} aria-labelledby={titleId} className={`nk-card nk-border nk-card-lg scroll-mt-24 p-5 md:p-6 ${className}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {kicker ? <p className={KICKER}>{kicker}</p> : null}
          <h2 id={titleId} className="text-lg font-semibold tracking-tight text-slate-950">{title}</h2>
          {description ? <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-700">{description}</p> : null}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}
