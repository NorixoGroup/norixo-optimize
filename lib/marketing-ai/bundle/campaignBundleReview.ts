import type { MarketingCampaignBundle } from "./marketingCampaignBundle";

function normalizeDateString(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function resolveNow() {
  return new Date().toISOString();
}

function resolveReviewDate(reviewedAt?: string) {
  return reviewedAt && normalizeDateString(reviewedAt)
    ? normalizeDateString(reviewedAt) ?? resolveNow()
    : resolveNow();
}

export function markCampaignBundleReadyForReview(
  bundle: MarketingCampaignBundle,
): MarketingCampaignBundle {
  const now = resolveNow();

  return {
    ...bundle,
    notes: [...bundle.notes, "Campaign bundle marked ready for review."],
    approvalRequired: true,
    updatedAt: now,
  };
}

export function approveMarketingCampaignBundle(
  bundle: MarketingCampaignBundle,
  reviewedAt?: string,
): MarketingCampaignBundle {
  const now = resolveNow();
  const reviewDate = resolveReviewDate(reviewedAt);

  return {
    ...bundle,
    notes: [...bundle.notes, `Campaign bundle approved at ${reviewDate}.`],
    approvalRequired: true,
    updatedAt: now,
  };
}

export function rejectMarketingCampaignBundle(
  bundle: MarketingCampaignBundle,
  reason: string,
): MarketingCampaignBundle {
  const now = resolveNow();
  const trimmedReason = reason.trim();

  return {
    ...bundle,
    notes: [
      ...bundle.notes,
      trimmedReason || "Campaign bundle rejected.",
    ],
    approvalRequired: true,
    updatedAt: now,
  };
}

export function resetMarketingCampaignBundleReview(
  bundle: MarketingCampaignBundle,
): MarketingCampaignBundle {
  const now = resolveNow();

  return {
    ...bundle,
    notes: [...bundle.notes, "Campaign bundle review reset."],
    approvalRequired: true,
    updatedAt: now,
  };
}
