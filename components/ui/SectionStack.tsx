import * as React from "react";

import { cn } from "@/lib/utils";

export type SectionStackSize = "sm" | "md" | "lg";

export interface SectionStackProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: SectionStackSize;
}

const sizeClasses: Record<SectionStackSize, string> = {
  sm: "space-y-4",
  md: "space-y-6",
  lg: "space-y-8",
};

export function SectionStack({ className, size = "md", ...props }: SectionStackProps) {
  return <div className={cn(sizeClasses[size], className)} {...props} />;
}
