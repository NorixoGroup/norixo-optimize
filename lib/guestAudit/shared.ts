export type GuestSupportedPlatform = "airbnb" | "booking" | "vrbo" | "agoda" | "expedia" | "other";
import type { ExtractedListing } from "@/lib/extractors/types";

type DetectedSite = {
  platformCategory: GuestSupportedPlatform;
  detectedSiteLabel: string;
};

type CanonicalGuestUrl = {
  normalizedUrl: string;
  hostname: string;
  pathname: string;
  platformCategory: GuestSupportedPlatform;
  detectedSiteLabel: string;
};

function isVrboFamilyHostname(hostname: string): boolean {
  return /^(?:.+\.)?(?:vrbo|homeaway|abritel)\.[a-z.]+$/i.test(hostname);
}

function isVrboLikeExpediaHost(hostname: string): boolean {
  return /^(?:.+\.)?(?:expedia|hotels)\.[a-z.]+$/i.test(hostname);
}

function isVrboLikeExpediaPath(pathname: string): boolean {
  return [
    "vacation-rental",
    "vacation-rentals",
    "private-vacation-home",
    "holiday-home",
    "ferienhaus",
    "whole-home",
    "abritel",
    "vrbo",
    "homeaway",
  ].some((needle) => pathname.toLowerCase().includes(needle));
}

const URL_INCOMPLETE_MESSAGE =
  "URL incomplete : merci de coller l'URL publique complete de l'annonce.";
const URL_INVALID_MESSAGE =
  "URL invalide : cette adresse ne correspond pas a une page d'annonce exploitable.";
const PLATFORM_UNSUPPORTED_MESSAGE =
  "Plateforme non reconnue : seules certaines pages Airbnb / Booking / Vrbo / Agoda sont acceptees.";
const PAGE_UNUSABLE_MESSAGE =
  "Page non exploitable : les donnees necessaires n'ont pas pu etre extraites.";
const AIRBNB_INVALID_MESSAGE = [
  "Lien non valide. Merci de coller le lien complet de l'annonce Airbnb.",
  "Exemples de liens valides :",
  "https://www.airbnb.com/rooms/12345",
  "https://www.airbnb.fr/rooms/12345",
].join("\n");
const AIRBNB_SHORT_LINK_MESSAGE = [
  "Lien non valide. Merci de coller le lien complet de l'annonce Airbnb.",
  "Exemples de liens valides :",
  "https://www.airbnb.com/rooms/12345",
  "https://www.airbnb.fr/rooms/12345",
  "Les liens courts Airbnb ne sont pas supportes. Ouvrez l'annonce et copiez l'URL complete depuis votre navigateur.",
].join("\n");

const LOCALE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bMorocco\b/gi, "Maroc"],
  [/\bMarruecos\b/gi, "Maroc"],
  [/\bSpain\b/gi, "Espagne"],
  [/\bEspana\b/gi, "Espagne"],
  [/\bMarrakesh\b/gi, "Marrakech"],
];

function ensureGuestUrlProtocol(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  if (/^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (/^(?:www\.)?[a-z0-9-]+\.[a-z.]{2,}(?:\/|$)/i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return trimmed;
}

function getKnownSiteFromHostname(hostname: string): DetectedSite {
  const normalizedHostname = hostname.toLowerCase().replace(/^www\./, "");

  if (/^(.+\.)?airbnb\.[a-z.]+$/i.test(normalizedHostname)) {
    return { platformCategory: "airbnb", detectedSiteLabel: "Airbnb" };
  }

  if (/^(.+\.)?booking\.[a-z.]+$/i.test(normalizedHostname)) {
    return { platformCategory: "booking", detectedSiteLabel: "Booking" };
  }

  if (isVrboFamilyHostname(normalizedHostname)) {
    return { platformCategory: "vrbo", detectedSiteLabel: "Vrbo" };
  }

  if (/^(.+\.)?agoda\.[a-z.]+$/i.test(normalizedHostname)) {
    return { platformCategory: "agoda", detectedSiteLabel: "Agoda" };
  }

  if (/^(.+\.)?expedia\.[a-z.]+$/i.test(normalizedHostname)) {
    return { platformCategory: "expedia", detectedSiteLabel: "Expedia" };
  }

  if (/^(.+\.)?houfy\.[a-z.]+$/i.test(normalizedHostname)) {
    return { platformCategory: "other", detectedSiteLabel: "Houfy" };
  }

  if (/^(.+\.)?tripadvisor\.[a-z.]+$/i.test(normalizedHostname)) {
    return { platformCategory: "other", detectedSiteLabel: "Tripadvisor" };
  }

  if (/^(.+\.)?gites\.[a-z.]+$/i.test(normalizedHostname)) {
    return { platformCategory: "other", detectedSiteLabel: "Gites.fr" };
  }

  return { platformCategory: "other", detectedSiteLabel: "Site non reconnu" };
}

function canonicalizeGuestPath(platform: GuestSupportedPlatform, pathname: string): string {
  const trimmedPath = pathname.replace(/\/+$/, "") || "/";

  if (platform === "airbnb") {
    const roomMatch = trimmedPath.match(/\/rooms\/(\d+)/i);
    return roomMatch ? `/rooms/${roomMatch[1]}` : trimmedPath;
  }

  if (platform === "booking") {
    const hotelMatch = trimmedPath.match(/(\/hotel\/[^?#]+)/i);
    return hotelMatch ? hotelMatch[1].replace(/\/+$/, "") : trimmedPath;
  }

  if (platform === "vrbo") {
    const vrboMatch = trimmedPath.match(/^\/p\/([a-z0-9]+)$/i);
    return vrboMatch ? `/p/${vrboMatch[1]}` : trimmedPath;
  }

  if (platform === "agoda") {
    return trimmedPath;
  }

  return trimmedPath;
}

function getCanonicalHostname(platform: GuestSupportedPlatform, hostname: string): string {
  if (platform === "airbnb") return "www.airbnb.com";
  if (platform === "booking") return "www.booking.com";
  if (platform === "vrbo") {
    return hostname.toLowerCase();
  }
  if (platform === "agoda") return "www.agoda.com";
  return hostname.toLowerCase();
}

function canonicalizeGuestUrl(input: string): CanonicalGuestUrl | null {
  const withProtocol = ensureGuestUrlProtocol(input);
  if (!withProtocol) return null;

  let parsed: URL;

  try {
    parsed = new URL(withProtocol);
  } catch {
    return null;
  }

  if (!["https:", "http:"].includes(parsed.protocol)) {
    return null;
  }

  let site = getKnownSiteFromHostname(parsed.hostname);
  if (
    site.platformCategory === "other" &&
    isVrboLikeExpediaHost(parsed.hostname.toLowerCase()) &&
    isVrboLikeExpediaPath(parsed.pathname)
  ) {
    site = { platformCategory: "vrbo", detectedSiteLabel: "Vrbo" };
  }
  const pathname = canonicalizeGuestPath(site.platformCategory, parsed.pathname);
  const canonicalHostname = getCanonicalHostname(site.platformCategory, parsed.hostname);

  parsed.protocol = "https:";
  parsed.hostname = canonicalHostname;
  parsed.hash = "";
  parsed.search = "";
  parsed.pathname = pathname;

  return {
    normalizedUrl: parsed.toString(),
    hostname: parsed.hostname.toLowerCase(),
    pathname,
    platformCategory: site.platformCategory,
    detectedSiteLabel: site.detectedSiteLabel,
  };
}

export function detectPlatformFromUrl(url: string): GuestSupportedPlatform {
  return detectSiteFromUrl(url).platformCategory;
}

export function detectSiteFromUrl(url: string): DetectedSite {
  const canonical = canonicalizeGuestUrl(url);

  if (!canonical) {
    return { platformCategory: "other", detectedSiteLabel: "Site non reconnu" };
  }

  return {
    platformCategory: canonical.platformCategory,
    detectedSiteLabel: canonical.detectedSiteLabel,
  };
}

export function normalizeGuestListingUrl(url: string): string {
  const canonical = canonicalizeGuestUrl(url);
  if (!canonical) {
    throw new Error("Invalid guest listing URL");
  }

  return canonical.normalizedUrl;
}

export function validateGuestListingUrl(input: string): {
  valid: boolean;
  platform: GuestSupportedPlatform;
  reason?: string;
  normalizedUrl?: string;
} {
  const trimmed = input.trim();

  if (!trimmed) {
    return { valid: false, platform: "other", reason: URL_INVALID_MESSAGE };
  }

  const canonical = canonicalizeGuestUrl(trimmed);

  if (!canonical) {
    return { valid: false, platform: "other", reason: URL_INVALID_MESSAGE };
  }

  const { hostname, pathname, platformCategory: platform, normalizedUrl } = canonical;

  if (platform === "booking") {
    if (!hostname.endsWith("booking.com")) {
      return { valid: false, platform, reason: PLATFORM_UNSUPPORTED_MESSAGE };
    }

    if (pathname === "/" || pathname === "/hotel" || /^\/hotel\/?$/i.test(pathname)) {
      return { valid: false, platform, reason: URL_INCOMPLETE_MESSAGE };
    }

    if (/^\/hotel\/[^/]+$/i.test(pathname)) {
      return { valid: false, platform, reason: URL_INCOMPLETE_MESSAGE };
    }

    if (!/^\/hotel\/[^/]+\/[^/?#]+/i.test(pathname)) {
      return { valid: false, platform, reason: URL_INVALID_MESSAGE };
    }
  } else if (platform === "airbnb") {
    if (!hostname.endsWith("airbnb.com")) {
      return { valid: false, platform, reason: PLATFORM_UNSUPPORTED_MESSAGE };
    }

    if (pathname === "/" || pathname === "/rooms" || /^\/rooms\/?$/i.test(pathname)) {
      return { valid: false, platform, reason: AIRBNB_INVALID_MESSAGE };
    }

    if (
      /^\/h(?:\/|$)/i.test(pathname) ||
      /^\/hosting(?:\/|$)/i.test(pathname) ||
      /^\/wishlists(?:\/|$)/i.test(pathname) ||
      /^\/experiences(?:\/|$)/i.test(pathname)
    ) {
      return {
        valid: false,
        platform,
        reason: /^\/h(?:\/|$)/i.test(pathname)
          ? AIRBNB_SHORT_LINK_MESSAGE
          : AIRBNB_INVALID_MESSAGE,
      };
    }

    if (!/^\/rooms\/\d+$/i.test(pathname)) {
      return { valid: false, platform, reason: AIRBNB_INVALID_MESSAGE };
    }
  } else if (platform === "vrbo") {
    const isVrboHost =
      hostname.endsWith("vrbo.com") ||
      hostname.includes(".homeaway.") ||
      hostname.endsWith("homeaway.com") ||
      hostname.includes(".abritel.") ||
      hostname.endsWith("abritel.fr") ||
      hostname.endsWith("abritel.com");
    const isVrboExpediaPage =
      (hostname.endsWith("expedia.com") || hostname.endsWith("hotels.com")) &&
      isVrboLikeExpediaPath(pathname);

    if (!isVrboHost && !isVrboExpediaPage) {
      return { valid: false, platform, reason: PLATFORM_UNSUPPORTED_MESSAGE };
    }

    if (pathname === "/" || pathname === "/fr-fr" || pathname === "/en-gb") {
      return { valid: false, platform, reason: URL_INCOMPLETE_MESSAGE };
    }

    const isVrboListingPath =
      /^\/p\/[a-z0-9]+$/i.test(pathname) ||
      /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:location\/)?p\/?[a-z0-9]+$/i.test(pathname);

    if (hostname.endsWith("vrbo.com") && !isVrboListingPath) {
      return { valid: false, platform, reason: URL_INVALID_MESSAGE };
    }

    if (!hostname.endsWith("vrbo.com") && pathname.length < 3) {
      return { valid: false, platform, reason: URL_INVALID_MESSAGE };
    }
  } else if (platform === "agoda") {
    if (!hostname.endsWith("agoda.com")) {
      return { valid: false, platform, reason: PLATFORM_UNSUPPORTED_MESSAGE };
    }

    if (pathname === "/" || pathname.length < 2) {
      return { valid: false, platform, reason: URL_INCOMPLETE_MESSAGE };
    }
  } else if (platform === "expedia") {
    if (!hostname.endsWith("expedia.com") && !hostname.endsWith("expedia.fr")) {
      return { valid: false, platform, reason: PLATFORM_UNSUPPORTED_MESSAGE };
    }
    if (pathname === "/" || pathname.length < 2) {
      return { valid: false, platform, reason: URL_INCOMPLETE_MESSAGE };
    }
  } else {
    return { valid: false, platform, reason: PLATFORM_UNSUPPORTED_MESSAGE };
  }

  return {
    valid: true,
    platform,
    normalizedUrl,
  };
}

export function validateExtractedGuestListing(listing: ExtractedListing): {
  valid: boolean;
  reason?: string;
} {
  const normalizedTitle = listing.title?.trim() ?? "";
  const hasTitle = Boolean(normalizedTitle);
  const hasDescription = Boolean(listing.description?.trim());
  const hasPhotos = Array.isArray(listing.photos) && listing.photos.filter(Boolean).length > 0;
  const isVrbo = listing.platform === "vrbo" || listing.sourcePlatform === "vrbo";
  const hasPhotoEvidence =
    hasPhotos ||
    (isVrbo &&
      ((typeof listing.photosCount === "number" && listing.photosCount > 0) ||
        (typeof listing.photoMeta?.count === "number" && listing.photoMeta.count > 0)));
  const hasAmenities =
    Array.isArray(listing.amenities) && listing.amenities.filter(Boolean).length > 0;
  const hasLocation = Boolean(listing.locationLabel?.trim());
  const looksGenericTitle =
    /^booking\.com\b/i.test(normalizedTitle) ||
    /^airbnb\b/i.test(normalizedTitle) ||
    /^vrbo\b/i.test(normalizedTitle) ||
    /^agoda\b/i.test(normalizedTitle) ||
    /^homeaway\b/i.test(normalizedTitle);
  const hasMetadata =
    typeof listing.rating === "number" ||
    typeof listing.reviewCount === "number" ||
    Boolean(listing.propertyType?.trim());

  if ((!hasTitle || looksGenericTitle) && !hasDescription && !hasPhotoEvidence) {
    return { valid: false, reason: PAGE_UNUSABLE_MESSAGE };
  }

  if (
    !hasPhotoEvidence ||
    (!hasDescription && !hasAmenities && !hasLocation && !hasMetadata) ||
    looksGenericTitle
  ) {
    return { valid: false, reason: PAGE_UNUSABLE_MESSAGE };
  }

  return { valid: true };
}

export const guestAuditErrorMessages = {
  urlIncomplete: URL_INCOMPLETE_MESSAGE,
  urlInvalid: URL_INVALID_MESSAGE,
  platformUnsupported: PLATFORM_UNSUPPORTED_MESSAGE,
  pageUnusable: PAGE_UNUSABLE_MESSAGE,
};

export function formatPlatformLabel(platform?: string | null): string {
  switch (platform) {
    case "booking":
      return "Booking";
    case "airbnb":
      return "Airbnb";
    case "vrbo":
      return "Vrbo";
    case "agoda":
      return "Agoda";
    default:
      return "Autre";
  }
}

export function normalizeAuditLocaleToFrench(value?: string | null): string {
  if (!value) return "";

  let normalized = value.trim();

  for (const [pattern, replacement] of LOCALE_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized.replace(/\s{2,}/g, " ").trim();
}
