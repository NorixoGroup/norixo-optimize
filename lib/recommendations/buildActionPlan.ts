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

type SignalActionTemplate = {
  key: string;
  title: string;
  description: string;
};

function withSignal(reason: string | null, nextStep: string) {
  return reason ? `Signal détecté : ${reason}. ${nextStep}` : nextStep;
}

function isPricingDataMissing(reason: string | null) {
  if (!reason) return false;
  return /no market pricing data|price missing|invalid|unable to benchmark|neutral score/i.test(reason);
}

function isReviewDataLimited(reason: string | null) {
  if (!reason) return false;
  return /insufficient review data|more reviews|review volume|rating .* review/i.test(reason);
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
          title: "Clarifier la galerie photo",
          description: withSignal(
            reason,
            "Ajoutez ou réordonnez uniquement les visuels qui montrent des espaces réellement disponibles afin de rendre le logement plus compréhensible."
          ),
        },
        {
          key: "photo-coverage",
          title: "Compléter les angles utiles",
          description: withSignal(
            reason,
            "Couvrez les zones effectivement proposées aux voyageurs et retirez les images qui n’apportent pas d’information nouvelle."
          ),
        },
        {
          key: "photo-order",
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
          title: "Rendre l’ouverture plus explicite",
          description: withSignal(
            reason,
            "Réécrivez les premières lignes pour présenter clairement le type de séjour, les informations vérifiables et les bénéfices déjà présents dans l’annonce."
          ),
        },
        {
          key: "description-structure",
          title: "Structurer les informations clés",
          description: withSignal(
            reason,
            "Organisez le texte autour des éléments réellement connus : logement, accès, équipements listés et informations pratiques."
          ),
        },
        {
          key: "description-specificity",
          title: "Remplacer les formulations vagues",
          description: withSignal(
            reason,
            "Remplacez les adjectifs génériques par des détails confirmés dans les données de l’annonce."
          ),
        },
      ];
    case "amenities":
      return [
        {
          key: "amenities-visibility",
          title: "Clarifier les équipements détectés",
          description: withSignal(
            reason,
            "Mettez en avant les équipements réellement listés et vérifiez les éléments attendus qui semblent absents ou peu visibles."
          ),
        },
        {
          key: "amenities-completeness",
          title: "Compléter les informations d’équipement",
          description: withSignal(
            reason,
            "Ajoutez uniquement les équipements disponibles sur place et retirez toute ambiguïté sur leur présence."
          ),
        },
      ];
    case "seo":
      return [
        {
          key: "seo-title",
          title: "Rendre le titre plus précis",
          description: withSignal(
            reason,
            "Ajustez le titre avec des informations confirmées : type de bien, localisation disponible et atout réellement présent."
          ),
        },
        {
          key: "seo-specificity",
          title: "Ajouter des repères descriptifs fiables",
          description: withSignal(
            reason,
            "Utilisez des termes recherchables uniquement lorsqu’ils correspondent aux données détectées dans l’annonce."
          ),
        },
      ];
    case "trust":
      if (isReviewDataLimited(reason)) {
        return [
          {
            key: "trust-social-proof",
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
          title: "Clarifier les éléments de réassurance",
          description: withSignal(
            reason,
            "Mettez en avant uniquement les informations vérifiables déjà disponibles : modalités d’arrivée, règles, configuration et éléments pratiques."
          ),
        },
        {
          key: "trust-completeness",
          title: "Compléter les informations de décision",
          description: withSignal(
            reason,
            "Ajoutez les précisions manquantes qui aident le voyageur à comprendre ce qui est inclus avant de réserver."
          ),
        },
      ];
    case "pricing":
      if (isPricingDataMissing(reason)) {
        return [
          {
            key: "pricing-data",
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
          title: "Analyser l’écart tarifaire mesuré",
          description: withSignal(
            reason,
            "Ajustez le positionnement uniquement après comparaison avec les annonces réellement comparables disponibles."
          ),
        },
        {
          key: "pricing-consistency",
          title: "Aligner prix et signaux visibles",
          description: withSignal(
            reason,
            "Vérifiez que le prix affiché reste cohérent avec les photos, la description et les équipements réellement présents."
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

  for (const { category, priority } of scoredCategories) {
    const categoryReasons = reasonsByCategory[category];
    const reasonSnippet = pickReasonSnippet(categoryReasons);
    const templates = buildTemplatesForCategory(category, reasonSnippet);

    let maxItemsForCategory = 0;
    if (priority === "high") maxItemsForCategory = 3;
    else if (priority === "medium") maxItemsForCategory = 2;
    else maxItemsForCategory = 1;

    let createdForCategory = 0;

    for (const action of templates) {
      if (createdForCategory >= maxItemsForCategory) break;

      const id = `${category}-${action.key}`;
      if (usedIds.has(id)) continue;

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
