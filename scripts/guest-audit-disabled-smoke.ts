import fs from "node:fs";

const route = fs.readFileSync("app/api/guest-audit/route.ts", "utf8");

let checks = 0;
let failures = 0;

function check(name: string, pass: boolean) {
  checks += 1;
  if (!pass) {
    failures += 1;
    console.log(`FAIL ${name}`);
  }
}

const postStart = route.indexOf("export async function POST(");
const postBody = postStart >= 0 ? route.slice(postStart) : "";
const bodyOpen = postBody.indexOf("{\n");
const afterOpen = bodyOpen >= 0 ? postBody.slice(bodyOpen + 2) : "";
const guardIndex = afterOpen.indexOf("if (GUEST_AUDIT_DISABLED) {");
const guardEnd = afterOpen.indexOf("\n  }\n", guardIndex);
const guardBlock =
  guardIndex >= 0 && guardEnd > guardIndex
    ? afterOpen.slice(guardIndex, guardEnd)
    : "";

check(
  "GUEST_AUDIT_DISABLED_IS_TRUE",
  /^const GUEST_AUDIT_DISABLED = true;$/m.test(route),
);
check("POST_EXISTS", postStart >= 0);
check("GUARD_IS_FIRST_STATEMENT_OF_POST", afterOpen.trimStart().startsWith("if (GUEST_AUDIT_DISABLED) {"));
check("GUARD_RETURNS_410", guardBlock.includes("status: 410"));
check("GUARD_SETS_NO_STORE", guardBlock.includes('"Cache-Control": "no-store"'));
check(
  "GUARD_PRECEDES_RATE_LIMIT_AND_BODY_READ",
  guardEnd > 0 &&
    afterOpen.indexOf("allowGuestAuditRequest(") > guardEnd &&
    afterOpen.indexOf("request.json()") > guardEnd,
);
check(
  "GUARD_PRECEDES_EXTRACTION_AND_PERSISTENCE",
  guardEnd > 0 &&
    afterOpen.indexOf("extractListing(") > guardEnd &&
    afterOpen.indexOf("saveMarketSnapshot(") > guardEnd,
);
check(
  "GUARD_BLOCK_HAS_NO_SIDE_EFFECT_CALLS",
  !/extractListing|saveMarketSnapshot|searchCompetitorsAroundTarget|lookupMarketSnapshot|chromium|request\.json/.test(
    guardBlock,
  ),
);

console.log(`CHECKS=${checks}`);
console.log(`FAILURES=${failures}`);

if (failures > 0) {
  process.exitCode = 1;
}
