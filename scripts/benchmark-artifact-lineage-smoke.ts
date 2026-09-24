import assert from "node:assert/strict";

import {
  collectSupersededBenchmarkArtifactIds,
  normalizeBenchmarkArtifactSupersessionEdges,
  persistBenchmarkArtifactSupersessionEdges,
  toBenchmarkArtifactSupersessionEdgeRows,
  type BenchmarkArtifactSupersessionEdgeRow,
} from "../lib/intelligenceV2/benchmarkArtifactLineage";

async function main(): Promise<void> {
  {
    const edges = normalizeBenchmarkArtifactSupersessionEdges([
      {
        successorArtifactId: "successor",
        predecessorArtifactId: "predecessor-a",
      },
      {
        successorArtifactId: "successor",
        predecessorArtifactId: "predecessor-a",
      },
      {
        successorArtifactId: "successor",
        predecessorArtifactId: "predecessor-b",
      },
    ]);

    assert.deepEqual(edges, [
      {
        successorArtifactId: "successor",
        predecessorArtifactId: "predecessor-a",
      },
      {
        successorArtifactId: "successor",
        predecessorArtifactId: "predecessor-b",
      },
    ]);

    console.log("CASE_A_DUPLICATE_EDGE_IDEMPOTENCE=PASS");
  }

  {
    assert.throws(
      () =>
        normalizeBenchmarkArtifactSupersessionEdges([
          {
            successorArtifactId: "same",
            predecessorArtifactId: "same",
          },
        ]),
      /cannot reference itself/
    );

    console.log("CASE_B_SELF_RELATION_REJECTED=PASS");
  }

  {
    const rows = toBenchmarkArtifactSupersessionEdgeRows([
      {
        successorArtifactId: "canonical",
        predecessorArtifactId: "legacy-a",
      },
      {
        successorArtifactId: "canonical",
        predecessorArtifactId: "legacy-b",
      },
    ]);

    assert.deepEqual(rows, [
      {
        successor_artifact_id: "canonical",
        predecessor_artifact_id: "legacy-a",
      },
      {
        successor_artifact_id: "canonical",
        predecessor_artifact_id: "legacy-b",
      },
    ]);

    console.log("CASE_C_DB_ROW_MAPPING=PASS");
  }

  {
    const superseded = collectSupersededBenchmarkArtifactIds({
      legacySupersedesArtifactIds: ["legacy-a", null],
      lineageEdges: [
        {
          successorArtifactId: "canonical",
          predecessorArtifactId: "legacy-b",
        },
        {
          successorArtifactId: "canonical",
          predecessorArtifactId: "legacy-c",
        },
      ],
    });

    assert.deepEqual(
      [...superseded].sort(),
      ["legacy-a", "legacy-b", "legacy-c"]
    );

    assert.equal(superseded.has("canonical"), false);
    assert.equal(superseded.has("unrelated"), false);

    console.log("CASE_D_HYBRID_TERMINALITY=PASS");
  }

  {
    const persistedRows: BenchmarkArtifactSupersessionEdgeRow[][] = [];

    const writer = async (
      rows: readonly BenchmarkArtifactSupersessionEdgeRow[]
    ): Promise<void> => {
      persistedRows.push([...rows]);
    };

    const result = await persistBenchmarkArtifactSupersessionEdges({
      edges: [
        {
          successorArtifactId: "canonical",
          predecessorArtifactId: "legacy-a",
        },
        {
          successorArtifactId: "canonical",
          predecessorArtifactId: "legacy-a",
        },
        {
          successorArtifactId: "canonical",
          predecessorArtifactId: "legacy-b",
        },
      ],
      writer,
    });

    assert.deepEqual(result, {
      attempted: 2,
      persisted: 2,
    });

    assert.equal(persistedRows.length, 1);
    assert.equal(persistedRows[0]?.length, 2);

    console.log("CASE_E_WRITER_DEDUPLICATION=PASS");
  }

  {
    let calls = 0;

    const result = await persistBenchmarkArtifactSupersessionEdges({
      edges: [],
      writer: async () => {
        calls += 1;
      },
    });

    assert.deepEqual(result, {
      attempted: 0,
      persisted: 0,
    });

    assert.equal(calls, 0);

    console.log("CASE_F_EMPTY_WRITE_NOOP=PASS");
  }

  console.log("P10_C_LINEAGE_ACCESS_LAYER_SMOKE=PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
