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

  order.push("Hero exterior or signature image");

  if (features.livingArea) {
    order.push("Main living area");
  } else {
    order.push("Most representative room");
  }

  if (features.bedroom) {
    order.push("Primary bedroom");
  } else {
    order.push("Sleeping area");
  }

  if (features.bathroom) {
    order.push("Bathroom");
  }

  if (features.kitchen) {
    order.push("Kitchen or dining area");
  }

  if (features.workspace) {
    order.push("Workspace or desk setup");
  }

  order.push("Key amenities and details");

  if (features.terraceOrOutdoor || features.pool) {
    order.push("Outdoor space, terrace or pool");
  }

  if (features.view) {
    order.push("View or neighborhood context");
  }

  // Ensure a minimal, practical order even if text has almost no signals.
  if (order.length <= 3) {
    return [
      "Hero exterior or signature image",
      "Main living area",
      "Primary bedroom",
      "Bathroom",
      "Kitchen or dining area",
      "Key amenities and details",
      "View or neighborhood context",
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
      "Add a complete photo set with at least 10–15 bright, sharp images that cover each main area of the property.",
    );
  } else if (photoCount < 5) {
    tips.push(
      "Increase the number of photos so guests can clearly see the living area, bedroom, bathroom and kitchen.",
    );
  } else if (photoCount < 9) {
    tips.push(
      "Ensure the first 5 photos show the strongest spaces (hero, living area, bedroom, bathroom, kitchen).",
    );
  } else {
    tips.push("Review the first 8 photos and move your best images to the very top of the gallery.");
  }

  if (photoCount > 12) {
    tips.push("Remove near-duplicate images so each photo adds new information about the stay.");
  }

  tips.push("Avoid dark or heavily edited photos; aim for natural light and consistent framing.");

  if (features.terraceOrOutdoor || features.pool) {
    tips.push("Show the terrace, balcony or pool within the first 4–5 photos to capture attention quickly.");
  }

  if (features.workspace) {
    tips.push(
      "If you mention a workspace, include a clear photo of the desk or work area so remote workers know what to expect.",
    );
  }

  if (features.kitchen) {
    tips.push(
      "Include a kitchen shot that shows the cooking area, appliances and dining space in a single, well-composed image.",
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
    warnings.push("No photos detected. Guests cannot evaluate the space without visuals.");
    return warnings;
  }

  if (photoCount < 5) {
    warnings.push("The current photo set is very limited and may not cover all key rooms.");
  } else if (photoCount < 8) {
    warnings.push("Photo coverage may feel incomplete; consider adding more views of core spaces.");
  }

  if (features.kitchen && photoCount < 8) {
    warnings.push("The listing mentions a kitchen; ensure there is at least one clear photo of it.");
  }

  if ((features.terraceOrOutdoor || features.pool) && photoCount < 10) {
    warnings.push("Outdoor space or pool is mentioned; guests may expect a dedicated photo early in the gallery.");
  }

  if (features.workspace && photoCount < 8) {
    warnings.push("A workspace is mentioned; without a photo, remote workers may be unsure what is provided.");
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
