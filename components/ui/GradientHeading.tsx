import * as React from "react";

import { cn } from "@/lib/utils";

export type GradientHeadingProps = React.HTMLAttributes<HTMLHeadingElement>;

export function GradientHeading({ className, children, ...props }: GradientHeadingProps) {
  return (
    <h1
      className={cn(
        "font-extrabold tracking-tight leading-[0.95] text-4xl md:text-5xl bg-gradient-to-r from-orange-500 via-amber-400 to-emerald-400 bg-clip-text text-transparent",
        className,
      )}
      {...props}
    >
      {children}
    </h1>
  );
}
