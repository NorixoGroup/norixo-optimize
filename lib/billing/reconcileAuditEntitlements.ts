import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  finalizeAuditEntitlement,
  releaseAuditEntitlement,
  type AuditEntitlementMutationResult,
  type AuditEntitlementSource,
  type FinalizeAuditEntitlementParams,
  type ReleaseAuditEntitlementParams,
} from "@/lib/billing/auditEntitlement";

const DEFAULT_OLDER_THAN_HOURS = 6;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
const MIN_OLDER_THAN_HOURS = 1;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

type ReservationRowRecord = Readonly<{
  id?: unknown;
  operation_key?: unknown;
  workspace_id?: unknown;
  source?: unknown;
  status?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
  target_kind?: unknown;
  free_plan_gate?: unknown;
}>;

type AuditRowRecord = Readonly<{
  id?: unknown;
  workspace_id?: unknown;
  listing_id?: unknown;
  created_by?: unknown;
  entitlement_reservation_id?: unknown;
  created_at?: unknown;
}>;

export type ReconcileAuditEntitlementsOptions = Readonly<{
  dryRun: boolean;
  olderThanHours: number;
  limit: number;
  reservationId: string | null;
}>;

export type ReconcileAuditEntitlementsDecision =
  | "ignore"
  | "finalize"
  | "release"
  | "manual_review";

export type ReconcileAuditEntitlementsReasonCode =
  | "recent_reservation"
  | "status_not_reserved"
  | "linked_audit_valid"
  | "no_linked_audit"
  | "multiple_linked_audits"
  | "audit_workspace_mismatch"
  | "audit_missing_listing_id"
  | "audit_missing_created_by"
  | "audit_missing_entitlement_link"
  | "invalid_created_at"
  | "audit_lookup_error";

export type ReconcileAuditEntitlementsOutcome =
  | "none"
  | "applied"
  | "skipped"
  | "failed";

export type AuditEntitlementReservationRecord = Readonly<{
  id: string;
  operationKey: string;
  workspaceId: string;
  source: AuditEntitlementSource | "unknown";
  status: string;
  createdAt: string;
  updatedAt: string | null;
  targetKind: "listing_id" | "source_url" | "unknown";
  freePlanGate: boolean;
}>;

export type AuditReservationLinkedAuditRecord = Readonly<{
  id: string;
  workspaceId: string;
  listingId: string | null;
  createdBy: string | null;
  entitlementReservationId: string | null;
  createdAt: string | null;
}>;

export type ReconcileAuditEntitlementsRow = Readonly<{
  reservationId: string;
  workspaceId: string;
  operationKeyPreview: string;
  source: AuditEntitlementSource | "unknown";
  reservationStatus: string;
  ageHours: number | null;
  decision: ReconcileAuditEntitlementsDecision;
  reasonCode: ReconcileAuditEntitlementsReasonCode;
  linkedAuditId: string | null;
  linkedAuditIds: ReadonlyArray<string>;
  outcome: ReconcileAuditEntitlementsOutcome;
  actionStatus: string | null;
  actionReasonCode: string | null;
}>;

export type ReconcileAuditEntitlementsSummary = Readonly<{
  scanned: number;
  ignored: number;
  eligible: number;
  finalizeCandidates: number;
  releaseCandidates: number;
  manualReview: number;
  applied: number;
  skipped: number;
  failed: number;
  ledgerNote: "ledger reconciliation outside current scope";
}>;

export type ReconcileAuditEntitlementsExecutionResult = Readonly<{
  options: ReconcileAuditEntitlementsOptions;
  cutoffIso: string;
  rows: ReadonlyArray<ReconcileAuditEntitlementsRow>;
  summary: ReconcileAuditEntitlementsSummary;
  exitCode: 0 | 1;
}>;

export type ReconcileAuditEntitlementsDependencies = Readonly<{
  admin?: SupabaseAdminClient;
  now?: Date;
  listReservations?: (
    input: Readonly<{
      cutoffIso: string;
      limit: number;
      reservationId: string | null;
    }>,
  ) => Promise<ReadonlyArray<AuditEntitlementReservationRecord>>;
  findAuditsByReservationId?: (
    input: Readonly<{ reservationId: string }>,
  ) => Promise<ReadonlyArray<AuditReservationLinkedAuditRecord>>;
  finalize?: (
    params: FinalizeAuditEntitlementParams,
  ) => Promise<AuditEntitlementMutationResult>;
  release?: (
    params: ReleaseAuditEntitlementParams,
  ) => Promise<AuditEntitlementMutationResult>;
}>;

function fail(message: string): never {
  throw new Error(message);
}

function requireArgumentValue(
  argv: ReadonlyArray<string>,
  index: number,
  argument: string,
): string {
  const value = argv[index + 1];

  if (typeof value !== "string" || value.trim().length === 0) {
    fail(`Missing value after \`${argument}\`.`);
  }

  return value.trim();
}

function parsePositiveInteger(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    fail(`\`${label}\` must be a positive integer.`);
  }

  return parsed;
}

function parseInteger(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    fail(`\`${label}\` must be an integer.`);
  }

  return parsed;
}

function parseUuid(value: string): string {
  if (!UUID_REGEX.test(value)) {
    fail("`--reservation-id` must be a valid UUID.");
  }

  return value.toLowerCase();
}

function getOptionAssignment(
  argument: string,
  prefix: string,
): string | null {
  return argument.startsWith(`${prefix}=`) ? argument.slice(prefix.length + 1).trim() : null;
}

export function parseReconcileAuditEntitlementsArgs(
  argv: ReadonlyArray<string>,
): ReconcileAuditEntitlementsOptions {
  let dryRun = true;
  let sawDryRun = false;
  let sawApply = false;
  let olderThanHours = DEFAULT_OLDER_THAN_HOURS;
  let limit = DEFAULT_LIMIT;
  let reservationId: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const olderThanAssignment = getOptionAssignment(argument, "--older-than-hours");
    const limitAssignment = getOptionAssignment(argument, "--limit");
    const reservationAssignment = getOptionAssignment(argument, "--reservation-id");

    if (argument === "--dry-run") {
      sawDryRun = true;
      dryRun = true;
      continue;
    }

    if (argument === "--apply") {
      sawApply = true;
      dryRun = false;
      continue;
    }

    if (argument === "--older-than-hours" || olderThanAssignment != null) {
      const rawValue =
        olderThanAssignment ?? requireArgumentValue(argv, index, argument);
      olderThanHours = parseInteger(rawValue, "--older-than-hours");
      if (olderThanAssignment == null) {
        index += 1;
      }
      continue;
    }

    if (argument === "--limit" || limitAssignment != null) {
      const rawValue = limitAssignment ?? requireArgumentValue(argv, index, argument);
      limit = parsePositiveInteger(rawValue, "--limit");
      if (limitAssignment == null) {
        index += 1;
      }
      continue;
    }

    if (argument === "--reservation-id" || reservationAssignment != null) {
      const rawValue =
        reservationAssignment ?? requireArgumentValue(argv, index, argument);
      reservationId = parseUuid(rawValue);
      if (reservationAssignment == null) {
        index += 1;
      }
      continue;
    }

    fail(`Unknown argument: ${argument}`);
  }

  if (sawDryRun && sawApply) {
    fail("`--dry-run` and `--apply` cannot be used together.");
  }

  if (olderThanHours < MIN_OLDER_THAN_HOURS) {
    fail(`\`--older-than-hours\` must be at least ${MIN_OLDER_THAN_HOURS}.`);
  }

  if (limit > MAX_LIMIT) {
    fail(`\`--limit\` must be less than or equal to ${MAX_LIMIT}.`);
  }

  return {
    dryRun,
    olderThanHours,
    limit,
    reservationId,
  };
}

function getAdminClient(
  dependencies: ReconcileAuditEntitlementsDependencies,
): SupabaseAdminClient {
  if (dependencies.admin) {
    return dependencies.admin;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

  if (supabaseUrl.length === 0 || serviceRoleKey.length === 0) {
    throw new Error("Supabase admin credentials are required.");
  }

  return createSupabaseAdminClient();
}

function normalizeSource(value: unknown): AuditEntitlementSource | "unknown" {
  return value === "admin" || value === "credit" ? value : "unknown";
}

function normalizeTargetKind(
  value: unknown,
): AuditEntitlementReservationRecord["targetKind"] {
  return value === "listing_id" || value === "source_url" ? value : "unknown";
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid ${label} value.`);
  }

  return value.trim();
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeReservationRow(row: unknown): AuditEntitlementReservationRecord {
  if (!row || typeof row !== "object") {
    throw new Error("Invalid reservation row shape.");
  }

  const record = row as ReservationRowRecord;

  return {
    id: requireString(record.id, "reservation.id"),
    operationKey: requireString(record.operation_key, "reservation.operation_key"),
    workspaceId: requireString(record.workspace_id, "reservation.workspace_id"),
    source: normalizeSource(record.source),
    status: requireString(record.status, "reservation.status"),
    createdAt: requireString(record.created_at, "reservation.created_at"),
    updatedAt: toStringOrNull(record.updated_at),
    targetKind: normalizeTargetKind(record.target_kind),
    freePlanGate: record.free_plan_gate === true,
  };
}

function normalizeAuditRow(row: unknown): AuditReservationLinkedAuditRecord {
  if (!row || typeof row !== "object") {
    throw new Error("Invalid audit row shape.");
  }

  const record = row as AuditRowRecord;

  return {
    id: requireString(record.id, "audit.id"),
    workspaceId: requireString(record.workspace_id, "audit.workspace_id"),
    listingId: toStringOrNull(record.listing_id),
    createdBy: toStringOrNull(record.created_by),
    entitlementReservationId: toStringOrNull(record.entitlement_reservation_id),
    createdAt: toStringOrNull(record.created_at),
  };
}

async function defaultListReservations(
  input: Readonly<{
    cutoffIso: string;
    limit: number;
    reservationId: string | null;
  }>,
  dependencies: ReconcileAuditEntitlementsDependencies,
): Promise<ReadonlyArray<AuditEntitlementReservationRecord>> {
  const admin = getAdminClient(dependencies);

  let query = admin
    .from("audit_entitlement_reservations")
    .select(
      "id,operation_key,workspace_id,source,status,created_at,updated_at,target_kind,free_plan_gate",
    )
    .eq("status", "reserved")
    .order("created_at", { ascending: true })
    .limit(input.limit);

  if (input.reservationId != null) {
    query = query.eq("id", input.reservationId);
  } else {
    query = query.lt("created_at", input.cutoffIso);
  }

  const { data, error } = await query;

  if (error || !Array.isArray(data)) {
    throw new Error("Unable to read stale audit entitlement reservations.");
  }

  return data.map((row) => normalizeReservationRow(row));
}

async function defaultFindAuditsByReservationId(
  input: Readonly<{ reservationId: string }>,
  dependencies: ReconcileAuditEntitlementsDependencies,
): Promise<ReadonlyArray<AuditReservationLinkedAuditRecord>> {
  const admin = getAdminClient(dependencies);
  const { data, error } = await admin
    .from("audits")
    .select("id,workspace_id,listing_id,created_by,entitlement_reservation_id,created_at")
    .eq("entitlement_reservation_id", input.reservationId)
    .order("created_at", { ascending: true })
    .limit(5);

  if (error || !Array.isArray(data)) {
    throw new Error("Unable to read linked audits.");
  }

  return data.map((row) => normalizeAuditRow(row));
}

function buildCutoffIso(now: Date, olderThanHours: number): string {
  return new Date(now.getTime() - olderThanHours * 60 * 60 * 1000).toISOString();
}

function computeAgeHours(
  createdAt: string,
  now: Date,
): number | null {
  const createdAtMs = Date.parse(createdAt);
  if (!Number.isFinite(createdAtMs)) {
    return null;
  }

  const deltaMs = now.getTime() - createdAtMs;
  return Math.round((deltaMs / (60 * 60 * 1000)) * 10) / 10;
}

export function classifyReconcileAuditEntitlementReservation(input: Readonly<{
  reservation: AuditEntitlementReservationRecord;
  linkedAudits: ReadonlyArray<AuditReservationLinkedAuditRecord>;
  olderThanHours: number;
  now: Date;
  auditLookupFailed?: boolean;
}>): Readonly<{
  ageHours: number | null;
  decision: ReconcileAuditEntitlementsDecision;
  reasonCode: ReconcileAuditEntitlementsReasonCode;
  linkedAuditId: string | null;
}> {
  const ageHours = computeAgeHours(input.reservation.createdAt, input.now);

  if (input.reservation.status !== "reserved") {
    return {
      ageHours,
      decision: "ignore",
      reasonCode: "status_not_reserved",
      linkedAuditId: null,
    };
  }

  if (ageHours == null) {
    return {
      ageHours,
      decision: "manual_review",
      reasonCode: "invalid_created_at",
      linkedAuditId: null,
    };
  }

  if (ageHours < input.olderThanHours) {
    return {
      ageHours,
      decision: "ignore",
      reasonCode: "recent_reservation",
      linkedAuditId: null,
    };
  }

  if (input.auditLookupFailed) {
    return {
      ageHours,
      decision: "manual_review",
      reasonCode: "audit_lookup_error",
      linkedAuditId: null,
    };
  }

  if (input.linkedAudits.length === 0) {
    return {
      ageHours,
      decision: "release",
      reasonCode: "no_linked_audit",
      linkedAuditId: null,
    };
  }

  if (input.linkedAudits.length > 1) {
    return {
      ageHours,
      decision: "manual_review",
      reasonCode: "multiple_linked_audits",
      linkedAuditId: null,
    };
  }

  const [audit] = input.linkedAudits;

  if (audit.entitlementReservationId !== input.reservation.id) {
    return {
      ageHours,
      decision: "manual_review",
      reasonCode: "audit_missing_entitlement_link",
      linkedAuditId: audit.id,
    };
  }

  if (audit.workspaceId !== input.reservation.workspaceId) {
    return {
      ageHours,
      decision: "manual_review",
      reasonCode: "audit_workspace_mismatch",
      linkedAuditId: audit.id,
    };
  }

  if (!audit.listingId) {
    return {
      ageHours,
      decision: "manual_review",
      reasonCode: "audit_missing_listing_id",
      linkedAuditId: audit.id,
    };
  }

  if (!audit.createdBy) {
    return {
      ageHours,
      decision: "manual_review",
      reasonCode: "audit_missing_created_by",
      linkedAuditId: audit.id,
    };
  }

  return {
    ageHours,
    decision: "finalize",
    reasonCode: "linked_audit_valid",
    linkedAuditId: audit.id,
  };
}

function summarizeOperationKey(operationKey: string): string {
  if (operationKey.length <= 12) {
    return operationKey;
  }

  return `${operationKey.slice(0, 8)}...${operationKey.slice(-4)}`;
}

function toMutationOutcome(
  decision: Extract<ReconcileAuditEntitlementsDecision, "finalize" | "release">,
  result: AuditEntitlementMutationResult,
): Readonly<{
  outcome: ReconcileAuditEntitlementsOutcome;
  actionStatus: string;
  actionReasonCode: string | null;
}> {
  if (
    result.status === "finalized" ||
    result.status === "already_finalized" ||
    result.status === "released" ||
    result.status === "already_released"
  ) {
    return {
      outcome: "applied",
      actionStatus: result.status,
      actionReasonCode: result.reasonCode,
    };
  }

  if (
    (decision === "finalize" && result.reasonCode === "already_released") ||
    (decision === "release" &&
      (result.reasonCode === "already_consumed" ||
        result.reasonCode === "reservation_not_found"))
  ) {
    return {
      outcome: "skipped",
      actionStatus: result.status,
      actionReasonCode: result.reasonCode,
    };
  }

  return {
    outcome: "failed",
    actionStatus: result.status,
    actionReasonCode: result.reasonCode,
  };
}

function buildSummary(
  rows: ReadonlyArray<ReconcileAuditEntitlementsRow>,
): ReconcileAuditEntitlementsSummary {
  return {
    scanned: rows.length,
    ignored: rows.filter((row) => row.decision === "ignore").length,
    eligible: rows.filter(
      (row) => row.decision === "finalize" || row.decision === "release",
    ).length,
    finalizeCandidates: rows.filter((row) => row.decision === "finalize").length,
    releaseCandidates: rows.filter((row) => row.decision === "release").length,
    manualReview: rows.filter((row) => row.decision === "manual_review").length,
    applied: rows.filter((row) => row.outcome === "applied").length,
    skipped: rows.filter((row) => row.outcome === "skipped").length,
    failed: rows.filter((row) => row.outcome === "failed").length,
    ledgerNote: "ledger reconciliation outside current scope",
  };
}

function compareReservationsByCreatedAt(
  left: AuditEntitlementReservationRecord,
  right: AuditEntitlementReservationRecord,
): number {
  const leftTime = Date.parse(left.createdAt);
  const rightTime = Date.parse(right.createdAt);

  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
    return leftTime - rightTime;
  }

  return left.id.localeCompare(right.id);
}

export async function executeReconcileAuditEntitlements(
  options: ReconcileAuditEntitlementsOptions,
  dependencies: ReconcileAuditEntitlementsDependencies = {},
): Promise<ReconcileAuditEntitlementsExecutionResult> {
  const now = dependencies.now ?? new Date();
  const cutoffIso = buildCutoffIso(now, options.olderThanHours);
  const listReservations =
    dependencies.listReservations ??
    ((input) => defaultListReservations(input, dependencies));
  const findAuditsByReservationId =
    dependencies.findAuditsByReservationId ??
    ((input) => defaultFindAuditsByReservationId(input, dependencies));
  const finalize = dependencies.finalize ?? finalizeAuditEntitlement;
  const release = dependencies.release ?? releaseAuditEntitlement;

  const reservations = [...(await listReservations({
    cutoffIso,
    limit: options.limit,
    reservationId: options.reservationId,
  }))].sort(compareReservationsByCreatedAt);

  const rows: ReconcileAuditEntitlementsRow[] = [];
  let hasReadErrors = false;

  for (const reservation of reservations) {
    let linkedAudits: ReadonlyArray<AuditReservationLinkedAuditRecord> = [];
    let auditLookupFailed = false;

    try {
      linkedAudits = await findAuditsByReservationId({
        reservationId: reservation.id,
      });
    } catch {
      auditLookupFailed = true;
      hasReadErrors = true;
    }

    const classification = classifyReconcileAuditEntitlementReservation({
      reservation,
      linkedAudits,
      olderThanHours: options.olderThanHours,
      now,
      auditLookupFailed,
    });

    let outcome: ReconcileAuditEntitlementsOutcome = "none";
    let actionStatus: string | null = null;
    let actionReasonCode: string | null = null;

    if (!options.dryRun && (classification.decision === "finalize" || classification.decision === "release")) {
      try {
        const actionResult =
          classification.decision === "finalize"
            ? await finalize({
                workspaceId: reservation.workspaceId,
                operationKey: reservation.operationKey,
                auditId: linkedAudits[0]!.id,
                listingId: linkedAudits[0]!.listingId!,
                userId: linkedAudits[0]!.createdBy!,
                usageSource: "admin_reconcile_entitlements",
              })
            : await release({
                workspaceId: reservation.workspaceId,
                operationKey: reservation.operationKey,
                failureCode: "admin_reconcile_stale_reservation",
              });

        const normalizedMutation = toMutationOutcome(classification.decision, actionResult);
        outcome = normalizedMutation.outcome;
        actionStatus = normalizedMutation.actionStatus;
        actionReasonCode = normalizedMutation.actionReasonCode;
      } catch {
        outcome = "failed";
        actionStatus = "failed";
        actionReasonCode = "unexpected_error";
      }
    }

    const row: ReconcileAuditEntitlementsRow = {
      reservationId: reservation.id,
      workspaceId: reservation.workspaceId,
      operationKeyPreview: summarizeOperationKey(reservation.operationKey),
      source: reservation.source,
      reservationStatus: reservation.status,
      ageHours: classification.ageHours,
      decision: classification.decision,
      reasonCode: classification.reasonCode,
      linkedAuditId: classification.linkedAuditId,
      linkedAuditIds: linkedAudits.map((audit) => audit.id),
      outcome,
      actionStatus,
      actionReasonCode,
    }

    rows.push(row);
  }

  const summary = buildSummary(rows);

  return {
    options,
    cutoffIso,
    rows,
    summary,
    exitCode: hasReadErrors || summary.failed > 0 ? 1 : 0,
  };
}

function formatAgeHours(ageHours: number | null): string {
  return ageHours == null ? "unknown" : `${ageHours.toFixed(1)}h`;
}

export function formatReconcileAuditEntitlementsReport(
  result: ReconcileAuditEntitlementsExecutionResult,
): string {
  const lines: string[] = [];

  lines.push(
    `Mode: ${result.options.dryRun ? "dry-run" : "apply"} | Older than hours: ${result.options.olderThanHours} | Limit: ${result.options.limit}`,
  );
  lines.push(`Cutoff: ${result.cutoffIso}`);

  for (const row of result.rows) {
    lines.push(
      [
        "reservation",
        row.reservationId,
        `workspace=${row.workspaceId}`,
        `op=${row.operationKeyPreview}`,
        `source=${row.source}`,
        `age=${formatAgeHours(row.ageHours)}`,
        `decision=${row.decision}`,
        `reason=${row.reasonCode}`,
        row.linkedAuditId ? `audit=${row.linkedAuditId}` : null,
        row.outcome !== "none" ? `outcome=${row.outcome}` : null,
        row.actionStatus ? `action=${row.actionStatus}` : null,
        row.actionReasonCode ? `action_reason=${row.actionReasonCode}` : null,
      ]
        .filter((value) => value != null)
        .join(" | "),
    );
  }

  lines.push("");
  lines.push(`Scanned: ${result.summary.scanned}`);
  lines.push(`Ignored: ${result.summary.ignored}`);
  lines.push(`Eligible: ${result.summary.eligible}`);
  lines.push(`Finalize candidates: ${result.summary.finalizeCandidates}`);
  lines.push(`Release candidates: ${result.summary.releaseCandidates}`);
  lines.push(`Manual review: ${result.summary.manualReview}`);
  lines.push(`Applied: ${result.summary.applied}`);
  lines.push(`Skipped: ${result.summary.skipped}`);
  lines.push(`Failed: ${result.summary.failed}`);
  lines.push(`Note: ${result.summary.ledgerNote}`);

  return lines.join("\n");
}
