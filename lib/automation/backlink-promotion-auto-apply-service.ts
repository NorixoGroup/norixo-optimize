import { BacklinkPromotionAutoApplyRepositoryError } from "./backlink-promotion-auto-apply-types";
import type { BacklinkPromotionAutoApplyTaskRecord } from "./repositories/backlinkPromotionAutoApplyCandidatesRepository";

export type BacklinkPromotionAutoApplyCandidate = {
  runId: string;
  promotionTaskId: string;
  proposalKey: string;
};

export type BacklinkPromotionAutoApplyOutcome = {
  workspaceId: string;
  outcome: "applied" | "no_eligible_candidate" | "rejected" | "disabled";
  applicationId: string | null;
  reason: string | null;
};

export type BacklinkPromotionAutoApplyDependencies = {
  listCompletedPromotionPreviewTasks: (
    workspaceId: string,
    limit: number,
  ) => Promise<readonly BacklinkPromotionAutoApplyTaskRecord[]>;
  applyProposal: (input: {
    workspaceId: string;
    runId: string;
    promotionTaskId: string;
    proposalKey: string;
  }) => Promise<{ applicationId: string }>;
};

function isEligibleLookingProposal(value: unknown): value is { proposalKey: string } {
  if (typeof value !== "object" || value === null) return false;
  const proposal = value as Record<string, unknown>;
  return (
    proposal.promotionDecision === "propose" &&
    proposal.priority === "Tier A" &&
    proposal.qualificationConfidence === "medium" &&
    typeof proposal.proposalKey === "string" &&
    proposal.proposalKey.length > 0 &&
    typeof proposal.suggestedAssetKey === "string" &&
    proposal.suggestedAssetKey.length > 0
  );
}

/**
 * Best-effort local prefilter only — never authoritative. The RPC itself
 * re-derives and re-validates every eligibility fact from canonical storage;
 * this only avoids attempting proposals that are obviously not Tier A.
 */
function extractCandidates(task: BacklinkPromotionAutoApplyTaskRecord): BacklinkPromotionAutoApplyCandidate[] {
  if (typeof task.output !== "object" || task.output === null) return [];
  const proposals = (task.output as Record<string, unknown>).proposals;
  if (!Array.isArray(proposals)) return [];
  return proposals
    .filter(isEligibleLookingProposal)
    .map((proposal) => ({ runId: task.runId, promotionTaskId: task.id, proposalKey: proposal.proposalKey }));
}

function errorCode(error: unknown): string | null {
  return error instanceof BacklinkPromotionAutoApplyRepositoryError ? error.code : null;
}

/**
 * At most one application per workspace is ever attempted to succeed per
 * call: the function returns as soon as one candidate is applied. The
 * per-workspace-per-day cap is independently and authoritatively enforced
 * by the RPC itself (PROMOTION_AUTO_APPLY_WORKSPACE_LIMIT_REACHED); this is
 * only a matching, non-authoritative short-circuit in the caller.
 */
export async function runBacklinkPromotionAutoApplyForWorkspace(
  deps: BacklinkPromotionAutoApplyDependencies,
  input: { workspaceId: string; taskLimit: number },
): Promise<BacklinkPromotionAutoApplyOutcome> {
  const tasks = await deps.listCompletedPromotionPreviewTasks(input.workspaceId, input.taskLimit);
  for (const task of tasks) {
    if (task.taskKind !== "backlinks.promotion.preview" || task.status !== "completed") continue;
    for (const candidate of extractCandidates(task)) {
      try {
        const result = await deps.applyProposal({
          workspaceId: input.workspaceId,
          runId: candidate.runId,
          promotionTaskId: candidate.promotionTaskId,
          proposalKey: candidate.proposalKey,
        });
        return { workspaceId: input.workspaceId, outcome: "applied", applicationId: result.applicationId, reason: null };
      } catch (error) {
        const code = errorCode(error);
        if (code === "PROMOTION_AUTO_APPLY_NOT_AUTHORIZED" || code === "PROMOTION_AUTO_APPLY_AUTHORIZATION_STALE") {
          // Every other candidate in this workspace would fail the same
          // live admin-rights check, so there is nothing to gain from
          // trying another one.
          return { workspaceId: input.workspaceId, outcome: "disabled", applicationId: null, reason: code };
        }
        if (code === "PROMOTION_AUTO_APPLY_WORKSPACE_LIMIT_REACHED") {
          return { workspaceId: input.workspaceId, outcome: "rejected", applicationId: null, reason: code };
        }
        // Any other rejection (ineligible at the authoritative layer, a
        // sibling conflict, an unknown asset, ...) is specific to this one
        // candidate: try the next one rather than aborting the workspace.
        continue;
      }
    }
  }
  return { workspaceId: input.workspaceId, outcome: "no_eligible_candidate", applicationId: null, reason: null };
}

export type BacklinkPromotionAutoApplyTickDependencies = BacklinkPromotionAutoApplyDependencies & {
  listWorkspaces: (limit: number) => Promise<readonly { workspaceId: string }[]>;
};

export async function runBacklinkPromotionAutoApplyTick(
  deps: BacklinkPromotionAutoApplyTickDependencies,
  input: { workspaceLimit: number; taskLimitPerWorkspace: number },
): Promise<readonly BacklinkPromotionAutoApplyOutcome[]> {
  const workspaces = (await deps.listWorkspaces(input.workspaceLimit)).slice().sort((a, b) => a.workspaceId.localeCompare(b.workspaceId));
  const results: BacklinkPromotionAutoApplyOutcome[] = [];
  for (const workspace of workspaces) {
    results.push(
      await runBacklinkPromotionAutoApplyForWorkspace(deps, {
        workspaceId: workspace.workspaceId,
        taskLimit: input.taskLimitPerWorkspace,
      }),
    );
  }
  return results;
}
