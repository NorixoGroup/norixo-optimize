import assert from "node:assert/strict";
import fs from "node:fs";

const routePath =
  "app/api/admin/marketing-studio/debug/booking-cross-platform-quality/route.ts";
const clientPath =
  "app/(default)/dashboard/admin/diagnostics/booking-cross-platform-quality/BookingCrossPlatformQualityDiagnosticClient.tsx";
const pagePath =
  "app/(default)/dashboard/admin/diagnostics/booking-cross-platform-quality/page.tsx";
const bookingSearchPath = "lib/competitors/booking-search.ts";

const route = fs.readFileSync(routePath, "utf8");
const client = fs.readFileSync(clientPath, "utf8");
const page = fs.readFileSync(pagePath, "utf8");
const bookingSearch = fs.readFileSync(bookingSearchPath, "utf8");

assert.match(route, /process\.env\.VERCEL_ENV === "production"/);
assert.match(route, /Booking cross-platform quality diagnostic is unavailable in production/);
assert.match(route, /404/);

assert.match(route, /url\.searchParams\.get\("confirm"\) !== CONFIRM_VALUE/);
assert.match(route, /createRequestSupabaseClient\(request\)/);
assert.match(route, /requestClient\.auth\.getUser\(\)/);
assert.match(route, /isAdminPrivateEmail\(user\.email\)/);
assert.match(route, /"Cache-Control": "no-store"/);

assert.match(
  route,
  /import \{ runPreviewBookingSerpMetadataDiagnostic \} from "@\/lib\/competitors\/booking-search"/
);
assert.match(route, /const SERP_MODE = "serp"/);
assert.match(route, /if \(mode === SERP_MODE\)/);
assert.match(
  route,
  /const serpMetadata = await runPreviewBookingSerpMetadataDiagnostic\([\s\S]*?AIRBNB_STUDIO_TARGET/
);
assert.match(route, /normalizedTargetCountry: "morocco"/);
assert.match(route, /mode: "preview_booking_serp_metadata"/);
assert.match(route, /serpMetadata/);

const serpBranchStart = route.indexOf("if (mode === SERP_MODE)");
const invalidModeStart = route.indexOf("if (mode !== FIXED_MODE)");
assert.ok(serpBranchStart >= 0);
assert.ok(invalidModeStart > serpBranchStart);

const serpBranch = route.slice(serpBranchStart, invalidModeStart);

for (const forbidden of [
  "runWazoPriceRecoveryDiagnostic(",
  "searchCompetitorsAroundTarget(",
  "extractListing(",
  "preview_fixed_booking_candidates",
]) {
  assert.equal(
    serpBranch.includes(forbidden),
    false,
    `SERP route branch must not execute ${forbidden}`
  );
}

assert.match(
  bookingSearch,
  /individualListingExtractionExecuted: false/
);
assert.match(
  bookingSearch,
  /comparableEvaluationExecuted: false/
);

assert.match(client, /"use client"/);
assert.match(client, /getSharedSession\(\)/);
assert.match(client, /session\?\.access_token/);
assert.match(client, /Authorization: `Bearer \$\{accessToken\}`/);
assert.match(client, /method: "GET"/);
assert.match(client, /cache: "no-store"/);
assert.match(client, /runDiagnostic\("fixed"\)/);
assert.match(client, /runDiagnostic\("serp"\)/);
assert.match(client, /mode,/);
assert.match(client, /confirm: CONFIRM_VALUE/);
assert.match(client, /Run Booking SERP metadata diagnostic/);

assert.equal(client.includes("console."), false);
assert.equal(client.includes("?access_token"), false);

const clientRender = client.slice(client.indexOf("return ("));
assert.equal(
  clientRender.includes("accessToken"),
  false,
  "access token must never be rendered"
);

assert.match(page, /process\.env\.VERCEL_ENV === "production"/);
assert.match(page, /This temporary diagnostic page is disabled in production/);

for (const forbidden of [
  ".insert(",
  ".update(",
  ".upsert(",
  ".delete(",
  ".rpc(",
]) {
  assert.equal(
    serpBranch.includes(forbidden),
    false,
    `SERP route branch must not write data: ${forbidden}`
  );
}

console.log("booking-serp-metadata-preview-bridge-smoke: PASS");
