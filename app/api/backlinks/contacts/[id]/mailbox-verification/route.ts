import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getConfiguredMailboxVerificationProvider } from "@/lib/backlinks/providers/zeroBounceMailboxVerificationProvider";
import { getBacklinkContactById } from "@/lib/backlinks/repositories/contactsRepository";
import { claimMailboxVerificationRequest, completeMailboxVerificationRequest, getCanonicalMailboxVerificationForEmail, getLatestMailboxVerificationRequest, type MailboxVerificationRequest } from "@/lib/backlinks/repositories/mailboxVerificationRequestsRepository";
import { recordMailboxVerificationAndMaybePromote } from "@/lib/backlinks/repositories/mailboxVerificationsRepository";
import { ManualMailboxVerificationError, runManualMailboxVerification } from "@/lib/backlinks/services/manualMailboxVerificationService";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";
import type { Database } from "@/types/database.types";

type RequestContext = { client: SupabaseClient<Database>; user: { id: string; email?: string | null }; workspace: { id: string } };
async function context(request: NextRequest): Promise<RequestContext | "forbidden" | null> {
  const result = await getRequestUserAndWorkspace(request);
  if (result.status === "unauthenticated") return null;
  if (result.status === "workspace_forbidden" || !isAdminPrivateEmail(result.user.email)) return "forbidden";
  return { client: result.client, user: result.user, workspace: result.workspace };
}
function status(error: unknown) {
  if (error instanceof ManualMailboxVerificationError) {
    if (error.code === "MAILBOX_VERIFICATION_PROVIDER_NOT_CONFIGURED") return 409;
    if (error.code.includes("SCOPE_INVALID")) return 404;
    return 422;
  }
  return 500;
}
function safeRequest(row: MailboxVerificationRequest | null) {
  if (row == null) return null;
  return { status: row.status, attemptCount: row.attempt_count, lastResult: row.last_result, lastReason: row.last_reason, startedAt: row.started_at, completedAt: row.completed_at, updatedAt: row.updated_at };
}
function publicError(error: unknown): string {
  if (error instanceof ManualMailboxVerificationError && error.code === "MAILBOX_VERIFICATION_PROVIDER_NOT_CONFIGURED") return "La vérification d’email n’est pas configurée.";
  if (error instanceof ManualMailboxVerificationError && error.code.includes("SCOPE_INVALID")) return "Le contact demandé est introuvable.";
  return "La vérification d’email est temporairement indisponible.";
}
export async function GET(request: NextRequest, contextValue: { params: Promise<{ id: string }> }) {
  const { id } = await contextValue.params; const requestContext = await context(request);
  if (requestContext == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (requestContext === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const [contact, latestRequest] = await Promise.all([getBacklinkContactById(requestContext.client, requestContext.workspace.id, id), getLatestMailboxVerificationRequest(requestContext.client, requestContext.workspace.id, id)]);
    return NextResponse.json({ contact: { status: contact.contact_status, lastVerifiedAt: contact.last_verified_at, eligible: contact.contact_status === "unverified" && contact.email_normalized != null && contact.archived_at == null && contact.do_not_contact_at == null }, request: safeRequest(latestRequest) });
  } catch { return NextResponse.json({ error: "Mailbox verification status unavailable." }, { status: 404 }); }
}
export async function POST(request: NextRequest, contextValue: { params: Promise<{ id: string }> }) {
  const { id } = await contextValue.params; const requestContext = await context(request);
  if (requestContext == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (requestContext === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    await getBacklinkContactById(requestContext.client, requestContext.workspace.id, id);
    const adminClient = createSupabaseAdminClient();
    const result = await runManualMailboxVerification({
      getContact: async (workspaceId, contactId) => {
        try { return await getBacklinkContactById(adminClient, workspaceId, contactId); }
        catch (error) { if (typeof error === "object" && error != null && "code" in error && error.code === "NOT_FOUND") return null; throw error; }
      },
      getProvider: getConfiguredMailboxVerificationProvider,
      claim: (input) => claimMailboxVerificationRequest(adminClient, input),
      complete: (input) => completeMailboxVerificationRequest(adminClient, input),
      getCanonicalVerification: (workspaceId, contactId, emailFingerprint) => getCanonicalMailboxVerificationForEmail(adminClient, workspaceId, contactId, emailFingerprint),
      record: (input) => recordMailboxVerificationAndMaybePromote(adminClient, input),
    }, { workspaceId: requestContext.workspace.id, contactId: id });
    return NextResponse.json(result, { status: result.state === "running" ? 202 : 200 });
  } catch (error) { return NextResponse.json({ error: publicError(error) }, { status: status(error) }); }
}
