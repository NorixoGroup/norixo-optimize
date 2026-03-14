import {
  Audit,
  Listing,
  ListingWithLatestAudit,
  Profile,
  Platform,
} from "@/types/domain";
import { generateMockAudit } from "@/ai/mockAudit";

const profiles: Profile[] = [];
const listings: Listing[] = [];
const audits: Audit[] = [];

function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getOrCreateMockProfile(): Profile {
  if (profiles.length > 0) return profiles[0];

  const profile: Profile = {
    id: createId("profile"),
    email: "demo@listing-optimizer.app",
    fullName: "Demo Host",
    createdAt: new Date().toISOString(),
  };

  profiles.push(profile);
  return profile;
}

export function createListingWithAudit(params: {
  url: string;
  title?: string;
  platform?: string;
}): { listing: Listing; audit: Audit } {
  const owner = getOrCreateMockProfile();

  const listing: Listing = {
    id: createId("listing"),
    ownerId: owner.id,
    url: params.url,
    platform: (params.platform as Platform) ?? "other",
    title: params.title?.trim() || "Untitled listing",
    createdAt: new Date().toISOString(),
  };

  const mockResult = generateMockAudit(listing);

  const audit: Audit = {
    id: createId("audit"),
    listingId: listing.id,
    createdAt: new Date().toISOString(),
    url: listing.url,
    title: listing.title,
    platform: listing.platform,
    result: mockResult,
    competitorsMeta: {
      attempted: 0,
      selected: 0,
      radiusKm: 1,
      maxResults: 15,
    },
  };

  listing.lastAuditId = audit.id;

  listings.unshift(listing);
  audits.unshift(audit);

  return { listing, audit };
}

export function listListingsWithLatestAudit(): ListingWithLatestAudit[] {
  return listings.map((listing) => ({
    ...listing,
    latestAudit: audits.find((a) => a.id === listing.lastAuditId),
  }));
}

export function listAudits(): Audit[] {
  return [...audits];
}

export function getAuditById(id: string): Audit | undefined {
  return audits.find((a) => a.id === id);
}