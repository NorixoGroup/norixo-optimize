import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260918103000_fix_backlink_follow_up_accepted_current_attempt_return_type.sql",
  "utf8",
);

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(
  migration.includes(
    "create or replace function public.apply_backlink_outreach_follow_up_accepted(",
  ),
  "Accepted RPC must be recreated.",
);

assert(
  migration.includes("current_attempt integer"),
  "RPC contract must remain integer.",
);

const casts =
  migration.match(/outreach\.current_attempt::integer/g) ?? [];

assert(
  casts.length === 2,
  `Expected exactly 2 current_attempt integer casts, got ${casts.length}.`,
);

assert(
  migration.includes(
    "attempt.status not in ('requested', 'unknown', 'accepted')",
  ),
  "Accepted reconciliation states must be preserved.",
);

assert(
  migration.includes(
    "FOLLOW_UP_ACCEPTED_RECONCILIATION_CONFLICT",
  ),
  "Accepted reconciliation conflict guard must be preserved.",
);

assert(
  migration.includes("'follow_up_accepted'"),
  "Lifecycle effect must be preserved.",
);

assert(
  migration.includes("to service_role;"),
  "RPC must remain service_role only.",
);

console.log("PASS — follow-up accepted RPC return type smoke");
