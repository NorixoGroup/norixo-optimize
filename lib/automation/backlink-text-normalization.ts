/**
 * Safe text truncation for discovery output.
 *
 * Downstream validators (qualification, promotion) require text that equals its own `trim()`.
 * `String.prototype.slice` can cut right after a space, or between the two halves of a
 * surrogate pair, so truncation must be followed by a trim and must never leave a lone surrogate.
 */

export const DISCOVERY_TITLE_MAX_LENGTH = 300;
export const DISCOVERY_SNIPPET_MAX_LENGTH = 500;
export const DISCOVERY_EVIDENCE_MAX_LENGTH = 500;

/**
 * Truncates to at most `maxLength` UTF-16 units, never ends on an isolated high surrogate,
 * then trims. Text that is already valid (trimmed and within the limit) is returned unchanged.
 * Idempotent: truncateCleanText(truncateCleanText(x, n), n) === truncateCleanText(x, n).
 */
export function truncateCleanText(value: string, maxLength: number): string {
  if (!Number.isInteger(maxLength) || maxLength < 0) {
    throw new Error("maxLength must be a non-negative integer");
  }
  let cut = value.length > maxLength ? value.slice(0, maxLength) : value;
  if (cut.length > 0) {
    const last = cut.charCodeAt(cut.length - 1);
    if (last >= 0xd800 && last <= 0xdbff) {
      cut = cut.slice(0, -1);
    }
  }
  return cut.trim();
}

function normalizeOptionalText(value: string | null, maxLength: number): string | null {
  if (value === null) return null;
  const normalized = truncateCleanText(value, maxLength);
  return normalized.length === 0 ? null : normalized;
}

/**
 * Read-side repair for persisted discovery candidates produced before truncation was trimmed.
 * It only re-applies truncate-then-trim to the three free-text fields; it never changes
 * identity, URL or scoring fields, and it does not weaken any downstream validator, which
 * still validates the normalized value strictly. The persisted discovery output is not modified.
 */
export function normalizeDiscoveryCandidateText<
  T extends { pageTitle: string | null; snippet: string | null; evidenceSummary: string },
>(candidate: T): T {
  return {
    ...candidate,
    pageTitle: normalizeOptionalText(candidate.pageTitle, DISCOVERY_TITLE_MAX_LENGTH),
    snippet: normalizeOptionalText(candidate.snippet, DISCOVERY_SNIPPET_MAX_LENGTH),
    evidenceSummary: truncateCleanText(candidate.evidenceSummary, DISCOVERY_EVIDENCE_MAX_LENGTH),
  };
}
