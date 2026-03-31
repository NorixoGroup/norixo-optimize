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
        title: "Améliorer la première photo",
        baseDescription:
          "Mettez à jour la première image pour montrer clairement le principal atout du logement (vue, terrasse, pièce de vie) dans de bonnes conditions de lumière et de netteté.",
        impact: "high",
      },
      {
        key: "coverage",
        title: "Mieux couvrir les pièces clés",
        baseDescription:
          "Assurez-vous que chaque espace important (chambres, salle de bain, salon, extérieur) dispose d’au moins une photo claire.",
        impact: "medium",
      },
      {
        key: "order",
        title: "Réorganiser les photos pour plus d’impact",
        baseDescription:
          "Placez les meilleures photos en tête de galerie pour montrer immédiatement les points les plus attractifs du logement.",
        impact: "medium",
      },
    ],
  },
  {
    category: "description",
    actions: [
      {
        key: "opening",
        title: "Renforcer le paragraphe d’ouverture",
        baseDescription:
          "Réécrivez les 2 à 3 premières phrases pour indiquer clairement à qui s’adresse le logement, ce qui le rend unique et pourquoi réserver.",
        impact: "high",
      },
      {
        key: "structure",
        title: "Améliorer la structure de la description",
        baseDescription:
          "Utilisez des paragraphes courts et des sections claires (logement, équipements, quartier, accès) pour faciliter la lecture.",
        impact: "medium",
      },
      {
        key: "value-points",
        title: "Ajouter des bénéfices concrets",
        baseDescription:
          "Mettez en avant 3 à 5 bénéfices précis (emplacement, confort, équipements) plutôt que des adjectifs génériques.",
        impact: "medium",
      },
    ],
  },
  {
    category: "amenities",
    actions: [
      {
        key: "essentials",
        title: "Ajouter ou mieux mettre en avant les équipements essentiels",
        baseDescription:
          "Vérifiez que les équipements clés comme le Wi‑Fi, la cuisine, le chauffage ou la climatisation, le parking et la laverie sont bien disponibles et clairement listés.",
        impact: "high",
      },
      {
        key: "high-value",
        title: "Valoriser les équipements à forte valeur perçue",
        baseDescription:
          "Mettez en avant les équipements différenciants (espace de travail, terrasse, piscine, matériel bébé) en haut de la liste.",
        impact: "medium",
      },
      {
        key: "alignment",
        title: "Aligner les équipements avec les attentes clients",
        baseDescription:
          "Comparez votre liste d’équipements à celle d’annonces similaires et ajoutez les éléments les plus attendus lorsque c’est possible.",
        impact: "medium",
      },
    ],
  },
  {
    category: "seo",
    actions: [
      {
        key: "title-clarity",
        title: "Améliorer la clarté du titre",
        baseDescription:
          "Faites apparaître dans le titre le type de bien, un atout clé et la localisation (par exemple : 'Riad avec terrasse rooftop dans la médina').",
        impact: "high",
      },
      {
        key: "keywords",
        title: "Ajouter des mots-clés descriptifs",
        baseDescription:
          "Ajoutez 1 à 2 attributs concrets recherchés par les voyageurs (terrasse, piscine, centre-ville, parking) sans surcharger le texte.",
        impact: "medium",
      },
      {
        key: "specificity",
        title: "Rendre le titre plus spécifique",
        baseDescription:
          "Évitez les titres génériques et insistez sur ce qui différencie ce logement d’autres biens au même niveau de prix.",
        impact: "medium",
      },
    ],
  },
  {
    category: "trust",
    actions: [
      {
        key: "reassurance",
        title: "Renforcer la confiance et la réassurance",
        baseDescription:
          "Utilisez la description pour rassurer les voyageurs sur la propreté, l’arrivée, la réactivité de l’hôte et la sécurité.",
        impact: "high",
      },
      {
        key: "completeness",
        title: "Améliorer la complétude de l’annonce",
        baseDescription:
          "Assurez-vous que les informations clés comme les règles du logement, les modalités d’arrivée et la configuration des couchages sont clairement indiquées.",
        impact: "medium",
      },
      {
        key: "experience",
        title: "Mettre en avant les signaux d’expérience client",
        baseDescription:
          "Faites ressortir dans le texte les thèmes récurrents appréciés par les voyageurs (calme, central, adapté aux familles, qualité de l’accueil).",
        impact: "medium",
      },
    ],
  },
  {
    category: "pricing",
    actions: [
      {
        key: "review",
        title: "Revoir le prix par rapport au marché local",
        baseDescription:
          "Comparez votre prix par nuit à des annonces similaires et ajustez-le si vous êtes nettement au-dessus ou en dessous sans justification claire.",
        impact: "high",
      },
      {
        key: "positioning",
        title: "Aligner le prix avec la valeur perçue",
        baseDescription:
          "Assurez-vous que les photos, la description et les équipements justifient le prix actuel, ou ajustez le tarif en conséquence.",
        impact: "medium",
      },
      {
        key: "strategy",
        title: "Affiner la stratégie tarifaire",
        baseDescription:
          "Tenez compte des écarts semaine/week-end et de la saisonnalité plutôt que d’utiliser un tarif unique toute l’année.",
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

  for (const { category, priority } of scoredCategories) {
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
