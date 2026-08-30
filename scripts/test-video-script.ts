import { runVideoScript } from "../lib/marketing-ai/agents/videoScript";

async function main() {
  const result = await runVideoScript({
    title: "Comprendre ce qui peut freiner une annonce",
    hook: "Et si vous pouviez voir plus clairement ce qui bloque une annonce ?",
    topic: "Présenter Norixo comme outil pour identifier les points de friction et prioriser les améliorations",
    audience: "Conciergeries et hôtes professionnels",
    cta: "Tester Norixo.io",
    language: "fr",
    duration: "30 secondes",
    format: "reel",
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);
