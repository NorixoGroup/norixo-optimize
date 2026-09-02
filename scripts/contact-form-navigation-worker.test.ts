import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { Json } from "../types/database.types";
import {
  executeContactFormNavigationWorkerOnceWithDependencies,
  isContactFormNavigationWorkerEnabled,
  isPublicIpAddress,
  validateContactFormNavigationUrl,
  type ContactFormBrowserPage,
  type ContactFormBrowserRequest,
  type ContactFormBrowserRequestDecision,
  type ContactFormBrowserRuntime,
  type ContactFormDnsResolver,
  type ContactFormNavigationDependencies,
} from "../lib/backlinks/services/contactFormNavigationWorker";
import { buildContactFormApprovalFingerprint } from "../lib/backlinks/services/contactFormApprovalFingerprint";
import type {
  ContactFormApproval,
  ContactFormExecutionContact,
  ContactFormExecutionOpportunity,
  ContactFormExecutionOutreach,
  ContactFormRun,
  ContactFormRunExecutionContext,
  ContactFormRunState,
} from "../lib/backlinks/repositories/contactFormAutomationRepository";

const now = "2026-09-02T12:00:00.000Z";
const workspaceId = "10000000-0000-4000-8000-000000000001";
const campaignId = "10000000-0000-4000-8000-000000000002";
const outreachId = "10000000-0000-4000-8000-000000000003";
const contactId = "10000000-0000-4000-8000-000000000004";
const opportunityId = "10000000-0000-4000-8000-000000000005";
const approvalId = "10000000-0000-4000-8000-000000000006";
const runId = "10000000-0000-4000-8000-000000000007";
const workerId = "c3-test-worker";

type TestCase = { name: string; run: () => Promise<void> | void };
const tests: TestCase[] = [];
function test(name: string, run: TestCase["run"]) {
  tests.push({ name, run });
}

function rowRun(overrides: Partial<ContactFormRun> = {}): ContactFormRun {
  return {
    approval_id: approvalId,
    campaign_id: campaignId,
    claimed_at: now,
    claimed_by: workerId,
    created_at: now,
    evidence_reference: null,
    final_attempt_id: null,
    final_url: null,
    finished_at: null,
    form_schema_fingerprint: null,
    form_url: "https://forms.example/contact",
    heartbeat_at: now,
    id: runId,
    lease_expires_at: "2026-09-02T12:02:00.000Z",
    max_pre_submit_attempts: 2,
    outreach_id: outreachId,
    pre_submit_attempt_count: 0,
    result_class: null,
    safe_error_code: null,
    started_at: now,
    state: "claimed",
    submit_started_at: null,
    updated_at: now,
    workspace_id: workspaceId,
    ...overrides,
  };
}

function rowOutreach(overrides: Partial<ContactFormExecutionOutreach> = {}): ContactFormExecutionOutreach {
  return { body: "Approved body", campaign_id: campaignId, channel: "contact_form", contact_id: contactId, current_attempt: 0, id: outreachId, opportunity_id: opportunityId, status: "draft", subject: "Approved subject", workspace_id: workspaceId, ...overrides };
}

function rowContact(overrides: Partial<ContactFormExecutionContact> = {}): ContactFormExecutionContact {
  return { archived_at: null, contact_form_url: "https://forms.example/contact", contact_status: "verified", do_not_contact_at: null, id: contactId, workspace_id: workspaceId, ...overrides };
}

function rowOpportunity(overrides: Partial<ContactFormExecutionOpportunity> = {}): ContactFormExecutionOpportunity {
  return { id: opportunityId, target_page_url: "https://target.example/page", workspace_id: workspaceId, ...overrides };
}

function rowApproval(input?: {
  outreach?: ContactFormExecutionOutreach;
  contact?: ContactFormExecutionContact;
  opportunity?: ContactFormExecutionOpportunity;
  overrides?: Partial<ContactFormApproval>;
}): ContactFormApproval {
  const outreach = input?.outreach ?? rowOutreach();
  const contact = input?.contact ?? rowContact();
  const opportunity = input?.opportunity ?? rowOpportunity();
  const content_fingerprint = buildContactFormApprovalFingerprint({
    workspaceId,
    campaignId,
    outreachId,
    contactId,
    opportunityId,
    targetUrl: opportunity.target_page_url.trim(),
    formUrl: contact.contact_form_url?.trim() ?? "",
    senderName: "Norixo",
    senderEmail: "ops@norixo.example",
    senderCompany: "Norixo",
    senderWebsite: "https://norixo.example",
    subject: outreach.subject?.trim() ?? "",
    body: outreach.body?.trim() ?? "",
  });
  return {
    approved_at: now,
    approved_by_user_id: "10000000-0000-4000-8000-000000000008",
    body: outreach.body ?? "",
    campaign_id: campaignId,
    contact_id: contactId,
    content_fingerprint,
    created_at: now,
    form_schema_fingerprint: null,
    form_url: contact.contact_form_url?.trim() ?? "",
    id: approvalId,
    opportunity_id: opportunityId,
    outreach_id: outreachId,
    sender_company: "Norixo",
    sender_email: "ops@norixo.example",
    sender_name: "Norixo",
    sender_website: "https://norixo.example",
    subject: outreach.subject ?? "",
    target_url: opportunity.target_page_url.trim(),
    workspace_id: workspaceId,
    ...input?.overrides,
  };
}

function context(overrides: {
  run?: Partial<ContactFormRun>;
  outreach?: Partial<ContactFormExecutionOutreach>;
  contact?: Partial<ContactFormExecutionContact>;
  opportunity?: Partial<ContactFormExecutionOpportunity>;
  approval?: Partial<ContactFormApproval>;
  outreachAttemptCount?: number;
} = {}): ContactFormRunExecutionContext {
  const run = rowRun(overrides.run);
  const outreach = rowOutreach(overrides.outreach);
  const contact = rowContact(overrides.contact);
  const opportunity = rowOpportunity(overrides.opportunity);
  const approval = rowApproval({ outreach, contact, opportunity, overrides: overrides.approval });
  return { run, approval, outreach, contact, opportunity, outreachAttemptCount: overrides.outreachAttemptCount ?? 0 };
}

function publicDns(hostname: string): readonly { address: string; family: 4 | 6 }[] {
  assert.equal(hostname.length > 0, true);
  return [{ address: "93.184.216.34", family: 4 }];
}

function resolver(records: readonly { address: string; family: 4 | 6 }[] | Error): ContactFormDnsResolver {
  return async () => {
    if (records instanceof Error) throw records;
    return records;
  };
}

class FakePage implements ContactFormBrowserPage {
  private handler: ((request: ContactFormBrowserRequest) => Promise<ContactFormBrowserRequestDecision>) | null = null;
  currentUrl = "about:blank";
  titleValue = "Contact us";
  counts = new Map<string, number>([
    ["form", 1],
    ["input", 3],
    ["textarea", 1],
    ["select", 0],
    ["button", 1],
  ]);
  signals = { hasCaptcha: false, hasLoginWall: false, hasPasswordField: false };
  requests: ContactFormBrowserRequest[] = [];
  submitted = false;
  popupHandler: (() => void) | null = null;
  downloadHandler: (() => void) | null = null;
  throwOnGoto: Error | null = null;
  async routeRequests(handler: (request: ContactFormBrowserRequest) => Promise<ContactFormBrowserRequestDecision>) {
    this.handler = handler;
  }
  async goto(url: string) {
    if (this.throwOnGoto) throw this.throwOnGoto;
    const requests = this.requests.length ? this.requests : [{ url, method: "GET", resourceType: "document", isNavigationRequest: true }];
    for (const request of requests) {
      const decision = await this.dispatch(request);
      if (decision === "abort") throw new Error("blockedbyclient");
      if (request.isNavigationRequest) this.currentUrl = request.url;
    }
  }
  url() {
    return this.currentUrl;
  }
  async title() {
    return this.titleValue;
  }
  async count(selector: string) {
    return this.counts.get(selector) ?? 0;
  }
  async evaluatePageSignals() {
    return this.signals;
  }
  onPopup(handler: () => void) {
    this.popupHandler = handler;
  }
  onDownload(handler: () => void) {
    this.downloadHandler = handler;
  }
  async dispatch(request: ContactFormBrowserRequest) {
    assert.ok(this.handler, "route handler registered");
    return this.handler(request);
  }
}

function runtime(page = new FakePage(), closeFailure = false): ContactFormBrowserRuntime & { opened: number; closed: number; page: FakePage } {
  return {
    name: "fake-playwright-chromium",
    opened: 0,
    closed: 0,
    page,
    async openContext() {
      this.opened += 1;
      return {
        page,
        close: async () => {
          this.closed += 1;
          if (closeFailure) throw new Error("close failed");
        },
      };
    },
  };
}

function deps(input: {
  ctx?: ContactFormRunExecutionContext;
  page?: FakePage;
  dns?: ContactFormDnsResolver;
  heartbeatError?: Error;
  closeFailure?: boolean;
} = {}): ContactFormNavigationDependencies & { transitions: Array<{ state: ContactFormRunState; eventType: string; safeErrorCode: string | null; metadata: Json | undefined; finalUrl: string | null }>; runtime: ReturnType<typeof runtime>; heartbeats: number; claims: number } {
  const ctx = input.ctx ?? context();
  const fakeRuntime = runtime(input.page, input.closeFailure);
  const transitions: Array<{ state: ContactFormRunState; eventType: string; safeErrorCode: string | null; metadata: Json | undefined; finalUrl: string | null }> = [];
  let heartbeats = 0;
  let claims = 0;
  return {
    get heartbeats() {
      return heartbeats;
    },
    get claims() {
      return claims;
    },
    runtime: fakeRuntime,
    transitions,
    async claimNextRun() {
      claims += 1;
      return ctx.run;
    },
    async heartbeatRun() {
      heartbeats += 1;
      if (input.heartbeatError) throw input.heartbeatError;
      return ctx.run;
    },
    async transitionRun(transition) {
      transitions.push({ state: transition.nextState, eventType: transition.eventType, safeErrorCode: transition.safeErrorCode ?? null, metadata: transition.safeMetadata, finalUrl: transition.finalUrl ?? null });
      return { ...ctx.run, state: transition.nextState, final_url: transition.finalUrl ?? ctx.run.final_url, safe_error_code: transition.safeErrorCode ?? ctx.run.safe_error_code };
    },
    async loadExecutionContext() {
      return ctx;
    },
    resolveHostname: input.dns ?? (async (hostname) => publicDns(hostname)),
    browserRuntime: fakeRuntime,
    nowMs: () => Date.parse(now),
  };
}

async function expectUrl(rawUrl: string, expected: boolean, dns: ContactFormDnsResolver = async (hostname) => publicDns(hostname)) {
  const result = await validateContactFormNavigationUrl(rawUrl, dns);
  assert.equal(result.ok, expected, `${rawUrl} expected ${expected ? "accepted" : "rejected"}`);
}

test("HTTPS URL acceptance", () => expectUrl("https://forms.example/contact", true));
test("HTTP rejection", () => expectUrl("http://forms.example/contact", false));
test("unsupported protocol rejection", () => expectUrl("ftp://forms.example/contact", false));
test("URL credentials rejection", () => expectUrl("https://user:pass@forms.example/contact", false));
test("localhost rejection", () => expectUrl("https://localhost/contact", false));
test("private IPv4 rejection", () => expectUrl("https://10.0.0.1/contact", false));
test("link-local rejection", () => expectUrl("https://169.254.10.20/contact", false));
test("private/reserved IPv6 rejection", () => expectUrl("https://[fc00::1]/contact", false));
test("public IP literal rejected by policy", () => expectUrl("https://93.184.216.34/contact", false));
test("mixed public/private DNS rejection", () => expectUrl("https://forms.example/contact", false, resolver([{ address: "93.184.216.34", family: 4 }, { address: "10.0.0.2", family: 4 }])));
test("DNS failure", () => expectUrl("https://forms.example/contact", false, resolver(new Error("ENOTFOUND"))));
test("safe redirect", async () => {
  const page = new FakePage();
  page.requests = [
    { url: "https://forms.example/contact", method: "GET", resourceType: "document", isNavigationRequest: true },
    { url: "https://forms.example/contact-us", method: "GET", resourceType: "document", isNavigationRequest: true },
  ];
  const d = deps({ page });
  const result = await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId);
  assert.equal(result.kind, "discovered");
  assert.equal(d.transitions.at(-1)?.finalUrl, "https://forms.example/contact-us");
});
test("private redirect rejection", async () => {
  const page = new FakePage();
  page.requests = [
    { url: "https://forms.example/contact", method: "GET", resourceType: "document", isNavigationRequest: true },
    { url: "https://10.0.0.1/private", method: "GET", resourceType: "document", isNavigationRequest: true },
  ];
  const d = deps({ page });
  const result = await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId);
  assert.equal(result.kind, "blocked");
  assert.equal(result.state, "blocked_policy");
});
test("HTTPS to HTTP redirect rejection", async () => {
  const page = new FakePage();
  page.requests = [
    { url: "https://forms.example/contact", method: "GET", resourceType: "document", isNavigationRequest: true },
    { url: "http://forms.example/contact", method: "GET", resourceType: "document", isNavigationRequest: true },
  ];
  const d = deps({ page });
  const result = await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId);
  assert.equal(result.kind, "blocked");
  assert.equal(result.state, "blocked_policy");
});
test("redirect limit", async () => {
  const page = new FakePage();
  page.requests = [
    { url: "https://forms.example/1", method: "GET", resourceType: "document", isNavigationRequest: true },
    { url: "https://forms.example/2", method: "GET", resourceType: "document", isNavigationRequest: true },
    { url: "https://forms.example/3", method: "GET", resourceType: "document", isNavigationRequest: true },
  ];
  const d = deps({ page });
  const result = await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId, { redirectLimit: 1 });
  assert.equal(result.kind, "blocked");
  assert.equal(d.transitions.at(-1)?.safeErrorCode, "CONTACT_FORM_REDIRECT_LIMIT_EXCEEDED");
});
test("isolated contexts", async () => {
  const d1 = deps();
  const d2 = deps({ ctx: context({ run: { id: "10000000-0000-4000-8000-000000000009" } }) });
  await executeContactFormNavigationWorkerOnceWithDependencies(d1, workerId);
  await executeContactFormNavigationWorkerOnceWithDependencies(d2, workerId);
  assert.equal(d1.runtime.opened, 1);
  assert.equal(d2.runtime.opened, 1);
});
test("no cookie/storage reuse", async () => {
  const d = deps();
  await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId);
  assert.equal(d.runtime.opened, 1);
  assert.equal(d.runtime.closed, 1);
});
test("background POST blocked", async () => {
  const page = new FakePage();
  page.requests = [
    { url: "https://forms.example/contact", method: "GET", resourceType: "document", isNavigationRequest: true },
    { url: "https://forms.example/track", method: "POST", resourceType: "fetch", isNavigationRequest: false },
  ];
  const d = deps({ page });
  const result = await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId);
  assert.equal(result.kind, "blocked");
  assert.equal(d.transitions.at(-1)?.safeErrorCode, "CONTACT_FORM_TARGET_MUTATION_BLOCKED");
});
for (const method of ["PUT", "PATCH", "DELETE"]) {
  test(`${method} blocked`, async () => {
    const page = new FakePage();
    page.requests = [
      { url: "https://forms.example/contact", method: "GET", resourceType: "document", isNavigationRequest: true },
      { url: "https://forms.example/api", method, resourceType: "fetch", isNavigationRequest: false },
    ];
    const d = deps({ page });
    const result = await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId);
    assert.equal(result.kind, "blocked");
    assert.equal(d.transitions.at(-1)?.safeErrorCode, "CONTACT_FORM_TARGET_MUTATION_BLOCKED");
  });
}
test("GET navigation allowed", async () => {
  const d = deps();
  const result = await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId);
  assert.equal(result.kind, "discovered");
});
test("form metadata inspection without mutation", async () => {
  const page = new FakePage();
  const d = deps({ page });
  const result = await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId);
  assert.equal(result.kind, "discovered");
  assert.equal(result.metadata.formCount, 1);
  assert.equal(page.submitted, false);
});
test("no form submission primitives in C3 source", () => {
  const source = readFileSync(join(process.cwd(), "lib/backlinks/services/contactFormNavigationWorker.ts"), "utf8");
  assert.doesNotMatch(source, /\.fill\(|\.type\(|\.click\(|press\(|requestSubmit|form\.submit|confirmContactFormSubmission|backlink_outreach_attempts/);
});
test("CAPTCHA classification only", async () => {
  const page = new FakePage();
  page.signals = { hasCaptcha: true, hasLoginWall: false, hasPasswordField: false };
  const d = deps({ page });
  const result = await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId);
  assert.equal(result.kind, "blocked");
  assert.equal(result.state, "blocked_captcha");
});
test("login wall to manual review", async () => {
  const page = new FakePage();
  page.signals = { hasCaptcha: false, hasLoginWall: true, hasPasswordField: true };
  const d = deps({ page });
  const result = await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId);
  assert.equal(result.kind, "blocked");
  assert.equal(result.state, "manual_review");
});
test("navigation timeout", async () => {
  const page = new FakePage();
  page.throwOnGoto = new Error("Timeout 15000ms exceeded");
  const d = deps({ page });
  const result = await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId);
  assert.equal(result.kind, "blocked");
  assert.equal(result.state, "failed_pre_submit");
  assert.equal(result.safeErrorCode, "CONTACT_FORM_NAVIGATION_TIMEOUT");
});
test("lease loss", async () => {
  const page = new FakePage();
  const d = deps({ page, heartbeatError: new Error("CONTACT_FORM_RUN_LEASE_LOST") });
  const result = await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId);
  assert.equal(result.kind, "lease_lost");
  assert.equal(page.url(), "about:blank");
});
test("stale approval", async () => {
  const d = deps({ ctx: context({ approval: { content_fingerprint: "cf1_0000000000000000000000000000000000000000000000000000000000000000" } }) });
  const result = await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId);
  assert.equal(result.kind, "blocked");
  assert.equal(result.state, "manual_review");
  assert.equal(d.transitions.at(-1)?.eventType, "approval_revalidation_failed");
});
test("DNC race", async () => {
  const d = deps({ ctx: context({ contact: { contact_status: "do_not_contact", do_not_contact_at: now } }) });
  const result = await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId);
  assert.equal(result.kind, "blocked");
  assert.equal(result.state, "manual_review");
  assert.equal(d.transitions.at(-1)?.eventType, "dnc_revalidation_failed");
});
test("successful progression stops at discovered", async () => {
  const d = deps();
  const result = await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId);
  assert.equal(result.kind, "discovered");
  assert.deepEqual(d.transitions.map((transition) => transition.state), ["navigating", "discovered"]);
});
for (const forbiddenState of ["filled", "pre_submit_validated", "submitting", "submission_confirmed"] as const) {
  test(`cannot reach ${forbiddenState}`, async () => {
    const d = deps();
    await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId);
    assert.equal(d.transitions.some((transition) => transition.state === forbiddenState), false);
  });
}
test("no accepted initial attempt", async () => {
  const d = deps();
  await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId);
  assert.equal(d.transitions.some((transition) => transition.eventType === "submission_confirmed"), false);
});
test("no outreach activation", () => {
  const source = readFileSync(join(process.cwd(), "lib/backlinks/services/contactFormNavigationWorker.ts"), "utf8");
  assert.doesNotMatch(source, /status\s*=\s*['"]active|current_attempt\s*=\s*1|activate/i);
});
test("no automatic retry", () => {
  const source = readFileSync(join(process.cwd(), "lib/backlinks/services/contactFormNavigationWorker.ts"), "utf8");
  assert.doesNotMatch(source, /retryContactFormPreSubmitRun|retry_backlink_contact_form_pre_submit/i);
});
test("safe redacted evidence", async () => {
  const d = deps();
  await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId);
  const metadata = JSON.stringify(d.transitions.at(-1)?.metadata ?? {});
  assert.match(metadata, /full_html_persisted/);
  assert.doesNotMatch(metadata, /Approved body|<html|ops@norixo/);
});
test("popup policy", async () => {
  const page = new FakePage();
  const d = deps({ page });
  const runPromise = executeContactFormNavigationWorkerOnceWithDependencies(d, workerId);
  await runPromise;
  page.popupHandler?.();
  assert.ok(page.popupHandler);
});
test("cleanup success", async () => {
  const d = deps();
  const result = await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId);
  assert.notEqual(result.kind, "empty");
  if (result.kind !== "empty") assert.equal(result.cleanup, "success");
  assert.equal(d.runtime.closed, 1);
});
test("cleanup failure", async () => {
  const d = deps({ closeFailure: true });
  const result = await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId);
  assert.notEqual(result.kind, "empty");
  if (result.kind !== "empty") assert.equal(result.cleanup, "failed");
});
test("concurrency equals one claimed run per execution", async () => {
  const d = deps();
  await executeContactFormNavigationWorkerOnceWithDependencies(d, workerId);
  assert.equal(d.claims, 1);
});
test("worker default disabled", () => {
  assert.equal(isContactFormNavigationWorkerEnabled({}), false);
  assert.equal(isContactFormNavigationWorkerEnabled({ CONTACT_FORM_NAVIGATION_WORKER_ENABLED: "true" }), true);
});
test("unsafe IP classifier rejects internal ranges", () => {
  for (const address of ["127.0.0.1", "10.0.0.1", "172.16.0.1", "192.168.1.1", "169.254.1.1", "::1", "fc00::1", "fe80::1", "2001:db8::1"]) assert.equal(isPublicIpAddress(address), false, address);
  assert.equal(isPublicIpAddress("93.184.216.34"), true);
  assert.equal(isPublicIpAddress("2606:2800:220:1:248:1893:25c8:1946"), true);
});

async function main() {
  let passed = 0;
  for (const current of tests) {
    await current.run();
    passed += 1;
  }
  console.log(`contact-form navigation worker tests passed: ${passed}/${tests.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
