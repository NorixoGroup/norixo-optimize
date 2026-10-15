import { readFile } from "node:fs/promises";
import { NextRequest } from "next/server";

import {
  SCHEDULED_DISCOVERY_MARKETS,
  buildScheduledDiscoveryInput,
  isBraveCountryFilterSupported,
  isScheduledDiscoveryEnabled,
  resolveScheduledDiscoveryWindow,
  runScheduledBacklinkDiscovery,
  selectScheduledDiscoveryMarket,
  type ScheduledDiscoveryDependencies,
} from "../lib/automation/backlink-scheduled-discovery";
import { createScheduledDiscoveryCronHandler } from "../app/api/internal/cron/backlinks/discovery/route";
import type { AutomationRun } from "../lib/automation/types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const MONDAY = new Date("2026-10-12T07:30:00.000Z");
assert(MONDAY.getUTCDay() === 1, "Fixture date must be a Monday");

function suggestions(queries: readonly string[]) {
  return {
    suggestions: queries.map((query) => ({ query, countryCode: "US", languageCode: "en", rationale: "r" })),
    rejected: [],
    providerId: "openai",
    model: "test",
  };
}

function makeDeps(overrides: Partial<ScheduledDiscoveryDependencies> = {}) {
  const calls = { generate: [] as unknown[], tick: [] as { workspaceId: string; idempotencyKey: string; discoveryInput: Record<string, unknown> }[], history: 0 };
  const runs = new Map<string, AutomationRun>();
  const deps: ScheduledDiscoveryDependencies = {
    isEnabled: () => true,
    getBraveLimits: () => ({ maxSearchesPerRun: 10, maxResultsPerSearch: 10 }),
    listEligibleWorkspaceIds: async () => ["ws-1"],
    getRunByKey: async ({ workspaceId, idempotencyKey }) => runs.get(`${workspaceId}:${idempotencyKey}`) ?? null,
    listRecentQueries: async () => { calls.history += 1; return []; },
    generateQueries: (async (input: unknown) => {
      calls.generate.push(input);
      return suggestions(["q one resource", "q two roundup", "q three directory", "q four association", "q five contributor", "q six calculator", "q seven extra", "q eight extra"]);
    }) as ScheduledDiscoveryDependencies["generateQueries"],
    runTick: async (input) => {
      calls.tick.push(input);
      runs.set(`${input.workspaceId}:${input.idempotencyKey}`, { status: "completed" } as AutomationRun);
      return { kind: "completed" };
    },
    ...overrides,
  };
  return { deps, calls, runs };
}

async function main(): Promise<void> {
  // 1. Monday / Wednesday / Friday only (UTC); other days skipped.
  const expected: Record<string, boolean> = { "2026-10-11": false, "2026-10-12": true, "2026-10-13": false, "2026-10-14": true, "2026-10-15": false, "2026-10-16": true, "2026-10-17": false };
  for (const [date, scheduled] of Object.entries(expected)) {
    const window = resolveScheduledDiscoveryWindow(new Date(`${date}T12:00:00.000Z`));
    assert((window !== null) === scheduled, `${date} scheduled=${scheduled}`);
    if (window !== null) assert(window.idempotencyKey === `scheduled-discovery:${date}` && window.windowDate === date, "Window key derives from the UTC date");
  }
  assert(resolveScheduledDiscoveryWindow(new Date("2026-10-12T00:00:00.000Z")) !== null, "Monday 00:00 UTC is in the window");
  assert(resolveScheduledDiscoveryWindow(new Date("2026-10-12T23:59:59.999Z")) !== null, "Monday 23:59 UTC is in the window");
  assert(resolveScheduledDiscoveryWindow(new Date("2026-10-13T00:00:00.000Z")) === null, "Tuesday 00:00 UTC is outside");
  assert(resolveScheduledDiscoveryWindow(new Date("invalid")) === null, "Invalid date is outside");

  // 2. Deterministic, auditable market rotation.
  assert(SCHEDULED_DISCOVERY_MARKETS.map((m) => `${m.countryCode}/${m.languageCode}`).join(",") === "US/en,GB/en,FR/fr,ES/es,DE/de,CA/en,JP/en,SG/en,KR/en,TH/en,AE/en", "Configured markets");
  const sequence: string[] = [];
  const cursor = new Date("2026-01-05T12:00:00.000Z");
  while (sequence.length < 24) {
    const window = resolveScheduledDiscoveryWindow(cursor);
    if (window !== null) {
      const market = selectScheduledDiscoveryMarket(window.windowDate);
      sequence.push(market.countryCode);
      assert(selectScheduledDiscoveryMarket(window.windowDate).countryCode === market.countryCode, "Rotation must be repeatable");
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  assert(sequence.join(",") === "US,GB,FR,ES,DE,CA,JP,SG,KR,TH,AE,US,GB,FR,ES,DE,CA,JP,SG,KR,TH,AE,US,GB", `Rotation order: ${sequence.join(",")}`);
  let rejectedTuesday = false;
  try { selectScheduledDiscoveryMarket("2026-10-13"); } catch { rejectedTuesday = true; }
  assert(rejectedTuesday, "A non-scheduled date has no market");

  // 3. Flag disabled: no reads, no AI call, no write.
  {
    const { deps, calls } = makeDeps({
      isEnabled: () => false,
      listEligibleWorkspaceIds: async () => { throw new Error("must not read"); },
      generateQueries: (async () => { throw new Error("must not call AI"); }) as ScheduledDiscoveryDependencies["generateQueries"],
    });
    const result = await runScheduledBacklinkDiscovery(deps, { now: MONDAY });
    assert(result.disposition === "disabled" && calls.tick.length === 0, "Disabled flag must do nothing");
    assert(!isScheduledDiscoveryEnabled({}) && !isScheduledDiscoveryEnabled({ BACKLINK_SCHEDULED_DISCOVERY_ENABLED: "TRUE" }) && !isScheduledDiscoveryEnabled({ BACKLINK_SCHEDULED_DISCOVERY_ENABLED: "1" }), "Flag is OFF unless exactly 'true'");
    assert(isScheduledDiscoveryEnabled({ BACKLINK_SCHEDULED_DISCOVERY_ENABLED: "true" }), "Flag 'true' enables");
  }

  // 4. Non-scheduled day and Brave not configured: nothing runs, no AI cost.
  {
    const { deps, calls } = makeDeps();
    assert((await runScheduledBacklinkDiscovery(deps, { now: new Date("2026-10-13T07:30:00.000Z") })).disposition === "not_scheduled_day", "Tuesday skipped");
    const braveOff = makeDeps({ getBraveLimits: () => null });
    assert((await runScheduledBacklinkDiscovery(braveOff.deps, { now: MONDAY })).disposition === "brave_disabled", "Brave disabled");
    assert(calls.generate.length === 0 && braveOff.calls.generate.length === 0 && braveOff.calls.tick.length === 0, "No AI call without a scheduled day and Brave");
  }

  // 5. Query and result limits; Brave runtime limits can only lower them.
  {
    const { deps, calls } = makeDeps();
    await runScheduledBacklinkDiscovery(deps, { now: MONDAY });
    const input = calls.tick[0]!.discoveryInput as { searches: unknown[]; maxResultsPerSearch: number; maxCandidates: number; provider: string; source: string };
    assert(input.searches.length === 5 && input.maxResultsPerSearch === 5 && input.maxCandidates === 25, "At most 5 queries and 5 results per query");
    assert(input.provider === "brave_search" && input.source === "scheduled", "Brave provider, scheduled source");
    assert((calls.generate[0] as { count: number }).count === 5, "AI asked for at most 5");
    const lowered = buildScheduledDiscoveryInput({ queries: ["a b c", "d e f", "g h i"], market: SCHEDULED_DISCOVERY_MARKETS[0]!, braveLimits: { maxSearchesPerRun: 2, maxResultsPerSearch: 3 } });
    assert((lowered.searches as unknown[]).length === 2 && lowered.maxResultsPerSearch === 3, "Runtime Brave limits lower the caps");
    const mondayMarket = selectScheduledDiscoveryMarket("2026-10-12");
    const searches = input.searches as { countryCode?: string; languageCode: string }[];
    assert(
      searches.every((s) => s.languageCode === mondayMarket.languageCode && s.countryCode === (isBraveCountryFilterSupported(mondayMarket.countryCode) ? mondayMarket.countryCode : undefined)),
      "All searches use the window's market",
    );
    assert((calls.generate[0] as { countryCode: string }).countryCode === mondayMarket.countryCode, "Generator receives the window's market");
    const frWindow = makeDeps();
    await runScheduledBacklinkDiscovery(frWindow.deps, { now: new Date("2026-01-09T07:00:00.000Z") });
    assert((frWindow.calls.generate[0] as { countryCode: string; languageCode: string }).countryCode === "FR", "Market passed to the generator");
  }

  // 5b. Asian / Middle Eastern markets: English, and no Brave country filter where it is unsupported.
  {
    for (const [date, country, filtered] of [["2026-01-19", "JP", true], ["2026-01-21", "SG", true], ["2026-01-23", "KR", true], ["2026-01-26", "TH", false], ["2026-01-28", "AE", false]] as const) {
      const state = makeDeps();
      await runScheduledBacklinkDiscovery(state.deps, { now: new Date(`${date}T07:30:00.000Z`) });
      const generated = state.calls.generate[0] as { countryCode: string; languageCode: string; count: number };
      assert(generated.countryCode === country && generated.languageCode === "en" && generated.count === 5, `${country}: English generation for the market`);
      const searches = state.calls.tick[0]!.discoveryInput.searches as { countryCode?: string; languageCode?: string }[];
      assert(searches.length === 5 && searches.every((s) => s.languageCode === "en"), `${country}: five English searches`);
      assert(searches.every((s) => (filtered ? s.countryCode === country : s.countryCode === undefined)), `${country}: Brave country filter ${filtered ? "kept" : "omitted"}`);
      assert((state.calls.tick[0]!.discoveryInput as { maxResultsPerSearch: number }).maxResultsPerSearch === 5, `${country}: five results per search`);
    }
    assert(isBraveCountryFilterSupported("JP") && isBraveCountryFilterSupported("US") && !isBraveCountryFilterSupported("TH") && !isBraveCountryFilterSupported("AE"), "Country filter support table");
  }

  // 6. Historical query deduplication.
  {
    const history = Array.from({ length: 40 }, (_, index) => `old query number ${index}`);
    history.push("Q One Resource!");
    const { deps, calls } = makeDeps({ listRecentQueries: async () => history });
    await runScheduledBacklinkDiscovery(deps, { now: MONDAY });
    const queries = (calls.tick[0]!.discoveryInput.searches as { query: string }[]).map((s) => s.query);
    assert(!queries.includes("q one resource"), "A previously used query (normalized) must be removed");
    assert(queries.length === 5 && new Set(queries).size === 5, "Remaining queries stay unique");
    assert((calls.generate[0] as { excludeQueries: string[] }).excludeQueries.length === 30, "The prompt sees only the most recent 30");
    const allUsed = makeDeps({ listRecentQueries: async () => ["q one resource", "q two roundup", "q three directory", "q four association", "q five contributor", "q six calculator", "q seven extra", "q eight extra"] });
    const result = await runScheduledBacklinkDiscovery(allUsed.deps, { now: MONDAY });
    assert(result.disposition === "completed" && result.workspaces[0]?.outcome === "skipped_no_queries" && allUsed.calls.tick.length === 0, "No fresh query means no run");
  }

  // 7. Duplicate scheduled window is rejected; retries are safe.
  {
    const { deps, calls } = makeDeps();
    await runScheduledBacklinkDiscovery(deps, { now: MONDAY });
    const second = await runScheduledBacklinkDiscovery(deps, { now: new Date("2026-10-12T19:00:00.000Z") });
    assert(second.disposition === "completed" && second.workspaces[0]?.outcome === "skipped_window_exists", "Second delivery in the same UTC date is skipped");
    assert(calls.tick.length === 1 && calls.generate.length === 1, "No second AI call or run for the same window");
    assert(calls.tick[0]!.idempotencyKey === "scheduled-discovery:2026-10-12", "Run idempotency key");
    for (const status of ["running", "completed", "failed", "cancelled"] as const) {
      const state = makeDeps({ getRunByKey: async () => ({ status } as AutomationRun) });
      await runScheduledBacklinkDiscovery(state.deps, { now: MONDAY });
      assert(state.calls.tick.length === 0 && state.calls.generate.length === 0, `A ${status} run is never restarted`);
    }
    const queued = makeDeps({ getRunByKey: async () => ({ status: "queued" } as AutomationRun) });
    await runScheduledBacklinkDiscovery(queued.deps, { now: MONDAY });
    assert(queued.calls.tick.length === 1, "A prepared-but-unstarted run may be resumed");
    const next = await runScheduledBacklinkDiscovery(deps, { now: new Date("2026-10-14T07:30:00.000Z") });
    assert(next.disposition === "completed" && next.workspaces[0]?.outcome === "completed", "The next window is independent");
  }

  // 8. Failures are contained and do not leak details.
  {
    const aiFailure = makeDeps({ generateQueries: (async () => { throw new Error("secret-token-xyz AI down"); }) as ScheduledDiscoveryDependencies["generateQueries"] });
    const aiResult = await runScheduledBacklinkDiscovery(aiFailure.deps, { now: MONDAY });
    assert(aiResult.disposition === "completed" && aiResult.workspaces[0]?.outcome === "error" && aiFailure.calls.tick.length === 0, "AI failure: no Brave run");
    assert(!JSON.stringify(aiResult).includes("secret-token-xyz"), "Errors must not leak details");
    const providerFailure = makeDeps({ runTick: async () => { throw new Error("BRAVE provider failed"); } });
    const providerResult = await runScheduledBacklinkDiscovery(providerFailure.deps, { now: MONDAY });
    assert(providerResult.disposition === "completed" && providerResult.workspaces[0]?.outcome === "error", "Provider failure is reported, not thrown");
    const failedTick = makeDeps({ runTick: async () => ({ kind: "failed" }) });
    assert(((await runScheduledBacklinkDiscovery(failedTick.deps, { now: MONDAY })) as unknown as { workspaces: { outcome: string }[] }).workspaces[0]?.outcome === "failed", "Failed tick reported");
    const mixed = makeDeps({
      listEligibleWorkspaceIds: async () => ["ws-b", "ws-a"],
      generateQueries: (async () => { if (mixed.calls.generate.length++ === 0) throw new Error("boom"); return suggestions(["x y z one", "x y z two"]); }) as unknown as ScheduledDiscoveryDependencies["generateQueries"],
    });
    const mixedResult = await runScheduledBacklinkDiscovery(mixed.deps, { now: MONDAY });
    assert(mixedResult.disposition === "completed" && mixedResult.workspaces.map((w) => `${w.workspaceId}:${w.outcome}`).join(",") === "ws-a:error,ws-b:completed", "One workspace failing must not block another");
  }

  // 9. Cron handler: authentication and flag gate.
  {
    let constructed: number = 0;
    const handler = (enabled: boolean, secret = "s3cret") =>
      createScheduledDiscoveryCronHandler({
        cronSecret: () => secret,
        isEnabled: () => enabled,
        createProductionDependencies: () => { constructed += 1; return makeDeps().deps; },
        run: runScheduledBacklinkDiscovery,
        now: () => MONDAY,
      });
    const request = (authorization?: string) => new NextRequest("http://localhost/api/internal/cron/backlinks/discovery", { headers: authorization === undefined ? {} : { authorization } });
    assert((await handler(true)(request())).status === 401, "Missing authorization");
    assert((await handler(true)(request("Bearer wrong"))).status === 401, "Wrong secret");
    assert((await handler(true, "")(request("Bearer "))).status === 401, "Empty configured secret never authorizes");
    const disabled = await handler(false)(request("Bearer s3cret"));
    assert(disabled.status === 200 && (await disabled.json()).disposition === "disabled" && constructed === 0, "Flag OFF: no dependencies are even constructed");
    const enabledResponse = await handler(true)(request("Bearer s3cret"));
    assert(enabledResponse.status === 200 && Number(constructed) === 1, "Authorized and enabled runs");
    const failing = createScheduledDiscoveryCronHandler({ cronSecret: () => "s3cret", isEnabled: () => true, createProductionDependencies: () => { throw new Error("db password leak"); }, run: runScheduledBacklinkDiscovery, now: () => MONDAY });
    const failed = await failing(request("Bearer s3cret"));
    assert(failed.status === 500 && !JSON.stringify(await failed.json()).includes("leak"), "Failures are generic");
  }

  // 10. Scope: preview-only, no promotion/outreach/contact/ZeroBounce, no cron registered.
  {
    const files = await Promise.all([
      "lib/automation/backlink-scheduled-discovery.ts",
      "lib/automation/backlink-scheduled-discovery-production.ts",
      "lib/automation/repositories/scheduledDiscoveryRepository.ts",
      "app/api/internal/cron/backlinks/discovery/route.ts",
    ].map((file) => readFile(file, "utf8")));
    const code = files.join("\n").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    assert(!/resend|zerobounce|outreach|sendTransactionalEmail|contactResolution|contactForm|mailbox|promotions\/apply|applyBacklinkPromotion|campaigns\/apply|createCampaign|intakeBacklinkDiscoveryOpportunity/i.test(code), "Scheduled discovery must not reach outreach, contacts, ZeroBounce, promotion or campaigns");
    assert(code.includes('requestedScope: "preview"') && !code.includes('requestedScope: "apply"'), "Qualification and promotion stay preview");
    assert(!/\.(insert|update|delete|upsert|rpc)\(/.test(code), "No direct writes from the scheduled discovery layer");
    const vercel = await readFile("vercel.json", "utf8");
    assert(!vercel.includes("backlinks/discovery"), "No cron is registered by this change");
  }

  console.log("PASS — Automation backlink scheduled discovery smoke");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
