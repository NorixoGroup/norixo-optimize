import { runCommunityDiscovery } from "../lib/marketing-ai/agents/communityDiscovery";

async function main() {
  const result = await runCommunityDiscovery({
    country: "Japon",
    language: "fr",
    audience: "hôtes Airbnb, conciergeries et gestionnaires de location courte durée",
    platforms: ["facebook", "reddit", "x", "line"],
    communityTypes: ["airbnb_hosts", "short_term_rental", "expats"],
    notes:
      "Préparer des recommandations à vérifier manuellement. Aucune publication automatique.",
  });

  console.log(
    JSON.stringify(
      {
        providerId: result.providerId,
        model: result.model,
        status: result.status,
        output: result.output,
        error: result.error,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
