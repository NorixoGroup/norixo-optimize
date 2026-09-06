import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function main() {
  const page = read("app/(default)/free-audit/page.tsx");
  const localizedPage = read("app/[locale]/free-audit/page.tsx");
  const content = read("app/(default)/free-audit/FreeAuditListingContent.tsx");
  const result = read("app/(default)/free-audit/FreeAuditListingResult.tsx");
  const model = read("app/(default)/free-audit/freeAuditPageModel.ts");
  const modeCopy = read("app/(default)/free-audit/freeAuditListingModeCopy.ts");

  assert.equal(page.includes("FreeAuditListingContent"), true);
  assert.equal(localizedPage.includes("FreeAuditListingContent"), true);
  assert.equal(page.includes("getFreeAuditListingSeoCopy"), true);
  assert.equal(localizedPage.includes("getFreeAuditListingSeoCopy"), true);

  assert.equal(model.includes('"listingUrl",\n  "country"'), true);
  assert.equal(model.includes("listingUrl: normalizedListingUrl"), true);
  assert.equal(model.includes("normalizedListingUrl == null || detectedPlatform == null"), true);

  assert.equal(content.includes('fetch("/api/free-audit/preview"'), true);
  assert.equal(content.includes("JSON.stringify(validation.payload)"), true);
  assert.equal(content.includes("isPublicListingAuditAvailable"), true);
  assert.equal(content.includes("FreeAuditListingResult"), true);
  assert.equal(content.includes("saveFreeAuditGuestDraft"), true);
  assert.equal(content.includes("FULL_AUDIT_CTA_HREF"), true);

  assert.equal(modeCopy.includes("not analyzed or sent"), false);
  assert.equal(modeCopy.includes("never sent"), false);
  assert.equal(modeCopy.includes("URL stays local"), false);

  for (const key of [
    "raw_payload",
    "scoreBreakdown",
    "subScores",
    "metrics",
    "priceSource",
    "availableDays",
    "unavailableDays",
    "observedDays",
    "windowDays",
  ]) {
    assert.equal(result.includes(key), false, `Public teaser UI must not reference ${key}`);
  }

  assert.equal(result.includes("result.score"), true);
  assert.equal(result.includes("result.insights"), true);
  assert.equal(result.includes("result.recommendations"), true);
  assert.equal(result.includes("result.market.comparableCount"), true);
  assert.equal(
    result.includes("result.market.comparables"),
    false,
    "Public teaser UI must not reference detailed market comparables",
  );
  assert.equal(result.includes("result.availability.detected"), true);
  assert.equal(result.includes("result.lockedSections"), true);

  console.log("PASS — Free audit listing funnel smoke");
}

main();
