import type { BacklinkAutonomyIgmsPilotConfig } from "./backlink-autonomy-igms-pilot";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** No default selector and no implicit enablement: both values must be explicit. */
export function readBacklinkAutonomyIgmsPilotRuntimeConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): BacklinkAutonomyIgmsPilotConfig {
  const promotionApplicationId = env.BACKLINK_AUTONOMY_PILOT_PROMOTION_APPLICATION_ID;
  return {
    enabled: env.BACKLINK_AUTONOMY_IGMS_PILOT_ENABLED === "true",
    promotionApplicationId: promotionApplicationId != null && uuid.test(promotionApplicationId) ? promotionApplicationId : null,
  };
}
