export type MarketingValidationIssue = {
  type:
    | "forbidden_claim"
    | "invented_asset"
    | "forbidden_platform"
    | "markdown_json"
    | "date_issue"
    | "empty_output";
  severity: "warning" | "error";
  message: string;
  match?: string;
};

export type MarketingValidationResult = {
  ok: boolean;
  cleanedOutput: string;
  issues: MarketingValidationIssue[];
};

const FORBIDDEN_PATTERNS: Array<{
  type: MarketingValidationIssue["type"];
  severity: MarketingValidationIssue["severity"];
  pattern: RegExp;
  message: string;
}> = [
  {
    type: "invented_asset",
    severity: "error",
    pattern: /\b(t[eé]moignage|utilisateur satisfait|client story|case study|étude de cas|webinaire|guide gratuit|livre blanc|download|téléchargez)\b/i,
    message: "Invented asset or unsupported marketing resource.",
  },
  {
    type: "forbidden_claim",
    severity: "error",
    pattern: /\b(boost|booster|transformez|maximisez|maximiser|plus de réservations|revenus?|classement garanti|ranking garanti|garanti|performance|performances|potentiel|succès)\b/i,
    message: "Overpromising or aggressive performance wording.",
  },
  {
    type: "forbidden_platform",
    severity: "warning",
    pattern: /#(?:airbnb|booking|vrbo|expedia)\b/i,
    message: "Forbidden platform hashtag.",
  },
  {
    type: "date_issue",
    severity: "warning",
    pattern: /\b20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}/,
    message: "Invented ISO publication date.",
  },
];

function stripMarkdownCodeFence(value: string) {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function applySafeReplacements(value: string) {
  return value
    .replace(/\bboost(?:er|ez)?\b/gi, "mettre en valeur")
    .replace(/\btransformez\b/gi, "clarifiez")
    .replace(/\bmaximis(?:er|ez)\b/gi, "mieux comprendre")
    .replace(/\bplus de réservations\b/gi, "des priorités plus claires")
    .replace(/\bperformances?\b/gi, "résultats potentiels")
    .replace(/#(?:Airbnb|Booking|Vrbo|Expedia)\b/gi, "")
    .replace(/résultats potentiels/gi, "signaux visibles")
    .replace(/indicateurs de résultats/gi, "indicateurs de lecture")
    .replace(/graphiques et des indicateurs/gi, "cartes UI et indicateurs de lecture")
    .replace(/attirer plus de voyageurs/gi, "clarifier les points de friction")
    .replace(/plein potentiel/gi, "bon niveau de clarté")
    .replace(/potentiel/gi, "niveau de clarté")
    .replace(/attirer vos futurs voyageurs/gi, "clarifier les informations importantes")
    .replace(/se démarquer/gi, "être plus lisible")
    .replace(/pour optimiser votre annonce/gi, "pour mieux comprendre votre annonce")
    .replace(/optimiser votre annonce/gi, "mieux comprendre votre annonce")
    .replace(/améliorer vos annonces/gi, "clarifier vos priorités")
    .replace(/améliorer votre annonce/gi, "clarifier vos priorités")
    .replace(/corriger vos annonces/gi, "identifier vos priorités")
    .replace(/succès/gi, "clarté")
    .replace(/\b20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z\b/g, "début de semaine")
    .replace(/freiner la priorités/gi, "créer des points de friction")
    .replace(/freiner vos priorités/gi, "créer des points de friction")
    .replace(/optimiser votre visibilité/gi, "mieux comprendre vos priorités")
    .replace(/optimiser vos annonces/gi, "mieux comprendre vos annonces")
    .replace(/préparez votre annonce pour le succès/gi, "préparez vos prochaines actions avec plus de clarté")
    .replace(/empêcher votre annonce de se démarquer/gi, "rendre votre annonce moins lisible")
    .replace(/freiner son succès/gi, "créer des points de friction")
    .replace(/pour le succès/gi, "avec plus de clarté")
    .replace(/corriger/gi, "identifier")
    .replace(/conseils visuels/gi, "repères visuels")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function validateMarketingOutput(output: string | null | undefined): MarketingValidationResult {
  const issues: MarketingValidationIssue[] = [];

  if (!output || !output.trim()) {
    return {
      ok: false,
      cleanedOutput: "",
      issues: [
        {
          type: "empty_output",
          severity: "error",
          message: "Empty marketing output.",
        },
      ],
    };
  }

  let cleanedOutput = output.trim();

  if (/^```/i.test(cleanedOutput)) {
    issues.push({
      type: "markdown_json",
      severity: "warning",
      message: "Output was wrapped in markdown code fences.",
    });
    cleanedOutput = stripMarkdownCodeFence(cleanedOutput);
  }

  for (const rule of FORBIDDEN_PATTERNS) {
    const match = cleanedOutput.match(rule.pattern);
    if (match) {
      issues.push({
        type: rule.type,
        severity: rule.severity,
        message: rule.message,
        match: match[0],
      });
    }
  }

  cleanedOutput = applySafeReplacements(cleanedOutput);

  return {
    ok: !issues.some((issue) => issue.severity === "error"),
    cleanedOutput,
    issues,
  };
}
