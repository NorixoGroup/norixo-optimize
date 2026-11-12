/** Dedicated, off-by-default kill switch, independent of BACKLINK_AUTONOMY_ENABLED. */
export function isBacklinkContactSelectionResumeEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return env.BACKLINK_CONTACT_SELECTION_RESUME_ENABLED === "true";
}
