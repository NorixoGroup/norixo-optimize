export type AuditInsightsLocale = "fr" | "en";

export type AuditInsightQuickWin = {
  title: string;
  impact: string;
};

export type AuditInsightsInput = {
  locale: AuditInsightsLocale;
  overallScore: number | null;
  listingQuality?: number | null;
  marketScore?: number | null;
  estimatedTopPercent?: number | null;
  impactLine: string;
  summary?: string | null;
  marketTeaser?: string | null;
  displayedInsight: string;
  /** When false, follow-up copy stays generic and avoids tier-based “insight” filler. */
  insightLeadFromPayload?: boolean;
  /** First recommendation string from the audit payload (not quick-win fallbacks). */
  payloadFirstRecommendation?: string | null;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  quickWins: AuditInsightQuickWin[];
};

export type AuditInsightsOutput = {
  tier: "low" | "medium" | "good" | "excellent";
  heroInsight: {
    title: string;
    text: string;
    closing: string;
  };
  diagnosticShort: string;
  businessPotential: {
    title: string;
    text: string;
    estimate: string;
  };
  quickWins: {
    title: string;
    intro: string;
    items: AuditInsightQuickWin[];
  };
  analysis: {
    title: string;
    strengthsTitle: string;
    weaknessesTitle: string;
    strengths: string[];
    weaknesses: string[];
    primaryPriority: string;
  };
  projectionLine: string;
  aiInsight: {
    title: string;
    lead: string;
    followup: string;
  };
  proTeaser: {
    title: string;
    bullets: string[];
    cta: string;
  };
};

function resolveTier(score: number | null): AuditInsightsOutput["tier"] {
  if (score === null || score < 5) return "low";
  if (score < 7) return "medium";
  if (score < 8.5) return "good";
  return "excellent";
}

function buildEstimateLine(impactLine: string, locale: AuditInsightsLocale) {
  if (impactLine.trim()) {
    return locale === "en"
      ? `Estimated upside: ${impactLine}`
      : `Estimation : ${impactLine}`;
  }

  return locale === "en"
    ? "Additional revenue potential to confirm after optimization."
    : "Potentiel de revenu supplementaire a confirmer apres optimisation.";
}

function fallbackRecommendations(score: number | null, locale: AuditInsightsLocale) {
  if (locale === "en") {
    if (score !== null && score >= 8.5) {
      return [
        "Refine the headline so the premium value is understood immediately.",
        "Make the strongest differentiator visible from the first image.",
        "Frame key amenities to support a higher perceived value.",
      ];
    }

    if (score !== null && score >= 7) {
      return [
        "Clarify the main promise in the title and first lines.",
        "Move the most compelling amenity higher in the listing flow.",
        "Improve the opening photo to strengthen click intent.",
      ];
    }

    return [
      "Clarify the main promise in the very first lines.",
      "Strengthen the opening photo to improve click-through.",
      "Highlight the amenities that reduce hesitation before booking.",
    ];
  }

  if (score !== null && score >= 8.5) {
    return [
      "Affinez le titre pour rendre la valeur premium plus immediate.",
      "Rendez votre meilleur element differenciant visible des la premiere photo.",
      "Mettez mieux en scene les equipements qui soutiennent une valeur percue plus elevee.",
    ];
  }

  if (score !== null && score >= 7) {
    return [
      "Clarifiez la promesse principale des le titre et les premieres lignes.",
      "Remontez l'equipement le plus convaincant dans la presentation.",
      "Renforcez la photo d'ouverture pour ameliorer l'intention de clic.",
    ];
  }

  return [
    "Clarifiez la promesse principale des les premieres lignes.",
    "Renforcez la photo d'ouverture pour ameliorer le taux de clic.",
    "Mettez les equipements differenciants en avant des le premier ecran.",
  ];
}

function honestEmptySnapshotList(
  kind: "strengths" | "weaknesses",
  locale: AuditInsightsLocale
): string[] {
  if (kind === "strengths") {
    return locale === "en"
      ? ["No structured strengths were provided in the latest audit summary."]
      : ["Aucun point fort structure n'a ete fourni dans la synthese du dernier audit."];
  }
  return locale === "en"
    ? ["No structured weaknesses were provided in the latest audit summary."]
    : ["Aucun point faible structure n'a ete fourni dans la synthese du dernier audit."];
}

function resolvePrimaryPriority(
  locale: AuditInsightsLocale,
  payloadFirstRecommendation: string | null | undefined
): string {
  const trimmed = payloadFirstRecommendation?.trim();
  if (trimmed) return trimmed;
  return locale === "en"
    ? "No single priority line was returned in the latest audit — use the priority actions list above."
    : "Aucune formulation de priorite unique n'a ete renvoyee dans le dernier audit — voir les actions prioritaires ci-dessus.";
}

function neutralInsightFollowup(locale: AuditInsightsLocale): string {
  return locale === "en"
    ? "What follows is general context only. Open the full audit for listing-specific findings."
    : "Ce qui suit reste du contexte general. Ouvrez l'audit complet pour les constats specifiques a cette annonce.";
}

export function buildAuditInsights({
  locale,
  overallScore,
  estimatedTopPercent,
  impactLine,
  summary,
  marketTeaser,
  displayedInsight,
  insightLeadFromPayload = true,
  payloadFirstRecommendation = null,
  strengths,
  weaknesses,
  recommendations,
  quickWins,
}: AuditInsightsInput): AuditInsightsOutput {
  const tier = resolveTier(overallScore);
  const safeStrengths =
    strengths.length > 0 ? strengths.slice(0, 3) : honestEmptySnapshotList("strengths", locale);
  const safeWeaknesses =
    weaknesses.length > 0
      ? weaknesses.slice(0, 3)
      : honestEmptySnapshotList("weaknesses", locale);
  const safeRecommendations =
    recommendations.length > 0
      ? recommendations.slice(0, 3)
      : fallbackRecommendations(overallScore, locale);
  const safeQuickWins =
    quickWins.length > 0
      ? quickWins.slice(0, 3)
      : safeRecommendations.map((item, index) => ({
          title: item,
          impact:
            overallScore !== null
              ? `+${Math.max(2, Math.round(10 - overallScore) + 2 + index)}%`
              : `+${4 + index}%`,
        }));

  if (locale === "en") {
    const projection =
      estimatedTopPercent !== null
        ? `You are already close to the top ${estimatedTopPercent}% of visible listings, but conversion can still improve.`
        : "This listing already provides enough signals to prioritize the next optimization moves.";

    const common = {
      quickWins: {
        title: "Priority actions",
        intro:
          tier === "excellent"
            ? "Focus on a few precise improvements with clear commercial leverage."
            : tier === "good"
            ? "Prioritize the actions that reinforce what is already working."
            : tier === "medium"
            ? "Start with the changes that make the listing easier to understand and choose."
            : "Start with the most visible blockers to unlock faster gains.",
        items: safeQuickWins,
      },
      analysis: {
        title: "Snapshot",
        strengthsTitle: "What already works",
        weaknessesTitle: "What still slows conversion",
        strengths: safeStrengths,
        weaknesses: safeWeaknesses,
        primaryPriority: resolvePrimaryPriority(locale, payloadFirstRecommendation),
      },
      aiInsight: {
        title: "Smart analysis",
        lead: summary?.trim() || displayedInsight,
        followup:
          marketTeaser?.trim() ||
          (!insightLeadFromPayload
            ? neutralInsightFollowup(locale)
            : tier === "excellent"
              ? "Top listings at this level usually win on precision: sharper framing, stronger differentiation, and cleaner proof points."
              : tier === "good"
                ? "Listings that outperform this level usually make their differentiators visible earlier in the title, gallery, and amenities."
                : tier === "medium"
                  ? "The best-performing listings in this range reduce hesitation faster and communicate value more clearly."
                  : "Stronger listings in this range usually win on clarity, reassurance, and a more convincing first impression."),
      },
      proTeaser: {
        title:
          tier === "excellent"
            ? "Unlock a deeper market reading"
            : "Unlock a more detailed optimization plan",
        bullets: [
          "Detailed comparison against your visible market",
          "More advanced positioning signals",
          "Sharper recommendations for the next optimization cycle",
        ],
        cta: "Upgrade to Pro to go further",
      },
    };

    if (tier === "low") {
      return {
        tier,
        heroInsight: {
          title: "This listing needs a priority catch-up on the most visible levers",
          text:
            "The fundamentals are not strong enough yet. The good news is that the next improvements are clear and should produce visible gains quickly.",
          closing:
            "Fix the most visible conversion signals first before refining anything more advanced.",
        },
        diagnosticShort:
          "Several visible signals still slow the booking decision. This gap is recoverable with focused corrections.",
        businessPotential: {
          title: "Revenue upside is available",
          text:
            "A stronger first impression and clearer trust signals should help the listing convert more of the demand already available.",
          estimate: buildEstimateLine(impactLine, locale),
        },
        projectionLine: projection,
        ...common,
      };
    }

    if (tier === "medium") {
      return {
        tier,
        heroInsight: {
          title: "This listing has a healthy base, but conversion can still improve materially",
          text:
            "The offer is visible, but not yet framed strongly enough to maximize bookings. Better clarity and stronger differentiation should make a real difference.",
          closing:
            "The next step is not a full rewrite, but sharper execution on the most visible elements.",
        },
        diagnosticShort:
          "The listing is credible, but it still loses momentum on the title, the lead photo, and the clarity of the value proposition.",
        businessPotential: {
          title: "Revenue upside remains accessible",
          text:
            "You are close to a stronger market position, but several visible friction points still limit performance.",
          estimate: buildEstimateLine(impactLine, locale),
        },
        projectionLine: projection,
        ...common,
      };
    }

    if (tier === "good") {
      return {
        tier,
        heroInsight: {
          title: "This listing is already solid, with meaningful room for refinement",
          text:
            "The commercial base is strong. The remaining gains should come from sharper merchandising, stronger proof, and clearer differentiation.",
          closing:
            "At this level, a few well-chosen refinements can still create measurable business upside.",
        },
        diagnosticShort:
          "The listing already does many things well, but a stronger first impression and more visible proof points can still improve conversion.",
        businessPotential: {
          title: "Additional revenue is still within reach",
          text:
            "A clearer presentation of your differentiators can still unlock more value and more bookings.",
          estimate: buildEstimateLine(impactLine, locale),
        },
        projectionLine: projection,
        ...common,
      };
    }

    return {
      tier,
      heroInsight: {
        title: "This listing is already high-performing, but not fully maximized",
        text:
          "The fundamentals are in place. The remaining upside now depends on finer improvements with stronger commercial leverage.",
        closing:
          "You are close to the top of the market. Focus on the changes with the clearest business return.",
      },
      diagnosticShort:
        "The listing is already strong. The next improvements should sharpen positioning, differentiation, and conversion efficiency.",
      businessPotential: {
        title: "Revenue upside is still available",
        text:
          "Even a strong listing can capture more value when its best signals are framed more precisely.",
        estimate: buildEstimateLine(impactLine, locale),
      },
      projectionLine: projection,
      ...common,
    };
  }

  const projection =
    estimatedTopPercent !== null
      ? `Vous etes deja proche du top ${estimatedTopPercent}% des annonces visibles, mais la conversion peut encore progresser.`
      : "Cette annonce donne deja assez de signaux pour prioriser les prochaines optimisations.";

  const common = {
    quickWins: {
      title: "Actions prioritaires",
      intro:
        tier === "excellent"
          ? "Concentrez-vous sur quelques ajustements precis au meilleur levier business."
          : tier === "good"
          ? "Priorisez les actions qui renforcent ce qui fonctionne deja."
          : tier === "medium"
          ? "Commencez par les optimisations qui rendent l'annonce plus lisible et plus facile a choisir."
          : "Traitez d'abord les blocages les plus visibles pour debloquer des gains rapides.",
      items: safeQuickWins,
    },
    analysis: {
      title: "Lecture rapide",
      strengthsTitle: "Ce qui fonctionne deja",
      weaknessesTitle: "Ce qui freine encore la conversion",
      strengths: safeStrengths,
      weaknesses: safeWeaknesses,
      primaryPriority: resolvePrimaryPriority(locale, payloadFirstRecommendation),
    },
    aiInsight: {
      title: "Analyse intelligente",
      lead: summary?.trim() || displayedInsight,
      followup:
        marketTeaser?.trim() ||
        (!insightLeadFromPayload
          ? neutralInsightFollowup(locale)
          : tier === "excellent"
            ? "Les annonces les plus performantes a ce niveau gagnent souvent sur la precision : meilleur cadrage, meilleure differenciation et preuves plus visibles."
            : tier === "good"
              ? "Les annonces qui depassent ce niveau rendent souvent leurs points differenciants plus visibles des le titre, la galerie et les equipements cles."
              : tier === "medium"
                ? "Les annonces qui performent mieux dans cette zone reduisent plus vite les hesitations et clarifient mieux leur valeur."
                : "Les annonces plus performantes dans cette zone gagnent souvent sur la clarte, la confiance et une premiere impression plus convaincante."),
    },
    proTeaser: {
      title:
        tier === "excellent"
          ? "Accedez a une lecture encore plus poussee du marche"
          : "Accedez a une analyse plus poussee",
      bullets: [
        "Comparaison detaillee avec votre marche visible",
        "Lectures plus fines de positionnement",
        "Recommandations plus precises pour la prochaine phase d'optimisation",
      ],
      cta: "Passez en Pro pour aller plus loin",
    },
  };

  if (tier === "low") {
    return {
      tier,
      heroInsight: {
        title: "Votre annonce demande encore un vrai rattrapage sur les leviers visibles",
        text:
          "Les fondamentaux ne sont pas encore assez solides. La bonne nouvelle, c'est que les priorites sont lisibles et que les premiers gains peuvent arriver rapidement.",
        closing:
          "Corrigez d'abord les signaux de conversion les plus visibles avant d'affiner le reste.",
      },
      diagnosticShort:
        "Plusieurs signaux visibles freinent encore la decision de reserver. Cet ecart est recuperable avec des corrections ciblees.",
      businessPotential: {
        title: "Potentiel de gain disponible",
        text:
          "Une premiere impression plus forte et des signaux de confiance plus nets devraient mieux convertir la demande deja visible.",
        estimate: buildEstimateLine(impactLine, locale),
      },
      projectionLine: projection,
      ...common,
    };
  }

  if (tier === "medium") {
    return {
      tier,
      heroInsight: {
        title: "Votre annonce repose sur une base saine, mais elle peut encore mieux convertir",
        text:
          "L'offre est visible, mais pas encore assez bien cadree pour maximiser les reservations. Plus de clarte et une meilleure differenciation devraient faire la difference.",
        closing:
          "La prochaine etape n'est pas une refonte complete, mais une execution plus precise sur les elements les plus visibles.",
      },
      diagnosticShort:
        "L'annonce est credible, mais elle perd encore de l'elan sur le titre, la photo principale et la clarte de la valeur.",
      businessPotential: {
        title: "Potentiel de gain disponible",
        text:
          "Vous n'etes pas loin d'un meilleur positionnement, mais plusieurs points de friction visibles limitent encore la performance.",
        estimate: buildEstimateLine(impactLine, locale),
      },
      projectionLine: projection,
      ...common,
    };
  }

  if (tier === "good") {
    return {
      tier,
      heroInsight: {
        title: "Votre annonce est deja solide, avec une vraie marge d'optimisation",
        text:
          "La base est suffisamment forte pour bien concurrencer. Les gains restants viendront d'un merchandising plus precis et d'un meilleur positionnement.",
        closing:
          "A ce niveau, quelques ameliorations bien choisies peuvent produire un impact business mesurable.",
      },
      diagnosticShort:
        "L'annonce fait deja beaucoup de choses correctement, mais une meilleure premiere impression et des preuves plus visibles peuvent encore augmenter la conversion.",
      businessPotential: {
        title: "Potentiel de gain disponible",
        text:
          "Une mise en avant plus forte de vos points differenciants peut encore debloquer plus de valeur et plus de reservations.",
        estimate: buildEstimateLine(impactLine, locale),
      },
      projectionLine: projection,
      ...common,
    };
  }

  return {
    tier,
    heroInsight: {
      title: "Votre annonce est deja tres performante, mais pas encore totalement maximisee",
      text:
        "Les fondamentaux sont bien en place. Le potentiel restant depend maintenant d'ajustements plus fins, mais a fort levier commercial.",
      closing:
        "Vous etes proche du haut du marche. Priorisez les optimisations au meilleur retour business.",
    },
    diagnosticShort:
      "L'annonce est deja forte. Les prochaines ameliorations doivent affiner le positionnement, la differenciation et l'efficacite de conversion.",
    businessPotential: {
      title: "Potentiel de gain disponible",
      text:
        "Meme une annonce performante peut encore mieux convertir si ses meilleurs signaux sont cadres avec plus de precision.",
      estimate: buildEstimateLine(impactLine, locale),
    },
    projectionLine: projection,
    ...common,
  };
}
