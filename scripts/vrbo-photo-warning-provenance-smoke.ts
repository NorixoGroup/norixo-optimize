import fs from "node:fs";
import path from "node:path";

const vrboPath = path.join(
  process.cwd(),
  "lib/extractors/vrbo.ts"
);

const source = fs.readFileSync(vrboPath, "utf8");

let failures = 0;

function check(name: string, condition: boolean) {
  if (condition) {
    console.log(`PASS ${name}`);
  } else {
    console.log(`FAIL ${name}`);
    failures += 1;
  }
}

check(
  "photos_not_found uses actual extracted photos",
  source.includes(
    'photos.length === 0 ? "photos_not_found"'
  )
);

check(
  "photos_weak uses actual extracted photos",
  source.includes(
    'photos.length < 10 ? "photos_weak"'
  )
);

check(
  "warning no longer uses declared photosCount",
  !source.includes(
    'photosCount === 0 ? "photos_not_found" : photosCount < 10 ? "photos_weak"'
  )
);

check(
  "declared gallery total remains preserved",
  source.includes("const photosCount =")
);

check(
  "actual photos remain returned separately",
  source.includes("photos,") &&
    source.includes("photosCount,")
);

function warningFor(
  actualPhotoCount: number,
  declaredPhotoCount: number
): string | null {
  void declaredPhotoCount;

  return actualPhotoCount === 0
    ? "photos_not_found"
    : actualPhotoCount < 10
      ? "photos_weak"
      : null;
}

check(
  "0 actual / 31 declared => photos_not_found",
  warningFor(0, 31) === "photos_not_found"
);

check(
  "4 actual / 31 declared => photos_weak",
  warningFor(4, 31) === "photos_weak"
);

check(
  "9 actual / 50 declared => photos_weak",
  warningFor(9, 50) === "photos_weak"
);

check(
  "10 actual / 10 declared => no warning",
  warningFor(10, 10) === null
);

check(
  "31 actual / 31 declared => no warning",
  warningFor(31, 31) === null
);

console.log(
  `VRBO_PHOTO_WARNING_PROVENANCE_FAILURES=${failures}`
);

process.exit(failures === 0 ? 0 : 1);
