import fs from "node:fs";

let checks = 0;
let failures = 0;

function check(name: string, condition: boolean) {
  checks += 1;
  if (condition) {
    console.log(`PASS — ${name}`);
    return;
  }

  failures += 1;
  console.error(`FAIL — ${name}`);
}

const audits = fs.readFileSync(
  "app/api/audits/route.ts",
  "utf8",
);

const listings = fs.readFileSync(
  "app/api/listings/route.ts",
  "utf8",
);

const guest = fs.readFileSync(
  "app/api/guest-audit/route.ts",
  "utf8",
);

const refine = fs.readFileSync(
  "app/api/audits/[id]/refine-market/route.ts",
  "utf8",
);

const parser = fs.readFileSync(
  "lib/extractors/agoda.ts",
  "utf8",
);

check(
  "AUDITS_IMPORTS_AGODA_RELIABILITY",
  audits.includes("agodaExtractionReliability"),
);

check(
  "AUDITS_EVALUATES_AGODA_RELIABILITY",
  audits.includes(
    "evaluateAgodaExtractionReliability(extractedRaw)",
  ),
);

check(
  "AUDITS_FAILS_CLOSED_ON_UNRELIABLE_AGODA",
  audits.includes(
    "isUnreliableAgodaExtraction(extractedRaw)",
  ),
);

check(
  "AUDITS_RELEASES_ENTITLEMENT",
  audits.includes(
    '"target_extraction_unreliable_agoda"',
  ),
);

check(
  "AUDITS_RETURNS_503",
  audits.includes("AGODA_EXTRACTION_UNAVAILABLE_BODY") &&
    audits.includes("{ status: 503 }"),
);

check(
  "LISTINGS_IMPORTS_AGODA_RELIABILITY",
  listings.includes("agodaExtractionReliability"),
);

check(
  "LISTINGS_EVALUATES_AGODA_RELIABILITY",
  listings.includes(
    "evaluateAgodaExtractionReliability(extracted)",
  ),
);

check(
  "LISTINGS_FAILS_CLOSED_ON_UNRELIABLE_AGODA",
  listings.includes(
    "isUnreliableAgodaExtraction(extracted)",
  ),
);

check(
  "LISTINGS_RELEASES_ENTITLEMENT",
  listings.includes(
    '"target_extraction_unreliable_agoda"',
  ),
);

check(
  "GUEST_IMPORTS_AGODA_RELIABILITY",
  guest.includes("agodaExtractionReliability"),
);

check(
  "GUEST_FAILS_CLOSED_ON_UNRELIABLE_AGODA",
  guest.includes(
    "if (extracted && isUnreliableAgodaExtraction(extracted))",
  ),
);

check(
  "GUEST_EVALUATES_AGODA_RELIABILITY",
  guest.includes(
    "evaluateAgodaExtractionReliability(extracted)",
  ),
);

check(
  "GUEST_RETURNS_AGODA_503_BODY",
  guest.includes("AGODA_EXTRACTION_UNAVAILABLE_BODY"),
);

check(
  "REFINE_IMPORTS_AGODA_RELIABILITY",
  refine.includes("agodaExtractionReliability"),
);

check(
  "REFINE_REJECTS_UNRELIABLE_AGODA",
  refine.includes(
    "isUnreliableAgodaExtraction(normalized)",
  ),
);

check(
  "REFINE_BUILDS_AGODA_RELIABILITY_REASON",
  refine.includes(
    "agoda_extraction_unreliable:",
  ) &&
    refine.includes(
      "evaluateAgodaExtractionReliability(normalized)",
    ),
);

check(
  "AGODA_PARSER_HAS_NO_RELIABILITY_WIRING",
  !parser.includes("agodaExtractionReliability") &&
    !parser.includes("target_extraction_unreliable_agoda"),
);

console.log(`CHECKS=${checks}`);
console.log(`FAILURES=${failures}`);

if (failures > 0) {
  process.exitCode = 1;
}
