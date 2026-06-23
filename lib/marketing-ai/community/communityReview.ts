import type { CommunityWorkspace } from "./communityWorkspace";

function normalizeDateString(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function resolveNow() {
  return new Date().toISOString();
}

function resolveReviewDate(reviewedAt?: string) {
  return reviewedAt && normalizeDateString(reviewedAt)
    ? normalizeDateString(reviewedAt) ?? resolveNow()
    : resolveNow();
}

export function markCommunityReadyForReview(
  workspace: CommunityWorkspace,
): CommunityWorkspace {
  const now = resolveNow();

  return {
    ...workspace,
    status: "ready_for_review",
    approvalRequired: true,
    history: [
      ...workspace.history,
      {
        type: "ready_for_review",
        message: "Community workspace marked ready for review.",
        createdAt: now,
      },
    ],
    updatedAt: now,
  };
}

export function approveCommunityWorkspace(
  workspace: CommunityWorkspace,
  reviewedAt?: string,
): CommunityWorkspace {
  const now = resolveNow();
  const reviewDate = resolveReviewDate(reviewedAt);

  return {
    ...workspace,
    status: "approved",
    approvalRequired: true,
    history: [
      ...workspace.history,
      {
        type: "approved",
        message: "Community workspace approved.",
        createdAt: reviewDate,
      },
    ],
    updatedAt: now,
  };
}

export function rejectCommunityWorkspace(
  workspace: CommunityWorkspace,
  reason: string,
): CommunityWorkspace {
  const now = resolveNow();
  const trimmedReason = reason.trim();

  return {
    ...workspace,
    status: "rejected",
    approvalRequired: true,
    notes: trimmedReason ? [...workspace.notes, trimmedReason] : workspace.notes,
    history: [
      ...workspace.history,
      {
        type: "rejected",
        message: trimmedReason || "Community workspace rejected.",
        createdAt: now,
      },
    ],
    updatedAt: now,
  };
}

export function resetCommunityWorkspaceToDraft(
  workspace: CommunityWorkspace,
): CommunityWorkspace {
  const now = resolveNow();

  return {
    ...workspace,
    status: "draft",
    approvalRequired: true,
    history: [
      ...workspace.history,
      {
        type: "updated",
        message: "Community workspace reset to draft.",
        createdAt: now,
      },
    ],
    updatedAt: now,
  };
}
