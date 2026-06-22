export type MarketingQualityGrade = "A" | "B" | "C" | "D" | "E";

export type MarketingQualityCheckType =
  | "campaign_alignment"
  | "language"
  | "tone"
  | "cta"
  | "duplicate_topic"
  | "repeated_format"
  | "platform_fit"
  | "length"
  | "clarity"
  | "compliance";

export type MarketingQualityIssue = {
  type: MarketingQualityCheckType;
  message: string;
  severity: "error" | "warning";
  scoreImpact: number;
};

export type MarketingQualityWarning = {
  type: MarketingQualityCheckType;
  message: string;
};

export type MarketingQualityImprovement = {
  type: MarketingQualityCheckType;
  message: string;
};

export type MarketingQualityGateResult = {
  passed: boolean;
  score: number;
  maxScore: number;
  grade: MarketingQualityGrade;
  issues: MarketingQualityIssue[];
  warnings: MarketingQualityWarning[];
  improvements: MarketingQualityImprovement[];
  createdAt: string;
};

const MARKETING_QUALITY_CHECK_TYPES: MarketingQualityCheckType[] = [
  "campaign_alignment",
  "language",
  "tone",
  "cta",
  "duplicate_topic",
  "repeated_format",
  "platform_fit",
  "length",
  "clarity",
  "compliance",
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeDateString(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function isMarketingQualityCheckType(
  value: unknown,
): value is MarketingQualityCheckType {
  return (
    typeof value === "string" &&
    MARKETING_QUALITY_CHECK_TYPES.includes(value as MarketingQualityCheckType)
  );
}

function isMarketingQualityIssue(value: unknown): value is MarketingQualityIssue {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    isMarketingQualityCheckType(value.type) &&
    typeof value.message === "string" &&
    (value.severity === "error" || value.severity === "warning") &&
    typeof value.scoreImpact === "number" &&
    Number.isFinite(value.scoreImpact)
  );
}

function isMarketingQualityWarning(
  value: unknown,
): value is MarketingQualityWarning {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    isMarketingQualityCheckType(value.type) &&
    typeof value.message === "string"
  );
}

function isMarketingQualityImprovement(
  value: unknown,
): value is MarketingQualityImprovement {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    isMarketingQualityCheckType(value.type) &&
    typeof value.message === "string"
  );
}

export function calculateQualityGrade(
  score: number,
  maxScore: number,
): MarketingQualityGrade {
  if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) {
    return "E";
  }

  const ratio = Math.max(0, Math.min(1, score / maxScore));

  if (ratio >= 0.9) {
    return "A";
  }

  if (ratio >= 0.75) {
    return "B";
  }

  if (ratio >= 0.6) {
    return "C";
  }

  if (ratio >= 0.4) {
    return "D";
  }

  return "E";
}

export function createEmptyQualityGateResult(): MarketingQualityGateResult {
  const createdAt = new Date().toISOString();
  const maxScore = 100;
  const score = 100;

  return {
    passed: true,
    score,
    maxScore,
    grade: calculateQualityGrade(score, maxScore),
    issues: [],
    warnings: [],
    improvements: [],
    createdAt,
  };
}

function recomputeQualityGateResult(
  result: MarketingQualityGateResult,
): MarketingQualityGateResult {
  const totalImpact = result.issues.reduce(
    (sum, issue) => sum + Math.max(0, issue.scoreImpact),
    0,
  );
  const score = Math.max(0, result.maxScore - totalImpact);
  const passed = !result.issues.some((issue) => issue.severity === "error");

  return {
    ...result,
    score,
    passed,
    grade: calculateQualityGrade(score, result.maxScore),
  };
}

export function addQualityIssue(
  result: MarketingQualityGateResult,
  issue: MarketingQualityIssue,
): MarketingQualityGateResult {
  return recomputeQualityGateResult({
    ...result,
    issues: [...result.issues, issue],
  });
}

export function addQualityWarning(
  result: MarketingQualityGateResult,
  warning: MarketingQualityWarning,
): MarketingQualityGateResult {
  return recomputeQualityGateResult({
    ...result,
    warnings: [...result.warnings, warning],
  });
}

export function addQualityImprovement(
  result: MarketingQualityGateResult,
  improvement: MarketingQualityImprovement,
): MarketingQualityGateResult {
  return recomputeQualityGateResult({
    ...result,
    improvements: [...result.improvements, improvement],
  });
}

export function isMarketingQualityGateResult(
  value: unknown,
): value is MarketingQualityGateResult {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    typeof value.passed === "boolean" &&
    typeof value.score === "number" &&
    Number.isFinite(value.score) &&
    typeof value.maxScore === "number" &&
    Number.isFinite(value.maxScore) &&
    (value.grade === "A" ||
      value.grade === "B" ||
      value.grade === "C" ||
      value.grade === "D" ||
      value.grade === "E") &&
    Array.isArray(value.issues) &&
    value.issues.every(isMarketingQualityIssue) &&
    Array.isArray(value.warnings) &&
    value.warnings.every(isMarketingQualityWarning) &&
    Array.isArray(value.improvements) &&
    value.improvements.every(isMarketingQualityImprovement) &&
    typeof value.createdAt === "string" &&
    normalizeDateString(value.createdAt) !== null
  );
}
