import { readFile } from "node:fs/promises";
import path from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const originalKey = process.env.OPENAI_API_KEY;
  const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  delete process.env.OPENAI_API_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";

  try {
    const { getOpenAIClient, OpenAIConfigurationError } = await import("../lib/openai");
    assert(typeof getOpenAIClient === "function", "Expected lazy OpenAI accessor.");

    let configurationError: unknown;
    try {
      getOpenAIClient();
    } catch (error) {
      configurationError = error;
    }
    assert(
      configurationError instanceof OpenAIConfigurationError,
      "Expected missing OpenAI configuration to fail closed at invocation.",
    );

    const { OpenAiAdapter } = await import("../lib/marketing-ai/adapters/openai/openAiAdapter");
    const simulation = await new OpenAiAdapter().execute({
      agentId: "content",
      providerId: "openai",
      input: "must not call OpenAI",
      model: "gpt-4o-mini",
      capabilities: ["chat"],
    });
    assert(simulation.status === "simulation", "Expected missing-key adapter simulation.");

    await import("../app/api/audits/[id]/optimized-title/route");
    await import("../app/api/audits/[id]/airbnb-description/route");
    await import("../app/api/audits/[id]/booking-description/route");
    await import("../app/api/admin/marketing-studio/regenerate/route");

    const regenerateRoute = await readFile(
      path.join(process.cwd(), "app/api/admin/marketing-studio/regenerate/route.ts"),
      "utf8",
    );
    assert(
      !regenerateRoute.includes('import { runContentPlanner }'),
      "Regenerate must not statically import generation agents.",
    );
    assert(
      regenerateRoute.indexOf("isPaidGenerationEnabled") < regenerateRoute.indexOf('await import("@/lib/marketing-ai/agents'),
      "Regenerate must gate generation before loading agents.",
    );

    console.info("OpenAI lazy initialization smoke: PASS");
  } finally {
    if (originalKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalKey;
    }
    if (originalSupabaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
    }
    if (originalSupabaseAnonKey === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalSupabaseAnonKey;
    }
  }
}

void main();
