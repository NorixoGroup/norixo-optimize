import * as React from "react";

import { cn } from "@/lib/utils";

export type CardVariant = "default" | "soft" | "pricing" | "highlight";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

const variantClasses: Record<CardVariant, string> = {
  default: "border-slate-200/60 bg-white/80",
  soft: "border-slate-200/70 bg-slate-50/95",
  pricing: "border-orange-200/80 bg-orange-50/30 ring-1 ring-orange-100/70",
  highlight: "border-emerald-200/70 bg-emerald-50/25 ring-1 ring-emerald-100/70",
};

export function Card({ className, variant = "default", ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border backdrop-blur-sm shadow-sm",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
