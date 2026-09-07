import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

type RouteExpectation = {
  label: string;
  path: string;
  extractedVariable: "extracted" | "extractedRaw";
};

function indexAfter(
  text: string,
  needle: string,
  after = -1,
): number {
  const index = text.indexOf(
    needle,
    Math.max(0, after + 1),
  );

  assert.notEqual(
    index,
    -1,
    `Missing "${needle}" after index ${after}`,
  );

  return index;
}

function verifyRoute(
  expectation: RouteExpectation,
) {
  const text = readFileSync(
    expectation.path,
    "utf8",
  );

  const reserveIndex = indexAfter(
    text,
    "reserveAuditEntitlement(",
  );

  const extractIndex = indexAfter(
    text,
    "extractListing(",
    reserveIndex,
  );

  const evaluateIndex = indexAfter(
    text,
    `evaluateVrboExtractionReliability(${expectation.extractedVariable})`,
    extractIndex,
  );

  const guardIndex = indexAfter(
    text,
    `isUnreliableVrboExtraction(${expectation.extractedVariable})`,
    evaluateIndex,
  );

  const releaseIndex = indexAfter(
    text,
    '"target_extraction_unreliable_vrbo"',
    guardIndex,
  );

  const unavailableBodyIndex = indexAfter(
    text,
    "VRBO_EXTRACTION_UNAVAILABLE_BODY",
    releaseIndex,
  );

  const status503Index = indexAfter(
    text,
    "status: 503",
    unavailableBodyIndex,
  );

  const runAuditIndex = indexAfter(
    text,
    "runAudit({",
    status503Index,
  );

  assert.ok(
    reserveIndex < extractIndex,
    "reserve must occur before extraction",
  );

  assert.ok(
    extractIndex < evaluateIndex,
    "extraction must occur before Vrbo reliability evaluation",
  );

  assert.ok(
    evaluateIndex < guardIndex,
    "Vrbo reliability evaluation must occur before guard",
  );

  assert.ok(
    guardIndex < releaseIndex,
    "Vrbo guard must release entitlement",
  );

  assert.ok(
    releaseIndex < unavailableBodyIndex,
    "release must occur before 503 response body",
  );

  assert.ok(
    unavailableBodyIndex < status503Index,
    "Vrbo unavailable body must be returned with 503",
  );

  assert.ok(
    status503Index < runAuditIndex,
    "Vrbo fail-closed path must occur before runAudit",
  );

  console.log(
    `PASS — ${expectation.label}: ` +
      "reserve -> extract -> Vrbo reliability -> " +
      "release -> 503 before downstream audit",
  );
}

verifyRoute({
  label: "api/listings",
  path: "app/api/listings/route.ts",
  extractedVariable: "extracted",
});

verifyRoute({
  label: "api/audits",
  path: "app/api/audits/route.ts",
  extractedVariable: "extractedRaw",
});

console.log(
  "VRBO_ENTITLEMENT_FAIL_CLOSED_SMOKE=PASS",
);
