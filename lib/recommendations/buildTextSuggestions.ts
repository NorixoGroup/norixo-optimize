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
    label: "a private outdoor space",
  },
  {
    id: "view",
    keywords: ["view", "city view", "sea view", "ocean view", "mountain view"],
    label: "great views",
  },
  {
    id: "pool",
    keywords: ["pool", "swimming pool", "hot tub", "jacuzzi"],
    label: "access to a pool or spa",
  },
  {
    id: "workspace",
    keywords: ["desk", "workspace", "office", "workstation"],
    label: "a comfortable place to work",
  },
  {
    id: "parking",
    keywords: ["parking", "garage", "car park"],
    label: "easy parking",
  },
  {
    id: "family",
    keywords: ["crib", "cot", "high chair", "family", "kids", "children"],
    label: "family-friendly touches",
  },
  {
    id: "wifi",
    keywords: ["wifi", "wi-fi", "wireless internet", "internet"],
    label: "reliable Wi‑Fi",
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
  return "apartment";
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
    return "bright";
  }
  if (amenitiesAnalysis.hasWifi && amenitiesAnalysis.hasWorkspace) {
    return "modern";
  }
  if (amenitiesAnalysis.hasFamily) {
    return "family‑friendly";
  }
  return "comfortable";
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
  const featurePhrase = feature ? ` with ${feature.label}` : "";
  const locationPhrase = city ? ` in ${city}` : "";

  const composed = `${propertyPhrase}${featurePhrase}${locationPhrase}`.trim();

  if (composed.length > 0) {
    return composed;
  }

  // Fallback if everything is missing
  if (title) return title;
  return "Comfortable stay for your guests";
}

function detectAudience(title: string, description: string, amenities: string[] | undefined, amenitiesInfo: ReturnType<typeof analyzeAmenities>): string {
  const text = toLower(`${title} ${description}`);
  const lowerAmenities = (Array.isArray(amenities) ? amenities : []).map((a) => a.toLowerCase()).join(" ");
  const combined = `${text} ${lowerAmenities}`;

  if (combined.includes("family") || combined.includes("kids") || combined.includes("children")) {
    return "families";
  }
  if (amenitiesInfo.hasWifi && amenitiesInfo.hasWorkspace) {
    return "remote workers and business travelers";
  }
  if (combined.includes("romantic") || combined.includes("couple") || combined.includes("honeymoon")) {
    return "couples";
  }

  return "travelers";
}

function buildOpeningParagraph(input: BuildTextSuggestionsInput): string {
  const title = normalizeString(input.title);
  const description = normalizeString(input.description);
  const city = normalizeString(input.city ?? undefined);
  const cityOrArea = city || "this area";

  const amenitiesInfo = analyzeAmenities(input.amenities);
  const propertyType = pickPropertyType(title, description);
  const feature = pickPrimaryFeature(title, description, input.amenities);
  const adjective = pickAdjective(feature, amenitiesInfo);
  const audience = detectAudience(title, description, input.amenities, amenitiesInfo);

  const featureSentence = feature
    ? `this ${adjective} ${propertyType} in ${cityOrArea} offers ${feature.label} and thoughtful details for a smooth stay.`
    : `this ${adjective} ${propertyType} in ${cityOrArea} offers a well‑equipped, comfortable base for your trip.`;

  let benefitsSentence = "";

  if (amenitiesInfo.hasWifi && amenitiesInfo.hasWorkspace) {
    benefitsSentence = "You'll have reliable Wi‑Fi and a practical place to work, so you can stay productive while you travel.";
  } else if (amenitiesInfo.hasFamily) {
    benefitsSentence = "Practical touches for families make it easy to settle in and focus on enjoying your time together.";
  } else if (amenitiesInfo.hasOutdoor) {
    benefitsSentence = "After days out in the city, you can unwind in your own private outdoor space.";
  } else if (amenitiesInfo.hasParking) {
    benefitsSentence = "Convenient access and parking help keep arrivals and departures stress‑free.";
  } else {
    benefitsSentence = "Everything is set up so guests can arrive, relax and start enjoying their stay right away.";
  }

  const introPrefix = `For ${audience} visiting ${cityOrArea}, `;

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
      "Add a clear, descriptive title that mentions the property type, a key feature and the location.",
    );
  }

  if (!city) {
    tips.push(
      "Mention the neighborhood or area in your title or opening line so guests immediately know where they'll be staying.",
    );
  }

  if (descriptionLength === 0) {
    tips.push(
      "Write a short opening paragraph that explains who the place is for, what makes it special and why guests will enjoy staying there.",
    );
  } else if (descriptionLength < 250) {
    tips.push(
      "Expand the description with a brief overview of the space, 3–5 concrete highlights and what guests can expect during their stay.",
    );
  } else if (descriptionLength > 1200) {
    tips.push(
      "Shorten the description by removing repetition and focusing on details that influence booking decisions (comfort, convenience, location).",
    );
  }

  if (descriptionLength > 0 && descriptionLength <= 1200) {
    tips.push(
      "Break the description into short sections (space, amenities, neighborhood, access) to make it easier to scan on mobile.",
    );
  }

  if (!amenitiesInfo.hasWifi) {
    tips.push("Clarify Wi‑Fi availability and typical speed so remote workers and planners can book with confidence.");
  }

  if (!amenitiesInfo.hasWorkspace && amenitiesInfo.hasWifi) {
    tips.push(
      "If there is a suitable place to work, mention a desk or table with power and Wi‑Fi so guests know they can be productive.",
    );
  }

  if (!amenitiesInfo.hasParking && city) {
    tips.push(
      "Explain how guests typically arrive (parking, public transport, taxi) so they can plan their trip without surprises.",
    );
  }

  if (amenitiesInfo.hasOutdoor) {
    tips.push(
      "Highlight any balcony, terrace or garden in the first lines of the description and title, as outdoor space strongly influences clicks.",
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
