import { readFile } from "node:fs/promises";

import { readBraveBacklinkDiscoveryRuntimeConfig } from "../lib/automation";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const variables = [
  "BACKLINK_DISCOVERY_BRAVE_ENABLED",
  "BACKLINK_DISCOVERY_BRAVE_API_KEY",
  "BACKLINK_DISCOVERY_BRAVE_MAX_SEARCHES_PER_RUN",
  "BACKLINK_DISCOVERY_BRAVE_MAX_RESULTS_PER_SEARCH",
] as const;

function withEnvironment(
  values: Readonly<Partial<Record<(typeof variables)[number], string>>>,
  operation: () => void,
): void {
  const original = new Map<string, string | undefined>(
    variables.map((variable) => [variable, process.env[variable]]),
  );

  try {
    for (const variable of variables) {
      const value = values[variable];
      if (value === undefined) {
        delete process.env[variable];
      } else {
        process.env[variable] = value;
      }
    }
    operation();
  } finally {
    for (const variable of variables) {
      const value = original.get(variable);
      if (value === undefined) {
        delete process.env[variable];
      } else {
        process.env[variable] = value;
      }
    }
  }
}

function assertConfigurationError(operation: () => void, token: string): void {
  try {
    operation();
  } catch (error) {
    assert(
      error instanceof Error &&
        error.message === "BACKLINK_DISCOVERY_BRAVE_CONFIGURATION_INVALID" &&
        !error.message.includes(token),
      "Expected safe Brave configuration error",
    );
    return;
  }

  throw new Error("Expected Brave configuration error");
}

async function main(): Promise<void> {
  withEnvironment({}, () => {
    const configuration = readBraveBacklinkDiscoveryRuntimeConfig();
    assert(
      configuration.enabled === false &&
        configuration.maxSearchesPerRun === 3 &&
        configuration.maxResultsPerSearch === 10,
      "Absent flag is disabled with defaults",
    );
  });
  withEnvironment({ BACKLINK_DISCOVERY_BRAVE_ENABLED: "false" }, () => {
    assert(!readBraveBacklinkDiscoveryRuntimeConfig().enabled, "False flag is disabled");
  });
  withEnvironment({ BACKLINK_DISCOVERY_BRAVE_ENABLED: "TRUE" }, () => {
    assert(!readBraveBacklinkDiscoveryRuntimeConfig().enabled, "Only lowercase true enables Brave");
  });
  withEnvironment({ BACKLINK_DISCOVERY_BRAVE_ENABLED: "true" }, () => {
    assertConfigurationError(
      () => readBraveBacklinkDiscoveryRuntimeConfig(),
      "test-subscription-token",
    );
  });
  withEnvironment(
    {
      BACKLINK_DISCOVERY_BRAVE_ENABLED: "true",
      BACKLINK_DISCOVERY_BRAVE_API_KEY: " test-subscription-token ",
    },
    () => {
      const configuration = readBraveBacklinkDiscoveryRuntimeConfig();
      assert(
        configuration.enabled &&
          configuration.subscriptionToken === "test-subscription-token" &&
          configuration.maxSearchesPerRun === 3 &&
          configuration.maxResultsPerSearch === 10,
        "Enabled Brave configuration",
      );
    },
  );
  withEnvironment(
    {
      BACKLINK_DISCOVERY_BRAVE_MAX_SEARCHES_PER_RUN: "2",
      BACKLINK_DISCOVERY_BRAVE_MAX_RESULTS_PER_SEARCH: "4",
    },
    () => {
      const configuration = readBraveBacklinkDiscoveryRuntimeConfig();
      assert(
        configuration.maxSearchesPerRun === 2 &&
          configuration.maxResultsPerSearch === 4,
        "Explicit limits",
      );
    },
  );
  for (const values of [
    { BACKLINK_DISCOVERY_BRAVE_MAX_SEARCHES_PER_RUN: "0" },
    { BACKLINK_DISCOVERY_BRAVE_MAX_SEARCHES_PER_RUN: "11" },
    { BACKLINK_DISCOVERY_BRAVE_MAX_RESULTS_PER_SEARCH: "1.5" },
    { BACKLINK_DISCOVERY_BRAVE_MAX_RESULTS_PER_SEARCH: "invalid" },
  ]) {
    withEnvironment(values, () => {
      assertConfigurationError(
        () => readBraveBacklinkDiscoveryRuntimeConfig(),
        "test-subscription-token",
      );
    });
  }

  const source = await readFile("lib/automation/production-composition.ts", "utf8");
  for (const fragment of [
    "isBacklinkDiscoveryDemoProviderEnabled()",
    "readBraveBacklinkDiscoveryRuntimeConfig()",
    "braveConfig.enabled",
    "mock: createMockBacklinkDiscoveryProvider(demoBacklinkDiscoveryFixtures)",
    "brave_search: createBraveBacklinkDiscoveryProvider({",
    "fetchImplementation: fetch",
    "BACKLINK_DISCOVERY_BRAVE_LIMIT_EXCEEDED",
    "handlerInput.input.searches.length > braveConfig.maxSearchesPerRun",
    "handlerInput.input.maxResultsPerSearch > braveConfig.maxResultsPerSearch",
  ]) {
    assert(source.includes(fragment), `Missing ${fragment}`);
  }
  assert(!source.includes("process.env"), "Composition must delegate environment reads");
  assert(!source.includes("fetch("), "Composition must not fetch at creation");
  const surface = source.match(/return \{([\s\S]*?)\n  \};/);
  assert(surface !== null, "Public composition surface");
  for (const property of [
    "prepareBacklinksDryRun",
    "executeWorkerOnce",
    "executeBacklinksDryRun",
    "runBacklinksSchedulerTick",
  ]) {
    assert(surface[1].includes(property), `Missing ${property}`);
  }
  assert(!surface[1].includes("client"), "Client must not be public");
  assert(!surface[1].includes("braveConfig"), "Config must not be public");
  assert(!surface[1].includes("discoveryProviders"), "Providers must not be public");

  console.log("PASS — Automation Brave production composition smoke");
}

void main();
