const DEFAULT_MAX_SEARCHES_PER_RUN = 3;
const DEFAULT_MAX_RESULTS_PER_SEARCH = 10;

export type BraveBacklinkDiscoveryRuntimeConfig =
  | {
      enabled: false;
      maxSearchesPerRun: number;
      maxResultsPerSearch: number;
    }
  | {
      enabled: true;
      subscriptionToken: string;
      maxSearchesPerRun: number;
      maxResultsPerSearch: number;
    };

function configurationError(): Error {
  return new Error("BACKLINK_DISCOVERY_BRAVE_CONFIGURATION_INVALID");
}

function readLimit(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }

  const normalized = value.trim();
  if (!/^[0-9]+$/.test(normalized)) {
    throw configurationError();
  }

  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10) {
    throw configurationError();
  }

  return parsed;
}

export function readBraveBacklinkDiscoveryRuntimeConfig(): BraveBacklinkDiscoveryRuntimeConfig {
  const maxSearchesPerRun = readLimit(
    process.env.BACKLINK_DISCOVERY_BRAVE_MAX_SEARCHES_PER_RUN,
    DEFAULT_MAX_SEARCHES_PER_RUN,
  );
  const maxResultsPerSearch = readLimit(
    process.env.BACKLINK_DISCOVERY_BRAVE_MAX_RESULTS_PER_SEARCH,
    DEFAULT_MAX_RESULTS_PER_SEARCH,
  );

  if (process.env.BACKLINK_DISCOVERY_BRAVE_ENABLED !== "true") {
    return { enabled: false, maxSearchesPerRun, maxResultsPerSearch };
  }

  const subscriptionToken = process.env.BACKLINK_DISCOVERY_BRAVE_API_KEY?.trim();
  if (subscriptionToken === undefined || subscriptionToken.length === 0) {
    throw configurationError();
  }

  return {
    enabled: true,
    subscriptionToken,
    maxSearchesPerRun,
    maxResultsPerSearch,
  };
}
