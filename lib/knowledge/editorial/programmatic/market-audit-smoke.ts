import { articles } from "@/data/articles";
import { cities } from "@/data/cities";
import { countries } from "@/data/countries";
import { guides } from "@/data/guides";
import { marketReports } from "@/data/marketReports";
import { rankings } from "@/data/rankings";
import { solutions } from "@/data/solutions";
import { tools } from "@/data/tools";
import { buildEditorialContentNodes } from "../content-adapter";
import type { ContentNodeId } from "../types";
import { buildProgrammaticMarketDescriptors } from "./market-descriptors";
import {
  auditProgrammaticMarketDescriptors,
  type ProgrammaticMarketAuditDescriptorInput,
  type ProgrammaticMarketAuditIssueCode,
} from "./market-audit";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function audit(
  descriptors: readonly ProgrammaticMarketAuditDescriptorInput[],
  citySource: readonly Pick<(typeof cities)[number], "slug">[] = cities,
  countrySource: readonly Pick<(typeof countries)[number], "slug">[] = countries
) {
  return auditProgrammaticMarketDescriptors({
    descriptors,
    contentNodes: buildEditorialContentNodes(),
    rankings,
    reports: marketReports,
    cities: citySource,
    countries: countrySource,
  });
}

function assertIssue(
  descriptors: readonly ProgrammaticMarketAuditDescriptorInput[],
  code: ProgrammaticMarketAuditIssueCode
): void {
  const result = audit(descriptors);
  assert(result.status === "fail", `${code} fixture must fail.`);
  assert(result.issues.some((issue) => issue.code === code), `${code} fixture must produce the expected issue.`);
}

export function runProgrammaticMarketAuditSmokeTest(): void {
  const datasetsSnapshot = JSON.stringify([articles, guides, tools, solutions, rankings, marketReports]);
  const contentNodesSnapshot = JSON.stringify(buildEditorialContentNodes());
  const descriptors = buildProgrammaticMarketDescriptors();
  const rankingDescriptor = descriptors.find((descriptor) => descriptor.contentType === "ranking");
  const globalRankingDescriptor = descriptors.find(
    (descriptor) => descriptor.contentNodeId === "content:ranking:best-airbnb-cities"
  );
  const countriesRankingDescriptor = descriptors.find(
    (descriptor) => descriptor.contentNodeId === "content:ranking:best-airbnb-countries"
  );
  const countryRankingDescriptor = descriptors.find(
    (descriptor) => descriptor.contentNodeId === "content:ranking:best-airbnb-cities-in-france"
  );
  const regionRankingDescriptor = descriptors.find(
    (descriptor) => descriptor.contentNodeId === "content:ranking:best-airbnb-cities-in-europe"
  );
  const audienceRankingDescriptor = descriptors.find(
    (descriptor) => descriptor.contentNodeId === "content:ranking:best-airbnb-destinations-for-families"
  );
  const reportDescriptor = descriptors.find((descriptor) => descriptor.contentType === "report");
  const result = audit(descriptors);
  const repeatedResult = audit(descriptors);

  assert(rankingDescriptor, "A ranking descriptor fixture must be available.");
  assert(globalRankingDescriptor?.contentType === "ranking", "A global ranking descriptor fixture must be available.");
  assert(countriesRankingDescriptor?.contentType === "ranking", "A countries ranking descriptor fixture must be available.");
  assert(countryRankingDescriptor?.contentType === "ranking", "A country ranking descriptor fixture must be available.");
  assert(regionRankingDescriptor?.contentType === "ranking", "A region ranking descriptor fixture must be available.");
  assert(audienceRankingDescriptor?.contentType === "ranking", "An audience ranking descriptor fixture must be available.");
  assert(reportDescriptor, "A report descriptor fixture must be available.");

  assert(result.status === "pass", "Programmatic Market descriptor audit must pass on real descriptors.");
  assert(result.issues.length === 0, "Programmatic Market descriptor audit must not produce issues on real descriptors.");
  assert(result.summary.totalDescriptors === 12, "Programmatic Market descriptor audit must see 12 descriptors.");
  assert(result.summary.rankingDescriptors === 6, "Programmatic Market descriptor audit must see six ranking descriptors.");
  assert(result.summary.reportDescriptors === 6, "Programmatic Market descriptor audit must see six report descriptors.");
  assert(result.summary.expectedDescriptors === 12, "Programmatic Market descriptor audit must derive 12 expected descriptors.");
  assert(JSON.stringify(result) === JSON.stringify(repeatedResult), "Programmatic Market descriptor audit must be deterministic.");

  assertIssue(descriptors.slice(1), "missing_descriptor");
  assertIssue([...descriptors, descriptors[0]], "duplicate_descriptor");
  assertIssue([{ ...descriptors[0], contentType: "report" }, ...descriptors.slice(1)], "content_type_mismatch");
  assertIssue([{ ...descriptors[0], family: "wrong_family" }, ...descriptors.slice(1)], "invalid_family");
  assertIssue(
    [
      {
        contentNodeId: "content:ranking:missing-programmatic-market" as ContentNodeId,
        contentType: "ranking",
        family: "market_intelligence",
        scope: { kind: "global" },
        targetEntities: [{ kind: "city", slug: "paris" }],
      },
      ...descriptors,
    ],
    "missing_content_node"
  );
  assertIssue(
    [
      {
        contentNodeId: "content:guide:airbnb-market-intelligence",
        contentType: "guide",
        family: "market_intelligence",
      },
      ...descriptors,
    ],
    "editorial_hub_included"
  );
  assertIssue(
    descriptors.map((descriptor) =>
      descriptor.contentNodeId === rankingDescriptor.contentNodeId
        ? {
            contentNodeId: descriptor.contentNodeId,
            contentType: descriptor.contentType,
            family: descriptor.family,
          }
        : descriptor
    ),
    "missing_ranking_scope"
  );
  assertIssue(
    descriptors.map((descriptor) =>
      descriptor.contentNodeId === countryRankingDescriptor.contentNodeId
        ? {
            ...descriptor,
            scope: { kind: "country", entityRef: { kind: "country", slug: "morocco" } },
          }
        : descriptor
    ),
    "ranking_scope_mismatch"
  );
  const missingCountryResult = audit(
    descriptors.map((descriptor) =>
      descriptor.contentNodeId === countryRankingDescriptor.contentNodeId
        ? {
            ...descriptor,
            scope: { kind: "country", entityRef: { kind: "country", slug: "missing-country" } },
          }
        : descriptor
    )
  );
  assert(missingCountryResult.status === "fail", "missing_scope_entity fixture must fail.");
  assert(
    missingCountryResult.issues.some((issue) => issue.code === "missing_scope_entity"),
    "missing_scope_entity fixture must produce the expected issue."
  );
  assertIssue(
    descriptors.map((descriptor) =>
      descriptor.contentNodeId === regionRankingDescriptor.contentNodeId
        ? { ...descriptor, scope: { kind: "region", slug: "wrong-region" } }
        : descriptor
    ),
    "ranking_scope_mismatch"
  );
  assertIssue(
    descriptors.map((descriptor) =>
      descriptor.contentNodeId === audienceRankingDescriptor.contentNodeId
        ? { ...descriptor, scope: { kind: "audience", slug: "wrong-audience" } }
        : descriptor
    ),
    "ranking_scope_mismatch"
  );
  assertIssue(
    descriptors.map((descriptor) =>
      descriptor.contentNodeId === globalRankingDescriptor.contentNodeId
        ? { ...descriptor, scope: { kind: "global", entityRef: { kind: "country", slug: "france" } } }
        : descriptor
    ),
    "invalid_ranking_scope"
  );
  assertIssue(
    descriptors.map((descriptor) =>
      descriptor.contentNodeId === globalRankingDescriptor.contentNodeId
        ? {
            contentNodeId: descriptor.contentNodeId,
            contentType: descriptor.contentType,
            family: descriptor.family,
            scope: globalRankingDescriptor.scope,
          }
        : descriptor
    ),
    "missing_target_entities"
  );
  assertIssue(
    descriptors.map((descriptor) =>
      descriptor.contentNodeId === globalRankingDescriptor.contentNodeId
        ? { ...descriptor, targetEntities: globalRankingDescriptor.targetEntities.slice(1) }
        : descriptor
    ),
    "target_entity_mismatch"
  );
  assertIssue(
    descriptors.map((descriptor) =>
      descriptor.contentNodeId === globalRankingDescriptor.contentNodeId
        ? {
            ...descriptor,
            targetEntities: [
              { kind: "country", slug: globalRankingDescriptor.targetEntities[0].slug },
              ...globalRankingDescriptor.targetEntities.slice(1),
            ],
          }
        : descriptor
    ),
    "invalid_target_entity_kind"
  );
  assertIssue(
    descriptors.map((descriptor) =>
      descriptor.contentNodeId === globalRankingDescriptor.contentNodeId
        ? {
            ...descriptor,
            targetEntities: [
              { kind: globalRankingDescriptor.targetEntities[0].kind, slug: "wrong-target" },
              ...globalRankingDescriptor.targetEntities.slice(1),
            ],
          }
        : descriptor
    ),
    "target_entity_mismatch"
  );
  const missingTargetCityResult = audit(
    descriptors.map((descriptor) =>
      descriptor.contentNodeId === globalRankingDescriptor.contentNodeId
        ? {
            ...descriptor,
            targetEntities: [
              { kind: globalRankingDescriptor.targetEntities[0].kind, slug: "paris" },
              ...globalRankingDescriptor.targetEntities.slice(1),
            ],
          }
        : descriptor
    ),
    cities.filter((city) => city.slug !== "paris")
  );
  assert(missingTargetCityResult.status === "fail", "missing target city fixture must fail.");
  assert(
    missingTargetCityResult.issues.some((issue) => issue.code === "missing_target_entity"),
    "missing target city fixture must produce the expected issue."
  );
  const missingTargetCountryResult = audit(
    descriptors.map((descriptor) =>
      descriptor.contentNodeId === countriesRankingDescriptor.contentNodeId
        ? {
            ...descriptor,
            targetEntities: [
              { kind: countriesRankingDescriptor.targetEntities[0].kind, slug: "france" },
              ...countriesRankingDescriptor.targetEntities.slice(1),
            ],
          }
        : descriptor
    ),
    cities,
    countries.filter((country) => country.slug !== "france")
  );
  assert(missingTargetCountryResult.status === "fail", "missing target country fixture must fail.");
  assert(
    missingTargetCountryResult.issues.some((issue) => issue.code === "missing_target_entity"),
    "missing target country fixture must produce the expected issue."
  );
  assertIssue(
    descriptors.map((descriptor) =>
      descriptor.contentNodeId === globalRankingDescriptor.contentNodeId
        ? {
            ...descriptor,
            targetEntities: [
              globalRankingDescriptor.targetEntities[0],
              globalRankingDescriptor.targetEntities[0],
              ...globalRankingDescriptor.targetEntities.slice(2),
            ],
          }
        : descriptor
    ),
    "duplicate_target_entity"
  );
  assertIssue(
    descriptors.map((descriptor) =>
      descriptor.contentNodeId === globalRankingDescriptor.contentNodeId
        ? {
            ...descriptor,
            targetEntities: [
              globalRankingDescriptor.targetEntities[1],
              globalRankingDescriptor.targetEntities[0],
              ...globalRankingDescriptor.targetEntities.slice(2),
            ],
          }
        : descriptor
    ),
    "target_entity_mismatch"
  );
  assertIssue(
    descriptors.map((descriptor) =>
      descriptor.contentNodeId === reportDescriptor.contentNodeId
        ? {
            contentNodeId: descriptor.contentNodeId,
            contentType: descriptor.contentType,
            family: descriptor.family,
          }
        : descriptor
    ),
    "missing_entity_ref"
  );
  assertIssue(
    descriptors.map((descriptor) =>
      descriptor.contentNodeId === reportDescriptor.contentNodeId
        ? { ...descriptor, entityRef: { kind: "country", slug: reportDescriptor.entityRef.slug } }
        : descriptor
    ),
    "invalid_entity_kind"
  );
  assertIssue(
    descriptors.map((descriptor) =>
      descriptor.contentNodeId === reportDescriptor.contentNodeId
        ? { ...descriptor, entityRef: { kind: "city", slug: "mismatch-city" } }
        : descriptor
    ),
    "entity_ref_mismatch"
  );
  const missingCityResult = audit(
    descriptors,
    cities.filter((city) => city.slug !== reportDescriptor.entityRef.slug)
  );
  assert(missingCityResult.status === "fail", "missing_geo_entity fixture must fail.");
  assert(
    missingCityResult.issues.some((issue) => issue.code === "missing_geo_entity"),
    "missing_geo_entity fixture must produce the expected issue."
  );

  assert(
    JSON.stringify(buildEditorialContentNodes()) === contentNodesSnapshot,
    "Programmatic Market descriptor audit must not mutate ContentNodes."
  );
  assert(
    JSON.stringify([articles, guides, tools, solutions, rankings, marketReports]) === datasetsSnapshot,
    "Programmatic Market descriptor audit must not mutate source datasets."
  );

  console.log("Programmatic Market audit smoke passed.", result.summary);
}
