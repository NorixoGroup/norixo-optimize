export type BacklinkDiscoveryQualificationResumeCronEnvironment = {
  CRON_SECRET?: string;
  BACKLINK_DISCOVERY_QUALIFICATION_RESUME_CRON_ENABLED?: string;
};

export function isBacklinkDiscoveryQualificationResumeCronEnabled(
  environment: BacklinkDiscoveryQualificationResumeCronEnvironment,
): boolean {
  return environment.BACKLINK_DISCOVERY_QUALIFICATION_RESUME_CRON_ENABLED === "true";
}

export function hasValidBacklinkDiscoveryQualificationResumeCronAuthorization(
  authorization: string | null,
  environment: BacklinkDiscoveryQualificationResumeCronEnvironment,
): boolean {
  const secret = environment.CRON_SECRET ?? "";
  return secret.length > 0 && authorization === `Bearer ${secret}`;
}
