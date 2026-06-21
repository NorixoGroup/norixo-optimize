import { executeMarketingAiRequest } from "../lib/marketing-ai/execution/executionEngine";

async function main() {
  const result = await executeMarketingAiRequest({
    agentId: "marketing-brain",
    providerId: "openai",
    model: null,
    input: "Reply with exactly one word: READY",
    capabilities: ["chat"],
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
