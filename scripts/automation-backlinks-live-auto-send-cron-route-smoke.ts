import { NextRequest } from "next/server";

import { GET } from "../app/api/internal/cron/backlinks/outreach/send-one/route";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main(): Promise<void> {
  const originalSecret = process.env.CRON_SECRET;
  const originalEnabled = process.env.BACKLINK_LIVE_AUTO_SEND_CRON_ENABLED;
  try {
    process.env.CRON_SECRET = "local-cron-route-test-secret";
    delete process.env.BACKLINK_LIVE_AUTO_SEND_CRON_ENABLED;

    const unauthorized = await GET(new NextRequest("http://localhost/api/internal/cron/backlinks/outreach/send-one"));
    assert(unauthorized.status === 401, "A public request without cron authorization must be rejected.");

    const disabled = await GET(new NextRequest(
      "http://localhost/api/internal/cron/backlinks/outreach/send-one",
      { headers: { authorization: "Bearer local-cron-route-test-secret" } },
    ));
    assert(disabled.status === 409, "A valid cron caller must still be blocked while the explicit activation flag is absent.");
    const payload = await disabled.json() as { error?: string };
    assert(payload.error === "Backlink live auto-send cron is disabled", "Disabled response must not expose configuration details.");
  } finally {
    if (originalSecret == null) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
    if (originalEnabled == null) delete process.env.BACKLINK_LIVE_AUTO_SEND_CRON_ENABLED;
    else process.env.BACKLINK_LIVE_AUTO_SEND_CRON_ENABLED = originalEnabled;
  }

  console.log("PASS — Automation backlinks live auto-send cron route smoke");
}

void main();
