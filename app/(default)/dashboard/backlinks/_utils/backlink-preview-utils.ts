export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readNonEmptyString(record: Record<string, unknown> | null, key: string): string | null {
  if (record === null) return null;
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function readPreviewSelected(record: Record<string, unknown> | null): number {
  if (record === null) return 0;
  const preview = record["preview"];
  if (!isRecord(preview)) return 0;
  const summary = preview["summary"];
  if (!isRecord(summary)) return 0;
  const selected = summary["selected"];
  return typeof selected === "number" && Number.isInteger(selected) && selected > 0 ? selected : 0;
}

export function readPreviewRequestedLimits(record: Record<string, unknown> | null): { maxSelectedOpportunities: number | null; maxPerDomain: number | null } {
  if (record === null) return { maxSelectedOpportunities: null, maxPerDomain: null };
  const preview = record["preview"];
  if (!isRecord(preview)) return { maxSelectedOpportunities: null, maxPerDomain: null };
  const requestedLimits = preview["requestedLimits"];
  if (!isRecord(requestedLimits)) return { maxSelectedOpportunities: null, maxPerDomain: null };
  const m1 = requestedLimits["maxSelectedOpportunities"];
  const m2 = requestedLimits["maxPerDomain"];
  return {
    maxSelectedOpportunities: typeof m1 === "number" && Number.isInteger(m1) ? m1 : null,
    maxPerDomain: typeof m2 === "number" && Number.isInteger(m2) ? m2 : null,
  };
}
