/** Off by default, independent of BACKLINK_AUTONOMY_ENABLED. */
export function isBacklinkPromotionAutoApplyEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return env.BACKLINK_PROMOTION_AUTO_APPLY_ENABLED === "true";
}
