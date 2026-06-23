import { runPublisher } from "../lib/marketing-ai/agents/publisher";
import { createPublicationPack } from "../lib/marketing-ai/publication/publicationPack";

async function main() {
  const pack = createPublicationPack({
    campaignId: "campaign-publisher-smoke",
    platform: "facebook",
    format: "post",
    language: "fr",
    status: "draft",
    title: "Identifier les points de friction d'une annonce avec plus de clarté",
    hook: "Et si vous pouviez relire votre annonce avec un regard plus structuré ?",
    caption:
      "Norixo Optimize aide les hôtes et conciergeries à identifier les points de friction d'une annonce et à clarifier les priorités d'amélioration avant de passer à l'action.",
    cta: "Découvrir Norixo.io",
    hashtags: ["#Norixo", "#LocationCourteDuree", "#Conciergerie"],
    visualBrief:
      "Post Facebook Norixo au ton pédagogique, clair et produit, avec une mise en avant sobre des points de friction.",
    approvalRequired: true,
  });

  const result = await runPublisher({ pack });

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
