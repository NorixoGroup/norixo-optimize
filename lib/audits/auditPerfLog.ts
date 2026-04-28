const DEBUG_AUDIT_PERF = process.env.DEBUG_AUDIT_PERF === "true";

export type AuditPerfStep =
  | "target-extraction"
  | "competitor-discovery"
  | "booking-candidates"
  | "booking-extraction"
  | "airbnb-fallback"
  | "candidate-evaluation"
  | "run-audit"
  | "total";

export type AuditPerfFields = {
  step: AuditPerfStep;
  durationMs?: number | null;
  countIn?: number | null;
  countOut?: number | null;
  platform?: string | null;
  note?: string | null;
};

export function auditPerfLog(fields: AuditPerfFields): void {
  if (!DEBUG_AUDIT_PERF) return;
  const payload = {
    step: fields.step,
    durationMs: fields.durationMs ?? null,
    countIn: fields.countIn ?? null,
    countOut: fields.countOut ?? null,
    platform: fields.platform ?? null,
    note: fields.note ?? null,
  };
  console.info(`[audit-perf][${fields.step}]`, JSON.stringify(payload));
}
