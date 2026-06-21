import { runContentPlanner } from "../lib/marketing-ai/agents/contentPlanner";
import { runSocialContent } from "../lib/marketing-ai/agents/socialContent";
import { runCreativeDirector } from "../lib/marketing-ai/agents/creativeDirector";
import { runVideoScript } from "../lib/marketing-ai/agents/videoScript";

async function main() {
  const planner = await runContentPlanner({
    marketingBrief:
      "Préparer une semaine de contenus pour promouvoir Norixo.io auprès des conciergeries et hôtes professionnels.",
    objective:
      "Faire découvrir Norixo Optimize comme outil pour identifier les points de friction et clarifier les priorités d'amélioration.",
    language: "fr",
    timeframe: "7 jours",
    channels: ["Instagram", "Facebook", "LinkedIn", "SEO"],
  });

  console.log("\\n--- CONTENT PLANNER ---");
  console.log(planner.output);

  const social = await runSocialContent({
    channel: "instagram",
    format: "carousel",
    topic: "Identifier les points de friction d'une annonce",
    goal: "awareness",
    audience: "Conciergeries et hôtes professionnels",
    cta: "Découvrir Norixo.io",
    language: "fr",
  });

  console.log("\\n--- SOCIAL CONTENT ---");
  console.log(social.output);
  if (social.error) console.log("\\nSOCIAL VALIDATION:", social.error);

  const creative = await runCreativeDirector({
    contentTitle: "Identifier les points de friction d'une annonce",
    hook: "Voir plus clairement ce qui peut freiner une annonce",
    channel: "instagram",
    format: "carousel",
    visualGoal: "Créer une direction visuelle premium pour un carrousel Instagram Norixo.io",
    language: "fr",
  });

  console.log("\\n--- CREATIVE DIRECTOR ---");
  console.log(creative.output);
  if (creative.error) console.log("\\nCREATIVE VALIDATION:", creative.error);

  const video = await runVideoScript({
    title: "Voir plus clairement ce qui peut freiner une annonce",
    hook: "Et si vous pouviez identifier vos priorités plus facilement ?",
    topic:
      "Présenter Norixo Optimize comme outil pour identifier les points de friction et clarifier les priorités",
    audience: "Conciergeries et hôtes professionnels",
    cta: "Découvrir Norixo.io",
    language: "fr",
    duration: "30 secondes",
    format: "reel",
  });

  console.log("\\n--- VIDEO SCRIPT ---");
  console.log(video.output);
  if (video.error) console.log("\\nVIDEO VALIDATION:", video.error);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
