import { timingSafeEqual } from "node:crypto";

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
 * Invoked by Supabase pg_cron + pg_net, not by vercel.json. Authenticated with a
 * Bearer token equal to BACKLINK_DISCOVERY_CRON_SECRET; CRON_SECRET is still
 * accepted as a temporary fallback. Activation also requires
 * BACKLINK_SCHEDULED_DISCOVERY_ENABLED=true. Invocations on other days, or a
 * second invocation for the same UTC date, do nothing.
 */

type CronDependencies = {
  dedicatedCronSecret: () => string;
  legacyCronSecret: () => string;
  isEnabled: () => boolean;
  createProductionDependencies: () => ScheduledDiscoveryDependencies;
  run: typeof runScheduledBacklinkDiscovery;
  now: () => Date;
};

async function digest(value: string): Promise<Buffer> {
  return Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

/** Hashing first gives equal-length buffers, so the comparison leaks neither content nor length. */
async function matchesSecret(authorization: string | null, secret: string): Promise<boolean> {
  if (authorization === null || secret.length === 0) return false;
  return timingSafeEqual(await digest(authorization), await digest(`Bearer ${secret}`));
}

export function createScheduledDiscoveryCronHandler(deps: CronDependencies) {
  return async function GET(request: NextRequest) {
    const authorization = request.headers.get("authorization");
    // Both secrets are always compared (no short-circuit between them).
    const dedicatedMatch = await matchesSecret(authorization, deps.dedicatedCronSecret());
    const legacyMatch = await matchesSecret(authorization, deps.legacyCronSecret());
    if (!dedicatedMatch && !legacyMatch) {
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
  dedicatedCronSecret: () => process.env.BACKLINK_DISCOVERY_CRON_SECRET ?? "",
  legacyCronSecret: () => process.env.CRON_SECRET ?? "",
  isEnabled: () => isScheduledDiscoveryEnabled(),
  createProductionDependencies: createScheduledDiscoveryProductionDependencies,
  run: runScheduledBacklinkDiscovery,
  now: () => new Date(),
});
