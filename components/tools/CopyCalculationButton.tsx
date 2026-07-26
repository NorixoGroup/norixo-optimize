"use client";

import { useEffect, useRef, useState } from "react";
import { copyToClipboard } from "./copyToClipboard";

type Props = {
  calculation: string | undefined;
  calculatorTitle: string;
};

export default function CopyCalculationButton({ calculation, calculatorTitle }: Props) {
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
    if (!calculation || !(await copyToClipboard(calculation))) {
      return;
    }

    setCopied(true);

    if (resetTimeout.current) {
      clearTimeout(resetTimeout.current);
    }

    resetTimeout.current = setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={handleCopy}
        disabled={!calculation}
        aria-label={`Copy current calculation for ${calculatorTitle}`}
        className="rounded-full border border-[#10231F]/20 bg-white px-4 py-2 text-sm font-semibold text-[#10231F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#10231F] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {copied ? "Calculation copied" : "Copy calculation"}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? "Calculation copied" : ""}
      </span>
    </div>
  );
}
