import { extractAgoda } from "./agoda";
import { extractAirbnb } from "./airbnb";
import { extractBooking } from "./booking";
import { extractExpedia } from "./expedia";
import { extractVrbo } from "./vrbo";
import type {
  ExtractedListing,
  ExtractListingOptions,
  ExtractorResult,
  SupportedPlatform,
} from "./types";

type ResolvedExtractor = {
  platform: SupportedPlatform;
  extractorKey: "airbnb" | "booking" | "vrbo" | "expedia" | "agoda" | "other";
  run: (url: string, options?: ExtractListingOptions) => Promise<ExtractorResult>;
};

function getHostname(url: string): string {
  try {
    return new URL(url)
      .hostname
      .toLowerCase()
      .replace(/\.$/, "");
  } catch {
    return "";
  }
}

function hostnameMatchesDomain(
  hostname: string,
  domain: string
): boolean {
  return (
    hostname === domain ||
    hostname.endsWith(`.${domain}`)
  );
}

function isExpediaFamilyHostname(
  hostname: string
): boolean {
  return (
    hostnameMatchesDomain(hostname, "expedia.com") ||
    hostnameMatchesDomain(hostname, "expedia.fr") ||
    hostnameMatchesDomain(hostname, "hotels.com")
  );
}

function isVrboLikeExpediaUrl(
  url: string
): boolean {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  const hostname =
    parsed.hostname
      .toLowerCase()
      .replace(/\.$/, "");

  if (!isExpediaFamilyHostname(hostname)) {
    return false;
  }

  // Route semantics must come from the Expedia path itself.
  // Query parameters are referral / campaign metadata and must not
  // reclassify an Expedia hotel URL as a Vrbo-family listing.
  const routeText = parsed.pathname.toLowerCase();

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
  ].some(
    (needle) =>
      routeText.includes(needle)
  );
}

function buildOtherListing(url: string): ExtractedListing {
  return {
    url,
    sourceUrl: url,
    platform: "other",
    sourcePlatform: "other",
    title: "Annonce non prise en charge",
    titleMeta: {
      source: null,
      length: "Annonce non prise en charge".length,
      quality: "low",
      confidence: 0.2,
    },
    description: "",
    descriptionMeta: {
      source: null,
      length: 0,
      quality: "low",
      confidence: 0.2,
    },
    amenities: [],
    photos: [],
    photosCount: 0,
    photoMeta: {
      count: 0,
      source: null,
      quality: "low",
      confidence: 0.2,
    },
    structure: {
      capacity: null,
      bedrooms: null,
      bedCount: null,
      bathrooms: null,
      propertyType: null,
      locationLabel: null,
    },
    occupancyObservation: {
      status: "unavailable",
      rate: null,
      unavailableDays: 0,
      availableDays: 0,
      observedDays: 0,
      windowDays: 60,
      source: null,
      message: "Donnees d'occupation non disponibles pour cette annonce",
    },
    extractionMeta: {
      extractor: "other",
      extractedAt: new Date().toISOString(),
      warnings: ["unsupported_platform"],
    },
  };
}


export function detectPlatform(url: string): SupportedPlatform {
  const hostname = getHostname(url);

  if (
    hostnameMatchesDomain(hostname, "airbnb.com") ||
    hostnameMatchesDomain(hostname, "airbnb.fr")
  ) {
    return "airbnb";
  }

  if (
    hostnameMatchesDomain(hostname, "booking.com")
  ) {
    return "booking";
  }

  if (
    hostnameMatchesDomain(hostname, "agoda.com")
  ) {
    return "agoda";
  }

  if (
    hostnameMatchesDomain(hostname, "abritel.fr") ||
    hostnameMatchesDomain(hostname, "vrbo.com") ||
    hostnameMatchesDomain(hostname, "homeaway.com")
  ) {
    return "vrbo";
  }

  if (isVrboLikeExpediaUrl(url)) {
    return "vrbo";
  }

  if (isExpediaFamilyHostname(hostname)) {
    return "expedia";
  }

  return "other";
}

export function resolveExtractor(url: string): ResolvedExtractor {
  const platform = detectPlatform(url);

  switch (platform) {
    case "airbnb":
      return {
        platform: "airbnb",
        extractorKey: "airbnb",
        run: extractAirbnb,
      };

    case "booking":
      return {
        platform: "booking",
        extractorKey: "booking",
        run: extractBooking,
      };

    case "vrbo":
      return {
        platform: "vrbo",
        extractorKey: "vrbo",
        run: extractVrbo,
      };

    case "expedia":
      return {
        platform: "expedia",
        extractorKey: "expedia",
        run: extractExpedia,
      };

    case "agoda":
      return {
        platform: "agoda",
        extractorKey: "agoda",
        run: extractAgoda,
      };

    default:
      return {
        platform: "other",
        extractorKey: "other",
        run: async (
          inputUrl: string,
          _options?: ExtractListingOptions
        ) => buildOtherListing(inputUrl),
      };
  }
}
