import { createHmac } from "node:crypto";

export const INTELLIGENCE_FACT_IDENTITY_SECRET =
  "INTELLIGENCE_FACT_IDENTITY_SECRET";

export type OpaqueFactIdentityEnv = Readonly<Record<string, string | undefined>>;

export type OpaqueFactIdentityInput = Readonly<{
  privateComparableSignature?: string | null;
  marketCellKey?: string | null;
  capturePeriodBucket?: string | null;
  normalizedNightlyPrice?: number | null;
  transformationPolicyVersion?: string | null;
}>;

export type OpaqueFactIdentityResult =
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

function normalizeRequiredString(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function formatNormalizedNightlyPrice(value: number | null | undefined): string | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value.toFixed(2);
}

export function getIntelligenceFactIdentitySecret(
  env: OpaqueFactIdentityEnv = process.env,
): string | null {
  return normalizeRequiredString(env[INTELLIGENCE_FACT_IDENTITY_SECRET]);
}

export function buildOpaqueFactIdentityMessage(
  input: OpaqueFactIdentityInput,
): string | null {
  const privateComparableSignature = normalizeRequiredString(
    input.privateComparableSignature,
  );
  const marketCellKey = normalizeRequiredString(input.marketCellKey);
  const capturePeriodBucket = normalizeRequiredString(input.capturePeriodBucket);
  const normalizedNightlyPrice = formatNormalizedNightlyPrice(
    input.normalizedNightlyPrice,
  );
  const transformationPolicyVersion = normalizeRequiredString(
    input.transformationPolicyVersion,
  );

  if (
    privateComparableSignature == null ||
    marketCellKey == null ||
    capturePeriodBucket == null ||
    normalizedNightlyPrice == null ||
    transformationPolicyVersion == null
  ) {
    return null;
  }

  return [
    `signature=${privateComparableSignature}`,
    `market_cell=${marketCellKey}`,
    `period=${capturePeriodBucket}`,
    `nightly_price=${normalizedNightlyPrice}`,
    `transformation=${transformationPolicyVersion}`,
  ].join("\n");
}

export function buildOpaqueFactKey(
  input: OpaqueFactIdentityInput,
  env: OpaqueFactIdentityEnv = process.env,
): OpaqueFactIdentityResult {
  const secret = getIntelligenceFactIdentitySecret(env);
  if (secret == null) {
    return { ok: false, reason: "missing_identity_secret" };
  }

  const privateComparableSignature = normalizeRequiredString(
    input.privateComparableSignature,
  );
  if (privateComparableSignature == null) {
    return { ok: false, reason: "missing_private_signature" };
  }

  const message = buildOpaqueFactIdentityMessage(input);
  if (message == null) {
    return { ok: false, reason: "invalid_identity_input" };
  }

  return {
    ok: true,
    factKey: `ifv2_${createHmac("sha256", secret).update(message).digest("hex")}`,
  };
}
