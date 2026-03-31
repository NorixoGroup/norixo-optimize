export type PhotoSuggestions = {
  suggestedPhotoOrder: string[];
  improvementTips: string[];
  coverageWarnings: string[];
};

export type BuildPhotoSuggestionsInput = {
  photos?: string[];
  title?: string;
  description?: string;
};

function normalizeString(value: string | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function safePhotos(photos: string[] | undefined): string[] {
  if (!Array.isArray(photos)) return [];
  return photos.filter((p) => typeof p === "string" && p.trim().length > 0);
}

type TextFeatures = {
  terraceOrOutdoor: boolean;
  view: boolean;
  pool: boolean;
  workspace: boolean;
  kitchen: boolean;
  bathroom: boolean;
  bedroom: boolean;
  livingArea: boolean;
};

function analyzeTextFeatures(title: string, description: string): TextFeatures {
  const text = `${title} ${description}`.toLowerCase();

  const terraceOrOutdoor = /terrace|balcony|patio|garden|rooftop|roof terrace/.test(text);
  const view = /view|sea view|ocean view|mountain view|city view/.test(text);
  const pool = /pool|swimming pool|hot tub|jacuzzi/.test(text);
  const workspace = /desk|workspace|office|workstation|work from home/.test(text);
  const kitchen = /kitchen|cooking|cook|dining/.test(text);
  const bathroom = /bathroom|shower|bath tub|bathtub|ensuite|en-suite/.test(text);
  const bedroom = /bedroom|bed|sleep|sleeping area/.test(text);
  const livingArea = /living room|lounge|sofa|seating area|salon/.test(text);

  return {
    terraceOrOutdoor,
    view,
    pool,
    workspace,
    kitchen,
    bathroom,
    bedroom,
    livingArea,
  };
}

function buildSuggestedPhotoOrder(features: TextFeatures): string[] {
  const order: string[] = [];

  order.push("Photo principale ou image signature");

  if (features.livingArea) {
    order.push("Pièce de vie principale");
  } else {
    order.push("Pièce la plus représentative");
  }

  if (features.bedroom) {
    order.push("Chambre principale");
  } else {
    order.push("Espace nuit");
  }

  if (features.bathroom) {
    order.push("Salle de bain");
  }

  if (features.kitchen) {
    order.push("Cuisine ou espace repas");
  }

  if (features.workspace) {
    order.push("Espace de travail ou bureau");
  }

  order.push("Équipements clés et détails");

  if (features.terraceOrOutdoor || features.pool) {
    order.push("Espace extérieur, terrasse ou piscine");
  }

  if (features.view) {
    order.push("Vue ou contexte du quartier");
  }

  // Ensure a minimal, practical order even if text has almost no signals.
  if (order.length <= 3) {
    return [
      "Photo principale ou image signature",
      "Pièce de vie principale",
      "Chambre principale",
      "Salle de bain",
      "Cuisine ou espace repas",
      "Équipements clés et détails",
      "Vue ou contexte du quartier",
    ];
  }

  // De-duplicate while keeping order.
  const seen = new Set<string>();
  const result: string[] = [];
  for (const label of order) {
    if (!seen.has(label)) {
      seen.add(label);
      result.push(label);
    }
  }

  return result;
}

function buildImprovementTips(photoCount: number, features: TextFeatures): string[] {
  const tips: string[] = [];

  if (photoCount === 0) {
    tips.push(
      "Ajoutez une galerie complète avec au moins 10 à 15 photos nettes et lumineuses couvrant chaque espace principal du logement.",
    );
  } else if (photoCount < 5) {
    tips.push(
      "Augmentez le nombre de photos pour que les voyageurs voient clairement la pièce de vie, la chambre, la salle de bain et la cuisine.",
    );
  } else if (photoCount < 9) {
    tips.push(
      "Assurez-vous que les 5 premières photos montrent les espaces les plus forts du logement (photo principale, pièce de vie, chambre, salle de bain, cuisine).",
    );
  } else {
    tips.push("Passez en revue les 8 premières photos et placez les meilleures images tout en haut de la galerie.");
  }

  if (photoCount > 12) {
    tips.push("Supprimez les images trop similaires afin que chaque photo apporte une information nouvelle sur le séjour.");
  }

  tips.push("Évitez les photos sombres ou trop retouchées et privilégiez la lumière naturelle ainsi qu’un cadrage cohérent.");

  if (features.terraceOrOutdoor || features.pool) {
    tips.push("Montrez la terrasse, le balcon ou la piscine dans les 4 à 5 premières photos pour capter rapidement l’attention.");
  }

  if (features.workspace) {
    tips.push(
      "Si vous mentionnez un espace de travail, ajoutez une photo claire du bureau pour que les télétravailleurs sachent à quoi s’attendre.",
    );
  }

  if (features.kitchen) {
    tips.push(
      "Ajoutez une photo de cuisine qui montre clairement la zone de préparation, les équipements et l’espace repas dans une image bien composée.",
    );
  }

  // De-duplicate and keep list reasonably short.
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tip of tips) {
    if (!seen.has(tip)) {
      seen.add(tip);
      result.push(tip);
      if (result.length >= 8) break;
    }
  }

  return result;
}

function buildCoverageWarnings(photoCount: number, features: TextFeatures): string[] {
  const warnings: string[] = [];

  if (photoCount === 0) {
    warnings.push("Aucune photo détectée. Les voyageurs ne peuvent pas évaluer le logement sans visuels.");
    return warnings;
  }

  if (photoCount < 5) {
    warnings.push("La galerie actuelle est très limitée et peut ne pas couvrir toutes les pièces clés.");
  } else if (photoCount < 8) {
    warnings.push("La couverture photo peut sembler incomplète. Ajoutez davantage de vues des espaces principaux.");
  }

  if (features.kitchen && photoCount < 8) {
    warnings.push("L’annonce mentionne une cuisine. Assurez-vous qu’au moins une photo claire la montre.");
  }

  if ((features.terraceOrOutdoor || features.pool) && photoCount < 10) {
    warnings.push("Un espace extérieur ou une piscine est mentionné. Les voyageurs s’attendent souvent à voir une photo dédiée dès le début de la galerie.");
  }

  if (features.workspace && photoCount < 8) {
    warnings.push("Un espace de travail est mentionné. Sans photo, les télétravailleurs peuvent douter de ce qui est réellement proposé.");
  }

  // De-duplicate and keep list reasonably short.
  const seen = new Set<string>();
  const result: string[] = [];
  for (const w of warnings) {
    if (!seen.has(w)) {
      seen.add(w);
      result.push(w);
      if (result.length >= 6) break;
    }
  }

  return result;
}

export function buildPhotoSuggestions(input: BuildPhotoSuggestionsInput): PhotoSuggestions {
  const title = normalizeString(input.title);
  const description = normalizeString(input.description);
  const photos = safePhotos(input.photos);

  const features = analyzeTextFeatures(title, description);
  const photoCount = photos.length;

  const suggestedPhotoOrder = buildSuggestedPhotoOrder(features);
  const improvementTips = buildImprovementTips(photoCount, features);
  const coverageWarnings = buildCoverageWarnings(photoCount, features);

  return {
    suggestedPhotoOrder,
    improvementTips,
    coverageWarnings,
  };
}
