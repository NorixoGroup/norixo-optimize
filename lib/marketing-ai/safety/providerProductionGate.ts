// Centralized, closed-by-default production gate for Norixo AI / Marketing
// Studio. NODE_ENV is not a reliable signal here: Vercel builds Preview
// deployments with NODE_ENV=production too, so only VERCEL_ENV distinguishes
// Preview from Production. Any environment where VERCEL_ENV is missing,
// unexpected, or anything other than exactly "production" (local dev, CI,
// Preview, Test, a standalone worker process with no Vercel runtime) is
// treated as non-Production and must stay closed.
export const MARKETING_STUDIO_NON_PRODUCTION_ERROR = "non_production_environment";

export const MARKETING_STUDIO_NON_PRODUCTION_MESSAGE =
  "This operation is disabled outside Production.";

export function isVercelProductionEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.VERCEL_ENV === "production";
}
