import { pathToFileURL } from "node:url";

import {
  executeContactFormNavigationWorkerOnce,
  isContactFormNavigationWorkerEnabled,
  isContactFormRealSubmissionEnabled,
} from "../lib/backlinks/services/contactFormNavigationWorker";
import { createSupabaseAdminClient } from "../lib/supabase-admin";

function isMainModule() {
  return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
}

function readWorkerId() {
  return process.env.CONTACT_FORM_NAVIGATION_WORKER_ID?.trim() || crypto.randomUUID();
}

function readTargetRunId() {
  return process.env.CONTACT_FORM_TARGET_RUN_ID?.trim() || undefined;
}

async function main() {
  if (!isContactFormNavigationWorkerEnabled()) {
    console.info("[contact-form-navigation-worker] disabled");
    return;
  }
  const result = await executeContactFormNavigationWorkerOnce({
    client: createSupabaseAdminClient(),
    workerId: readWorkerId(),
    options: {
      allowRealSubmission: isContactFormRealSubmissionEnabled(),
      targetRunId: readTargetRunId(),
    },
  });
  console.info("[contact-form-navigation-worker] one-shot completed", {
    kind: result.kind,
    runId: "run" in result ? result.run.id : "runId" in result ? result.runId : null,
  });
}

if (isMainModule()) {
  main().catch((error) => {
    console.error("[contact-form-navigation-worker] failed", {
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  });
}
