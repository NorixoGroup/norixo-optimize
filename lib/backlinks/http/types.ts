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
