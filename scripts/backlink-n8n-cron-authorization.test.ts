import assert from "node:assert/strict";
import test from "node:test";

import {
  MASKED_BACKLINK_N8N_CRON_SECRET_VALUE,
  hasValidBacklinkN8nCronAuthorization,
} from "@/lib/automation/backlink-n8n-cron-authorization";

test("n8n cron auth: the exact configured Bearer secret is accepted", async () => {
  assert.equal(
    await hasValidBacklinkN8nCronAuthorization("Bearer s3cret", { NORIXO_N8N_CRON_SECRET: "s3cret" }),
    true,
  );
});

test("n8n cron auth: a mismatched secret is refused", async () => {
  assert.equal(
    await hasValidBacklinkN8nCronAuthorization("Bearer wrong", { NORIXO_N8N_CRON_SECRET: "s3cret" }),
    false,
  );
});

test("n8n cron auth: a near-miss secret (prefix/suffix) is refused, not just an exact string mismatch", async () => {
  assert.equal(
    await hasValidBacklinkN8nCronAuthorization("Bearer s3cret-extra", { NORIXO_N8N_CRON_SECRET: "s3cret" }),
    false,
  );
  assert.equal(
    await hasValidBacklinkN8nCronAuthorization("Bearer s3cre", { NORIXO_N8N_CRON_SECRET: "s3cret" }),
    false,
  );
});

test("n8n cron auth: a missing Authorization header is refused", async () => {
  assert.equal(await hasValidBacklinkN8nCronAuthorization(null, { NORIXO_N8N_CRON_SECRET: "s3cret" }), false);
});

test("n8n cron auth: the Bearer scheme is required (raw secret alone is refused)", async () => {
  assert.equal(await hasValidBacklinkN8nCronAuthorization("s3cret", { NORIXO_N8N_CRON_SECRET: "s3cret" }), false);
});

test("n8n cron auth: an unconfigured secret never authorizes, even against an empty bearer", async () => {
  assert.equal(await hasValidBacklinkN8nCronAuthorization("Bearer ", {}), false);
  assert.equal(await hasValidBacklinkN8nCronAuthorization("Bearer ", { NORIXO_N8N_CRON_SECRET: "" }), false);
  assert.equal(await hasValidBacklinkN8nCronAuthorization(null, {}), false);
});

test("n8n cron auth: a masked secret value is refused, never treated as a live secret", async () => {
  assert.equal(
    await hasValidBacklinkN8nCronAuthorization(`Bearer ${MASKED_BACKLINK_N8N_CRON_SECRET_VALUE}`, {
      NORIXO_N8N_CRON_SECRET: MASKED_BACKLINK_N8N_CRON_SECRET_VALUE,
    }),
    false,
  );
});

test("n8n cron auth: comparison is case-sensitive", async () => {
  assert.equal(
    await hasValidBacklinkN8nCronAuthorization("bearer s3cret", { NORIXO_N8N_CRON_SECRET: "s3cret" }),
    false,
  );
});
