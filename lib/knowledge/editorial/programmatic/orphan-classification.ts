import type { ContentNodeId } from "../types";
import type { ProgrammaticMarketDiagnosticResult } from "./market-diagnostic";

export type EditorialOrphanClassification =
  | "editorial_orphan"
  | "programmatic_governed_leaf"
  | "programmatic_not_governed_leaf";

export interface ProgrammaticEditorialOrphanClassificationEntry {
  readonly contentNodeId: ContentNodeId;
  readonly classification: EditorialOrphanClassification;
}

export interface ProgrammaticEditorialOrphanClassificationResult {
  readonly rawOrphans: readonly ContentNodeId[];
  readonly programmaticGovernedLeaves: readonly ContentNodeId[];
  readonly programmaticNotGovernedLeaves: readonly ContentNodeId[];
  readonly editorialOrphans: readonly ContentNodeId[];
  readonly entries: readonly ProgrammaticEditorialOrphanClassificationEntry[];
}

export function classifyEditorialOrphansWithProgrammaticGovernance(
  diagnostic: ProgrammaticMarketDiagnosticResult
): ProgrammaticEditorialOrphanClassificationResult {
  const programmaticGovernedLeafIds = new Set(diagnostic.governedEditorialOrphans);
  const programmaticNotGovernedLeafIds = new Set(diagnostic.notGovernedEditorialOrphans);
  const rawOrphans = [
    ...diagnostic.governedEditorialOrphans,
    ...diagnostic.notGovernedEditorialOrphans,
    ...diagnostic.nonProgrammaticEditorialOrphans,
  ];
  const entries = rawOrphans.map((contentNodeId) => {
    if (programmaticGovernedLeafIds.has(contentNodeId)) {
      return {
        contentNodeId,
        classification: "programmatic_governed_leaf" as const,
      };
    }

    if (programmaticNotGovernedLeafIds.has(contentNodeId)) {
      return {
        contentNodeId,
        classification: "programmatic_not_governed_leaf" as const,
      };
    }

    return {
      contentNodeId,
      classification: "editorial_orphan" as const,
    };
  });

  return {
    rawOrphans,
    programmaticGovernedLeaves: diagnostic.governedEditorialOrphans,
    programmaticNotGovernedLeaves: diagnostic.notGovernedEditorialOrphans,
    editorialOrphans: diagnostic.nonProgrammaticEditorialOrphans,
    entries,
  };
}

export function formatProgrammaticEditorialOrphanClassification(
  result: ProgrammaticEditorialOrphanClassificationResult
): string {
  return [
    "Editorial Orphan Classification",
    "",
    `Raw editorial orphans: ${result.rawOrphans.length}`,
    `Programmatic governed leaves: ${result.programmaticGovernedLeaves.length}`,
    `Programmatic not governed leaves: ${result.programmaticNotGovernedLeaves.length}`,
    `True editorial orphans: ${result.editorialOrphans.length}`,
    "",
    "True editorial orphans:",
    ...(result.editorialOrphans.length > 0
      ? result.editorialOrphans.map((contentNodeId) => `- ${contentNodeId}`)
      : ["None."]),
  ].join("\n");
}
