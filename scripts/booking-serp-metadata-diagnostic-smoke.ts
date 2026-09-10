import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const bookingSearchPath = path.join(
  root,
  "lib/competitors/booking-search.ts"
);

const source = fs.readFileSync(bookingSearchPath, "utf8");

assert.match(
  source,
  /const serpCardSnapshot = await input\.page\.\$\$eval\(/,
  "SERP metadata snapshot must be collected from the already-rendered Booking page"
);

assert.match(
  source,
  /'a\[href\*="\/hotel\/"\]'/,
  "collector must remain scoped to Booking property links"
);

assert.match(
  source,
  /element\.closest\('\[data-testid="property-card"\]'\)/,
  "metadata must be scoped to the same Booking property card"
);

assert.equal(
  source.includes("document.body.innerText"),
  false,
  "collector must never classify whole-page body text"
);

assert.equal(
  source.includes("document.body.textContent"),
  false,
  "collector must never classify whole-page body text"
);

assert.match(
  source,
  /const rowsByUrl = new Map<string, SerpCardRow>\(\)/,
  "duplicate Booking URLs must be grouped before returning the snapshot"
);

const collectorStart = source.indexOf(
  "const serpCardSnapshot = await input.page.$$eval"
);
const collectorEnd = source.indexOf(
  'step = "merge_results"',
  collectorStart
);

assert.ok(collectorStart >= 0, "SERP collector start must exist");
assert.ok(collectorEnd > collectorStart, "SERP collector end must exist");

const collectorSource = source.slice(collectorStart, collectorEnd);

assert.equal(
  collectorSource.includes("const seen = new Set<string>()"),
  false,
  "first-anchor-wins dedupe must be removed from the SERP collector"
);

assert.match(
  source,
  /if \(candidate\.hasPropertyCard !== current\.hasPropertyCard\) \{\s*return candidate\.hasPropertyCard;\s*\}/,
  "property-card scoped representation must outrank an unscoped duplicate"
);

assert.match(
  source,
  /if \(candidateHasTitle !== currentHasTitle\) \{\s*return candidateHasTitle;\s*\}/,
  "titled representation must outrank an untitled duplicate"
);

assert.match(
  source,
  /candidate\.signals\.length > current\.signals\.length/,
  "representation with more sanitized signals must win"
);

assert.match(
  source,
  /return candidate\.sourceIndex < current\.sourceIndex;/,
  "equal-quality duplicates must resolve deterministically to earliest source occurrence"
);

assert.match(
  source,
  /\.sort\(\(a, b\) => a\.sourceIndex - b\.sourceIndex\)/,
  "final snapshot ordering must remain deterministic"
);

assert.match(
  source,
  /\.map\(\(\{ url, title, signals \}\) => \(\{\s*url,\s*title,\s*signals,\s*\}\)\)/,
  "internal richness metadata must be stripped before snapshot serialization"
);

for (const forbidden of [
  "rawHtml",
  "raw_html",
  "rawJson",
  "raw_json",
  "cookie",
  "cookies",
]) {
  assert.equal(
    source.includes(forbidden),
    false,
    `Booking SERP collector must not introduce sensitive field: ${forbidden}`
  );
}

const protectedTerms = [
  "property_type_mismatch",
  "skipBookingPriceRecovery",
  "getNormalizedComparableType",
];

const snapshotStart = source.indexOf(
  "const serpCardSnapshot = await input.page.$$eval"
);
const snapshotEnd = source.indexOf(
  'step = "merge_results"',
  snapshotStart
);

assert.ok(snapshotStart >= 0, "snapshot start must exist");
assert.ok(snapshotEnd > snapshotStart, "snapshot end must exist");

const snapshotSource = source.slice(snapshotStart, snapshotEnd);

for (const protectedTerm of protectedTerms) {
  assert.equal(
    snapshotSource.includes(protectedTerm),
    false,
    `SERP diagnostic collector must not contain production authority: ${protectedTerm}`
  );
}

console.log("booking-serp-metadata-diagnostic-smoke: PASS");

assert.match(
  source,
  /export type BookingSerpMetadataDiagnosticEvent = \{/,
  "typed SERP diagnostic event must exist"
);

assert.match(
  source,
  /phase: "primary" \| "country_fallback"/,
  "diagnostic event must distinguish primary and conditional fallback"
);

assert.match(
  source,
  /onSerpMetadataDiagnostic\?: BookingSerpMetadataDiagnosticCallback/,
  "Booking discovery must expose optional diagnostic callback"
);

assert.match(
  source,
  /diagnosticPhase: "primary",[\s\S]{0,160}onSerpMetadataDiagnostic/,
  "primary Source-C call must be instrumented"
);

assert.match(
  source,
  /diagnosticPhase: "country_fallback",[\s\S]{0,160}onSerpMetadataDiagnostic/,
  "country fallback Source-C call must be instrumented"
);

assert.match(
  source,
  /resolvedSearchUrl: sanitizeBookingSerpDiagnosticUrl\(input\.page\.url\(\)\)/,
  "resolved URL must be sanitized"
);

assert.match(
  source,
  /candidates: serpCardSnapshot\.slice\(0, 80\)/,
  "SERP candidate diagnostic must remain bounded"
);

assert.match(
  source,
  /export async function runPreviewBookingSerpMetadataDiagnostic\(/,
  "isolated Preview helper must exist"
);

assert.match(
  source,
  /skipEmbeddedAndNetwork: true/,
  "Preview helper must force Source-C discovery"
);

assert.match(
  source,
  /individualListingExtractionExecuted: false/,
  "Preview SERP helper must stop before listing extraction"
);

assert.match(
  source,
  /comparableEvaluationExecuted: false/,
  "Preview SERP helper must stop before comparable evaluation"
);

const b2bHelperStart = source.indexOf(
  "export async function runPreviewBookingSerpMetadataDiagnostic("
);
assert.ok(b2bHelperStart >= 0);

const b2bHelper = source.slice(b2bHelperStart);

for (const forbidden of [
  "extractListing(",
  "extractOneComparable(",
  "evaluateComparableCandidates(",
  "buildPostEvaluationComparablePool(",
  "saveMarketSnapshot(",
  "lookupMarketSnapshot(",
  ".from(",
  ".insert(",
  ".update(",
  ".upsert(",
  ".delete(",
  ".rpc(",
]) {
  assert.equal(
    b2bHelper.includes(forbidden),
    false,
    `discovery-only helper crossed protected boundary: ${forbidden}`
  );
}

console.log("booking-serp-metadata-diagnostic-b2b-smoke: PASS");
