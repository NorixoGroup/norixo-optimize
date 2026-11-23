import { BacklinkRepositoryError } from "@/lib/backlinks/repositories/errors";
import type { BacklinkRepositoryClient } from "@/lib/backlinks/repositories/repositoryClient";
import { getBacklinkContactById } from "@/lib/backlinks/repositories/contactsRepository";

import type {
  BacklinkAutonomyTerminalRunResumeContact,
  BacklinkAutonomyTerminalRunResumeDependencies,
} from "../backlink-autonomy-terminal-run-resume";
import { readBacklinkAutonomyRuntimeConfig } from "../backlink-autonomy-runtime-config";
import { normalizeBacklinkAutonomyRuntimeControl } from "../backlink-autonomy-runtime-controls";
import { isBacklinkCampaignApplyAuthorizationEnabled } from "../backlink-campaign-apply-authorization-config";
import { createOrGetAutomationRun, getAutomationRunById, getAutomationWorkspaceControl } from "./automationRunsRepository";
import { createOrGetAutomationTask } from "./automationTasksRepository";
import { listAutomationTasksForRun } from "./automationRunResumeRepository";

/**
 * BACKLINKS-LIVE-18: wires the LIVE-16 resume mechanism's dependencies to
 * real Supabase calls, almost entirely through the caller's own
 * session-scoped client — never through `createSupabaseAdminClient()`.
 *
 * The ONE sanctioned exception is `campaignApplyAuthorized`: the
 * `is_backlink_campaign_apply_authorized` RPC is revoked from
 * `authenticated` and granted only to `service_role` by design (migration
 * 20261112090000), so a narrow, isolated, read-only admin-client call is
 * used for that single check and for nothing else. That privileged client
 * is never passed to `createOrGetRun`, `createOrGetTask`, `getRun`,
 * `listTasks`, or `getContact` — every write and every other read stays on
 * the session client, fully subject to RLS.
 */

/** Lazily imported so this module stays importable (and test-mockable) without SUPABASE_SERVICE_ROLE_KEY configured. */
async function checkCampaignApplyAuthorizedViaServiceRole(workspaceId: string): Promise<boolean> {
  if (!isBacklinkCampaignApplyAuthorizationEnabled()) return false;
  const [{ createSupabaseAdminClient }, { isBacklinkCampaignApplyAuthorized }] = await Promise.all([
    import("@/lib/supabase-admin"),
    import("./backlinkCampaignApplyAuthorizationCheckRepository"),
  ]);
  return isBacklinkCampaignApplyAuthorized(createSupabaseAdminClient(), workspaceId);
}

/**
 * Both halves of the mandatory double-authorization contract, entirely on
 * the session client: `is_norixo_private_admin()` (granted to
 * `authenticated`, keyed on the caller's own `auth.uid()`) AND a workspace
 * `owner`/`admin` row in `workspace_members` for the exact `requestedBy`
 * identity being checked. Any error from either step fails closed (`false`),
 * never throws — the caller (`resumeBacklinkAutonomyCompletedRun`) also
 * fails closed on a thrown exception, so this is defense in depth, not the
 * only guard.
 */
async function isAuthorizedOperator(
  sessionClient: BacklinkRepositoryClient,
  input: { workspaceId: string; requestedBy: string },
): Promise<boolean> {
  const { data: isPrivateAdmin, error: privateAdminError } = await sessionClient.rpc("is_norixo_private_admin");
  if (privateAdminError != null || isPrivateAdmin !== true) return false;

  const { data: membership, error: membershipError } = await sessionClient
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", input.workspaceId)
    .eq("user_id", input.requestedBy)
    .maybeSingle();
  if (membershipError != null) return false;

  return membership?.role === "owner" || membership?.role === "admin";
}

async function getContact(
  sessionClient: BacklinkRepositoryClient,
  input: { workspaceId: string; contactId: string },
): Promise<BacklinkAutonomyTerminalRunResumeContact | null> {
  try {
    const row = await getBacklinkContactById(sessionClient, input.workspaceId, input.contactId);
    return { id: row.id, workspaceId: row.workspace_id, contactStatus: row.contact_status };
  } catch (error) {
    if (error instanceof BacklinkRepositoryError && error.code === "NOT_FOUND") return null;
    throw error;
  }
}

/**
 * `workspaceId` is resolved once by the route from the authenticated
 * context (never from the request body) and bound here, so `getControl()`
 * — which `resumeBacklinkAutonomyCompletedRun` calls with no arguments —
 * always reads the correct, already-authorized workspace.
 */
export function createBacklinkAutonomyTerminalRunResumeDependencies(
  sessionClient: BacklinkRepositoryClient,
  workspaceId: string,
): BacklinkAutonomyTerminalRunResumeDependencies {
  return {
    getRun: (input) => getAutomationRunById(sessionClient, input),
    listTasks: (input) => listAutomationTasksForRun(sessionClient, input),
    getContact: (input) => getContact(sessionClient, input),
    isAuthorizedOperator: (input) => isAuthorizedOperator(sessionClient, input),
    getControl: async () => {
      const runtime = readBacklinkAutonomyRuntimeConfig();
      const workspace = await getAutomationWorkspaceControl(sessionClient, workspaceId);
      const campaignApplyAuthorized = await checkCampaignApplyAuthorizedViaServiceRole(workspaceId);
      return normalizeBacklinkAutonomyRuntimeControl({ runtime, workspace, campaignApplyAuthorized });
    },
    createOrGetRun: (input) => createOrGetAutomationRun(sessionClient, input),
    createOrGetTask: (input) => createOrGetAutomationTask(sessionClient, input),
  };
}
