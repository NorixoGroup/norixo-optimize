import http from "node:http";
import https from "node:https";

import type { HttpFetchRequest, HttpFetchResponse } from "./types";
import type { HttpFetchTransportInput, HttpFetchTransportResponse } from "./types";
import type { DnsLookup } from "./url-safety";
import { resolveSafeHttpTarget } from "./url-safety";

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

async function readStreamBody(
  stream: NodeJS.ReadableStream,
  maxResponseBytes: number,
): Promise<string> {
  const chunks: Buffer[] = [];
  let downloadedBytes = 0;

  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    downloadedBytes += buffer.byteLength;

    if (downloadedBytes > maxResponseBytes) {
      throw new Error("HTTP response exceeds the configured size limit.");
    }

    chunks.push(buffer);
  }

  return Buffer.concat(chunks, downloadedBytes).toString("utf8");
}

function headerRecord(headers: http.IncomingHttpHeaders): Record<string, string> {
  const entries: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      entries.push([key, value.join(", ")]);
    } else if (value != null) {
      entries.push([key, String(value)]);
    }
  }
  return Object.fromEntries(entries);
}

async function requestBoundTarget(input: HttpFetchTransportInput): Promise<HttpFetchTransportResponse> {
  const client = input.url.protocol === "https:" ? https : http;
  const port = input.url.port === "" ? (input.url.protocol === "https:" ? 443 : 80) : Number(input.url.port);
  const path = `${input.url.pathname}${input.url.search}`;

  return new Promise((resolve, reject) => {
    const request = client.request(
      {
        protocol: input.url.protocol,
        hostname: input.address,
        family: input.family,
        port,
        path,
        method: "GET",
        headers: {
          ...input.headers,
          Host: input.url.host,
        },
        ...(input.url.protocol === "https:" ? { servername: input.hostname } : {}),
      },
      async (response) => {
        try {
          const contentLength = parseContentLength(response.headers["content-length"]?.toString() ?? null);
          if (contentLength != null && contentLength > input.maxResponseBytes) {
            response.destroy();
            reject(new Error("HTTP response exceeds the configured size limit."));
            return;
          }

          const body = await readStreamBody(response, input.maxResponseBytes);
          resolve({
            status: response.statusCode ?? 0,
            headers: headerRecord(response.headers),
            body,
          });
        } catch (error) {
          reject(error);
        }
      },
    );

    const abort = () => request.destroy(new Error("HTTP fetch aborted."));
    input.signal.addEventListener("abort", abort, { once: true });
    request.on("error", reject);
    request.on("close", () => input.signal.removeEventListener("abort", abort));
    request.end();
  });
}

function getHeader(headers: Record<string, string>, name: string): string | null {
  const found = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return found?.[1] ?? null;
}

export type HttpFetchDependencies = {
  dnsLookup?: DnsLookup;
  transport?: (input: HttpFetchTransportInput) => Promise<HttpFetchTransportResponse>;
};

export async function fetchHttp(
  request: HttpFetchRequest,
  dependencies: HttpFetchDependencies = {},
): Promise<HttpFetchResponse> {
  validateRequest(request);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), request.timeoutMs);
  let currentUrl = request.url;
  let redirectCount = 0;
  const transport = dependencies.transport ?? requestBoundTarget;

  try {
    while (true) {
      const target = await resolveSafeHttpTarget(currentUrl, dependencies.dnsLookup);
      const headers: Record<string, string> = {};

      if (request.userAgent != null) {
        headers["user-agent"] = request.userAgent;
      }

      const response = await transport({
        url: target.url,
        address: target.address,
        family: target.family,
        hostname: target.hostname,
        headers,
        signal: controller.signal,
        maxResponseBytes: request.maxResponseBytes,
      });

      if (redirectStatuses.has(response.status)) {
        const location = getHeader(response.headers, "location");

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

      const contentLength = parseContentLength(getHeader(response.headers, "content-length"));
      if (contentLength != null && contentLength > request.maxResponseBytes) {
        throw new Error("HTTP response exceeds the configured size limit.");
      }

      return {
        finalUrl: currentUrl,
        status: response.status,
        headers: response.headers,
        body: response.body,
        redirected: redirectCount > 0,
        redirectCount,
        fetchedAt: new Date().toISOString(),
        contentType: getHeader(response.headers, "content-type"),
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
