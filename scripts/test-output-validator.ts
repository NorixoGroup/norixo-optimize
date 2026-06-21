import { validateMarketingOutput } from "../lib/marketing-ai/outputValidator";

const sample = `\`\`\`json
{
  "topic": "Témoignage utilisateur",
  "caption": "Boostez vos performances et obtenez plus de réservations avec Norixo.",
  "recommendedPublishTime": "2023-10-15T10:00:00Z",
  "hashtags": ["#Airbnb", "#Norixo"]
}
\`\`\``;

console.log(JSON.stringify(validateMarketingOutput(sample), null, 2));
