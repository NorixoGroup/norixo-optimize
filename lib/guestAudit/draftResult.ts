/**
 * A restored guest draft may be shown as an audit preview only when it carries a real numeric score. Drafts created
 * today never do (the guest audit is disabled), so no score, signal count or priority count is ever invented for them.
 */
export function draftHasRealResult(draft: {
  full_payload?: unknown;
  preview_payload?: unknown;
  result?: { raw_payload?: unknown } | null;
}): boolean {
  const candidate = draft.full_payload ?? draft.preview_payload ?? draft.result?.raw_payload ?? null;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return false;
  const score = (candidate as { score?: unknown }).score;
  return typeof score === "number" && Number.isFinite(score);
}
