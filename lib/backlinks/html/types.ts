export interface HtmlDocumentInput {
  url: string;
  status: number;
  contentType: string | null;
  body: string;
  fetchedAt: string;
}

export interface ParsedHtmlDocument {
  url: string;
  status: number;
  contentType: string | null;
  html: string;
  fetchedAt: string;
  title?: string;
  language?: string;
  baseUrl?: string;
  isHtml: boolean;
  isEmpty: boolean;
}

export interface HtmlAnchorObservation {
  href?: string;
  text: string;
  rel: string[];
  target?: string;
  title?: string;
  index: number;
}

export interface HtmlAnchorExtractionResult {
  documentUrl: string;
  anchorCount: number;
  anchors: HtmlAnchorObservation[];
}

export type HtmlLinkHrefKind =
  | "absolute"
  | "relative"
  | "protocol_relative"
  | "fragment"
  | "mailto"
  | "tel"
  | "javascript"
  | "other_scheme"
  | "empty"
  | "invalid";

export interface HtmlLinkObservation {
  index: number;
  rawHref?: string;
  resolvedUrl?: string;
  hrefKind: HtmlLinkHrefKind;
  text: string;
  rel: string[];
  target?: string;
  title?: string;
}

export interface HtmlLinkObservationResult {
  documentUrl: string;
  effectiveBaseUrl?: string;
  linkCount: number;
  links: HtmlLinkObservation[];
}
