import {
  BacklinkDiscoveryProviderError,
  type BacklinkDiscoveryProvider,
  type BacklinkDiscoveryProviderErrorCode,
  type BacklinkDiscoveryProviderItem,
  type BacklinkDiscoveryProviderSearchInput,
  type BacklinkDiscoveryProviderSearchResult,
} from "./backlink-discovery-provider-types";

export type MockBacklinkDiscoveryFixture = {
  query: string;
  countryCode?: string | null;
  languageCode?: string | null;
  items: readonly BacklinkDiscoveryProviderItem[];
  error?: {
    code: BacklinkDiscoveryProviderErrorCode;
    message: string;
    retryable: boolean;
  };
};

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

function fixtureMatchesInput(
  fixture: MockBacklinkDiscoveryFixture,
  input: BacklinkDiscoveryProviderSearchInput,
): boolean {
  return (
    fixture.query === input.query &&
    (fixture.countryCode ?? null) === input.countryCode &&
    (fixture.languageCode ?? null) === input.languageCode
  );
}

function copyItems(
  items: readonly BacklinkDiscoveryProviderItem[],
  maxResults: number,
): readonly BacklinkDiscoveryProviderItem[] {
  return items.slice(0, maxResults).map((item) => ({ ...item }));
}

export function createMockBacklinkDiscoveryProvider(
  fixtures: readonly MockBacklinkDiscoveryFixture[],
): BacklinkDiscoveryProvider {
  return {
    name: "mock",
    async search(
      input: BacklinkDiscoveryProviderSearchInput,
    ): Promise<BacklinkDiscoveryProviderSearchResult> {
      assertSearchInput(input);
      const fixture = fixtures.find((candidate) => fixtureMatchesInput(candidate, input));

      if (fixture?.error !== undefined) {
        throw new BacklinkDiscoveryProviderError(
          fixture.error.code,
          fixture.error.message,
          fixture.error.retryable,
        );
      }

      return {
        query: input.query,
        queryIndex: input.queryIndex,
        countryCode: input.countryCode,
        languageCode: input.languageCode,
        items: fixture === undefined ? [] : copyItems(fixture.items, input.maxResults),
      };
    },
  };
}
