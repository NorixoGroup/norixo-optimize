export type TextSuggestions = {
  suggestedTitle: string;
  suggestedOpeningParagraph: string;
  improvementTips: string[];
};

export type BuildTextSuggestionsInput = {
  title?: string;
  description?: string;
  amenities?: string[];
  city?: string | null;
};

type FeatureTag = {
  id: string;
  keywords: string[];
  label: string;
};

const FEATURE_TAGS: FeatureTag[] = [
  {
    id: "terrace",
    keywords: ["terrace", "rooftop", "roof terrace", "patio", "balcony", "garden"],
    label: "un espace extérieur privatif",
  },
  {
    id: "view",
    keywords: ["view", "city view", "sea view", "ocean view", "mountain view"],
    label: "une belle vue",
  },
  {
    id: "pool",
    keywords: ["pool", "swimming pool", "hot tub", "jacuzzi"],
    label: "un accès à une piscine ou à un spa",
  },
  {
    id: "workspace",
    keywords: ["desk", "workspace", "office", "workstation"],
    label: "un espace de travail confortable",
  },
  {
    id: "parking",
    keywords: ["parking", "garage", "car park"],
    label: "un stationnement pratique",
  },
  {
    id: "family",
    keywords: ["crib", "cot", "high chair", "family", "kids", "children"],
    label: "des équipements adaptés aux familles",
  },
  {
    id: "wifi",
    keywords: ["wifi", "wi-fi", "wireless internet", "internet"],
    label: "un Wi‑Fi fiable",
  },
];

const PROPERTY_KEYWORDS = [
  "apartment",
  "studio",
  "loft",
  "villa",
  "house",
  "cottage",
  "riad",
  "suite",
  "room",
  "flat",
];

function normalizeString(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function toLower(value: string): string {
  return value.toLowerCase();
}

function pickPropertyType(title: string, description: string): string {
  const source = toLower(`${title} ${description}`);
  for (const keyword of PROPERTY_KEYWORDS) {
    if (source.includes(keyword)) {
      return keyword;
    }
  }
  return "appartement";
}

function analyzeAmenities(amenities: string[] | undefined) {
  const list = Array.isArray(amenities) ? amenities : [];
  const lower = list.map((a) => a.toLowerCase());

  const hasWifi = lower.some((a) => a.includes("wifi") || a.includes("wi-fi") || a.includes("wireless"));
  const hasWorkspace = lower.some((a) => a.includes("desk") || a.includes("workspace") || a.includes("office"));
  const hasParking = lower.some((a) => a.includes("parking") || a.includes("garage") || a.includes("car park"));
  const hasOutdoor = lower.some(
    (a) =>
      a.includes("balcony") ||
      a.includes("terrace") ||
      a.includes("patio") ||
      a.includes("garden") ||
      a.includes("rooftop"),
  );
  const hasFamily = lower.some(
    (a) => a.includes("family") || a.includes("crib") || a.includes("cot") || a.includes("high chair") || a.includes("kids"),
  );

  return {
    hasWifi,
    hasWorkspace,
    hasParking,
    hasOutdoor,
    hasFamily,
  };
}

function pickPrimaryFeature(title: string, description: string, amenities: string[] | undefined): FeatureTag | null {
  const haystack = toLower(`${title} ${description}`);
  const amenitiesLower = (Array.isArray(amenities) ? amenities : []).map((a) => a.toLowerCase());

  for (const tag of FEATURE_TAGS) {
    const match = tag.keywords.some((kw) => haystack.includes(kw) || amenitiesLower.some((a) => a.includes(kw)));
    if (match) return tag;
  }

  return null;
}

function pickAdjective(feature: FeatureTag | null, amenitiesAnalysis: ReturnType<typeof analyzeAmenities>): string {
  if (feature && (feature.id === "terrace" || feature.id === "view")) {
    return "lumineux";
  }
  if (amenitiesAnalysis.hasWifi && amenitiesAnalysis.hasWorkspace) {
    return "moderne";
  }
  if (amenitiesAnalysis.hasFamily) {
    return "adapté aux familles";
  }
  return "confortable";
}

function capitalize(word: string): string {
  if (!word) return "";
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function buildSuggestedTitle(input: BuildTextSuggestionsInput): string {
  const title = normalizeString(input.title);
  const description = normalizeString(input.description);
  const city = normalizeString(input.city ?? undefined);

  const amenitiesInfo = analyzeAmenities(input.amenities);
  const propertyType = pickPropertyType(title, description);
  const feature = pickPrimaryFeature(title, description, input.amenities);
  const adjective = pickAdjective(feature, amenitiesInfo);

  const propertyPhrase = `${capitalize(adjective)} ${propertyType}`;
  const featurePhrase = feature ? ` avec ${feature.label}` : "";
  const locationPhrase = city ? ` à ${city}` : "";

  const composed = `${propertyPhrase}${featurePhrase}${locationPhrase}`.trim();

  if (composed.length > 0) {
    return composed;
  }

  // Fallback if everything is missing
  if (title) return title;
  return "Séjour confortable pour vos voyageurs";
}

function detectAudience(title: string, description: string, amenities: string[] | undefined, amenitiesInfo: ReturnType<typeof analyzeAmenities>): string {
  const text = toLower(`${title} ${description}`);
  const lowerAmenities = (Array.isArray(amenities) ? amenities : []).map((a) => a.toLowerCase()).join(" ");
  const combined = `${text} ${lowerAmenities}`;

  if (combined.includes("family") || combined.includes("kids") || combined.includes("children")) {
    return "les familles";
  }
  if (amenitiesInfo.hasWifi && amenitiesInfo.hasWorkspace) {
    return "les télétravailleurs et voyageurs d’affaires";
  }
  if (combined.includes("romantic") || combined.includes("couple") || combined.includes("honeymoon")) {
    return "les couples";
  }

  return "les voyageurs";
}

function buildOpeningParagraph(input: BuildTextSuggestionsInput): string {
  const title = normalizeString(input.title);
  const description = normalizeString(input.description);
  const city = normalizeString(input.city ?? undefined);
  const cityOrArea = city || "ce secteur";

  const amenitiesInfo = analyzeAmenities(input.amenities);
  const propertyType = pickPropertyType(title, description);
  const feature = pickPrimaryFeature(title, description, input.amenities);
  const adjective = pickAdjective(feature, amenitiesInfo);
  const audience = detectAudience(title, description, input.amenities, amenitiesInfo);

  const featureSentence = feature
    ? `ce ${propertyType} ${adjective} à ${cityOrArea} propose ${feature.label} ainsi que des détails pensés pour rendre le séjour fluide et agréable.`
    : `ce ${propertyType} ${adjective} à ${cityOrArea} offre une base confortable et bien équipée pour votre séjour.`;

  let benefitsSentence = "";

  if (amenitiesInfo.hasWifi && amenitiesInfo.hasWorkspace) {
    benefitsSentence = "Vous profitez d’un Wi‑Fi fiable et d’un espace de travail pratique pour rester productif pendant votre séjour.";
  } else if (amenitiesInfo.hasFamily) {
    benefitsSentence = "Des équipements pensés pour les familles facilitent l’installation et rendent le séjour plus serein.";
  } else if (amenitiesInfo.hasOutdoor) {
    benefitsSentence = "Après une journée à l’extérieur, vous pouvez vous détendre dans votre espace extérieur privatif.";
  } else if (amenitiesInfo.hasParking) {
    benefitsSentence = "Un accès simple et un stationnement pratique rendent les arrivées et départs plus sereins.";
  } else {
    benefitsSentence = "Tout est pensé pour que les voyageurs puissent arriver, se détendre et profiter du séjour immédiatement.";
  }

  const introPrefix = `Pour ${audience} à ${cityOrArea}, `;

  return `${introPrefix}${featureSentence} ${benefitsSentence}`.trim();
}

function buildImprovementTips(input: BuildTextSuggestionsInput): string[] {
  const title = normalizeString(input.title);
  const description = normalizeString(input.description);
  const city = normalizeString(input.city ?? undefined);
  const amenitiesInfo = analyzeAmenities(input.amenities);

  const tips: string[] = [];

  const descriptionLength = description.length;

  if (!title || title.length < 20) {
    tips.push(
      "Ajoutez un titre clair et descriptif qui mentionne le type de bien, un atout clé et la localisation.",
    );
  }

  if (!city) {
    tips.push(
      "Mentionnez le quartier ou la zone dans le titre ou dès l’ouverture afin que les voyageurs comprennent immédiatement où se situe le logement.",
    );
  }

  if (descriptionLength === 0) {
    tips.push(
      "Rédigez un court paragraphe d’ouverture qui explique à qui s’adresse le logement, ce qui le rend attractif et pourquoi les voyageurs vont l’apprécier.",
    );
  } else if (descriptionLength < 250) {
    tips.push(
      "Étoffez la description avec une brève présentation du logement, 3 à 5 points forts concrets et ce que les voyageurs peuvent attendre du séjour.",
    );
  } else if (descriptionLength > 1200) {
    tips.push(
      "Raccourcissez la description en supprimant les répétitions et en gardant les éléments qui influencent la réservation (confort, praticité, localisation).",
    );
  }

  if (descriptionLength > 0 && descriptionLength <= 1200) {
    tips.push(
      "Découpez la description en sections courtes (logement, équipements, quartier, accès) pour la rendre plus lisible sur mobile.",
    );
  }

  if (!amenitiesInfo.hasWifi) {
    tips.push("Précisez la disponibilité du Wi‑Fi et son niveau de qualité afin de rassurer les télétravailleurs et les voyageurs qui préparent leur séjour.");
  }

  if (!amenitiesInfo.hasWorkspace && amenitiesInfo.hasWifi) {
    tips.push(
      "S’il existe un espace adapté au travail, mentionnez un bureau ou une table avec prises et Wi‑Fi pour montrer que le logement convient aussi au télétravail.",
    );
  }

  if (!amenitiesInfo.hasParking && city) {
    tips.push(
      "Expliquez comment les voyageurs arrivent le plus souvent (stationnement, transports, taxi) afin qu’ils puissent organiser leur venue sans surprise.",
    );
  }

  if (amenitiesInfo.hasOutdoor) {
    tips.push(
      "Mettez en avant tout balcon, terrasse ou jardin dès les premières lignes de la description et dans le titre, car les espaces extérieurs influencent fortement les clics.",
    );
  }

  // De‑duplicate while keeping order and keep the list reasonably short.
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

export function buildTextSuggestions(input: BuildTextSuggestionsInput): TextSuggestions {
  const safeInput: BuildTextSuggestionsInput = {
    title: normalizeString(input.title),
    description: normalizeString(input.description),
    amenities: Array.isArray(input.amenities) ? input.amenities : [],
    city: input.city ?? null,
  };

  const suggestedTitle = buildSuggestedTitle(safeInput);
  const suggestedOpeningParagraph = buildOpeningParagraph(safeInput);
  const improvementTips = buildImprovementTips(safeInput);

  return {
    suggestedTitle,
    suggestedOpeningParagraph,
    improvementTips,
  };
}
