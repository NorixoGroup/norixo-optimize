import { runCreativeDirector } from "../lib/marketing-ai/agents/creativeDirector";

async function main() {
  const result = await runCreativeDirector({
    contentTitle: "5 erreurs qui empêchent une annonce de convertir",
    hook: "Votre annonce ne décolle pas ?",
    channel: "instagram",
    format: "carousel",
    visualGoal:
      "Créer une direction visuelle premium pour un carrousel Instagram Norixo.io",
    language: "fr",
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);
