import {
  createMockBacklinkDiscoveryProvider,
  resolveBacklinkDiscoveryProvider,
  type BacklinkDiscoveryProviderSearchInput,
  type MockBacklinkDiscoveryFixture,
} from "../lib/automation";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function assertRejects(
  operation: () => Promise<unknown>,
  message: string,
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    assert(error instanceof Error && error.message.includes(message), message);
    return;
  }

  throw new Error(`Expected rejection: ${message}`);
}

const fixtures: readonly MockBacklinkDiscoveryFixture[] = [
  {
    query: "airbnb host resources",
    countryCode: "US",
    languageCode: "en",
    items: [
      { url: "https://example.com/resources", title: "Resources", snippet: "First", rank: 1 },
      { url: "https://example.com/tools", title: "Tools", snippet: "Second", rank: 2 },
    ],
  },
  {
    query: "airbnb host resources",
    countryCode: "FR",
    languageCode: "fr",
    items: [{ url: "https://example.fr/ressources", title: "Ressources", snippet: null, rank: 1 }],
  },
];

const input: BacklinkDiscoveryProviderSearchInput = {
  query: "airbnb host resources",
  queryIndex: 0,
  countryCode: "US",
  languageCode: "en",
  maxResults: 2,
};

async function main(): Promise<void> {
  const fixturesBefore = JSON.stringify(fixtures);
  const inputBefore = JSON.stringify(input);
  const provider = createMockBacklinkDiscoveryProvider(fixtures);
  const resolved = resolveBacklinkDiscoveryProvider({ mock: provider }, "mock");

  assert(resolved === provider, "Resolution must return the exact provider");
  await assertRejects(
    async () => resolveBacklinkDiscoveryProvider({}, "mock"),
    "BACKLINK_DISCOVERY_PROVIDER_NOT_CONFIGURED",
  );

  const first = await provider.search(input);
  const second = await provider.search(input);
  assert(JSON.stringify(first) === JSON.stringify(second), "Identical searches must be deterministic");
  assert(first.items.length === 2 && first.items[0]?.rank === 1 && first.items[1]?.rank === 2, "Fixture order must be preserved");
  assert(first.items !== fixtures[0]?.items, "Provider must not expose fixture items directly");

  const limited = await provider.search({ ...input, maxResults: 1 });
  assert(limited.items.length === 1 && limited.items[0]?.rank === 1, "maxResults must limit results");
  const noFixture = await provider.search({ ...input, query: "unknown query" });
  assert(noFixture.items.length === 0, "Unknown fixture must return no items");
  const french = await provider.search({ ...input, countryCode: "FR", languageCode: "fr" });
  assert(french.items.length === 1 && french.items[0]?.url === "https://example.fr/ressources", "Locale must select its fixture");
  const wrongCountry = await provider.search({ ...input, countryCode: "GB" });
  const wrongLanguage = await provider.search({ ...input, languageCode: "fr" });
  assert(wrongCountry.items.length === 0 && wrongLanguage.items.length === 0, "Locale mismatches must not match fixtures");

  await assertRejects(() => provider.search({ ...input, query: "   " }), "discovery provider query must not be empty");
  await assertRejects(() => provider.search({ ...input, queryIndex: -1 }), "queryIndex must be an integer");
  await assertRejects(() => provider.search({ ...input, maxResults: 11 }), "maxResults must be an integer between 1 and 10");
  await assertRejects(() => provider.search({ ...input, countryCode: "us" }), "countryCode must be an uppercase");
  await assertRejects(() => provider.search({ ...input, languageCode: "EN" }), "languageCode must be a lowercase");

  assert(JSON.stringify(input) === inputBefore, "Input must not mutate");
  assert(JSON.stringify(fixtures) === fixturesBefore, "Fixtures must not mutate");
  assert(first.items[0]?.title === "Resources", "Previous result must remain unchanged");
  console.log("PASS — Automation backlink discovery provider smoke");
}

void main();
