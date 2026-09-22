export type BacklinkContactFormPrepareTaskInput = {
  workspaceId: string;
  domainId: string;
  opportunityId: string;
  contactId: string;
  outreachId: string;
  executionKind: "contact_form_worker";
};

export type BacklinkContactFormPrepareTaskResult = {
  outcome: "manual_review";
  outreachId: string;
  reason: "CONTACT_FORM_APPROVAL_REQUIRED";
  queuedRunId: null;
};

/**
 * Contact-form approvals are immutable, human-admin records. The existing
 * Ready service cannot authorize this channel, and the queue contract accepts
 * only a still-draft outreach with such an approval. This task deliberately
 * creates neither; the navigation worker remains the sole executor.
 */
export async function executeBacklinkContactFormPrepareTask(
  input: BacklinkContactFormPrepareTaskInput,
): Promise<BacklinkContactFormPrepareTaskResult> {
  return {
    outcome: "manual_review",
    outreachId: input.outreachId,
    reason: "CONTACT_FORM_APPROVAL_REQUIRED",
    queuedRunId: null,
  };
}
