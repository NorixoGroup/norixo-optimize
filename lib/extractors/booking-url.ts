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

const MAX_BOOKING_STAY_NIGHTS_FOR_PRICE = 60;

/**
 * Nuits de séjour à partir de checkin/checkout (YYYY-MM-DD) dans l’URL.
 * Retourne null si absent, invalide, ≤ 0 ou > 60.
 */
export function parseBookingStayNightsFromUrl(url: string): number | null {
  try {
    const sp = new URL(url.trim()).searchParams;
    const checkin = sp.get("checkin")?.trim() ?? "";
    const checkout = sp.get("checkout")?.trim() ?? "";
    if (!ISO_STAY_DATE.test(checkin) || !ISO_STAY_DATE.test(checkout)) {
      return null;
    }
    const [y0, mo0, d0] = checkin.split("-").map(Number);
    const [y1, mo1, d1] = checkout.split("-").map(Number);
    if ([y0, mo0, d0, y1, mo1, d1].some((n) => !Number.isFinite(n))) return null;
    const t0 = Date.UTC(y0, mo0 - 1, d0);
    const t1 = Date.UTC(y1, mo1 - 1, d1);
    const nights = Math.round((t1 - t0) / 86400000);
    if (!Number.isFinite(nights) || nights <= 0 || nights > MAX_BOOKING_STAY_NIGHTS_FOR_PRICE) {
      return null;
    }
    return nights;
  } catch {
    return null;
  }
}

/** true si l’URL porte déjà checkin + checkout au format YYYY-MM-DD. */
export function bookingUrlHasStayDates(url: string): boolean {
  try {
    return hasValidStayDatesInParams(new URL(url).searchParams);
  } catch {
    return false;
  }
}

/** Paramètres de requête conservés sur les URLs Booking après nettoyage (le reste est supprimé). */
const BOOKING_CANONICAL_QUERY_KEYS = [
  "checkin",
  "checkout",
  "group_adults",
  "group_children",
  "no_rooms",
  "selected_currency",
] as const;

/**
 * Booking uniquement : `origin + pathname` + whitelist de search params (`checkin` / `checkout`, occupation, devise).
 * Retire hash et tous les autres paramètres (tracking, etc.).
 * Hors Booking : renvoie l’URL brute inchangée.
 */
export function cleanBookingCanonicalUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return rawUrl;
  }
  if (!isBookingHost(parsed.hostname)) {
    return rawUrl;
  }
  parsed.hash = "";
  const next = new URLSearchParams();
  const src = parsed.searchParams;
  for (const key of BOOKING_CANONICAL_QUERY_KEYS) {
    const v = src.get(key);
    if (v != null && v.trim() !== "") {
      next.set(key, v);
    }
  }
  parsed.search = next.toString();
  return parsed.toString();
}

/**
 * Ajoute checkin/checkout et paramètres de séjour si absents.
 * Appeler sur une URL déjà canonique (sinon utiliser cleanBookingCanonicalUrl avant).
 * Complète seulement adults / chambres / devise si manquants lorsque des dates sont déjà présentes.
 * Si `preferStayParamsFromUrl` (URL de l’annonce cible avec dates) porte déjà checkin/checkout,
 * les recopie sur les URLs sans dates (alignement séjour avec le formulaire d’audit).
 */
export function buildBookingUrlWithDates(url: string, preferStayParamsFromUrl?: string | null): string {
  const cleanedUrl = cleanBookingCanonicalUrl(url);
  if (process.env.DEBUG_MARKET_PIPELINE === "true") {
    console.log(
      "[market][booking-url-cleaned]",
      JSON.stringify({
        originalUrl: url,
        cleanedUrl,
        changed: url !== cleanedUrl,
      })
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(cleanedUrl);
  } catch {
    return cleanedUrl;
  }

  if (!isBookingHost(parsed.hostname)) {
    return cleanedUrl;
  }

  const sp = parsed.searchParams;

  if (preferStayParamsFromUrl?.trim()) {
    try {
      const prefParsed = new URL(cleanBookingCanonicalUrl(preferStayParamsFromUrl.trim()));
      const prefSp = prefParsed.searchParams;
      if (hasValidStayDatesInParams(prefSp) && !hasValidStayDatesInParams(sp)) {
        for (const key of BOOKING_CANONICAL_QUERY_KEYS) {
          const v = prefSp.get(key);
          if (v != null && v.trim() !== "") {
            sp.set(key, v);
          }
        }
      }
    } catch {
      // ignore malformed listing URL
    }
  }

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
