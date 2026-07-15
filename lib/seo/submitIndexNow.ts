const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
const INDEXNOW_HOST = "norixo.io";
const DEFAULT_BATCH_SIZE = 200;

const EXCLUDED_PATH_PREFIXES = [
  "/api",
  "/dashboard",
  "/admin",
  "/sign-in",
  "/sign-up",
  "/analyze",
  "/onboarding",
] as const;

export type IndexNowSubmitOptions = {
  batchSize?: number;
  endpoint?: string;
  host?: string;
  key?: string;
  keyLocation?: string;
  source?: string;
};

export type IndexNowBatchResult = {
  batchNumber: number;
  submitted: number;
  ok: boolean;
  status: number | null;
  statusText: string | null;
  body: string | null;
};

export type IndexNowSubmitSummary = {
  endpoint: string;
  host: string;
  keyLocation: string;
  source: string | null;
  requested: number;
  accepted: number;
  filteredOut: number;
  batches: IndexNowBatchResult[];
  ok: boolean;
};

export function buildIndexNowKeyLocation(host: string, key: string) {
  return `https://${host}/${encodeURIComponent(key.trim())}.txt`;
}

function normalizeIndexNowUrl(rawUrl: string, host: string) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:") return null;
    if (parsed.hostname !== host) return null;
    const normalizedPath = `${parsed.pathname}${parsed.search}`;
    if (
      EXCLUDED_PATH_PREFIXES.some((prefix) =>
        normalizedPath === prefix ||
        normalizedPath.startsWith(`${prefix}/`) ||
        normalizedPath.startsWith(`${prefix}?`)
      )
    ) {
      return null;
    }
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

function chunkUrls(urls: string[], batchSize: number) {
  const chunks: string[][] = [];
  for (let index = 0; index < urls.length; index += batchSize) {
    chunks.push(urls.slice(index, index + batchSize));
  }
  return chunks;
}

export async function submitIndexNow(
  urls: string[],
  options: IndexNowSubmitOptions = {}
): Promise<IndexNowSubmitSummary> {
  const key = options.key ?? process.env.INDEXNOW_KEY ?? "";
  const trimmedKey = key.trim();

  if (!trimmedKey) {
    throw new Error("INDEXNOW_KEY is missing.");
  }

  const host = options.host ?? INDEXNOW_HOST;
  const endpoint = options.endpoint ?? INDEXNOW_ENDPOINT;
  const keyLocation = options.keyLocation ?? buildIndexNowKeyLocation(host, trimmedKey);
  const batchSize = Math.max(1, Math.min(options.batchSize ?? DEFAULT_BATCH_SIZE, 500));

  const normalizedUrls = Array.from(
    new Set(
      urls
        .map((candidate) => normalizeIndexNowUrl(candidate, host))
        .filter((candidate): candidate is string => Boolean(candidate))
    )
  );

  if (normalizedUrls.length === 0) {
    throw new Error("No eligible public URLs found for IndexNow submission.");
  }

  const batches = chunkUrls(normalizedUrls, batchSize);
  console.info("[indexnow] submitting", {
    source: options.source ?? null,
    host,
    requested: urls.length,
    accepted: normalizedUrls.length,
    batches: batches.length,
  });

  const results: IndexNowBatchResult[] = [];

  for (const [index, batch] of batches.entries()) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        host,
        key: trimmedKey,
        keyLocation,
        urlList: batch,
      }),
    });

    const responseBody = await response.text().catch(() => "");
    const batchResult: IndexNowBatchResult = {
      batchNumber: index + 1,
      submitted: batch.length,
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      body: responseBody || null,
    };
    results.push(batchResult);

    if (!response.ok) {
      console.error("[indexnow] batch_failed", {
        batch: batchResult.batchNumber,
        status: batchResult.status,
        statusText: batchResult.statusText,
      });
    }
  }

  const summary: IndexNowSubmitSummary = {
    endpoint,
    host,
    keyLocation,
    source: options.source ?? null,
    requested: urls.length,
    accepted: normalizedUrls.length,
    filteredOut: urls.length - normalizedUrls.length,
    batches: results,
    ok: results.every((batch) => batch.ok),
  };

  console.info("[indexnow] submission_complete", {
    accepted: summary.accepted,
    filteredOut: summary.filteredOut,
    ok: summary.ok,
  });

  return summary;
}
