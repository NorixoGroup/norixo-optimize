import { getOpenAIClient } from "../../../openai";
import type {
  MarketingAiExecutionRequest,
  MarketingAiExecutionResult,
  MarketingAiProviderHealth,
} from "../base/adapterTypes";
import type { MarketingAiProviderAdapter } from "../base/providerAdapter";

const DEFAULT_OPENAI_MARKETING_AI_MODEL =
  process.env.OPENAI_MARKETING_AI_MODEL ?? "gpt-4o-mini";

function hasOpenAiApiKey() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export class OpenAiAdapter implements MarketingAiProviderAdapter {
  readonly providerId = "openai";

  async connect(): Promise<void> {}

  async disconnect(): Promise<void> {}

  async health(): Promise<MarketingAiProviderHealth> {
    const hasKey = hasOpenAiApiKey();

    return {
      providerId: this.providerId,
      status: hasKey ? "connected" : "simulation",
      isAvailable: hasKey,
      message: hasKey
        ? "OpenAI API key detected. Real execution remains disabled in Phase 1."
        : "OpenAI API key missing. Falling back to simulation.",
    };
  }

  async execute(
    request: MarketingAiExecutionRequest,
  ): Promise<MarketingAiExecutionResult> {
    const startedAt = Date.now();

    if (!hasOpenAiApiKey()) {
      return {
        providerId: request.providerId,
        model: request.model,
        status: "simulation",
        output: null,
        error: null,
        costEur: 0,
        durationMs: Date.now() - startedAt,
      };
    }

    const model = request.model ?? DEFAULT_OPENAI_MARKETING_AI_MODEL;
    const input = request.input.trim();

    if (!input) {
      return {
        providerId: request.providerId,
        model,
        status: "error",
        output: null,
        error: "OpenAI execution input is empty",
        costEur: 0,
        durationMs: Date.now() - startedAt,
      };
    }

    try {
      const completion = await getOpenAIClient().chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are Norixo Marketing AI. Return concise, safe, production-ready marketing assistance.",
          },
          {
            role: "user",
            content: input,
          },
        ],
        temperature: 0.2,
      });

      return {
        providerId: request.providerId,
        model,
        status: "success",
        output: completion.choices[0]?.message?.content ?? null,
        error: null,
        costEur: 0,
        durationMs: Date.now() - startedAt,
      };
    } catch (error) {
      return {
        providerId: request.providerId,
        model,
        status: "error",
        output: null,
        error: error instanceof Error ? error.message : "Unknown OpenAI error",
        costEur: 0,
        durationMs: Date.now() - startedAt,
      };
    }
  }
}
