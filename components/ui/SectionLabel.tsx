import * as React from "react";

import { cn } from "@/lib/utils";

export interface SectionLabelProps extends React.HTMLAttributes<HTMLParagraphElement> {}

export function SectionLabel({ className, children, ...props }: SectionLabelProps) {
  return (
    <p
      className={cn(
        "text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500",
        className,
      )}
      {...props}
    >
      {children}
    </p>
  );
}
