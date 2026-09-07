import fs from "node:fs";

const files = {
  audits: fs.readFileSync(
    "app/api/audits/route.ts",
    "utf8",
  ),
  listings: fs.readFileSync(
    "app/api/listings/route.ts",
    "utf8",
  ),
  guest: fs.readFileSync(
    "app/api/guest-audit/route.ts",
    "utf8",
  ),
  refine: fs.readFileSync(
    "app/api/audits/[id]/refine-market/route.ts",
    "utf8",
  ),
};

let checks = 0;
let failures = 0;

function check(name: string, condition: boolean) {
  checks += 1;

  if (condition) {
    console.log(`PASS — ${name}`);
  } else {
    failures += 1;
    console.log(`FAIL — ${name}`);
  }
}

/* Paid audits */

check(
  "AUDITS_IMPORTS_BOOKING_RELIABILITY",
  files.audits.includes(
    'from "@/lib/extractors/bookingExtractionReliability"',
  ),
);

check(
  "AUDITS_EVALUATES_BOOKING_RELIABILITY",
  files.audits.includes(
    "isUnreliableBookingExtraction(extractedRaw)",
  ),
);

check(
  "AUDITS_RETURNS_BOOKING_503_BODY",
  files.audits.includes(
    "BOOKING_EXTRACTION_UNAVAILABLE_BODY",
  ),
);

check(
  "AUDITS_RELEASES_ENTITLEMENT_ON_UNRELIABLE_BOOKING",
  files.audits.includes(
    'releaseHeldEntitlement("target_extraction_unreliable")',
  ),
);

check(
  "AUDITS_RELEASE_PRECEDES_BOOKING_503",
  (() => {
    const release = files.audits.indexOf(
      'releaseHeldEntitlement("target_extraction_unreliable")',
    );
    const body = files.audits.indexOf(
      "BOOKING_EXTRACTION_UNAVAILABLE_BODY",
      files.audits.indexOf(
        "if (unreliableBookingExtraction)",
      ),
    );

    return release >= 0 && body >= 0 && release < body;
  })(),
);

/* Paid listings */

check(
  "LISTINGS_IMPORTS_BOOKING_RELIABILITY",
  files.listings.includes(
    'from "@/lib/extractors/bookingExtractionReliability"',
  ),
);

check(
  "LISTINGS_EVALUATES_BOOKING_RELIABILITY",
  files.listings.includes(
    "isUnreliableBookingExtraction(extracted)",
  ),
);

check(
  "LISTINGS_RELEASES_ENTITLEMENT_ON_UNRELIABLE_BOOKING",
  files.listings.includes(
    'releaseHeldEntitlement("target_extraction_unreliable")',
  ),
);

check(
  "LISTINGS_RETURNS_BOOKING_503_BODY",
  files.listings.includes(
    "BOOKING_EXTRACTION_UNAVAILABLE_BODY",
  ),
);

/* Guest */

check(
  "GUEST_IMPORTS_BOOKING_RELIABILITY",
  files.guest.includes(
    'from "@/lib/extractors/bookingExtractionReliability"',
  ),
);

check(
  "GUEST_EVALUATES_BOOKING_RELIABILITY",
  files.guest.includes(
    "isUnreliableBookingExtraction(extracted)",
  ),
);

check(
  "GUEST_RETURNS_BOOKING_503_BODY",
  files.guest.includes(
    "BOOKING_EXTRACTION_UNAVAILABLE_BODY",
  ),
);

/* Refine-market */

check(
  "REFINE_IMPORTS_BOOKING_RELIABILITY",
  files.refine.includes(
    'from "@/lib/extractors/bookingExtractionReliability"',
  ),
);

check(
  "REFINE_EVALUATES_BOOKING_RELIABILITY",
  files.refine.includes(
    "isUnreliableBookingExtraction(normalized)",
  ),
);

check(
  "REFINE_BUILDS_BOOKING_REJECTION_REASON",
  files.refine.includes(
    '"booking_extraction_unreliable"',
  ),
);

check(
  "REFINE_REJECTS_UNRELIABLE_BOOKING",
  files.refine.includes(
    "extractionReliabilityReason === null",
  ),
);

/* Parser isolation */

check(
  "BOOKING_PARSER_HAS_NO_RELIABILITY_WIRING",
  !fs
    .readFileSync(
      "lib/extractors/booking.ts",
      "utf8",
    )
    .includes("bookingExtractionReliability"),
);

console.log(`CHECKS=${checks}`);
console.log(`FAILURES=${failures}`);

if (failures !== 0) {
  process.exitCode = 1;
}
