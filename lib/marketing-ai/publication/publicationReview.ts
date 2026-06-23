import type { PublicationPack } from "./publicationPack";

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

function resolveApprovedAt(approvedAt?: string) {
  return approvedAt && normalizeDateString(approvedAt)
    ? normalizeDateString(approvedAt) ?? resolveNow()
    : resolveNow();
}

export function markReadyForReview(pack: PublicationPack): PublicationPack {
  return {
    ...pack,
    status: "ready_for_review",
    approvalRequired: true,
    rejectedReason: undefined,
    updatedAt: resolveNow(),
  };
}

export function approvePublicationPack(
  pack: PublicationPack,
  approvedBy: string,
  approvedAt?: string,
): PublicationPack {
  return {
    ...pack,
    status: "approved",
    approvalRequired: true,
    approvedBy,
    approvedAt: resolveApprovedAt(approvedAt),
    rejectedReason: undefined,
    updatedAt: resolveNow(),
  };
}

export function rejectPublicationPack(
  pack: PublicationPack,
  rejectedReason: string,
  notes?: string,
): PublicationPack {
  return {
    ...pack,
    status: "rejected",
    approvalRequired: true,
    approvedBy: undefined,
    approvedAt: undefined,
    rejectedReason,
    notes: notes ?? pack.notes,
    updatedAt: resolveNow(),
  };
}

export function resetPublicationPackToDraft(
  pack: PublicationPack,
): PublicationPack {
  return {
    ...pack,
    status: "draft",
    approvalRequired: true,
    approvedBy: undefined,
    approvedAt: undefined,
    rejectedReason: undefined,
    notes: pack.notes,
    updatedAt: resolveNow(),
  };
}
