export type BacklinkOutreachFollowUpSchedulingPolicyInput = {
  currentAttempt: number;
  maxAttempts: number;
  lastAttemptAt: string | null;
};

export type BacklinkOutreachFollowUpSchedulingPolicyResult =
  | { kind: "none" }
  | { kind: "follow_up"; nextFollowUpAt: string }
  | { kind: "final_response"; responseDeadlineAt: string };

const FINAL_RESPONSE_WINDOW_DAYS = 12;

function addDaysUtc(base: string, days: number): string | null {
  const date = new Date(base);
  if (!Number.isFinite(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function normalizeCount(value: number): number | null {
  return Number.isInteger(value) ? value : null;
}

function validateLastAttemptAt(value: string | null): string | null {
  if (value == null) return null;
  const normalized = value.trim();
  if (!normalized || !Number.isFinite(Date.parse(normalized))) return null;
  return normalized;
}

export function evaluateBacklinkOutreachFollowUpSchedulingPolicy(
  input: BacklinkOutreachFollowUpSchedulingPolicyInput,
): BacklinkOutreachFollowUpSchedulingPolicyResult {
  const currentAttempt = normalizeCount(input.currentAttempt);
  const maxAttempts = normalizeCount(input.maxAttempts);
  const lastAttemptAt = validateLastAttemptAt(input.lastAttemptAt);

  if (
    currentAttempt == null ||
    maxAttempts == null ||
    currentAttempt < 0 ||
    maxAttempts <= 0 ||
    currentAttempt === 0 ||
    lastAttemptAt == null ||
    currentAttempt > maxAttempts
  ) {
    return { kind: "none" };
  }

  if (currentAttempt >= maxAttempts) {
    const responseDeadlineAt = addDaysUtc(lastAttemptAt, FINAL_RESPONSE_WINDOW_DAYS);
    return responseDeadlineAt == null ? { kind: "none" } : { kind: "final_response", responseDeadlineAt };
  }

  const nextFollowUpDays = currentAttempt === 1 ? 5 : 7;
  const nextFollowUpAt = addDaysUtc(lastAttemptAt, nextFollowUpDays);
  return nextFollowUpAt == null ? { kind: "none" } : { kind: "follow_up", nextFollowUpAt };
}

export { FINAL_RESPONSE_WINDOW_DAYS };
