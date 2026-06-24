import { buildMediaAssetRequestsFromBundle } from "../lib/marketing-ai/media/mediaAssetRequestBuilder";
import { fakeMediaProvider } from "../lib/marketing-ai/media/providers/fakeMediaProvider";
import { runMediaProviderForRequests } from "../lib/marketing-ai/media/mediaProviderRunner";
import { runMarketingStudioOrchestratorV2 } from "../lib/marketing-ai/orchestrator/marketingStudioOrchestratorV2";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertNonEmptyString(value: string | null | undefined, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is empty.`);
  }
}

async function main() {
  const result = await runMarketingStudioOrchestratorV2({
    name: "Campagne media layer smoke test",
    objective: "awareness",
    audience: "Hôtes et conciergeries",
    language: "fr",
    channels: ["facebook", "instagram"],
  });

  const bundle = result.bundle;
  const bundleMedia = bundle.media;

  assert(bundleMedia, "bundle.media is missing.");
  assert(Array.isArray(bundleMedia.requests), "bundle.media.requests is invalid.");
  assert(Array.isArray(bundleMedia.assets), "bundle.media.assets is invalid.");
  assert(bundleMedia.requests.length > 0, "bundle.media.requests is empty.");
  assert(bundleMedia.assets.length > 0, "bundle.media.assets is empty.");

  const rebuiltRequests = buildMediaAssetRequestsFromBundle(bundle);

  assert(rebuiltRequests.length > 0, "buildMediaAssetRequestsFromBundle() returned no requests.");
  assert(
    rebuiltRequests.length === bundleMedia.requests.length,
    "Rebuilt media requests do not match bundle.media.requests length.",
  );

  const results = await runMediaProviderForRequests(
    rebuiltRequests,
    fakeMediaProvider,
  );

  assert(results.length === rebuiltRequests.length, "Media provider results length is invalid.");
  assert(results.every((item) => item.provider === "fake"), "A media provider result is not from the fake provider.");
  assert(results.every((item) => item.status === "generated"), "A media provider result is not generated.");

  for (const item of results) {
    assertNonEmptyString(item.externalJobId, "mediaProviderResult.externalJobId");
    assert(item.asset, "mediaProviderResult.asset is missing.");
    assert(item.asset?.generationProvider === "fake", "mediaProviderResult.asset.generationProvider is invalid.");
    assert(item.asset?.previewUrl === null, "mediaProviderResult.asset.previewUrl should be null.");
    assert(item.asset?.downloadUrl === null, "mediaProviderResult.asset.downloadUrl should be null.");
    assert(item.asset?.thumbnailUrl === null, "mediaProviderResult.asset.thumbnailUrl should be null.");
  }

  console.log(
    JSON.stringify(
      {
        bundleId: bundle.id,
        campaignId: bundle.campaign.id,
        campaignName: bundle.campaign.name,
        requestCount: rebuiltRequests.length,
        bundleRequestCount: bundleMedia.requests.length,
        bundleAssetCount: bundleMedia.assets.length,
        providerId: fakeMediaProvider.id,
        providerLabel: fakeMediaProvider.label,
        capabilities: fakeMediaProvider.capabilities,
        resultsCount: results.length,
        allProvidersFake: results.every((item) => item.provider === "fake"),
        allGenerated: results.every((item) => item.status === "generated"),
        noExternalAssetUrls: results.every(
          (item) =>
            item.asset?.previewUrl === null &&
            item.asset?.downloadUrl === null &&
            item.asset?.thumbnailUrl === null,
        ),
        requestIds: rebuiltRequests.map((request) => request.id),
        resultJobs: results.map((item) => ({
          provider: item.provider,
          externalJobId: item.externalJobId ?? null,
          status: item.status,
          kind: item.asset?.kind ?? null,
        })),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
