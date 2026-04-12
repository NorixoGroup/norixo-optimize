export type BillingActivePlanCode = "free" | "pro" | "scale";

export type UpsellAction = "upgrade_pro" | "upgrade_scale" | "buy_top_up" | null;

export const OFFER_CREDIT_TOTALS = {
  starter: 1,
  pro: 5,
  scale: 15,
} as const;

export const UPSSELL_THRESHOLDS = {
  soft: 2,
  critical: 1,
  empty: 0,
} as const;

export type BillingUpsellState = {
  show: boolean;
  tone: "none" | "soft" | "critical" | "empty";
  message: string | null;
  action: UpsellAction;
  ctaLabel: string | null;
};

export function getBillingUpsellState(
  activePlanCode: BillingActivePlanCode,
  remaining: number
): BillingUpsellState {
  if (remaining > UPSSELL_THRESHOLDS.soft) {
    return {
      show: false,
      tone: "none",
      message: null,
      action: null,
      ctaLabel: null,
    };
  }

  if (remaining === UPSSELL_THRESHOLDS.soft) {
    return {
      show: true,
      tone: "soft",
      message:
        "Plus que 2 audits restants. Anticipez maintenant pour garder votre cadence d’optimisation.",
      action: null,
      ctaLabel: null,
    };
  }

  if (remaining === UPSSELL_THRESHOLDS.critical) {
    return {
      show: true,
      tone: "critical",
      message:
        "Dernier audit disponible. Passez à l’offre supérieure pour éviter une interruption de vos analyses.",
      action: null,
      ctaLabel: null,
    };
  }

  if (activePlanCode === "free") {
    return {
      show: true,
      tone: "empty",
      message:
        "Vous n’avez plus d’audits disponibles. Pro vous permet de continuer immédiatement avec un meilleur coût par audit.",
      action: "upgrade_pro",
      ctaLabel: "Activer Pro",
    };
  }

  if (activePlanCode === "pro") {
    return {
      show: true,
      tone: "empty",
      message:
        "Vous n’avez plus d’audits disponibles. Scale vous donne plus de volume et un coût unitaire plus optimisé.",
      action: "upgrade_scale",
      ctaLabel: "Passer à Scale",
    };
  }

  return {
    show: true,
    tone: "empty",
    message:
      "Vous n’avez plus d’audits disponibles. Rechargez pour maintenir la continuité d’usage.",
    action: "buy_top_up",
    ctaLabel: "Acheter 1 audit",
  };
}
