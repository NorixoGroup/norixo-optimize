import { readFile } from "node:fs/promises";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * The public surface is the FINAL `return { ... }` of createAutomationProductionComposition(), anchored on its
 * first property. An earlier `return {` in the file (for example a helper's) must never be mistaken for it.
 */
function finalReturnBlock(source: string): string {
  const start = source.lastIndexOf("\n  return {\n    prepareBacklinksDryRun,");
  assert(start !== -1, "Public composition surface not found");
  const end = source.indexOf("\n  };\n}", start);
  assert(end !== -1, "Public composition surface is not terminated");
  return source.slice(start, end);
}

function exposedPropertyNamesOf(block: string): string[] {
  return Array.from(block.matchAll(/^\s{4}([A-Za-z_$][\w$]*)(?=[:,])/gm), (match) => match[1]);
}

/**
 * The only environment read allowed in the composition is the live follow-up inbound reply domain
 * (wired in commit 60ad125). Any other process.env access, including Brave or scheduling flags, must fail.
 */
function assertOnlyAllowedEnvironmentRead(source: string): void {
  const reads = source.match(/process\.env(?:\.[A-Za-z0-9_]+|\[[^\]]*\])?/g) ?? [];
  assert(
    reads.length === 1 && reads[0] === "process.env.OUTREACH_INBOUND_REPLY_DOMAIN",
    `Composition may only read process.env.OUTREACH_INBOUND_REPLY_DOMAIN (found: ${reads.join(", ") || "none"})`,
  );
  assert(
    source.includes("inboundReplyDomain: process.env.OUTREACH_INBOUND_REPLY_DOMAIN,"),
    "The allowed environment read must stay the live follow-up inboundReplyDomain",
  );
}

async function main(): Promise<void> {
  const source = await readFile("lib/automation/production-composition.ts", "utf8");
  const requiredFragments = [
    "export function createAutomationProductionComposition",
    "const client = createSupabaseAdminClient()",
    "const discoveryProviders: BacklinkDiscoveryProviderRegistry =",
    "isBacklinkDiscoveryDemoProviderEnabled()",
    "mock: createMockBacklinkDiscoveryProvider(demoBacklinkDiscoveryFixtures)",
    "readBraveBacklinkDiscoveryRuntimeConfig()",
    "braveConfig.enabled",
    "brave_search: createBudgetedBacklinkDiscoveryProvider(",
    "createBraveBacklinkDiscoveryProvider({",
    "reserveBacklinkBraveRequest(client, reservation)",
    "fetchImplementation: fetch",
    "BACKLINK_DISCOVERY_BRAVE_LIMIT_EXCEEDED",
    "createDryRunAutomationTaskHandlers({",
    "providers: discoveryProviders",
    "getTaskByIdInRun: (input) => getAutomationTaskByIdInRun(client, input)",
    "qualificationPolicy: DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1",
    "promotionPolicy: DEFAULT_BACKLINK_PROMOTION_POLICY_V1",
    "executeHandler },",
    "prepareBacklinksDryRun,",
    "executeWorkerOnce,",
    "executeBacklinksDryRun,",
    "runBacklinksSchedulerTick:",
    "runBacklinksAutomationSchedulerTick",
    "{ prepareBacklinksDryRun, executeBacklinksDryRun }",
    "prepareBacklinksAutomationRun",
    "executeAutomationWorkerOnce",
    "executeBacklinksDryRunOrchestrator",
  ];

  for (const fragment of requiredFragments) {
    assert(source.includes(fragment), fragment);
  }

  const surface = finalReturnBlock(source);
  const publicProperties = [
    "prepareBacklinksDryRun",
    "executeWorkerOnce",
    "executeBacklinksDryRun",
    "runBacklinksSchedulerTick",
    "prepareBacklinkCampaignPreviewRun",
    "executeBacklinkCampaignPreviewRun",
    "resumeBacklinksDryRun",
  ];

  for (const property of publicProperties) {
    assert(surface.includes(property), `Missing public function ${property}`);
  }
  const exposedPropertyNames = exposedPropertyNamesOf(surface);

  assert(
    exposedPropertyNames.length === 7,
    `Composition must expose exactly seven public functions (found: ${exposedPropertyNames.join(", ")})`,
  );

  for (const property of publicProperties) {
    assert(
      exposedPropertyNames.includes(property),
      `Missing public function ${property}`,
    );
  }

  for (const unexpectedProperty of [
    "client",
    "discoveryProviders",
    "handlers",
  ]) {
    assert(
      !exposedPropertyNames.includes(unexpectedProperty),
      `Composition must not expose ${unexpectedProperty}`,
    );
  }
  for (const forbidden of [
    "dryRunAutomationTaskHandlers",
    "dataforseo_serp",
    "setInterval",
    "setTimeout",
    "fetch(",
    "process.env.BACKLINK_PROMOTION",
  ]) {
    assert(!source.includes(forbidden), `Forbidden ${forbidden}`);
  }

  // Environment reads: exactly one is allowed (previously a blanket ban that no longer matched the code).
  assertOnlyAllowedEnvironmentRead(source);

  // `try {`: exactly one is allowed, inside the live follow-up task handler that precedes the composition.
  const compositionStart = source.indexOf("export function createAutomationProductionComposition");
  assert(compositionStart !== -1, "Composition function not found");
  const tryBlocks = Array.from(source.matchAll(/\btry \{/g));
  assert(tryBlocks.length === 1, `Exactly one try block is allowed (found ${tryBlocks.length})`);
  const tryIndex = tryBlocks[0].index ?? -1;
  assert(
    tryIndex !== -1 &&
      tryIndex < compositionStart &&
      source.lastIndexOf("export function createBacklinkOutreachLiveFollowUpTaskHandler", tryIndex) !== -1 &&
      source.slice(tryIndex, tryIndex + 800).includes("LIVE_FOLLOW_UP_NOT_ENABLED"),
    "The only try block must be the live follow-up handler's LIVE_FOLLOW_UP_NOT_ENABLED guard, outside the composition body",
  );

  const runtimeDynamicImports = source
    .split("\n")
    .filter(
      (line) =>
        line.includes("import(") &&
        !line.includes("typeof import("),
    );

  assert(
    runtimeDynamicImports.length === 0,
    "Runtime dynamic imports must not be used",
  );

  console.log("PASS — Automation production composition smoke");
}

void main();
