import { analyzeClusterCoverage } from "./coverage-analyzer";
import { buildEditorialContentNodes } from "./content-adapter";
import { getEditorialMappings } from "./mapping-registry";
import { canonicalEditorialNodes } from "./taxonomy";
import type {
  ClusterGovernanceStatus,
  ClusterPriority,
  EditorialClusterDefinition,
} from "./cluster-governance-types";
import type { EditorialValidationIssue, EditorialValidationResult } from "./types";

const governanceStatuses = new Set<ClusterGovernanceStatus>([
  "active",
  "planned",
  "overloaded",
  "broken",
  "frozen",
  "deprecated",
]);
const clusterPriorities = new Set<ClusterPriority>(["critical", "high", "medium", "low"]);

export const editorialClusters: readonly EditorialClusterDefinition[] = [
  {
    topicId: "topic:pricing",
    slug: "pricing",
    label: "Pricing",
    status: "active",
    priority: "critical",
    pillarId: "content:guide:airbnb-pricing-optimization",
    primaryPlatform: "platform:airbnb",
    scope: [
      "topic:pricing",
      "metrics.average-daily-rate",
      "metrics.occupancy-rate",
      "metrics.revenue-per-available-rental-night",
    ],
    expectedCoverage: {
      requiresPillar: true,
      requiresCommercialPath: true,
      minSupportingContent: 7,
      expectedContentTypes: ["article", "tool", "solution"],
      expectedPlatforms: ["platform:airbnb"],
      expectedMetrics: [
        "metrics.average-daily-rate",
        "metrics.occupancy-rate",
        "metrics.revenue-per-available-rental-night",
      ],
      optionalContentTypes: ["ranking", "report"],
    },
  },
  {
    topicId: "topic:revenue",
    slug: "revenue-kpi",
    label: "Revenue / KPI",
    status: "active",
    priority: "high",
    pillarId: "content:guide:airbnb-revenue-optimization",
    primaryPlatform: "platform:airbnb",
    scope: [
      "topic:revenue",
      "metrics.average-daily-rate",
      "metrics.occupancy-rate",
      "metrics.revenue-per-available-rental-night",
      "revenue.accommodation-revenue",
      "inventory.booked-nights",
    ],
    expectedCoverage: {
      requiresPillar: true,
      requiresCommercialPath: true,
      minSupportingContent: 3,
      expectedContentTypes: ["article", "tool", "solution"],
      expectedPlatforms: ["platform:airbnb"],
      expectedMetrics: [
        "metrics.average-daily-rate",
        "metrics.occupancy-rate",
        "metrics.revenue-per-available-rental-night",
        "revenue.accommodation-revenue",
        "inventory.booked-nights",
      ],
      optionalContentTypes: ["ranking", "report"],
    },
  },
  {
    topicId: "topic:seo-ranking",
    slug: "seo-ranking",
    label: "SEO / Ranking",
    status: "active",
    priority: "high",
    pillarId: "content:guide:airbnb-seo",
    primaryPlatform: "platform:airbnb",
    scope: ["topic:seo-ranking"],
    expectedCoverage: {
      requiresPillar: true,
      requiresCommercialPath: true,
      minSupportingContent: 1,
      expectedContentTypes: ["article", "guide"],
      expectedPlatforms: ["platform:airbnb"],
      expectedMetrics: [],
      optionalContentTypes: ["tool", "solution", "ranking", "report"],
    },
  },
  {
    topicId: "topic:conversion",
    slug: "conversion",
    label: "Conversion",
    status: "active",
    priority: "high",
    pillarId: "content:guide:airbnb-conversion-optimization",
    primaryPlatform: "platform:airbnb",
    scope: ["topic:conversion"],
    expectedCoverage: {
      requiresPillar: true,
      requiresCommercialPath: true,
      minSupportingContent: 6,
      expectedContentTypes: ["article", "guide", "solution"],
      expectedPlatforms: ["platform:airbnb"],
      expectedMetrics: [],
      optionalContentTypes: ["tool", "ranking", "report"],
    },
  },
  {
    topicId: "topic:trust",
    slug: "trust",
    label: "Trust",
    status: "active",
    priority: "high",
    pillarId: "content:guide:airbnb-trust-optimization",
    primaryPlatform: "platform:airbnb",
    scope: ["topic:trust"],
    expectedCoverage: {
      requiresPillar: true,
      requiresCommercialPath: false,
      minSupportingContent: 3,
      expectedContentTypes: ["article", "guide"],
      expectedPlatforms: ["platform:airbnb"],
      expectedMetrics: [],
      optionalContentTypes: ["solution", "tool", "ranking", "report"],
    },
  },
  {
    topicId: "topic:guest-experience",
    slug: "guest-experience",
    label: "Guest Experience",
    status: "active",
    priority: "high",
    pillarId: "content:guide:airbnb-guest-experience",
    primaryPlatform: "platform:airbnb",
    scope: ["topic:guest-experience"],
    expectedCoverage: {
      requiresPillar: true,
      requiresCommercialPath: false,
      minSupportingContent: 4,
      expectedContentTypes: ["article", "guide"],
      expectedPlatforms: ["platform:airbnb"],
      expectedMetrics: [],
      optionalContentTypes: ["solution", "tool", "ranking", "report"],
    },
  },
  {
    topicId: "topic:photos",
    slug: "photos",
    label: "Photos",
    status: "active",
    priority: "high",
    pillarId: "content:guide:airbnb-photo-optimization",
    primaryPlatform: "platform:airbnb",
    scope: ["topic:photos"],
    expectedCoverage: {
      requiresPillar: true,
      requiresCommercialPath: true,
      minSupportingContent: 1,
      expectedContentTypes: ["article", "guide"],
      expectedPlatforms: ["platform:airbnb"],
      expectedMetrics: [],
      optionalContentTypes: ["tool", "solution", "ranking", "report"],
    },
  },
];

function issue(path: string, message: string): EditorialValidationIssue {
  return { path, message };
}

export function getEditorialClusters(): EditorialClusterDefinition[] {
  return [...editorialClusters];
}

export function getEditorialCluster(topicId: string): EditorialClusterDefinition | undefined {
  return editorialClusters.find((cluster) => cluster.topicId === topicId);
}

export function getClustersByStatus(status: ClusterGovernanceStatus): EditorialClusterDefinition[] {
  return editorialClusters.filter((cluster) => cluster.status === status);
}

export function getClustersByPriority(priority: ClusterPriority): EditorialClusterDefinition[] {
  return editorialClusters.filter((cluster) => cluster.priority === priority);
}

export function validateEditorialClusterGovernance(
  clusters: readonly EditorialClusterDefinition[] = editorialClusters
): EditorialValidationResult {
  const issues: EditorialValidationIssue[] = [];
  const knownTopicIds = new Set(
    canonicalEditorialNodes.filter((node) => node.kind === "topic").map((node) => node.id)
  );
  const contentNodes = new Map(buildEditorialContentNodes().map((node) => [node.id, node]));
  const topicIds = new Set<string>();
  const slugs = new Set<string>();

  clusters.forEach((cluster, index) => {
    if (!knownTopicIds.has(cluster.topicId)) {
      issues.push(issue(`clusters[${index}].topicId`, "Cluster topic must exist in the editorial taxonomy."));
    }
    if (topicIds.has(cluster.topicId)) {
      issues.push(issue(`clusters[${index}].topicId`, "Cluster topic IDs must be unique."));
    }
    if (slugs.has(cluster.slug)) {
      issues.push(issue(`clusters[${index}].slug`, "Cluster slugs must be unique."));
    }
    if (!governanceStatuses.has(cluster.status)) {
      issues.push(issue(`clusters[${index}].status`, "Cluster governance status is invalid."));
    }
    if (!clusterPriorities.has(cluster.priority)) {
      issues.push(issue(`clusters[${index}].priority`, "Cluster priority is invalid."));
    }

    const pillar = cluster.pillarId ? contentNodes.get(cluster.pillarId) : undefined;
    if (cluster.pillarId && (!pillar || pillar.contentType !== "guide")) {
      issues.push(issue(`clusters[${index}].pillarId`, "Cluster pillar must reference an existing guide ContentNode."));
    }
    if (cluster.status === "active" && cluster.expectedCoverage.requiresPillar && !cluster.pillarId) {
      issues.push(issue(`clusters[${index}].pillarId`, "Active clusters that require a pillar must declare one."));
    }

    topicIds.add(cluster.topicId);
    slugs.add(cluster.slug);
  });

  return { valid: issues.length === 0, issues };
}

export function isClusterReadyForAutomation(topicId: string): boolean {
  const cluster = getEditorialCluster(topicId);

  if (!cluster || cluster.status !== "active" || (cluster.expectedCoverage.requiresPillar && !cluster.pillarId)) {
    return false;
  }

  const coverage = analyzeClusterCoverage({
    topicId: cluster.topicId,
    contentNodes: buildEditorialContentNodes(),
    mappings: getEditorialMappings(),
    editorialNodes: canonicalEditorialNodes,
    expectedCoverage: cluster.expectedCoverage,
  });

  return coverage.status === "strong" && coverage.pillarCount > 0;
}
