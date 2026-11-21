import { NextRequest, NextResponse } from "next/server";

import {
  hasValidBacklinkOutreachLiveAutoSendCronAuthorization,
  isBacklinkOutreachLiveAutoSendBatchCronEnabled,
} from "@/lib/automation/backlink-outreach-live-auto-send-cron-config";
import { runBacklinkOutreachLiveAutoSendBatchCron } from "@/lib/automation/backlink-outreach-live-auto-send-batch-cron-runner";
import { hasValidBacklinkN8nCronAuthorization } from "@/lib/automation/backlink-n8n-cron-authorization";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const environment = {
    CRON_SECRET: process.env.CRON_SECRET,
    BACKLINK_LIVE_AUTO_SEND_BATCH_CRON_ENABLED: process.env.BACKLINK_LIVE_AUTO_SEND_BATCH_CRON_ENABLED,
  };
  const isLegacyAuthorized = hasValidBacklinkOutreachLiveAutoSendCronAuthorization(authorization, environment);
  const isN8nAuthorized = await hasValidBacklinkN8nCronAuthorization(authorization, {
    NORIXO_N8N_CRON_SECRET: process.env.NORIXO_N8N_CRON_SECRET,
  });
  if (!isLegacyAuthorized && !isN8nAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isBacklinkOutreachLiveAutoSendBatchCronEnabled(environment)) {
    return NextResponse.json({ disposition: "disabled" }, { status: 409 });
  }

  try {
    const outcome = await runBacklinkOutreachLiveAutoSendBatchCron(createSupabaseAdminClient(), {
      startedAt: new Date().toISOString(),
    });
    return NextResponse.json(outcome);
  } catch {
    console.error("[automation/backlinks/outreach/live-auto-send-batch/cron] request failed");
    return NextResponse.json({ error: "Unable to run backlink live auto-send batch cron" }, { status: 500 });
  }
}
