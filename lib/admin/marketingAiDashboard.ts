import { readFile } from "node:fs/promises";
import path from "node:path";

type MarketingAiRegistryScenario = {
  id?: unknown;
  campaign?: unknown;
  status?: unknown;
  readiness?: unknown;
};

type MarketingAiRegistryPayload = {
  globalStatus?: unknown;
  summary?: {
    scenarios?: unknown;
    healthy?: unknown;
    warnings?: unknown;
    errors?: unknown;
  };
  scenarios?: MarketingAiRegistryScenario[];
};

export type MarketingAiDashboardData = {
  globalStatus: string;
  scenarios: number;
  healthy: number;
  warnings: number;
  errors: number;
  readyScenario: string;
  readiness: string;
  available: boolean;
  message?: string;
};

const DASHBOARD_DATA_PATH = path.join(
  process.cwd(),
  "marketing-agent",
  "dashboard-data",
  "scenario-registry.json"
);

const FALLBACK_DATA: MarketingAiDashboardData = {
  globalStatus: "UNAVAILABLE",
  scenarios: 0,
  healthy: 0,
  warnings: 0,
  errors: 0,
  readyScenario: "UNAVAILABLE",
  readiness: "UNAVAILABLE",
  available: false,
  message: "Dashboard data unavailable. Run dashboard export.",
};

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export async function getMarketingAiDashboard(): Promise<MarketingAiDashboardData> {
  try {
    const raw = await readFile(DASHBOARD_DATA_PATH, "utf8");
    const parsed = JSON.parse(raw) as MarketingAiRegistryPayload;

    const globalStatus = isString(parsed.globalStatus)
      ? parsed.globalStatus
      : FALLBACK_DATA.globalStatus;

    const scenariosCount = isNumber(parsed.summary?.scenarios)
      ? parsed.summary.scenarios
      : 0;
    const healthyCount = isNumber(parsed.summary?.healthy) ? parsed.summary.healthy : 0;
    const warningsCount = isNumber(parsed.summary?.warnings) ? parsed.summary.warnings : 0;
    const errorsCount = isNumber(parsed.summary?.errors) ? parsed.summary.errors : 0;

    const scenarios = Array.isArray(parsed.scenarios) ? parsed.scenarios : [];
    const readyScenarioEntry =
      scenarios.find(
        (scenario) =>
          isString(scenario.id) &&
          isString(scenario.readiness) &&
          scenario.readiness === "READY FOR REAL PROVIDERS"
      ) ?? scenarios.find((scenario) => isString(scenario.id) && isString(scenario.readiness));

    return {
      globalStatus,
      scenarios: scenariosCount,
      healthy: healthyCount,
      warnings: warningsCount,
      errors: errorsCount,
      readyScenario:
        readyScenarioEntry && isString(readyScenarioEntry.id)
          ? readyScenarioEntry.id
          : "NONE",
      readiness:
        readyScenarioEntry && isString(readyScenarioEntry.readiness)
          ? readyScenarioEntry.readiness
          : "BLOCKED",
      available: true,
    };
  } catch {
    return FALLBACK_DATA;
  }
}
