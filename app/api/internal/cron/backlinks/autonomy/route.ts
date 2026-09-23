import { NextRequest, NextResponse } from "next/server";

import {
  createBacklinkAutonomyProductionDependencies,
  runBacklinkAutonomyProductionTick,
  type BacklinkAutonomyProductionDependencies,
} from "@/lib/automation/backlink-autonomy-production-composition";
import { readBacklinkAutonomyRuntimeConfig } from "@/lib/automation/backlink-autonomy-runtime-config";

type CronDependencies = {
  cronSecret: () => string;
  runtimeConfig: typeof readBacklinkAutonomyRuntimeConfig;
  createProductionDependencies: () => BacklinkAutonomyProductionDependencies;
  runTick: typeof runBacklinkAutonomyProductionTick;
  now: () => string;
};

function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/** The only production entrypoint: fixed bounds are owned by the composition, never request input. */
export function createBacklinkAutonomyCronHandler(deps: CronDependencies) {
  return async function GET(request: NextRequest) {
    const secret = deps.cronSecret();
    if (secret.length === 0 || request.headers.get("authorization") !== `Bearer ${secret}`) {
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
      return NextResponse.json(result);
    } catch {
      console.error("[automation/backlinks/autonomy/cron] request failed");
      return NextResponse.json({ error: "Unable to run backlink autonomy cron" }, { status: 500 });
    }
  };
}

export const GET = createBacklinkAutonomyCronHandler({
  cronSecret: () => process.env.CRON_SECRET ?? "",
  runtimeConfig: readBacklinkAutonomyRuntimeConfig,
  createProductionDependencies: createBacklinkAutonomyProductionDependencies,
  runTick: runBacklinkAutonomyProductionTick,
  now: () => new Date().toISOString(),
});
