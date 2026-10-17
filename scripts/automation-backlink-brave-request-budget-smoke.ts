import { readFile } from "node:fs/promises";

import {
  BacklinkDiscoveryProviderError,
  createMockBacklinkDiscoveryProvider,
  executeBacklinkDiscoveryPreview,
  type MockBacklinkDiscoveryFixture,
} from "../lib/automation";
import type { BacklinkDiscoveryProvider, BacklinkDiscoveryRequestContext } from "../lib/automation/backlink-discovery-provider-types";
import {
  BACKLINK_BRAVE_REQUEST_BUDGET_LIMIT,
  buildBraveRequestKey,
  createBudgetedBacklinkDiscoveryProvider,
  type BraveRequestReservationOutcome,
  type ReserveBraveRequest,
} from "../lib/automation/brave-request-budget";
import type { AutomationTask } from "../lib/automation/types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Model of the database contract (global lock, rolling count, unique key, replay).
 * It exercises the application behaviour that depends on that contract. It is NOT
 * evidence that the SQL function is atomic; that needs the isolated-database
 * verification script, which is reported separately as NOT EXECUTED.
 */
function createLedgerModel(options: { limit?: number; now?: () => number } = {}) {
  const limit = options.limit ?? BACKLINK_BRAVE_REQUEST_BUDGET_LIMIT;
  const now = options.now ?? (() => Date.now());
  const rows: { workspaceId: string; key: string; at: number }[] = [];
  let lock: Promise<unknown> = Promise.resolve();
  const reserve: ReserveBraveRequest = (input) => {
    const run = lock.then(async () => {
      await Promise.resolve(); // yield: concurrent callers interleave here without the lock
      const existing = rows.find((row) => row.workspaceId === input.workspaceId && row.key === input.requestKey);
      const used = rows.filter((row) => row.at > now() - WINDOW_MS).length;
      if (existing !== undefined) return { outcome: "replayed" as BraveRequestReservationOutcome };
      if (used >= limit) return { outcome: "limit_reached" as BraveRequestReservationOutcome };
      rows.push({ workspaceId: input.workspaceId, key: input.requestKey, at: now() });
      return { outcome: "reserved" as BraveRequestReservationOutcome };
    });
    lock = run.catch(() => undefined);
    return run;
  };
  return { rows, reserve };
}

function countingProvider(): { provider: BacklinkDiscoveryProvider; calls: () => number } {
  let calls: number = 0;
  return {
    calls: () => calls,
    provider: {
      name: "brave_search",
      async search(input) {
        calls += 1;
        return { query: input.query, queryIndex: input.queryIndex, countryCode: input.countryCode, languageCode: input.languageCode, items: [] };
      },
    },
  };
}

const context = (taskId: string, taskAttempt = 1): BacklinkDiscoveryRequestContext => ({ workspaceId: "ws-1", runId: "run-1", taskId, taskAttempt });
const searchInput = (queryIndex: number, requestContext?: BacklinkDiscoveryRequestContext) => ({
  query: "vacation rental resource directory",
  queryIndex,
  countryCode: "US",
  languageCode: "en",
  maxResults: 5,
  ...(requestContext === undefined ? {} : { requestContext }),
});

async function expectRejection(operation: () => Promise<unknown>, code: string, label: string): Promise<void> {
  try {
    await operation();
  } catch (error) {
    assert((error as { code?: string }).code === code, `${label}: expected ${code}, got ${(error as { code?: string }).code}`);
    return;
  }
  throw new Error(`${label}: expected rejection`);
}

async function main(): Promise<void> {
  // 1. Only an explicit new reservation permits an HTTP request.
  {
    const ledger = createLedgerModel();
    const inner = countingProvider();
    const provider = createBudgetedBacklinkDiscoveryProvider(inner.provider, ledger.reserve);
    await provider.search(searchInput(0, context("task-a")));
    assert(inner.calls() === 1 && ledger.rows.length === 1, "A reserved request must be sent exactly once");

    // Idempotent replay of the same attempt/query: no second HTTP request.
    await expectRejection(() => provider.search(searchInput(0, context("task-a"))), "PROVIDER_QUOTA_EXCEEDED", "replay");
    assert(inner.calls() === 1 && ledger.rows.length === 1, "Replay must not send or reserve again");

    // A retry is a new attempt: it needs, and gets, a new reservation.
    await provider.search(searchInput(0, context("task-a", 2)));
    assert(Number(inner.calls()) === 2 && Number(ledger.rows.length) === 2, "A new attempt must reserve and send once");
    assert(buildBraveRequestKey(context("task-a", 1), 0) !== buildBraveRequestKey(context("task-a", 2), 0), "Attempt must change the key");
    assert(buildBraveRequestKey(context("task-a", 1), 0) !== buildBraveRequestKey(context("task-a", 1), 1), "Query index must change the key");
  }

  // 2. Fail closed: unavailable, malformed, missing context.
  {
    const inner = countingProvider();
    for (const [label, reserve] of [
      ["reserve throws", (async () => { throw new Error("database down"); }) as ReserveBraveRequest],
      ["unknown outcome", (async () => ({ outcome: "ok" })) as unknown as ReserveBraveRequest],
      ["no result", (async () => undefined) as unknown as ReserveBraveRequest],
    ] as const) {
      const provider = createBudgetedBacklinkDiscoveryProvider(inner.provider, reserve);
      await expectRejection(() => provider.search(searchInput(0, context("task-x"))), "PROVIDER_CONFIGURATION_ERROR", label);
    }
    const provider = createBudgetedBacklinkDiscoveryProvider(inner.provider, createLedgerModel().reserve);
    await expectRejection(() => provider.search(searchInput(0)), "PROVIDER_CONFIGURATION_ERROR", "missing context");
    assert(inner.calls() === 0, "No HTTP request may be sent when the budget is unavailable");
  }

  // 3. Rolling window, shared by manual and scheduled callers, across workspaces.
  {
    let clock = Date.UTC(2026, 9, 1);
    const ledger = createLedgerModel({ now: () => clock });
    const inner = countingProvider();
    const provider = createBudgetedBacklinkDiscoveryProvider(inner.provider, ledger.reserve);
    for (let index = 0; index < 79; index += 1) {
      await provider.search(searchInput(index, { workspaceId: index % 2 === 0 ? "ws-1" : "ws-2", runId: null, taskId: `manual-${index}`, taskAttempt: 1 }));
    }
    await provider.search(searchInput(0, { workspaceId: "ws-2", runId: "run-m", taskId: "manual-last", taskAttempt: 1 })); // 80th: manual
    assert(inner.calls() === 80, "80 requests are allowed");
    await expectRejection(
      () => provider.search(searchInput(0, { workspaceId: "ws-1", runId: "run-s", taskId: "scheduled-1", taskAttempt: 1 })),
      "PROVIDER_BUDGET_EXHAUSTED",
      "81st (scheduled)",
    );
    assert(inner.calls() === 80, "The 81st request must not be sent, even from another workspace or caller type");
    clock += WINDOW_MS - 1000;
    await expectRejection(() => provider.search(searchInput(1, context("scheduled-2"))), "PROVIDER_BUDGET_EXHAUSTED", "still inside window");
    clock += 2000; // all reservations are now older than 30 days
    await provider.search(searchInput(0, context("scheduled-3")));
    assert(inner.calls() === 81, "Budget frees only when reservations leave the rolling window");
  }

  // 4. Concurrent callers never exceed the cap (contract model; see header comment).
  {
    const ledger = createLedgerModel();
    const inner = countingProvider();
    const provider = createBudgetedBacklinkDiscoveryProvider(inner.provider, ledger.reserve);
    const results = await Promise.allSettled(
      Array.from({ length: 150 }, (_, index) => provider.search(searchInput(0, { workspaceId: `ws-${index % 3}`, runId: null, taskId: `c-${index}`, taskAttempt: 1 }))),
    );
    assert(results.filter((result) => result.status === "fulfilled").length === 80, "Exactly 80 concurrent requests may succeed");
    assert(inner.calls() === 80 && ledger.rows.length === 80, "HTTP requests must equal reservations");
    // Same key raced from two workers: only one may send.
    const raceLedger = createLedgerModel();
    const raceInner = countingProvider();
    const raceProvider = createBudgetedBacklinkDiscoveryProvider(raceInner.provider, raceLedger.reserve);
    const race = await Promise.allSettled([raceProvider.search(searchInput(0, context("same"))), raceProvider.search(searchInput(0, context("same")))]);
    assert(race.filter((result) => result.status === "fulfilled").length === 1 && raceInner.calls() === 1, "A duplicated key must send once");
  }

  // 5. The discovery handler supplies the context, for manual and scheduled sources alike.
  {
    const fixture: MockBacklinkDiscoveryFixture = { query: "vacation rental resource directory", countryCode: "US", languageCode: "en", items: [{ url: "https://example.com/a", title: "A", snippet: null, rank: 1 }] };
    const ledger = createLedgerModel();
    const mock = createMockBacklinkDiscoveryProvider([fixture]);
    const budgeted = createBudgetedBacklinkDiscoveryProvider({ ...mock, name: "brave_search" }, ledger.reserve);
    const task = { id: "t-1", attemptCount: 1 } as unknown as AutomationTask;
    for (const source of ["manual_dashboard", "scheduled"] as const) {
      const input = {
        workspaceId: "ws-1", runId: "run-1", taskId: `t-${source}`, taskKind: "backlinks.discovery.preview" as const, attemptedAt: new Date().toISOString(),
        task: { ...task, id: `t-${source}` },
        input: { version: 1, source, provider: "brave_search", searches: [{ query: fixture.query, countryCode: "US", languageCode: "en" }], maxResultsPerSearch: 5, maxCandidates: 5 },
      };
      const result = await executeBacklinkDiscoveryPreview({ providers: { brave_search: budgeted } }, input as never);
      assert((result.output as { summary: { resultsReceived: number } }).summary.resultsReceived === 1, `${source}: handler must complete`);
    }
    assert(ledger.rows.length === 2, "Manual and scheduled discovery must both reserve in the same ledger");
    // Without a task the handler provides no context, so the budgeted provider refuses.
    await expectRejection(
      () => executeBacklinkDiscoveryPreview({ providers: { brave_search: budgeted } }, {
        workspaceId: "ws-1", runId: "run-1", taskId: "t-none", taskKind: "backlinks.discovery.preview", attemptedAt: new Date().toISOString(),
        input: { version: 1, source: "manual_dashboard", provider: "brave_search", searches: [{ query: fixture.query, countryCode: "US", languageCode: "en" }], maxResultsPerSearch: 5, maxCandidates: 5 },
      } as never),
      "PROVIDER_CONFIGURATION_ERROR",
      "no task context",
    );
  }

  // 5b. Budget exhaustion keeps partial results; Brave's own 429 and other errors do not.
  {
    const queries = ["partial one", "partial two", "partial three", "partial four"];
    const fixtures: MockBacklinkDiscoveryFixture[] = queries.map((query, index) => ({
      query,
      countryCode: "US",
      languageCode: "en",
      items: [
        { url: "https://example.com/shared", title: "Shared", snippet: null, rank: 1 },
        { url: `https://example.com/unique-${index}`, title: `Unique ${index}`, snippet: null, rank: 2 },
      ],
    }));
    const mockInner = createMockBacklinkDiscoveryProvider(fixtures);
    let httpCalls = 0;
    const counted: BacklinkDiscoveryProvider = {
      name: "brave_search",
      async search(searchInput) {
        httpCalls += 1;
        return mockInner.search(searchInput);
      },
    };
    const run = (reserve: ReserveBraveRequest, taskId: string, searchCount: number, provider: BacklinkDiscoveryProvider = counted) =>
      executeBacklinkDiscoveryPreview(
        { providers: { brave_search: createBudgetedBacklinkDiscoveryProvider(provider, reserve) } },
        {
          workspaceId: "ws-1", runId: "run-1", taskId, taskKind: "backlinks.discovery.preview", attemptedAt: new Date().toISOString(),
          task: { id: taskId, attemptCount: 1 } as unknown as AutomationTask,
          input: {
            version: 1, source: "scheduled", provider: "brave_search",
            searches: queries.slice(0, searchCount).map((query) => ({ query, countryCode: "US", languageCode: "en" })),
            maxResultsPerSearch: 5, maxCandidates: 10,
          },
        } as never,
      ).then((result) => result.output as {
        summary: { searchesRequested: number; resultsReceived: number; candidatesAccepted: number; candidatesRejected: number; truncated: boolean; searchesExecuted?: number; stoppedReason?: string };
        candidates: { sourceUrl: string }[];
        rejections: { code: string; count: number }[];
      });

    // Exhausted after one and after two successful searches: results kept, deduplicated, no further HTTP call.
    for (const [limit, executed] of [[1, 1], [2, 2]] as const) {
      httpCalls = 0;
      const ledger = createLedgerModel({ limit });
      const output = await run(ledger.reserve, `partial-${limit}`, 4);
      assert(httpCalls === executed && ledger.rows.length === executed, `limit ${limit}: no HTTP call after the refusal`);
      assert(output.summary.truncated === true && output.summary.stoppedReason === "budget_exhausted" && output.summary.searchesExecuted === executed, `limit ${limit}: explicit incomplete summary`);
      assert(output.summary.searchesRequested === 4, `limit ${limit}: searchesRequested stays the request size`);
      assert(output.candidates.length === executed + 1 && output.summary.candidatesAccepted === executed + 1, `limit ${limit}: candidates kept and deduplicated`);
      assert(output.candidates.filter((candidate) => candidate.sourceUrl.endsWith("/shared")).length === 1, `limit ${limit}: shared URL appears once`);
      assert(executed === 1 || output.rejections.some((rejection) => rejection.code === "duplicate_url" && rejection.count === 1), `limit ${limit}: duplicate counted`);
    }

    // Exhausted before the first search: empty, explicitly incomplete, no HTTP call.
    httpCalls = 0;
    const emptyLedger = createLedgerModel({ limit: 0 });
    const empty = await run(emptyLedger.reserve, "partial-0", 2);
    assert(httpCalls === 0 && emptyLedger.rows.length === 0, "No HTTP call and no row when the budget is already exhausted");
    assert(empty.candidates.length === 0 && empty.summary.truncated === true && empty.summary.searchesExecuted === 0 && empty.summary.stoppedReason === "budget_exhausted", "Zero searches: empty, incomplete result");

    // Not exhausted: summary unchanged (no new keys).
    httpCalls = 0;
    const full = await run(createLedgerModel().reserve, "partial-full", 2);
    assert(full.summary.truncated === false && !("searchesExecuted" in full.summary) && !("stoppedReason" in full.summary), "Complete run keeps the existing summary shape");
    assert(Number(httpCalls) === 2, "Complete run sends every search");

    // Brave HTTP 429, transient errors, configuration errors and replays still fail the task and keep their codes.
    for (const [code, retryable] of [["PROVIDER_QUOTA_EXCEEDED", true], ["PROVIDER_TRANSIENT_ERROR", true], ["PROVIDER_CONFIGURATION_ERROR", false]] as const) {
      let calls = 0;
      const failing: BacklinkDiscoveryProvider = {
        name: "brave_search",
        async search(searchInput) {
          calls += 1;
          if (calls === 2) throw new BacklinkDiscoveryProviderError(code, "deterministic", retryable);
          return mockInner.search(searchInput);
        },
      };
      await expectRejection(() => run(createLedgerModel().reserve, `err-${code}`, 3, failing), code, `${code} must still propagate`);
      assert(calls === 2, `${code}: no search after the error`);
    }
    const replayLedger = createLedgerModel();
    await replayLedger.reserve({ workspaceId: "ws-1", runId: null, requestKey: buildBraveRequestKey({ workspaceId: "ws-1", runId: null, taskId: "replay-task", taskAttempt: 1 }, 1) });
    await expectRejection(() => run(replayLedger.reserve, "replay-task", 3), "PROVIDER_QUOTA_EXCEEDED", "A replay must still fail the task");

    // Distinct codes, global ledger untouched by the partial run.
    assert(!(new BacklinkDiscoveryProviderError("PROVIDER_BUDGET_EXHAUSTED", "x", false).code === ("PROVIDER_QUOTA_EXCEEDED" as string)), "Budget and 429 codes differ");
    const capLedger = createLedgerModel();
    await run(capLedger.reserve, "cap-check", 2);
    assert(capLedger.rows.length === 2 && BACKLINK_BRAVE_REQUEST_BUDGET_LIMIT === 80, "Reservations unchanged: one per search, cap still 80");
  }

  // 6. Migration and wiring are statically what the design requires.
  {
    const sql = await readFile("supabase/migrations/20261012120000_add_backlink_brave_request_budget.sql", "utf8");
    const lock = sql.indexOf("pg_advisory_xact_lock");
    assert(lock !== -1 && lock < sql.indexOf("count(*)") && sql.indexOf("count(*)") < sql.indexOf("insert into public.backlink_brave_request_reservations"), "Lock must precede count and insert");
    for (const fragment of [
      "c_limit constant integer := 80", "interval '30 days'",
      "unique (workspace_id, request_key)", "enable row level security",
      "security definer", "set search_path = public, pg_temp",
      "'replayed'", "'limit_reached'", "'reserved'", "clock_timestamp()",
      "revoke all on table public.backlink_brave_request_reservations", "from public, anon, authenticated",
      "to service_role",
    ]) {
      assert(sql.includes(fragment), `Migration missing ${fragment}`);
    }
    assert(!/create policy/i.test(sql), "Ledger must have no user-facing policies");
    assert(!/references\s/i.test(sql), "Ledger must not have foreign keys that could free budget on delete");
    // Ledger rows must never be deleted, updated or truncated by the migration's own code. Privilege
    // REVOKE statements legitimately name those verbs, so they are removed before looking for real operations.
    const executable = sql
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("--"))
      .join("\n")
      .replace(/\brevoke\b[^;]*;/gi, "");
    assert(
      !/\bdelete\s+from\b|\bupdate\s+(?:only\s+)?(?:public\.)?backlink_brave_request_reservations\b|\btruncate\b/i.test(executable),
      "Ledger rows must never be deleted, updated or truncated by the migration",
    );
    // Every direct privilege on the ledger must be revoked from PUBLIC, anon, authenticated and service_role
    // (REVOKE ALL also covers REFERENCES, TRIGGER and MAINTAIN, which default privileges hand out), and
    // never granted back. Only comment-free text is inspected, so a comment cannot satisfy the check.
    const uncommented = sql
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("--"))
      .join("\n");
    const fullRevoke = uncommented.match(
      /revoke\s+all(?:\s+privileges)?\s+on\s+(?:table\s+)?public\.backlink_brave_request_reservations\s+from\s+([^;]+);/i,
    );
    assert(fullRevoke !== null, "The ledger must have a REVOKE ALL statement");
    const revokedFrom = (fullRevoke?.[1] ?? "").split(",").map((role) => role.trim().toLowerCase());
    for (const role of ["public", "anon", "authenticated", "service_role"]) {
      assert(revokedFrom.includes(role), `REVOKE ALL on the ledger must include ${role}`);
    }
    // The revoke must come before the SELECT grant, otherwise it would remove the audit read access.
    const revokeAt = fullRevoke?.index ?? -1;
    const selectGrantAt = uncommented.search(
      /grant\s+select\s+on\s+table\s+public\.backlink_brave_request_reservations\s+to\s+service_role\s*;/i,
    );
    assert(revokeAt !== -1 && selectGrantAt > revokeAt, "REVOKE ALL must precede the SELECT grant to service_role");
    assert(
      !/grant\s+(?:all|[^;]*\b(?:insert|update|delete|truncate)\b)[^;]*on\s+(?:table\s+)?public\.backlink_brave_request_reservations/i.test(executable),
      "No write privilege may be granted on the ledger",
    );
    assert(/grant\s+select\s+on\s+table\s+public\.backlink_brave_request_reservations\s+to\s+service_role\s*;/i.test(sql), "service_role keeps read-only access");
    // Hardening: isolation guard first, and the clock is read only after the advisory lock is held.
    const isolation = sql.indexOf("transaction_isolation");
    const lockAt = sql.indexOf("pg_advisory_xact_lock");
    const clockAt = sql.indexOf("v_now := clock_timestamp()");
    assert(sql.includes("'read committed'") && sql.includes("errcode = '55000'"), "Isolation guard must reject non-READ COMMITTED");
    assert(isolation !== -1 && isolation < lockAt, "Isolation guard must precede the lock");
    assert(clockAt > lockAt && lockAt !== -1, "The clock must be read after the lock");
    assert(/v_now timestamptz;/.test(sql) && !/v_now timestamptz\s*:=/.test(sql), "v_now must not be initialised before the lock");
    assert(!/p_limit|p_window/i.test(sql), "The limit must not be caller-controlled");
    assert(!/api[_-]?key|subscription/i.test(sql), "No secrets in the ledger");

    const composition = await readFile("lib/automation/production-composition.ts", "utf8");
    assert(
      /createBudgetedBacklinkDiscoveryProvider\(\s*createBraveBacklinkDiscoveryProvider\(/.test(composition) &&
        composition.includes("reserveBacklinkBraveRequest(client, reservation)"),
      "Brave provider must be wrapped by the reservation",
    );
    const handler = await readFile("lib/automation/backlink-discovery-handler.ts", "utf8");
    assert(handler.includes("requestContext") && handler.includes("taskAttempt: input.task.attemptCount"), "Handler must pass the request context");
    const rawBrave = await readFile("lib/automation/brave-backlink-discovery-provider.ts", "utf8");
    assert(!rawBrave.includes("requestContext"), "The raw Brave provider stays unchanged");
    const repository = await readFile("lib/automation/repositories/braveRequestBudgetRepository.ts", "utf8");
    assert(repository.includes("reserve_backlink_brave_request") && !repository.includes("count("), "Repository only calls the RPC");
  }

  console.log("PASS — Automation backlink Brave request budget smoke");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
