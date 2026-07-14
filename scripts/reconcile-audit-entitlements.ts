import {
  executeReconcileAuditEntitlements,
  formatReconcileAuditEntitlementsReport,
  parseReconcileAuditEntitlementsArgs,
} from "../lib/billing/reconcileAuditEntitlements";

async function main() {
  const options = parseReconcileAuditEntitlementsArgs(process.argv.slice(2));
  const result = await executeReconcileAuditEntitlements(options);
  console.log(formatReconcileAuditEntitlementsReport(result));

  if (result.exitCode !== 0) {
    process.exit(result.exitCode);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
