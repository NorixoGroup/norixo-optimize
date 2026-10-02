import { COPY } from "../../copy";
import type { Dot } from "../../studioState";

const ICON: Record<Dot, string> = { ok: "🟢", warn: "🟠", error: "🔴", idle: "⚪" };

export function StatusDot({ state }: { state: Dot }) {
  const label = COPY.dots[state];

  return (
    <span role="img" aria-label={label} title={label} className="text-sm leading-none">
      {ICON[state]}
    </span>
  );
}
