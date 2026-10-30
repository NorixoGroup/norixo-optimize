import { COPY } from "../copy";
import { Panel } from "./shared/Panel";
import { StatusBadge } from "./shared/StatusBadge";

// Carte réservée : aucune source de métriques n'est connectée, aucune valeur n'est affichée.
export function ResourceUsageCard() {
  return (
    <Panel id="resources" title={COPY.resources.title} description={COPY.resources.note} aside={<StatusBadge tone="slate">{COPY.resources.badge}</StatusBadge>}>
      <ul className="grid grid-cols-2 gap-2.5">
        {COPY.resources.items.map((label) => (
          <li key={label} className="nk-card-soft min-w-0 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">{label}</p>
            <p className="mt-1 text-sm font-semibold text-slate-600">—</p>
            <p className="text-[11px] text-slate-600">{COPY.waiting}</p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
