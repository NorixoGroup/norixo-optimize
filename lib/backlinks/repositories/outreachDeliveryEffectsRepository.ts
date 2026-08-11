import type { Database } from "@/types/database.types";

import { BacklinkRepositoryError, normalizeBacklinkRepositoryError } from "./errors";

export type BacklinkOutreachDeliveryEffectRow = Database["public"]["Tables"]["backlink_outreach_delivery_effects"]["Row"];

type DeliveryEffectLookupResult = { data: BacklinkOutreachDeliveryEffectRow | null; error: unknown };

export type BacklinkOutreachDeliveryEffectsReadClient = {
  from(table: "backlink_outreach_delivery_effects"): {
    select(columns: "*"): {
      eq(column: "delivery_event_id", value: string): {
        maybeSingle(): PromiseLike<DeliveryEffectLookupResult>;
      };
    };
  };
};

type ApplyBacklinkOutreachProviderComplaintRpcName = "apply_backlink_outreach_provider_complaint";
type ApplyBacklinkOutreachProviderComplaintRpcArgs = Database["public"]["Functions"][ApplyBacklinkOutreachProviderComplaintRpcName]["Args"];
type ApplyBacklinkOutreachProviderComplaintRpcRow = Database["public"]["Functions"][ApplyBacklinkOutreachProviderComplaintRpcName]["Returns"][number];
type ApplyBacklinkOutreachProviderPermanentBounceRpcName = "apply_backlink_outreach_provider_permanent_bounce";
type ApplyBacklinkOutreachProviderPermanentBounceRpcArgs = Database["public"]["Functions"][ApplyBacklinkOutreachProviderPermanentBounceRpcName]["Args"];
type ApplyBacklinkOutreachProviderPermanentBounceRpcRow = Database["public"]["Functions"][ApplyBacklinkOutreachProviderPermanentBounceRpcName]["Returns"][number];

export type ApplyBacklinkOutreachProviderComplaintRpcClient = {
  rpc(
    functionName: ApplyBacklinkOutreachProviderComplaintRpcName,
    args: ApplyBacklinkOutreachProviderComplaintRpcArgs,
  ): PromiseLike<{ data: ApplyBacklinkOutreachProviderComplaintRpcRow[] | null; error: unknown }>;
};

export type ApplyBacklinkOutreachProviderComplaintInput = {
  deliveryEventId: string;
  appliedAt: string;
};

export type ApplyBacklinkOutreachProviderPermanentBounceRpcClient = {
  rpc(
    functionName: ApplyBacklinkOutreachProviderPermanentBounceRpcName,
    args: ApplyBacklinkOutreachProviderPermanentBounceRpcArgs,
  ): PromiseLike<{ data: ApplyBacklinkOutreachProviderPermanentBounceRpcRow[] | null; error: unknown }>;
};

export type ApplyBacklinkOutreachProviderPermanentBounceInput = ApplyBacklinkOutreachProviderComplaintInput;

export type ApplyBacklinkOutreachProviderComplaintResult = {
  disposition: "applied" | "existing";
  deliveryEventId: string;
  outreachId: string;
  contactId: string;
  contactStatus: string;
  outreachStatus: string;
  appliedAt: string;
};

export type ApplyBacklinkOutreachProviderPermanentBounceResult = ApplyBacklinkOutreachProviderComplaintResult;

function required(operation: string, value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new BacklinkRepositoryError({ code: "VALIDATION", operation, message: `${field} is required.` });
  return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function throwInvalidResult(operation: string): never {
  throw new BacklinkRepositoryError({ code: "DATABASE", operation, message: "The database returned an invalid delivery effect result." });
}

function mapStopSignalResult(value: unknown, operation: string): ApplyBacklinkOutreachProviderComplaintResult {
  if (!isRecord(value)) return throwInvalidResult(operation);
  const {
    disposition,
    delivery_event_id: deliveryEventId,
    outreach_id: outreachId,
    contact_id: contactId,
    contact_status: contactStatus,
    outreach_status: outreachStatus,
    applied_at: appliedAt,
  } = value;
  if (
    (disposition !== "applied" && disposition !== "existing") ||
    typeof deliveryEventId !== "string" ||
    typeof outreachId !== "string" ||
    typeof contactId !== "string" ||
    typeof contactStatus !== "string" ||
    typeof outreachStatus !== "string" ||
    typeof appliedAt !== "string"
  ) return throwInvalidResult(operation);
  return { disposition, deliveryEventId, outreachId, contactId, contactStatus, outreachStatus, appliedAt };
}

function stableRpcErrorMessage(error: unknown): string | null {
  if (!isRecord(error) || !("message" in error) || typeof error.message !== "string") return null;
  return error.message;
}

function normalizeComplaintRpcError(operation: string, error: unknown): BacklinkRepositoryError {
  const stableMessage = stableRpcErrorMessage(error);
  if (stableMessage === "BACKLINK_OUTREACH_PROVIDER_COMPLAINT_EVENT_NOT_FOUND") {
    return new BacklinkRepositoryError({ code: "NOT_FOUND", operation, message: "The requested delivery event was not found." });
  }
  if (
    stableMessage === "BACKLINK_OUTREACH_PROVIDER_COMPLAINT_EVENT_TYPE_INVALID" ||
    stableMessage === "BACKLINK_OUTREACH_PROVIDER_COMPLAINT_OUTREACH_MISMATCH" ||
    stableMessage === "BACKLINK_OUTREACH_PROVIDER_COMPLAINT_CONTACT_MISMATCH"
  ) return new BacklinkRepositoryError({ code: "VALIDATION", operation, message: "The provided delivery event cannot apply a complaint effect." });
  return normalizeBacklinkRepositoryError(operation, error);
}

function normalizePermanentBounceRpcError(operation: string, error: unknown): BacklinkRepositoryError {
  const stableMessage = stableRpcErrorMessage(error);
  if (stableMessage === "BACKLINK_OUTREACH_PROVIDER_PERMANENT_BOUNCE_EVENT_NOT_FOUND") {
    return new BacklinkRepositoryError({ code: "NOT_FOUND", operation, message: "The requested delivery event was not found." });
  }
  if (
    stableMessage === "BACKLINK_OUTREACH_PROVIDER_PERMANENT_BOUNCE_EVENT_INVALID" ||
    stableMessage === "BACKLINK_OUTREACH_PROVIDER_PERMANENT_BOUNCE_OUTREACH_MISMATCH" ||
    stableMessage === "BACKLINK_OUTREACH_PROVIDER_PERMANENT_BOUNCE_CONTACT_MISMATCH"
  ) return new BacklinkRepositoryError({ code: "VALIDATION", operation, message: "The provided delivery event cannot apply a permanent bounce effect." });
  return normalizeBacklinkRepositoryError(operation, error);
}

export async function getBacklinkOutreachDeliveryEffectByDeliveryEventId(
  client: BacklinkOutreachDeliveryEffectsReadClient,
  deliveryEventId: string,
): Promise<BacklinkOutreachDeliveryEffectRow | null> {
  const operation = "getBacklinkOutreachDeliveryEffectByDeliveryEventId";
  const { data, error } = await client.from("backlink_outreach_delivery_effects").select("*").eq("delivery_event_id", required(operation, deliveryEventId, "deliveryEventId")).maybeSingle();
  if (error != null) throw normalizeBacklinkRepositoryError(operation, error);
  return data;
}

export async function applyBacklinkOutreachProviderComplaint(
  client: ApplyBacklinkOutreachProviderComplaintRpcClient,
  input: ApplyBacklinkOutreachProviderComplaintInput,
): Promise<ApplyBacklinkOutreachProviderComplaintResult> {
  const operation = "applyBacklinkOutreachProviderComplaint";
  const { data, error } = await client.rpc("apply_backlink_outreach_provider_complaint", {
    p_delivery_event_id: required(operation, input.deliveryEventId, "deliveryEventId"),
    p_applied_at: required(operation, input.appliedAt, "appliedAt"),
  });
  if (error != null) throw normalizeComplaintRpcError(operation, error);
  if (!Array.isArray(data) || data.length !== 1) return throwInvalidResult(operation);
  return mapStopSignalResult(data[0], operation);
}

export async function applyBacklinkOutreachProviderPermanentBounce(
  client: ApplyBacklinkOutreachProviderPermanentBounceRpcClient,
  input: ApplyBacklinkOutreachProviderPermanentBounceInput,
): Promise<ApplyBacklinkOutreachProviderPermanentBounceResult> {
  const operation = "applyBacklinkOutreachProviderPermanentBounce";
  const { data, error } = await client.rpc("apply_backlink_outreach_provider_permanent_bounce", {
    p_delivery_event_id: required(operation, input.deliveryEventId, "deliveryEventId"),
    p_applied_at: required(operation, input.appliedAt, "appliedAt"),
  });
  if (error != null) throw normalizePermanentBounceRpcError(operation, error);
  if (!Array.isArray(data) || data.length !== 1) return throwInvalidResult(operation);
  return mapStopSignalResult(data[0], operation);
}
