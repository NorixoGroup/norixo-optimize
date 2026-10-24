/**
 * Minimal in-memory stand-in for the parts of the Supabase client the billing code uses (select/eq/in/order/limit,
 * maybeSingle/single, insert, upsert with onConflict + ignoreDuplicates, update). Unique constraints are enforced like
 * the database does, and a failure can be injected once per (table, operation). TEST SUPPORT ONLY: it models filters and
 * constraints, not Postgres functions (the credit reservation RPC is NOT modelled here).
 */
type Row = Record<string, unknown>;
type Result = { data: unknown; error: { code: string; message: string } | null; count?: number | null };

export class InMemoryDatabase {
  readonly tables = new Map<string, Row[]>();
  private readonly uniques = new Map<string, string[][]>();
  private readonly failures = new Set<string>();
  private nextId = 1;

  constructor(options: { unique?: Record<string, string[][]> } = {}) {
    for (const [table, sets] of Object.entries(options.unique ?? {})) this.uniques.set(table, sets);
  }

  rows(table: string): Row[] {
    if (!this.tables.has(table)) this.tables.set(table, []);
    return this.tables.get(table)!;
  }

  seed(table: string, rows: Row[]) {
    for (const row of rows) this.rows(table).push({ id: `id-${this.nextId++}`, ...row });
  }

  failOnce(table: string, operation: "insert" | "upsert" | "update" | "select") {
    this.failures.add(`${table}:${operation}`);
  }

  private shouldFail(table: string, operation: string) {
    const key = `${table}:${operation}`;
    if (!this.failures.has(key)) return false;
    this.failures.delete(key);
    return true;
  }

  private conflicts(table: string, row: Row): boolean {
    return (this.uniques.get(table) ?? []).some((columns) =>
      this.rows(table).some((existing) => columns.every((column) => existing[column] === row[column]))
    );
  }

  /** The client handed to the code under test. */
  client() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- the builder methods below need the database, not their own `this`
    const db = this;
    return {
      from(table: string) {
        const filters: Array<(row: Row) => boolean> = [];
        let operation: "select" | "insert" | "upsert" | "update" = "select";
        let payload: Row | Row[] | null = null;
        let upsertOptions: { onConflict?: string; ignoreDuplicates?: boolean } = {};
        let orderBy: { column: string; ascending: boolean } | null = null;
        let limitTo: number | null = null;
        let head = false;

        const execute = (): Result => {
          if (db.shouldFail(table, operation)) return { data: null, error: { code: "XX000", message: `injected ${operation} failure on ${table}` } };
          const matching = () => db.rows(table).filter((row) => filters.every((f) => f(row)));
          if (operation === "select") {
            let rows = matching();
            if (orderBy) {
              const { column, ascending } = orderBy;
              rows = [...rows].sort((a, b) => (String(a[column]) < String(b[column]) ? -1 : 1) * (ascending ? 1 : -1));
            }
            if (limitTo !== null) rows = rows.slice(0, limitTo);
            return { data: head ? null : rows.map((r) => ({ ...r })), error: null, count: rows.length };
          }
          if (operation === "insert") {
            for (const row of Array.isArray(payload) ? payload : [payload as Row]) {
              if (db.conflicts(table, row)) return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } };
              db.rows(table).push({ id: `id-${db.nextId++}`, created_at: new Date(Date.UTC(2026, 9, 23, 10, 0, db.nextId)).toISOString(), ...row });
            }
            return { data: null, error: null };
          }
          if (operation === "upsert") {
            for (const row of Array.isArray(payload) ? payload : [payload as Row]) {
              if (db.conflicts(table, row)) {
                if (upsertOptions.ignoreDuplicates) continue;
                return { data: null, error: { code: "23505", message: "conflict without ignoreDuplicates" } };
              }
              db.rows(table).push({ id: `id-${db.nextId++}`, ...row });
            }
            return { data: null, error: null };
          }
          for (const row of matching()) Object.assign(row, payload as Row);
          return { data: null, error: null };
        };

        const builder: Record<string, unknown> = {
          select(_columns?: string, options?: { head?: boolean }) { head = Boolean(options?.head); return builder; },
          insert(row: Row | Row[]) { operation = "insert"; payload = row; return builder; },
          upsert(row: Row | Row[], options: { onConflict?: string; ignoreDuplicates?: boolean }) { operation = "upsert"; payload = row; upsertOptions = options; return builder; },
          update(patch: Row) { operation = "update"; payload = patch; return builder; },
          eq(column: string, value: unknown) {
            const [base, key] = column.split("->>");
            filters.push((row) => (key ? ((row[base] as Record<string, unknown> | null) ?? {})[key] === value : row[column] === value));
            return builder;
          },
          in(column: string, values: unknown[]) { filters.push((row) => values.includes(row[column])); return builder; },
          order(column: string, options?: { ascending?: boolean }) { orderBy = { column, ascending: options?.ascending !== false }; return builder; },
          limit(n: number) { limitTo = n; return builder; },
          maybeSingle: async () => { const r = execute(); const rows = (r.data as Row[] | null) ?? []; return r.error ? r : { data: rows[0] ?? null, error: null }; },
          single: async () => { const r = execute(); const rows = (r.data as Row[] | null) ?? []; return r.error ? r : { data: rows[0] ?? null, error: null }; },
          then(resolve: (value: Result) => unknown, reject?: (reason: unknown) => unknown) { return Promise.resolve(execute()).then(resolve, reject); },
        };
        return builder;
      },
    } as never;
  }
}

export const CREDIT_LOT_UNIQUES = { audit_credit_lots: [["source_type", "source_ref"]] };
