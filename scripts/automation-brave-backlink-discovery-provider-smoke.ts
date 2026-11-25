import {
  BacklinkDiscoveryProviderError,
  createBraveBacklinkDiscoveryProvider,
  decodeBacklinkDiscoveryInvalidResponseDiagnostic,
  encodeBacklinkDiscoveryInvalidResponseDiagnostic,
  type BacklinkDiscoveryProviderErrorDetails,
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

/** Verifies the closed, bounded diagnostic attached to a PROVIDER_INVALID_RESPONSE error. */
async function assertInvalidResponseDetails(
  operation: () => Promise<unknown>,
  expected: { subcause: string; httpStatus: number | null; contentType: string | null },
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    assert(
      error instanceof BacklinkDiscoveryProviderError &&
        error.code === "PROVIDER_INVALID_RESPONSE" &&
        error.details !== null &&
        error.details.subcause === expected.subcause &&
        error.details.httpStatus === expected.httpStatus &&
        error.details.contentType === expected.contentType,
      `Expected PROVIDER_INVALID_RESPONSE details ${JSON.stringify(expected)}, got ${JSON.stringify(
        error instanceof BacklinkDiscoveryProviderError ? error.details : error,
      )}`,
    );
    assert(
      !JSON.stringify((error as BacklinkDiscoveryProviderError).details).includes("test-subscription-token"),
      "Diagnostic details must never carry the token",
    );
    return;
  }

  throw new Error("Expected PROVIDER_INVALID_RESPONSE");
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
  contentType?: string,
): typeof fetch {
  return async (resource, init) => {
    records.push({ url: toUrl(resource).toString(), init });
    return new Response(
      JSON.stringify(payload),
      contentType === undefined ? { status } : { status, headers: { "content-type": contentType } },
    );
  };
}

function throwingFetch(records: RecordedFetch[]): typeof fetch {
  return async (resource, init) => {
    records.push({ url: toUrl(resource).toString(), init });
    throw new Error("deterministic fetch failure");
  };
}

function invalidJsonFetch(records: RecordedFetch[], contentType?: string): typeof fetch {
  return async (resource, init) => {
    records.push({ url: toUrl(resource).toString(), init });
    return new Response(
      "not-json",
      contentType === undefined ? { status: 200 } : { status: 200, headers: { "content-type": contentType } },
    );
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
    const provider = createBraveBacklinkDiscoveryProvider({
      subscriptionToken: "test-subscription-token",
      fetchImplementation: responseFetch({}, [], status),
      endpoint: "https://brave.test/search",
    });
    try {
      await provider.search(input);
      throw new Error(`Expected ${code}`);
    } catch (error) {
      assert(
        error instanceof BacklinkDiscoveryProviderError &&
          error.code === code &&
          error.retryable === retryable &&
          // Only PROVIDER_INVALID_RESPONSE carries a diagnostic; the other codes stay untouched.
          (code === "PROVIDER_INVALID_RESPONSE" ? error.details !== null : error.details === null),
        `Expected ${code} with the right diagnostic presence`,
      );
    }
  }

  // --- PROVIDER_INVALID_RESPONSE subcauses, HTTP status and content-type diagnostics ---
  await assertInvalidResponseDetails(
    () =>
      createBraveBacklinkDiscoveryProvider({
        subscriptionToken: "test-subscription-token",
        fetchImplementation: responseFetch({}, [], 418, "text/html; charset=utf-8"),
        endpoint: "https://brave.test/search",
      }).search(input),
    { subcause: "http_status", httpStatus: 418, contentType: "text/html" },
  );
  // No content-type header at all (a byte body sets none, unlike a string body): status is
  // still recorded, content-type stays absent rather than defaulting to anything.
  await assertInvalidResponseDetails(
    () =>
      createBraveBacklinkDiscoveryProvider({
        subscriptionToken: "test-subscription-token",
        fetchImplementation: async () => new Response(new TextEncoder().encode("{}"), { status: 404 }),
        endpoint: "https://brave.test/search",
      }).search(input),
    { subcause: "http_status", httpStatus: 404, contentType: null },
  );
  // Content-Type outside the closed allow-list is rejected outright, never passed through.
  await assertInvalidResponseDetails(
    () =>
      createBraveBacklinkDiscoveryProvider({
        subscriptionToken: "test-subscription-token",
        fetchImplementation: responseFetch({}, [], 404, "application/octet-stream; evil=<script>alert(1)</script>"),
        endpoint: "https://brave.test/search",
      }).search(input),
    { subcause: "http_status", httpStatus: 404, contentType: null },
  );
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
  await assertInvalidResponseDetails(
    () =>
      createBraveBacklinkDiscoveryProvider({
        subscriptionToken: "test-subscription-token",
        fetchImplementation: invalidJsonFetch([], "text/html"),
        endpoint: "https://brave.test/search",
      }).search(input),
    { subcause: "json_parse", httpStatus: 200, contentType: "text/html" },
  );
  await assertInvalidResponseDetails(
    () =>
      createBraveBacklinkDiscoveryProvider({
        subscriptionToken: "test-subscription-token",
        fetchImplementation: responseFetch({ web: { results: {} } }, [], 200, "application/json"),
        endpoint: "https://brave.test/search",
      }).search(input),
    { subcause: "schema_invalid", httpStatus: 200, contentType: "application/json" },
  );
  await assertInvalidResponseDetails(
    () =>
      createBraveBacklinkDiscoveryProvider({
        subscriptionToken: "test-subscription-token",
        fetchImplementation: async () =>
          new Response(new TextEncoder().encode(JSON.stringify("not-an-object")), { status: 200 }),
        endpoint: "https://brave.test/search",
      }).search(input),
    { subcause: "schema_invalid", httpStatus: 200, contentType: null },
  );

  // --- Timeout (no network, no real Brave call) ---
  const baseTimeoutConfig = {
    subscriptionToken: "test-subscription-token",
    endpoint: "https://brave.test/search",
  };

  // Out-of-range or invalid timeouts are refused at creation.
  for (const requestTimeoutMs of [999, 30_001, 0, -1, 1500.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assertThrows(
      () =>
        createBraveBacklinkDiscoveryProvider({
          ...baseTimeoutConfig,
          fetchImplementation: responseFetch({}, []),
          requestTimeoutMs,
        }),
      "PROVIDER_CONFIGURATION_ERROR",
    );
  }
  for (const requestTimeoutMs of [1_000, 30_000]) {
    createBraveBacklinkDiscoveryProvider({
      ...baseTimeoutConfig,
      fetchImplementation: responseFetch({}, []),
      requestTimeoutMs,
    });
  }

  // Observe the delay handed to AbortSignal.timeout and the signal handed to fetch.
  const originalTimeout = AbortSignal.timeout.bind(AbortSignal);
  const timeoutDelays: number[] = [];
  AbortSignal.timeout = (ms: number) => {
    timeoutDelays.push(ms);
    return originalTimeout(ms);
  };
  try {
    const signalRecords: RecordedFetch[] = [];
    const defaultTimeoutProvider = createBraveBacklinkDiscoveryProvider({
      ...baseTimeoutConfig,
      fetchImplementation: responseFetch({ web: {} }, signalRecords),
    });
    await defaultTimeoutProvider.search(input);
    const defaultSignal = signalRecords[0]?.init?.signal;
    assert(
      timeoutDelays.length === 1 && timeoutDelays[0] === 8_000,
      "Default timeout is 8000 ms",
    );
    assert(
      defaultSignal instanceof AbortSignal && !defaultSignal.aborted,
      "Signal passed to fetch and not aborted on success",
    );

    const customRecords: RecordedFetch[] = [];
    await createBraveBacklinkDiscoveryProvider({
      ...baseTimeoutConfig,
      fetchImplementation: responseFetch({ web: {} }, customRecords),
      requestTimeoutMs: 12_345,
    }).search(input);
    assert(timeoutDelays[1] === 12_345, "Custom timeout forwarded");
    assert(
      customRecords[0]?.init?.signal instanceof AbortSignal,
      "Custom signal passed to fetch",
    );
  } finally {
    AbortSignal.timeout = originalTimeout;
  }

  // AbortError thrown by fetch is a transient error.
  const abortErrorRecords: RecordedFetch[] = [];
  await assertProviderError(
    () =>
      createBraveBacklinkDiscoveryProvider({
        ...baseTimeoutConfig,
        fetchImplementation: async (resource, init) => {
          abortErrorRecords.push({ url: toUrl(resource).toString(), init });
          throw new DOMException("The operation was aborted", "AbortError");
        },
      }).search(input),
    "PROVIDER_TRANSIENT_ERROR",
    true,
  );
  assert(abortErrorRecords.length === 1, "No second HTTP call after AbortError");

  // AbortSignal.timeout timers are unref'd: keep the event loop alive while waiting.
  const keepAlive = setInterval(() => undefined, 100);
  try {
    // 1) Fetch that observes the signal and rejects when it aborts.
    const observingRecords: RecordedFetch[] = [];
    let observedAbort = false;
    const observing = assertProviderError(
      () =>
        createBraveBacklinkDiscoveryProvider({
          ...baseTimeoutConfig,
          requestTimeoutMs: 1_000,
          fetchImplementation: (resource, init) =>
            new Promise<Response>((_, reject) => {
              observingRecords.push({ url: toUrl(resource).toString(), init });
              init?.signal?.addEventListener("abort", () => {
                observedAbort = true;
                reject(init.signal?.reason);
              });
            }),
        }).search(input),
      "PROVIDER_TRANSIENT_ERROR",
      true,
    );

    // 2) Fetch that ignores the signal and never resolves: the timeout is still enforced.
    const ignoringRecords: RecordedFetch[] = [];
    const ignoring = assertProviderError(
      () =>
        createBraveBacklinkDiscoveryProvider({
          ...baseTimeoutConfig,
          requestTimeoutMs: 1_000,
          fetchImplementation: (resource, init) => {
            ignoringRecords.push({ url: toUrl(resource).toString(), init });
            return new Promise<Response>(() => undefined);
          },
        }).search(input),
      "PROVIDER_TRANSIENT_ERROR",
      true,
    );

    // 3) Headers arrive, then the body read stalls: the same signal covers it.
    const bodyRecords: RecordedFetch[] = [];
    let bodyObservedAbort = false;
    const bodyStall = assertProviderError(
      () =>
        createBraveBacklinkDiscoveryProvider({
          ...baseTimeoutConfig,
          requestTimeoutMs: 1_000,
          fetchImplementation: async (resource, init) => {
            bodyRecords.push({ url: toUrl(resource).toString(), init });
            const response = new Response("{}", { status: 200 });
            response.json = () =>
              new Promise<unknown>((_, reject) => {
                init?.signal?.addEventListener("abort", () => {
                  bodyObservedAbort = true;
                  reject(init.signal?.reason);
                });
              });
            return response;
          },
        }).search(input),
      "PROVIDER_TRANSIENT_ERROR",
      true,
    );

    await Promise.all([observing, ignoring, bodyStall]);
    assert(observedAbort, "Abort signal observed by fetch");
    assert(bodyObservedAbort, "Abort signal observed during body read");
    assert(
      observingRecords.length === 1 && ignoringRecords.length === 1 && bodyRecords.length === 1,
      "No second HTTP call after timeout",
    );
    assert(
      observingRecords[0]?.init?.signal?.aborted === true &&
        ignoringRecords[0]?.init?.signal?.aborted === true,
      "Signal aborted after timeout",
    );
  } finally {
    clearInterval(keepAlive);
  }

  // --- encodeBacklinkDiscoveryInvalidResponseDiagnostic: hardened at the persistence boundary,
  // never trusting the caller, even one bypassing the TypeScript types below with `as`. ---

  // 1. An arbitrary subcause outside the closed set is rejected: no suffix at all.
  assert(
    encodeBacklinkDiscoveryInvalidResponseDiagnostic({
      subcause: "made_up_subcause" as unknown as BacklinkDiscoveryProviderErrorDetails["subcause"],
      httpStatus: null,
      contentType: null,
    }) === "",
    "An arbitrary subcause must be rejected, not persisted",
  );

  // 2. An out-of-range HTTP status (below 100 or above 599) is omitted, not persisted.
  for (const badStatus of [0, 50, 600, 1000]) {
    const suffix = encodeBacklinkDiscoveryInvalidResponseDiagnostic({
      subcause: "http_status",
      httpStatus: badStatus as unknown as number,
      contentType: null,
    });
    assert(suffix === " diag:subcause=http_status" && !suffix.includes("status="), `Out-of-range status ${badStatus} must be omitted`);
  }

  // 3. A non-integer HTTP status is omitted, not persisted.
  for (const badStatus of [200.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    const suffix = encodeBacklinkDiscoveryInvalidResponseDiagnostic({
      subcause: "http_status",
      httpStatus: badStatus as unknown as number,
      contentType: null,
    });
    assert(suffix === " diag:subcause=http_status" && !suffix.includes("status="), `Non-integer status ${badStatus} must be omitted`);
  }

  // 4. A Content-Type outside the closed allow-list is omitted, not persisted.
  assert(
    encodeBacklinkDiscoveryInvalidResponseDiagnostic({
      subcause: "json_parse",
      httpStatus: 200,
      contentType: "application/x-arbitrary-synthetic-type",
    }) === " diag:subcause=json_parse;status=200",
    "An arbitrary Content-Type must be omitted",
  );

  // 5. A Content-Type carrying a synthetic "sensitive" parameter never has that parameter persisted:
  // only the base MIME type survives normalization, and only when it is itself allow-listed.
  const withFakeSecretParam = encodeBacklinkDiscoveryInvalidResponseDiagnostic({
    subcause: "schema_invalid",
    httpStatus: 200,
    contentType: "text/html; session=FAKE-SYNTHETIC-SECRET-00000000",
  });
  assert(
    withFakeSecretParam === " diag:subcause=schema_invalid;status=200;ctype=text/html" &&
      !withFakeSecretParam.includes("FAKE-SYNTHETIC-SECRET"),
    "A Content-Type parameter must never be persisted, synthetic secret included",
  );

  // 6. An excessively long, non-allow-listed Content-Type is never persisted (omitted, not truncated-in).
  const longFakeContentType = `application/${"x".repeat(5_000)}`;
  const withLongContentType = encodeBacklinkDiscoveryInvalidResponseDiagnostic({
    subcause: "http_status",
    httpStatus: 404,
    contentType: longFakeContentType,
  });
  assert(
    withLongContentType === " diag:subcause=http_status;status=404" && withLongContentType.length < 100,
    "An excessively long Content-Type must be omitted and the suffix must stay bounded",
  );

  // 8. A validly encoded diagnostic round-trips exactly through the existing decoder.
  const validDetails: BacklinkDiscoveryProviderErrorDetails = {
    subcause: "schema_invalid",
    httpStatus: 502,
    contentType: "application/json",
  };
  const roundTripMessage = `Discovery provider returned an invalid response.${encodeBacklinkDiscoveryInvalidResponseDiagnostic(validDetails)}`;
  assert(
    JSON.stringify(decodeBacklinkDiscoveryInvalidResponseDiagnostic(roundTripMessage)) === JSON.stringify(validDetails),
    "A validly encoded diagnostic must decode back to the same structured details",
  );

  console.log("PASS — Automation Brave backlink discovery provider smoke");
}

void main();
