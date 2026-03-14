export type SupportedPlatform = "airbnb" | "booking" | "vrbo" | "other";

export type ExtractedListing = {
  url: string;
  platform: SupportedPlatform;
  externalId?: string | null;

  title: string;
  description: string;
  amenities: string[];
  photos: string[];

  price?: number | null;
  currency?: string | null;

  latitude?: number | null;
  longitude?: number | null;

  capacity?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;

  locationLabel?: string | null;
  propertyType?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
};

export type CompetitorSearchInput = {
  target: ExtractedListing;
  maxResults?: number;
  radiusKm?: number;
};

export type ExtractorResult = ExtractedListing;