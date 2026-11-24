/**
 * Classifies a dispatcher stop without widening any safety gate. A deferred
 * task is returned to the existing bounded retry/backoff lifecycle; all
 * other dispatcher rejections are terminal evidence, not silent success.
 */
export function isBacklinkAutonomyDeferredReason(reason: string): boolean {
  return new Set([
    "MAILBOX_VERIFICATION_PAID_AUTHORIZATION_REQUIRED",
    "BACKLINKS_DISABLED",
    "AUTOMATION_DISABLED_REASON",
    "BACKLINK_AUTONOMY_DISABLED",
    "LIVE_EXECUTION_NOT_AUTHORIZED",
  ]).has(reason);
}

export function terminalBacklinkAutonomyOutput(disposition: "rejected" | "terminal", reasonCodes: readonly string[]) {
  return { version: 1, terminal: true, disposition, reasonCodes: [...reasonCodes] };
}
