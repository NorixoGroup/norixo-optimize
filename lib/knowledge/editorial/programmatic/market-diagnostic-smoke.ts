import { cities } from "@/data/cities";
import { countries } from "@/data/countries";
import { marketReports } from "@/data/marketReports";
import { rankings } from "@/data/rankings";
import { runFullEditorialAudit } from "../audit/full-audit";
import type { EditorialAuditReport } from "../audit/types";
import { buildEditorialContentNodes } from "../content-adapter";
import type { ContentNodeId } from "../types";
import { buildProgrammaticMarketDescriptors } from "./market-descriptors";
import { auditProgrammaticMarketDescriptors } from "./market-audit";
import {
  evaluateProgrammaticMarketDiagnostic,
  formatProgrammaticMarketDiagnostic,
  isContentNodeId,
} from "./market-diagnostic";
import { evaluateProgrammaticMarketGovernance } from "./market-governance";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function reportWithIssues(report: EditorialAuditReport, issues: EditorialAuditReport["issues"]): EditorialAuditReport {
  return {
    ...report,
    issues,
  };
}

export function runProgrammaticMarketDiagnosticSmokeTest(): void {
  const contentNodes = buildEditorialContentNodes();
  const descriptors = buildProgrammaticMarketDescriptors();
  const report = runFullEditorialAudit();
  const reportSnapshot = JSON.stringify(report);
  const descriptorsSnapshot = JSON.stringify(descriptors);
  const contentNodesSnapshot = JSON.stringify(contentNodes);
  const diagnostic = evaluateProgrammaticMarketDiagnostic(report);
  const repeatedDiagnostic = evaluateProgrammaticMarketDiagnostic(report);
  const formatted = formatProgrammaticMarketDiagnostic(diagnostic);
  const orphanIssues = report.issues.filter((issue) => issue.code === "orphan_content_node");
  const nonProgrammaticOrphanSet = new Set(diagnostic.nonProgrammaticEditorialOrphans);
  const marketHubId: ContentNodeId = "content:guide:airbnb-market-intelligence";
  const brokenLeafId: ContentNodeId = "content:ranking:best-airbnb-cities";
  const unaffectedLeafId: ContentNodeId = "content:ranking:best-airbnb-markets";
  const brokenDescriptors = descriptors.map((descriptor) =>
    descriptor.contentNodeId === brokenLeafId
      ? { ...descriptor, scope: { kind: "global", slug: "invalid" } }
      : descriptor
  );
  const brokenInput = {
    descriptors: brokenDescriptors,
    contentNodes,
    rankings,
    reports: marketReports,
    cities,
    countries,
  };
  const brokenGovernance = evaluateProgrammaticMarketGovernance(brokenInput);
  const brokenAudit = auditProgrammaticMarketDescriptors(brokenInput);
  const missingDescriptorGovernance = evaluateProgrammaticMarketGovernance({
    descriptors: descriptors.slice(1),
    contentNodes,
    rankings,
    reports: marketReports,
    cities,
    countries,
  });
  const nonProgrammaticOrphanOnlyReport = reportWithIssues(
    report,
    report.issues.filter(
      (issue) =>
        issue.code !== "orphan_content_node" ||
        !issue.nodeId ||
        (isContentNodeId(issue.nodeId) && nonProgrammaticOrphanSet.has(issue.nodeId))
    )
  );
  const nonProgrammaticOnlyDiagnostic = evaluateProgrammaticMarketDiagnostic(nonProgrammaticOrphanOnlyReport);

  assert(diagnostic.status === "pass", "Programmatic Market diagnostic must pass on the current baseline.");
  assert(diagnostic.auditStatus === "pass", "Programmatic Market diagnostic must expose a passing audit status.");
  assert(diagnostic.leavesTotal === 12, "Programmatic Market diagnostic must see 12 programmatic leaves.");
  assert(diagnostic.governed === 12, "Programmatic Market diagnostic must see 12 governed leaves.");
  assert(diagnostic.notGoverned === 0, "Programmatic Market diagnostic must see no not-governed leaves.");
  assert(diagnostic.rankings === 6, "Programmatic Market diagnostic must see six rankings.");
  assert(diagnostic.reports === 6, "Programmatic Market diagnostic must see six reports.");
  assert(diagnostic.editorialOrphansTotal === orphanIssues.length, "Programmatic Market diagnostic must reuse editorial orphan issues.");
  assert(diagnostic.editorialOrphansTotal === 12, "Current editorial audit baseline must still expose 12 orphans.");
  assert(
    diagnostic.programmaticEditorialOrphans.length === 12,
    "Current baseline must expose 12 programmatic leaves that are still editorial orphans."
  );
  assert(
    diagnostic.governedEditorialOrphans.length === 12,
    "Current baseline must expose 12 governed programmatic leaves that are still editorial orphans."
  );
  assert(
    diagnostic.notGovernedEditorialOrphans.length === 0,
    "Current baseline must expose no not-governed programmatic editorial orphans."
  );
  assert(
    diagnostic.nonProgrammaticEditorialOrphans.length === 0,
    "Current baseline must expose no non-programmatic editorial orphans."
  );
  assert(!diagnostic.notGovernedProgrammaticLeaves.length, "Current baseline must expose no not-governed leaves.");
  assert(
    !diagnostic.programmaticEditorialOrphans.includes(marketHubId),
    "The Market Intelligence hub must not be a programmatic leaf."
  );
  assert(
    !orphanIssues.some((issue) => issue.nodeId === marketHubId),
    "The Market Intelligence hub must not be an editorial orphan."
  );
  assert(
    formatted.includes("Programmatic Market Intelligence") &&
      formatted.includes("Audit: PASS") &&
      formatted.includes("Leaves: 12") &&
      formatted.includes("Other editorial orphans: 0"),
    "Programmatic Market diagnostic formatter must expose the expected summary."
  );
  assert(
    JSON.stringify(diagnostic) === JSON.stringify(repeatedDiagnostic),
    "Programmatic Market diagnostic must be deterministic."
  );

  assert(brokenAudit.status === "fail", "Broken leaf fixture must fail the programmatic audit.");
  assert(brokenGovernance.summary.total === 12, "Broken leaf fixture must keep the same population.");
  assert(brokenGovernance.summary.governed === 11, "Broken leaf fixture must reduce governed by one.");
  assert(brokenGovernance.summary.notGoverned === 1, "Broken leaf fixture must increase notGoverned by one.");
  assert(
    brokenGovernance.entries.find((entry) => entry.contentNodeId === brokenLeafId)?.governed === false,
    "Broken leaf fixture must mark the broken leaf not governed."
  );
  assert(
    brokenGovernance.entries.find((entry) => entry.contentNodeId === unaffectedLeafId)?.governed === true,
    "Broken leaf fixture must leave unrelated leaves governed."
  );
  assert(
    missingDescriptorGovernance.summary.total === 12 &&
      missingDescriptorGovernance.summary.governed === 11 &&
      missingDescriptorGovernance.summary.notGoverned === 1,
    "Missing descriptor fixture must keep population and mark one leaf not governed."
  );
  assert(
      nonProgrammaticOnlyDiagnostic.programmaticEditorialOrphans.length === 0 &&
      nonProgrammaticOnlyDiagnostic.nonProgrammaticEditorialOrphans.length === 0,
    "Editorial/programmatic axes must remain independent when editorial orphan issues change."
  );

  assert(JSON.stringify(report) === reportSnapshot, "Programmatic Market diagnostic must not mutate the editorial report.");
  assert(JSON.stringify(descriptors) === descriptorsSnapshot, "Programmatic Market diagnostic must not mutate descriptors.");
  assert(JSON.stringify(buildEditorialContentNodes()) === contentNodesSnapshot, "Programmatic Market diagnostic must not mutate ContentNodes.");

  console.log("Programmatic Market diagnostic smoke passed.", {
    leaves: diagnostic.leavesTotal,
    governed: diagnostic.governed,
    notGoverned: diagnostic.notGoverned,
    editorialOrphans: diagnostic.editorialOrphansTotal,
    programmaticEditorialOrphans: diagnostic.programmaticEditorialOrphans.length,
    otherEditorialOrphans: diagnostic.nonProgrammaticEditorialOrphans,
  });
}
