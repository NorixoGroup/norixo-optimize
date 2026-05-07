import type { ExtractedListing } from "@/lib/extractors/types";

export type BookingMoroccoRuleSet = "booking_morocco_riad" | "booking_morocco_villa" | "none";

export function detectBookingMoroccoRuleSet(target: ExtractedListing): BookingMoroccoRuleSet {
  if (target.platform !== "booking") return "none";
  const type = (target.propertyType ?? "").toLowerCase();
  if (type.includes("riad")) return "booking_morocco_riad";
  if (type.includes("villa")) return "booking_morocco_villa";
  return "none";
}

export function resolveBookingMoroccoCity(city: string | null) {
  if (!city) return null;
  const value = city
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (value === "fez" || value === "fes") return "fes";
  if (value === "marrakesh" || value === "marrakech") return "marrakech";
  if (value === "tanger" || value === "tangier") return "tangier";
  if (value === "sidi bouzid") return "sidi bouzid";
  return value;
}

export function matchBookingMoroccoGeo(targetCity: string | null, candidateCity: string | null) {
  return resolveBookingMoroccoCity(targetCity) === resolveBookingMoroccoCity(candidateCity);
}

export function adjustBookingMoroccoComparableType(type: string) {
  return type;
}

export function describeBookingMoroccoRuleApplication(ruleSet: BookingMoroccoRuleSet) {
  return ruleSet === "none" ? [] : [ruleSet];
}
