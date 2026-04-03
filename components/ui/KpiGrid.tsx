import * as React from "react";

import { cn } from "@/lib/utils";

export type KpiGridDensity = "normal" | "compact";

export interface KpiGridProps extends React.HTMLAttributes<HTMLDivElement> {
  density?: KpiGridDensity;
}

const densityClasses: Record<KpiGridDensity, string> = {
  normal: "grid gap-3 sm:grid-cols-3",
  compact: "grid gap-2 sm:grid-cols-3",
};

// Compact KPI grid used for small metric cards on marketing pages
export function KpiGrid({ className, density = "normal", ...props }: KpiGridProps) {
  return (
    <div className={cn(densityClasses[density], className)} {...props} />
  );
}
