import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { executeBacklinkContactResolutionTask } from "../lib/automation/backlink-contact-resolution-task-handler";
import { runOneBacklinkAutonomyWorkerTask } from "../lib/automation/backlink-autonomy-worker";
import { runBacklinkAutonomyOrchestrator } from "../lib/automation/backlink-master-autonomy-orchestrator";
import { fetchHttp } from "../lib/backlinks/http";
import { createOfficialOriginRedirectAuthorization, resolveBacklinkContacts } from "../lib/backlinks/services/contactResolutionService";

const ids = {
  workspace: "00000000-0000-4000-8000-000000000001",
  run: "00000000-0000-4000-8000-000000000002",
  task: "00000000-0000-4000-8000-000000000003",
  domain: "00000000-0000-4000-8000-000000000004",
  opportunity: "00000000-0000-4000-8000-000000000005",
  actor: "00000000-0000-4000-8000-000000000006",
};
const at = "2026-09-22T00:00:00.000Z";

type Contact = { id: string; workspace_id: string; domain_id: string; contact_status: string; email_normalized: string | null; contact_form_url: string | null; linkedin_url: string | null; source_reference: string | null; created_by?: string };

function task(actorUserId: string | null = ids.actor) {
  return {
    id: ids.task, workspaceId: ids.workspace, runId: ids.run, dependsOnTaskId: null, system: "backlinks" as const, taskKind: "backlinks.contact_resolution", taskKey: "resolution", status: "running" as const,
    priority: 40, scheduledAt: at, availableAt: at, claimedAt: at, startedAt: at, heartbeatAt: null, leaseExpiresAt: null, completedAt: null, failedAt: null, cancelledAt: null, workerId: "worker", attemptCount: 1, maxAttempts: 3, backoffBaseSeconds: 60,
    input: { version: 1, domainId: ids.domain, opportunityId: ids.opportunity, ...(actorUserId == null ? {} : { actorUserId }) }, output: null, errorCode: null, errorMessage: null, createdAt: at, updatedAt: at,
  };
}

function resolutionDependencies(contacts: Contact[], fetchPage: (url: string) => Promise<{ url: string; status: number; contentType: string; body: string }>) {
  let creates = 0;
  return {
    creates: () => creates,
    deps: {
      getDomain: async () => ({ id: ids.domain, workspace_id: ids.workspace, hostname: "example.com", lifecycle_status: "active", archived_at: null }),
      getOpportunity: async () => ({ id: ids.opportunity, workspace_id: ids.workspace, domain_id: ids.domain, lifecycle_status: "active", archived_at: null }),
      listContactsByDomain: async () => contacts,
      createContact: async (_workspaceId: string, actorUserId: string, input: Record<string, unknown>) => {
        creates += 1;
        const value: Contact = { id: `contact-${contacts.length + 1}`, workspace_id: ids.workspace, domain_id: ids.domain, contact_status: String(input.contact_status), email_normalized: input.email_normalized as string | null, contact_form_url: input.contact_form_url as string | null, linkedin_url: input.linkedin_url as string | null, source_reference: input.source_reference as string | null, created_by: actorUserId };
        contacts.push(value);
        return { id: value.id };
      },
      fetchPage,
      resolve: resolveBacklinkContacts,
    },
  };
}

function control(enabled: boolean) {
  return { workspaceId: ids.workspace, backlinksEnabled: enabled, backlinkAutonomyEnabled: enabled, backlinkOutreachScheduleApplyEnabled: false, dryRunOnly: true, disabledReason: enabled ? null : "disabled" };
}

async function main() {
  const composition = await readFile(new URL("../lib/automation/backlink-autonomy-production-composition.ts", import.meta.url), "utf8");
  assert.match(composition, /resolve: resolveBacklinkContacts/);
  assert.doesNotMatch(composition, /CONTACT_RESOLUTION_PRODUCTION_NOT_AUTHORIZED/);
  assert.match(composition, /createContact\(client, workspaceId, actorUserId, input\)/);
  assert.doesNotMatch(composition, /resend|backlink_outreach|contactFormSubmission|linkedin/i);
  assert.match(await readFile(new URL("../lib/automation/backlink-autonomy-runtime-controls.ts", import.meta.url), "utf8"), /liveExecutionAuthorized: false/);

  let fetches = 0;
  const contacts: Contact[] = [];
  const resolver = resolutionDependencies(contacts, async (url) => {
    fetches += 1;
    return url.endsWith("/contact")
      ? { url, status: 200, contentType: "text/html", body: '<a href="mailto:editor@example.com">editor@example.com</a>' }
      : { url, status: 200, contentType: "text/html", body: '<a href="/contact">Contact</a>' };
  });

  let claimed = 0;
  let workerFailure: string | null = null;
  const createdTasks: string[] = [];
  const workerDeps: any = {
    resolution: resolver.deps,
    runtimeConfig: () => ({ autonomyEnabled: true }),
    getWorkspaceControl: async () => control(true),
    claimNextAllowedTask: async () => { claimed += 1; return claimed === 1 ? task() : null; },
    getDependencyOutput: async () => null,
    getActorUserId: async () => null,
    createOrGetTask: async (input: { taskKey: string }) => { createdTasks.push(input.taskKey); return { kind: "created", task: { id: "validation" } }; },
    completeTask: async () => task(), failTask: async (input: { errorMessage: string }) => { workerFailure = input.errorMessage; return task(); }, heartbeatTask: async () => null, reclaimExpiredTasks: async () => [], cancelTask: async () => null,
    validation: { getDomain: resolver.deps.getDomain, getOpportunity: resolver.deps.getOpportunity, getContact: async () => contacts[0], hasMxRecords: async () => null },
    campaign: {}, draft: {}, decision: {},
  };
  const completed = await runOneBacklinkAutonomyWorkerTask(workerDeps, { workspaceId: ids.workspace, runId: ids.run, workerId: "worker", at });
  assert.equal(completed.kind, "completed", workerFailure ?? undefined);
  assert.equal(fetches, 2, "same-origin contact crawl must be bounded and executed");
  assert.equal(contacts.length, 1, "one canonical explicit-email contact is persisted");
  assert.equal(contacts[0]?.email_normalized, "editor@example.com");
  assert.equal(contacts[0]?.contact_status, "unverified");
  assert.equal(contacts[0]?.created_by, ids.actor);
  assert.deepEqual(createdTasks, ["contact-validation:" + ids.opportunity + ":contact-1"]);

  const replay = await executeBacklinkContactResolutionTask(resolver.deps, { workspaceId: ids.workspace, domainId: ids.domain, opportunityId: ids.opportunity, actorUserId: ids.actor });
  assert.deepEqual(replay.existingContactIds, ["contact-1"]);
  assert.equal(resolver.creates(), 1);

  let globalClaims = 0;
  const globalOff = await runOneBacklinkAutonomyWorkerTask({ ...workerDeps, runtimeConfig: () => ({ autonomyEnabled: false }), claimNextAllowedTask: async () => { globalClaims += 1; return task(); } }, { workspaceId: ids.workspace, runId: ids.run, workerId: "worker", at });
  assert.equal(globalOff.kind, "disabled");
  assert.equal(globalClaims, 0);
  let workspaceFetches = 0;
  const workspaceOff = await runOneBacklinkAutonomyWorkerTask({ ...workerDeps, getWorkspaceControl: async () => control(false), claimNextAllowedTask: async () => task(), resolution: { ...resolver.deps, fetchPage: async () => { workspaceFetches += 1; throw new Error("must not fetch"); } } }, { workspaceId: ids.workspace, runId: ids.run, workerId: "worker", at });
  assert.equal(workspaceOff.kind, "terminal");
  assert.equal(workspaceFetches, 0);
  let missingActorFetches = 0;
  const missingActor = await runOneBacklinkAutonomyWorkerTask({ ...workerDeps, claimNextAllowedTask: async () => task(null), resolution: { ...resolver.deps, fetchPage: async () => { missingActorFetches += 1; throw new Error("must not fetch"); } } }, { workspaceId: ids.workspace, runId: ids.run, workerId: "worker", at });
  assert.equal(missingActor.kind, "terminal");
  assert.deepEqual(missingActor.reasonCodes, ["AUTONOMY_ACTOR_MISSING"]);
  assert.equal(missingActorFetches, 0);

  const policy = createOfficialOriginRedirectAuthorization("https://example.com");
  const sameOriginHops: string[] = [];
  const sameOrigin = await fetchHttp({ url: "https://example.com/start", timeoutMs: 1_000, maxRedirects: 2, maxResponseBytes: 10_000 }, {
    dnsLookup: async () => [{ address: "93.184.216.34", family: 4 }],
    authorizeRedirect: policy,
    transport: async (input) => {
      sameOriginHops.push(input.url.toString());
      return input.url.pathname === "/start"
        ? { status: 302, headers: { location: "/contact" }, body: "" }
        : { status: 200, headers: {} as Record<string, string>, body: "ok" };
    },
  });
  assert.equal(sameOrigin.finalUrl, "https://example.com/contact");
  assert.deepEqual(sameOriginHops, ["https://example.com/start", "https://example.com/contact"]);

  const redirectHops: string[] = [];
  await assert.rejects(() => fetchHttp({ url: "https://example.com/start", timeoutMs: 1_000, maxRedirects: 2, maxResponseBytes: 10_000 }, {
    dnsLookup: async () => [{ address: "93.184.216.34", family: 4 }],
    authorizeRedirect: policy,
    transport: async (input) => { redirectHops.push(input.url.toString()); return { status: 302, headers: { location: "https://other.example/contact" }, body: "" }; },
  }), /not authorized/);
  assert.deepEqual(redirectHops, ["https://example.com/start"]);

  for (const location of ["http://example.com/contact", "https://sub.example.com/contact", "https://user:pass@example.com/contact"]) {
    const hops: string[] = [];
    await assert.rejects(() => fetchHttp({ url: "https://example.com/start", timeoutMs: 1_000, maxRedirects: 2, maxResponseBytes: 10_000 }, {
      dnsLookup: async () => [{ address: "93.184.216.34", family: 4 }],
      authorizeRedirect: policy,
      transport: async (input) => { hops.push(input.url.toString()); return { status: 302, headers: { location }, body: "" }; },
    }), /not authorized|not allowed/);
    assert.deepEqual(hops, ["https://example.com/start"]);
  }
  let privateTransportCalls = 0;
  await assert.rejects(() => fetchHttp({ url: "http://127.0.0.1/private", timeoutMs: 1_000, maxRedirects: 0, maxResponseBytes: 10_000 }, {
    transport: async () => { privateTransportCalls += 1; return { status: 200, headers: {}, body: "unsafe" }; },
  }), /not allowed|private|loopback/i);
  assert.equal(privateTransportCalls, 0);

  const formOnly = await resolveBacklinkContacts({
    homepageUrl: "https://example.com", domainHostname: "example.com", maxPages: 1, maxBytes: 10_000, requestTimeoutMs: 1_000,
    fetchPage: async (url) => ({ url, status: 200, contentType: "text/html", body: "<form><input name=message></form>" }),
  });
  assert.equal(formOnly.status, "resolved");
  assert.equal(formOnly.candidates[0]?.contactFormUrl, "https://example.com/");
  assert.equal(formOnly.candidates[0]?.email, null);
  const linkedinOnly = await resolveBacklinkContacts({
    homepageUrl: "https://example.com", domainHostname: "example.com", maxPages: 1, maxBytes: 10_000, requestTimeoutMs: 1_000,
    fetchPage: async (url) => ({ url, status: 200, contentType: "text/html", body: '<a href="https://www.linkedin.com/company/example/">LinkedIn</a>' }),
  });
  assert.equal(linkedinOnly.status, "resolved");
  assert.equal(linkedinOnly.candidates[0]?.linkedinUrl, "https://www.linkedin.com/company/example/");

  let boundedFetches = 0;
  const bounded = await resolveBacklinkContacts({
    homepageUrl: "https://example.com", domainHostname: "example.com", maxPages: 1, maxBytes: 10_000, requestTimeoutMs: 1_000,
    fetchPage: async (url) => { boundedFetches += 1; return { url, status: 200, contentType: "text/html", body: '<a href="/contact">contact</a>' }; },
  });
  assert.equal(boundedFetches, 1);
  assert.deepEqual(bounded.reasons, ["PAGE_LIMIT_REACHED"]);
  const oversized = await resolveBacklinkContacts({
    homepageUrl: "https://example.com", domainHostname: "example.com", maxPages: 1, maxBytes: 1, requestTimeoutMs: 1_000,
    fetchPage: async (url) => ({ url, status: 200, contentType: "text/html", body: "too large" }),
  });
  assert.equal(oversized.status, "no_contact_found");
  assert.deepEqual(oversized.reasons, ["PAGE_SKIPPED"]);

  const officialCrawlFetches: string[] = [];
  await resolveBacklinkContacts({
    homepageUrl: "https://official.example", domainHostname: "official.example", maxPages: 6, maxBytes: 10_000, requestTimeoutMs: 1_000,
    fetchPage: async (url) => {
      officialCrawlFetches.push(url);
      return {
        url,
        status: 200,
        contentType: "text/html",
        body: url === "https://official.example/"
          ? '<a href="/contact">relative</a><a href="https://official.example/about">absolute</a><a href="http://official.example/insecure">downgrade</a><a href="https://sub.official.example/contact">subdomain</a><a href="https://official.example:444/contact">alternate port</a>'
          : "no contact",
      };
    },
  });
  assert.deepEqual(officialCrawlFetches, ["https://official.example/", "https://official.example/contact", "https://official.example/about"]);
  assert(!officialCrawlFetches.includes("http://official.example/insecure"));
  assert(!officialCrawlFetches.includes("https://sub.official.example/contact"));
  assert(!officialCrawlFetches.includes("https://official.example:444/contact"));

  const noContacts = resolutionDependencies([], async (url) => ({ url, status: 200, contentType: "text/html", body: "no contact" }));
  const zero = await executeBacklinkContactResolutionTask(noContacts.deps, { workspaceId: ids.workspace, domainId: ids.domain, opportunityId: ids.opportunity, actorUserId: ids.actor });
  assert.equal(zero.status, "no_contact_found");
  for (const contactStatus of ["do_not_contact", "archived"]) {
    const protectedContacts: Contact[] = [{ id: `protected-${contactStatus}`, workspace_id: ids.workspace, domain_id: ids.domain, contact_status: contactStatus, email_normalized: "editor@example.com", contact_form_url: null, linkedin_url: null, source_reference: null }];
    const protectedResolver = resolutionDependencies(protectedContacts, async (url) => ({ url, status: 200, contentType: "text/html", body: '<a href="mailto:editor@example.com">editor</a>' }));
    const protectedResult = await executeBacklinkContactResolutionTask(protectedResolver.deps, { workspaceId: ids.workspace, domainId: ids.domain, opportunityId: ids.opportunity, actorUserId: ids.actor });
    assert.deepEqual(protectedResult.existingContactIds, [`protected-${contactStatus}`]);
    assert.equal(protectedResolver.creates(), 0);
    assert.equal(protectedContacts[0]?.contact_status, contactStatus);
  }
  const multiple = resolutionDependencies([], async (url) => ({ url, status: 200, contentType: "text/html", body: '<a href="mailto:a@example.com">a</a><a href="mailto:b@example.com">b</a>' }));
  const multipleResult = await executeBacklinkContactResolutionTask(multiple.deps, { workspaceId: ids.workspace, domainId: ids.domain, opportunityId: ids.opportunity, actorUserId: ids.actor });
  const manual = await runBacklinkAutonomyOrchestrator({}, { workspaceId: ids.workspace, runId: ids.run, domainId: ids.domain, opportunityId: ids.opportunity, scheduledAt: at, mode: "apply", control: { backlinksEnabled: true, disabledReason: null, dryRunOnly: true, backlinkAutonomyEnabled: true, liveExecutionAuthorized: false }, progress: { stage: "contact_resolution", completedTaskId: ids.task, completedTaskKind: "backlinks.contact_resolution", contactIds: multipleResult.createdContactIds } });
  assert.equal(manual.outcome, "manual_review");
  assert.deepEqual(manual.reasonCodes, ["CONTACT_SELECTION_REQUIRED"]);
  assert(!JSON.stringify(contacts).includes("info@example.com"));
  console.log("PASS — Backlink production contact discovery G2C.3-D2 smoke");
}

void main();
