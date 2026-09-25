import fs from "node:fs";
import path from "node:path";

const sourcePath = path.resolve(
  process.cwd(),
  "lib/intelligenceV2/publicMarketOverviewBackfill.ts",
);

const source = fs.readFileSync(sourcePath, "utf8");

const functionStartMarker =
  "async function findActiveArtifactFromSupabase(";

const functionEndMarker =
  "\nfunction extractSchemaField(";

const start = source.indexOf(functionStartMarker);
const end = source.indexOf(functionEndMarker, start);

if (start < 0) {
  throw new Error(
    "findActiveArtifactFromSupabase function was not found",
  );
}

if (end < 0 || end <= start) {
  throw new Error(
    "Could not isolate findActiveArtifactFromSupabase",
  );
}

const lookup = source.slice(start, end);

function expectExactlyOnce(
  needle: string,
  label: string,
): void {
  const count = lookup.split(needle).length - 1;

  if (count !== 1) {
    throw new Error(
      `${label}: expected exactly once, found ${count}`,
    );
  }
}

function expectInOrder(
  needles: readonly string[],
): void {
  let cursor = -1;

  for (const needle of needles) {
    const index = lookup.indexOf(needle);

    if (index < 0) {
      throw new Error(
        `Missing canonical predecessor filter: ${needle}`,
      );
    }

    if (index <= cursor) {
      throw new Error(
        `Canonical predecessor filter order changed: ${needle}`,
      );
    }

    cursor = index;
  }
}

const canonicalFilters = [
  '.eq("benchmark_type", payload.benchmark_type)',
  '.eq("market_cell_key", payload.market_cell_key)',
  '.eq("intended_use", "public_market_overview")',
  '.eq("aggregation_window", payload.aggregation_window)',
  '.eq("platform_scope", payload.platform_scope)',
  '.eq("capacity_scope", payload.capacity_scope)',
  '.eq("property_scope", payload.property_scope)',
  '.neq("approval_status", "revoked")',
] as const;

for (const filter of canonicalFilters) {
  expectExactlyOnce(filter, filter);
}

expectInOrder(canonicalFilters);

expectExactlyOnce(
  '.from("benchmark_artifacts")',
  "benchmark_artifacts table",
);

expectExactlyOnce(
  '.select("id,artifact_key,created_at")',
  "active predecessor projection",
);

expectExactlyOnce(
  '.order("created_at", { ascending: false })',
  "newest active predecessor ordering",
);

/*
 * Regression contract:
 *
 * market_cell_key alone is NOT the canonical supersession identity.
 *
 * A predecessor must also belong to the same:
 * - aggregation window
 * - platform scope
 * - capacity scope
 * - property scope
 *
 * In particular, exact and broader_market artifacts sharing the same
 * market_cell_key must never cross-link through supersession lineage.
 */
const propertyScopeGuard =
  '.eq("property_scope", payload.property_scope)';

if (!lookup.includes(propertyScopeGuard)) {
  throw new Error(
    "Cross-property-scope lineage protection is missing",
  );
}

console.log(
  "PASS — canonical supersession lookup includes benchmark identity",
);

console.log(
  "PASS — canonical supersession lookup includes aggregation_window",
);

console.log(
  "PASS — canonical supersession lookup includes platform_scope",
);

console.log(
  "PASS — canonical supersession lookup includes capacity_scope",
);

console.log(
  "PASS — exact and broader_market lineage is isolated by property_scope",
);

console.log(
  "PASS — active predecessor lookup remains newest-first",
);

console.log(
  "PASS — Public market overview supersession identity regression smoke",
);
