import * as React from "react";

import { cn } from "@/lib/utils";

export type MobileCenteredBlockProps = React.HTMLAttributes<HTMLDivElement>;

// Ensure consistent mobile-centered layout across marketing pages
// mobile: mx-auto w-full max-w-md
// desktop: md:max-w-none
export function MobileCenteredBlock({ className, ...props }: MobileCenteredBlockProps) {
  return (
    <div
      className={cn("mx-auto w-full max-w-md md:max-w-none", className)}
      {...props}
    />
  );
}
