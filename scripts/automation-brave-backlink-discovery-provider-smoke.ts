import {
  BacklinkDiscoveryProviderError,
  createBraveBacklinkDiscoveryProvider,
  type BacklinkDiscoveryProviderSearchInput,
} from "../lib/automation";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertThrows(operation: () => void, code: string): void {
  try {
    operation();
  } catch (error) {
    assert(
      error instanceof BacklinkDiscoveryProviderError &&
        error.code === code &&
        error.retryable === false,
      `Expected ${code}`,
    );
    return;
  }

  throw new Error(`Expected ${code}`);
}

async function assertProviderError(
  operation: () => Promise<unknown>,
  code: BacklinkDiscoveryProviderError["code"],
  retryable: boolean,
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    assert(
      error instanceof BacklinkDiscoveryProviderError &&
        error.code === code &&
        error.retryable === retryable,
      `Expected ${code}`,
    );
    assert(!error.message.includes("test-subscription-token"), "Token must remain secret");
    return;
  }

  throw new Error(`Expected ${code}`);
}

type RecordedFetch = {
  url: string;
  init: RequestInit | undefined;
};

function toUrl(resource: RequestInfo | URL): URL {
  if (resource instanceof URL) {
    return resource;
  }
  if (typeof resource === "string") {
    return new URL(resource);
  }
  return new URL(resource.url);
}

function responseFetch(
  payload: unknown,
  records: RecordedFetch[],
  status = 200,
): typeof fetch {
  return async (resource, init) => {
    records.push({ url: toUrl(resource).toString(), init });
    return new Response(JSON.stringify(payload), { status });
  };
}

function throwingFetch(records: RecordedFetch[]): typeof fetch {
  return async (resource, init) => {
    records.push({ url: toUrl(resource).toString(), init });
    throw new Error("deterministic fetch failure");
  };
}

function invalidJsonFetch(records: RecordedFetch[]): typeof fetch {
  return async (resource, init) => {
    records.push({ url: toUrl(resource).toString(), init });
    return new Response("not-json", { status: 200 });
  };
}

const input: BacklinkDiscoveryProviderSearchInput = {
  query: "airbnb host resources",
  queryIndex: 2,
  countryCode: "US",
  languageCode: "en",
  maxResults: 2,
};

const payload = {
  web: {
    results: [
      {
        url: " https://example.com/resources ",
        title: " Resources ",
        description: " Helpful links ",
      },
      { title: "Missing URL", description: "Ignored" },
      {
        url: "https://example.com/tools",
        title: "   ",
        description: "   ",
      },
      {
        url: "https://example.com/ignored-by-limit",
        title: "Ignored by limit",
        description: "Ignored by limit",
      },
    ],
  },
};

async function main(): Promise<void> {
  assertThrows(
    () =>
      createBraveBacklinkDiscoveryProvider({
        subscriptionToken: "",
        fetchImplementation: responseFetch({}, []),
      }),
    "PROVIDER_CONFIGURATION_ERROR",
  );
  assertThrows(
    () =>
      createBraveBacklinkDiscoveryProvider({
        subscriptionToken: "   ",
        fetchImplementation: responseFetch({}, []),
      }),
    "PROVIDER_CONFIGURATION_ERROR",
  );
  assertThrows(
    () =>
      createBraveBacklinkDiscoveryProvider({
        subscriptionToken: "test-subscription-token",
        fetchImplementation: responseFetch({}, []),
        endpoint: "http://example.test/search",
      }),
    "PROVIDER_CONFIGURATION_ERROR",
  );
  assertThrows(
    () =>
      createBraveBacklinkDiscoveryProvider({
        subscriptionToken: "test-subscription-token",
        fetchImplementation: responseFetch({}, []),
        endpoint: "not a URL",
      }),
    "PROVIDER_CONFIGURATION_ERROR",
  );

  const records: RecordedFetch[] = [];
  const provider = createBraveBacklinkDiscoveryProvider({
    subscriptionToken: " test-subscription-token ",
    fetchImplementation: responseFetch(payload, records),
    endpoint: "https://brave.test/res/v1/web/search",
  });
  const inputBefore = JSON.stringify(input);
  const payloadBefore = JSON.stringify(payload);
  const first = await provider.search(input);
  const second = await provider.search(input);

  assert(provider.name === "brave_search", "Provider name");
  assert(records.length === 2, "One fetch per search");
  const request = records[0];
  assert(request !== undefined, "Recorded request");
  const requestUrl = new URL(request.url);
  assert(
    requestUrl.origin === "https://brave.test" &&
      requestUrl.pathname === "/res/v1/web/search",
    "Endpoint exact",
  );
  assert(
    JSON.stringify([...requestUrl.searchParams.keys()].sort()) ===
      JSON.stringify(["count", "country", "q", "search_lang"]),
    "Only Brave parameters",
  );
  assert(
    requestUrl.searchParams.get("q") === input.query &&
      requestUrl.searchParams.get("count") === "2" &&
      requestUrl.searchParams.get("country") === "US" &&
      requestUrl.searchParams.get("search_lang") === "en",
    "Brave parameters",
  );
  assert(
    request.init?.method === "GET" &&
      request.init.cache === "no-store" &&
      request.init.body === undefined,
    "GET without body and no-store",
  );
  const headers = new Headers(request.init?.headers);
  assert(
    headers.get("Accept") === "application/json" &&
      headers.get("X-Subscription-Token") === "test-subscription-token",
    "Required headers",
  );
  assert(!request.url.includes("test-subscription-token"), "Token absent from URL");
  assert(first.query === input.query && first.queryIndex === input.queryIndex, "Result identity");
  assert(first.items.length === 2, "Maximum respected");
  assert(
    first.items[0]?.url === "https://example.com/resources" &&
      first.items[0]?.title === "Resources" &&
      first.items[0]?.snippet === "Helpful links" &&
      first.items[0]?.rank === 1,
    "First item mapping",
  );
  assert(
    first.items[1]?.url === "https://example.com/tools" &&
      first.items[1]?.title === null &&
      first.items[1]?.snippet === null &&
      first.items[1]?.rank === 3,
    "Order and blank mapping",
  );
  assert(JSON.stringify(first) === JSON.stringify(second), "Deterministic content");
  assert(first !== second && first.items !== second.items, "Independent results");
  assert(JSON.stringify(input) === inputBefore, "Input immutable");
  assert(JSON.stringify(payload) === payloadBefore, "Payload immutable");

  const localeRecords: RecordedFetch[] = [];
  const localeProvider = createBraveBacklinkDiscoveryProvider({
    subscriptionToken: "test-subscription-token",
    fetchImplementation: responseFetch({ web: {} }, localeRecords),
    endpoint: "https://brave.test/search",
  });
  const noLocales = await localeProvider.search({
    ...input,
    countryCode: null,
    languageCode: null,
  });
  assert(noLocales.items.length === 0, "Missing results returns empty items");
  const localeUrl = new URL(localeRecords[0]?.url ?? "");
  assert(
    !localeUrl.searchParams.has("country") && !localeUrl.searchParams.has("search_lang"),
    "Null locales omitted",
  );

  const defaultEndpointRecords: RecordedFetch[] = [];
  const defaultEndpointProvider = createBraveBacklinkDiscoveryProvider({
    subscriptionToken: "test-subscription-token",
    fetchImplementation: responseFetch({ web: {} }, defaultEndpointRecords),
  });
  await defaultEndpointProvider.search(input);
  assert(
    new URL(defaultEndpointRecords[0]?.url ?? "").origin === "https://api.search.brave.com",
    "Default Brave endpoint",
  );

  await assertProviderError(
    () =>
      createBraveBacklinkDiscoveryProvider({
        subscriptionToken: "test-subscription-token",
        fetchImplementation: throwingFetch([]),
        endpoint: "https://brave.test/search",
      }).search(input),
    "PROVIDER_TRANSIENT_ERROR",
    true,
  );
  for (const [status, code, retryable] of [
    [401, "PROVIDER_CONFIGURATION_ERROR", false],
    [403, "PROVIDER_CONFIGURATION_ERROR", false],
    [429, "PROVIDER_QUOTA_EXCEEDED", true],
    [500, "PROVIDER_TRANSIENT_ERROR", true],
    [503, "PROVIDER_TRANSIENT_ERROR", true],
    [418, "PROVIDER_INVALID_RESPONSE", false],
  ] as const) {
    await assertProviderError(
      () =>
        createBraveBacklinkDiscoveryProvider({
          subscriptionToken: "test-subscription-token",
          fetchImplementation: responseFetch({}, [], status),
          endpoint: "https://brave.test/search",
        }).search(input),
      code,
      retryable,
    );
  }
  await assertProviderError(
    () =>
      createBraveBacklinkDiscoveryProvider({
        subscriptionToken: "test-subscription-token",
        fetchImplementation: invalidJsonFetch([]),
        endpoint: "https://brave.test/search",
      }).search(input),
    "PROVIDER_INVALID_RESPONSE",
    false,
  );
  await assertProviderError(
    () =>
      createBraveBacklinkDiscoveryProvider({
        subscriptionToken: "test-subscription-token",
        fetchImplementation: responseFetch({ web: { results: {} } }, []),
        endpoint: "https://brave.test/search",
      }).search(input),
    "PROVIDER_INVALID_RESPONSE",
    false,
  );

  console.log("PASS — Automation Brave backlink discovery provider smoke");
}

void main();
