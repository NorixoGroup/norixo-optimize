"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export interface PrimaryButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export function PrimaryButton({ className, children, ...props }: PrimaryButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold shadow-lg transition-all duration-200 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300/70 disabled:cursor-not-allowed disabled:opacity-70",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
