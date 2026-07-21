import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

import pilotSourceInput from "../data/intelligencePublishing/sources/barcelona-airbnb-apartment.public-source.json";
import { marketReports } from "../data/marketReports";
import {
  buildMarketReportBundleFromPublicMarketSource,
  buildRegistrySnapshotFromPublicMarketSource,
  fingerprintPublicMarketSource,
  validatePublicMarketSource,
  validatePublicMarketSourcePrivacy,
} from "../lib/intelligencePublishing/publicMarketSourceAdapter";
import {
  validateMarketReportArtifactBundle,
} from "../lib/intelligencePublishing/marketReportGeneration";
import {
  buildNextLocalizedStaticParams,
  buildNextMetadataFromPublication,
  buildNextPublicationCatalog,
  getNextPublicationStructuredData,
  resolveNextPublicationForLocalizedRoute,
  resolveNextPublicationBySlug,
} from "../lib/intelligencePublishing/nextWebPublicationAdapter";
import {
  buildRegistrySnapshotFingerprint,
  validateRegistrySnapshot,
} from "../lib/intelligencePublishing/registryAdapter";
import {
  runWebManifestMaterializationCli,
  validateWebManifestCatalogEnvelope,
} from "../lib/intelligencePublishing/webManifestMaterialization";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function assertNoPrivateFragments(value: unknown) {
  const serialized = JSON.stringify(value);
  for (const fragment of [
    "userId",
    "workspaceId",
    "auditId",
    "listingId",
    "listingUrl",
    "comparableUrl",
    "sourceUrl",
    "rawPayload",
    "rawObservation",
  ]) {
    assert.equal(
      serialized.includes(fragment),
      false,
      `Unexpected private fragment: ${fragment}`,
    );
  }
}

async function main() {
  const validSource = validatePublicMarketSource(pilotSourceInput);
  assert.equal(validSource.ok, true);
  if (!validSource.ok) {
    throw new Error("Expected valid pilot source.");
  }
  const privacyValidation = validatePublicMarketSourcePrivacy(pilotSourceInput);
  assert.equal(privacyValidation.ok, true);

  const privateSource = clone(pilotSourceInput) as Record<string, unknown>;
  privateSource.metadata = {
    ...((privateSource.metadata as Record<string, unknown> | undefined) ?? {}),
    listingUrl: "https://private.example/listing",
  };
  const privateValidation = validatePublicMarketSource(privateSource);
  assert.equal(privateValidation.ok, false);

  const tooSmallSource = clone(pilotSourceInput);
  tooSmallSource.pricingBenchmark.included_sample_size = 4;
  tooSmallSource.pricingBenchmark.raw_sample_size = 4;
  const tooSmallValidation = validatePublicMarketSource(tooSmallSource);
  assert.equal(tooSmallValidation.ok, false);

  const tooOldSource = clone(pilotSourceInput);
  tooOldSource.generatedAt = "2027-12-01T12:00:00.000Z";
  const tooOldValidation = validatePublicMarketSource(tooOldSource);
  assert.equal(tooOldValidation.ok, false);

  const wrongMarketSource = clone(pilotSourceInput);
  wrongMarketSource.marketCell.city = "Madrid";
  const wrongMarketValidation = validatePublicMarketSource(wrongMarketSource);
  assert.equal(wrongMarketValidation.ok, false);

  const firstFingerprint = fingerprintPublicMarketSource(pilotSourceInput);
  const secondFingerprint = fingerprintPublicMarketSource(clone(pilotSourceInput));
  assert.equal(firstFingerprint, secondFingerprint);

  const snapshotBuild = buildRegistrySnapshotFromPublicMarketSource(pilotSourceInput);
  const snapshotValidation = validateRegistrySnapshot(snapshotBuild.registrySnapshot);
  assert.equal(snapshotValidation.ok, true);
  assert.equal(
    snapshotBuild.snapshotFingerprint,
    buildRegistrySnapshotFingerprint(snapshotBuild.registrySnapshot),
  );
  assert.equal(snapshotBuild.reportAssetKey.startsWith("asset_market_report_"), true);
  assertNoPrivateFragments(snapshotBuild.registrySnapshot);

  const bundleBuild = buildMarketReportBundleFromPublicMarketSource(pilotSourceInput);
  const bundleValidation = validateMarketReportArtifactBundle(bundleBuild.bundle);
  assert.equal(bundleValidation.ok, true);
  assert.equal(bundleBuild.bundle.document.identity.locale, "fr");
  assert.equal(
    bundleBuild.bundle.document.identity.reportSlug,
    "airbnb-market-report-barcelona-apartment",
  );
  assert.equal(bundleBuild.source.publication.defaultLocale, "en");
  assert.equal(
    bundleBuild.bundle.document.identity.canonicalPath,
    "/reports/airbnb-market-report-barcelona-apartment",
  );
  assert.equal(bundleBuild.bundle.change.changeType, "partial_report");
  assert.equal(
    bundleBuild.bundle.document.sections.some(
      (section) => section.sectionType === "occupancy_benchmark",
    ),
    true,
  );
  const occupancySection = bundleBuild.bundle.document.sections.find(
    (section) => section.sectionType === "occupancy_benchmark",
  );
  assert.ok(occupancySection, "Expected an explicit occupancy limitation section.");
  assert.equal(occupancySection.dataPoints.length, 0);
  assert.equal(
    occupancySection.summary?.includes("Aucune donnée d'occupation publique-safe"),
    true,
  );
  assert.equal(
    bundleBuild.bundle.document.sections.some(
      (section) => section.sectionType === "pricing_benchmark",
    ),
    true,
  );
  assert.equal(
    bundleBuild.bundle.document.sections.some(
      (section) => section.sectionType === "market_overview",
    ),
    true,
  );
  assertNoPrivateFragments(bundleBuild.bundle);

  const temporaryRoot = await mkdtemp(
    path.join(tmpdir(), "ipp-first-real-report-pilot-"),
  );
  const sourcePath = path.join(
    temporaryRoot,
    "barcelona-airbnb-apartment.public-source.json",
  );
  const outputPath = path.join(temporaryRoot, "catalog.json");

  try {
    await writeFile(sourcePath, JSON.stringify(pilotSourceInput, null, 2), "utf8");

    await runWebManifestMaterializationCli([
      "--source",
      sourcePath,
      "--output",
      outputPath,
      "--write",
    ]);

    const firstRaw = await readFile(outputPath, "utf8");
    const firstParsed = JSON.parse(firstRaw) as unknown;
    const firstCatalogValidation = validateWebManifestCatalogEnvelope(firstParsed);
    assert.equal(firstCatalogValidation.ok, true);
    if (!firstCatalogValidation.ok) {
      throw new Error("Expected a valid materialized catalog.");
    }
    const firstCatalog = firstCatalogValidation.envelope;
    assert.equal(firstCatalog.manifestCount, 1);
    assert.equal(firstCatalog.manifests.length, 1);
    assert.equal(firstCatalog.manifests[0]?.route.canonical.locale, "fr");
    assert.equal(firstCatalog.manifests[0]?.target.defaultLocale, "en");
    assert.equal(firstCatalog.manifests[0]?.route.canonical.pathname, "/fr/reports/airbnb-market-report-barcelona-apartment");
    assert.equal(firstCatalog.manifests[0]?.decision.decisionType, "publish_with_warning");
    assert.equal(firstCatalog.manifests[0]?.seo.robots.index, false);
    assert.equal(firstCatalog.manifests[0]?.sitemapEntry, null);
    assert.equal(
      firstCatalog.manifests[0]?.route.aliases.some(
        (alias) => alias.fromPath === "/reports/airbnb-market-report-barcelona",
      ),
      true,
    );
    assertNoPrivateFragments(firstCatalog);

    await runWebManifestMaterializationCli([
      "--source",
      sourcePath,
      "--output",
      outputPath,
      "--write",
    ]);

    const secondRaw = await readFile(outputPath, "utf8");
    const secondParsed = JSON.parse(secondRaw) as unknown;
    const secondCatalogValidation = validateWebManifestCatalogEnvelope(secondParsed);
    assert.equal(secondCatalogValidation.ok, true);
    if (!secondCatalogValidation.ok) {
      throw new Error("Expected a valid second-pass catalog.");
    }
    const secondCatalog = secondCatalogValidation.envelope;
    assert.equal(secondCatalog.catalogFingerprint, firstCatalog.catalogFingerprint);

    const nextCatalog = buildNextPublicationCatalog({
      manifests: firstCatalog.manifests,
      legacyReports: marketReports,
    });
    assert.deepEqual(buildNextLocalizedStaticParams(nextCatalog), [
      {
        locale: "fr",
        report: "airbnb-market-report-barcelona-apartment",
      },
    ]);
    const resolution = resolveNextPublicationBySlug(
      nextCatalog,
      "airbnb-market-report-barcelona-apartment",
    );
    assert.equal(resolution.found, true);
    assert.equal(resolution.canonicalPath, "/fr/reports/airbnb-market-report-barcelona-apartment");
    assert.equal(resolution.entry?.source, "ipp_canonical");
    assert.equal(resolution.entry?.indexable, false);
    assert.equal(resolution.entry?.sitemapEligible, false);
    assert.equal(resolution.entry?.pathname, "/fr/reports/airbnb-market-report-barcelona-apartment");

    const localizedResolution = resolveNextPublicationForLocalizedRoute(
      nextCatalog,
      "fr",
      "airbnb-market-report-barcelona-apartment",
    );
    assert.equal(localizedResolution.found, true);
    assert.equal(
      localizedResolution.canonicalPath,
      "/fr/reports/airbnb-market-report-barcelona-apartment",
    );

    const missingEnglishResolution = resolveNextPublicationForLocalizedRoute(
      nextCatalog,
      "en",
      "airbnb-market-report-barcelona-apartment",
    );
    assert.equal(missingEnglishResolution.found, false);

    const metadata = buildNextMetadataFromPublication(resolution);
    assert.equal(typeof metadata.title, "string");
    assert.equal(
      metadata.alternates?.canonical,
      "https://norixo.io/fr/reports/airbnb-market-report-barcelona-apartment",
    );
    assert.equal(
      (metadata.openGraph as { url?: string } | undefined)?.url,
      "https://norixo.io/fr/reports/airbnb-market-report-barcelona-apartment",
    );

    const structuredData = getNextPublicationStructuredData(resolution);
    assert.equal(structuredData != null, true);
    assert.equal(
      JSON.stringify(structuredData).includes(
        "https://norixo.io/fr/reports/airbnb-market-report-barcelona-apartment",
      ),
      true,
    );
    assertNoPrivateFragments(structuredData);

    const pricingSection = bundleBuild.bundle.document.sections.find(
      (section) => section.sectionType === "pricing_benchmark",
    );
    assert.ok(pricingSection, "Expected a pricing section.");
    const sectionText = JSON.stringify(pricingSection);
    assert.equal(sectionText.includes("309.2"), true);
    assert.equal(sectionText.includes("362.63"), true);
    assert.equal(sectionText.includes("232"), true);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }

  console.log("PASS — Intelligence Publishing first real report pilot smoke");
}

void main();
