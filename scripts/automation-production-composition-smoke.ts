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
  ];

  for (const property of publicProperties) {
    assert(surface[1].includes(property), `Missing public function ${property}`);
  }
  assert(!surface[1].includes("client"), "Client must not be returned");
  assert(!surface[1].includes("Providers"), "Provider registry must not be returned");
  assert(!surface[1].includes("Handlers"), "Handlers must not be returned");
  for (const forbidden of [
    "dryRunAutomationTaskHandlers",
    "dataforseo_serp",
    "process.env",
    "setInterval",
    "setTimeout",
    "fetch(",
    "try {",
    "import(",
  ]) {
    assert(!source.includes(forbidden), `Forbidden ${forbidden}`);
  }

  console.log("PASS — Automation production composition smoke");
}

void main();
