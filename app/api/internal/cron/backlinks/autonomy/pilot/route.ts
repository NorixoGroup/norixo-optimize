import { NextRequest, NextResponse } from "next/server";
import { createBacklinkAutonomyIgmsPilotProductionDependencies } from "@/lib/automation/backlink-autonomy-production-composition";
import { runBacklinkAutonomyIgmsPilot } from "@/lib/automation/backlink-autonomy-igms-pilot";
import { readBacklinkAutonomyIgmsPilotRuntimeConfig } from "@/lib/automation/backlink-autonomy-igms-pilot-runtime-config";

/** Manual-only endpoint. It is intentionally absent from vercel.json. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length === 0 || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const config = readBacklinkAutonomyIgmsPilotRuntimeConfig();
  // Fail before constructing database adapters whenever the explicit pilot contract is incomplete.
  if (config.enabled !== true || config.promotionApplicationId == null) {
    return NextResponse.json({ disposition: "disabled", reason: "IGMS_PILOT_CONFIGURATION_REQUIRED" });
  }
  try {
    return NextResponse.json(await runBacklinkAutonomyIgmsPilot(createBacklinkAutonomyIgmsPilotProductionDependencies(), { config, at: new Date().toISOString(), workerId: "norixo-backlink-autonomy-igms-pilot" }));
  } catch {
    console.error("[automation/backlinks/autonomy/pilot] request failed");
    return NextResponse.json({ error: "Unable to run isolated backlink pilot" }, { status: 500 });
  }
}
