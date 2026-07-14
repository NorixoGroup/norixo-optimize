import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

type RouteExpectation = {
  label: string;
  path: string;
};

function assertGateOrdering(expectation: RouteExpectation) {
  const source = readFileSync(expectation.path, "utf8");
  const reserveIndex = source.indexOf("await reserveAuditEntitlement(");
  const extractIndex = source.indexOf("await extractListing(");
  const lookupIndex = source.indexOf("await lookupMarketSnapshot(");
  const competitorsIndex = source.indexOf("await searchCompetitorsAroundTarget(");
  const runAuditIndex = source.indexOf("await runAudit(");

  assert.notEqual(reserveIndex, -1, `${expectation.label}: reserve missing`);
  assert.notEqual(extractIndex, -1, `${expectation.label}: extract missing`);
  assert.notEqual(lookupIndex, -1, `${expectation.label}: lookup missing`);
  assert.notEqual(competitorsIndex, -1, `${expectation.label}: competitors missing`);
  assert.notEqual(runAuditIndex, -1, `${expectation.label}: runAudit missing`);

  assert.ok(
    reserveIndex < extractIndex,
    `${expectation.label}: reserve must happen before extractListing`,
  );
  assert.ok(
    reserveIndex < lookupIndex,
    `${expectation.label}: reserve must happen before lookupMarketSnapshot`,
  );
  assert.ok(
    reserveIndex < competitorsIndex,
    `${expectation.label}: reserve must happen before searchCompetitorsAroundTarget`,
  );
  assert.ok(
    reserveIndex < runAuditIndex,
    `${expectation.label}: reserve must happen before runAudit`,
  );
  assert.equal(
    source.includes("consumeWorkspaceAuditCredits("),
    false,
    `${expectation.label}: legacy delayed consumption must be removed`,
  );
}

function main() {
  assertGateOrdering({
    label: "api/listings",
    path: "app/api/listings/route.ts",
  });
  assertGateOrdering({
    label: "api/audits",
    path: "app/api/audits/route.ts",
  });

  console.log("PASS — Audit runtime entitlement gate smoke");
}

main();
