export interface HttpFetchRequest {
  url: string;
  timeoutMs: number;
  maxRedirects: number;
  maxResponseBytes: number;
  userAgent?: string;
}

export interface HttpFetchResponse {
  finalUrl: string;
  status: number;
  headers: Record<string, string>;
  body: string;
  redirected: boolean;
  redirectCount: number;
  fetchedAt: string;
  contentType: string | null;
  contentLength: number | null;
}

export type HttpFetchTransportInput = {
  url: URL;
  address: string;
  family: 4 | 6;
  hostname: string;
  headers: Record<string, string>;
  signal: AbortSignal;
  maxResponseBytes: number;
};

export type HttpFetchTransportResponse = {
  status: number;
  headers: Record<string, string>;
  body: string;
};

export type HttpFetchTransport = (
  input: HttpFetchTransportInput,
) => Promise<HttpFetchTransportResponse>;
