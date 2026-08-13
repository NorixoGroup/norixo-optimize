import { cities } from "@/data/cities";
import { countries } from "@/data/countries";
import { marketReports } from "@/data/marketReports";
import { rankings } from "@/data/rankings";
import { buildEditorialContentNodes } from "../content-adapter";
import type { ContentNodeId } from "../types";
import { buildProgrammaticMarketDescriptors } from "./market-descriptors";
import type { ProgrammaticMarketAuditDescriptorInput, ProgrammaticMarketAuditIssueCode } from "./market-audit";
import { evaluateProgrammaticMarketGovernance } from "./market-governance";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function evaluate(
  descriptors: readonly ProgrammaticMarketAuditDescriptorInput[],
  contentNodes = buildEditorialContentNodes()
) {
  return evaluateProgrammaticMarketGovernance({
    descriptors,
    contentNodes,
    rankings,
    reports: marketReports,
    cities,
    countries,
  });
}

function entryFor(
  descriptors: readonly ProgrammaticMarketAuditDescriptorInput[],
  contentNodeId: ContentNodeId
) {
  const result = evaluate(descriptors);
  const entry = result.entries.find((candidate) => candidate.contentNodeId === contentNodeId);

  assert(entry, `Programmatic Market governance entry must exist: ${contentNodeId}.`);

  return entry;
}

function assertNotGovernedFor(
  descriptors: readonly ProgrammaticMarketAuditDescriptorInput[],
  contentNodeId: ContentNodeId,
  reason: ProgrammaticMarketAuditIssueCode
): void {
  const entry = entryFor(descriptors, contentNodeId);

  assert(!entry.governed, `${contentNodeId} must not be governed.`);
  assert(entry.reasons.includes(reason), `${contentNodeId} must include reason: ${reason}.`);
}

export function runProgrammaticMarketGovernanceSmokeTest(): void {
  const contentNodes = buildEditorialContentNodes();
  const contentNodesSnapshot = JSON.stringify(contentNodes);
  const datasetsSnapshot = JSON.stringify([rankings, marketReports, cities, countries]);
  const descriptors = buildProgrammaticMarketDescriptors();
  const descriptorsSnapshot = JSON.stringify(descriptors);
  const result = evaluate(descriptors, contentNodes);
  const repeatedResult = evaluate(descriptors, contentNodes);
  const rankingEntries = result.entries.filter((entry) => entry.contentNodeId.startsWith("content:ranking:"));
  const reportEntries = result.entries.filter((entry) => entry.contentNodeId.startsWith("content:report:"));
  const parisReportId: ContentNodeId = "content:report:airbnb-market-report-paris";
  const marrakechReportId: ContentNodeId = "content:report:airbnb-market-report-marrakech";
  const citiesRankingId: ContentNodeId = "content:ranking:best-airbnb-cities";
  const countriesRankingId: ContentNodeId = "content:ranking:best-airbnb-countries";
  const parisReport = descriptors.find((descriptor) => descriptor.contentNodeId === parisReportId);
  const marrakechReport = descriptors.find((descriptor) => descriptor.contentNodeId === marrakechReportId);
  const citiesRanking = descriptors.find((descriptor) => descriptor.contentNodeId === citiesRankingId);
  const countriesRanking = descriptors.find((descriptor) => descriptor.contentNodeId === countriesRankingId);

  assert(parisReport?.contentType === "report", "Paris report descriptor fixture must exist.");
  assert(marrakechReport?.contentType === "report", "Marrakech report descriptor fixture must exist.");
  assert(citiesRanking?.contentType === "ranking", "Best Airbnb Cities ranking descriptor fixture must exist.");
  assert(countriesRanking?.contentType === "ranking", "Best Airbnb Countries ranking descriptor fixture must exist.");
  assert(result.summary.total === 12, "Programmatic Market governance must represent 12 expected leaves.");
  assert(result.summary.governed === 12, "Programmatic Market governance must govern all 12 current leaves.");
  assert(result.summary.notGoverned === 0, "Programmatic Market governance must have no non-governed current leaves.");
  assert(rankingEntries.length === 6, "Programmatic Market governance must include six ranking entries.");
  assert(reportEntries.length === 6, "Programmatic Market governance must include six report entries.");
  assert(
    result.entries.every((entry) => entry.governed && entry.reasons.length === 0),
    "Programmatic Market happy path entries must be governed without reasons."
  );
  assert(
    !result.entries.some((entry) => entry.contentNodeId === "content:guide:airbnb-market-intelligence"),
    "Programmatic Market governance must not include the editorial hub."
  );
  assert(
    JSON.stringify(result) === JSON.stringify(repeatedResult),
    "Programmatic Market governance must be deterministic."
  );

  assertNotGovernedFor(descriptors.slice(1), citiesRankingId, "missing_descriptor");
  assertNotGovernedFor(
    descriptors.map((descriptor) =>
      descriptor.contentNodeId === parisReportId
        ? { ...descriptor, entityRef: { kind: "country", slug: "france" } }
        : descriptor
    ),
    parisReportId,
    "invalid_entity_kind"
  );
  assertNotGovernedFor(
    descriptors.map((descriptor) =>
      descriptor.contentNodeId === citiesRankingId
        ? { ...descriptor, scope: { kind: "global", slug: "parasite" } }
        : descriptor
    ),
    citiesRankingId,
    "invalid_ranking_scope"
  );
  assertNotGovernedFor(
    descriptors.map((descriptor) =>
      descriptor.contentNodeId === citiesRankingId
        ? {
            ...descriptor,
            targetEntities: [
              { kind: "city", slug: "wrong-city" },
              ...citiesRanking.targetEntities.slice(1),
            ],
          }
        : descriptor
    ),
    citiesRankingId,
    "target_entity_mismatch"
  );
  assertNotGovernedFor([...descriptors, parisReport], parisReportId, "duplicate_descriptor");

  const isolatedReportFailure = evaluate(
    descriptors.map((descriptor) =>
      descriptor.contentNodeId === parisReportId
        ? { ...descriptor, entityRef: { kind: "country", slug: "france" } }
        : descriptor
    )
  );
  assert(isolatedReportFailure.summary.governed === 11, "One invalid report must leave 11 leaves governed.");
  assert(
    isolatedReportFailure.entries.find((entry) => entry.contentNodeId === marrakechReportId)?.governed,
    "An unrelated valid report must remain governed when Paris fails."
  );
  assert(
    isolatedReportFailure.entries.find((entry) => entry.contentNodeId === citiesRankingId)?.governed,
    "An unrelated valid ranking must remain governed when Paris fails."
  );

  const missingContentNodeResult = evaluate(
    descriptors,
    contentNodes.filter((node) => node.id !== citiesRankingId)
  );
  const missingContentNodeEntry = missingContentNodeResult.entries.find(
    (entry) => entry.contentNodeId === citiesRankingId
  );
  assert(missingContentNodeEntry, "Missing ContentNode expected leaf must still produce a governance entry.");
  assert(!missingContentNodeEntry.governed, "Missing ContentNode expected leaf must not be governed.");
  assert(
    missingContentNodeEntry.reasons.includes("missing_content_node"),
    "Missing ContentNode expected leaf must include missing_content_node."
  );

  const unexpectedDescriptorResult = evaluate([
    ...descriptors,
    {
      contentNodeId: "content:ranking:unexpected-market-leaf",
      contentType: "ranking",
      family: "market_intelligence",
      scope: { kind: "global" },
      targetEntities: [{ kind: "city", slug: "paris" }],
    },
  ]);
  assert(
    unexpectedDescriptorResult.summary.total === 12,
    "Unexpected descriptors must not create extra governance entries."
  );

  assert(
    JSON.stringify(buildEditorialContentNodes()) === contentNodesSnapshot,
    "Programmatic Market governance must not mutate ContentNodes."
  );
  assert(
    JSON.stringify([rankings, marketReports, cities, countries]) === datasetsSnapshot,
    "Programmatic Market governance must not mutate source datasets."
  );
  assert(
    JSON.stringify(descriptors) === descriptorsSnapshot,
    "Programmatic Market governance must not mutate descriptors."
  );

  console.log("Programmatic Market governance smoke passed.", result.summary);
}
