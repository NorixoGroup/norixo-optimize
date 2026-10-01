/**
 * Read-only lookup against the A1 workspace suppression table. The table is not part of
 * the generated Database types yet, so a minimal structural client type is used.
 */
export type BacklinkEmailSuppressionReadClient = {
  from(table: "backlink_email_suppressions"): {
    select(columns: "id"): {
      eq(column: "workspace_id", value: string): {
        eq(column: "email_normalized", value: string): {
          limit(count: number): PromiseLike<{ data: unknown[] | null; error: unknown }>;
        };
      };
    };
  };
};

/** Canonical identity used by the suppression table and its triggers: lower(btrim(email)). */
export function normalizeBacklinkSuppressionEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Authoritative suppression lookup. It never swallows a failure: any error or malformed
 * response throws so the caller can fail closed.
 */
export async function isBacklinkEmailSuppressed(
  client: BacklinkEmailSuppressionReadClient,
  workspaceId: string,
  email: string,
): Promise<boolean> {
  const workspace = workspaceId.trim();
  const normalized = normalizeBacklinkSuppressionEmail(email);
  if (!workspace || !normalized) throw new Error("BACKLINK_SUPPRESSION_LOOKUP_INVALID");
  const { data, error } = await client
    .from("backlink_email_suppressions")
    .select("id")
    .eq("workspace_id", workspace)
    .eq("email_normalized", normalized)
    .limit(1);
  if (error != null) throw new Error("BACKLINK_SUPPRESSION_LOOKUP_FAILED");
  if (!Array.isArray(data)) throw new Error("BACKLINK_SUPPRESSION_LOOKUP_INVALID");
  return data.length > 0;
}
