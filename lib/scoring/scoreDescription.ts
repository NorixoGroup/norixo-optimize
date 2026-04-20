import type { NormalizedListing } from "../listings/normalizeListing";

export type ScoreResult = {
  score: number; // 0 to 10
  reasons: string[];
};

/** Distinct editorial “pillars” detectable from plain text (EN/FR + simple shared roots). Not a judgment of truth or style. */
const CONTENT_SIGNALS: ReadonlyArray<{ id: string; label: string; pattern: RegExp }> = [
  {
    id: "guest_fit",
    label: "guest fit & use cases",
    pattern:
      /\b(ideal\s+for|perfect\s+for|great\s+for|idéal\s+pour|parfait\s+pour|adapté(?:e)?s?\s+pour|pour\s+les\s+(?:familles|couples|voyageurs)|business\s+travel|télétravail|remote\s+work|families|couples)\b/i,
  },
  {
    id: "proximity",
    label: "location & proximity",
    pattern:
      /\b(walking\s+distance|minutes\s+from|close\s+to|near(?:by)?|downtown|city\s+center|centre[\s-]?ville|proche(?:\s+de)?|à\s+quelques\s+minutes|à\s+pied|quartier|arrondissement|station|metro|métro|gare|airport|aéroport|plage|beach)\b/i,
  },
  {
    id: "connectivity",
    label: "connectivity",
    pattern: /\b(wi[\s-]?fi|wifi|internet|fibre|fiber|high[\s-]?speed|(?:très\s+)?haut\s+débit)\b/i,
  },
  {
    id: "outdoor_space",
    label: "outdoor & views",
    pattern:
      /\b(terrasse|terrace|balcon(?:y)?|patio|deck|jardin|garden|courtyard|rooftop|vue|view|panoram|piscine|pool)\b/i,
  },
  {
    id: "parking",
    label: "parking",
    pattern: /\b(parking|garage|stationnement|place\s+de\s+parking)\b/i,
  },
  {
    id: "atmosphere",
    label: "atmosphere",
    pattern: /\b(calme|quiet|peaceful|serein|zen|cosy|cozy|charm(?:e|ant)?|unique|authentique|typique)\b/i,
  },
  {
    id: "practical_stay",
    label: "practical stay details",
    pattern:
      /\b(check[\s-]?in|check[\s-]?out|arriv(?:ée|al)|départ|accès|keys?|clés?|digicode|code|baggage|luggage|self[\s-]?check)\b/i,
  },
  {
    id: "comfort_equipment",
    label: "comfort & equipment",
    pattern:
      /\b(clim(?:atisation)?|air\s+conditioning|a\/c|chauffage|heating|machine\s+à\s+laver|washing|lave[\s-]?linge|dishwasher|lave[\s-]?vaisselle|cuisine\s+équipée|equipped\s+kitchen)\b/i,
  },
  {
    id: "differentiation",
    label: "differentiation",
    pattern:
      /\b(rénové|renovated|newly|neuf|lumineux|spacious|spacieux|luxury|luxe|premium|design|architect)\b/i,
  },
];

function tokenizeWords(text: string): string[] {
  return text
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter((w) => w.length > 0);
}

function splitSentences(text: string): string[] {
  const parts = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  return parts.length > 0 ? parts : [text];
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function countListLines(text: string): number {
  return text.split("\n").filter((line) => /^\s*(?:[-*•]|\d+[\.)])\s+/.test(line)).length;
}

function collectSignals(text: string): { ids: Set<string>; labels: string[] } {
  const ids = new Set<string>();
  const labels: string[] = [];
  for (const { id, label, pattern } of CONTENT_SIGNALS) {
    if (pattern.test(text)) {
      if (!ids.has(id)) {
        ids.add(id);
        labels.push(label);
      }
    }
  }
  return { ids, labels };
}

function volumePoints(wordCount: number): number {
  if (wordCount < 28) return 1.4;
  if (wordCount < 55) return 2.5;
  if (wordCount < 105) return 3.2;
  return 3.5;
}

function signalPoints(signalCount: number, wordCount: number): number {
  let p = Math.min(4, signalCount * 0.72);
  if (wordCount < 38 && signalCount >= 3) {
    p = Math.min(p, 2.6);
  }
  return p;
}

function structurePoints(
  wordCount: number,
  paragraphCount: number,
  lineCount: number,
  listLineCount: number,
  avgWordsPerSentence: number
): { pts: number; wallOfText: boolean; sparseStructure: boolean } {
  let pts = 0.65;
  let wallOfText = false;
  let sparseStructure = false;

  if (paragraphCount >= 2) pts += 0.95;
  else if (lineCount >= 5) pts += 0.45;

  if (listLineCount >= 1) pts += 0.45;

  if (avgWordsPerSentence >= 9 && avgWordsPerSentence <= 30 && wordCount > 35) {
    pts += 0.55;
  }

  if (wordCount > 150 && paragraphCount < 2 && avgWordsPerSentence > 30) {
    wallOfText = true;
    pts -= 0.9;
  } else if (wordCount > 110 && paragraphCount === 1 && listLineCount === 0 && lineCount < 4) {
    sparseStructure = true;
    pts -= 0.35;
  }

  return {
    pts: Math.max(0, Math.min(2.5, pts)),
    wallOfText,
    sparseStructure,
  };
}

export function scoreDescription(listing: NormalizedListing): ScoreResult {
  const raw = listing.description ?? "";
  const description = raw.trim();

  if (!description) {
    return {
      score: 1,
      reasons: ["Aucune description n’a été trouvée : sans texte clair, le voyageur se projette difficilement."],
    };
  }

  const words = tokenizeWords(description);
  const wordCount = words.length;
  const sentences = splitSentences(description);
  const sentenceCount = Math.max(1, sentences.length);
  const avgWordsPerSentence = wordCount / sentenceCount;
  const paragraphs = splitParagraphs(description);
  const paragraphCount = Math.max(1, paragraphs.length);
  const lineCount = description.split("\n").length;
  const listLineCount = countListLines(description);

  const { ids: signalIds, labels: signalLabels } = collectSignals(description);
  const signalCount = signalIds.size;

  const vPts = volumePoints(wordCount);
  const sPts = signalPoints(signalCount, wordCount);
  const { pts: structPts, wallOfText, sparseStructure } = structurePoints(
    wordCount,
    paragraphCount,
    lineCount,
    listLineCount,
    avgWordsPerSentence
  );

  let score = vPts + sPts + structPts;
  score = Math.max(0, Math.min(10, Number(score.toFixed(1))));

  const reasons: string[] = [];

  if (wordCount < 35) {
    reasons.push(
      "La description est trop courte pour aider le voyageur à se projeter clairement dans le séjour."
    );
  } else if (wordCount < 70) {
    reasons.push(
      "La description est présente mais encore légère ; ajoutez des éléments concrets pour mieux convaincre."
    );
  } else if (wordCount < 130) {
    reasons.push("La longueur de la description est adaptée pour expliquer clairement le logement.");
  } else {
    reasons.push(
      "La description est détaillée ; veillez à garder les informations clés faciles à repérer."
    );
  }

  if (paragraphCount >= 2) {
    reasons.push("Plusieurs paragraphes rendent la lecture plus fluide et facilitent la décision du voyageur.");
  } else if (listLineCount > 0) {
    reasons.push("La présence de listes améliore la lisibilité des informations pratiques et des équipements.");
  } else if (sparseStructure) {
    reasons.push(
      "Le texte est assez long mais peu structuré ; des paragraphes courts amélioreraient la clarté."
    );
  }

  if (wallOfText) {
    reasons.push(
      "Des phrases trop longues alourdissent la lecture ; des formulations plus courtes clarifieraient le message."
    );
  }

  if (signalCount === 0) {
    reasons.push(
      "La description manque d’éléments concrets utiles au voyageur, ce qui la rend peu différenciante."
    );
  } else if (signalCount <= 2) {
    reasons.push(
      `Quelques points utiles apparaissent (${signalLabels.slice(0, 3).join(", ")}), mais davantage de concret renforcerait la conversion.`
    );
  } else {
    reasons.push(
      `Plusieurs informations utiles sont visibles (${signalLabels.slice(0, 5).join(", ")}${signalLabels.length > 5 ? ", …" : ""}), ce qui renforce la crédibilité.`
    );
  }

  reasons.push(
    `La description contient environ ${wordCount} mots, avec ${avgWordsPerSentence.toFixed(0)} mots par phrase et ${paragraphCount} bloc${paragraphCount === 1 ? "" : "s"} de texte.`
  );

  return {
    score,
    reasons,
  };
}
