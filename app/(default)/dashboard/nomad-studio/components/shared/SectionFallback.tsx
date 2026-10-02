import type { BridgeFailure } from "@/lib/youtube-agent/types";

import { COPY } from "../../copy";
import { EmptyNote } from "./EmptyNote";

// Les messages bruts du bridge ne sont jamais affichés : seule la nature de l'échec l'est.
export function SectionFallback({ failure }: { failure: BridgeFailure }) {
  return <EmptyNote title={`${COPY.sectionUnavailable} (${COPY.sectionKinds[failure.kind] ?? "erreur"})`}>{COPY.sectionHint}</EmptyNote>;
}
