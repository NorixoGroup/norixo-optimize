import type { ContentNodeId, ContentType } from "../types";
import type { GeoEntityRef } from "./geo-types";

export type ProgrammaticMarketContentType = Extract<ContentType, "ranking" | "report">;

export type ProgrammaticContentFamily = "market_intelligence";

export type ProgrammaticMarketRankingScope =
  | { readonly kind: "global" }
  | { readonly kind: "country"; readonly entityRef: GeoEntityRef }
  | { readonly kind: "region"; readonly slug: string }
  | { readonly kind: "audience"; readonly slug: string };

interface ProgrammaticMarketDescriptorBase {
  contentNodeId: ContentNodeId;
  family: ProgrammaticContentFamily;
}

export interface ProgrammaticMarketRankingDescriptor extends ProgrammaticMarketDescriptorBase {
  contentType: "ranking";
  scope: ProgrammaticMarketRankingScope;
  targetEntities: readonly GeoEntityRef[];
}

export interface ProgrammaticMarketReportDescriptor extends ProgrammaticMarketDescriptorBase {
  contentType: "report";
  entityRef: GeoEntityRef;
}

export type ProgrammaticMarketDescriptor =
  | ProgrammaticMarketRankingDescriptor
  | ProgrammaticMarketReportDescriptor;
