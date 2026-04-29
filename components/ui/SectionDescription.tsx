import * as React from "react";

import { cn } from "@/lib/utils";

export type SectionDescriptionProps = React.HTMLAttributes<HTMLParagraphElement>;

export function SectionDescription({ className, children, ...props }: SectionDescriptionProps) {
  return (
    <p
      className={cn("text-[13px] leading-6 text-slate-700", className)}
      {...props}
    >
      {children}
    </p>
  );
}
