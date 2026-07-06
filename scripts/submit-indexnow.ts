import { buildIndexNowKeyLocation, submitIndexNow } from "@/lib/seo/submitIndexNow";

const DEFAULT_SITEMAP_URL = "https://norixo.io/sitemap.xml";
const DEFAULT_LIMIT = Number.POSITIVE_INFINITY;

function readLimitFromArgs(argv: string[]) {
  const limitArg = argv.find((arg) => arg.startsWith("--limit="));
  if (!limitArg) return DEFAULT_LIMIT;
  const parsed = Number.parseInt(limitArg.slice("--limit=".length), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid --limit value: ${limitArg}`);
  }
  return parsed;
}

function extractLocUrls(xml: string) {
  const matches = xml.matchAll(/<loc>(.*?)<\/loc>/g);
  return Array.from(matches, (match) => match[1]?.trim()).filter(
    (value): value is string => Boolean(value)
  );
}

async function ensurePublicKeyFile(key: string) {
  const keyLocation = buildIndexNowKeyLocation("norixo.io", key);
  const maskedKeyLocation = keyLocation.replace(encodeURIComponent(key), "[MASKED_INDEXNOW_KEY]");
  const response = await fetch(keyLocation, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(
      `IndexNow key file is not publicly accessible yet (${response.status} ${response.statusText}) at ${maskedKeyLocation}.`
    );
  }
  const body = (await response.text()).trim();
  if (body !== key) {
    throw new Error(
      `IndexNow key file content does not match INDEXNOW_KEY at ${maskedKeyLocation}.`
    );
  }
  return keyLocation;
}

async function main() {
  const key = process.env.INDEXNOW_KEY?.trim();
  if (!key) {
    throw new Error("INDEXNOW_KEY is missing. Add it to the environment before submitting.");
  }

  const limit = readLimitFromArgs(process.argv.slice(2));
  const keyLocation = await ensurePublicKeyFile(key);

  const sitemapResponse = await fetch(DEFAULT_SITEMAP_URL, { cache: "no-store" });
  if (!sitemapResponse.ok) {
    throw new Error(
      `Unable to fetch sitemap (${sitemapResponse.status} ${sitemapResponse.statusText}) at ${DEFAULT_SITEMAP_URL}.`
    );
  }

  const sitemapXml = await sitemapResponse.text();
  const sitemapUrls = extractLocUrls(sitemapXml);
  if (sitemapUrls.length === 0) {
    throw new Error("No <loc> entries found in the production sitemap.");
  }

  const urlsToSubmit = sitemapUrls.slice(0, limit);
  const summary = await submitIndexNow(urlsToSubmit, {
    key,
    keyLocation,
    source: DEFAULT_SITEMAP_URL,
  });

  console.info(
    JSON.stringify(
      {
        endpoint: summary.endpoint,
        host: summary.host,
        keyLocation: summary.keyLocation.replace(
          encodeURIComponent(key),
          "[MASKED_INDEXNOW_KEY]"
        ),
        source: summary.source,
        requested: summary.requested,
        accepted: summary.accepted,
        filteredOut: summary.filteredOut,
        ok: summary.ok,
        batches: summary.batches.map((batch) => ({
          batchNumber: batch.batchNumber,
          submitted: batch.submitted,
          ok: batch.ok,
          status: batch.status,
          statusText: batch.statusText,
        })),
      },
      null,
      2
    )
  );

  if (!summary.ok) {
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  console.error(
    "[indexnow] submit_failed",
    error instanceof Error ? error.message : String(error)
  );
  process.exitCode = 1;
});
