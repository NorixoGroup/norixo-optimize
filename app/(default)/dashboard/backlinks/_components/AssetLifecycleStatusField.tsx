"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { BacklinkAssetLifecycleStatus } from "./asset-lifecycle-types";
import { backlinkAssetLifecycleOptions } from "./asset-lifecycle-types";

export default function AssetLifecycleStatusField({
  value,
  disabled,
  onChange,
}: {
  value: BacklinkAssetLifecycleStatus;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setContainer(
        document.querySelector<HTMLElement>('[aria-labelledby="backlinks-editor-title"] .mt-6.grid.gap-4'),
      );
    });

    return () => {
      active = false;
    };
  }, []);

  if (container == null) return null;

  return createPortal(
    <label htmlFor="asset-lifecycle-status">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">Statut</span>
      <select
        id="asset-lifecycle-status"
        name="lifecycle_status"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
      >
        {backlinkAssetLifecycleOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>,
    container,
  );
}
