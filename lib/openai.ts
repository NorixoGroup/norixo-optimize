import OpenAI from "openai";

export class OpenAIConfigurationError extends Error {
  constructor() {
    super("OpenAI is not configured.");
    this.name = "OpenAIConfigurationError";
  }
}

let client: OpenAI | null = null;

/** Importing this module must remain safe when OpenAI is disabled. */
export function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new OpenAIConfigurationError();
  }

  client ??= new OpenAI({ apiKey });
  return client;
}
