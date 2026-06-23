import type { MarketingCommunity } from "./communityModel";
import {
  createCommunityWorkspace,
  type CommunityWorkspace,
} from "./communityWorkspace";

export type CommunityWorkspaceBuilderInput = {
  country?: string;
  communities: MarketingCommunity[];
  notes?: string[];
  createdAt?: string;
  updatedAt?: string;
};

export function isCommunityWorkspaceBuilderInput(
  value: unknown,
): value is CommunityWorkspaceBuilderInput {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const input = value as Record<string, unknown>;

  return (
    Array.isArray(input.communities) &&
    (input.country === undefined || typeof input.country === "string") &&
    (input.notes === undefined ||
      (Array.isArray(input.notes) &&
        input.notes.every((note) => typeof note === "string"))) &&
    (input.createdAt === undefined || typeof input.createdAt === "string") &&
    (input.updatedAt === undefined || typeof input.updatedAt === "string")
  );
}

export function buildCommunityWorkspace(
  input: CommunityWorkspaceBuilderInput,
): CommunityWorkspace {
  return createCommunityWorkspace({
    country: input.country,
    communities: input.communities,
    notes: input.notes,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  });
}
