/**
 * Normalisation des URLs Booking.com pour forcer des dates de séjour (prix souvent absents sans check-in/out).
 *
 * Limite : même avec des dates valides, Booking peut servir une page challenge, une disponibilité vide
 * ou un DOM partiel — un prix exploitable n’est alors pas garanti (voir aussi la détection challenge côté extracteur).
 */

const ISO_STAY_DATE = /^\d{4}-\d{2}-\d{2}$/;

function getLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDaysToLocalIsoDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, (month ?? 1) - 1, day ?? 1);
  date.setDate(date.getDate() + days);
  return getLocalIsoDate(date);
}

function isBookingHost(hostname: string): boolean {
  return /(^|\.)booking\.com$/i.test(hostname);
}

function hasValidStayDatesInParams(searchParams: URLSearchParams): boolean {
  const checkin = searchParams.get("checkin")?.trim() ?? "";
  const checkout = searchParams.get("checkout")?.trim() ?? "";
  return (
    Boolean(checkin && checkout) &&
    ISO_STAY_DATE.test(checkin) &&
    ISO_STAY_DATE.test(checkout)
  );
}

/** true si l’URL porte déjà checkin + checkout au format YYYY-MM-DD. */
export function bookingUrlHasStayDates(url: string): boolean {
  try {
    return hasValidStayDatesInParams(new URL(url).searchParams);
  } catch {
    return false;
  }
}

/**
 * Ajoute checkin/checkout et paramètres de séjour si absents.
 * Ne remplace pas des dates déjà présentes ; complète seulement adults / chambres / devise si manquants.
 */
export function buildBookingUrlWithDates(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  if (!isBookingHost(parsed.hostname)) {
    return url;
  }

  const sp = parsed.searchParams;

  if (hasValidStayDatesInParams(sp)) {
    if (!sp.get("group_adults")) sp.set("group_adults", "2");
    if (!sp.get("no_rooms")) sp.set("no_rooms", "1");
    if (!sp.get("group_children")) sp.set("group_children", "0");
    if (!sp.get("selected_currency")) sp.set("selected_currency", "EUR");
    return parsed.toString();
  }

  const checkIn = new Date();
  checkIn.setDate(checkIn.getDate() + 7);
  const checkinStr = getLocalIsoDate(checkIn);
  const checkoutStr = addDaysToLocalIsoDate(checkinStr, 3);

  sp.set("checkin", checkinStr);
  sp.set("checkout", checkoutStr);
  sp.set("group_adults", "2");
  sp.set("no_rooms", "1");
  sp.set("group_children", "0");
  sp.set("selected_currency", "EUR");

  return parsed.toString();
}
