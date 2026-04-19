export type SupportedPlatform = "airbnb" | "booking" | "vrbo" | "agoda" | "expedia" | "other";

export type ListingFieldQuality = "missing" | "low" | "medium" | "high";

export type ListingFieldMeta = {
  source: string | null;
  length: number;
  quality: ListingFieldQuality;
  confidence?: number | null;
};

export type ListingPhotoMeta = {
  count: number;
  source: string | null;
  quality: ListingFieldQuality;
  confidence?: number | null;
};

export type ListingStructure = {
  capacity: number | null;
  bedrooms: number | null;
  bedCount: number | null;
  bathrooms: number | null;
  propertyType: string | null;
  locationLabel: string | null;
};

export type ScoreStatus = "scored" | "partial" | "unavailable";

export type AuditSubScore = {
  key: string;
  label: string;
  status: ScoreStatus;
  score: number | null;
  weight: number;
  isDataReliable?: boolean;
  reason?: string;
};

export type OccupancyObservation = {
  status?: "available" | "unavailable";
  rate: number | null;
  unavailableDays: number;
  availableDays: number;
  observedDays: number;
  windowDays: number;
  source: string | null;
  message?: string | null;
};

export type ExtractionMeta = {
  extractor: string;
  extractedAt: string;
  warnings: string[];
};

export type NormalizedListing = {
  platform: SupportedPlatform;
  sourceUrl: string;
  title: string;
  titleMeta: ListingFieldMeta;
  description: string;
  descriptionMeta: ListingFieldMeta;
  photos: string[];
  photoMeta: ListingPhotoMeta;
  amenities: string[];
  highlights?: string[];
  badges?: string[];
  trustBadge?: string | null;
  hostInfo?: string | null;
  hostName?: string | null;
  rules?: string[];
  locationDetails?: string[];
  structure: ListingStructure;
  occupancyObservation: OccupancyObservation;
  extractionMeta: ExtractionMeta;
};

export type ExtractedListing = {
  url: string;
  sourceUrl?: string;
  platform: SupportedPlatform;
  canonicalUrl?: string;
  sourcePlatform?: SupportedPlatform;
  externalId?: string | null;

  title: string;
  titleMeta?: ListingFieldMeta;
  description: string;
  descriptionMeta?: ListingFieldMeta;
  amenities: string[];
  highlights?: string[];
  badges?: string[];
  trustBadge?: string | null;
  hostInfo?: string | null;
  hostName?: string | null;
  rules?: string[];
  locationDetails?: string[];
  photos: string[];
  photosCount?: number;
  photoMeta?: ListingPhotoMeta;
  structure?: ListingStructure;
  extractionMeta?: ExtractionMeta;

  price?: number | null;
  currency?: string | null;

  latitude?: number | null;
  longitude?: number | null;

  capacity?: number | null;
  bedrooms?: number | null;
  bedCount?: number | null;
  bathrooms?: number | null;
  guestCapacity?: number | null;
  bedroomCount?: number | null;
  bathroomCount?: number | null;

  locationLabel?: string | null;
  propertyType?: string | null;
  rating?: number | null;
  ratingValue?: number | null;
  ratingScale?: number | null;
  reviewCount?: number | null;
  occupancyObservation?: OccupancyObservation | null;
};

export type CompetitorSearchInput = {
  target: ExtractedListing;
  maxResults?: number;
  radiusKm?: number;
};

export type ExtractorResult = ExtractedListing;
