export type BacklinkOutreachLiveAutoSendCronEnvironment = {
  CRON_SECRET?: string;
  BACKLINK_LIVE_AUTO_SEND_CRON_ENABLED?: string;
};

export function isBacklinkOutreachLiveAutoSendCronEnabled(
  environment: BacklinkOutreachLiveAutoSendCronEnvironment,
): boolean {
  return environment.BACKLINK_LIVE_AUTO_SEND_CRON_ENABLED === "true";
}

export function hasValidBacklinkOutreachLiveAutoSendCronAuthorization(
  authorization: string | null,
  environment: BacklinkOutreachLiveAutoSendCronEnvironment,
): boolean {
  const secret = environment.CRON_SECRET ?? "";
  return secret.length > 0 && authorization === `Bearer ${secret}`;
}
