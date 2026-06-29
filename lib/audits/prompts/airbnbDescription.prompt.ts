export type BuildAirbnbDescriptionPromptInput = {
  currentTitle: string;
  location: string;
  description: string;
  amenities: string[];
  visualSignals: string[];
  outputLanguage: string;
};

export function buildAirbnbDescriptionPrompt(input: BuildAirbnbDescriptionPromptInput): string {
  return `
You are an expert Airbnb listing copywriter.

Generate 5 Airbnb text variants for the same listing.

LANGUAGE REQUIREMENT:
Every generated value must be written strictly in ${input.outputLanguage}.
Do not write French unless ${input.outputLanguage} is French.
Do not mix languages.

Chaque variante doit contenir ces 6 champs :
- mainAirbnb
- logement
- logementDetaille
- acces
- echanges
- autresInfos

Contraintes strictes :
- Tu écris uniquement pour Airbnb.
- N'invente aucun équipement, aucune vue, aucun quartier ou aucun avantage absent des données.
- N'utilise pas de HTML.
- N'utilise pas d'emojis.
- N'utilise pas les mots "IA", "audit", "Norixo", "optimisation".
- Style naturel, accueillant, crédible et publiable.
- Le ton doit aider à se projeter dans le séjour, sans tomber dans le cliché vide.
- Les 5 variantes doivent être réellement différentes.
- Garde cet ordre d'angles :
  1. confort et détente
  2. pratique et fluide
  3. quartier et emplacement
  4. premium et confiance
  5. court séjour / business
- mainAirbnb : un paragraphe principal concis, prêt à afficher, environ 320 à 520 caractères.
- logement : 2 à 3 petits paragraphes centrés sur le logement.
- logementDetaille : 2 à 3 petits paragraphes plus concrets sur l'agencement, le confort et les usages.
- acces : 1 à 2 petits paragraphes sur l'arrivée, l'installation et les repères pratiques.
- echanges : 1 à 2 petits paragraphes sur la communication hôte/voyageur, de façon neutre et rassurante.
- autresInfos : 1 à 2 petits paragraphes avec infos utiles, cadre, consignes ou points pratiques quand ils sont appuyés par les données.
- Si une donnée est absente, reste général sans inventer.

Données disponibles :
Titre actuel : ${input.currentTitle}
Localisation : ${input.location}
Description source : ${input.description}
Équipements détectés : ${input.amenities.join(", ")}
Signaux visuels / photos : ${input.visualSignals.join(", ")}

Retourne uniquement un JSON valide :
{
  "variants": [
    {
      "mainAirbnb": "...",
      "logement": "...",
      "logementDetaille": "...",
      "acces": "...",
      "echanges": "...",
      "autresInfos": "..."
    }
  ]
}
`.trim();
}
