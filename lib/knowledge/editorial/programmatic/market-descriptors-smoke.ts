import { articles } from "@/data/articles";
import { guides } from "@/data/guides";
import { marketReports } from "@/data/marketReports";
import { rankings } from "@/data/rankings";
import { solutions } from "@/data/solutions";
import { tools } from "@/data/tools";
import { buildEditorialContentNodes } from "../content-adapter";
import { buildProgrammaticMarketDescriptors } from "./market-descriptors";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export function runProgrammaticMarketDescriptorsSmokeTest(): void {
  const datasetsSnapshot = JSON.stringify([articles, guides, tools, solutions, rankings, marketReports]);
  const contentNodesSnapshot = JSON.stringify(buildEditorialContentNodes());
  const descriptors = buildProgrammaticMarketDescriptors();
  const repeatedDescriptors = buildProgrammaticMarketDescriptors();
  const contentNodeIds = new Set(buildEditorialContentNodes().map((node) => node.id));
  const descriptorIds = descriptors.map((descriptor) => descriptor.contentNodeId);
  const rankingDescriptors = descriptors.filter((descriptor) => descriptor.contentType === "ranking");
  const reportDescriptors = descriptors.filter((descriptor) => descriptor.contentType === "report");
  const reportsWithCityRefs = reportDescriptors.filter(
    (descriptor) => descriptor.entityRef.kind === "city"
  );
  const rankingsWithEntityRefs = rankingDescriptors.filter((descriptor) => "entityRef" in descriptor);
  const rankingDescriptorById = new Map(rankingDescriptors.map((descriptor) => [descriptor.contentNodeId, descriptor]));
  const rankingBySlug = new Map(rankings.map((ranking) => [ranking.slug, ranking]));
  const europeRankingScope = rankingDescriptorById.get("content:ranking:best-airbnb-cities-in-europe")?.scope;
  const franceRankingScope = rankingDescriptorById.get("content:ranking:best-airbnb-cities-in-france")?.scope;
  const familiesRankingScope = rankingDescriptorById.get(
    "content:ranking:best-airbnb-destinations-for-families"
  )?.scope;

  assert(descriptors.length === 12, "Programmatic Market descriptors must contain the 12 current market leaves.");
  assert(rankingDescriptors.length === 6, "Programmatic Market descriptors must contain six rankings.");
  assert(reportDescriptors.length === 6, "Programmatic Market descriptors must contain six reports.");
  assert(reportsWithCityRefs.length === 6, "Programmatic Market report descriptors must include six city entity refs.");
  assert(rankingsWithEntityRefs.length === 0, "Programmatic Market ranking descriptors must not include root entity refs.");
  assert(
    rankingDescriptorById.get("content:ranking:best-airbnb-cities")?.scope.kind === "global",
    "Best Airbnb Cities ranking descriptor must have global scope."
  );
  assert(
    rankingDescriptorById.get("content:ranking:best-airbnb-markets")?.scope.kind === "global",
    "Best Airbnb Markets ranking descriptor must have global scope."
  );
  assert(
    rankingDescriptorById.get("content:ranking:best-airbnb-countries")?.scope.kind === "global",
    "Best Airbnb Countries ranking descriptor must have global scope."
  );
  assert(
    europeRankingScope?.kind === "region" && europeRankingScope.slug === "europe",
    "Best Airbnb Cities in Europe ranking descriptor must have region:europe scope."
  );
  assert(
    franceRankingScope?.kind === "country" &&
      franceRankingScope.entityRef.kind === "country" &&
      franceRankingScope.entityRef.slug === "france",
    "Best Airbnb Cities in France ranking descriptor must have country:france scope."
  );
  assert(
    familiesRankingScope?.kind === "audience" && familiesRankingScope.slug === "families",
    "Best Airbnb Destinations for Families ranking descriptor must have audience:families scope."
  );
  assert(
    rankingDescriptors.every((descriptor) => descriptor.targetEntities.length > 0),
    "Programmatic Market ranking descriptors must include target entities."
  );
  assert(
    rankingDescriptors.reduce((sum, descriptor) => sum + descriptor.targetEntities.length, 0) === 30,
    "Programmatic Market ranking descriptors must include the 30 current ranking target entities."
  );
  rankingDescriptors.forEach((descriptor) => {
    const rankingSlug = descriptor.contentNodeId.replace("content:ranking:", "");
    const ranking = rankingBySlug.get(rankingSlug);

    assert(ranking, `Ranking source must exist for descriptor: ${descriptor.contentNodeId}.`);
    assert(
      descriptor.targetEntities.length === ranking.items.length,
      `Ranking descriptor targetEntities length must match Ranking.items: ${descriptor.contentNodeId}.`
    );

    descriptor.targetEntities.forEach((targetEntity, targetIndex) => {
      const item = ranking.items[targetIndex];
      const expectedKind = item.citySlug ? "city" : "country";
      const expectedSlug = item.citySlug ?? item.countrySlug;

      assert(expectedSlug, `Ranking item must have a target slug: ${descriptor.contentNodeId}.`);
      assert(
        targetEntity.kind === expectedKind,
        `Ranking descriptor target entity kind must preserve item order: ${descriptor.contentNodeId}.`
      );
      assert(
        targetEntity.slug === expectedSlug,
        `Ranking descriptor target entity slug must preserve item order: ${descriptor.contentNodeId}.`
      );
    });
  });
  assert(
    rankingDescriptorById.get("content:ranking:best-airbnb-cities")?.targetEntities.every(
      (targetEntity) => targetEntity.kind === "city"
    ),
    "Best Airbnb Cities must have five city targets."
  );
  assert(
    rankingDescriptorById.get("content:ranking:best-airbnb-markets")?.targetEntities.every(
      (targetEntity) => targetEntity.kind === "city"
    ),
    "Best Airbnb Markets must have five city targets."
  );
  assert(
    rankingDescriptorById.get("content:ranking:best-airbnb-countries")?.targetEntities.every(
      (targetEntity) => targetEntity.kind === "country"
    ),
    "Best Airbnb Countries must have five country targets."
  );
  assert(
    rankingDescriptorById.get("content:ranking:best-airbnb-cities-in-europe")?.targetEntities.every(
      (targetEntity) => targetEntity.kind === "city"
    ),
    "Best Airbnb Cities in Europe must have five city targets."
  );
  assert(
    rankingDescriptorById.get("content:ranking:best-airbnb-cities-in-france")?.targetEntities.every(
      (targetEntity) => targetEntity.kind === "city"
    ),
    "Best Airbnb Cities in France must have five city targets."
  );
  assert(
    rankingDescriptorById.get("content:ranking:best-airbnb-destinations-for-families")?.targetEntities.every(
      (targetEntity) => targetEntity.kind === "city"
    ),
    "Best Airbnb Destinations for Families must have five city targets."
  );
  assert(
    reportDescriptors.some(
      (descriptor) =>
        descriptor.contentNodeId === "content:report:airbnb-market-report-paris" &&
        descriptor.entityRef.kind === "city" &&
        descriptor.entityRef.slug === "paris"
    ),
    "Paris report descriptor must resolve to city:paris."
  );
  assert(
    reportDescriptors.some(
      (descriptor) =>
        descriptor.contentNodeId === "content:report:airbnb-market-report-marrakech" &&
        descriptor.entityRef.kind === "city" &&
        descriptor.entityRef.slug === "marrakech"
    ),
    "Marrakech report descriptor must resolve to city:marrakech."
  );
  assert(
    reportDescriptors.some(
      (descriptor) =>
        descriptor.contentNodeId === "content:report:airbnb-market-report-dubai" &&
        descriptor.entityRef.kind === "city" &&
        descriptor.entityRef.slug === "dubai"
    ),
    "Dubai report descriptor must resolve to city:dubai."
  );
  assert(
    reportDescriptors.some(
      (descriptor) =>
        descriptor.contentNodeId === "content:report:airbnb-market-report-tokyo" &&
        descriptor.entityRef.kind === "city" &&
        descriptor.entityRef.slug === "tokyo"
    ),
    "Tokyo report descriptor must resolve to city:tokyo."
  );
  assert(
    reportDescriptors.some(
      (descriptor) =>
        descriptor.contentNodeId === "content:report:airbnb-market-report-barcelona" &&
        descriptor.entityRef.kind === "city" &&
        descriptor.entityRef.slug === "barcelona"
    ),
    "Barcelona report descriptor must resolve to city:barcelona."
  );
  assert(
    reportDescriptors.some(
      (descriptor) =>
        descriptor.contentNodeId === "content:report:airbnb-market-report-new-york" &&
        descriptor.entityRef.kind === "city" &&
        descriptor.entityRef.slug === "new-york"
    ),
    "New York report descriptor must resolve to city:new-york."
  );
  assert(new Set(descriptorIds).size === descriptorIds.length, "Programmatic Market descriptor IDs must be unique.");
  assert(
    descriptors.every((descriptor) => descriptor.family === "market_intelligence"),
    "Programmatic Market descriptors must use the Market Intelligence family."
  );
  assert(
    descriptors.every((descriptor) => contentNodeIds.has(descriptor.contentNodeId)),
    "Programmatic Market descriptor ContentNode IDs must exist."
  );
  assert(
    !descriptorIds.includes("content:guide:airbnb-market-intelligence"),
    "The Market Intelligence editorial hub must not be a programmatic leaf."
  );
  assert(
    descriptorIds.every(
      (id) =>
        id.startsWith("content:ranking:") ||
        id.startsWith("content:report:")
    ),
    "Programmatic Market descriptors must not include articles, guides, tools, or solutions."
  );
  assert(
    JSON.stringify(descriptors) === JSON.stringify(repeatedDescriptors),
    "Programmatic Market descriptors must be deterministic."
  );
  assert(
    JSON.stringify(buildEditorialContentNodes()) === contentNodesSnapshot,
    "Programmatic Market descriptors must not mutate ContentNodes."
  );
  assert(
    JSON.stringify([articles, guides, tools, solutions, rankings, marketReports]) === datasetsSnapshot,
    "Programmatic Market descriptors must not mutate source datasets."
  );

  console.log("Programmatic Market descriptors smoke passed.", {
    total: descriptors.length,
    rankings: rankingDescriptors.length,
    reports: reportDescriptors.length,
    reportEntityRefs: reportsWithCityRefs.length,
  });
}
