/**
 * Injecte ou remplace les dates de séjour dans une URL Airbnb / Booking.
 * Autres plateformes : retourne l’URL inchangée.
 * Ne supprime pas les autres paramètres de requête.
 */

const ISO_STAY_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isAirbnbHost(hostname: string): boolean {
  return hostname.toLowerCase().includes("airbnb.");
}

function isBookingHost(hostname: string): boolean {
  return /(^|\.)booking\.com$/i.test(hostname);
}

export function applyStayDatesToListingUrl(
  url: string,
  dates: { checkIn: string; checkOut: string } | null | undefined
): string {
  const trimmed = url.trim();
  if (!dates?.checkIn || !dates.checkOut) return trimmed;
  const checkIn = dates.checkIn.trim();
  const checkOut = dates.checkOut.trim();
  if (!ISO_STAY_DATE.test(checkIn) || !ISO_STAY_DATE.test(checkOut)) return trimmed;
  if (checkOut <= checkIn) return trimmed;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return trimmed;
  }

  const host = parsed.hostname;
  if (isAirbnbHost(host)) {
    parsed.searchParams.set("check_in", checkIn);
    parsed.searchParams.set("check_out", checkOut);
    if (!parsed.searchParams.get("adults")) {
      parsed.searchParams.set("adults", "1");
    }
    return parsed.toString();
  }

  if (isBookingHost(host)) {
    parsed.searchParams.set("checkin", checkIn);
    parsed.searchParams.set("checkout", checkOut);
    if (!parsed.searchParams.get("group_adults")) {
      parsed.searchParams.set("group_adults", "1");
    }
    return parsed.toString();
  }

  return trimmed;
}
