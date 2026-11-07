/** Strict global kill switches: only the exact lower-case string enables either capability. */
export type BacklinkAutonomyRuntimeConfig = {
  autonomyEnabled: boolean;
  /** Independent, paid-provider authorization. Closed by default even when autonomy is enabled. */
  paidMailboxVerificationAuthorized?: boolean;
};

export function readBacklinkAutonomyRuntimeConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): BacklinkAutonomyRuntimeConfig {
  return {
    autonomyEnabled: env.BACKLINK_AUTONOMY_ENABLED === "true",
    paidMailboxVerificationAuthorized:
      env.BACKLINK_ZEROBOUNCE_PAID_VERIFICATION_ENABLED === "true",
  };
}
