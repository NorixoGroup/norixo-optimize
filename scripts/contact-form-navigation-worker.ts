import { pathToFileURL } from "node:url";

import {
  createPlaywrightChromiumBrowserRuntime,
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

async function main() {
  if (!isContactFormNavigationWorkerEnabled()) {
    console.info("[contact-form-navigation-worker] disabled");
    return;
  }
  const runtime = await createPlaywrightChromiumBrowserRuntime();
  try {
    const result = await executeContactFormNavigationWorkerOnce({
      client: createSupabaseAdminClient(),
      workerId: readWorkerId(),
      browserRuntime: runtime,
      options: {
        allowRealSubmission: isContactFormRealSubmissionEnabled(),
      },
    });
    console.info("[contact-form-navigation-worker] one-shot completed", {
      kind: result.kind,
      runId: "run" in result ? result.run.id : "runId" in result ? result.runId : null,
    });
  } finally {
    await runtime.close?.();
  }
}

if (isMainModule()) {
  main().catch((error) => {
    console.error("[contact-form-navigation-worker] failed", {
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  });
}
