import { runMarketingBrain } from "../lib/marketing-ai/agents/marketingBrain";

async function main() {
  const result = await runMarketingBrain({
    objective:
      "Lancer Norixo Optimize auprès des conciergeries et gestionnaires de locations courte durée.",
    audience:
      "Conciergeries, property managers, hôtes professionnels et agences de gestion locative",
    language: "fr",
    market: "France",
    channels: [
      "Instagram",
      "Facebook",
      "LinkedIn",
      "SEO",
      "Newsletter",
      "YouTube",
    ],
    timeframe: "7 jours",
    context:
      "Préparer une stratégie marketing SaaS complète pour augmenter la notoriété de Norixo, générer des essais gratuits et développer les conversions.",
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
