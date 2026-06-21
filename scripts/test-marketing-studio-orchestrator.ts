import { runMarketingStudioPipeline } from "../lib/marketing-ai/marketingStudioPipeline";

async function main() {
  const result = await runMarketingStudioPipeline({
    objective:
      "Faire découvrir Norixo Optimize comme outil pour identifier les points de friction et clarifier les priorités d'amélioration.",
    language: "fr",
    timeframe: "7 jours",
    channels: ["Instagram", "Facebook", "LinkedIn", "SEO"],
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
