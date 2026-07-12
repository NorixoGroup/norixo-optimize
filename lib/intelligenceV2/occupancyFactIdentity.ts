import { createHmac } from "node:crypto";

import {
  INTELLIGENCE_FACT_IDENTITY_SECRET,
  getIntelligenceFactIdentitySecret,
  type OpaqueFactIdentityEnv,
} from "./opaqueFactIdentity";
import type {
  IntelligenceV2ObservedDaysBand,
  IntelligenceV2UnavailabilityRateBand,
} from "./occupancyFact";

export { INTELLIGENCE_FACT_IDENTITY_SECRET };

export type OccupancyFactIdentityInput = Readonly<{
  privateOccupancySignature?: string | null;
  marketCellKey?: string | null;
  capturePeriodBucket?: string | null;
  observedDaysBand?: IntelligenceV2ObservedDaysBand | null;
  unavailabilityRateBand?: IntelligenceV2UnavailabilityRateBand | null;
  transformationPolicyVersion?: string | null;
}>;

export type OccupancyFactIdentityResult =
  | Readonly<{
      ok: true;
      factKey: string;
    }>
  | Readonly<{
      ok: false;
      reason:
        | "missing_identity_secret"
        | "missing_private_signature"
        | "invalid_identity_input";
    }>;

const OBSERVED_DAYS_BANDS =
  new Set<IntelligenceV2ObservedDaysBand>([
    "1_6",
    "7_13",
    "14_29",
    "30_59",
    "60_plus",
  ]);

const UNAVAILABILITY_RATE_BANDS =
  new Set<IntelligenceV2UnavailabilityRateBand>([
    "0_19",
    "20_39",
    "40_59",
    "60_79",
    "80_100",
  ]);

function normalizeRequiredString(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function buildOccupancyFactIdentityMessage(
  input: OccupancyFactIdentityInput,
): string | null {
  const privateOccupancySignature =
    normalizeRequiredString(
      input.privateOccupancySignature,
    );
  const marketCellKey =
    normalizeRequiredString(input.marketCellKey);
  const capturePeriodBucket =
    normalizeRequiredString(input.capturePeriodBucket);
  const transformationPolicyVersion =
    normalizeRequiredString(
      input.transformationPolicyVersion,
    );

  if (
    privateOccupancySignature == null ||
    marketCellKey == null ||
    capturePeriodBucket == null ||
    transformationPolicyVersion == null ||
    input.observedDaysBand == null ||
    !OBSERVED_DAYS_BANDS.has(input.observedDaysBand) ||
    input.unavailabilityRateBand == null ||
    !UNAVAILABILITY_RATE_BANDS.has(
      input.unavailabilityRateBand,
    )
  ) {
    return null;
  }

  return [
    `signature=${privateOccupancySignature}`,
    "metric_family=occupancy",
    `market_cell=${marketCellKey}`,
    `period=${capturePeriodBucket}`,
    `observed_days_band=${input.observedDaysBand}`,
    `unavailability_rate_band=${input.unavailabilityRateBand}`,
    `transformation=${transformationPolicyVersion}`,
  ].join("\n");
}

export function buildOpaqueOccupancyFactKey(
  input: OccupancyFactIdentityInput,
  env: OpaqueFactIdentityEnv = process.env,
): OccupancyFactIdentityResult {
  const secret = getIntelligenceFactIdentitySecret(env);

  if (secret == null) {
    return {
      ok: false,
      reason: "missing_identity_secret",
    };
  }

  if (
    normalizeRequiredString(
      input.privateOccupancySignature,
    ) == null
  ) {
    return {
      ok: false,
      reason: "missing_private_signature",
    };
  }

  const message =
    buildOccupancyFactIdentityMessage(input);

  if (message == null) {
    return {
      ok: false,
      reason: "invalid_identity_input",
    };
  }

  return {
    ok: true,
    factKey: `ifv2_occupancy_${createHmac(
      "sha256",
      secret,
    )
      .update(message)
      .digest("hex")}`,
  };
}
