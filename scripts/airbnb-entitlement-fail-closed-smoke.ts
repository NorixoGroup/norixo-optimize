import fs from "node:fs";

type Check = {
  name: string;
  pass: boolean;
};

const read = (path: string) => fs.readFileSync(path, "utf8");

const auditsPath = "app/api/audits/route.ts";
const listingsPath = "app/api/listings/route.ts";
const guestPath = "app/api/guest-audit/route.ts";
const refinePath = "app/api/audits/[id]/refine-market/route.ts";

const audits = read(auditsPath);
const listings = read(listingsPath);
const guest = read(guestPath);
const refine = read(refinePath);

const checks: Check[] = [];

function check(name: string, pass: boolean) {
  checks.push({ name, pass });
}

function appearsBefore(
  source: string,
  first: string,
  second: string,
): boolean {
  const firstIndex = source.indexOf(first);
  const secondIndex = source.indexOf(second);

  return (
    firstIndex >= 0 &&
    secondIndex >= 0 &&
    firstIndex < secondIndex
  );
}

/*
 * AUDITS
 */
check(
  "AUDITS_IMPORTS_AIRBNB_RELIABILITY",
  audits.includes(
    'from "@/lib/extractors/airbnbExtractionReliability"',
  ),
);

check(
  "AUDITS_EVALUATES_AIRBNB_RELIABILITY",
  audits.includes(
    "evaluateAirbnbExtractionReliability(extractedRaw)",
  ),
);

check(
  "AUDITS_FAILS_CLOSED_ON_UNRELIABLE_AIRBNB",
  audits.includes(
    "if (isUnreliableAirbnbExtraction(extractedRaw))",
  ),
);

check(
  "AUDITS_RELEASES_ENTITLEMENT",
  audits.includes(
    '"target_extraction_unreliable_airbnb"',
  ),
);

check(
  "AUDITS_RETURNS_AIRBNB_503",
  audits.includes(
    "{ ...AIRBNB_EXTRACTION_UNAVAILABLE_BODY }",
  ) &&
    audits.includes("{ status: 503 }"),
);

check(
  "AUDITS_RELEASE_BEFORE_AIRBNB_503",
  appearsBefore(
    audits,
    '"target_extraction_unreliable_airbnb"',
    "{ ...AIRBNB_EXTRACTION_UNAVAILABLE_BODY }",
  ),
);

/*
 * LISTINGS
 */
check(
  "LISTINGS_IMPORTS_AIRBNB_RELIABILITY",
  listings.includes(
    'from "@/lib/extractors/airbnbExtractionReliability"',
  ),
);

check(
  "LISTINGS_EVALUATES_AIRBNB_RELIABILITY",
  listings.includes(
    "evaluateAirbnbExtractionReliability(extracted)",
  ),
);

check(
  "LISTINGS_FAILS_CLOSED_ON_UNRELIABLE_AIRBNB",
  listings.includes(
    "if (isUnreliableAirbnbExtraction(extracted))",
  ),
);

check(
  "LISTINGS_RELEASES_ENTITLEMENT",
  listings.includes(
    '"target_extraction_unreliable_airbnb"',
  ),
);

check(
  "LISTINGS_RETURNS_AIRBNB_503",
  listings.includes(
    "{ ...AIRBNB_EXTRACTION_UNAVAILABLE_BODY }",
  ) &&
    listings.includes("{ status: 503 }"),
);

check(
  "LISTINGS_RELEASE_BEFORE_AIRBNB_503",
  appearsBefore(
    listings,
    '"target_extraction_unreliable_airbnb"',
    "{ ...AIRBNB_EXTRACTION_UNAVAILABLE_BODY }",
  ),
);

/*
 * GUEST AUDIT
 */
check(
  "GUEST_IMPORTS_AIRBNB_RELIABILITY",
  guest.includes(
    'from "@/lib/extractors/airbnbExtractionReliability"',
  ),
);

check(
  "GUEST_FAILS_CLOSED_ON_UNRELIABLE_AIRBNB",
  guest.includes(
    "if (extracted && isUnreliableAirbnbExtraction(extracted))",
  ),
);

check(
  "GUEST_EVALUATES_AIRBNB_RELIABILITY",
  guest.includes(
    "evaluateAirbnbExtractionReliability(extracted)",
  ),
);

check(
  "GUEST_RETURNS_AIRBNB_503",
  guest.includes(
    "{ ...AIRBNB_EXTRACTION_UNAVAILABLE_BODY }",
  ) &&
    guest.includes("{ status: 503 }"),
);

/*
 * REFINE MARKET
 */
check(
  "REFINE_IMPORTS_AIRBNB_RELIABILITY",
  refine.includes(
    'from "@/lib/extractors/airbnbExtractionReliability"',
  ),
);

check(
  "REFINE_COMPUTES_UNRELIABLE_AIRBNB",
  refine.includes(
    "isUnreliableAirbnbExtraction(normalized)",
  ),
);

check(
  "REFINE_BUILDS_AIRBNB_RELIABILITY_REASON",
  refine.includes(
    "airbnb_extraction_unreliable:",
  ) &&
    refine.includes(
      "evaluateAirbnbExtractionReliability(normalized)",
    ),
);

check(
  "REFINE_REJECTS_UNRELIABLE_EXTRACTION",
  refine.includes(
    "extractionReliabilityReason === null",
  ),
);

/*
 * SAFETY:
 * Airbnb parser itself must not be part of this callsite patch.
 */
const parserChanged = (() => {
  const { execFileSync } = require("node:child_process") as typeof import("node:child_process");

  const output = execFileSync(
    "git",
    ["diff", "--name-only"],
    { encoding: "utf8" },
  );

  return output
    .split(/\r?\n/)
    .some((line) => line === "lib/extractors/airbnb.ts");
})();

check(
  "AIRBNB_PARSER_UNCHANGED",
  !parserChanged,
);

let failures = 0;

for (const item of checks) {
  if (item.pass) {
    console.log(`${item.name}=PASS`);
  } else {
    console.error(`${item.name}=FAIL`);
    failures++;
  }
}

console.log();
console.log(`CHECKS=${checks.length}`);
console.log(`FAILURES=${failures}`);

if (failures > 0) {
  process.exitCode = 1;
}
