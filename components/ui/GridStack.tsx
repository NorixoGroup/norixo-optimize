import * as React from "react";

import { cn } from "@/lib/utils";

export type GridStackCols = 1 | 2;
export type GridStackGap = "sm" | "md" | "lg";

export interface GridStackProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: GridStackCols;
  gap?: GridStackGap;
}

const colsClasses: Record<GridStackCols, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 lg:grid-cols-2",
};

const gapClasses: Record<GridStackGap, string> = {
  sm: "gap-4",
  md: "gap-6",
  lg: "gap-8",
};

export function GridStack({ className, cols = 1, gap = "md", ...props }: GridStackProps) {
  return (
    <div
      className={cn("grid", colsClasses[cols], gapClasses[gap], className)}
      {...props}
    />
  );
}
