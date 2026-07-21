import type { WebPublicationManifest } from "@/lib/intelligencePublishing/webPublisher";
import catalogEnvelopeInput from "@/data/intelligencePublishing/generated/webPublicationManifests.generated.json";
import { validateWebManifestCatalogEnvelope } from "@/lib/intelligencePublishing/webManifestMaterialization";

const validation = validateWebManifestCatalogEnvelope(catalogEnvelopeInput);

if (!validation.ok) {
  throw new Error(
    `Invalid generated web publication manifest catalog: ${validation.issues.join(" | ")}`,
  );
}

export const webPublicationManifests: readonly WebPublicationManifest[] =
  validation.envelope.manifests;
