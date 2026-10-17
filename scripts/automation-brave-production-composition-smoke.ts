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
    "brave_search: createBudgetedBacklinkDiscoveryProvider(",
    "createBraveBacklinkDiscoveryProvider({",
    "reserveBacklinkBraveRequest(client, reservation)",
    "fetchImplementation: fetch",
    "BACKLINK_DISCOVERY_BRAVE_LIMIT_EXCEEDED",
    "handlerInput.input.searches.length > braveConfig.maxSearchesPerRun",
    "handlerInput.input.maxResultsPerSearch > braveConfig.maxResultsPerSearch",
  ]) {
    assert(source.includes(fragment), `Missing ${fragment}`);
  }
  // Composition delegates Brave/budget/scheduling environment reads; only the follow-up reply domain is read here.
  assertOnlyAllowedEnvironmentRead(source);
  assert(!source.includes("fetch("), "Composition must not fetch at creation");
  const surface = finalReturnBlock(source);
  for (const property of [
    "prepareBacklinksDryRun",
    "executeWorkerOnce",
    "executeBacklinksDryRun",
    "runBacklinksSchedulerTick",
  ]) {
    assert(surface.includes(property), `Missing ${property}`);
  }
  // Inspect the properties actually exposed, not substrings of function bodies (which legitimately use `client`).
  const exposedPropertyNames = exposedPropertyNamesOf(surface);
  assert(!exposedPropertyNames.includes("client"), "Client must not be public");
  assert(!exposedPropertyNames.includes("braveConfig"), "Config must not be public");
  assert(!exposedPropertyNames.includes("discoveryProviders"), "Providers must not be public");
  assert(!surface.includes("braveConfig"), "Config must not be reachable from the public surface");
  assert(!surface.includes("discoveryProviders"), "Providers must not be reachable from the public surface");

  console.log("PASS — Automation Brave production composition smoke");
}

void main();
