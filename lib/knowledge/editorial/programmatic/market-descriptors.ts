import { cities } from "@/data/cities";
import { countries } from "@/data/countries";
import { marketReports } from "@/data/marketReports";
import { rankings, type RankingItem, type RankingScope } from "@/data/rankings";
import { buildEditorialContentNodes } from "../content-adapter";
import type { ContentNode } from "../types";
import { cityGeoEntityRef, countryGeoEntityRef } from "./geo-types";
import type { GeoEntityRef } from "./geo-types";
import type {
  ProgrammaticContentFamily,
  ProgrammaticMarketDescriptor,
  ProgrammaticMarketRankingScope,
} from "./types";

const marketIntelligenceFamily: ProgrammaticContentFamily = "market_intelligence";

function contentNodeFor(
  contentNodeByTypeSlug: ReadonlyMap<string, ContentNode>,
  contentType: "ranking" | "report",
  slug: string
): ContentNode {
  const contentNode = contentNodeByTypeSlug.get(`${contentType}:${slug}`);

  if (!contentNode) {
    throw new Error(`Programmatic Market content node is missing: ${contentType}:${slug}.`);
  }

  return contentNode;
}

function programmaticRankingScopeFor(
  rankingSlug: string,
  scope: RankingScope,
  countryBySlug: ReadonlyMap<string, (typeof countries)[number]>
): ProgrammaticMarketRankingScope {
  if (scope.kind === "global") {
    return { kind: "global" };
  }

  if (scope.kind === "country") {
    const country = countryBySlug.get(scope.countrySlug);

    if (!country) {
      throw new Error(`Programmatic Market ranking country is missing: ${rankingSlug} -> ${scope.countrySlug}.`);
    }

    return {
      kind: "country",
      entityRef: countryGeoEntityRef(country),
    };
  }

  return {
    kind: scope.kind,
    slug: scope.slug,
  };
}

function programmaticRankingTargetEntityFor(
  rankingSlug: string,
  item: RankingItem,
  cityBySlug: ReadonlyMap<string, (typeof cities)[number]>,
  countryBySlug: ReadonlyMap<string, (typeof countries)[number]>
): GeoEntityRef {
  if (item.citySlug && item.countrySlug) {
    throw new Error(`Programmatic Market ranking item has ambiguous target entity: ${rankingSlug} -> ${item.name}.`);
  }

  if (item.citySlug) {
    const city = cityBySlug.get(item.citySlug);

    if (!city) {
      throw new Error(`Programmatic Market ranking target city is missing: ${rankingSlug} -> ${item.citySlug}.`);
    }

    return cityGeoEntityRef(city);
  }

  if (item.countrySlug) {
    const country = countryBySlug.get(item.countrySlug);

    if (!country) {
      throw new Error(`Programmatic Market ranking target country is missing: ${rankingSlug} -> ${item.countrySlug}.`);
    }

    return countryGeoEntityRef(country);
  }

  throw new Error(`Programmatic Market ranking item is missing a target entity: ${rankingSlug} -> ${item.name}.`);
}

export function buildProgrammaticMarketDescriptors(): ProgrammaticMarketDescriptor[] {
  const contentNodes = buildEditorialContentNodes();
  const contentNodeByTypeSlug = new Map(
    contentNodes.map((node) => [`${node.contentType}:${node.slug}`, node])
  );
  const cityBySlug = new Map(cities.map((city) => [city.slug, city]));
  const countryBySlug = new Map(countries.map((country) => [country.slug, country]));

  return [
    ...rankings.map((ranking) => ({
      contentNodeId: contentNodeFor(contentNodeByTypeSlug, "ranking", ranking.slug).id,
      contentType: "ranking" as const,
      family: marketIntelligenceFamily,
      scope: programmaticRankingScopeFor(ranking.slug, ranking.scope, countryBySlug),
      targetEntities: ranking.items.map((item) =>
        programmaticRankingTargetEntityFor(ranking.slug, item, cityBySlug, countryBySlug)
      ),
    })),
    ...marketReports.map((report) => {
      const city = cityBySlug.get(report.citySlug);

      if (!city) {
        throw new Error(`Programmatic Market report city is missing: ${report.slug} -> ${report.citySlug}.`);
      }

      return {
        contentNodeId: contentNodeFor(contentNodeByTypeSlug, "report", report.slug).id,
        contentType: "report" as const,
        family: marketIntelligenceFamily,
        entityRef: cityGeoEntityRef(city),
      };
    }),
  ];
}
