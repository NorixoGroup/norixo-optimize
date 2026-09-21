/** Strict global kill switch: only the exact lower-case string enables it. */
export type BacklinkAutonomyRuntimeConfig = { autonomyEnabled: boolean };

export function readBacklinkAutonomyRuntimeConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): BacklinkAutonomyRuntimeConfig {
  return { autonomyEnabled: env.BACKLINK_AUTONOMY_ENABLED === "true" };
}
