import { timingSafeEqual } from "node:crypto";

export type BacklinkN8nCronEnvironment = {
  NORIXO_N8N_CRON_SECRET?: string;
};

/** Some secret managers display a configured-but-redacted value this way; it must never be trusted as a live secret. */
export const MASKED_BACKLINK_N8N_CRON_SECRET_VALUE = "[SENSITIVE]";

async function digest(value: string): Promise<Buffer> {
  return Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

/**
 * Additive, constant-time check for the alternative n8n cron secret. Never
 * replaces a route's existing CRON_SECRET/BACKLINK_DISCOVERY_CRON_SECRET
 * check — only ORed alongside it. Hashing first gives equal-length buffers,
 * so the comparison leaks neither content nor length.
 */
export async function hasValidBacklinkN8nCronAuthorization(
  authorization: string | null,
  environment: BacklinkN8nCronEnvironment,
): Promise<boolean> {
  const secret = environment.NORIXO_N8N_CRON_SECRET ?? "";
  if (authorization === null || secret.length === 0 || secret === MASKED_BACKLINK_N8N_CRON_SECRET_VALUE) {
    return false;
  }
  return timingSafeEqual(await digest(authorization), await digest(`Bearer ${secret}`));
}
