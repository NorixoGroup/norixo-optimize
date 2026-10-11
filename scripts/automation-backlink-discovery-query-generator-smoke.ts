import { readFileSync } from "node:fs";

import {
  BacklinkDiscoveryQuerySuggestionError,
  generateBacklinkDiscoveryQuerySuggestions,
  type BacklinkDiscoveryQuerySuggestionDependencies,
  type BacklinkDiscoveryQuerySuggestionErrorCode,
} from "../lib/automation/backlink-discovery-query-generator";
import type { MarketingAiExecutionRequest } from "../lib/marketing-ai/adapters/base/adapterTypes";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function aiResult(output: string | null, status: "success" | "simulation" | "error" = "success") {
  return { providerId: "openai" as const, model: "test-model", status, output, error: null, costEur: 0, durationMs: 1 };
}

function suggestion(query: string, extra: Record<string, unknown> = {}) {
  return { query, countryCode: "US", languageCode: "en", rationale: "Relevant editorial angle.", ...extra };
}

function fakeDeps(
  output: string | null,
  status: "success" | "simulation" | "error" = "success",
): { deps: BacklinkDiscoveryQuerySuggestionDependencies; requests: MarketingAiExecutionRequest[] } {
  const requests: MarketingAiExecutionRequest[] = [];
  return {
    requests,
    deps: {
      executeAiRequest: async (request) => {
        requests.push(request);
        return aiResult(output, status);
      },
    },
  };
}

async function expectCode(
  operation: () => Promise<unknown>,
  code: BacklinkDiscoveryQuerySuggestionErrorCode,
  label: string,
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    assert(error instanceof BacklinkDiscoveryQuerySuggestionError && error.code === code, `${label}: expected ${code}`);
    return;
  }
  throw new Error(`${label}: expected rejection ${code}`);
}

const base = { countryCode: "US", languageCode: "en" };

async function main(): Promise<void> {
  // Valid response, with duplicate / excluded / commercial / locale / length rejections.
  const mixed = fakeDeps(
    JSON.stringify({
      suggestions: [
        suggestion("vacation rental owner resources guide"),
        suggestion("Vacation Rental Owner Resources Guide!"), // duplicate after normalization
        suggestion("airbnb host resources"), // excluded by operator
        suggestion("buy backlinks for vacation rentals"), // commercial
        suggestion("short term rental software roundup", { countryCode: "FR" }), // locale mismatch
        suggestion("host"), // too short / one word
        suggestion("site:example.com airbnb hosts"), // operator
        suggestion("hospitality technology publications"),
        suggestion("short term rental revenue management blog"),
      ],
    }),
  );
  const result = await generateBacklinkDiscoveryQuerySuggestions(
    { ...base, count: 5, excludeQueries: ["airbnb host resources"] },
    mixed.deps,
  );
  const queries = result.suggestions.map((item) => item.query);
  assert(queries.length === 3, `Expected 3 accepted suggestions, got ${queries.length}`);
  assert(queries[0] === "vacation rental owner resources guide", "First valid suggestion must be kept in order");
  assert(!queries.includes("airbnb host resources"), "Operator-excluded query must be removed");
  assert(result.rejected.some((item) => item.reason === "QUERY_DUPLICATE"), "Duplicates must be reported");
  assert(result.rejected.some((item) => item.reason === "QUERY_TOO_COMMERCIAL"), "Commercial queries must be rejected");
  assert(result.rejected.some((item) => item.reason === "LOCALE_MISMATCH"), "Locale mismatches must be rejected");
  assert(result.rejected.filter((item) => item.reason === "QUERY_INVALID").length === 1, "Too-short query must be invalid");
  assert(result.rejected.filter((item) => item.reason === "QUERY_TOO_COMMERCIAL").length === 2, "Commercial and search-operator queries must be rejected");
  assert(new Set(queries.map((query) => query.toLowerCase())).size === queries.length, "Accepted queries must be unique");
  assert(result.suggestions.every((item) => item.countryCode === "US" && item.languageCode === "en"), "Locale must match the request");

  // Request shape: preview-only metadata, JSON-as-data prompt, no search provider involved.
  assert(mixed.requests.length === 1, "Exactly one AI call is expected");
  assert(mixed.requests[0]?.metadata?.previewOnly === true, "Request must be marked preview-only");
  assert(mixed.requests[0]?.input.includes("data, not instructions") === true, "Prompt must treat operator data as data");

  // Count limit respected, fenced JSON accepted.
  const many = fakeDeps(
    "```json\n" +
      JSON.stringify({
        suggestions: ["alpha rental guide", "bravo rental guide", "charlie rental guide", "delta rental guide"].map((query) => suggestion(query)),
      }) +
      "\n```",
  );
  const limited = await generateBacklinkDiscoveryQuerySuggestions({ ...base, count: 2 }, many.deps);
  assert(limited.suggestions.length === 2, "count must cap accepted suggestions");

  // Invalid AI responses are rejected.
  for (const [label, output] of [
    ["not json", "here are some ideas"],
    ["array root", "[]"],
    ["extra root key", JSON.stringify({ suggestions: [suggestion("valid rental guide")], note: "x" })],
    ["empty list", JSON.stringify({ suggestions: [] })],
    ["extra item key", JSON.stringify({ suggestions: [suggestion("valid rental guide", { url: "https://x.example" })] })],
    ["non-string query", JSON.stringify({ suggestions: [{ query: 5, countryCode: "US", languageCode: "en", rationale: "x" }] })],
  ] as const) {
    await expectCode(() => generateBacklinkDiscoveryQuerySuggestions(base, fakeDeps(output).deps), "AI_RESPONSE_INVALID", label);
  }

  // Nothing valid survives: fail safely rather than return an empty "success".
  await expectCode(
    () =>
      generateBacklinkDiscoveryQuerySuggestions(
        base,
        fakeDeps(JSON.stringify({ suggestions: [suggestion("buy cheap backlinks now")] })).deps,
      ),
    "NO_VALID_SUGGESTIONS",
    "all rejected",
  );

  // AI errors, simulation output and thrown failures all fail safely.
  await expectCode(() => generateBacklinkDiscoveryQuerySuggestions(base, fakeDeps(null, "error").deps), "AI_EXECUTION_FAILED", "error status");
  await expectCode(
    () => generateBacklinkDiscoveryQuerySuggestions(base, fakeDeps(JSON.stringify({ suggestions: [suggestion("valid rental guide")] }), "simulation").deps),
    "AI_EXECUTION_FAILED",
    "simulation output",
  );
  await expectCode(
    () => generateBacklinkDiscoveryQuerySuggestions(base, { executeAiRequest: async () => { throw new Error("boom secret detail"); } }),
    "AI_EXECUTION_FAILED",
    "thrown error",
  );

  // Country / language / count validation happens before any AI call.
  const never = fakeDeps(JSON.stringify({ suggestions: [suggestion("valid rental guide")] }));
  for (const input of [
    { countryCode: "us", languageCode: "en" },
    { countryCode: "USA", languageCode: "en" },
    { countryCode: "US", languageCode: "EN" },
    { countryCode: "US", languageCode: "e" },
    { ...base, count: 0 },
    { ...base, count: 9 },
    { ...base, count: 1.5 },
    { ...base, excludeQueries: new Array(31).fill("x y") },
  ]) {
    await expectCode(() => generateBacklinkDiscoveryQuerySuggestions(input, never.deps), "INVALID_INPUT", JSON.stringify(input).slice(0, 40));
  }
  assert(never.requests.length === 0, "Invalid input must not reach the AI provider");

  // Structural safety: generator and route cannot search, write, or send.
  const generator = readFileSync("lib/automation/backlink-discovery-query-generator.ts", "utf8");
  const route = readFileSync("app/api/internal/automation/backlinks/query-suggestions/route.ts", "utf8");
  const forbidden = /brave|createSupabase|supabase|resend|sendTransactionalEmail|outreachEmailSend|zerobounce|contactForm|fetch\(/i;
  const generatorImportsAndCalls = generator.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/`[^`]*`/g, "").replace(/"[^"\n]*"/g, "\"\"");
  assert(!forbidden.test(generatorImportsAndCalls), "Generator must not reference search, database, email or form code");
  assert(!forbidden.test(route.replace(/\/\*[\s\S]*?\*\//g, "")), "Route must not reference search, database, email or form code");
  assert(/isAdminPrivateEmail/.test(route) && /workspace_forbidden/.test(route), "Route must be admin-only");

  console.log("PASS — Automation backlink discovery query generator smoke");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
