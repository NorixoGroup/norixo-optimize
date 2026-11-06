/**
 * Shared policy used by both the autonomy scheduler and the promotion
 * resolution entry point (BL-AUTO-04 Mission A). A single predicate so the
 * two call sites can never drift from each other.
 */

const RESERVED_TEST_SUFFIXES: readonly string[] = [".example", ".test", ".invalid", ".localhost"];

/**
 * Explicit fixture hostnames from lib/automation/demo-backlink-discovery-fixtures.ts,
 * kept as a second, independent layer in case a future fixture does not use a
 * reserved suffix.
 */
const EXPLICIT_FIXTURE_HOSTNAMES: readonly string[] = [
  "host-resources.example",
  "vacation-tools.example",
  "rental-guides.example",
  "hospitality-lab.example",
  "partner-preview.example",
];

function hasReservedTestSuffix(normalizedHostname: string): boolean {
  return RESERVED_TEST_SUFFIXES.some(
    (suffix) => normalizedHostname === suffix.slice(1) || normalizedHostname.endsWith(suffix),
  );
}

export function isBacklinkTestOrFixtureHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  if (normalized === "") return true;
  return hasReservedTestSuffix(normalized) || EXPLICIT_FIXTURE_HOSTNAMES.includes(normalized);
}
