import type { HttpFetchRequest, HttpFetchResponse } from "./types";

const redirectStatuses = new Set([301, 302, 303, 307, 308]);

function parseContentLength(value: string | null): number | null {
  if (value == null) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function validateRequest(request: HttpFetchRequest): void {
  if (request.timeoutMs <= 0) {
    throw new Error("HTTP fetch timeout must be greater than zero.");
  }

  if (request.maxRedirects < 0) {
    throw new Error("HTTP fetch maxRedirects cannot be negative.");
  }

  if (request.maxResponseBytes < 0) {
    throw new Error("HTTP fetch maxResponseBytes cannot be negative.");
  }
}

async function readResponseBody(response: Response, maxResponseBytes: number): Promise<string> {
  const contentLength = parseContentLength(response.headers.get("content-length"));

  if (contentLength != null && contentLength > maxResponseBytes) {
    throw new Error("HTTP response exceeds the configured size limit.");
  }

  if (response.body == null) {
    return "";
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let downloadedBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      downloadedBytes += value.byteLength;

      if (downloadedBytes > maxResponseBytes) {
        await reader.cancel();
        throw new Error("HTTP response exceeds the configured size limit.");
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(downloadedBytes);
  let offset = 0;

  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(body);
}

export async function fetchHttp(request: HttpFetchRequest): Promise<HttpFetchResponse> {
  validateRequest(request);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), request.timeoutMs);
  let currentUrl = request.url;
  let redirectCount = 0;

  try {
    while (true) {
      const headers = new Headers();

      if (request.userAgent != null) {
        headers.set("user-agent", request.userAgent);
      }

      const response = await fetch(currentUrl, {
        headers,
        redirect: "manual",
        signal: controller.signal,
      });

      if (redirectStatuses.has(response.status)) {
        const location = response.headers.get("location");

        if (location == null) {
          throw new Error("HTTP redirect response is missing a Location header.");
        }

        if (redirectCount >= request.maxRedirects) {
          throw new Error("HTTP redirect limit exceeded.");
        }

        currentUrl = new URL(location, currentUrl).toString();
        redirectCount += 1;
        continue;
      }

      const contentLength = parseContentLength(response.headers.get("content-length"));
      const body = await readResponseBody(response, request.maxResponseBytes);

      return {
        finalUrl: currentUrl,
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body,
        redirected: redirectCount > 0,
        redirectCount,
        fetchedAt: new Date().toISOString(),
        contentType: response.headers.get("content-type"),
        contentLength,
      };
    }
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`HTTP fetch timed out after ${request.timeoutMs}ms.`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
