const DEFAULT_REVERIFICATION_CADENCE_DAYS = 30;

export type BacklinkReverificationRuntimeConfig = {
  enabled: boolean;
  cadenceDays: number;
};

function configurationError(): Error {
  return new Error("BACKLINK_REVERIFICATION_CONFIGURATION_INVALID");
}

function readCadenceDays(value: string | undefined): number {
  if (value == null || value.trim().length === 0) {
    return DEFAULT_REVERIFICATION_CADENCE_DAYS;
  }

  const normalized = value.trim();
  if (!/^[0-9]+$/.test(normalized)) {
    throw configurationError();
  }

  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 3650) {
    throw configurationError();
  }

  return parsed;
}

export function readBacklinkReverificationRuntimeConfig(): BacklinkReverificationRuntimeConfig {
  return {
    enabled: process.env.BACKLINK_REVERIFICATION_ENABLED === "true",
    cadenceDays: readCadenceDays(process.env.BACKLINK_REVERIFICATION_CADENCE_DAYS),
  };
}
