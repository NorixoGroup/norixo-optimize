import * as React from "react";

import { cn } from "@/lib/utils";

export type SectionBlockProps = React.HTMLAttributes<HTMLElement>;

export function SectionBlock({ className, ...props }: SectionBlockProps) {
  return (
    <section
      className={cn("space-y-6", className)}
      {...props}
    />
  );
}
