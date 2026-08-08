import { readFile } from "node:fs/promises";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
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
    "brave_search: createBraveBacklinkDiscoveryProvider({",
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

  const surface = source.match(/return \{([\s\S]*?)\n  \};/);
  assert(surface !== null, "Public composition surface not found");
  const publicProperties = [
    "prepareBacklinksDryRun",
    "executeWorkerOnce",
    "executeBacklinksDryRun",
    "runBacklinksSchedulerTick",
    "prepareBacklinkCampaignPreviewRun",
    "executeBacklinkCampaignPreviewRun",
  ];

  for (const property of publicProperties) {
    assert(surface[1].includes(property), `Missing public function ${property}`);
  }
  const exposedPropertyNames = Array.from(
    surface[1].matchAll(/^\s{4}([A-Za-z_$][\w$]*)(?=[:,])/gm),
    (match) => match[1],
  );

  assert(
    exposedPropertyNames.length === 6,
    "Composition must expose exactly six public functions",
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
    "process.env",
    "setInterval",
    "setTimeout",
    "fetch(",
    "try {",
    "process.env.BACKLINK_PROMOTION",
  ]) {
    assert(!source.includes(forbidden), `Forbidden ${forbidden}`);
  }

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
