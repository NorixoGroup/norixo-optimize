import {
  coordinateMailboxVerification,
  type MailboxVerificationCoordinatorDependencies,
  type MailboxVerificationCoordinatorOutcome,
} from "@/lib/backlinks/services/mailboxVerificationCoordinator";
import type { MailboxVerificationProvider } from "@/lib/backlinks/services/mailboxVerificationService";

export type BacklinkMailboxVerificationTaskInput = {
  workspaceId: string;
  domainId: string;
  opportunityId: string;
  contactId: string;
  currentNormalizedEmail: string;
};

export type BacklinkMailboxVerificationTaskDependencies = Omit<MailboxVerificationCoordinatorDependencies, "provider"> & {
  /** Null is a static configuration stop, never a retryable provider call. */
  getProvider: () => MailboxVerificationProvider | null;
};

export type BacklinkMailboxVerificationTaskResult = {
  outcome: "verified" | "terminal";
  status: MailboxVerificationCoordinatorOutcome["status"];
  contactStatus: string | null;
  verificationId: string | null;
  disposition: "created" | "existing" | null;
  reason: string;
  providerCalled: boolean;
};

/** Signals the existing worker retry/backoff/dead-letter lifecycle. */
export class BacklinkMailboxVerificationProviderError extends Error {
  constructor() { super("MAILBOX_VERIFICATION_PROVIDER_ERROR"); }
}

/**
 * This handler has no contact update path. It delegates all persistence and
 * possible status promotion to the canonical mailbox-verification RPC.
 */
export async function executeBacklinkMailboxVerificationTask(
  dependencies: BacklinkMailboxVerificationTaskDependencies,
  input: BacklinkMailboxVerificationTaskInput,
): Promise<BacklinkMailboxVerificationTaskResult> {
  const provider = dependencies.getProvider();
  if (provider == null) {
    return { outcome: "terminal", status: null, contactStatus: null, verificationId: null, disposition: null, reason: "MAILBOX_VERIFICATION_PROVIDER_NOT_CONFIGURED", providerCalled: false };
  }
  const result = await coordinateMailboxVerification({
    getContact: dependencies.getContact,
    provider,
    record: dependencies.record,
    now: dependencies.now,
  }, { workspaceId: input.workspaceId, contactId: input.contactId, currentNormalizedEmail: input.currentNormalizedEmail });
  if (result.kind === "persisted" && result.status === "provider_error") throw new BacklinkMailboxVerificationProviderError();
  const mayProceed = (result.kind === "persisted" && result.status === "deliverable" && result.contactStatus === "verified")
    || (result.kind === "blocked" && result.reason === "MAILBOX_VERIFICATION_CONTACT_ALREADY_VERIFIED" && result.contactStatus === "verified");
  return {
    outcome: mayProceed ? "verified" : "terminal",
    status: result.status,
    contactStatus: result.contactStatus,
    verificationId: result.verificationId,
    disposition: result.disposition,
    reason: result.reason,
    providerCalled: result.kind === "persisted" || result.kind === "conflict" || result.reason === "MAILBOX_VERIFICATION_PROVIDER_INVALID",
  };
}
