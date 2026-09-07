import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

type RouteExpectation = {
  label: string;
  path: string;
  extractedVariable: "extracted" | "extractedRaw";
};

function indexAfter(
  source: string,
  token: string,
  after: number,
  label: string,
): number {
  const index = source.indexOf(token, after);

  assert.notEqual(
    index,
    -1,
    `${label}: missing token: ${token}`,
  );

  return index;
}

function assertExpediaFailClosed(
  expectation: RouteExpectation,
) {
  const source = readFileSync(
    expectation.path,
    "utf8",
  );

  const reserveIndex = source.indexOf(
    "await reserveAuditEntitlement(",
  );

  assert.notEqual(
    reserveIndex,
    -1,
    `${expectation.label}: reserve missing`,
  );

  const extractIndex = indexAfter(
    source,
    "await extractListing(",
    reserveIndex,
    expectation.label,
  );

  const reliabilityIndex = indexAfter(
    source,
    `evaluateExpediaExtractionReliability(${expectation.extractedVariable})`,
    extractIndex,
    expectation.label,
  );

  const guardIndex = indexAfter(
    source,
    `if (isUnreliableExpediaExtraction(${expectation.extractedVariable}))`,
    reliabilityIndex,
    expectation.label,
  );

  const releaseIndex = indexAfter(
    source,
    'target_extraction_unreliable_expedia',
    guardIndex,
    expectation.label,
  );

  const responseIndex = indexAfter(
    source,
    "EXPEDIA_EXTRACTION_UNAVAILABLE_BODY",
    releaseIndex,
    expectation.label,
  );

  const status503Index = indexAfter(
    source,
    "status: 503",
    responseIndex,
    expectation.label,
  );

  const lookupIndex = indexAfter(
    source,
    "await lookupMarketSnapshot(",
    guardIndex,
    expectation.label,
  );

  const competitorsIndex = indexAfter(
    source,
    "await searchCompetitorsAroundTarget(",
    lookupIndex,
    expectation.label,
  );

  const runAuditIndex = indexAfter(
    source,
    "await runAudit(",
    competitorsIndex,
    expectation.label,
  );

  assert.ok(
    reserveIndex < extractIndex,
    `${expectation.label}: reserve must precede extraction`,
  );

  assert.ok(
    extractIndex < reliabilityIndex,
    `${expectation.label}: reliability evaluation must follow extraction`,
  );

  assert.ok(
    reliabilityIndex < guardIndex,
    `${expectation.label}: Expedia guard must follow reliability evaluation`,
  );

  assert.ok(
    guardIndex < releaseIndex,
    `${expectation.label}: Expedia guard must release held entitlement`,
  );

  assert.ok(
    releaseIndex < responseIndex,
    `${expectation.label}: release must happen before unavailable response`,
  );

  assert.ok(
    responseIndex < status503Index,
    `${expectation.label}: unavailable response must be HTTP 503`,
  );

  assert.ok(
    status503Index < lookupIndex,
    `${expectation.label}: Expedia 503 must precede market lookup`,
  );

  assert.ok(
    status503Index < competitorsIndex,
    `${expectation.label}: Expedia 503 must precede competitor search`,
  );

  assert.ok(
    status503Index < runAuditIndex,
    `${expectation.label}: Expedia 503 must precede runAudit`,
  );

  console.log(
    `PASS — ${expectation.label}: reserve -> extract -> Expedia reliability -> release -> 503 before downstream audit`,
  );
}

function main() {
  assertExpediaFailClosed({
    label: "api/listings",
    path: "app/api/listings/route.ts",
    extractedVariable: "extracted",
  });

  assertExpediaFailClosed({
    label: "api/audits",
    path: "app/api/audits/route.ts",
    extractedVariable: "extractedRaw",
  });

  console.log(
    "EXPEDIA_ENTITLEMENT_FAIL_CLOSED_SMOKE=PASS",
  );
}

main();
