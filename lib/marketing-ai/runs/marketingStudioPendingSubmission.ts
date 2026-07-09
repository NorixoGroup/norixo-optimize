export const MARKETING_STUDIO_PENDING_SUBMISSION_STORAGE_KEY =
  "marketing-studio:pending-submission";

export type MarketingStudioPendingSubmission = {
  submissionKey: string;
  fingerprint: string;
  createdAt: string;
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableSerialize(entry)}`);
    return `{${entries.join(",")}}`;
  }

  return JSON.stringify(value);
}

export function buildMarketingStudioSubmissionFingerprint(value: unknown): string {
  return stableSerialize(value);
}

export function readMarketingStudioPendingSubmission(
  storage: Pick<StorageLike, "getItem">,
): MarketingStudioPendingSubmission | null {
  const rawValue = storage.getItem(
    MARKETING_STUDIO_PENDING_SUBMISSION_STORAGE_KEY,
  );

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<MarketingStudioPendingSubmission>;
    if (
      typeof parsed.submissionKey === "string" &&
      parsed.submissionKey.trim().length > 0 &&
      typeof parsed.fingerprint === "string" &&
      parsed.fingerprint.trim().length > 0 &&
      typeof parsed.createdAt === "string" &&
      parsed.createdAt.trim().length > 0
    ) {
      return {
        submissionKey: parsed.submissionKey.trim(),
        fingerprint: parsed.fingerprint.trim(),
        createdAt: parsed.createdAt.trim(),
      };
    }
  } catch {
    return null;
  }

  return null;
}

export function writeMarketingStudioPendingSubmission(
  storage: Pick<StorageLike, "setItem">,
  entry: MarketingStudioPendingSubmission,
) {
  storage.setItem(
    MARKETING_STUDIO_PENDING_SUBMISSION_STORAGE_KEY,
    JSON.stringify(entry),
  );
}

export function clearMarketingStudioPendingSubmission(
  storage: Pick<StorageLike, "removeItem">,
) {
  storage.removeItem(MARKETING_STUDIO_PENDING_SUBMISSION_STORAGE_KEY);
}

export function resolveMarketingStudioPendingSubmission(params: {
  storage: StorageLike;
  fingerprint: string;
  now?: string;
  createSubmissionKey?: () => string;
}): MarketingStudioPendingSubmission {
  const existing = readMarketingStudioPendingSubmission(params.storage);

  if (existing && existing.fingerprint === params.fingerprint) {
    return existing;
  }

  const nextEntry: MarketingStudioPendingSubmission = {
    submissionKey: (params.createSubmissionKey ?? (() => crypto.randomUUID()))(),
    fingerprint: params.fingerprint,
    createdAt: params.now ?? new Date().toISOString(),
  };

  writeMarketingStudioPendingSubmission(params.storage, nextEntry);
  return nextEntry;
}
