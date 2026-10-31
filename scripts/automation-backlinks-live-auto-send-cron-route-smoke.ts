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

    // G4-M1: with the flag enabled, both workspaceId and outreachId are mandatory query
    // parameters, rejected with 400 before any Supabase client is constructed.
    process.env.BACKLINK_LIVE_AUTO_SEND_CRON_ENABLED = "true";
    const authHeader = { authorization: "Bearer local-cron-route-test-secret" };
    const missingBoth = await GET(new NextRequest(
      "http://localhost/api/internal/cron/backlinks/outreach/send-one",
      { headers: authHeader },
    ));
    assert(missingBoth.status === 400, "Missing workspaceId and outreachId must be rejected.");

    const missingOutreachId = await GET(new NextRequest(
      "http://localhost/api/internal/cron/backlinks/outreach/send-one?workspaceId=550e8400-e29b-41d4-a716-4466554400aa",
      { headers: authHeader },
    ));
    assert(missingOutreachId.status === 400, "Missing outreachId must be rejected even with a valid workspaceId.");

    const malformed = await GET(new NextRequest(
      "http://localhost/api/internal/cron/backlinks/outreach/send-one?workspaceId=550e8400-e29b-41d4-a716-4466554400aa&outreachId=BL-OUT-2026-019",
      { headers: authHeader },
    ));
    assert(malformed.status === 400, "A non-UUID outreachId (e.g. a business key) must be rejected.");
  } finally {
    if (originalSecret == null) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
    if (originalEnabled == null) delete process.env.BACKLINK_LIVE_AUTO_SEND_CRON_ENABLED;
    else process.env.BACKLINK_LIVE_AUTO_SEND_CRON_ENABLED = originalEnabled;
  }

  console.log("PASS — Automation backlinks live auto-send cron route smoke");
}

void main();
