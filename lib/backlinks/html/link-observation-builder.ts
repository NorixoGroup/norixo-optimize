import type {
  HtmlAnchorExtractionResult,
  HtmlLinkHrefKind,
  HtmlLinkObservation,
  HtmlLinkObservationResult,
  ParsedHtmlDocument,
} from "./types";

const schemePattern = /^[a-z][a-z\d+.-]*:/i;

function asHttpUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function getEffectiveBaseUrl(document: ParsedHtmlDocument): string | undefined {
  const documentUrl = asHttpUrl(document.url);

  if (documentUrl == null) {
    return undefined;
  }

  if (document.baseUrl != null) {
    try {
      const resolvedBaseUrl = new URL(document.baseUrl, documentUrl).toString();
      const httpBaseUrl = asHttpUrl(resolvedBaseUrl);

      if (httpBaseUrl != null) {
        return httpBaseUrl;
      }
    } catch {
      // Fall back to the validated document URL.
    }
  }

  return documentUrl;
}

function classifyHref(rawHref: string | undefined): HtmlLinkHrefKind {
  if (rawHref == null || rawHref === "") {
    return "empty";
  }

  const lowerHref = rawHref.toLowerCase();

  if (rawHref.startsWith("#")) {
    return "fragment";
  }

  if (rawHref.startsWith("//")) {
    return "protocol_relative";
  }

  if (lowerHref.startsWith("mailto:")) {
    return "mailto";
  }

  if (lowerHref.startsWith("tel:")) {
    return "tel";
  }

  if (lowerHref.startsWith("javascript:")) {
    return "javascript";
  }

  if (schemePattern.test(rawHref)) {
    try {
      const url = new URL(rawHref);
      return url.protocol === "http:" || url.protocol === "https:" ? "absolute" : "other_scheme";
    } catch {
      return "invalid";
    }
  }

  try {
    new URL(rawHref, "https://relative.example");
    return "relative";
  } catch {
    return "invalid";
  }
}

function resolveHref(
  rawHref: string | undefined,
  hrefKind: HtmlLinkHrefKind,
  effectiveBaseUrl: string | undefined,
): string | undefined {
  if (rawHref == null) {
    return undefined;
  }

  if (hrefKind === "absolute") {
    return asHttpUrl(rawHref);
  }

  if ((hrefKind === "relative" || hrefKind === "protocol_relative") && effectiveBaseUrl != null) {
    try {
      return asHttpUrl(new URL(rawHref, effectiveBaseUrl).toString());
    } catch {
      return undefined;
    }
  }

  return undefined;
}

export function buildHtmlLinkObservations(
  document: ParsedHtmlDocument,
  extraction: HtmlAnchorExtractionResult,
): HtmlLinkObservationResult {
  const effectiveBaseUrl = getEffectiveBaseUrl(document);

  if (!document.isHtml || document.isEmpty) {
    return {
      documentUrl: document.url,
      ...(effectiveBaseUrl == null ? {} : { effectiveBaseUrl }),
      linkCount: 0,
      links: [],
    };
  }

  const links: HtmlLinkObservation[] = extraction.anchors.map((anchor) => {
    const hrefKind = classifyHref(anchor.href);
    const resolvedUrl = resolveHref(anchor.href, hrefKind, effectiveBaseUrl);

    return {
      index: anchor.index,
      ...(anchor.href == null ? {} : { rawHref: anchor.href }),
      ...(resolvedUrl == null ? {} : { resolvedUrl }),
      hrefKind,
      text: anchor.text,
      rel: [...anchor.rel],
      ...(anchor.target == null ? {} : { target: anchor.target }),
      ...(anchor.title == null ? {} : { title: anchor.title }),
    };
  });

  return {
    documentUrl: document.url,
    ...(effectiveBaseUrl == null ? {} : { effectiveBaseUrl }),
    linkCount: links.length,
    links,
  };
}
