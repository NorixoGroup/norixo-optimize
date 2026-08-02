import type { BacklinkDiscoveryProviderName } from "./backlink-discovery-types";

export type BacklinkDiscoveryProviderSearchInput = {
  query: string;
  queryIndex: number;
  countryCode: string | null;
  languageCode: string | null;
  maxResults: number;
};

export type BacklinkDiscoveryProviderItem = {
  url: string;
  title: string | null;
  snippet: string | null;
  rank: number;
};

export type BacklinkDiscoveryProviderSearchResult = {
  query: string;
  queryIndex: number;
  countryCode: string | null;
  languageCode: string | null;
  items: readonly BacklinkDiscoveryProviderItem[];
};

export type BacklinkDiscoveryProviderErrorCode =
  | "PROVIDER_CONFIGURATION_ERROR"
  | "PROVIDER_QUOTA_EXCEEDED"
  | "PROVIDER_TRANSIENT_ERROR"
  | "PROVIDER_INVALID_RESPONSE";

export class BacklinkDiscoveryProviderError extends Error {
  readonly code: BacklinkDiscoveryProviderErrorCode;
  readonly retryable: boolean;

  constructor(
    code: BacklinkDiscoveryProviderErrorCode,
    message: string,
    retryable: boolean,
  ) {
    super(message);
    this.name = "BacklinkDiscoveryProviderError";
    this.code = code;
    this.retryable = retryable;
  }
}

export type BacklinkDiscoveryProvider = {
  readonly name: BacklinkDiscoveryProviderName;
  search: (
    input: BacklinkDiscoveryProviderSearchInput,
  ) => Promise<BacklinkDiscoveryProviderSearchResult>;
};

export type BacklinkDiscoveryProviderRegistry = Readonly<
  Partial<Record<BacklinkDiscoveryProviderName, BacklinkDiscoveryProvider>>
>;
