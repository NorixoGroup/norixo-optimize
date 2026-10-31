import { readFile } from "node:fs/promises";

import type {
  BacklinkOutreachEmailSendDependencies,
} from "../lib/backlinks/services/outreachEmailSendService";
import {
  BacklinkOutreachEmailSendError,
  sendBacklinkOutreachEmail,
  type BacklinkOutreachEmailSendResult,
} from "../lib/backlinks/services/outreachEmailSendService";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

/**
 * Every dependency "poisons" itself: if G4-M2's immediate refusal were ever weakened or
 * removed, the very first dependency call would throw a distinct, easily attributable error —
 * not a silent pass. This is the structural proof that no lookup, reservation, or provider call
 * can happen, not just that the test never observed one.
 */
function poisonedDependencies(): BacklinkOutreachEmailSendDependencies {
  const poison = (name: string) => {
    throw new Error(`POISON: ${name} must never be called — the legacy send path is permanently disabled (G4-M2).`);
  };
  return {
    eligibility: {
      getMembership: async () => poison("eligibility.getMembership"),
      getOpportunity: async () => poison("eligibility.getOpportunity"),
      listContactsByDomain: async () => poison("eligibility.listContactsByDomain"),
      listOutreachByOpportunity: async () => poison("eligibility.listOutreachByOpportunity"),
    } as unknown as BacklinkOutreachEmailSendDependencies["eligibility"],
    getWorkspaceControl: async () => poison("getWorkspaceControl"),
    getOutreach: async () => poison("getOutreach"),
    getContact: async () => poison("getContact"),
    listAttemptSummariesSince: async () => poison("listAttemptSummariesSince"),
    getAttemptByIdempotencyKey: async () => poison("getAttemptByIdempotencyKey"),
    getOpenAttemptForOutreach: async () => poison("getOpenAttemptForOutreach"),
    updateOutreach: async () => poison("updateOutreach"),
    reserveAttempt: async () => poison("reserveAttempt"),
    markAttemptAccepted: async () => poison("markAttemptAccepted"),
    markAttemptFailed: async () => poison("markAttemptFailed"),
    markAttemptUnknown: async () => poison("markAttemptUnknown"),
    sendEmail: async () => poison("sendEmail (the fake provider)"),
    activateOutreach: async () => poison("activateOutreach"),
    inboundReplyDomain: "inbound.norixo.io",
    replyTokenKeyring: { activeKeyVersion: "v1", secrets: { v1: "service-smoke-secret" } },
    createAttemptId: () => poison("createAttemptId"),
    now: () => poison("now"),
  } as unknown as BacklinkOutreachEmailSendDependencies;
}

const INPUTS = [
  { label: "well-formed input", input: { workspaceId: "workspace", actorUserId: "actor", outreachId: "outreach", idempotencyKey: "key" } },
  { label: "empty idempotency key", input: { workspaceId: "workspace", actorUserId: "actor", outreachId: "outreach", idempotencyKey: "" } },
  { label: "empty ids", input: { workspaceId: "", actorUserId: "", outreachId: "", idempotencyKey: "" } },
];

async function main(): Promise<void> {
  // 1-4: systematic refusal, before any dependency is touched (no fake provider call, no fake
  // reservation, no candidate/recipient lookup) — for every input shape, not just a happy path.
  for (const { label, input } of INPUTS) {
    const service = sendBacklinkOutreachEmail(poisonedDependencies());
    try {
      await service(input);
      throw new Error(`Expected a refusal for: ${label}`);
    } catch (error) {
      assert(
        error instanceof BacklinkOutreachEmailSendError && error.code === "OUTREACH_EMAIL_SEND_SERVICE_REMOVED",
        `Expected OUTREACH_EMAIL_SEND_SERVICE_REMOVED for ${label}, got ${String(error)}`,
      );
    }
  }

  // 5: the error class, its existing codes, and the result/dependencies types stay usable by
  // every consumer that imports them (outreachApprovedAutoSendService.ts, the live-auto-send
  // service and cron-service, both send-one routes) — this is a compile-time guarantee checked
  // by tsc on the whole repository, not something this script can re-verify at runtime; this
  // assertion only confirms the class and a pre-existing code are still constructible as before.
  const preExisting = new BacklinkOutreachEmailSendError("OUTREACH_SEND_DISABLED_BY_DRY_RUN");
  assert(preExisting instanceof Error && preExisting.code === "OUTREACH_SEND_DISABLED_BY_DRY_RUN", "Pre-existing error codes must remain constructible.");
  const removed = new BacklinkOutreachEmailSendError("OUTREACH_EMAIL_SEND_SERVICE_REMOVED");
  assert(removed.code === "OUTREACH_EMAIL_SEND_SERVICE_REMOVED", "The new removal code must be constructible.");
  const typedResult: BacklinkOutreachEmailSendResult | null = null;
  assert(typedResult === null, "BacklinkOutreachEmailSendResult must remain a valid type reference.");

  // 6: static, repo-wide structural check — no file under app/** may import the executable
  // function itself. A type-only import of the shared error class/result type remains allowed
  // and must not be confused with an executable import.
  const EXECUTABLE_IMPORT_PATTERN = /import\s*\{[^}]*\bsendBacklinkOutreachEmail\b[^}]*\}\s*from\s*["'][^"']*outreachEmailSendService["']/;
  const appFiles = await listAppTsFiles();
  for (const file of appFiles) {
    const source = await readFile(file, "utf8");
    assert(
      !EXECUTABLE_IMPORT_PATTERN.test(source),
      `${file} must not import the executable sendBacklinkOutreachEmail function (type-only imports of BacklinkOutreachEmailSendError/Result remain allowed).`,
    );
  }

  console.log(`PASS — Backlink outreach email send service smoke (${appFiles.length} app files checked for executable imports)`);
}

async function listAppTsFiles(): Promise<string[]> {
  const { readdir } = await import("node:fs/promises");
  const path = await import("node:path");
  const results: string[] = [];
  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
        results.push(full);
      }
    }
  }
  await walk("app");
  return results;
}

void main();
