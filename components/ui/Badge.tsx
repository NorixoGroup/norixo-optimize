import * as React from "react";

import { cn } from "@/lib/utils";

export type BadgeVariant = "default" | "success" | "warning" | "neutral";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default:
    "border border-slate-200 bg-slate-50 text-slate-700",
  success:
    "border border-emerald-200 bg-emerald-50 text-emerald-700",
  warning:
    "border border-amber-200 bg-amber-50 text-amber-800",
  neutral:
    "border border-slate-200 bg-white text-slate-800",
};

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none shadow-sm",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
