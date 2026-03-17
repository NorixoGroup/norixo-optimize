export type ActionCategory =
  | "photos"
  | "description"
  | "amenities"
  | "seo"
  | "trust"
  | "pricing";

export type ActionPriority = "high" | "medium" | "low";
export type ActionImpact = "high" | "medium" | "low";

export type ActionPlanItem = {
  id: string;
  title: string;
  description: string;
  priority: ActionPriority;
  category: ActionCategory;
  impact: ActionImpact;
};

export type BuildActionPlanInput = {
  scores: {
    photos: number;
    description: number;
    amenities: number;
    seo: number;
    trust: number;
    pricing: number;
  };
  reasons?: Partial<Record<ActionCategory, string[]>>;
};

const CATEGORY_ORDER: ActionCategory[] = [
  "photos",
  "description",
  "amenities",
  "seo",
  "trust",
  "pricing",
];

function clampScore(value: unknown): number {
  const num = typeof value === "number" && Number.isFinite(value) ? value : 0;
  if (num < 0) return 0;
  if (num > 10) return 10;
  return num;
}

function getPriority(score: number): ActionPriority | null {
  if (score < 5.5) return "high";
  if (score < 7.0) return "medium";
  if (score < 8.0) return "low";
  return null; // strong areas: no action needed
}

function pickReasonSnippet(reasons?: string[]): string | null {
  if (!reasons || reasons.length === 0) return null;
  const first = reasons[0].trim();
  if (!first) return null;
  return first;
}

type CategoryTemplates = {
  category: ActionCategory;
  actions: Array<{
    key: string;
    title: string;
    baseDescription: string;
    impact: ActionImpact;
  }>;
};

const CATEGORY_TEMPLATES: CategoryTemplates[] = [
  {
    category: "photos",
    actions: [
      {
        key: "hero-quality",
        title: "Improve the first photo",
        baseDescription:
          "Update the first image to clearly showcase the main selling point (view, terrace, living space) in bright, sharp conditions.",
        impact: "high",
      },
      {
        key: "coverage",
        title: "Add better room coverage",
        baseDescription:
          "Ensure each key area (bedrooms, bathrooms, living room, outdoor spaces) has at least one clear photo.",
        impact: "medium",
      },
      {
        key: "order",
        title: "Reorder photos for impact",
        baseDescription:
          "Move the strongest photos to the first positions so guests see the most compelling parts of the property first.",
        impact: "medium",
      },
    ],
  },
  {
    category: "description",
    actions: [
      {
        key: "opening",
        title: "Strengthen the opening paragraph",
        baseDescription:
          "Rewrite the first 2–3 sentences to clearly state who the place is for, what makes it special, and why to book now.",
        impact: "high",
      },
      {
        key: "structure",
        title: "Improve description structure",
        baseDescription:
          "Use short paragraphs and clear sections (space, amenities, neighborhood, access) to make the listing easy to scan.",
        impact: "medium",
      },
      {
        key: "value-points",
        title: "Add concrete value points",
        baseDescription:
          "Highlight 3–5 specific benefits (location, comfort, features) instead of generic adjectives.",
        impact: "medium",
      },
    ],
  },
  {
    category: "amenities",
    actions: [
      {
        key: "essentials",
        title: "Add or surface essential amenities",
        baseDescription:
          "Verify that core amenities such as Wi‑Fi, kitchen, heating/AC, parking and laundry are available and clearly listed.",
        impact: "high",
      },
      {
        key: "high-value",
        title: "Highlight high-value amenities",
        baseDescription:
          "Call out amenities that differentiate the listing (workspace, terrace, pool, baby equipment) near the top of the list.",
        impact: "medium",
      },
      {
        key: "alignment",
        title: "Align amenities with guest expectations",
        baseDescription:
          "Compare your amenity list to similar listings and add the most expected items where feasible.",
        impact: "medium",
      },
    ],
  },
  {
    category: "seo",
    actions: [
      {
        key: "title-clarity",
        title: "Improve title clarity",
        baseDescription:
          "Make the title include property type, key feature and location (e.g. 'Riad with rooftop terrace in Medina').",
        impact: "high",
      },
      {
        key: "keywords",
        title: "Add descriptive keywords",
        baseDescription:
          "Include 1–2 concrete attributes guests search for (terrace, pool, city center, parking) without keyword stuffing.",
        impact: "medium",
      },
      {
        key: "specificity",
        title: "Make the headline more specific",
        baseDescription:
          "Avoid generic titles; emphasize what makes this property different from others at a similar price point.",
        impact: "medium",
      },
    ],
  },
  {
    category: "trust",
    actions: [
      {
        key: "reassurance",
        title: "Strengthen trust and reassurance",
        baseDescription:
          "Use the description to reassure guests about cleanliness, check-in, responsiveness and safety.",
        impact: "high",
      },
      {
        key: "completeness",
        title: "Improve listing completeness",
        baseDescription:
          "Ensure key details such as house rules, check-in info and bed configuration are clearly documented.",
        impact: "medium",
      },
      {
        key: "experience",
        title: "Highlight guest experience cues",
        baseDescription:
          "Surface past guest themes (quiet, central, family‑friendly, great host) prominently in the copy.",
        impact: "medium",
      },
    ],
  },
  {
    category: "pricing",
    actions: [
      {
        key: "review",
        title: "Review pricing vs local market",
        baseDescription:
          "Compare your nightly rate to similar listings and adjust if you are significantly above or below without justification.",
        impact: "high",
      },
      {
        key: "positioning",
        title: "Align pricing with value perception",
        baseDescription:
          "Ensure the photos, description and amenities justify the current price point or adjust price accordingly.",
        impact: "medium",
      },
      {
        key: "strategy",
        title: "Refine pricing strategy",
        baseDescription:
          "Consider weekday/weekend differences and seasonality instead of using a single flat nightly rate.",
        impact: "medium",
      },
    ],
  },
];

export function buildActionPlan(input: BuildActionPlanInput): ActionPlanItem[] {
  const reasonsByCategory = input.reasons ?? {};

  const scoredCategories = CATEGORY_ORDER.map((category) => {
    const rawScore = (input.scores as Record<string, unknown>)[category];
    const score = clampScore(rawScore);
    const priority = getPriority(score);

    return { category, score, priority };
  }).filter((entry) => entry.priority !== null) as Array<{
    category: ActionCategory;
    score: number;
    priority: ActionPriority;
  }>;

  // Sort weakest areas first (lowest score → highest priority in output)
  scoredCategories.sort((a, b) => a.score - b.score);

  const items: ActionPlanItem[] = [];
  const usedIds = new Set<string>();

  for (const { category, score, priority } of scoredCategories) {
    const templates = CATEGORY_TEMPLATES.find((t) => t.category === category);
    if (!templates) continue;

    const categoryReasons = reasonsByCategory[category];
    const reasonSnippet = pickReasonSnippet(categoryReasons);

    let maxItemsForCategory = 0;
    if (priority === "high") maxItemsForCategory = 3;
    else if (priority === "medium") maxItemsForCategory = 2;
    else maxItemsForCategory = 1;

    let createdForCategory = 0;

    for (const action of templates.actions) {
      if (createdForCategory >= maxItemsForCategory) break;

      const id = `${category}-${action.key}`;
      if (usedIds.has(id)) continue;

      let description = action.baseDescription;
      if (reasonSnippet) {
        description += ` Reason: ${reasonSnippet}`;
      }

      items.push({
        id,
        title: action.title,
        description,
        priority,
        category,
        impact: action.impact,
      });

      usedIds.add(id);
      createdForCategory += 1;
    }
  }

  // Keep the list reasonably short overall
  const MAX_ITEMS = 10;
  if (items.length > MAX_ITEMS) {
    return items.slice(0, MAX_ITEMS);
  }

  return items;
}
