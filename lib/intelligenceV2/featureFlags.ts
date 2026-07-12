export const ENABLE_INTELLIGENCE_FACT_TRANSFORMATION =
  "ENABLE_INTELLIGENCE_FACT_TRANSFORMATION";
export const ENABLE_INTELLIGENCE_FACT_CONTRIBUTION =
  "ENABLE_INTELLIGENCE_FACT_CONTRIBUTION";
export const ENABLE_INTELLIGENCE_BENCHMARK_COMPUTATION =
  "ENABLE_INTELLIGENCE_BENCHMARK_COMPUTATION";
export const ENABLE_INTELLIGENCE_BENCHMARK_CONSUMPTION =
  "ENABLE_INTELLIGENCE_BENCHMARK_CONSUMPTION";
export const DEBUG_INTELLIGENCE_V2 = "DEBUG_INTELLIGENCE_V2";

export type IntelligenceV2FeatureFlags = Readonly<{
  ENABLE_INTELLIGENCE_FACT_TRANSFORMATION: boolean;
  ENABLE_INTELLIGENCE_FACT_CONTRIBUTION: boolean;
  ENABLE_INTELLIGENCE_BENCHMARK_COMPUTATION: boolean;
  ENABLE_INTELLIGENCE_BENCHMARK_CONSUMPTION: boolean;
  DEBUG_INTELLIGENCE_V2: boolean;
}>;

export type IntelligenceV2FeatureFlagEnv = Readonly<
  Record<string, string | undefined>
>;

export function parseIntelligenceV2BooleanFlag(
  value: string | null | undefined,
): boolean {
  return typeof value === "string" && value.trim().toLowerCase() === "true";
}

export function getIntelligenceV2FeatureFlags(
  env: IntelligenceV2FeatureFlagEnv = process.env,
): IntelligenceV2FeatureFlags {
  return Object.freeze({
    ENABLE_INTELLIGENCE_FACT_TRANSFORMATION: parseIntelligenceV2BooleanFlag(
      env[ENABLE_INTELLIGENCE_FACT_TRANSFORMATION],
    ),
    ENABLE_INTELLIGENCE_FACT_CONTRIBUTION: parseIntelligenceV2BooleanFlag(
      env[ENABLE_INTELLIGENCE_FACT_CONTRIBUTION],
    ),
    ENABLE_INTELLIGENCE_BENCHMARK_COMPUTATION: parseIntelligenceV2BooleanFlag(
      env[ENABLE_INTELLIGENCE_BENCHMARK_COMPUTATION],
    ),
    ENABLE_INTELLIGENCE_BENCHMARK_CONSUMPTION: parseIntelligenceV2BooleanFlag(
      env[ENABLE_INTELLIGENCE_BENCHMARK_CONSUMPTION],
    ),
    DEBUG_INTELLIGENCE_V2: parseIntelligenceV2BooleanFlag(
      env[DEBUG_INTELLIGENCE_V2],
    ),
  });
}
