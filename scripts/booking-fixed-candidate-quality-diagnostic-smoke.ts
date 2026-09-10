import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const searchSource = readFileSync("lib/competitors/searchCompetitors.ts", "utf8");
const typesSource = readFileSync("lib/competitors/types.ts", "utf8");
const routeSource = readFileSync(
  "app/api/admin/marketing-studio/debug/booking-cross-platform-quality/route.ts",
  "utf8"
);
const bridgePageSource = readFileSync(
  "app/(default)/dashboard/admin/diagnostics/booking-cross-platform-quality/page.tsx",
  "utf8"
);
const bridgeClientSource = readFileSync(
  "app/(default)/dashboard/admin/diagnostics/booking-cross-platform-quality/BookingCrossPlatformQualityDiagnosticClient.tsx",
  "utf8"
);

const bookingUrlCount = (
  routeSource.match(/https:\/\/www\.booking\.com\/hotel\/ma\/[^"]+\.fr\.html/g) ?? []
).length;

assert.equal(bookingUrlCount, 10, "diagnostic route must use the fixed 10 Y3 Booking URLs");
assert.match(routeSource, /platform:\s*"airbnb"/, "diagnostic target must remain an Airbnb target");
assert.match(routeSource, /sourcePriority:\s*\["booking"\]/, "diagnostic must force Booking candidates");
assert.match(routeSource, /mode:\s*"preview_fixed_booking_candidates"/, "fixed mode must be explicit");
assert.match(routeSource, /fixedBookingCandidateUrls:\s*\[\.\.\.FIXED_BOOKING_CANDIDATE_URLS\]/);
assert.match(routeSource, /process\.env\.VERCEL_ENV\s*===\s*"production"/);
assert.match(routeSource, /Booking cross-platform quality diagnostic is unavailable in production/);
assert.match(routeSource, /url\.searchParams\.get\("confirm"\)\s*!==\s*CONFIRM_VALUE/);
assert.match(routeSource, /brightDataConfigured:\s*isBrightDataConfigured\(\)/);
assert.match(routeSource, /createRequestSupabaseClient\(request\)/);
assert.match(routeSource, /requestClient\.auth\.getUser\(\)/);
assert.match(routeSource, /isAdminPrivateEmail\(user\.email\)/);

assert.match(bridgePageSource, /process\.env\.VERCEL_ENV\s*===\s*"production"/);
assert.match(bridgePageSource, /This temporary diagnostic page is disabled in production/);
assert.match(
  bridgePageSource,
  /return <BookingCrossPlatformQualityDiagnosticClient \/>/,
  "preview page must render only the authenticated bridge client outside production"
);

assert.match(bridgeClientSource, /"use client"/);
assert.match(bridgeClientSource, /getSharedSession\(\)/);
assert.match(bridgeClientSource, /session\?\.access_token/);
assert.match(
  bridgeClientSource,
  /Authorization:\s*`Bearer \$\{accessToken\}`/,
  "bridge must send the Supabase browser session token as a bearer header"
);
assert.match(bridgeClientSource, /method:\s*"GET"/);
assert.match(bridgeClientSource, /cache:\s*"no-store"/);
assert.match(
  bridgeClientSource,
  /\/api\/admin\/marketing-studio\/debug\/booking-cross-platform-quality/,
  "bridge must call only the existing diagnostic route"
);
assert.match(
  bridgeClientSource,
  /confirm:\s*CONFIRM_VALUE/,
  "bridge must preserve explicit diagnostic confirmation"
);
assert.match(
  bridgeClientSource,
  /runDiagnostic\("fixed"\)/,
  "bridge must preserve the fixed-candidate diagnostic action"
);
assert.equal(bridgeClientSource.includes("console."), false, "bridge must not log tokens or payloads");
assert.equal(
  bridgeClientSource.includes("?access_token"),
  false,
  "bridge must not put tokens in query strings"
);
const clientRenderSource = bridgeClientSource.slice(bridgeClientSource.indexOf("return ("));
assert.equal(clientRenderSource.includes("accessToken"), false, "bridge must not render accessToken");
assert.equal(clientRenderSource.includes("access_token"), false, "bridge must not render access_token");

assert.match(
  typesSource,
  /diagnostic\?:\s*\{[\s\S]*mode:\s*"preview_fixed_booking_candidates"/
);
assert.match(typesSource, /bookingFixedCandidateQuality\?:\s*BookingFixedCandidateQualityDiagnostic/);

assert.match(searchSource, /const PREVIEW_FIXED_BOOKING_CANDIDATES_MODE = "preview_fixed_booking_candidates"/);
assert.match(searchSource, /const diagnosticFixedBookingEnabled = fixedBookingCandidateUrls\.length > 0/);
assert.match(
  searchSource,
  /const bookingUrls = diagnosticFixedBookingEnabled\s*\?[\s\S]*\(\(\) =>/,
  "fixed diagnostic mode must bypass getCandidateUrls discovery"
);
assert.match(searchSource, /buildBookingUrlWithDates\(url, bookingDiscoveryTarget\.url \?\? null\)/);
assert.match(searchSource, /: await getCandidateUrls\(/, "normal discovery path must remain intact");
assert.match(
  searchSource,
  /const extractedBatch = await runLimitedConcurrency\([\s\S]*batchUrls,[\s\S]*COMPETITOR_EXTRACT_CONCURRENCY,[\s\S]*\(c\) => extractOneComparable\(c\)/
);
assert.match(searchSource, /evaluateComparableCandidates\(/, "production evaluation must remain in path");
assert.match(searchSource, /buildPostEvaluationComparablePool\(/, "production final pool must remain in path");
assert.match(searchSource, /!diagnosticFixedBookingEnabled &&[\s\S]*String\(searchInput\.target\.platform/);
assert.match(searchSource, /!diagnosticFixedBookingEnabled &&[\s\S]*ENABLE_AIRBNB_TOPUP_FOR_BOOKING/);
assert.match(searchSource, /discoveryBypassed:\s*true/);

const forbiddenRouteSnippets = [
  "createSupabaseAdminClient",
  "saveMarketSnapshot",
  "lookupMarketSnapshot",
  ".from(",
  ".insert(",
  ".update(",
  ".upsert(",
  ".delete(",
  ".rpc(",
  "BRIGHTDATA_BROWSER_PASSWORD:",
  "BRIGHTDATA_PASSWORD:",
  "process.env.BRIGHTDATA_BROWSER_PASSWORD,",
  "process.env.BRIGHTDATA_PASSWORD,",
];

for (const snippet of forbiddenRouteSnippets) {
  assert.equal(
    routeSource.includes(snippet),
    false,
    `diagnostic route must not include forbidden snippet: ${snippet}`
  );
  assert.equal(
    bridgeClientSource.includes(snippet),
    false,
    `diagnostic bridge must not include forbidden snippet: ${snippet}`
  );
}

console.log("booking-fixed-candidate-quality-diagnostic-smoke: PASS");
