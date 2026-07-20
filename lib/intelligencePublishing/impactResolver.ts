import { createHash } from "node:crypto";

import {
  buildPublicationEventIdempotencyKey,
  buildPublicationEventSubjectKey,
  type PublicationEventConfidenceLevel,
  type PublicationEventEnvelope,
  type PublicationEventPriority,
  type PublicationEventSubjectType,
  type PublicationEventVisibility,
} from "./eventContracts";

export const IMPACT_LEVELS = Object.freeze([
  "no_impact",
  "metadata_only",
  "freshness_only",
  "variant_regeneration_required",
  "content_regeneration_required",
  "human_review_required",
  "immediate_suppression_required",
  "full_republish_required",
] as const);

export type ImpactLevel = (typeof IMPACT_LEVELS)[number];

export const IMPACT_ACTIONS = Object.freeze([
  "skip",
  "update_metadata",
  "update_freshness",
  "generate_asset_version",
  "regenerate_variant",
  "request_review",
  "publish",
  "republish",
  "suppress",
  "rollback",
] as const);

export type ImpactAction = (typeof IMPACT_ACTIONS)[number];

export const VISIBLE_DELTAS = Object.freeze([
  "none",
  "minor",
  "moderate",
  "major",
] as const);

export type VisibleDelta = (typeof VISIBLE_DELTAS)[number];

export const GOVERNANCE_REQUIREMENTS = Object.freeze([
  "none",
  "automatic",
  "human_review",
  "immediate_suppression",
] as const);

export type GovernanceRequirement =
  (typeof GOVERNANCE_REQUIREMENTS)[number];

export type ImpactReason = Readonly<{
  code: string;
  message: string;
  source: "event" | "lineage" | "fingerprint" | "governance" | "context";
  details?: Readonly<Record<string, string | number | boolean | null>>;
}>;

export type ImpactResolverAsset = Readonly<{
  assetId: string;
  assetType: string;
  templateId?: string | null;
  visibility: PublicationEventVisibility;
  confidenceAffectsVisibleContent?: boolean;
  policyChangeAffectsVisibleContent?: boolean;
  freshnessExpiryBehavior?: "keep_visible" | "suppress";
}>;

export type ImpactResolverAssetVersion = Readonly<{
  assetVersionId: string;
  assetId: string;
}>;

export type ImpactResolverArtifactReference = Readonly<{
  assetId: string;
  assetVersionId?: string | null;
  referenceType: "source_subject" | "policy";
  subjectType: PublicationEventSubjectType | "policy";
  subjectId: string;
}>;

export type ImpactResolutionContext = Readonly<{
  assets: readonly ImpactResolverAsset[];
  assetVersions: readonly ImpactResolverAssetVersion[];
  artifactReferences: readonly ImpactResolverArtifactReference[];
  activeVersions: Readonly<Record<string, string>>;
  availableLocales: Readonly<Record<string, readonly string[]>>;
  availableChannels: Readonly<Record<string, readonly string[]>>;
  currentPolicyVersions: Readonly<Record<string, string>>;
  currentFingerprints: Readonly<Record<string, string>>;
  currentApprovalStates?: Readonly<Record<string, boolean>>;
  now: () => string;
}>;

export type ImpactedAssetMatch = Readonly<{
  asset: ImpactResolverAsset;
  activeVersionId: string | null;
  locales: readonly string[];
  channels: readonly string[];
}>;

export type ImpactPlan = Readonly<{
  planId: string;
  triggerEventId: string;
  triggerEventType: PublicationEventEnvelope["eventType"];
  triggerSubjectType: PublicationEventEnvelope["subjectType"];
  triggerSubjectId: string;
  triggerFingerprint: string;
  impactLevel: ImpactLevel;
  visibleDelta: VisibleDelta;
  impactedAssets: readonly string[];
  impactedVersions: readonly string[];
  impactedLocales: readonly string[];
  impactedChannels: readonly string[];
  requiredActions: readonly ImpactAction[];
  skippedActions: readonly ImpactAction[];
  reasons: readonly ImpactReason[];
  priority: PublicationEventPriority;
  governanceRequirement: GovernanceRequirement;
  estimatedCost: number;
  createdAt: string;
}>;

const FINGERPRINT_SHORT_CIRCUIT_EVENT_TYPES = new Set<
  PublicationEventEnvelope["eventType"]
>([
  "benchmark_created",
  "benchmark_updated",
  "benchmark_superseded",
  "public_overview_approved",
]);

const IMPACT_LEVEL_SEVERITY: Readonly<Record<ImpactLevel, number>> =
  Object.freeze({
    no_impact: 0,
    metadata_only: 1,
    freshness_only: 2,
    variant_regeneration_required: 3,
    content_regeneration_required: 4,
    human_review_required: 5,
    immediate_suppression_required: 6,
    full_republish_required: 7,
  });

const IMPACT_ACTION_COST: Readonly<Record<ImpactAction, number>> =
  Object.freeze({
    skip: 0,
    update_metadata: 1,
    update_freshness: 1,
    generate_asset_version: 5,
    regenerate_variant: 3,
    request_review: 4,
    publish: 2,
    republish: 2,
    suppress: 1,
    rollback: 2,
  });

const CONFIDENCE_LEVEL_RANK: Readonly<
  Record<PublicationEventConfidenceLevel, number>
> = Object.freeze({
  unknown: 0,
  low: 1,
  moderate: 2,
  high: 3,
  very_high: 4,
});

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right);
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort(compareStrings));
}

function freezeReason(reason: ImpactReason): ImpactReason {
  return Object.freeze({
    ...reason,
    ...(reason.details == null
      ? {}
      : { details: Object.freeze({ ...reason.details }) }),
  });
}

function buildReason(
  code: string,
  message: string,
  source: ImpactReason["source"],
  details?: ImpactReason["details"],
): ImpactReason {
  return freezeReason({
    code,
    message,
    source,
    ...(details == null ? {} : { details }),
  });
}

function isConfidenceDecrease(
  previous: PublicationEventConfidenceLevel,
  next: PublicationEventConfidenceLevel,
): boolean {
  return CONFIDENCE_LEVEL_RANK[next] < CONFIDENCE_LEVEL_RANK[previous];
}

function createNoImpactPlan(
  event: PublicationEventEnvelope,
  context: ImpactResolutionContext,
  reasons: readonly ImpactReason[],
): ImpactPlan {
  const requiredActions = Object.freeze<ImpactAction[]>(["skip"]);
  const skippedActions = Object.freeze<ImpactAction[]>([]);
  const planId = buildImpactPlanId({
    event,
    impactedAssetIds: [],
    actions: requiredActions,
    contextFingerprint: "none",
  });

  return Object.freeze({
    planId,
    triggerEventId: event.eventId,
    triggerEventType: event.eventType,
    triggerSubjectType: event.subjectType,
    triggerSubjectId: event.subjectId,
    triggerFingerprint: event.subjectFingerprint,
    impactLevel: "no_impact",
    visibleDelta: "none",
    impactedAssets: Object.freeze<string[]>([]),
    impactedVersions: Object.freeze<string[]>([]),
    impactedLocales: Object.freeze<string[]>([]),
    impactedChannels: Object.freeze<string[]>([]),
    requiredActions,
    skippedActions,
    reasons: Object.freeze(reasons.map(freezeReason)),
    priority: event.priority,
    governanceRequirement: "none",
    estimatedCost: 0,
    createdAt: context.now(),
  });
}

function getCurrentSubjectFingerprint(
  event: PublicationEventEnvelope,
  context: ImpactResolutionContext,
): string | null {
  const key = buildPublicationEventSubjectKey(event.subjectType, event.subjectId);
  return context.currentFingerprints[key] ?? null;
}

function isFingerprintShortCircuitEligible(
  event: PublicationEventEnvelope,
): boolean {
  return FINGERPRINT_SHORT_CIRCUIT_EVENT_TYPES.has(event.eventType);
}

function sortAssetMatches(
  matches: readonly ImpactedAssetMatch[],
): readonly ImpactedAssetMatch[] {
  return Object.freeze(
    [...matches].sort((left, right) =>
      compareStrings(left.asset.assetId, right.asset.assetId),
    ),
  );
}

function findAssetById(
  context: ImpactResolutionContext,
  assetId: string,
): ImpactResolverAsset | null {
  return context.assets.find((asset) => asset.assetId === assetId) ?? null;
}

function findAssetVersionById(
  context: ImpactResolutionContext,
  assetVersionId: string,
): ImpactResolverAssetVersion | null {
  return (
    context.assetVersions.find((version) => version.assetVersionId === assetVersionId) ??
    null
  );
}

export function findImpactedAssets(
  event: PublicationEventEnvelope,
  context: ImpactResolutionContext,
): readonly ImpactedAssetMatch[] {
  const matchedAssetIds = new Set<string>();

  if (event.subjectType === "asset") {
    matchedAssetIds.add(event.subjectId);
  } else if (event.subjectType === "asset_version") {
    const version = findAssetVersionById(context, event.subjectId);
    if (version != null) {
      matchedAssetIds.add(version.assetId);
    }
  } else if (event.subjectType === "template") {
    for (const asset of context.assets) {
      if ((asset.templateId ?? null) === event.subjectId) {
        matchedAssetIds.add(asset.assetId);
      }
    }
  } else if (event.subjectType === "policy") {
    for (const reference of context.artifactReferences) {
      if (
        reference.referenceType === "policy" &&
        reference.subjectId === event.subjectId
      ) {
        matchedAssetIds.add(reference.assetId);
      }
    }
  } else {
    for (const reference of context.artifactReferences) {
      if (
        reference.referenceType === "source_subject" &&
        reference.subjectType === event.subjectType &&
        reference.subjectId === event.subjectId
      ) {
        matchedAssetIds.add(reference.assetId);
      }
    }
  }

  const matches: ImpactedAssetMatch[] = [];
  for (const assetId of matchedAssetIds) {
    const asset = findAssetById(context, assetId);
    if (asset == null) {
      continue;
    }

    matches.push({
      asset,
      activeVersionId: context.activeVersions[assetId] ?? null,
      locales: Object.freeze([...(context.availableLocales[assetId] ?? [])]),
      channels: Object.freeze([...(context.availableChannels[assetId] ?? [])]),
    });
  }

  return sortAssetMatches(matches);
}

export function hasVisibleContentChange(
  event: PublicationEventEnvelope,
  impactedAssets: readonly ImpactedAssetMatch[],
): boolean {
  switch (event.eventType) {
    case "benchmark_created":
    case "benchmark_updated":
    case "benchmark_superseded":
    case "public_overview_approved":
    case "manual_republish_requested":
      return true;
    case "confidence_changed":
      if (
        event.metadata.nextConfidence === event.metadata.previousConfidence
      ) {
        return false;
      }
      if (
        isConfidenceDecrease(
          event.metadata.previousConfidence,
          event.metadata.nextConfidence,
        )
      ) {
        return false;
      }
      return impactedAssets.some(
        (match) => match.asset.confidenceAffectsVisibleContent === true,
      );
    case "policy_version_changed":
      return impactedAssets.some(
        (match) => match.asset.policyChangeAffectsVisibleContent === true,
      );
    case "freshness_expired":
    case "public_overview_suppressed":
      return false;
  }
}

export function shouldRequireReview(
  event: PublicationEventEnvelope,
  context: ImpactResolutionContext,
): boolean {
  switch (event.eventType) {
    case "benchmark_superseded": {
      const nextSubjectId = event.metadata.supersededBySubjectId;
      const key = buildPublicationEventSubjectKey("benchmark", nextSubjectId);
      return context.currentApprovalStates?.[key] === false;
    }
    case "confidence_changed":
      return (
        event.metadata.nextConfidence !== event.metadata.previousConfidence &&
        isConfidenceDecrease(
          event.metadata.previousConfidence,
          event.metadata.nextConfidence,
        )
      );
    case "policy_version_changed":
      return true;
    default:
      return false;
  }
}

export function determineVisibleDelta(
  event: PublicationEventEnvelope,
  impactedAssets: readonly ImpactedAssetMatch[],
  impactLevel: ImpactLevel,
): VisibleDelta {
  if (impactLevel === "no_impact") {
    return "none";
  }

  if (impactLevel === "metadata_only") {
    return "minor";
  }

  switch (event.eventType) {
    case "public_overview_suppressed":
      return "major";
    case "freshness_expired":
      return impactLevel === "immediate_suppression_required" ? "major" : "none";
    case "manual_republish_requested":
      return "major";
    case "confidence_changed":
      return isConfidenceDecrease(
        event.metadata.previousConfidence,
        event.metadata.nextConfidence,
      )
        ? "moderate"
        : hasVisibleContentChange(event, impactedAssets)
          ? "minor"
          : "none";
    case "benchmark_updated":
      return impactedAssets.length > 1 ? "moderate" : "minor";
    case "benchmark_created":
    case "benchmark_superseded":
    case "public_overview_approved":
    case "policy_version_changed":
      return "moderate";
  }
}

export function determineGovernanceRequirement(
  event: PublicationEventEnvelope,
  impactLevel: ImpactLevel,
  requiredActions: readonly ImpactAction[],
): GovernanceRequirement {
  if (impactLevel === "no_impact") {
    return "none";
  }

  if (impactLevel === "immediate_suppression_required") {
    return "immediate_suppression";
  }

  if (
    impactLevel === "human_review_required" ||
    requiredActions.includes("request_review")
  ) {
    return "human_review";
  }

  if (event.eventType === "manual_republish_requested") {
    return "automatic";
  }

  return "automatic";
}

export function determineImpactLevel(
  event: PublicationEventEnvelope,
  impactedAssets: readonly ImpactedAssetMatch[],
  context: ImpactResolutionContext,
): ImpactLevel {
  switch (event.eventType) {
    case "public_overview_suppressed":
      return "immediate_suppression_required";
    case "manual_republish_requested":
      return "full_republish_required";
    case "benchmark_created":
    case "benchmark_updated":
    case "public_overview_approved":
      return impactedAssets.length === 0
        ? "no_impact"
        : "content_regeneration_required";
    case "benchmark_superseded":
      return shouldRequireReview(event, context)
        ? "human_review_required"
        : "content_regeneration_required";
    case "confidence_changed":
      if (
        isConfidenceDecrease(
          event.metadata.previousConfidence,
          event.metadata.nextConfidence,
        )
      ) {
        return "human_review_required";
      }
      return hasVisibleContentChange(event, impactedAssets)
        ? "content_regeneration_required"
        : "metadata_only";
    case "freshness_expired":
      return impactedAssets.some(
        (match) =>
          (match.asset.freshnessExpiryBehavior ?? "keep_visible") === "suppress",
      )
        ? "immediate_suppression_required"
        : "freshness_only";
    case "policy_version_changed":
      return hasVisibleContentChange(event, impactedAssets)
        ? "content_regeneration_required"
        : "human_review_required";
  }
}

function buildRequiredActions(
  event: PublicationEventEnvelope,
  impactLevel: ImpactLevel,
  impactedAssets: readonly ImpactedAssetMatch[],
): readonly ImpactAction[] {
  if (impactLevel === "no_impact") {
    return Object.freeze<ImpactAction[]>(["skip"]);
  }

  switch (event.eventType) {
    case "benchmark_created":
    case "benchmark_updated":
      return Object.freeze<ImpactAction[]>(["generate_asset_version"]);
    case "benchmark_superseded":
      return Object.freeze<ImpactAction[]>(
        impactLevel === "human_review_required"
          ? ["generate_asset_version", "request_review"]
          : ["generate_asset_version"],
      );
    case "public_overview_approved": {
      const hasPublishedVersion = impactedAssets.some(
        (match) => match.activeVersionId != null,
      );
      return Object.freeze<ImpactAction[]>(
        hasPublishedVersion
          ? ["generate_asset_version", "republish"]
          : ["generate_asset_version", "publish"],
      );
    }
    case "public_overview_suppressed":
      return Object.freeze<ImpactAction[]>(["suppress"]);
    case "confidence_changed":
      if (impactLevel === "human_review_required") {
        return Object.freeze<ImpactAction[]>(["request_review"]);
      }
      return Object.freeze<ImpactAction[]>(
        impactLevel === "metadata_only"
          ? ["update_metadata"]
          : ["generate_asset_version"],
      );
    case "freshness_expired":
      return Object.freeze<ImpactAction[]>(
        impactLevel === "immediate_suppression_required"
          ? ["suppress"]
          : ["update_freshness"],
      );
    case "policy_version_changed":
      return Object.freeze<ImpactAction[]>(
        impactLevel === "content_regeneration_required"
          ? ["generate_asset_version", "request_review"]
          : ["request_review"],
      );
    case "manual_republish_requested":
      return Object.freeze<ImpactAction[]>(["republish"]);
  }
}

function buildSkippedActions(
  event: PublicationEventEnvelope,
  impactLevel: ImpactLevel,
  requiredActions: readonly ImpactAction[],
): readonly ImpactAction[] {
  if (impactLevel === "no_impact") {
    return Object.freeze<ImpactAction[]>([]);
  }

  const skipped: ImpactAction[] = [];
  if (
    (event.eventType === "benchmark_created" ||
      event.eventType === "benchmark_updated" ||
      event.eventType === "benchmark_superseded") &&
    !requiredActions.includes("publish") &&
    !requiredActions.includes("republish")
  ) {
    skipped.push("publish", "republish");
  }

  if (
    event.eventType === "confidence_changed" &&
    !requiredActions.includes("generate_asset_version")
  ) {
    skipped.push("generate_asset_version");
  }

  return Object.freeze(uniqueSorted(skipped) as ImpactAction[]);
}

function buildContextFingerprint(
  event: PublicationEventEnvelope,
  matches: readonly ImpactedAssetMatch[],
  context: ImpactResolutionContext,
): string {
  const parts = matches
    .map((match) =>
      [
        match.asset.assetId,
        match.activeVersionId ?? "",
        [...match.locales].sort(compareStrings).join(","),
        [...match.channels].sort(compareStrings).join(","),
      ].join("|"),
    )
    .sort(compareStrings);

  const subjectKey = buildPublicationEventSubjectKey(
    event.subjectType,
    event.subjectId,
  );

  return createHash("sha256")
    .update(
      [
        subjectKey,
        context.currentFingerprints[subjectKey] ?? "",
        context.currentPolicyVersions[event.subjectId] ?? "",
        ...parts,
      ].join("||"),
    )
    .digest("hex");
}

export function buildImpactPlanId(input: Readonly<{
  event: PublicationEventEnvelope;
  impactedAssetIds: readonly string[];
  actions: readonly ImpactAction[];
  contextFingerprint: string;
}>): string {
  const hash = createHash("sha256")
    .update(
      [
        buildPublicationEventIdempotencyKey(input.event),
        [...input.impactedAssetIds].sort(compareStrings).join(","),
        [...input.actions].sort(compareStrings).join(","),
        input.contextFingerprint,
      ].join("||"),
    )
    .digest("hex");

  return `ipp_plan_${hash}`;
}

function estimateCost(
  requiredActions: readonly ImpactAction[],
  impactedAssets: readonly string[],
  impactedLocales: readonly string[],
  impactedChannels: readonly string[],
): number {
  return (
    requiredActions.reduce(
      (sum, action) => sum + (IMPACT_ACTION_COST[action] ?? 0),
      0,
    ) +
    impactedAssets.length +
    impactedLocales.length +
    impactedChannels.length
  );
}

export function resolveImpact(
  event: PublicationEventEnvelope,
  context: ImpactResolutionContext,
): ImpactPlan {
  const impactedMatches = findImpactedAssets(event, context);
  if (impactedMatches.length === 0) {
    return createNoImpactPlan(event, context, [
      buildReason(
        "no_lineage_match",
        "No asset lineage matched the event subject.",
        "lineage",
        {
          subjectType: event.subjectType,
          subjectId: event.subjectId,
        },
      ),
    ]);
  }

  if (isFingerprintShortCircuitEligible(event)) {
    const currentFingerprint = getCurrentSubjectFingerprint(event, context);
    if (
      currentFingerprint != null &&
      currentFingerprint === event.subjectFingerprint
    ) {
      return createNoImpactPlan(event, context, [
        buildReason(
          "unchanged_fingerprint",
          "The event fingerprint matches the current known fingerprint.",
          "fingerprint",
          {
            subjectType: event.subjectType,
            subjectId: event.subjectId,
          },
        ),
      ]);
    }
  }

  const impactLevel = determineImpactLevel(event, impactedMatches, context);
  const requiredActions = buildRequiredActions(
    event,
    impactLevel,
    impactedMatches,
  );
  const skippedActions = buildSkippedActions(
    event,
    impactLevel,
    requiredActions,
  );
  const visibleDelta = determineVisibleDelta(
    event,
    impactedMatches,
    impactLevel,
  );
  const governanceRequirement = determineGovernanceRequirement(
    event,
    impactLevel,
    requiredActions,
  );
  const impactedAssets = Object.freeze(
    impactedMatches.map((match) => match.asset.assetId),
  );
  const impactedVersions = uniqueSorted(
    impactedMatches
      .map((match) => match.activeVersionId)
      .filter((value): value is string => value != null),
  );
  const impactedLocales = uniqueSorted(
    impactedMatches.flatMap((match) => [...match.locales]),
  );
  const impactedChannels = uniqueSorted(
    impactedMatches.flatMap((match) => [...match.channels]),
  );
  const contextFingerprint = buildContextFingerprint(
    event,
    impactedMatches,
    context,
  );
  const planId = buildImpactPlanId({
    event,
    impactedAssetIds: impactedAssets,
    actions: requiredActions,
    contextFingerprint,
  });

  const reasons: ImpactReason[] = [];
  switch (event.eventType) {
    case "benchmark_created":
      reasons.push(
        buildReason(
          "benchmark_created",
          "A new benchmark source was linked to at least one asset.",
          "event",
        ),
      );
      break;
    case "benchmark_updated":
      reasons.push(
        buildReason(
          "benchmark_updated",
          "A benchmark source changed and requires content regeneration.",
          "event",
        ),
      );
      break;
    case "benchmark_superseded":
      reasons.push(
        buildReason(
          "benchmark_superseded",
          "A benchmark source was superseded.",
          "event",
          {
            supersededBySubjectId: event.metadata.supersededBySubjectId,
          },
        ),
      );
      if (requiredActions.includes("request_review")) {
        reasons.push(
          buildReason(
            "superseded_source_pending_approval",
            "The replacement source is not approved in the current context.",
            "governance",
            {
              supersededBySubjectId: event.metadata.supersededBySubjectId,
            },
          ),
        );
      }
      break;
    case "public_overview_approved":
      reasons.push(
        buildReason(
          "public_overview_approved",
          "A public overview became publishable.",
          "event",
        ),
      );
      break;
    case "public_overview_suppressed":
      reasons.push(
        buildReason(
          "public_overview_suppressed",
          "A public overview became non-publishable and requires suppression.",
          "event",
          {
            suppressionReason: event.metadata.suppressionReason,
          },
        ),
      );
      break;
    case "confidence_changed":
      reasons.push(
        buildReason(
          isConfidenceDecrease(
            event.metadata.previousConfidence,
            event.metadata.nextConfidence,
          )
            ? "confidence_decreased"
            : hasVisibleContentChange(event, impactedMatches)
              ? "confidence_increased_visible_change"
              : "confidence_increased_metadata_only",
          "The confidence state changed for at least one impacted asset.",
          "event",
          {
            previousConfidence: event.metadata.previousConfidence,
            nextConfidence: event.metadata.nextConfidence,
          },
        ),
      );
      break;
    case "freshness_expired":
      reasons.push(
        buildReason(
          impactLevel === "immediate_suppression_required"
            ? "freshness_expired_non_publishable"
            : "freshness_expired_keep_visible",
          "The freshness window expired for at least one impacted asset.",
          "event",
        ),
      );
      break;
    case "policy_version_changed":
      reasons.push(
        buildReason(
          impactLevel === "content_regeneration_required"
            ? "policy_version_changed_visible_change"
            : "policy_version_changed_review",
          "A policy version change affects the impacted assets.",
          "event",
          {
            policyName: event.metadata.policyName,
            previousVersion: event.metadata.previousVersion,
            nextVersion: event.metadata.nextVersion,
          },
        ),
      );
      break;
    case "manual_republish_requested":
      reasons.push(
        buildReason(
          "manual_republish_requested",
          "A manual republish request explicitly requires a full republish.",
          "event",
          {
            requestedBy: event.metadata.requestedBy,
          },
        ),
      );
      break;
  }

  const priority =
    impactLevel === "immediate_suppression_required" ? "P0" : event.priority;

  return Object.freeze({
    planId,
    triggerEventId: event.eventId,
    triggerEventType: event.eventType,
    triggerSubjectType: event.subjectType,
    triggerSubjectId: event.subjectId,
    triggerFingerprint: event.subjectFingerprint,
    impactLevel,
    visibleDelta,
    impactedAssets,
    impactedVersions,
    impactedLocales,
    impactedChannels,
    requiredActions,
    skippedActions,
    reasons: Object.freeze(reasons.map(freezeReason)),
    priority,
    governanceRequirement,
    estimatedCost: estimateCost(
      requiredActions,
      impactedAssets,
      impactedLocales,
      impactedChannels,
    ),
    createdAt: context.now(),
  });
}
