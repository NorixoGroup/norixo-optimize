import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function main(): Promise<void> {
  const route = await readFile(
    "app/api/internal/automation/backlinks/reverification/route.ts",
    "utf8",
  );
  const config = await readFile(
    "lib/backlinks/verification/reverification-config.ts",
    "utf8",
  );
  const automation = await readFile(
    "lib/backlinks/verification/reverification-automation.ts",
    "utf8",
  );
  const producer = await readFile(
    "lib/backlinks/verification/reverification-producer.ts",
    "utf8",
  );
  const scheduled = await readFile(
    "lib/backlinks/verification/scheduled-job-factory.ts",
    "utf8",
  );

  for (const required of [
    "export async function POST(request: NextRequest)",
    "authenticateInternalRequest",
    "CRON_SECRET",
    "isAdminPrivateEmail",
    "createRequestSupabaseClient(request)",
    "createSupabaseAdminClient()",
    "runBacklinkReverificationAutomation",
    "readBacklinkReverificationRuntimeConfig",
    "listAutomationWorkspaceControlsForBacklinkReverification",
    "listBacklinkReverificationCandidates",
    "getBacklinkVerificationJobByKey",
    "createBacklinkVerificationJob",
    "BACKLINK_REVERIFICATION_ENABLED",
    "BACKLINK_REVERIFICATION_CADENCE_DAYS",
    "runBacklinkReverificationProducer",
    "scheduled:",
    "triggerSource: \"scheduler\"",
  ]) {
    assert(
      route.includes(required) ||
        config.includes(required) ||
        automation.includes(required) ||
        producer.includes(required) ||
        scheduled.includes(required),
      `Missing ${required}`,
    );
  }

  for (const forbidden of ["vercel.json", "recovery", "send-one"]) {
    assert(
      !route.includes(forbidden) &&
        !automation.includes(forbidden) &&
        !producer.includes(forbidden),
      `Forbidden ${forbidden}`,
    );
  }

  console.log("PASS — Backlink reverification route smoke");
}

void main();
