import { runContentPlanner } from "../lib/marketing-ai/agents/contentPlanner";

async function main() {
  const result = await runContentPlanner({
    marketingBrief:
      "Norixo.io doit gagner en visibilité auprès des conciergeries, hôtes professionnels et gestionnaires de locations courte durée. L'objectif est de faire comprendre que Norixo aide à identifier ce qui bloque une annonce et à prioriser les actions marketing qui peuvent améliorer la conversion.",
    objective:
      "Préparer une semaine de contenus pour faire connaître Norixo et générer des essais.",
    language: "fr",
    timeframe: "7 jours",
    channels: ["Instagram", "Facebook", "LinkedIn", "SEO"],
    context:
      "Norixo est un SaaS spécialisé dans l'audit et l'amélioration des annonces de location courte durée. Les contenus doivent promouvoir Norixo.io, pas les annonces des clients.",
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
