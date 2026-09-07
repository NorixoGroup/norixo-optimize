import fs from "node:fs";
import path from "node:path";

const sourcePath = path.join(
  process.cwd(),
  "lib/extractors/vrbo.ts"
);

const source = fs.readFileSync(sourcePath, "utf8");

let failures = 0;

function check(
  condition: boolean,
  label: string
) {
  if (condition) {
    console.log(`PASS ${label}`);
  } else {
    failures += 1;
    console.error(`FAIL ${label}`);
  }
}

check(
  source.includes(
    "structuredCapacityCandidate?.value ??"
  ),
  "structured capacity remains highest priority"
);

check(
  source.includes(
    "bodyCapacity ??"
  ),
  "explicit body capacity remains second priority"
);

check(
  /const capacity\s*=\s*structuredCapacityCandidate\?\.value\s*\?\?\s*bodyCapacity\s*\?\?\s*null;/m.test(
    source
  ),
  "capacity fails closed when reliable sources are absent"
);

check(
  !/const capacity\s*=\s*[\s\S]{0,250}structureFromDom\.capacity;/m.test(
    source
  ),
  "generic DOM capacity is not used as final fallback"
);

check(
  source.includes(
    "const bedrooms ="
  ) &&
    source.includes(
      "structureFromDom.bedrooms"
    ),
  "bedroom DOM fallback remains available"
);

check(
  source.includes(
    "const bathrooms ="
  ) &&
    source.includes(
      "structureFromDom.bathrooms"
    ),
  "bathroom DOM fallback remains available"
);

check(
  !source.includes(
    "[guest-audit][vrbo][dom-capacity-provenance]"
  ) &&
    !source.includes(
      "[guest-audit][vrbo][capacity-provenance]"
    ),
  "temporary capacity provenance logs are removed"
);

check(
  !source.includes("capacityMatches") &&
    !source.includes("fullMatch: match[0]") &&
    !source.includes("captured: match[1]"),
  "temporary capacity page-text capture is removed"
);

console.log(
  `VRBO_CAPACITY_PROVENANCE_FAILURES=${failures}`
);

if (failures > 0) {
  process.exitCode = 1;
}
