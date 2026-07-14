import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type AuditEntitlementRpcClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: unknown }>;
};

type AuditEntitlementRpcRow = {
  reservation_id: string | null;
  operation_key: string | null;
  status: string | null;
  source: string | null;
  reason_code: string | null;
};

export type AuditEntitlementSource = "admin" | "credit";

export type ReserveAuditEntitlementStatus =
  | "reserved"
  | "already_reserved"
  | "conflict"
  | "insufficient_entitlement"
  | "failed";

export type AuditEntitlementMutationStatus =
  | "finalized"
  | "already_finalized"
  | "released"
  | "already_released"
  | "failed";

export const NO_AUDIT_CREDITS_MESSAGE =
  "Vous n’avez plus de crédits disponibles. Choisissez une offre pour continuer.";

export type ReserveAuditEntitlementParams = {
  workspaceId: string;
  userId: string;
  operationKey: string;
  targetKind: "listing_id" | "source_url";
  targetRef: string;
  billingAdminBypass: boolean;
  enforceFreePlanLimit: boolean;
  quantity?: number;
};

export type FinalizeAuditEntitlementParams = {
  workspaceId: string;
  operationKey: string;
  auditId: string;
  listingId: string;
  userId: string;
  usageSource: string;
  sourceUrl?: string | null;
};

export type ReleaseAuditEntitlementParams = {
  workspaceId: string;
  operationKey: string;
  failureCode?: string | null;
};

export type ReserveAuditEntitlementResult =
  | {
      status: "reserved";
      reservationId: string;
      operationKey: string;
      source: AuditEntitlementSource;
      reasonCode: null;
    }
  | {
      status: "already_reserved" | "conflict";
      reservationId: string | null;
      operationKey: string;
      source: AuditEntitlementSource | null;
      reasonCode: string | null;
    }
  | {
      status: "insufficient_entitlement" | "failed";
      reservationId: string | null;
      operationKey: string;
      source: AuditEntitlementSource | null;
      reasonCode: string | null;
    };

export type AuditEntitlementMutationResult =
  | {
      status: "finalized" | "already_finalized" | "released" | "already_released";
      reservationId: string | null;
      operationKey: string;
      source: AuditEntitlementSource | null;
      reasonCode: string | null;
    }
  | {
      status: "failed";
      reservationId: string | null;
      operationKey: string;
      source: AuditEntitlementSource | null;
      reasonCode: string | null;
    };

type AuditEntitlementDependencies = {
  admin?: AuditEntitlementRpcClient;
};

function getAuditEntitlementAdminClient(
  dependencies?: AuditEntitlementDependencies,
): AuditEntitlementRpcClient {
  if (dependencies?.admin) {
    return dependencies.admin;
  }

  const admin = createSupabaseAdminClient();

  return {
    async rpc(fn, args) {
      const result = await admin.rpc(fn, args);
      return {
        data: result.data,
        error: result.error,
      };
    },
  };
}

function toAuditEntitlementSource(
  value: string | null | undefined,
): AuditEntitlementSource | null {
  return value === "admin" || value === "credit" ? value : null;
}

function normalizeRpcRow(data: unknown): AuditEntitlementRpcRow | null {
  if (Array.isArray(data)) {
    const [first] = data;
    return first && typeof first === "object"
      ? (first as AuditEntitlementRpcRow)
      : null;
  }

  return data && typeof data === "object"
    ? (data as AuditEntitlementRpcRow)
    : null;
}

function normalizeReserveResult(
  operationKey: string,
  row: AuditEntitlementRpcRow | null,
): ReserveAuditEntitlementResult {
  const normalizedOperationKey = row?.operation_key ?? operationKey;
  const source = toAuditEntitlementSource(row?.source);
  const reservationId = row?.reservation_id ?? null;
  const reasonCode = row?.reason_code ?? null;

  switch (row?.status) {
    case "reserved":
      if (!reservationId || !source) {
        break;
      }
      return {
        status: "reserved",
        reservationId,
        operationKey: normalizedOperationKey,
        source,
        reasonCode: null,
      };
    case "already_reserved":
    case "conflict":
    case "insufficient_entitlement":
      return {
        status: row.status,
        reservationId,
        operationKey: normalizedOperationKey,
        source,
        reasonCode,
      };
    default:
      break;
  }

  return {
    status: "failed",
    reservationId,
    operationKey: normalizedOperationKey,
    source,
    reasonCode: reasonCode ?? "invalid_rpc_response",
  };
}

function normalizeMutationResult(
  operationKey: string,
  row: AuditEntitlementRpcRow | null,
  expectedStatus: "finalized" | "released",
): AuditEntitlementMutationResult {
  const normalizedOperationKey = row?.operation_key ?? operationKey;
  const source = toAuditEntitlementSource(row?.source);
  const reservationId = row?.reservation_id ?? null;
  const reasonCode = row?.reason_code ?? null;

  if (expectedStatus === "finalized") {
    if (row?.status === "finalized" || row?.status === "already_finalized") {
      return {
        status: row.status,
        reservationId,
        operationKey: normalizedOperationKey,
        source,
        reasonCode,
      };
    }
  } else if (row?.status === "released" || row?.status === "already_released") {
    return {
      status: row.status,
      reservationId,
      operationKey: normalizedOperationKey,
      source,
      reasonCode,
    };
  }

  return {
    status: "failed",
    reservationId,
    operationKey: normalizedOperationKey,
    source,
    reasonCode: reasonCode ?? "invalid_rpc_response",
  };
}

export async function reserveAuditEntitlement(
  params: ReserveAuditEntitlementParams,
  dependencies?: AuditEntitlementDependencies,
): Promise<ReserveAuditEntitlementResult> {
  const admin = getAuditEntitlementAdminClient(dependencies);
  const quantity = Math.max(1, params.quantity ?? 1);
  const { data, error } = await admin.rpc("reserve_audit_entitlement", {
    p_workspace_id: params.workspaceId,
    p_user_id: params.userId,
    p_operation_key: params.operationKey,
    p_target_kind: params.targetKind,
    p_target_ref: params.targetRef,
    p_quantity: quantity,
    p_enforce_free_plan_limit: params.enforceFreePlanLimit,
    p_billing_admin_bypass: params.billingAdminBypass,
  });

  if (error) {
    console.warn("[AUDIT_ENTITLEMENT_RESERVATION_FAILED]", {
      workspaceId: params.workspaceId,
      operationKey: params.operationKey,
      code: typeof error === "object" && error && "code" in error ? error.code : null,
    });
    return {
      status: "failed",
      reservationId: null,
      operationKey: params.operationKey,
      source: null,
      reasonCode: "rpc_error",
    };
  }

  return normalizeReserveResult(params.operationKey, normalizeRpcRow(data));
}

export async function finalizeAuditEntitlement(
  params: FinalizeAuditEntitlementParams,
  dependencies?: AuditEntitlementDependencies,
): Promise<AuditEntitlementMutationResult> {
  const admin = getAuditEntitlementAdminClient(dependencies);
  const { data, error } = await admin.rpc("finalize_audit_entitlement", {
    p_workspace_id: params.workspaceId,
    p_operation_key: params.operationKey,
    p_audit_id: params.auditId,
    p_listing_id: params.listingId,
    p_user_id: params.userId,
    p_usage_source: params.usageSource,
    p_source_url: params.sourceUrl ?? null,
  });

  if (error) {
    console.warn("[AUDIT_ENTITLEMENT_FINALIZE_FAILED]", {
      workspaceId: params.workspaceId,
      operationKey: params.operationKey,
      code: typeof error === "object" && error && "code" in error ? error.code : null,
    });
    return {
      status: "failed",
      reservationId: null,
      operationKey: params.operationKey,
      source: null,
      reasonCode: "rpc_error",
    };
  }

  return normalizeMutationResult(params.operationKey, normalizeRpcRow(data), "finalized");
}

export async function releaseAuditEntitlement(
  params: ReleaseAuditEntitlementParams,
  dependencies?: AuditEntitlementDependencies,
): Promise<AuditEntitlementMutationResult> {
  const admin = getAuditEntitlementAdminClient(dependencies);
  const { data, error } = await admin.rpc("release_audit_entitlement", {
    p_workspace_id: params.workspaceId,
    p_operation_key: params.operationKey,
    p_failure_code: params.failureCode ?? null,
  });

  if (error) {
    console.warn("[AUDIT_ENTITLEMENT_RELEASE_FAILED]", {
      workspaceId: params.workspaceId,
      operationKey: params.operationKey,
      code: typeof error === "object" && error && "code" in error ? error.code : null,
    });
    return {
      status: "failed",
      reservationId: null,
      operationKey: params.operationKey,
      source: null,
      reasonCode: "rpc_error",
    };
  }

  return normalizeMutationResult(params.operationKey, normalizeRpcRow(data), "released");
}
