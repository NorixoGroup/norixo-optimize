import { cities } from "../data/cities";
import { buildCollectionPlan, serializeCollectionPlan } from "../lib/seo/v3/collectionSheet";
import { classifyCoverage } from "../lib/seo/v3/coverageClassifier";
import { parseIsoDateTime } from "../lib/seo/v3/dates";
import { stableStringify } from "../lib/seo/v3/editorialCatalog";
import { createFactRegistry } from "../lib/seo/v3/factRegistry";

/**
 * Offline generator of the three pilot collection sheets (S5.3-C5). It PRINTS canonical JSON on stdout and writes nothing.
 *
 *   npx tsx scripts/seo-v3-pilot-sheets.ts --as-of 2026-10-22T00:00:00Z
 *
 * It explicitly asks for one voluntary `long_stay_rule` collection for each of paris, barcelona and amsterdam (and nothing
 * else), classifies against an EMPTY registry, and turns the three work orders into sheets with the existing
 * `classifyCoverage` and `buildCollectionPlan`. It creates no fact, no decision, approves no source, names no source,
 * quotes nothing, and uses no network. The 180-day threshold stays provisional.
 *
 * Exit code: 0 ok, 1 invalid arguments, 2 the plan is not exactly the three expected sheets.
 */

const PILOT_SLUGS = ["amsterdam", "barcelona", "paris"] as const;
const REQUIREMENT_ID = "long_stay_rule";
const CLI_VERSION = "seo-v3-pilot-sheets/1";

function usage(): never {
  console.error("usage: seo-v3-pilot-sheets.ts --as-of <ISO instant, e.g. 2026-10-22T00:00:00Z>");
  process.exit(1);
}

const args = process.argv.slice(2);
// exactly `--as-of <value>`: no other flag, no positional argument, no repeated flag
if (args.length !== 2 || args[0] !== "--as-of") usage();
const asOf = args[1]!;
if (asOf.startsWith("--") || parseIsoDateTime(asOf) === null) usage();

const pilotCities = PILOT_SLUGS.map((slug) => cities.find((city) => city.slug === slug));
if (pilotCities.some((city) => city === undefined)) {
  console.error("a pilot city is missing from data/cities.ts");
  process.exit(1);
}

const voluntaryCollection = PILOT_SLUGS.map((citySlug) => ({ citySlug, topic: "long-stay-guide" as const, requirementId: REQUIREMENT_ID }));
const report = classifyCoverage({
  cities: pilotCities.map((city) => ({ slug: city!.slug, country: city!.country })),
  topics: ["long-stay-guide"],
  registry: createFactRegistry(),
  asOf,
  thresholdProfile: "draft-provisional",
  propertyType: null,
  voluntaryCollection,
});
const plan = buildCollectionPlan({ orders: report.workOrders, asOf });

const ok =
  report.workOrders.length === 3 &&
  report.workOrders.every((order) => order.origin === "voluntary" && order.requirementId === REQUIREMENT_ID) &&
  plan.sheets.length === 3 &&
  plan.rejectedOrders.length === 0 &&
  report.voluntaryCollection.ignored.length === 0;

process.stdout.write(
  `${stableStringify({
    cli: CLI_VERSION,
    asOf,
    request: voluntaryCollection,
    voluntaryCollection: report.voluntaryCollection,
    entries: report.entries.map((e) => ({ citySlug: e.citySlug, topic: e.topic, coverageClass: e.coverageClass, blockers: e.blockers, publicationAuthorised: e.publicationAuthorised, indexingAuthorised: e.indexingAuthorised })),
    plan: JSON.parse(serializeCollectionPlan(plan)),
    createsFacts: false,
    createsDecisions: false,
    approvesSources: false,
    network: false,
  })}\n`,
);
process.exitCode = ok ? 0 : 2;
