import { runSocialContent } from "../lib/marketing-ai/agents/socialContent";

async function main() {
  const result = await runSocialContent({
    channel: "instagram",
    format: "carousel",
    topic: "5 erreurs qui empêchent une annonce Airbnb de convertir",
    goal: "awareness",
    audience: "Conciergeries et hôtes professionnels",
    cta: "Tester gratuitement Norixo.io",
    language: "fr"
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);
