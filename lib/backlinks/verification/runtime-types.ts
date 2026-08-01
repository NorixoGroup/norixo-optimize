import type { HttpFetchRequest, HttpFetchResponse } from "../http";

import type { VerificationPolicy, VerificationResult } from "./types";

export interface ExecuteBacklinkVerificationInput {
  sourceUrl: string;
  targetUrl: string;
  checkedAt: string;
  policy: VerificationPolicy;
  http: Omit<HttpFetchRequest, "url">;
}

export interface BacklinkVerificationRuntimeDependencies {
  fetcher: (request: HttpFetchRequest) => Promise<HttpFetchResponse>;
}

export interface BacklinkVerificationHttpResponse {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  contentType: string | null;
  redirectCount: number;
  fetchedAt: string;
}

export type BacklinkVerificationRuntimeResult =
  | {
      kind: "verified";
      response: BacklinkVerificationHttpResponse;
      verification: VerificationResult;
    }
  | {
      kind: "http_unusable";
      reason: "http_client_error" | "http_server_error" | "unsupported_content_type" | "empty_document";
      response: BacklinkVerificationHttpResponse;
    }
  | {
      kind: "fetch_error";
      error: {
        code: string;
        message: string;
      };
    };
