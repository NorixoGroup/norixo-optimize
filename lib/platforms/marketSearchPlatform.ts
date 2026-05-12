import type { SupportedPlatform } from "@/lib/extractors/types";

/**
 * Plateforme utilisée uniquement pour la recherche de comparables marché.
 *
 * Important :
 * - Ne remplace pas la plateforme affichée à l'utilisateur.
 * - Ne remplace pas la plateforme réelle de l'extracteur cible.
 */
export type MarketSearchPlatform = "airbnb" | "booking";

function normalizePlatformToken(platform: string | null | undefined): string {
  return typeof platform === "string" ? platform.trim().toLowerCase() : "";
}

export function resolveMarketSearchPlatform(
  platform: SupportedPlatform | string | null | undefined
): MarketSearchPlatform {
  const normalized = normalizePlatformToken(platform);

  if (normalized === "airbnb") {
    return "airbnb";
  }

  if (
    normalized === "booking" ||
    normalized === "vrbo" ||
    normalized === "agoda" ||
    normalized === "expedia"
  ) {
    return "booking";
  }

  return "booking";
}

export function usesBookingMarketSearch(
  platform: SupportedPlatform | string | null | undefined
): boolean {
  return resolveMarketSearchPlatform(platform) === "booking";
}

/*
Mini diagnostic manuel attendu :
- airbnb => airbnb
- booking => booking
- vrbo => booking
- agoda => booking
- expedia => booking
*/
