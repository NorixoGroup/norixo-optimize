import { runFullEditorialAudit } from "../audit/full-audit";
import type { ContentNodeId } from "../types";
import type { ProgrammaticMarketDiagnosticResult } from "./market-diagnostic";
import { evaluateProgrammaticMarketDiagnostic } from "./market-diagnostic";
import {
  classifyEditorialOrphansWithProgrammaticGovernance,
  formatProgrammaticEditorialOrphanClassification,
} from "./orphan-classification";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function withDiagnosticPatch(
  diagnostic: ProgrammaticMarketDiagnosticResult,
  patch: Partial<ProgrammaticMarketDiagnosticResult>
): ProgrammaticMarketDiagnosticResult {
  return {
    ...diagnostic,
    ...patch,
  };
}

export function runProgrammaticOrphanClassificationSmokeTest(): void {
  const report = runFullEditorialAudit();
  const reportSnapshot = JSON.stringify(report);
  const diagnostic = evaluateProgrammaticMarketDiagnostic(report);
  const diagnosticSnapshot = JSON.stringify(diagnostic);
  const classification = classifyEditorialOrphansWithProgrammaticGovernance(diagnostic);
  const repeatedClassification = classifyEditorialOrphansWithProgrammaticGovernance(diagnostic);
  const formatted = formatProgrammaticEditorialOrphanClassification(classification);
  const trueEditorialOrphans: readonly ContentNodeId[] = [];
  const brokenProgrammaticLeaf = diagnostic.governedEditorialOrphans[0];

  assert(brokenProgrammaticLeaf, "A governed programmatic orphan fixture must exist.");
  assert(classification.rawOrphans.length === 12, "Raw orphan classification must preserve 12 raw orphans.");
  assert(
    classification.programmaticGovernedLeaves.length === 12,
    "Programmatic governed orphan classification must contain 12 leaves."
  );
  assert(
    classification.programmaticNotGovernedLeaves.length === 0,
    "Programmatic not-governed orphan classification must contain zero leaves."
  );
  assert(classification.editorialOrphans.length === 0, "True editorial orphan classification must contain no leaves.");
  assert(
    classification.programmaticGovernedLeaves.length +
      classification.programmaticNotGovernedLeaves.length +
      classification.editorialOrphans.length ===
      classification.rawOrphans.length,
    "Orphan classifications must partition the raw orphan total."
  );
  assert(
    JSON.stringify(classification.editorialOrphans) === JSON.stringify(trueEditorialOrphans),
    "True editorial orphan baseline must match the current derived list."
  );
  assert(
    classification.entries.every((entry) => classification.rawOrphans.includes(entry.contentNodeId)),
    "Classification entries must only cover raw editorial orphans."
  );
  assert(
    JSON.stringify(classification) === JSON.stringify(repeatedClassification),
    "Orphan classification must be deterministic."
  );
  assert(
    formatted.includes("Raw editorial orphans: 12") &&
      formatted.includes("Programmatic governed leaves: 12") &&
      formatted.includes("True editorial orphans: 0") &&
      formatted.includes("None."),
    "Orphan classification formatter must expose raw and true orphan counts."
  );

  const brokenDiagnostic = withDiagnosticPatch(diagnostic, {
    governedEditorialOrphans: diagnostic.governedEditorialOrphans.filter(
      (contentNodeId) => contentNodeId !== brokenProgrammaticLeaf
    ),
    notGovernedEditorialOrphans: [brokenProgrammaticLeaf],
  });
  const brokenClassification = classifyEditorialOrphansWithProgrammaticGovernance(brokenDiagnostic);

  assert(brokenClassification.rawOrphans.length === 12, "Broken leaf fixture must preserve raw orphan total.");
  assert(
    brokenClassification.programmaticGovernedLeaves.length === 11,
    "Broken leaf fixture must reduce governed programmatic leaves by one."
  );
  assert(
    brokenClassification.programmaticNotGovernedLeaves.length === 1,
    "Broken leaf fixture must increase not-governed programmatic leaves by one."
  );
  assert(
    brokenClassification.editorialOrphans.length === 0,
    "Broken leaf fixture must preserve true editorial orphan count."
  );

  const syntheticOrphan: ContentNodeId = "content:guide:synthetic-editorial-orphan";
  const nonProgrammaticDiagnostic = withDiagnosticPatch(diagnostic, {
    nonProgrammaticEditorialOrphans: [...diagnostic.nonProgrammaticEditorialOrphans, syntheticOrphan],
  });
  const nonProgrammaticClassification = classifyEditorialOrphansWithProgrammaticGovernance(nonProgrammaticDiagnostic);

  assert(
    nonProgrammaticClassification.editorialOrphans.length === 1,
    "Non-programmatic orphan fixture must increase true editorial orphans by one."
  );
  assert(
    nonProgrammaticClassification.programmaticGovernedLeaves.length === 12 &&
      nonProgrammaticClassification.programmaticNotGovernedLeaves.length === 0,
    "Non-programmatic orphan fixture must not change programmatic classifications."
  );

  const nonOrphanProgrammaticDiagnostic = withDiagnosticPatch(diagnostic, {
    governedEditorialOrphans: diagnostic.governedEditorialOrphans.slice(1),
  });
  const nonOrphanProgrammaticClassification = classifyEditorialOrphansWithProgrammaticGovernance(
    nonOrphanProgrammaticDiagnostic
  );

  assert(
    !nonOrphanProgrammaticClassification.rawOrphans.includes(brokenProgrammaticLeaf),
    "Programmatic leaves that are not raw orphans must not appear in orphan classification."
  );
  assert(
    nonOrphanProgrammaticClassification.programmaticGovernedLeaves.length === 11,
    "Programmatic non-orphan fixture must not count the removed leaf as programmatic governed orphan."
  );

  assert(JSON.stringify(report) === reportSnapshot, "Orphan classification must not mutate the editorial report.");
  assert(JSON.stringify(diagnostic) === diagnosticSnapshot, "Orphan classification must not mutate diagnostics.");

  console.log("Programmatic orphan classification smoke passed.", {
    rawOrphans: classification.rawOrphans.length,
    programmaticGovernedLeaves: classification.programmaticGovernedLeaves.length,
    programmaticNotGovernedLeaves: classification.programmaticNotGovernedLeaves.length,
    trueEditorialOrphans: classification.editorialOrphans,
  });
}
