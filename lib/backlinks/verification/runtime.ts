import { extractHtmlAnchors, buildHtmlLinkObservations, parseHtmlDocument } from "../html";
import { fetchHttp } from "../http";

import { buildVerificationEvidence } from "./evidence-builder";
import { runVerification } from "./engine";
import type {
  BacklinkVerificationHttpResponse,
  BacklinkVerificationRuntimeDependencies,
  BacklinkVerificationRuntimeResult,
  ExecuteBacklinkVerificationInput,
} from "./runtime-types";

function summarizeResponse(
  input: ExecuteBacklinkVerificationInput,
  response: {
    finalUrl: string;
    status: number;
    contentType: string | null;
    redirectCount: number;
    fetchedAt: string;
  },
): BacklinkVerificationHttpResponse {
  return {
    requestedUrl: input.sourceUrl,
    finalUrl: response.finalUrl,
    status: response.status,
    contentType: response.contentType,
    redirectCount: response.redirectCount,
    fetchedAt: response.fetchedAt,
  };
}

function toFetchError(error: unknown): BacklinkVerificationRuntimeResult {
  return {
    kind: "fetch_error",
    error: {
      code: error instanceof Error && error.name !== "Error" ? error.name : "FETCH_ERROR",
      message: error instanceof Error ? error.message : "HTTP fetch failed.",
    },
  };
}

export async function executeBacklinkVerification(
  input: ExecuteBacklinkVerificationInput,
  dependencies: BacklinkVerificationRuntimeDependencies = { fetcher: fetchHttp },
): Promise<BacklinkVerificationRuntimeResult> {
  let response;

  try {
    response = await dependencies.fetcher({
      url: input.sourceUrl,
      ...input.http,
    });
  } catch (error) {
    return toFetchError(error);
  }

  const responseSummary = summarizeResponse(input, response);

  if (response.status >= 400 && response.status <= 499) {
    return { kind: "http_unusable", reason: "http_client_error", response: responseSummary };
  }

  if (response.status >= 500 && response.status <= 599) {
    return { kind: "http_unusable", reason: "http_server_error", response: responseSummary };
  }

  const document = parseHtmlDocument({
    url: response.finalUrl,
    status: response.status,
    contentType: response.contentType,
    body: response.body,
    fetchedAt: response.fetchedAt,
  });

  if (!document.isHtml) {
    return { kind: "http_unusable", reason: "unsupported_content_type", response: responseSummary };
  }

  if (document.isEmpty) {
    return { kind: "http_unusable", reason: "empty_document", response: responseSummary };
  }

  const anchors = extractHtmlAnchors(document);
  const observations = buildHtmlLinkObservations(document, anchors);
  const evidence = buildVerificationEvidence({
    sourceUrl: input.sourceUrl,
    targetUrl: input.targetUrl,
    checkedAt: input.checkedAt,
    links: observations.links,
  });

  return {
    kind: "verified",
    response: responseSummary,
    verification: runVerification({
      sourceUrl: input.sourceUrl,
      targetUrl: input.targetUrl,
      checkedAt: input.checkedAt,
      policy: input.policy,
      evidence,
    }),
  };
}
