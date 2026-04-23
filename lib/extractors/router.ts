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

function isVrboLikeExpediaUrl(lowerUrl: string): boolean {
  const isExpediaFamily = lowerUrl.includes("expedia.") || lowerUrl.includes("hotels.");
  if (!isExpediaFamily) return false;

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
  ].some((needle) => lowerUrl.includes(needle));
}

function isVrboFamilyUrl(lowerUrl: string): boolean {
  return (
    lowerUrl.includes("vrbo.") ||
    lowerUrl.includes("homeaway.") ||
    lowerUrl.includes("abritel.") ||
    isVrboLikeExpediaUrl(lowerUrl)
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
  const lower = url.toLowerCase();

  if (lower.includes("airbnb.")) return "airbnb";
  if (lower.includes("booking.")) return "booking";
  if (isVrboFamilyUrl(lower)) return "vrbo";
  if (lower.includes("agoda.")) return "agoda";

  return "other";
}

export function resolveExtractor(url: string): ResolvedExtractor {
  const lower = url.toLowerCase();

  if (lower.includes("airbnb.")) {
    return {
      platform: "airbnb",
      extractorKey: "airbnb",
      run: extractAirbnb,
    };
  }

  if (lower.includes("booking.")) {
    return {
      platform: "booking",
      extractorKey: "booking",
      run: extractBooking,
    };
  }

  if (isVrboFamilyUrl(lower)) {
    return {
      platform: "vrbo",
      extractorKey: "vrbo",
      run: extractVrbo,
    };
  }

  if (lower.includes("expedia.") || lower.includes("hotels.")) {
    return {
      platform: "other",
      extractorKey: "expedia",
      run: extractExpedia,
    };
  }

  if (lower.includes("agoda.")) {
    return {
      platform: "agoda",
      extractorKey: "agoda",
      run: extractAgoda,
    };
  }

  return {
    platform: "other",
    extractorKey: "other",
    run: async (inputUrl: string, _options?: ExtractListingOptions) => buildOtherListing(inputUrl),
  };
}
