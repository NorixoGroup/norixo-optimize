import { cities } from "@/data/cities";
import { countries } from "@/data/countries";
import { marketReports } from "@/data/marketReports";
import { rankings } from "@/data/rankings";
import { buildEditorialContentNodes } from "../content-adapter";
import type { ContentNodeId } from "../types";
import type { EditorialAuditReport } from "../audit/types";
import { buildProgrammaticMarketDescriptors } from "./market-descriptors";
import { auditProgrammaticMarketDescriptors } from "./market-audit";
import { evaluateProgrammaticMarketGovernance } from "./market-governance";

export type ProgrammaticMarketDiagnosticStatus = "pass" | "fail";

export interface ProgrammaticMarketDiagnosticResult {
  readonly status: ProgrammaticMarketDiagnosticStatus;
  readonly auditStatus: ProgrammaticMarketDiagnosticStatus;
  readonly leavesTotal: number;
  readonly governed: number;
  readonly notGoverned: number;
  readonly rankings: number;
  readonly reports: number;
  readonly editorialOrphansTotal: number;
  readonly programmaticEditorialOrphans: readonly ContentNodeId[];
  readonly governedEditorialOrphans: readonly ContentNodeId[];
  readonly notGovernedEditorialOrphans: readonly ContentNodeId[];
  readonly nonProgrammaticEditorialOrphans: readonly ContentNodeId[];
  readonly notGovernedProgrammaticLeaves: readonly ContentNodeId[];
}

export function isContentNodeId(value: string): value is ContentNodeId {
  return value.startsWith("content:");
}

function editorialOrphanIds(report: EditorialAuditReport): ContentNodeId[] {
  return report.issues.flatMap((issue) =>
    issue.code === "orphan_content_node" && issue.nodeId && isContentNodeId(issue.nodeId) ? [issue.nodeId] : []
  );
}

export function evaluateProgrammaticMarketDiagnostic(
  editorialReport: EditorialAuditReport
): ProgrammaticMarketDiagnosticResult {
  const contentNodes = buildEditorialContentNodes();
  const descriptors = buildProgrammaticMarketDescriptors();
  const auditInput = {
    descriptors,
    contentNodes,
    rankings,
    reports: marketReports,
    cities,
    countries,
  };
  const audit = auditProgrammaticMarketDescriptors(auditInput);
  const governance = evaluateProgrammaticMarketGovernance(auditInput);
  const programmaticLeafIds = new Set(governance.entries.map((entry) => entry.contentNodeId));
  const governedLeafIds = new Set(
    governance.entries.flatMap((entry) => (entry.governed ? [entry.contentNodeId] : []))
  );
  const notGovernedProgrammaticLeaves = governance.entries.flatMap((entry) =>
    entry.governed ? [] : [entry.contentNodeId]
  );
  const orphanIds = editorialOrphanIds(editorialReport);
  const programmaticEditorialOrphans = orphanIds.filter((orphanId) => programmaticLeafIds.has(orphanId));
  const governedEditorialOrphans = programmaticEditorialOrphans.filter((orphanId) => governedLeafIds.has(orphanId));
  const notGovernedEditorialOrphans = programmaticEditorialOrphans.filter((orphanId) => !governedLeafIds.has(orphanId));
  const nonProgrammaticEditorialOrphans = orphanIds.filter((orphanId) => !programmaticLeafIds.has(orphanId));
  const allLeavesRepresented = governance.summary.total === rankings.length + marketReports.length;
  const status = audit.status === "pass" && allLeavesRepresented && governance.summary.notGoverned === 0
    ? "pass"
    : "fail";

  return {
    status,
    auditStatus: audit.status,
    leavesTotal: governance.summary.total,
    governed: governance.summary.governed,
    notGoverned: governance.summary.notGoverned,
    rankings: governance.entries.filter((entry) => entry.contentNodeId.startsWith("content:ranking:")).length,
    reports: governance.entries.filter((entry) => entry.contentNodeId.startsWith("content:report:")).length,
    editorialOrphansTotal: orphanIds.length,
    programmaticEditorialOrphans,
    governedEditorialOrphans,
    notGovernedEditorialOrphans,
    nonProgrammaticEditorialOrphans,
    notGovernedProgrammaticLeaves,
  };
}

export function formatProgrammaticMarketDiagnostic(result: ProgrammaticMarketDiagnosticResult): string {
  return [
    "Programmatic Market Intelligence",
    "",
    `Audit: ${result.auditStatus.toUpperCase()}`,
    `Status: ${result.status.toUpperCase()}`,
    `Leaves: ${result.leavesTotal}`,
    `Governed: ${result.governed}`,
    `Not governed: ${result.notGoverned}`,
    `Editorial orphans among programmatic leaves: ${result.programmaticEditorialOrphans.length}`,
    `Governed editorial orphans: ${result.governedEditorialOrphans.length}`,
    `Not-governed editorial orphans: ${result.notGovernedEditorialOrphans.length}`,
    `Other editorial orphans: ${result.nonProgrammaticEditorialOrphans.length}`,
  ].join("\n");
}
