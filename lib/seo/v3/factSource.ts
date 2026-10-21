/**
 * SEO generator V3 — provenance of a fact (contract only).
 *
 * A bare URL is never sufficient evidence: a source must carry a consultation date, a collection
 * method, its terms of use and at least one evidence anchor (content hash, archive reference,
 * verbatim excerpt or internal record) that lets a reviewer re-check the claim later.
 */

/** `YYYY-MM-DD`. Shape only; format validation belongs to the S2 registry. */
export type IsoDate = `${number}-${number}-${number}`;
/** `YYYY-MM-DDTHH:mm:ss…`. Shape only; format validation belongs to the S2 registry. */
export type IsoDateTime = `${IsoDate}T${string}`;

export type FactSourceType =
  /** Government, regulator, statistics office. */
  | "official_authority"
  /** National or city tourism board, convention bureau. */
  | "official_tourism_body"
  /** Dataset obtained under a licence that allows the intended use. */
  | "licensed_dataset"
  /** Published study or report with an identifiable author and method. */
  | "published_research"
  /** Public web page that is not an official or licensed source. */
  | "public_web_page"
  /** Norixo editorial observation with a documented method. Always needs human validation. */
  | "editorial_note"
  /**
   * Aggregate derived from user audits (Intelligence V2 pipeline). Never publishable
   * automatically: public use needs an explicit human approval (see UsageRestrictions).
   */
  | "user_audit_aggregate";

export type SourceLocator =
  | Readonly<{ kind: "url"; url: string }>
  | Readonly<{ kind: "document_citation"; citation: string }>
  /** Opaque internal reference (e.g. an artifact key). Must not contain user or workspace ids. */
  | Readonly<{ kind: "internal_reference"; reference: string }>;

/** At least one anchor is required (see FactSource.evidence). */
export type EvidenceAnchor =
  | Readonly<{ kind: "content_hash"; algorithm: "sha256"; value: string }>
  | Readonly<{ kind: "archive_reference"; reference: string }>
  | Readonly<{ kind: "verbatim_excerpt"; excerpt: string }>
  | Readonly<{ kind: "internal_record"; reference: string }>;

export type CollectionMethodKind =
  | "manual_reading"
  | "api_export"
  | "dataset_download"
  | "internal_aggregation"
  | "editorial_judgement";

export type CollectionMethod = Readonly<{
  kind: CollectionMethodKind;
  /** What was done, precisely enough to repeat it. */
  description: string;
}>;

export type TermsOfUseStatus = "verified_permissive" | "verified_restrictive" | "unverified";

export type TermsOfUse = Readonly<{
  status: TermsOfUseStatus;
  summary: string | null;
  reference: string | null;
}>;

export type PublicationRestrictionCode =
  | "attribution_required"
  | "no_public_use"
  | "no_derivative_figures"
  | "aggregate_only"
  | "requires_licence_check";

export type FactSource = Readonly<{
  /** Stable identifier of the source (not of a single fact). */
  sourceId: string;
  sourceType: FactSourceType;
  publisher: string;
  title: string | null;
  locator: SourceLocator;
  /** Publication date of the source itself, when it has one. */
  publishedAt: IsoDate | null;
  /** When a person or process actually read the source. Required: no consultation, no evidence. */
  consultedAt: IsoDateTime;
  collectionMethod: CollectionMethod;
  termsOfUse: TermsOfUse;
  publicationRestrictions: readonly PublicationRestrictionCode[];
  /** Non-empty on purpose: a URL alone does not prove anything. */
  evidence: readonly [EvidenceAnchor, ...EvidenceAnchor[]];
}>;
