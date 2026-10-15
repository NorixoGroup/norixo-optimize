import { NextRequest, NextResponse } from "next/server";

import {
  isScheduledDiscoveryEnabled,
  runScheduledBacklinkDiscovery,
  type ScheduledDiscoveryDependencies,
} from "@/lib/automation/backlink-scheduled-discovery";
import { createScheduledDiscoveryProductionDependencies } from "@/lib/automation/backlink-scheduled-discovery-production";

/**
 * Scheduled AI-assisted Brave discovery (Monday, Wednesday, Friday, UTC).
 *
 * NOT registered in vercel.json: scheduling is not activated by this file.
 * To activate later, add a cron entry such as `30 7 * * 1,3,5` (UTC) after
 * confirming the Vercel plan's cron limits, and set
 * BACKLINK_SCHEDULED_DISCOVERY_ENABLED=true. Invocations on other days, or a
 * second invocation for the same UTC date, do nothing.
 */

type CronDependencies = {
  cronSecret: () => string;
  isEnabled: () => boolean;
  createProductionDependencies: () => ScheduledDiscoveryDependencies;
  run: typeof runScheduledBacklinkDiscovery;
  now: () => Date;
};

export function createScheduledDiscoveryCronHandler(deps: CronDependencies) {
  return async function GET(request: NextRequest) {
    const secret = deps.cronSecret();
    if (secret.length === 0 || request.headers.get("authorization") !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Flag OFF: no dependency construction, no reads, no AI call, no writes.
    if (!deps.isEnabled()) {
      return NextResponse.json({ disposition: "disabled", reason: "BACKLINK_SCHEDULED_DISCOVERY_DISABLED" });
    }

    try {
      const result = await deps.run(deps.createProductionDependencies(), { now: deps.now() });
      return NextResponse.json(result);
    } catch {
      console.error("[automation/backlinks/scheduled-discovery] request failed");
      return NextResponse.json({ error: "Unable to run scheduled discovery" }, { status: 500 });
    }
  };
}

export const GET = createScheduledDiscoveryCronHandler({
  cronSecret: () => process.env.CRON_SECRET ?? "",
  isEnabled: () => isScheduledDiscoveryEnabled(),
  createProductionDependencies: createScheduledDiscoveryProductionDependencies,
  run: runScheduledBacklinkDiscovery,
  now: () => new Date(),
});
