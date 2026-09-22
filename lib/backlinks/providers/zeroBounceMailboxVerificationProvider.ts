import type { MailboxVerificationProvider, MailboxVerificationResult } from "../services/mailboxVerificationService";

export const ZEROBOUNCE_EU_VALIDATE_ENDPOINT = "https://api-eu.zerobounce.net/v2/validate";
const ZEROBOUNCE_TIMEOUT_MS = 8_000;

type FetchLike = (input: URL | string, init?: RequestInit) => Promise<Response>;

export type ZeroBounceMailboxVerificationProviderOptions = {
  apiKey: string | null | undefined;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
};

type ZeroBouncePayload = {
  status?: unknown;
  catch_all?: unknown;
  disposable?: unknown;
  role_based?: unknown;
};

function providerError(reason: string): MailboxVerificationResult {
  return { status: "provider_error", provider: "zerobounce", safeReason: reason };
}

function httpErrorReason(status: number): string {
  if (status === 400 || status === 401 || status === 403 || status === 429) return `ZEROBOUNCE_HTTP_${status}`;
  if (status >= 400 && status <= 499) return "ZEROBOUNCE_HTTP_4XX";
  if (status >= 500 && status <= 599) return "ZEROBOUNCE_HTTP_5XX";
  return "ZEROBOUNCE_HTTP_ERROR";
}

function optionalBoolean(value: unknown): boolean | undefined {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return undefined;
}

function parsePayload(value: unknown): ZeroBouncePayload | null {
  return typeof value === "object" && value != null && !Array.isArray(value) ? value : null;
}

function normalizeZeroBounceResult(payload: ZeroBouncePayload): MailboxVerificationResult {
  if (typeof payload.status !== "string") return providerError("ZEROBOUNCE_MALFORMED_STATUS");
  const status = payload.status.trim().toLowerCase();
  if (status === "") return providerError("ZEROBOUNCE_MALFORMED_STATUS");

  const safeMetadata = {
    ...(optionalBoolean(payload.catch_all) === undefined ? {} : { catchAll: optionalBoolean(payload.catch_all) }),
    ...(optionalBoolean(payload.disposable) === undefined ? {} : { disposable: optionalBoolean(payload.disposable) }),
    ...(optionalBoolean(payload.role_based) === undefined ? {} : { roleBased: optionalBoolean(payload.role_based) }),
  };
  const catchAll = safeMetadata.catchAll === true;
  const disposable = safeMetadata.disposable === true;
  if (status === "valid" && !catchAll && !disposable) return { status: "deliverable", provider: "zerobounce", safeReason: "ZEROBOUNCE_VALID", safeMetadata };
  if (status === "valid" && (catchAll || disposable)) return { status: "risky", provider: "zerobounce", safeReason: catchAll ? "ZEROBOUNCE_CATCH_ALL" : "ZEROBOUNCE_DISPOSABLE", safeMetadata };
  if (status === "invalid" || status === "spamtrap" || status === "abuse" || status === "do_not_mail") return { status: "undeliverable", provider: "zerobounce", safeReason: "ZEROBOUNCE_UNDELIVERABLE", safeMetadata };
  if (status === "catch-all") return { status: "risky", provider: "zerobounce", safeReason: "ZEROBOUNCE_CATCH_ALL", safeMetadata: { ...safeMetadata, catchAll: true } };
  if (status === "unknown") return { status: "unknown", provider: "zerobounce", safeReason: "ZEROBOUNCE_UNKNOWN", safeMetadata };
  return providerError("ZEROBOUNCE_UNSUPPORTED_STATUS");
}

export function createZeroBounceMailboxVerificationProvider(options: ZeroBounceMailboxVerificationProviderOptions): MailboxVerificationProvider {
  const apiKey = options.apiKey?.trim() ?? "";
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? ZEROBOUNCE_TIMEOUT_MS;
  return {
    async verify(input) {
      if (apiKey === "") return providerError("ZEROBOUNCE_NOT_CONFIGURED");
      if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000) return providerError("ZEROBOUNCE_INVALID_TIMEOUT");
      const endpoint = new URL(ZEROBOUNCE_EU_VALIDATE_ENDPOINT);
      endpoint.searchParams.set("api_key", apiKey);
      endpoint.searchParams.set("email", input.email);
      endpoint.searchParams.set("ip_address", "");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(endpoint, { method: "GET", signal: controller.signal, headers: { accept: "application/json" } });
        if (!response.ok) return providerError(httpErrorReason(response.status));
        let payload: unknown;
        try {
          payload = await response.json();
        } catch {
          return providerError("ZEROBOUNCE_INVALID_JSON");
        }
        const parsed = parsePayload(payload);
        return parsed == null ? providerError("ZEROBOUNCE_MALFORMED_RESPONSE") : normalizeZeroBounceResult(parsed);
      } catch {
        return providerError(controller.signal.aborted ? "ZEROBOUNCE_TIMEOUT" : "ZEROBOUNCE_NETWORK_ERROR");
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

/** Server-only configuration factory; it is intentionally not imported by client code. */
/** Closed by default; configuration can never select a non-EU ZeroBounce endpoint. */
export function getConfiguredMailboxVerificationProvider(environment: Readonly<Record<string, string | undefined>> = process.env): MailboxVerificationProvider | null {
  if (environment.BACKLINK_MAILBOX_VERIFICATION_PROVIDER?.trim().toLowerCase() !== "zerobounce") return null;
  const apiKey = environment.ZEROBOUNCE_API_KEY?.trim();
  return apiKey == null || apiKey === "" ? null : createZeroBounceMailboxVerificationProvider({ apiKey });
}
