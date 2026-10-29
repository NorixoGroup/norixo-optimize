import { BacklinkRepositoryError, normalizeBacklinkRepositoryError } from "./errors";

type MutationName =
  | "approve_backlink_production_pilot_eligibility"
  | "revoke_backlink_production_pilot_eligibility";

type ReadName = "get_backlink_production_pilot_eligibility";

type MutationRow = {
  eligibility_id: string;
  status: "approved" | "revoked";
  disposition: "approved" | "already_approved" | "revoked" | "already_inactive";
};

export type ProductionPilotEligibilityAuditEvent = {
  action: "approved" | "revoked";
  reason: string;
  actor_user_id: string;
  created_at: string;
};

export type ProductionPilotEligibilityState = {
  eligibilityId: string;
  originKind: "real";
  status: "pending" | "approved" | "rejected" | "revoked";
  sourceReference: string;
  reviewReason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  auditHistory: ProductionPilotEligibilityAuditEvent[];
};

export type ProductionPilotEligibilityRpcClient = {
  rpc(name: MutationName, args: Record<string, unknown>): PromiseLike<{ data: MutationRow[] | null; error: unknown }>;
  rpc(name: ReadName, args: Record<string, unknown>): PromiseLike<{ data: Array<Record<string, unknown>> | null; error: unknown }>;
};

export type PilotEligibilityMutationInput = {
  workspaceId: string;
  contactId: string;
  opportunityId: string;
  actorUserId: string;
  reason: string;
  sourceReference?: string;
};

function required(value: string | undefined, field: string): string {
  const normalized = value?.trim() ?? "";
  if (normalized === "") {
    throw new BacklinkRepositoryError({ code: "VALIDATION", operation: "productionPilotEligibility", message: `${field} is required.` });
  }
  return normalized;
}

function bounded(value: string | undefined, field: string): string {
  const normalized = required(value, field);
  if (normalized.length < 10 || normalized.length > 2000) {
    throw new BacklinkRepositoryError({ code: "VALIDATION", operation: "productionPilotEligibility", message: `${field} must be between 10 and 2000 characters.` });
  }
  return normalized;
}

function mapMutation(row: MutationRow): MutationRow {
  if (!row?.eligibility_id || !row.status || !row.disposition) {
    throw new BacklinkRepositoryError({ code: "DATABASE", operation: "productionPilotEligibility", message: "The database returned an invalid eligibility mutation result." });
  }
  return row;
}

function auditHistory(value: unknown): ProductionPilotEligibilityAuditEvent[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item !== "object" || item == null) return [];
    const event = item as Record<string, unknown>;
    return typeof event.action === "string" && typeof event.reason === "string" && typeof event.actor_user_id === "string" && typeof event.created_at === "string"
      ? [{ action: event.action as ProductionPilotEligibilityAuditEvent["action"], reason: event.reason, actor_user_id: event.actor_user_id, created_at: event.created_at }]
      : [];
  });
}

function mapState(row: Record<string, unknown>): ProductionPilotEligibilityState {
  if (typeof row.eligibility_id !== "string" || row.origin_kind !== "real" || typeof row.status !== "string" || typeof row.source_reference !== "string" || typeof row.created_at !== "string" || typeof row.updated_at !== "string") {
    throw new BacklinkRepositoryError({ code: "DATABASE", operation: "getProductionPilotEligibility", message: "The database returned an invalid eligibility state." });
  }
  return {
    eligibilityId: row.eligibility_id,
    originKind: "real",
    status: row.status as ProductionPilotEligibilityState["status"],
    sourceReference: row.source_reference,
    reviewReason: typeof row.review_reason === "string" ? row.review_reason : null,
    reviewedBy: typeof row.reviewed_by === "string" ? row.reviewed_by : null,
    reviewedAt: typeof row.reviewed_at === "string" ? row.reviewed_at : null,
    createdBy: typeof row.created_by === "string" ? row.created_by : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    auditHistory: auditHistory(row.audit_history),
  };
}

export async function approveProductionPilotEligibility(client: ProductionPilotEligibilityRpcClient, input: Required<PilotEligibilityMutationInput>): Promise<MutationRow> {
  const { data, error } = await client.rpc("approve_backlink_production_pilot_eligibility", {
    p_workspace_id: required(input.workspaceId, "workspaceId"), p_contact_id: required(input.contactId, "contactId"),
    p_opportunity_id: required(input.opportunityId, "opportunityId"), p_actor_user_id: required(input.actorUserId, "actorUserId"),
    p_source_reference: bounded(input.sourceReference, "sourceReference"), p_reason: bounded(input.reason, "reason"),
  });
  if (error != null) throw normalizeBacklinkRepositoryError("approveProductionPilotEligibility", error);
  if (!Array.isArray(data) || data.length !== 1) throw new BacklinkRepositoryError({ code: "DATABASE", operation: "approveProductionPilotEligibility", message: "The database returned an invalid eligibility mutation result." });
  return mapMutation(data[0]);
}

export async function revokeProductionPilotEligibility(client: ProductionPilotEligibilityRpcClient, input: Omit<PilotEligibilityMutationInput, "sourceReference">): Promise<MutationRow> {
  const { data, error } = await client.rpc("revoke_backlink_production_pilot_eligibility", {
    p_workspace_id: required(input.workspaceId, "workspaceId"), p_contact_id: required(input.contactId, "contactId"),
    p_opportunity_id: required(input.opportunityId, "opportunityId"), p_actor_user_id: required(input.actorUserId, "actorUserId"), p_reason: bounded(input.reason, "reason"),
  });
  if (error != null) throw normalizeBacklinkRepositoryError("revokeProductionPilotEligibility", error);
  if (!Array.isArray(data) || data.length !== 1) throw new BacklinkRepositoryError({ code: "DATABASE", operation: "revokeProductionPilotEligibility", message: "The database returned an invalid eligibility mutation result." });
  return mapMutation(data[0]);
}

export async function getProductionPilotEligibility(client: ProductionPilotEligibilityRpcClient, input: Pick<PilotEligibilityMutationInput, "workspaceId" | "contactId" | "opportunityId">): Promise<ProductionPilotEligibilityState | null> {
  const { data, error } = await client.rpc("get_backlink_production_pilot_eligibility", {
    p_workspace_id: required(input.workspaceId, "workspaceId"), p_contact_id: required(input.contactId, "contactId"), p_opportunity_id: required(input.opportunityId, "opportunityId"),
  });
  if (error != null) throw normalizeBacklinkRepositoryError("getProductionPilotEligibility", error);
  if (!Array.isArray(data) || data.length > 1) throw new BacklinkRepositoryError({ code: "DATABASE", operation: "getProductionPilotEligibility", message: "The database returned an invalid eligibility state." });
  return data[0] == null ? null : mapState(data[0]);
}
