import type { BacklinkRepositoryClient } from "../repositories/repositoryClient";
import { getBacklinkContactById } from "../repositories/contactsRepository";
import { claimContactFormVerificationPreflight, completeContactFormVerificationPreflight } from "../repositories/contactFormVerificationPreflightRepository";
import { persistVerifiedContactFormEvidence } from "../repositories/contactFormAutomationRepository";
import { buildContactFormPinnedConnectionTarget } from "./contactFormProxyPolicy";
import {
  createPlaywrightChromiumBrowserRuntime,
  validateContactFormNavigationUrl,
  type ContactFormBrowserPage,
  type ContactFormDnsResolver,
} from "./contactFormNavigationWorker";
import { inspectContactFormVerificationPreflight, type ContactFormVerificationPreflightPage } from "./contactFormVerificationPreflightService";

const NAVIGATION_TIMEOUT_MS = 15_000;
const TOTAL_RUNTIME_TIMEOUT_MS = 30_000;
const MAX_NAVIGATION_REQUESTS = 6;

async function withinRuntimeLimit<T>(promise: Promise<T>): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("CONTACT_FORM_PREFLIGHT_RUNTIME_TIMEOUT")), TOTAL_RUNTIME_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeout != null) clearTimeout(timeout);
  }
}

function readonlyPage(page: ContactFormBrowserPage): ContactFormVerificationPreflightPage {
  return {
    goto: page.goto,
    url: page.url,
    evaluatePageSignals: page.evaluatePageSignals,
    inspectForms: page.inspectForms,
    listSubmitControls: page.listSubmitControls,
  };
}

async function openPinnedReadOnlyPage(input: {
  hostname: string;
  address: string;
  port: number;
  formUrl: string;
  resolveHostname: ContactFormDnsResolver;
}): Promise<{ page: ContactFormVerificationPreflightPage; close: () => Promise<void> }> {
  const runtime = await createPlaywrightChromiumBrowserRuntime({
    serviceWorkers: "block",
    blockDirectWebRtc: true,
  });
  try {
    const session = await runtime.openContext({
      pinnedTarget: buildContactFormPinnedConnectionTarget({
        authorityHostname: input.hostname,
        selectedAddress: { address: input.address, family: input.address.includes(":") ? 6 : 4 },
        port: input.port,
      }),
    });
    let navigationCount = 0;
    let policyViolation: Error | null = null;
    if (session.page.routeWebSockets == null) throw new Error("CONTACT_FORM_PREFLIGHT_WEBSOCKET_POLICY_UNAVAILABLE");
    await session.page.routeWebSockets(() => {
      policyViolation ??= new Error("CONTACT_FORM_PREFLIGHT_WEBSOCKET_BLOCKED");
    });
    await session.page.routeRequests(async (request) => {
      const method = request.method.toUpperCase();
      if (method !== "GET" && method !== "HEAD") {
        policyViolation ??= new Error("CONTACT_FORM_PREFLIGHT_NON_READ_METHOD_BLOCKED");
        return "abort";
      }
      if (request.isNavigationRequest) navigationCount += 1;
      if (navigationCount > MAX_NAVIGATION_REQUESTS) {
        policyViolation ??= new Error("CONTACT_FORM_PREFLIGHT_REDIRECT_LIMIT_EXCEEDED");
        return "abort";
      }
      const target = await validateContactFormNavigationUrl(request.url, input.resolveHostname);
      if (!target.ok || target.hostname !== input.hostname || Number(target.url.port || "443") !== input.port) {
        policyViolation ??= new Error(target.ok ? "CONTACT_FORM_PREFLIGHT_PINNED_TARGET_MISMATCH" : target.code);
        return "abort";
      }
      return "continue";
    });
    session.page.onPopup(() => { policyViolation ??= new Error("CONTACT_FORM_PREFLIGHT_POPUP_BLOCKED"); });
    session.page.onDownload(() => { policyViolation ??= new Error("CONTACT_FORM_PREFLIGHT_DOWNLOAD_BLOCKED"); });
    return {
      page: {
        ...readonlyPage(session.page),
        goto: async (url, options) => {
          await session.page.goto(url, { timeoutMs: Math.min(options.timeoutMs, NAVIGATION_TIMEOUT_MS) });
          if (policyViolation != null) throw policyViolation;
          if (session.page.url() !== input.formUrl) {
            const finalTarget = await validateContactFormNavigationUrl(session.page.url(), input.resolveHostname);
            if (!finalTarget.ok || finalTarget.hostname !== input.hostname || Number(finalTarget.url.port || "443") !== input.port) {
              throw new Error("CONTACT_FORM_PREFLIGHT_UNSAFE_REDIRECT");
            }
          }
        },
      },
      close: async () => { await session.close(); await runtime.close?.(); },
    };
  } catch (error) {
    await runtime.close?.();
    throw error;
  }
}

export async function executeContactFormVerificationPreflight(input: { client: BacklinkRepositoryClient; workspaceId: string; preflightId: string; workerId: string; resolveHostname: ContactFormDnsResolver; openReadOnlyPage?: (input: { hostname: string; address: string; port: number; formUrl: string }) => Promise<{ page: ContactFormVerificationPreflightPage; close: () => Promise<void> }> }) {
  const claimed = await claimContactFormVerificationPreflight(input.client, { workspaceId: input.workspaceId, preflightId: input.preflightId, workerId: input.workerId, startedAt: new Date().toISOString() });
  if (claimed.status !== "running" || claimed.worker_id !== input.workerId) return claimed;
  const contact = await getBacklinkContactById(input.client, input.workspaceId, claimed.contact_id);
  if (contact.contact_form_url !== claimed.form_url) return completeContactFormVerificationPreflight(input.client, { workspaceId: input.workspaceId, preflightId: claimed.id, workerId: input.workerId, status: "blocked", safeErrorCode: "CONTACT_FORM_PREFLIGHT_FORM_MISMATCH", completedAt: new Date().toISOString() });
  const target = await validateContactFormNavigationUrl(claimed.form_url, input.resolveHostname);
  if (!target.ok) return completeContactFormVerificationPreflight(input.client, { workspaceId: input.workspaceId, preflightId: claimed.id, workerId: input.workerId, status: "blocked", safeErrorCode: target.code, completedAt: new Date().toISOString() });
  let session: { page: ContactFormVerificationPreflightPage; close: () => Promise<void> } | null = null;
  try {
    session = input.openReadOnlyPage != null
      ? await input.openReadOnlyPage({ hostname: target.hostname, address: target.selectedAddress.address, port: Number(target.url.port || "443"), formUrl: target.url.href })
      : await openPinnedReadOnlyPage({ hostname: target.hostname, address: target.selectedAddress.address, port: Number(target.url.port || "443"), formUrl: target.url.href, resolveHostname: input.resolveHostname });
    const result = await withinRuntimeLimit(inspectContactFormVerificationPreflight({ page: session.page, formUrl: target.url.href }));
    if (result.status === "verified") await persistVerifiedContactFormEvidence(input.client, { workspaceId: input.workspaceId, contactId: contact.id, formUrl: claimed.form_url, verifiedAt: new Date().toISOString(), evidenceVersion: result.evidenceVersion, safeEvidence: result.safeEvidence as never });
    return completeContactFormVerificationPreflight(input.client, { workspaceId: input.workspaceId, preflightId: claimed.id, workerId: input.workerId, status: result.status, safeErrorCode: "safeErrorCode" in result ? result.safeErrorCode : null, completedAt: new Date().toISOString() });
  } catch (error) {
    return completeContactFormVerificationPreflight(input.client, { workspaceId: input.workspaceId, preflightId: claimed.id, workerId: input.workerId, status: "failed", safeErrorCode: error instanceof Error && error.message.startsWith("CONTACT_FORM_") ? error.message : "CONTACT_FORM_PREFLIGHT_RUNTIME_FAILED", completedAt: new Date().toISOString() });
  } finally { await session?.close(); }
}
