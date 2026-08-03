import type {
  BacklinkQualificationCandidateInput,
  BacklinkQualificationOpportunityType,
  BacklinkQualificationPageType,
  BacklinkQualificationPolicy,
  BacklinkQualificationQueryInput,
} from "./backlink-qualification-types";

export type ExtractBacklinkQualificationSignalsInput = {
  candidate: BacklinkQualificationCandidateInput;
  query: BacklinkQualificationQueryInput;
  policy: BacklinkQualificationPolicy;
};

export type BacklinkQualificationSignalCode =
  | "SELF_DOMAIN"
  | "BLOCKED_HOSTNAME"
  | "PLATFORM_OWNER_DOMAIN"
  | "DIRECT_COMPETITOR"
  | "SOCIAL_NETWORK"
  | "SEARCH_ENGINE"
  | "VIDEO_PLATFORM"
  | "UNSAFE_TOPIC"
  | "TOPICAL_RELEVANCE_STRONG"
  | "TOPICAL_RELEVANCE_PARTIAL"
  | "RESOURCE_PAGE_SIGNAL"
  | "TOOLS_LIST_SIGNAL"
  | "GUIDE_SIGNAL"
  | "GUEST_POST_SIGNAL"
  | "COMPARISON_SIGNAL"
  | "DIRECTORY_SIGNAL"
  | "PARTNERSHIP_SIGNAL"
  | "LOGIN_PAGE"
  | "LEGAL_PAGE"
  | "SUPPORT_PAGE_SIGNAL"
  | "LANGUAGE_MATCH"
  | "COUNTRY_MATCH"
  | "HIGH_SERP_POSITION"
  | "TITLE_PRESENT"
  | "SNIPPET_PRESENT"
  | "INSUFFICIENT_EVIDENCE";

export type BacklinkQualificationSignal = {
  code: BacklinkQualificationSignalCode;
  category: "blocking" | "risk" | "topical" | "editorial" | "context" | "quality";
  evidence: string;
};

export type BacklinkQualificationSignalsResult = {
  candidateKey: string;
  signals: readonly BacklinkQualificationSignal[];
  blockingSignalCodes: readonly BacklinkQualificationSignalCode[];
  riskSignalCodes: readonly BacklinkQualificationSignalCode[];
  topicalSignal: "strong" | "partial" | "none";
  editorialSignalCodes: readonly BacklinkQualificationSignalCode[];
  proposedOpportunityType: BacklinkQualificationOpportunityType | null;
  proposedPageType: BacklinkQualificationPageType;
};
