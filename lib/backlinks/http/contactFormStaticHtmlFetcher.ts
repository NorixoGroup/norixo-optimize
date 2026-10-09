import { lookup } from "node:dns/promises";
import type { IncomingHttpHeaders } from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import tls from "node:tls";

import { isPublicIpAddress } from "@/lib/backlinks/services/contactFormNavigationWorker";

const MAX_REDIRECTS = 3;
const MAX_RESPONSE_BYTES = 1024 * 1024;
const TOTAL_TIMEOUT_MS = 10_000;
const CONNECT_TIMEOUT_MS = 3_000;
const IDLE_TIMEOUT_MS = 5_000;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export type ContactFormStaticHtmlAddress = Readonly<{ address: string; family: 4 | 6 }>;
export type ContactFormStaticHtmlSuccess = Readonly<{
  ok: true;
  originalUrl: string;
  finalUrl: string;
  html: string;
  contentType: string;
  redirectCount: number;
}>;
export type ContactFormStaticHtmlFailure = Readonly<{
  ok: false;
  originalUrl: string;
  safeErrorCode: ContactFormStaticHtmlSafeErrorCode;
}>;
export type ContactFormStaticHtmlResult = ContactFormStaticHtmlSuccess | ContactFormStaticHtmlFailure;
export type ContactFormStaticHtmlSafeErrorCode =
  | "CONTACT_FORM_STATIC_URL_INVALID"
  | "CONTACT_FORM_STATIC_HTTPS_REQUIRED"
  | "CONTACT_FORM_STATIC_CREDENTIALS_REJECTED"
  | "CONTACT_FORM_STATIC_HOSTNAME_REJECTED"
  | "CONTACT_FORM_STATIC_PORT_REJECTED"
  | "CONTACT_FORM_STATIC_DNS_FAILED"
  | "CONTACT_FORM_STATIC_DNS_UNSAFE"
  | "CONTACT_FORM_STATIC_TLS_FAILED"
  | "CONTACT_FORM_STATIC_TIMEOUT"
  | "CONTACT_FORM_STATIC_RESPONSE_TOO_LARGE"
  | "CONTACT_FORM_STATIC_RESPONSE_COMPRESSED"
  | "CONTACT_FORM_STATIC_RESPONSE_NOT_HTML"
  | "CONTACT_FORM_STATIC_RESPONSE_TRUNCATED"
  | "CONTACT_FORM_STATIC_REDIRECT_INVALID"
  | "CONTACT_FORM_STATIC_REDIRECT_FORBIDDEN"
  | "CONTACT_FORM_STATIC_REDIRECT_LIMIT"
  | "CONTACT_FORM_STATIC_REQUEST_FAILED";

type ValidatedTarget = Readonly<{ url: URL; hostname: string; address: ContactFormStaticHtmlAddress }>;
type TransportResponse = Readonly<{ status: number; headers: Record<string, string>; body: string }>;
type FetchDependencies = Readonly<{
  resolveHostname?: (hostname: string) => Promise<readonly ContactFormStaticHtmlAddress[]>;
  transport?: (target: ValidatedTarget, signal: AbortSignal) => Promise<TransportResponse>;
}>;

class FetcherError extends Error {
  constructor(readonly code: ContactFormStaticHtmlSafeErrorCode) { super(code); }
}

function normalizeHostname(hostname: string): string | null {
  const normalized = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (!normalized || isIP(normalized) !== 0 || normalized === "localhost" || normalized.endsWith(".localhost") || normalized.endsWith(".local") || normalized.endsWith(".internal")) return null;
  if (normalized.length > 253 || normalized.split(".").some((label) => !label || label.length > 63 || !/^[a-z0-9-]+$/.test(label) || label.startsWith("-") || label.endsWith("-"))) return null;
  return normalized;
}

function validateUrl(rawUrl: string): { url: URL; hostname: string } {
  const value = rawUrl.trim();
  if (!value || value !== rawUrl || /[\u0000-\u001f\u007f\\\s]/.test(value)) throw new FetcherError("CONTACT_FORM_STATIC_URL_INVALID");
  let url: URL;
  try { url = new URL(value); } catch { throw new FetcherError("CONTACT_FORM_STATIC_URL_INVALID"); }
  if (url.protocol !== "https:") throw new FetcherError("CONTACT_FORM_STATIC_HTTPS_REQUIRED");
  if (url.username || url.password) throw new FetcherError("CONTACT_FORM_STATIC_CREDENTIALS_REJECTED");
  if (url.port !== "") throw new FetcherError("CONTACT_FORM_STATIC_PORT_REJECTED");
  const hostname = normalizeHostname(url.hostname);
  if (hostname == null) throw new FetcherError("CONTACT_FORM_STATIC_HOSTNAME_REJECTED");
  url.hash = "";
  return { url, hostname };
}

function safeOriginalUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    url.username = "";
    url.password = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

async function resolveTarget(rawUrl: string, resolveHostname: NonNullable<FetchDependencies["resolveHostname"]>): Promise<ValidatedTarget> {
  const { url, hostname } = validateUrl(rawUrl);
  let addresses: readonly ContactFormStaticHtmlAddress[];
  try { addresses = await resolveHostname(hostname); } catch { throw new FetcherError("CONTACT_FORM_STATIC_DNS_FAILED"); }
  if (!addresses.length) throw new FetcherError("CONTACT_FORM_STATIC_DNS_FAILED");
  const normalized = addresses.map((entry) => ({ address: entry.address.trim().replace(/^\[|\]$/g, ""), family: entry.family }));
  if (normalized.some((entry) => (entry.family !== 4 && entry.family !== 6) || isIP(entry.address) !== entry.family || !isPublicIpAddress(entry.address))) throw new FetcherError("CONTACT_FORM_STATIC_DNS_UNSAFE");
  normalized.sort((a, b) => a.family - b.family || a.address.localeCompare(b.address));
  return { url, hostname, address: normalized[0]! };
}

function oneHeader(headers: IncomingHttpHeaders, name: string): string | null {
  const value = headers[name];
  return Array.isArray(value) ? value.join(", ") : value == null ? null : String(value);
}

function responseHeaders(headers: IncomingHttpHeaders): Record<string, string> {
  return Object.fromEntries(Object.entries(headers).flatMap(([key, value]) => value == null ? [] : [[key, Array.isArray(value) ? value.join(", ") : String(value)]]));
}

function assertResponseHeaders(headers: IncomingHttpHeaders): void {
  const encoding = oneHeader(headers, "content-encoding")?.trim().toLowerCase();
  if (encoding != null && encoding !== "identity") throw new FetcherError("CONTACT_FORM_STATIC_RESPONSE_COMPRESSED");
  const length = oneHeader(headers, "content-length");
  if (length != null && (!/^\d+$/.test(length) || Number(length) > MAX_RESPONSE_BYTES)) throw new FetcherError("CONTACT_FORM_STATIC_RESPONSE_TOO_LARGE");
}

async function requestPinnedTarget(target: ValidatedTarget, signal: AbortSignal, testOptions: Readonly<{ ca?: Buffer }> = {}): Promise<TransportResponse> {
  return new Promise((resolve, reject) => {
    let connectTimer: ReturnType<typeof setTimeout> | undefined;
    let settled = false;
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      if (connectTimer != null) clearTimeout(connectTimer);
      request.destroy();
      reject(error);
    };
    const request = https.request({
      protocol: "https:", hostname: target.address.address, family: target.address.family, port: target.url.port === "" ? 443 : Number(target.url.port),
      path: `${target.url.pathname}${target.url.search}`, method: "GET", agent: false,
      headers: { Host: target.hostname, Accept: "text/html,application/xhtml+xml", "Accept-Encoding": "identity", "User-Agent": "Norixo-Contact-Form-Static-Preflight/1.0" },
      servername: target.hostname, rejectUnauthorized: true,
      ...(testOptions.ca == null ? {} : { ca: testOptions.ca }),
      checkServerIdentity: (_servername, certificate) => tls.checkServerIdentity(target.hostname, certificate), signal,
    }, async (response) => {
      try {
        if (connectTimer != null) clearTimeout(connectTimer);
        assertResponseHeaders(response.headers);
        const chunks: Buffer[] = [];
        let bytes = 0;
        for await (const chunk of response) {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          bytes += buffer.byteLength;
          if (bytes > MAX_RESPONSE_BYTES) throw new FetcherError("CONTACT_FORM_STATIC_RESPONSE_TOO_LARGE");
          chunks.push(buffer);
        }
        const contentLength = oneHeader(response.headers, "content-length");
        if (!response.complete || (contentLength != null && bytes !== Number(contentLength))) throw new FetcherError("CONTACT_FORM_STATIC_RESPONSE_TRUNCATED");
        if (!settled) {
          settled = true;
          resolve({ status: response.statusCode ?? 0, headers: responseHeaders(response.headers), body: Buffer.concat(chunks, bytes).toString("utf8") });
        }
      } catch (error) { fail(error); }
    });
    connectTimer = setTimeout(() => fail(new FetcherError("CONTACT_FORM_STATIC_TIMEOUT")), CONNECT_TIMEOUT_MS);
    request.once("socket", (socket) => {
      socket.setTimeout(IDLE_TIMEOUT_MS);
      socket.once("timeout", () => fail(new FetcherError("CONTACT_FORM_STATIC_TIMEOUT")));
      socket.once("secureConnect", () => { if (connectTimer != null) clearTimeout(connectTimer); });
    });
    request.once("error", (error) => {
      if (signal.aborted) fail(new FetcherError("CONTACT_FORM_STATIC_TIMEOUT"));
      else if ((error as { code?: string }).code?.startsWith("ERR_TLS") || (error as { code?: string }).code === "DEPTH_ZERO_SELF_SIGNED_CERT") fail(new FetcherError("CONTACT_FORM_STATIC_TLS_FAILED"));
      else fail(error);
    });
    request.end();
  });
}

function header(headers: Record<string, string>, name: string): string | null {
  return Object.entries(headers).find(([key]) => key.toLowerCase() === name)?.[1] ?? null;
}

function contentType(headers: Record<string, string>): string | null {
  const value = header(headers, "content-type")?.split(";", 1)[0]?.trim().toLowerCase() ?? null;
  return value === "text/html" || value === "application/xhtml+xml" ? value : null;
}

function assertTransportResponse(response: TransportResponse): void {
  const encoding = header(response.headers, "content-encoding")?.trim().toLowerCase();
  if (encoding != null && encoding !== "identity") throw new FetcherError("CONTACT_FORM_STATIC_RESPONSE_COMPRESSED");
  const declaredLength = header(response.headers, "content-length");
  const actualLength = Buffer.byteLength(response.body, "utf8");
  if (declaredLength != null && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > MAX_RESPONSE_BYTES || Number(declaredLength) !== actualLength)) throw new FetcherError(Number(declaredLength) > MAX_RESPONSE_BYTES ? "CONTACT_FORM_STATIC_RESPONSE_TOO_LARGE" : "CONTACT_FORM_STATIC_RESPONSE_TRUNCATED");
  if (actualLength > MAX_RESPONSE_BYTES) throw new FetcherError("CONTACT_FORM_STATIC_RESPONSE_TOO_LARGE");
}

async function fetchInternal(originalUrl: string, dependencies: FetchDependencies): Promise<ContactFormStaticHtmlResult> {
  const safeOriginal = safeOriginalUrl(originalUrl);
  const resolveHostname = dependencies.resolveHostname ?? (async (hostname) => lookup(hostname, { all: true, verbatim: true }).then((records) => records.map((record) => ({ address: record.address, family: record.family === 6 ? 6 : 4 }))));
  const controller = new AbortController();
  const budget = setTimeout(() => controller.abort(), TOTAL_TIMEOUT_MS);
  try {
    let currentUrl = originalUrl;
    let originHostname: string | null = null;
    for (let redirects = 0; ; ) {
      const target = await resolveTarget(currentUrl, resolveHostname);
      if (originHostname == null) originHostname = target.hostname;
      else if (target.hostname !== originHostname) throw new FetcherError("CONTACT_FORM_STATIC_REDIRECT_FORBIDDEN");
      const response = await (dependencies.transport ?? requestPinnedTarget)(target, controller.signal);
      assertTransportResponse(response);
      if (REDIRECT_STATUSES.has(response.status)) {
        if (redirects >= MAX_REDIRECTS) throw new FetcherError("CONTACT_FORM_STATIC_REDIRECT_LIMIT");
        const location = header(response.headers, "location");
        if (location == null) throw new FetcherError("CONTACT_FORM_STATIC_REDIRECT_INVALID");
        let next: URL;
        try { next = new URL(location, target.url); } catch { throw new FetcherError("CONTACT_FORM_STATIC_REDIRECT_INVALID"); }
        currentUrl = next.toString();
        redirects += 1;
        continue;
      }
      const htmlContentType = contentType(response.headers);
      if (htmlContentType == null) throw new FetcherError("CONTACT_FORM_STATIC_RESPONSE_NOT_HTML");
      return { ok: true, originalUrl: safeOriginal, finalUrl: target.url.toString(), html: response.body, contentType: htmlContentType, redirectCount: redirects };
    }
  } catch (error) {
    const safeErrorCode = error instanceof FetcherError ? error.code : controller.signal.aborted ? "CONTACT_FORM_STATIC_TIMEOUT" : "CONTACT_FORM_STATIC_REQUEST_FAILED";
    return { ok: false, originalUrl: safeOriginal, safeErrorCode };
  } finally { clearTimeout(budget); }
}

export async function fetchContactFormStaticHtml(url: string): Promise<ContactFormStaticHtmlResult> {
  return fetchInternal(url, {});
}

/** Test-only hooks; production callers can use only fetchContactFormStaticHtml. */
export const contactFormStaticHtmlFetcherTestHooks = { fetchInternal, requestPinnedTarget } as const;
