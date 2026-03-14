export type Platform = "airbnb" | "booking" | "vrbo" | "other";

export interface Profile {
  id: string;
  email: string;
  fullName?: string;
  createdAt: string;
}

export interface Listing {
  id: string;
  ownerId?: string;
  url: string;
  platform: Platform;
  title: string;
  city?: string;
  country?: string;
  description?: string;
  amenities?: string[];
  photos?: string[];
  createdAt: string;
  lastAuditId?: string;
}

export interface AuditCategoryScores {
  photoQuality: number;
  photoOrder: number;
  descriptionQuality: number;
  amenitiesCompleteness: number;
  seoStrength: number;
  conversionStrength: number;
}

export type ImprovementImpact = "low" | "medium" | "high";

export interface Improvement {
  id?: string;
  auditId?: string;
  title: string;
  description: string;
  impact: ImprovementImpact;
  orderIndex?: number;
}

export interface CompetitorSummary {
  competitorCount?: number;
  averageOverallScore?: number;
  targetVsMarketPosition?: string;
  keyGaps?: string[];
  keyAdvantages?: string[];
}

export interface AuditResult {
  overallScore?: number;
  photoQuality?: number;
  photoOrder?: number;
  descriptionQuality?: number;
  amenitiesCompleteness?: number;
  seoStrength?: number;
  conversionStrength?: number;
  strengths?: string[];
  weaknesses?: string[];
  improvements?: Improvement[];
  suggestedOpening?: string;
  photoOrderSuggestions?: string[];
  missingAmenities?: string[];
  competitorSummary?: CompetitorSummary;
}

export interface Audit {
  id: string;
  listingId: string;
  createdAt: string;
  url?: string;
  title?: string;
  platform?: Platform;
  result?: AuditResult;
  competitorsMeta?: {
    attempted?: number;
    selected?: number;
    radiusKm?: number;
    maxResults?: number;
  };
}

export interface Subscription {
  id: string;
  profileId: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  plan: "single-audit" | "concierge";
  status: "inactive" | "active" | "canceled";
  currentPeriodEnd?: string;
}

export interface MonthlyUsage {
  id: string;
  profileId: string;
  month: string; // YYYY-MM
  includedListings: number;
  extraListings: number;
}

export interface ListingWithLatestAudit extends Listing {
  latestAudit?: Audit;
}