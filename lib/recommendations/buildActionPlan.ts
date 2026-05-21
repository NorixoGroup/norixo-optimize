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
  reason: string | null;
  source: "action_plan";
  orderIndex?: number;
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

const MAX_SIGNAL_SNIPPET_LEN = 220;

/** Lines that carry little diagnostic value for action copy (volume-only, meta-stats, disclaimers). */
function isLowValueSignalLine(text: string, category: ActionCategory): boolean {
  const t = text.trim();
  if (!t) return true;

  const universalMeta =
    /^\s*la description contient environ\s+\d+\s+mots\b/i.test(t) ||
    /\bsur la base des libellés fournis\b/i.test(t) ||
    /\bd['’]après le texte\b/i.test(t);

  if (universalMeta) return true;

  if (category === "photos") {
    return (
      /^la galerie contient de nombreuses photos\b/i.test(t) ||
      /^la galerie présente un bon volume de photos\b/i.test(t) ||
      /^le nombre de photos est correct\b/i.test(t) ||
      /^la galerie reste limitée\b/i.test(t) ||
      /^le nombre de photos est insuffisant\b/i.test(t) ||
      /^l['’]annonce contient \d+ photo/i.test(t) ||
      /^sur des plateformes très comparatives\b/i.test(t)
    );
  }

  if (category === "description") {
    return (
      /^la longueur de la description est adaptée\b/i.test(t) ||
      /^la description est présente mais encore légère\b/i.test(t) ||
      /^la description est détaillée\b/i.test(t)
    );
  }

  if (category === "amenities") {
    return /^l['’]annonce présente environ \d+ équipement/i.test(t);
  }

  if (category === "seo") {
    return (
      /^le titre est trop court\b/i.test(t) ||
      /^le titre est exploitable mais manque encore/i.test(t) ||
      /^la longueur du titre est bien équilibrée\b/i.test(t) ||
      /^le titre est détaillé, mais il peut devenir/i.test(t) ||
      /^le titre semble trop chargé\b/i.test(t) ||
      /^le titre contient un repère utile\b/i.test(t)
    );
  }

  return false;
}

/** Prefer lines that explain gaps, friction, or coherence (aligned with richer scoring modules). */
function signalLinePriority(text: string, category: ActionCategory): number {
  const t = text.trim();
  if (!t) return -100;
  if (isLowValueSignalLine(t, category)) return 0;

  const strong =
    /semblent répétées|doublon|promesse de l['’]annonce|des points forts sont annoncés|sous-représenté|décalage perçu|peu de variété|peu différenciant|semblent manquer|freiner la réservation|manque d['’]éléments concrets|peu structur[ée]|phrases trop longues|plusieurs paragraphes|présence de listes|clair, structuré et informatif|trop générique/i.test(
      t
    );
  if (strong) return 3;

  const medium =
    /couvre \d+ catégories d['’]équipements|couverture des équipements est intermédiaire|description est trop courte|encore légère|évaluation du logement plus difficile|plus de concret renforcerait la conversion|peut devenir un peu dense|repère utile|éléments de localisation utiles|termes se répètent|mots-clés empilés|galerie plus fournie/i.test(
      t
    );
  if (medium) return 2;

  return 1;
}

function signalFingerprint(text: string): string {
  const t = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (/avis|reassurance|confiance|decision|incertitude|conversion/.test(t)) return "trust";
  if (/texte|description|paragraphe|structure|premieres lignes|ouverture|clarte|clair/.test(t)) return "description";
  if (/titre|seo|mot.?cle|recherchable|generique/.test(t)) return "seo";
  if (/photo|visuel|galerie|image/.test(t)) return "photos";
  if (/equipement|amenit|service|parking|wifi|piscine/.test(t)) return "amenities";
  if (/prix|tarif|comparables|marche|positionnement/.test(t)) return "pricing";

  return t
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 4)
    .slice(0, 4)
    .join("-");
}

function pickReasonSnippet(reasons: string[] | undefined, category: ActionCategory): string | null {
  if (!reasons?.length) return null;

  const trimmed = reasons
    .map((r) => r.trim())
    .filter(Boolean)
    .filter(
      (r) =>
        !/^signal détecté\s*:/i.test(r) &&
        !/:\s*signal détecté\s*:/i.test(r) &&
        !/^rendre l['’]ouverture plus explicite\s*:/i.test(r) &&
        !/^clarifier les éléments de réassurance\s*:/i.test(r) &&
        !/^amélioration\s+\d+\s*:/i.test(r)
    );

  if (trimmed.length === 0) return null;

  const scored = trimmed.map((r, idx) => ({
    r,
    idx,
    p: signalLinePriority(r, category),
  }));

  scored.sort((a, b) => {
    if (b.p !== a.p) return b.p - a.p;
    return a.idx - b.idx;
  });

  const best = scored[0];
  if (!best || best.p <= 0) {
    return trimmed[0] ?? null;
  }

  const bestFingerprint = signalFingerprint(best.r);
  const second = scored
    .slice(1)
    .find((x) => x.p >= 2 && x.r !== best.r && signalFingerprint(x.r) !== bestFingerprint);
  if (second) {
    const joined = `${best.r} — ${second.r}`.replace(/\s+/g, " ").trim();
    if (joined.length <= MAX_SIGNAL_SNIPPET_LEN) {
      return joined;
    }
  }

  return best.r;
}

type SignalActionTemplate = {
  key: string;
  title: string;
  description: string;
  family?: "clarity" | "trust" | "visuals" | "seo" | "pricing" | "amenities";
};

function withSignal(_reason: string | null, nextStep: string) {
  return `À faire : ${nextStep}`;
}

function isPricingDataMissing(reason: string | null) {
  if (!reason) return false;
  return /no market pricing data|price missing|invalid|unable to benchmark|neutral score|données marché sont insuffisantes|prix .* absent|prix .* invalide|ne peut pas être évalué/i.test(reason);
}

function isReviewDataLimited(reason: string | null) {
  if (!reason) return false;
  return /insufficient review data|more reviews|review volume|rating .* review|volume d['’]avis est insuffisant|davantage d['’]avis|basée sur \d+ avis/i.test(reason);
}

function buildTemplatesForCategory(
  category: ActionCategory,
  reason: string | null
): SignalActionTemplate[] {
  switch (category) {
    case "photos":
      return [
        {
          key: "photo-signal",
          family: "visuals",
          title: "Clarifier la galerie photo",
          description: withSignal(
            reason,
            "Ajoutez ou réordonnez uniquement les visuels qui montrent des espaces réellement disponibles afin de rendre le logement plus compréhensible."
          ),
        },
        {
          key: "photo-order",
          family: "visuals",
          title: "Prioriser les visuels les plus informatifs",
          description: withSignal(
            reason,
            "Placez d’abord les photos qui expliquent le mieux la configuration réelle du logement, sans promettre d’atout non visible."
          ),
        },
      ];
    case "description":
      return [
        {
          key: "description-opening",
          family: "clarity",
          title: "Clarifier les informations qui déclenchent la réservation",
          description: withSignal(
            reason,
            "Mettez en priorité les informations qui influencent réellement la décision : couchages, confort, accès, équipements clés et points forts vérifiables."
          ),
        },
        {
          key: "description-specificity",
          family: "clarity",
          title: "Rendre la valeur plus concrète",
          description: withSignal(
            reason,
            "Remplacez les formulations génériques par des éléments visibles et utiles : couchages, équipements, accès, organisation du séjour ou avantages réellement présents."
          ),
        },
      ];
    case "amenities":
      return [
        {
          key: "amenities-visibility",
          family: "amenities",
          title: "Rendre les équipements clés plus visibles",
          description: withSignal(
            reason,
            "Faites ressortir les équipements qui différencient vraiment le logement et retirez les éléments vagues ou non vérifiables."
          ),
        },
      ];
    case "seo":
      return [
        {
          key: "seo-title",
          family: "seo",
          title: "Rendre le titre plus précis",
          description: withSignal(
            reason,
            "Ajustez le titre avec des informations confirmées : type de bien, localisation disponible et atout réellement présent."
          ),
        },
      ];
    case "trust":
      if (isReviewDataLimited(reason)) {
        return [
          {
            key: "trust-social-proof",
            family: "trust",
            title: "Renforcer la preuve sociale disponible",
            description: withSignal(
              reason,
              "Ajoutez des informations vérifiables dans l’annonce pour compenser une preuve sociale encore limitée par le volume d’avis."
            ),
          },
        ];
      }
      return [
        {
          key: "trust-clarity",
          family: "trust",
          title: "Renforcer la confiance avant réservation",
          description: withSignal(
            reason,
            "Ajoutez des éléments concrets qui réduisent l’hésitation : arrivée, règles importantes, configuration exacte et informations pratiques confirmées."
          ),
        },
      ];
    case "pricing":
      if (isPricingDataMissing(reason)) {
        return [
          {
            key: "pricing-data",
            family: "pricing",
            title: "Consolider les données tarifaires",
            description: withSignal(
              reason,
              "Vérifiez le prix renseigné et les comparables disponibles avant toute recommandation d’ajustement tarifaire."
            ),
          },
        ];
      }
      return [
        {
          key: "pricing-gap",
          family: "pricing",
          title: "Analyser l’écart tarifaire mesuré",
          description: withSignal(
            reason,
            "Ajustez le positionnement uniquement après comparaison avec les annonces réellement comparables disponibles."
          ),
        },
      ];
  }
}

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
  const usedFamilies = new Set<string>();

  const pushAction = (
    category: ActionCategory,
    priority: ActionPriority,
    action: SignalActionTemplate,
    reasonSnippet: string | null
  ) => {
    const id = `${category}-${action.key}`;
    if (usedIds.has(id)) return false;

    items.push({
      id,
      title: action.title,
      description: action.description,
      priority,
      category,
      impact: priority,
      reason: reasonSnippet,
      source: "action_plan",
    });

    usedIds.add(id);
    if (action.family) usedFamilies.add(action.family);
    return true;
  };

  for (const { category, priority } of scoredCategories) {
    const categoryReasons = reasonsByCategory[category];
    const reasonSnippet = pickReasonSnippet(categoryReasons, category);
    const templates = buildTemplatesForCategory(category, reasonSnippet);

    let maxItemsForCategory = 0;
    if (priority === "high") maxItemsForCategory = 2;
    else maxItemsForCategory = 1;

    let createdForCategory = 0;

    for (const action of templates) {
      if (createdForCategory >= maxItemsForCategory) break;
      if (action.family && usedFamilies.has(action.family)) continue;

      if (pushAction(category, priority, action, reasonSnippet)) {
        createdForCategory += 1;
      }
    }
  }

  const MIN_ITEMS = 4;
  if (items.length < MIN_ITEMS) {
    for (const { category, priority } of scoredCategories) {
      if (items.length >= MIN_ITEMS) break;

      const categoryReasons = reasonsByCategory[category];
      const reasonSnippet = pickReasonSnippet(categoryReasons, category);
      const templates = buildTemplatesForCategory(category, reasonSnippet);

      for (const action of templates) {
        if (items.length >= MIN_ITEMS) break;
        pushAction(category, priority, action, reasonSnippet);
      }
    }
  }

  // Keep the list reasonably short overall
  const MAX_ITEMS = 6;
  if (items.length > MAX_ITEMS) {
    return items.slice(0, MAX_ITEMS);
  }

  return items;
}
