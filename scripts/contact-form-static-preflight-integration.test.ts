import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import type { BacklinkRepositoryClient } from "../lib/backlinks/repositories/repositoryClient";
import type { ContactFormStaticHtmlResult } from "../lib/backlinks/http/contactFormStaticHtmlFetcher";
import { parseStaticContactFormHtml } from "../lib/backlinks/services/contactFormStaticHtmlParser";
import { executeContactFormVerificationPreflight, type ContactFormVerificationPreflightDependencies } from "../lib/backlinks/services/contactFormVerificationPreflightWorker";

const client = {} as BacklinkRepositoryClient;
const URL = "https://example.com/contact";
const validHtml = `<!doctype html><form aria-label="Contact us"><label>Name<input name="name" required></label><label>Email<input name="email" type="email" required></label><label>Message<textarea name="message" required></textarea></label><button type="submit">Send message</button></form>`;
type State = { persisted: number; completions: Array<{ status: string; safeErrorCode?: string | null }>; workspaceCalls: string[]; fetchCalls: string[]; claim: { id: string; status: string; worker_id: string; contact_id: string; form_url: string }; claimed: boolean };

function success(html = validHtml): ContactFormStaticHtmlResult { return { ok: true, originalUrl: URL, finalUrl: URL, html, contentType: "text/html", redirectCount: 0 }; }
function failure(code: Extract<ContactFormStaticHtmlResult, { ok: false }> ["safeErrorCode"]): ContactFormStaticHtmlResult { return { ok: false, originalUrl: URL, safeErrorCode: code }; }

function fixture(input: { fetched?: ContactFormStaticHtmlResult; claimStatus?: string; claimWorker?: string; claimed?: boolean; persistError?: boolean; completeError?: boolean; expectedWorkspace?: string } = {}) {
  const state: State = { persisted: 0, completions: [], workspaceCalls: [], fetchCalls: [], claimed: input.claimed ?? true, claim: { id: "preflight-1", status: input.claimStatus ?? "running", worker_id: input.claimWorker ?? "worker-1", contact_id: "contact-1", form_url: URL } };
  const deps: ContactFormVerificationPreflightDependencies = {
    claim: async (_client, value) => { state.workspaceCalls.push(value.workspaceId); return { claimed: state.claimed, preflight: state.claim } as never; },
    getContact: async (_client, workspaceId) => {
      state.workspaceCalls.push(workspaceId);
      if (input.expectedWorkspace != null && workspaceId !== input.expectedWorkspace) throw new Error("workspace mismatch");
      return { id: "contact-1", contact_form_url: URL } as never;
    },
    complete: async (_client, value) => {
      state.completions.push({ status: value.status, safeErrorCode: value.safeErrorCode });
      if (input.completeError) throw new Error("completion failure");
      return { ...state.claim, status: value.status } as never;
    },
    completeVerifiedAtomically: async () => {
      state.persisted += 1;
      if (input.persistError) throw new Error("persistence failure");
      if (input.completeError) throw new Error("completion failure");
      return {} as never;
    },
    fetchStaticHtml: async (url) => { state.fetchCalls.push(url); return input.fetched ?? success(); },
    parseStaticHtml: parseStaticContactFormHtml,
  };
  return { state, deps };
}

async function run(deps: ContactFormVerificationPreflightDependencies, workspaceId = "workspace-1") {
  return executeContactFormVerificationPreflight({ client, workspaceId, preflightId: "preflight-1", workerId: "worker-1", dependencies: deps });
}

void (async () => {
  const valid = fixture(); await run(valid.deps);
  assert.equal(valid.state.persisted, 1); assert.deepEqual(valid.state.completions, []); assert.deepEqual(valid.state.fetchCalls, [URL]);

  for (const html of ["<!doctype html><form><input type=password></form>", "<!doctype html><script>hydrateRoot()</script>", "<!doctype html><style>form{display:none}</style>" + validHtml, `${validHtml}${validHtml}`]) {
    const result = fixture({ fetched: success(html) }); await run(result.deps);
    assert.equal(result.state.persisted, 0, "manual review must not persist evidence"); assert.equal(result.state.completions[0]?.status, "manual_review");
  }

  for (const code of ["CONTACT_FORM_STATIC_DNS_UNSAFE", "CONTACT_FORM_STATIC_REDIRECT_FORBIDDEN", "CONTACT_FORM_STATIC_TLS_FAILED", "CONTACT_FORM_STATIC_TIMEOUT", "CONTACT_FORM_STATIC_RESPONSE_TOO_LARGE"] as const) {
    const result = fixture({ fetched: failure(code) }); await run(result.deps);
    assert.equal(result.state.persisted, 0, `${code} must not persist evidence`);
    assert.equal(result.state.completions[0]?.status, code === "CONTACT_FORM_STATIC_DNS_UNSAFE" || code === "CONTACT_FORM_STATIC_REDIRECT_FORBIDDEN" ? "blocked" : "failed");
  }

  const wonClaim = fixture({ claimWorker: "contact-form-preflight:same-user:invocation-a" }); await run(wonClaim.deps);
  const lostClaim = fixture({ claimWorker: "contact-form-preflight:same-user:invocation-a", claimed: false }); await run(lostClaim.deps);
  assert.deepEqual(wonClaim.state.fetchCalls, [URL], "the sole successful claim performs exactly one fetch");
  assert.equal(lostClaim.state.persisted, 0); assert.equal(lostClaim.state.completions.length, 0, "lost claim cannot complete or persist");
  assert.deepEqual(lostClaim.state.fetchCalls, [], "existing running request cannot fetch, parse, persist, or complete");

  const persistFailure = fixture({ persistError: true }); await assert.rejects(() => run(persistFailure.deps), /persistence failure/); assert.equal(persistFailure.state.completions.length, 0);
  const completionFailure = fixture({ completeError: true }); await assert.rejects(() => run(completionFailure.deps), /completion failure/); assert.equal(completionFailure.state.completions.length, 0, "atomic RPC does not expose a separate completion call");

  const isolated = fixture({ expectedWorkspace: "workspace-a" }); await run(isolated.deps, "workspace-a"); assert.deepEqual(isolated.state.workspaceCalls, ["workspace-a", "workspace-a"]);
  const workerSource = readFileSync("lib/backlinks/services/contactFormVerificationPreflightWorker.ts", "utf8");
  for (const forbidden of ["playwright", "chromium", "BrowserContext", "createPlaywrightChromiumBrowserRuntime"]) assert.equal(workerSource.toLowerCase().includes(forbidden.toLowerCase()), false, `worker must not contain ${forbidden}`);
  console.log("PASS — contact-form static preflight integration");
})().catch((error) => { console.error(error); process.exitCode = 1; });
