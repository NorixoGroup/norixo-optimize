export type BacklinkContactFormPrepareTaskInput = {
  workspaceId: string;
  domainId: string;
  opportunityId: string;
  contactId: string;
  outreachId: string;
  executionKind: "contact_form_worker";
};

export type BacklinkContactFormPrepareTaskResult =
  | {
      outcome: "manual_review";
      outreachId: string;
      reason: "CONTACT_FORM_APPROVAL_REQUIRED" | "CONTACT_FORM_APPROVAL_INVALID";
      queuedRunId: null;
    }
  | {
      outcome: "queued";
      outreachId: string;
      reason: null;
      queuedRunId: string;
    };

export type BacklinkContactFormPrepareTaskDependencies = {
  getLatestApprovalCandidate: (input: {
    workspaceId: string;
    outreachId: string;
  }) => Promise<{ id: string } | null>;

  queueExistingApproval: (input: {
    workspaceId: string;
    outreachId: string;
    approvalId: string;
  }) => Promise<{ run_id: string; disposition: string; state: string }>;
};

/**
 * Autonomous bridge only.
 *
 * It may reuse an approval previously created through the human approval
 * boundary. It MUST NOT create, mutate, synthesize, or infer an approval.
 * queue_backlink_contact_form_run_v1 remains the final authority for
 * verification freshness, approval fingerprint freshness, outreach state,
 * suppression rules, and live-run idempotency.
 */
export async function executeBacklinkContactFormPrepareTask(
  deps: BacklinkContactFormPrepareTaskDependencies,
  input: BacklinkContactFormPrepareTaskInput,
): Promise<BacklinkContactFormPrepareTaskResult> {
  const approval = await deps.getLatestApprovalCandidate({
    workspaceId: input.workspaceId,
    outreachId: input.outreachId,
  });

  if (approval == null) {
    return {
      outcome: "manual_review",
      outreachId: input.outreachId,
      reason: "CONTACT_FORM_APPROVAL_REQUIRED",
      queuedRunId: null,
    };
  }

  try {
    const queued = await deps.queueExistingApproval({
      workspaceId: input.workspaceId,
      outreachId: input.outreachId,
      approvalId: approval.id,
    });

    return {
      outcome: "queued",
      outreachId: input.outreachId,
      reason: null,
      queuedRunId: queued.run_id,
    };
  } catch {
    return {
      outcome: "manual_review",
      outreachId: input.outreachId,
      reason: "CONTACT_FORM_APPROVAL_INVALID",
      queuedRunId: null,
    };
  }
}
