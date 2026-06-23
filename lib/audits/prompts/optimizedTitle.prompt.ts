export type BuildOptimizedTitlePromptInput = {
  currentTitle: string;
  location: string;
  description: string;
  amenities: string[];
  visualSignals: string[];
  outputPlatform: "airbnb" | "booking";
};

export function buildOptimizedTitlePrompt(input: BuildOptimizedTitlePromptInput): string {
  const platformRules =
    input.outputPlatform === "airbnb"
      ? [
          "Style Airbnb prioritaire : désirable, spécifique, fluide, sans jargon.",
          "Vise des titres courts à moyens, naturels, qui donnent envie de cliquer.",
          "Peut mettre en avant l'ambiance, le style de lieu, l'emplacement ou un bénéfice clair.",
        ]
      : [
          "Style Booking/Expedia/Agoda/Vrbo/Abritel prioritaire : clair, factuel, rassurant, orienté conversion.",
          "Vise des titres précis, immédiatement compréhensibles, avec des atouts vérifiables.",
          "Peut mettre en avant l'emplacement, le confort, les équipements ou la praticité du séjour.",
        ];

  return `
Tu es copywriter expert des annonces de location saisonnière.

Génère 5 variantes de titres optimisés en français pour une annonce ${input.outputPlatform === "airbnb" ? "Airbnb" : "Booking / OTA"}.

Contraintes strictes :
- Retourne 5 titres vraiment différents, pas 5 reformulations quasi identiques.
- Le titre actuel sert de contexte, mais tu ne dois pas simplement le paraphraser.
- N'invente aucun équipement, aucune vue, aucun quartier ou aucun avantage absent des données.
- N'utilise pas de HTML.
- N'utilise pas d'emojis.
- N'utilise pas de guillemets marketing inutiles.
- N'écris pas "IA", "audit", "Norixo", "optimisé" ou "titre optimisé".
- N'utilise pas tout en majuscules.
- Chaque titre doit rester naturel, crédible et professionnel.
- Évite les titres génériques qui pourraient convenir à n'importe quelle annonce.
- Mets en avant 1 à 2 atouts maximum par variante.
- Privilégie des formulations adaptées à la plateforme cible.
- Si une donnée semble floue, sale ou douteuse, ignore-la.

Règles plateforme :
${platformRules.map((rule) => `- ${rule}`).join("\n")}

Angles à varier si possible :
- confort
- emplacement
- praticité
- extérieur / vue / lumière
- style / ambiance

Données disponibles :
Titre actuel : ${input.currentTitle}
Localisation : ${input.location}
Description source : ${input.description}
Équipements détectés : ${input.amenities.join(", ")}
Signaux visuels / photos : ${input.visualSignals.join(", ")}

Retourne uniquement un JSON valide :
{
  "variants": [
    "Titre 1",
    "Titre 2",
    "Titre 3",
    "Titre 4",
    "Titre 5"
  ]
}
`.trim();
}
