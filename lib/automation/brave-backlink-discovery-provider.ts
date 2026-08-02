import {
  BacklinkDiscoveryProviderError,
  type BacklinkDiscoveryProvider,
  type BacklinkDiscoveryProviderItem,
  type BacklinkDiscoveryProviderSearchInput,
  type BacklinkDiscoveryProviderSearchResult,
} from "./backlink-discovery-provider-types";

const DEFAULT_BRAVE_SEARCH_ENDPOINT = "https://api.search.brave.com/res/v1/web/search";
const MAX_SUBSCRIPTION_TOKEN_LENGTH = 4096;

export type CreateBraveBacklinkDiscoveryProviderInput = {
  subscriptionToken: string;
  fetchImplementation: typeof fetch;
  endpoint?: string;
};

function configurationError(): BacklinkDiscoveryProviderError {
  return new BacklinkDiscoveryProviderError(
    "PROVIDER_CONFIGURATION_ERROR",
    "Brave Search provider configuration is invalid",
    false,
  );
}

function invalidResponseError(): BacklinkDiscoveryProviderError {
  return new BacklinkDiscoveryProviderError(
    "PROVIDER_INVALID_RESPONSE",
    "Brave Search provider returned an invalid response",
    false,
  );
}

function transientError(): BacklinkDiscoveryProviderError {
  return new BacklinkDiscoveryProviderError(
    "PROVIDER_TRANSIENT_ERROR",
    "Brave Search provider request failed",
    true,
  );
}

function quotaError(): BacklinkDiscoveryProviderError {
  return new BacklinkDiscoveryProviderError(
    "PROVIDER_QUOTA_EXCEEDED",
    "Brave Search provider quota exceeded",
    true,
  );
}

function assertSearchInput(input: BacklinkDiscoveryProviderSearchInput): void {
  if (input.query.trim().length === 0) {
    throw new Error("discovery provider query must not be empty");
  }
  if (!Number.isInteger(input.queryIndex) || input.queryIndex < 0) {
    throw new Error("discovery provider queryIndex must be an integer greater than or equal to 0");
  }
  if (!Number.isInteger(input.maxResults) || input.maxResults < 1 || input.maxResults > 10) {
    throw new Error("discovery provider maxResults must be an integer between 1 and 10");
  }
  if (input.countryCode !== null && !/^[A-Z]{2}$/.test(input.countryCode)) {
    throw new Error("discovery provider countryCode must be an uppercase ISO alpha-2 code or null");
  }
  if (
    input.languageCode !== null &&
    !/^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/.test(input.languageCode)
  ) {
    throw new Error("discovery provider languageCode must be a lowercase language code or null");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanOptionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function parseEndpoint(endpoint: string): string {
  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw configurationError();
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.hostname.length === 0 ||
    parsed.username.length > 0 ||
    parsed.password.length > 0 ||
    parsed.search.length > 0 ||
    parsed.hash.length > 0
  ) {
    throw configurationError();
  }

  return parsed.toString();
}

function validateConfiguration(
  input: CreateBraveBacklinkDiscoveryProviderInput,
): { subscriptionToken: string; endpoint: string } {
  if (
    typeof input.subscriptionToken !== "string" ||
    input.subscriptionToken.trim().length === 0 ||
    input.subscriptionToken.length > MAX_SUBSCRIPTION_TOKEN_LENGTH ||
    typeof input.fetchImplementation !== "function"
  ) {
    throw configurationError();
  }

  return {
    subscriptionToken: input.subscriptionToken.trim(),
    endpoint: parseEndpoint(input.endpoint ?? DEFAULT_BRAVE_SEARCH_ENDPOINT),
  };
}

function extractResults(payload: unknown): readonly unknown[] {
  if (!isRecord(payload)) {
    throw invalidResponseError();
  }

  if (payload.web === undefined) {
    return [];
  }
  if (!isRecord(payload.web)) {
    throw invalidResponseError();
  }
  if (payload.web.results === undefined) {
    return [];
  }
  if (!Array.isArray(payload.web.results)) {
    throw invalidResponseError();
  }

  return payload.web.results;
}

function mapItems(
  results: readonly unknown[],
  maxResults: number,
): readonly BacklinkDiscoveryProviderItem[] {
  const items: BacklinkDiscoveryProviderItem[] = [];

  for (const [index, result] of results.entries()) {
    if (!isRecord(result)) {
      continue;
    }
    const url = cleanOptionalText(result.url);
    if (url === null) {
      continue;
    }

    items.push({
      url,
      title: cleanOptionalText(result.title),
      snippet: cleanOptionalText(result.description),
      rank: index + 1,
    });
    if (items.length === maxResults) {
      break;
    }
  }

  return items;
}

function classifyHttpError(status: number): BacklinkDiscoveryProviderError {
  if (status === 401 || status === 403) {
    return configurationError();
  }
  if (status === 429) {
    return quotaError();
  }
  if (status >= 500 && status <= 599) {
    return transientError();
  }
  return invalidResponseError();
}

function buildSearchUrl(
  endpoint: string,
  input: BacklinkDiscoveryProviderSearchInput,
): URL {
  const url = new URL(endpoint);
  url.searchParams.set("q", input.query);
  url.searchParams.set("count", String(input.maxResults));
  if (input.countryCode !== null) {
    url.searchParams.set("country", input.countryCode);
  }
  if (input.languageCode !== null) {
    url.searchParams.set("search_lang", input.languageCode);
  }
  return url;
}

export function createBraveBacklinkDiscoveryProvider(
  input: CreateBraveBacklinkDiscoveryProviderInput,
): BacklinkDiscoveryProvider {
  const configuration = validateConfiguration(input);

  return {
    name: "brave_search",
    async search(
      searchInput: BacklinkDiscoveryProviderSearchInput,
    ): Promise<BacklinkDiscoveryProviderSearchResult> {
      assertSearchInput(searchInput);

      let response: Response;
      try {
        response = await input.fetchImplementation(
          buildSearchUrl(configuration.endpoint, searchInput),
          {
            method: "GET",
            cache: "no-store",
            headers: {
              Accept: "application/json",
              "X-Subscription-Token": configuration.subscriptionToken,
            },
          },
        );
      } catch {
        throw transientError();
      }

      if (!response.ok) {
        throw classifyHttpError(response.status);
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw invalidResponseError();
      }

      return {
        query: searchInput.query,
        queryIndex: searchInput.queryIndex,
        countryCode: searchInput.countryCode,
        languageCode: searchInput.languageCode,
        items: mapItems(extractResults(payload), searchInput.maxResults),
      };
    },
  };
}
