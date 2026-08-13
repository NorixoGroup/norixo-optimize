import { formatEditorialAuditReport } from "../lib/knowledge/editorial/audit/format-report";
import { runFullEditorialAudit } from "../lib/knowledge/editorial/audit/full-audit";
import {
  evaluateProgrammaticMarketDiagnostic,
  formatProgrammaticMarketDiagnostic,
} from "../lib/knowledge/editorial/programmatic/market-diagnostic";
import {
  classifyEditorialOrphansWithProgrammaticGovernance,
  formatProgrammaticEditorialOrphanClassification,
} from "../lib/knowledge/editorial/programmatic/orphan-classification";

try {
  const report = runFullEditorialAudit();
  const programmaticMarketDiagnostic = evaluateProgrammaticMarketDiagnostic(report);
  const orphanClassification = classifyEditorialOrphansWithProgrammaticGovernance(programmaticMarketDiagnostic);

  console.log(
    [
      formatEditorialAuditReport(report),
      formatProgrammaticMarketDiagnostic(programmaticMarketDiagnostic),
      formatProgrammaticEditorialOrphanClassification(orphanClassification),
    ].join("\n\n")
  );
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
