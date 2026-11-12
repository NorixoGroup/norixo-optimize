/** Off by default, independent of BACKLINK_AUTONOMY_ENABLED and of Lot A's own flag. */
export function isBacklinkCampaignApplyAuthorizationEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return env.BACKLINK_CAMPAIGN_APPLY_AUTHORIZATION_ENABLED === "true";
}
