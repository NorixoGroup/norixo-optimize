import { NextRequest, NextResponse } from "next/server";

import { applyBacklinkOutreachUnsubscribe, type ApplyBacklinkOutreachUnsubscribeRpcClient } from "@/lib/backlinks/repositories/outreachUnsubscribeRepository";
import { getBacklinkOutreachReplyTokenKeyring } from "@/lib/backlinks/services/outreachReplyCorrelationIdentity";
import {
  confirmHostedUnsubscribe,
  previewHostedUnsubscribe,
} from "@/lib/backlinks/services/outreachUnsubscribeService";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/**
 * Public hosted unsubscribe.
 *
 * GET only renders a confirmation page (no database access, no side effect), so
 * link scanners and prefetchers cannot unsubscribe anyone by visiting the URL.
 * POST performs the unsubscribe. It serves both the confirmation form and the
 * RFC 8058 one-click request that mail clients send to the List-Unsubscribe URL.
 * Neither the token nor any email address is logged or rendered.
 */

const SECURITY_HEADERS: Record<string, string> = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
};

function page(title: string, message: string, form?: { action: string; label: string }): string {
  const control = form
    ? `<form method="post" action="${form.action}"><button type="submit">${form.label}</button></form>`
    : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>${title}</title><style>body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1.25rem;color:#10231f}button{font:inherit;padding:.65rem 1.25rem;border:0;border-radius:.5rem;background:#10231f;color:#fff;cursor:pointer}</style></head><body><h1>${title}</h1><p>${message}</p>${control}</body></html>`;
}

function html(status: number, body: string): NextResponse {
  return new NextResponse(body, { status, headers: SECURITY_HEADERS });
}

export async function GET(_request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const preview = previewHostedUnsubscribe({ getKeyring: getBacklinkOutreachReplyTokenKeyring })(token);
  if (preview.kind === "invalid") {
    return html(404, page("Link not valid", "This unsubscribe link is not valid. If you would like to opt out, reply to the email you received with \"unsubscribe\"."));
  }
  return html(
    200,
    page("Unsubscribe", "Confirm that you no longer want to receive emails from Norixo.", {
      action: "",
      label: "Unsubscribe",
    }),
  );
}

export async function POST(_request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const outcome = await confirmHostedUnsubscribe({
    getKeyring: getBacklinkOutreachReplyTokenKeyring,
    applyUnsubscribe: (input) => applyBacklinkOutreachUnsubscribe(createSupabaseAdminClient() as unknown as ApplyBacklinkOutreachUnsubscribeRpcClient, input),
  })(token);

  if (outcome.kind === "invalid") {
    return html(404, page("Link not valid", "This unsubscribe link is not valid."));
  }
  if (outcome.kind === "unavailable") {
    console.error("[backlinks/unsubscribe] request could not be completed");
    return html(503, page("Temporarily unavailable", "We could not record your request right now. Please try again later or reply to the email with \"unsubscribe\"."));
  }
  return html(200, page("You are unsubscribed", "You will not receive further emails from Norixo."));
}
