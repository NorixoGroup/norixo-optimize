import { formatEditorialAuditReport } from "../lib/knowledge/editorial/audit/format-report";
import { runFullEditorialAudit } from "../lib/knowledge/editorial/audit/full-audit";

try {
  console.log(formatEditorialAuditReport(runFullEditorialAudit()));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
