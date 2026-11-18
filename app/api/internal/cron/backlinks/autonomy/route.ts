import { NextRequest, NextResponse } from "next/server";

import {
  createBacklinkAutonomyProductionDependencies,
  runBacklinkAutonomyProductionTick,
  type BacklinkAutonomyProductionDependencies,
} from "@/lib/automation/backlink-autonomy-production-composition";
import { readBacklinkAutonomyRuntimeConfig } from "@/lib/automation/backlink-autonomy-runtime-config";
import { hasValidBacklinkN8nCronAuthorization } from "@/lib/automation/backlink-n8n-cron-authorization";
import { BacklinkRepositoryError } from "@/lib/backlinks/repositories/errors";

type CronDependencies = {
  cronSecret: () => string;
  n8nCronSecret?: () => string;
  runtimeConfig: typeof readBacklinkAutonomyRuntimeConfig;
  createProductionDependencies: () => BacklinkAutonomyProductionDependencies;
  runTick: typeof runBacklinkAutonomyProductionTick;
  now: () => string;
};

function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/** Never logs `error.message`: a raw message may carry a query value, a URL, or other unbounded detail. */
function describeCronError(error: unknown): { errorType: string; errorCode: string } {
  if (error instanceof BacklinkRepositoryError) {
    return { errorType: error.name, errorCode: error.code };
  }
  if (error instanceof Error) {
    return { errorType: error.name, errorCode: "UNKNOWN" };
  }
  return { errorType: "non_error", errorCode: "UNKNOWN" };
}

/** The only production entrypoint: fixed bounds are owned by the composition, never request input. */
export function createBacklinkAutonomyCronHandler(deps: CronDependencies) {
  return async function GET(request: NextRequest) {
    const authorization = request.headers.get("authorization");
    const secret = deps.cronSecret();
    const isLegacyAuthorized = secret.length > 0 && authorization === `Bearer ${secret}`;
    const isN8nAuthorized = await hasValidBacklinkN8nCronAuthorization(authorization, {
      NORIXO_N8N_CRON_SECRET: deps.n8nCronSecret?.() ?? "",
    });
    if (!isLegacyAuthorized && !isN8nAuthorized) {
      return unauthorizedResponse();
    }

    // This must precede composition construction: global OFF has no business reads, claims, or writes.
    if (deps.runtimeConfig().autonomyEnabled !== true) {
      return NextResponse.json({ disposition: "disabled", reason: "BACKLINK_AUTONOMY_DISABLED" });
    }

    try {
      const result = await deps.runTick(deps.createProductionDependencies(), {
        at: deps.now(),
        workerId: "norixo-backlink-autonomy-cron",
      });
      if (result.disposition === "completed" && result.runsFailed > 0) {
        // Status stays 200: most runs still completed. This line is what makes a
        // degraded tick operationally visible to log-based monitoring, not just
        // to a caller that happens to inspect the JSON body.
        console.warn("[automation/backlinks/autonomy/cron] degraded tick", {
          runsFailed: result.runsFailed,
          runFailures: result.runFailures,
        });
      }
      return NextResponse.json(result);
    } catch (error) {
      console.error("[automation/backlinks/autonomy/cron] request failed", describeCronError(error));
      return NextResponse.json({ error: "Unable to run backlink autonomy cron" }, { status: 500 });
    }
  };
}

export const GET = createBacklinkAutonomyCronHandler({
  cronSecret: () => process.env.CRON_SECRET ?? "",
  n8nCronSecret: () => process.env.NORIXO_N8N_CRON_SECRET ?? "",
  runtimeConfig: readBacklinkAutonomyRuntimeConfig,
  createProductionDependencies: createBacklinkAutonomyProductionDependencies,
  runTick: runBacklinkAutonomyProductionTick,
  now: () => new Date().toISOString(),
});
