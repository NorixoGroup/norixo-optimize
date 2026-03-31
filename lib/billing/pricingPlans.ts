export type BillingCycle = "monthly" | "yearly";

export type PricingPlan = {
  code: "free" | "pro" | "scale";
  name: string;
  audience: string;
  description: string;
  note?: string;
  monthly: number;
  yearly: number;
  features: string[];
};

export const defaultBillingCycle: BillingCycle = "monthly";

export const pricingPlans: PricingPlan[] = [
  {
    code: "free",
    name: "Decouverte",
    audience: "Ideal pour tester la plateforme",
    description: "Ideal pour tester la plateforme avant abonnement.",
    monthly: 0,
    yearly: 0,
    features: [
      "Decouvrez le potentiel de vos annonces",
      "Testez la qualite de l analyse avant abonnement",
      "Paiement a l unite apres le premier audit",
    ],
  },
  {
    code: "pro",
    name: "Pro",
    audience: "Pour les hotes et conciergeries en croissance",
    description: "Optimisez vos performances et augmentez vos revenus.",
    monthly: 39,
    yearly: 390,
    features: [
      "Rentable des plusieurs audits",
      "Suivi regulier de vos annonces",
      "Optimisation continue",
    ],
  },
  {
    code: "scale",
    name: "Scale",
    audience: "Pour les operateurs",
    description:
      "Pour les operateurs qui veulent maximiser leurs revenus a grande echelle.",
    note: "Pense pour les portefeuilles de +10 annonces",
    monthly: 79,
    yearly: 790,
    features: [
      "Tout ce qui est inclus dans Pro",
      "Support multi-annonces",
      "Analyses avancees",
      "Support prioritaire",
      "Fonctionnalites d'automatisation",
    ],
  },
];
