import {
  createMockBacklinkDiscoveryProvider,
  isBacklinkDiscoveryDemoProviderEnabled,
  resolveBacklinkDiscoveryProvider,
} from "../lib/automation";
import { demoBacklinkDiscoveryFixtures } from "../lib/automation/demo-backlink-discovery-fixtures";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function withDemoProviderFlag(value: string | undefined, operation: () => void): void {
  const original = process.env.BACKLINK_DISCOVERY_DEMO_PROVIDER_ENABLED;

  try {
    if (value === undefined) {
      delete process.env.BACKLINK_DISCOVERY_DEMO_PROVIDER_ENABLED;
    } else {
      process.env.BACKLINK_DISCOVERY_DEMO_PROVIDER_ENABLED = value;
    }

    operation();
  } finally {
    if (original === undefined) {
      delete process.env.BACKLINK_DISCOVERY_DEMO_PROVIDER_ENABLED;
    } else {
      process.env.BACKLINK_DISCOVERY_DEMO_PROVIDER_ENABLED = original;
    }
  }
}

function assertMockIsNotConfigured(): void {
  try {
    resolveBacklinkDiscoveryProvider({}, "mock");
  } catch (error) {
    assert(
      error instanceof Error && error.message === "BACKLINK_DISCOVERY_PROVIDER_NOT_CONFIGURED",
      "Mock must not be configured",
    );
    return;
  }

  throw new Error("Expected missing mock provider");
}

async function main(): Promise<void> {
  withDemoProviderFlag(undefined, () => {
    assert(!isBacklinkDiscoveryDemoProviderEnabled(), "Absent flag must be disabled");
    assertMockIsNotConfigured();
  });
  withDemoProviderFlag("false", () => {
    assert(!isBacklinkDiscoveryDemoProviderEnabled(), "false flag must be disabled");
    assertMockIsNotConfigured();
  });
  withDemoProviderFlag("TRUE", () => {
    assert(!isBacklinkDiscoveryDemoProviderEnabled(), "Uppercase flag must be disabled");
    assertMockIsNotConfigured();
  });
  withDemoProviderFlag("true", () => {
    assert(isBacklinkDiscoveryDemoProviderEnabled(), "true flag must enable the demo provider");
  });

  const provider = createMockBacklinkDiscoveryProvider(demoBacklinkDiscoveryFixtures);
  const resolved = resolveBacklinkDiscoveryProvider({ mock: provider }, "mock");
  const input = {
    query: "airbnb host resources",
    queryIndex: 0,
    countryCode: "US",
    languageCode: "en",
    maxResults: 10,
  };
  const first = await resolved.search(input);
  const second = await resolved.search(input);
  assert(JSON.stringify(first) === JSON.stringify(second), "Demo provider must be deterministic");
  assert(
    first.items.length === 5 &&
      first.items.map((item) => item.rank).join(",") === "1,2,3,4,5" &&
      first.items.map((item) => item.url).join(",") ===
        "https://host-resources.example/resources,https://vacation-tools.example/best-airbnb-tools,https://rental-guides.example/airbnb-host-guide,https://hospitality-lab.example/resources/hosts,https://partner-preview.example/host-resources",
    "Demo fixtures must have exact order, ranks, and URLs",
  );
  const unknown = await resolved.search({ ...input, query: "unknown query" });
  assert(unknown.items.length === 0, "Unknown queries must not invent results");
  assert(
    !JSON.stringify(first).includes("BACKLINK_DISCOVERY_DEMO_PROVIDER_ENABLED"),
    "Flag must not appear in provider output",
  );
  console.log("PASS — Automation backlink discovery production mock smoke");
}

void main();
