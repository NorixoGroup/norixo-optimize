export const BENCHMARK_ARTIFACT_SUPERSESSION_EDGE_TABLE =
  "benchmark_artifact_supersession_edges" as const;

export type BenchmarkArtifactSupersessionEdge = Readonly<{
  successorArtifactId: string;
  predecessorArtifactId: string;
}>;

export type BenchmarkArtifactSupersessionEdgeRow = Readonly<{
  successor_artifact_id: string;
  predecessor_artifact_id: string;
}>;

export type BenchmarkArtifactSupersessionEdgeWriter = (
  rows: readonly BenchmarkArtifactSupersessionEdgeRow[]
) => Promise<void>;

function requireArtifactId(
  value: string,
  field: "successorArtifactId" | "predecessorArtifactId"
): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new Error(`${field} must not be empty`);
  }

  return normalized;
}

export function normalizeBenchmarkArtifactSupersessionEdges(
  edges: readonly BenchmarkArtifactSupersessionEdge[]
): BenchmarkArtifactSupersessionEdge[] {
  const seen = new Set<string>();
  const normalized: BenchmarkArtifactSupersessionEdge[] = [];

  for (const edge of edges) {
    const successorArtifactId = requireArtifactId(
      edge.successorArtifactId,
      "successorArtifactId"
    );

    const predecessorArtifactId = requireArtifactId(
      edge.predecessorArtifactId,
      "predecessorArtifactId"
    );

    if (successorArtifactId === predecessorArtifactId) {
      throw new Error(
        "Benchmark artifact supersession edge cannot reference itself"
      );
    }

    const identity = `${successorArtifactId}\u0000${predecessorArtifactId}`;

    if (seen.has(identity)) {
      continue;
    }

    seen.add(identity);

    normalized.push({
      successorArtifactId,
      predecessorArtifactId,
    });
  }

  return normalized;
}

export function toBenchmarkArtifactSupersessionEdgeRows(
  edges: readonly BenchmarkArtifactSupersessionEdge[]
): BenchmarkArtifactSupersessionEdgeRow[] {
  return normalizeBenchmarkArtifactSupersessionEdges(edges).map((edge) => ({
    successor_artifact_id: edge.successorArtifactId,
    predecessor_artifact_id: edge.predecessorArtifactId,
  }));
}

export function collectSupersededBenchmarkArtifactIds(args: {
  legacySupersedesArtifactIds?: readonly (string | null | undefined)[];
  lineageEdges?: readonly BenchmarkArtifactSupersessionEdge[];
}): Set<string> {
  const superseded = new Set<string>();

  for (const artifactId of args.legacySupersedesArtifactIds ?? []) {
    if (typeof artifactId !== "string") {
      continue;
    }

    const normalized = artifactId.trim();

    if (normalized.length > 0) {
      superseded.add(normalized);
    }
  }

  for (const edge of normalizeBenchmarkArtifactSupersessionEdges(
    args.lineageEdges ?? []
  )) {
    superseded.add(edge.predecessorArtifactId);
  }

  return superseded;
}

export async function persistBenchmarkArtifactSupersessionEdges(args: {
  edges: readonly BenchmarkArtifactSupersessionEdge[];
  writer: BenchmarkArtifactSupersessionEdgeWriter;
}): Promise<{
  attempted: number;
  persisted: number;
}> {
  const rows = toBenchmarkArtifactSupersessionEdgeRows(args.edges);

  if (rows.length === 0) {
    return {
      attempted: 0,
      persisted: 0,
    };
  }

  await args.writer(rows);

  return {
    attempted: rows.length,
    persisted: rows.length,
  };
}
