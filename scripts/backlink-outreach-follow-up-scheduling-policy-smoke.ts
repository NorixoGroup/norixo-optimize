import { readFile } from "node:fs/promises";
import { evaluateBacklinkOutreachFollowUpSchedulingPolicy } from "../lib/backlinks/services/outreachFollowUpSchedulingPolicy";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function iso(value: string): string {
  const date = new Date(value);
  return date.toISOString();
}

async function main() {
  const source = await readFile("lib/backlinks/services/outreachFollowUpSchedulingPolicy.ts", "utf8");
  for (const value of [
    "FINAL_RESPONSE_WINDOW_DAYS = 12",
    "evaluateBacklinkOutreachFollowUpSchedulingPolicy",
    "kind: \"follow_up\"",
    "kind: \"final_response\"",
    "kind: \"none\"",
    "lastAttemptAt",
    "currentAttempt",
    "maxAttempts",
  ]) assert(source.includes(value), `Missing policy invariant: ${value}`);
  for (const forbidden of [
    "from(\"",
    ".from(",
    "rpc(",
    "Date.now(",
    "new Date()",
    "next_follow_up_at =",
    "response_deadline_at =",
  ]) assert(!source.includes(forbidden), `Forbidden policy behavior: ${forbidden}`);

  const base = "2026-08-12T10:00:00.000Z";
  const cases = [
    {
      input: { currentAttempt: 1, maxAttempts: 3, lastAttemptAt: base },
      expected: { kind: "follow_up" as const, nextFollowUpAt: "2026-08-17T10:00:00.000Z" },
    },
    {
      input: { currentAttempt: 2, maxAttempts: 3, lastAttemptAt: base },
      expected: { kind: "follow_up" as const, nextFollowUpAt: "2026-08-19T10:00:00.000Z" },
    },
    {
      input: { currentAttempt: 3, maxAttempts: 3, lastAttemptAt: base },
      expected: { kind: "final_response" as const, responseDeadlineAt: "2026-08-24T10:00:00.000Z" },
    },
    {
      input: { currentAttempt: 4, maxAttempts: 5, lastAttemptAt: base },
      expected: { kind: "follow_up" as const, nextFollowUpAt: "2026-08-19T10:00:00.000Z" },
    },
    {
      input: { currentAttempt: 5, maxAttempts: 5, lastAttemptAt: base },
      expected: { kind: "final_response" as const, responseDeadlineAt: "2026-08-24T10:00:00.000Z" },
    },
  ];

  for (const testCase of cases) {
    const actual = evaluateBacklinkOutreachFollowUpSchedulingPolicy(testCase.input);
    assert(JSON.stringify(actual) === JSON.stringify(testCase.expected), `Unexpected policy result for ${JSON.stringify(testCase.input)}`);
  }

  for (const input of [
    { currentAttempt: 0, maxAttempts: 3, lastAttemptAt: base },
    { currentAttempt: 1, maxAttempts: 3, lastAttemptAt: null },
    { currentAttempt: 1, maxAttempts: 3, lastAttemptAt: "invalid" },
    { currentAttempt: -1, maxAttempts: 3, lastAttemptAt: base },
    { currentAttempt: 1, maxAttempts: 0, lastAttemptAt: base },
    { currentAttempt: 6, maxAttempts: 5, lastAttemptAt: base },
  ]) {
    assert(evaluateBacklinkOutreachFollowUpSchedulingPolicy(input).kind === "none", `Invalid input must fail close: ${JSON.stringify(input)}`);
  }

  assert(iso(base) === base, "Smoke sanity: base timestamp must be canonical ISO.");
  console.log("PASS — Backlink outreach follow-up scheduling policy smoke");
}

void main();
