import { createHash } from "node:crypto";

import {
  buildExecutionPlan,
  type BuildExecutionPlanInput,
  type ExecutionPlan,
} from "./executionEngine";
import {
  normalizeRegistrySnapshot,
  parseRegistrySnapshot,
  buildRegistrySnapshotFingerprint,
  type RegistrySnapshot,
} from "./registryAdapter";
import type { CoordinationJsonObject, CoordinationJsonValue } from "./distributedCoordination";
import type { PublicationEventEnvelope } from "./eventContracts";

export type MarketReportDefinition = Readonly<{
  reportId: string;
  marketCellKey: string;
  city: string;
  country: string;
  platform: string;
  propertyType: string;
  language: string;
  title: string;
  slug: string;
  reportVersion: number;
  benchmarkFingerprint: string;
  overviewFingerprint: string;
  policyVersions: Readonly<Record<string, string>>;
  createdAt: string;
  updatedAt: string;
  metadata: CoordinationJsonObject;
}>;

export type MarketReportBuildRequest = Readonly<{
  definition: MarketReportDefinition;
  triggerEvent: PublicationEventEnvelope;
  registrySnapshot: RegistrySnapshot;
}>;

export type MarketReportPilotResult = Readonly<{
  definition: MarketReportDefinition;
  registrySnapshot: RegistrySnapshot;
  executionPlan: ExecutionPlan;
  executionPlanFingerprint: string;
  generatedAt: string;
}>;

export type MarketReportDefinitionValidationIssue = Readonly<{
  path: string;
  message: string;
}>;

export type MarketReportDefinitionValidationResult =
  | Readonly<{
      ok: true;
      definition: MarketReportDefinition;
    }>
  | Readonly<{
      ok: false;
      issues: readonly MarketReportDefinitionValidationIssue[];
    }>;

export type BuildMarketReportExecutionPlanInput = Readonly<{
  request: MarketReportBuildRequest;
  runId: string;
  now: () => string;
  eventIdempotencyKey?: string;
  runEpoch?: number;
  attempt?: number;
  executionPlanVersion?: number;
  maxAttemptsByJobType?: BuildExecutionPlanInput["maxAttemptsByJobType"];
  estimatedCostByJobType?: BuildExecutionPlanInput["estimatedCostByJobType"];
  metadataByJobType?: BuildExecutionPlanInput["metadataByJobType"];
  dependencyJobIdsByTargetKey?: BuildExecutionPlanInput["dependencyJobIdsByTargetKey"];
  dependentJobIdsByTargetKey?: BuildExecutionPlanInput["dependentJobIdsByTargetKey"];
  metadata?: CoordinationJsonObject;
  orchestrationRunMetadata?: BuildExecutionPlanInput["orchestrationRunMetadata"];
}>;

export type BuildMarketReportPilotResultInput = Omit<
  BuildMarketReportExecutionPlanInput,
  "request"
> &
  Readonly<{
    definition: unknown;
    triggerEvent: PublicationEventEnvelope;
    registrySnapshot?: RegistrySnapshot;
  }>;

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isCanonicalIsoTimestamp(value: string): boolean {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return date.toISOString() === value;
}

function isJsonSafe(
  value: unknown,
  seen: WeakSet<object> = new WeakSet(),
): value is CoordinationJsonValue {
  if (
    value == null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return true;
  }

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (
    typeof value === "undefined" ||
    typeof value === "function" ||
    typeof value === "symbol" ||
    typeof value === "bigint"
  ) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.every((entry) => isJsonSafe(entry, seen));
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return false;
    }

    return Object.values(value as Record<string, unknown>).every((entry) =>
      isJsonSafe(entry, seen),
    );
  }

  return false;
}

function uniqueSortedStrings(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort(compareStrings));
}

function sortStringRecord(
  input: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(input)
        .sort((left, right) => compareStrings(left[0], right[0]))
        .map(([key, value]) => [key, value]),
    ),
  );
}

function freezeMetadata(metadata: CoordinationJsonObject | undefined): CoordinationJsonObject {
  return Object.freeze({ ...(metadata ?? {}) });
}

function freezeDefinition(definition: MarketReportDefinition): MarketReportDefinition {
  return Object.freeze({
    ...definition,
    policyVersions: sortStringRecord(definition.policyVersions),
    metadata: freezeMetadata(definition.metadata),
  });
}

function buildMarketReportAssetId(definition: MarketReportDefinition): string {
  return `asset_market_report_${definition.reportId}`;
}

function buildMarketReportAssetVersionId(definition: MarketReportDefinition): string {
  return `asset_market_report_${definition.reportId}_v${definition.reportVersion}`;
}

function buildMarketReportBenchmarkArtifactId(
  definition: MarketReportDefinition,
): string {
  return `benchmark:${definition.marketCellKey}`;
}

function buildMarketReportOverviewArtifactId(
  definition: MarketReportDefinition,
): string {
  return `overview:${definition.marketCellKey}`;
}

function buildMarketReportVersionFingerprint(
  definition: MarketReportDefinition,
): string {
  return createHash("sha256")
    .update(
      [
        definition.reportId,
        definition.reportVersion,
        definition.title,
        definition.slug,
        definition.language,
        definition.benchmarkFingerprint,
        definition.overviewFingerprint,
      ].join("||"),
    )
    .digest("hex");
}

export function buildMarketReportFingerprint(
  input: MarketReportDefinition,
): string {
  const definition = parseMarketReportDefinition(input);
  return `ipp_market_report_${createHash("sha256")
    .update(
      JSON.stringify({
        reportId: definition.reportId,
        marketCellKey: definition.marketCellKey,
        city: definition.city,
        country: definition.country,
        platform: definition.platform,
        propertyType: definition.propertyType,
        language: definition.language,
        title: definition.title,
        slug: definition.slug,
        reportVersion: definition.reportVersion,
        benchmarkFingerprint: definition.benchmarkFingerprint,
        overviewFingerprint: definition.overviewFingerprint,
        policyVersions: definition.policyVersions,
        metadata: definition.metadata,
      }),
    )
    .digest("hex")}`;
}

export function validateMarketReportDefinition(
  input: unknown,
): MarketReportDefinitionValidationResult {
  const issues: MarketReportDefinitionValidationIssue[] = [];
  if (typeof input !== "object" || input == null || Array.isArray(input)) {
    return {
      ok: false,
      issues: Object.freeze([
        Object.freeze({
          path: "",
          message: "Expected a MarketReportDefinition object.",
        }),
      ]),
    };
  }

  const candidate = input as Record<string, unknown>;
  for (const field of [
    "reportId",
    "marketCellKey",
    "city",
    "country",
    "platform",
    "propertyType",
    "language",
    "title",
    "slug",
    "benchmarkFingerprint",
    "overviewFingerprint",
  ] as const) {
    if (!isNonEmptyString(candidate[field])) {
      issues.push({
        path: field,
        message: "Expected a non-empty string.",
      });
    }
  }

  if (
    !Number.isInteger(candidate.reportVersion) ||
    Number(candidate.reportVersion) < 1
  ) {
    issues.push({
      path: "reportVersion",
      message: "Expected reportVersion >= 1.",
    });
  }

  for (const field of ["createdAt", "updatedAt"] as const) {
    if (!isNonEmptyString(candidate[field]) || !isCanonicalIsoTimestamp(candidate[field])) {
      issues.push({
        path: field,
        message: "Expected a canonical ISO timestamp.",
      });
    }
  }

  const policyVersions = candidate.policyVersions;
  if (typeof policyVersions !== "object" || policyVersions == null || Array.isArray(policyVersions)) {
    issues.push({
      path: "policyVersions",
      message: "Expected a policyVersions object.",
    });
  } else {
    for (const [key, value] of Object.entries(policyVersions as Record<string, unknown>)) {
      if (!isNonEmptyString(key) || !isNonEmptyString(value)) {
        issues.push({
          path: "policyVersions",
          message: "policyVersions keys and values must be non-empty strings.",
        });
        break;
      }
    }
  }

  if (!isJsonSafe(candidate.metadata ?? {})) {
    issues.push({
      path: "metadata",
      message: "metadata must be JSON-safe.",
    });
  }

  if (issues.length > 0) {
    return {
      ok: false,
      issues: Object.freeze(issues.map((issue) => Object.freeze(issue))),
    };
  }

  return {
    ok: true,
    definition: freezeDefinition({
      reportId: String(candidate.reportId).trim(),
      marketCellKey: String(candidate.marketCellKey).trim(),
      city: String(candidate.city).trim(),
      country: String(candidate.country).trim(),
      platform: String(candidate.platform).trim(),
      propertyType: String(candidate.propertyType).trim(),
      language: String(candidate.language).trim(),
      title: String(candidate.title).trim(),
      slug: String(candidate.slug).trim(),
      reportVersion: Number(candidate.reportVersion),
      benchmarkFingerprint: String(candidate.benchmarkFingerprint).trim(),
      overviewFingerprint: String(candidate.overviewFingerprint).trim(),
      policyVersions: sortStringRecord(
        candidate.policyVersions as Record<string, string>,
      ),
      createdAt: String(candidate.createdAt).trim(),
      updatedAt: String(candidate.updatedAt).trim(),
      metadata: freezeMetadata(candidate.metadata as CoordinationJsonObject | undefined),
    }),
  };
}

export function parseMarketReportDefinition(
  input: unknown,
): MarketReportDefinition {
  const result = validateMarketReportDefinition(input);
  if (!result.ok) {
    throw new Error(
      result.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; "),
    );
  }

  return result.definition;
}

export function buildRegistrySnapshotForMarketReport(
  input: MarketReportDefinition,
): RegistrySnapshot {
  const definition = parseMarketReportDefinition(input);
  const reportFingerprint = buildMarketReportFingerprint(definition);
  const assetId = buildMarketReportAssetId(definition);
  const assetVersionId = buildMarketReportAssetVersionId(definition);
  const benchmarkArtifactId = buildMarketReportBenchmarkArtifactId(definition);
  const overviewArtifactId = buildMarketReportOverviewArtifactId(definition);
  const contentFingerprint = buildMarketReportVersionFingerprint(definition);
  const sourceFingerprint = createHash("sha256")
    .update(
      [
        definition.benchmarkFingerprint,
        definition.overviewFingerprint,
        JSON.stringify(definition.policyVersions),
      ].join("||"),
    )
    .digest("hex");

  const snapshotInput = {
    snapshotId: `registry_snapshot_market_report_${definition.reportId}`,
    snapshotVersion: definition.reportVersion,
    generatedAt: definition.updatedAt,
    assets: [
      {
        assetId,
        canonicalId: definition.slug,
        assetType: "market_report",
        status: "published",
        visibility: "public",
        defaultLocale: definition.language,
        availableLocales: [definition.language],
        availableChannels: ["newsletter", "web"],
        activeVersionId: assetVersionId,
        templateId: "tpl_market_report",
        ownerTeam: "intelligence",
        confidenceAffectsVisibleContent: true,
        policyChangeAffectsVisibleContent: true,
        freshnessExpiryBehavior: "keep_visible",
        createdAt: definition.createdAt,
        updatedAt: definition.updatedAt,
        metadata: {
          marketReportFingerprint: reportFingerprint,
          marketCellKey: definition.marketCellKey,
          city: definition.city,
          country: definition.country,
          platform: definition.platform,
          propertyType: definition.propertyType,
          ...definition.metadata,
        },
      },
    ],
    assetVersions: [
      {
        assetVersionId,
        assetId,
        versionNumber: definition.reportVersion,
        status: "active",
        contentFingerprint,
        sourceFingerprint,
        templateFingerprint: "market_report_template_v1",
        rendererFingerprint: `renderer_market_report_${definition.language}`,
        policyVersions: definition.policyVersions,
        confidenceBand: "high",
        createdAt: definition.createdAt,
        approvedAt: definition.updatedAt,
        publishedAt: definition.updatedAt,
        supersededAt: null,
        metadata: {
          reportId: definition.reportId,
          title: definition.title,
        },
      },
    ],
    artifactReferences: [
      {
        referenceId: `ref_${definition.reportId}_benchmark`,
        assetId,
        assetVersionId,
        artifactType: "benchmark",
        artifactId: benchmarkArtifactId,
        artifactFingerprint: definition.benchmarkFingerprint,
        relationshipType: "supported_by",
        policyVersions: definition.policyVersions,
        createdAt: definition.updatedAt,
        metadata: {
          sourceApproved: true,
          source: "benchmark",
        },
      },
      {
        referenceId: `ref_${definition.reportId}_overview`,
        assetId,
        assetVersionId,
        artifactType: "public_overview",
        artifactId: overviewArtifactId,
        artifactFingerprint: definition.overviewFingerprint,
        relationshipType: "supported_by",
        policyVersions: definition.policyVersions,
        createdAt: definition.updatedAt,
        metadata: {
          sourceApproved: true,
          approvalState: "internal_approved",
          source: "public_overview",
        },
      },
      ...Object.entries(definition.policyVersions).map(([policyId, version]) => ({
        referenceId: `ref_${definition.reportId}_policy_${policyId}`,
        assetId,
        assetVersionId,
        artifactType: "policy" as const,
        artifactId: policyId,
        artifactFingerprint: `${policyId}:${version}`,
        relationshipType: "governed_by" as const,
        policyVersions: definition.policyVersions,
        createdAt: definition.updatedAt,
        metadata: {},
      })),
    ],
    channelVariants: [
      {
        variantId: `variant_${definition.reportId}_${definition.language}_newsletter_v${definition.reportVersion}`,
        assetId,
        assetVersionId,
        locale: definition.language,
        channel: "newsletter",
        status: "published",
        contentFingerprint: `${contentFingerprint}:newsletter`,
        destinationKey: `newsletter:${definition.language}:${definition.slug}`,
        publishedAt: definition.updatedAt,
        updatedAt: definition.updatedAt,
        metadata: {},
      },
      {
        variantId: `variant_${definition.reportId}_${definition.language}_web_v${definition.reportVersion}`,
        assetId,
        assetVersionId,
        locale: definition.language,
        channel: "web",
        status: "published",
        contentFingerprint: `${contentFingerprint}:web`,
        destinationKey: `site:web:${definition.language}:${definition.slug}`,
        publishedAt: definition.updatedAt,
        updatedAt: definition.updatedAt,
        metadata: {},
      },
    ],
    freshnessStates: [
      {
        assetId,
        assetVersionId,
        computedAt: definition.updatedAt,
        reviewDueAt: null,
        publishableUntil: null,
        staleAfter: null,
        expiredAfter: null,
        isPublishable: true,
        isStale: false,
        isExpired: false,
        evaluatedAt: definition.updatedAt,
      },
    ],
    publicationStates: [
      {
        assetId,
        assetVersionId,
        locale: definition.language,
        channel: "newsletter",
        status: "published",
        destinationKey: `newsletter:${definition.language}:${definition.slug}`,
        publicationFingerprint: `${contentFingerprint}:newsletter:published`,
        publishedAt: definition.updatedAt,
        suppressedAt: null,
        metadata: {},
      },
      {
        assetId,
        assetVersionId,
        locale: definition.language,
        channel: "web",
        status: "published",
        destinationKey: `site:web:${definition.language}:${definition.slug}`,
        publicationFingerprint: `${contentFingerprint}:web:published`,
        publishedAt: definition.updatedAt,
        suppressedAt: null,
        metadata: {},
      },
    ],
    policyVersions: definition.policyVersions,
    metadata: {
      pilot: "market_report",
      marketReportFingerprint: reportFingerprint,
    },
  };

  return normalizeRegistrySnapshot(parseRegistrySnapshot(snapshotInput));
}

export function buildMarketReportExecutionPlan(
  input: BuildMarketReportExecutionPlanInput,
): ExecutionPlan {
  const definition = parseMarketReportDefinition(input.request.definition);
  const registrySnapshot = normalizeRegistrySnapshot(
    parseRegistrySnapshot(input.request.registrySnapshot),
  );

  return buildExecutionPlan({
    event: input.request.triggerEvent,
    registrySnapshot,
    runId: input.runId,
    now: input.now,
    eventIdempotencyKey: input.eventIdempotencyKey,
    runEpoch: input.runEpoch,
    attempt: input.attempt,
    executionPlanVersion: input.executionPlanVersion,
    maxAttemptsByJobType: input.maxAttemptsByJobType,
    estimatedCostByJobType: input.estimatedCostByJobType,
    metadataByJobType: input.metadataByJobType,
    dependencyJobIdsByTargetKey: input.dependencyJobIdsByTargetKey,
    dependentJobIdsByTargetKey: input.dependentJobIdsByTargetKey,
    orchestrationRunMetadata: input.orchestrationRunMetadata,
    metadata: {
      marketReportId: definition.reportId,
      marketCellKey: definition.marketCellKey,
      pilot: "market_report",
      ...(input.metadata ?? {}),
    },
  });
}

export function buildMarketReportExecutionPlanFingerprint(
  input: Readonly<{
    definition: MarketReportDefinition;
    registrySnapshot: RegistrySnapshot;
    executionPlan: ExecutionPlan;
  }>,
): string {
  const definition = parseMarketReportDefinition(input.definition);
  return `ipp_market_report_exec_${createHash("sha256")
    .update(
      JSON.stringify({
        marketReportFingerprint: buildMarketReportFingerprint(definition),
        registrySnapshotFingerprint: buildRegistrySnapshotFingerprint(
          input.registrySnapshot,
        ),
        executionPlanId: input.executionPlan.executionPlanId,
        jobIds: input.executionPlan.jobs.map((job) => job.jobId).sort(compareStrings),
      }),
    )
    .digest("hex")}`;
}

export function buildMarketReportPilotResult(
  input: BuildMarketReportPilotResultInput,
): MarketReportPilotResult {
  const definition = parseMarketReportDefinition(input.definition);
  const registrySnapshot =
    input.registrySnapshot == null
      ? buildRegistrySnapshotForMarketReport(definition)
      : normalizeRegistrySnapshot(parseRegistrySnapshot(input.registrySnapshot));

  const request: MarketReportBuildRequest = Object.freeze({
    definition,
    triggerEvent: input.triggerEvent,
    registrySnapshot,
  });

  const executionPlan = buildMarketReportExecutionPlan({
    request,
    runId: input.runId,
    now: input.now,
    eventIdempotencyKey: input.eventIdempotencyKey,
    runEpoch: input.runEpoch,
    attempt: input.attempt,
    executionPlanVersion: input.executionPlanVersion,
    maxAttemptsByJobType: input.maxAttemptsByJobType,
    estimatedCostByJobType: input.estimatedCostByJobType,
    metadataByJobType: input.metadataByJobType,
    dependencyJobIdsByTargetKey: input.dependencyJobIdsByTargetKey,
    dependentJobIdsByTargetKey: input.dependentJobIdsByTargetKey,
    metadata: input.metadata,
    orchestrationRunMetadata: input.orchestrationRunMetadata,
  });

  const generatedAt = input.now();
  if (!isCanonicalIsoTimestamp(generatedAt)) {
    throw new Error(`Expected a canonical ISO timestamp, received ${generatedAt}.`);
  }

  return Object.freeze({
    definition,
    registrySnapshot,
    executionPlan,
    executionPlanFingerprint: buildMarketReportExecutionPlanFingerprint({
      definition,
      registrySnapshot,
      executionPlan,
    }),
    generatedAt,
  });
}
