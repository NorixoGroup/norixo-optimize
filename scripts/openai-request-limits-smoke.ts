import type { MarketingAiExecutionRequest } from "../lib/marketing-ai/adapters/base/adapterTypes";
import { BACKLINK_DISCOVERY_AI_LIMITS } from "../lib/automation/backlink-discovery-query-generator";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

type Call = { body: Record<string, unknown>; signal: AbortSignal | null };

const completion = JSON.stringify({
  id: "x",
  object: "chat.completion",
  created: 0,
  model: "gpt-4o-mini",
  choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: "ok" } }],
});

async function main() {
  process.env.OPENAI_API_KEY = "test-key-not-real";
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";

  const calls: Call[] = [];
  let mode: "ok" | "fail500" | "hang" = "ok";
  // No network: every request is answered by this stub.
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    calls.push({ body: JSON.parse(String(init?.body ?? "{}")), signal: init?.signal ?? null });
    if (mode === "ok") return new Response(completion, { status: 200, headers: { "content-type": "application/json" } });
    if (mode === "fail500") return new Response("{}", { status: 500, headers: { "x-should-retry": "true" } });
    return new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    });
  }) as typeof fetch;

  const { OpenAiAdapter } = await import("../lib/marketing-ai/adapters/openai/openAiAdapter");
  const adapter = new OpenAiAdapter();
  const base: MarketingAiExecutionRequest = {
    agentId: "content",
    providerId: "openai",
    input: "hello",
    model: "gpt-4o-mini",
    capabilities: ["chat"],
  };

  assert(
    BACKLINK_DISCOVERY_AI_LIMITS.timeoutMs === 30_000 &&
      BACKLINK_DISCOVERY_AI_LIMITS.maxRetries === 1 &&
      BACKLINK_DISCOVERY_AI_LIMITS.maxOutputTokens === 600,
    "Discovery limits must be 30000 ms, 1 retry, 600 tokens",
  );

  // 1. No limits: request body is unchanged (no token cap), default retries (2) still apply.
  mode = "ok";
  let result = await adapter.execute({ ...base });
  assert(result.status === "success", "default call must succeed");
  assert(!("max_completion_tokens" in calls[0]!.body) && !("max_tokens" in calls[0]!.body), "no token cap without limits");

  // 2. Limits: token cap is sent.
  calls.length = 0;
  result = await adapter.execute({ ...base, limits: BACKLINK_DISCOVERY_AI_LIMITS });
  assert(result.status === "success", "limited call must succeed");
  assert(calls[0]!.body.max_completion_tokens === 600, "max_completion_tokens must be 600");
  assert(!("max_tokens" in calls[0]!.body), "deprecated max_tokens must not be sent");
  assert(calls[0]!.body.temperature === 0.2, "temperature unchanged");

  // 3. Retries: 1 retry = 2 attempts with limits, 3 attempts (SDK default) without.
  mode = "fail500";
  calls.length = 0;
  result = await adapter.execute({ ...base, limits: { maxRetries: 1 } });
  assert(result.status === "error" && calls.length === 2, `maxRetries 1 must give 2 attempts, got ${calls.length}`);
  calls.length = 0;
  result = await adapter.execute({ ...base });
  assert(result.status === "error" && calls.length === 3, `default must keep 2 retries (3 attempts), got ${calls.length}`);

  // 4. Timeout is applied per attempt.
  mode = "hang";
  calls.length = 0;
  const started = Date.now();
  result = await adapter.execute({ ...base, limits: { timeoutMs: 50, maxRetries: 0 } });
  assert(result.status === "error" && calls.length === 1, "a timed-out attempt must end as error without retry");
  assert(Date.now() - started < 5_000, "timeout must fire quickly");

  console.log("openai request limits smoke: PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
