import * as React from "react";

import { cn } from "@/lib/utils";

export interface HeroTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

export function HeroTitle({ className, children, ...props }: HeroTitleProps) {
  return (
    <h1
      className={cn(
    	"text-balance text-[2rem] md:text-[2.8rem] font-extrabold leading-[0.95] tracking-tight bg-gradient-to-r from-orange-500 via-amber-400 to-emerald-500 bg-clip-text text-transparent",
        className,
      )}
      {...props}
    >
      {children}
    </h1>
  );
}
