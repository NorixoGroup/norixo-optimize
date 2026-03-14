import { extractAirbnb } from "./airbnb";
import { extractBooking } from "./booking";
import { extractVrbo } from "./vrbo";
import type { ExtractedListing, SupportedPlatform } from "./types";

export function detectPlatform(url: string): SupportedPlatform {
  const lower = url.toLowerCase();

  if (lower.includes("airbnb.")) return "airbnb";
  if (lower.includes("booking.")) return "booking";
  if (lower.includes("vrbo.") || lower.includes("homeaway.")) return "vrbo";

  return "other";
}

export async function extractListing(url: string): Promise<ExtractedListing> {
  const platform = detectPlatform(url);

  switch (platform) {
    case "airbnb":
      return extractAirbnb(url);
    case "booking":
      return extractBooking(url);
    case "vrbo":
      return extractVrbo(url);
    default:
      throw new Error(`Unsupported platform for URL: ${url}`);
  }
}