import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cities } from "../data/cities";
import { assembleGlobalPage, renderGlobalPageText } from "../lib/seo/v3/globalPage";

/**
 * Offline check of a global page spec (JSON). Reads one file, prints the verdict, writes nothing, uses no network.
 *
 *   npx tsx scripts/seo-v3-global-check.ts <spec.json> [--text]
 *
 * Place names (cities and countries of data/cities.ts) are refused in a global page. Exit code 0 = pending human
 * editorial validation (never "approved"), 2 = refused, 1 = bad usage.
 */
const file = process.argv[2];
if (file === undefined || file.startsWith("--")) {
  console.error("usage: seo-v3-global-check.ts <spec.json> [--text]");
  process.exit(1);
}
const placeNames = [...new Set(cities.flatMap((city) => [city.name, city.country]))];
const page = assembleGlobalPage(JSON.parse(readFileSync(resolve(file), "utf8")), { placeNames });
if (process.argv.includes("--text")) process.stdout.write(`${renderGlobalPageText(page)}\n`);
else process.stdout.write(`${JSON.stringify({ status: page.status, reasons: page.reasons, topic: page.topic, metrics: page.metrics, contentHash: page.contentHash }, null, 2)}\n`);
process.exitCode = page.status === "refused" ? 2 : 0;
