import * as React from "react";

import { cn } from "@/lib/utils";

export type SectionTitleProps = React.HTMLAttributes<HTMLHeadingElement>;

export function SectionTitle({ className, children, ...props }: SectionTitleProps) {
  return (
    <h2
      className={cn("text-[15px] font-semibold tracking-[0.01em] text-slate-900", className)}
      {...props}
    >
      {children}
    </h2>
  );
}
