"use client";

import { useEffect, useRef, useState } from "react";
import { copyToClipboard } from "./copyToClipboard";

type Props = {
  citation: string;
  calculatorTitle: string;
};

export default function CopyCitationButton({ citation, calculatorTitle }: Props) {
  const [copied, setCopied] = useState(false);
  const resetTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (resetTimeout.current) {
        clearTimeout(resetTimeout.current);
      }
    },
    []
  );

  async function handleCopy() {
    if (!(await copyToClipboard(citation))) {
      return;
    }

    setCopied(true);

    if (resetTimeout.current) {
      clearTimeout(resetTimeout.current);
    }

    resetTimeout.current = setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={`Copy official citation for ${calculatorTitle}`}
        className="rounded-full border border-[#10231F]/20 bg-white px-4 py-2 text-sm font-semibold text-[#10231F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#10231F]"
      >
        {copied ? "Citation copied" : "Copy citation"}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? "Citation copied" : ""}
      </span>
    </div>
  );
}
